import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { auth, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js"
import { Global } from "../../src/global"
import { McpAuth } from "../../src/mcp/auth"
import { McpOAuthProvider, McpOAuthIssuerRequiredError } from "../../src/mcp/oauth-provider"
import { McpConfigSchema } from "../../src/config/mcp-schema"

const key = "issuer-fixture:server"
let server: ReturnType<typeof Bun.serve> | undefined
afterEach(async () => {
  await server?.stop(true)
  server = undefined
  await fs.rm(path.join(Global.Path.data, "mcp-auth.json"), { force: true })
})

function fixture() {
  const calls: { path: string; grant: string | null }[] = []
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      const issuer = url.origin
      if (url.pathname.includes("oauth-protected-resource"))
        return Response.json({ resource: `${issuer}/mcp`, authorization_servers: [issuer] })
      if (url.pathname.includes("oauth-authorization-server"))
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          registration_endpoint: `${issuer}/register`,
          response_types_supported: ["code"],
          token_endpoint_auth_methods_supported: ["client_secret_post"],
        })
      if (url.pathname === "/token") {
        const body = new URLSearchParams(await request.text())
        calls.push({ path: url.pathname, grant: body.get("grant_type") })
        return Response.json({
          access_token: "fixture-refreshed",
          refresh_token: "fixture-refresh-new",
          token_type: "Bearer",
          expires_in: 3600,
        })
      }
      if (url.pathname === "/register") {
        calls.push({ path: url.pathname, grant: null })
        return Response.json({
          client_id: "fixture-new-client",
          client_secret: "fixture-new-secret",
          redirect_uris: ["http://127.0.0.1:19876/mcp/oauth/callback"],
        })
      }
      return new Response("not found", { status: 404 })
    },
  })
  return { issuer: server.url.origin, calls }
}
async function provider(issuer: string, serverUrl: string) {
  const config = { clientId: "fixture-client", clientSecret: "fixture-secret", issuer }
  const identity = McpOAuthProvider.credentialIdentity(serverUrl, config)
  const revision = await McpAuth.beginCredentialLease(key, serverUrl, identity)
  await McpAuth.updateClientInfo(
    key,
    { clientId: config.clientId, clientSecret: config.clientSecret, issuer },
    serverUrl,
    revision,
    identity,
  )
  await McpAuth.updateTokens(
    key,
    { accessToken: "fixture-old", refreshToken: "fixture-refresh", issuer },
    serverUrl,
    revision,
    identity,
  )
  return new McpOAuthProvider(
    "fixture",
    key,
    serverUrl,
    config,
    "connection",
    { generation: "fixture-generation", redirectUrl: "http://127.0.0.1:19876/mcp/oauth/callback" },
    { onRedirect() {} },
    revision,
  )
}

test("real SDK refresh persists and reads the exact authorization issuer", async () => {
  const { issuer, calls } = fixture()
  const current = await provider(issuer, `${issuer}/mcp`)
  expect(await auth(current, { serverUrl: `${issuer}/mcp` })).toBe("AUTHORIZED")
  expect(calls).toEqual([{ path: "/token", grant: "refresh_token" }])
  expect((await McpAuth.get(key))?.tokens).toEqual(
    expect.objectContaining({ issuer, accessToken: "fixture-refreshed", refreshToken: "fixture-refresh-new" }),
  )
  expect(await current.tokens()).toEqual(expect.objectContaining({ issuer, access_token: "fixture-refreshed" }))
})

test("different issuer reaches the actual SDK authorization-required boundary", async () => {
  const { issuer } = fixture()
  const current = await provider("https://original-issuer.fixture.test", `${issuer}/mcp`)
  await expect(auth(current, { serverUrl: `${issuer}/mcp` })).rejects.toBeInstanceOf(UnauthorizedError)
  expect((await McpAuth.get(key))?.tokens).toEqual(
    expect.objectContaining({ issuer: "https://original-issuer.fixture.test", accessToken: "fixture-old" }),
  )
})

test("legacy unstamped credentials settle to typed reauthorization and exact retirement", async () => {
  const { issuer } = fixture()
  const current = await provider(issuer, `${issuer}/mcp`)
  const entry = await McpAuth.get(key)
  if (!entry?.tokens || !entry.clientInfo) throw new Error("fixture requires established credentials")
  delete entry.tokens.issuer
  delete entry.clientInfo.issuer
  if (entry.tokenClientInfo) delete entry.tokenClientInfo.issuer
  await fs.writeFile(path.join(Global.Path.data, "mcp-auth.json"), JSON.stringify({ [key]: entry }))
  await expect(current.clientInformation()).rejects.toBeInstanceOf(McpOAuthIssuerRequiredError)
  const retired = await McpAuth.get(key)
  expect(retired?.revision).toBe(entry.revision)
})

test("pre-registered configuration exposes its missing issuer validation contract", () => {
  const parsed = McpConfigSchema.McpOAuth.safeParse({ clientId: "fixture-client" })
  if (parsed.success) throw new Error("expected configuration validation error")
  expect(parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code }))).toEqual([
    { path: ["issuer"], code: "custom" },
  ])
})

test("legacy dynamic credentials establish a fresh real SDK authorization with the actual issuer", async () => {
  const { issuer, calls } = fixture()
  const serverUrl = `${issuer}/mcp`
  const identity = McpOAuthProvider.credentialIdentity(serverUrl, {})
  const revision = await McpAuth.beginCredentialLease(key, serverUrl, identity)
  await McpAuth.updateOAuthState(key, "fixture-new-state", revision)
  const entry = await McpAuth.get(key)
  if (!entry) throw new Error("fixture requires an established authorization lease")
  await fs.writeFile(
    path.join(Global.Path.data, "mcp-auth.json"),
    JSON.stringify({
      [key]: {
        ...entry,
        clientInfo: { clientId: "legacy-client", clientSecret: "legacy-secret" },
        tokens: { accessToken: "legacy-access", refreshToken: "legacy-refresh" },
      },
    }),
  )
  let authorization: URL | undefined
  const current = new McpOAuthProvider(
    "fixture",
    key,
    serverUrl,
    {},
    "authorization",
    { generation: "fixture-new-generation", redirectUrl: "http://127.0.0.1:19876/mcp/oauth/callback" },
    {
      onRedirect(url) {
        authorization = url
      },
    },
    revision,
  )
  expect(await auth(current, { serverUrl })).toBe("REDIRECT")
  if (!authorization) throw new Error("actual SDK authorization redirect is required")
  expect({
    origin: authorization.origin,
    client: authorization.searchParams.get("client_id"),
    state: authorization.searchParams.get("state"),
  }).toEqual({ origin: issuer, client: "fixture-new-client", state: "fixture-new-state" })
  expect(await auth(current, { serverUrl, authorizationCode: "fixture-code" })).toBe("AUTHORIZED")
  expect(calls).toEqual([
    { path: "/register", grant: null },
    { path: "/token", grant: "authorization_code" },
  ])
  expect(await McpAuth.get(key)).toEqual(
    expect.objectContaining({
      revision,
      clientInfo: expect.objectContaining({ issuer, clientId: "fixture-new-client" }),
      tokens: expect.objectContaining({ issuer, accessToken: "fixture-refreshed" }),
    }),
  )
})
