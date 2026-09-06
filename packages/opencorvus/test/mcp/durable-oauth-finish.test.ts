import { afterEach, describe, expect, spyOn, test } from "bun:test"
import path from "node:path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { Config } from "@/config/config"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { deleteProject } from "@/project/delete"
import { recoverProjectDeletionCleanup } from "@/project/deletion-cleanup"
import { Project } from "@/project/project"
import { MCP } from "@/mcp"
import { McpAuth } from "@/mcp/auth"
import { McpOAuthCallback } from "@/mcp/oauth-callback"
import { McpOAuthProvider } from "@/mcp/oauth-provider"
import { McpDebugCommand } from "@/cli/cmd/mcp"
import { Filesystem } from "@/util/filesystem"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { currentTestChildEnvironment } from "../fixture/current-test-child-environment"
import { waitForJSONBarrier as waitForJson } from "../fixture/json-barrier"

afterEach(async () => {
  await McpOAuthCallback.stop()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const SERVER = "durable-finish-server"
const CLIENT_ID = "durable-finish-client"
const brokerWorker = path.join(import.meta.dir, "../fixture/mcp-oauth-callback-broker-worker.ts")
const waiterWorker = path.join(import.meta.dir, "../fixture/mcp-oauth-callback-waiter-worker.ts")
const finishingWorker = path.join(import.meta.dir, "../fixture/mcp-oauth-callback-finishing-worker.ts")
const terminalWorker = path.join(import.meta.dir, "../fixture/mcp-oauth-callback-terminal-worker.ts")

async function waitForBrokerBinding(filepath: string) {
  return waitForJson<{ redirectUrl: string; generation: string }>(filepath)
}

/**
 * One local endpoint playing both roles the finish needs: the OAuth
 * authorization server (metadata + token endpoint) and the MCP server the
 * authenticated connection lands on.
 */
function startOAuthMcpServer(input?: {
  onAuthorizationCodeExchange?: (form: Record<string, string>) => Promise<void>
  onRefreshTokenExchange?: (form: Record<string, string>) => Promise<void>
  rejectAuthenticatedMcp?: boolean
  rejectAuthorizationCode?: boolean
  requireAuthentication?: boolean
  acceptedBearerToken?: string
  rejectRefreshWithDescription?: string
}) {
  const tokenRequests: Record<string, string>[] = []
  const events: Array<
    | { kind: "authorization_code_token_issued" }
    | {
        kind: "mcp_request"
        method: string
        credential: "accepted" | "rejected" | "absent"
        rpcMethod: string | undefined
        responseStatus: number
      }
  > = []
  const server = Bun.serve({
    port: 0,
    fetch: async (request, bunServer) => {
      const url = new URL(request.url)
      if (url.pathname.startsWith("/.well-known/oauth-authorization-server")) {
        const base = `http://127.0.0.1:${bunServer.port}`
        return Response.json({
          issuer: base,
          authorization_endpoint: `${base}/authorize`,
          token_endpoint: `${base}/token`,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
        })
      }
      if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
        const base = `http://127.0.0.1:${bunServer.port}`
        return Response.json({ resource: `${base}/mcp`, authorization_servers: [base] })
      }
      if (url.pathname.startsWith("/.well-known/")) return new Response("not found", { status: 404 })
      if (url.pathname === "/token" && request.method === "POST") {
        const form = new URLSearchParams(await request.text())
        const fields = Object.fromEntries(form.entries())
        tokenRequests.push(fields)
        if (fields.grant_type === "authorization_code") await input?.onAuthorizationCodeExchange?.(fields)
        if (fields.grant_type === "refresh_token") await input?.onRefreshTokenExchange?.(fields)
        if (fields.grant_type === "refresh_token" && input?.rejectRefreshWithDescription) {
          return Response.json(
            { error: "invalid_grant", error_description: input.rejectRefreshWithDescription },
            { status: 400 },
          )
        }
        if (fields.grant_type === "authorization_code" && input?.rejectAuthorizationCode) {
          return Response.json(
            { error: "invalid_grant", error_description: "authorization code rejected" },
            { status: 400 },
          )
        }
        if (fields.grant_type === "authorization_code") events.push({ kind: "authorization_code_token_issued" })
        return Response.json({
          access_token: "durable-finish-access-token",
          token_type: "Bearer",
          refresh_token: "durable-finish-refresh-token",
          expires_in: 3600,
        })
      }
      if (url.pathname === "/mcp") {
        const authorization = request.headers.get("authorization")
        let rpcMethod: string | undefined
        if (request.method === "POST") {
          const payload = await request
            .clone()
            .json()
            .catch(() => undefined)
          if (payload && typeof payload === "object" && !Array.isArray(payload)) {
            const method = (payload as Record<string, unknown>).method
            if (typeof method === "string") rpcMethod = method
          }
        }
        const hasBearerCredential = authorization?.startsWith("Bearer ") === true
        const acceptedBearerCredential = input?.acceptedBearerToken
          ? authorization === `Bearer ${input.acceptedBearerToken}`
          : hasBearerCredential
        const credential = acceptedBearerCredential ? "accepted" : hasBearerCredential ? "rejected" : "absent"
        if (input?.requireAuthentication && !acceptedBearerCredential) {
          const base = `http://127.0.0.1:${bunServer.port}`
          const response = new Response("authorization required", {
            status: 401,
            headers: {
              "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
            },
          })
          events.push({
            kind: "mcp_request",
            method: request.method,
            credential,
            rpcMethod,
            responseStatus: response.status,
          })
          return response
        }
        if (input?.rejectAuthenticatedMcp && tokenRequests.some((item) => item.grant_type === "authorization_code")) {
          const base = `http://127.0.0.1:${bunServer.port}`
          return new Response("authorization remains required", {
            status: 401,
            headers: {
              "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
            },
          })
        }
        const mcp = new McpServer({ name: "durable-finish-fixture", version: "1.0.0" })
        mcp.tool("ping", async () => ({ content: [{ type: "text" as const, text: "pong" }] }))
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        })
        await mcp.connect(transport)
        const response = await transport.handleRequest(request)
        events.push({
          kind: "mcp_request",
          method: request.method,
          credential,
          rpcMethod,
          responseStatus: response.status,
        })
        return response
      }
      return new Response("not found", { status: 404 })
    },
  })
  return { server, tokenRequests, events }
}

describe("MCP OAuth finish from durable facts", () => {
  test("ordinary admission without a pending authorization reports needs_auth", async () => {
    await using project = await memoryProject()
    const { server } = startOAuthMcpServer({ requireAuthentication: true })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const mcpConfig = {
            type: "remote" as const,
            transport: "streamable-http" as const,
            url: `http://127.0.0.1:${server.port}/mcp`,
            oauth: { clientId: CLIENT_ID },
          }
          await Config.updateProjectPatchAtomic(() => ({ mcp: { [SERVER]: mcpConfig } }))

          const result = await MCP.add(SERVER, mcpConfig)
          expect(result.status[SERVER]).toEqual({ status: "needs_auth" })
        },
      })
    } finally {
      server.stop(true)
    }
  }, 60_000)

  test("OAuth debug authorization refuses a replaced canonical MCP definition", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const original = {
          type: "remote" as const,
          transport: "streamable-http" as const,
          url: "https://debug-original.invalid/mcp",
          oauth: { clientId: CLIENT_ID },
        }
        await Config.updateProjectPatchAtomic(() => ({ mcp: { [SERVER]: original } }))
        const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
        const binding = await McpOAuthCallback.ensureRunning()
        const revision = await McpAuth.beginCredentialLease(
          authKey,
          original.url,
          McpOAuthProvider.credentialIdentity(original.url, { clientId: CLIENT_ID }),
        )
        const provider = new McpOAuthProvider(
          SERVER,
          authKey,
          original.url,
          { clientId: CLIENT_ID },
          "authorization",
          binding,
          { onRedirect: () => {} },
          revision,
          async () => {
            await MCP.assertCredentialIdentity(SERVER, original)
            await McpOAuthCallback.assertCurrent(binding)
          },
        )
        await Config.updateProjectPatchAtomic(() => ({
          mcp: { [SERVER]: { ...original, url: "https://debug-replacement.invalid/mcp" } },
        }))
        const result = await provider.clientInformation().catch((error) => error)
        expect({
          result: result instanceof Error ? result.message : result,
          credential: (await McpAuth.get(authKey)) ? "active" : "retired",
        }).toEqual({
          result: `MCP credential identity changed while ${SERVER} was connecting`,
          credential: "retired",
        })
      },
    })
  }, 60_000)

  test("the real MCP debug SDK probe retires its incomplete authorization occurrence", async () => {
    await using project = await memoryProject()
    const { server } = startOAuthMcpServer({ requireAuthentication: true })
    const previousDirectory = process.cwd()
    let authKey = ""
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const mcpConfig = {
            type: "remote" as const,
            transport: "streamable-http" as const,
            url: `http://127.0.0.1:${server.port}/mcp`,
            oauth: { clientId: CLIENT_ID },
          }
          await Config.updateProjectPatchAtomic(() => ({ mcp: { [SERVER]: mcpConfig } }))
          authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
        },
      })

      process.chdir(project.path)
      const handler = McpDebugCommand.handler
      if (typeof handler !== "function") throw new Error("Expected the MCP debug command handler")
      await handler({ name: SERVER, _: ["mcp", "debug"], $0: "opencorvus" } as never)

      const entry = await McpAuth.get(authKey)
      expect({
        flowPhase: entry?.oauthState ? "pending" : "settled",
        verifierLifecycle: entry?.codeVerifier ? "retained" : "cleared",
        terminalOutcomes: Object.values(entry?.oauthCallbackTerminals ?? {}).map((terminal) => terminal.outcome),
      }).toEqual({
        flowPhase: "settled",
        verifierLifecycle: "cleared",
        terminalOutcomes: ["revoked"],
      })
    } finally {
      process.chdir(previousDirectory)
      await server.stop(true)
    }
  }, 60_000)

  test("the MCP debug probe preserves an existing interactive authorization owner", async () => {
    await using project = await memoryProject()
    const { server } = startOAuthMcpServer({ requireAuthentication: true })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const mcpConfig = {
            type: "remote" as const,
            transport: "streamable-http" as const,
            url: `http://127.0.0.1:${server.port}/mcp`,
            oauth: { clientId: CLIENT_ID },
          }
          await Config.updateProjectPatchAtomic(() => ({ mcp: { [SERVER]: mcpConfig } }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const interactive = await MCP.startAuth(SERVER)
          const before = await McpAuth.get(authKey)
          const debug = await MCP.debugAuthProbe(SERVER).catch((error) => error)
          const after = await McpAuth.get(authKey)

          expect({
            interactive: new URL(interactive.authorizationUrl).pathname,
            debug: debug instanceof Error ? debug.message : debug,
            owner: {
              state: after?.oauthState,
              revision: after?.revision,
              callbackGeneration: after?.callbackGeneration,
            },
          }).toEqual({
            interactive: "/authorize",
            debug: `MCP OAuth authorization is already pending: ${authKey}`,
            owner: {
              state: before?.oauthState,
              revision: before?.revision,
              callbackGeneration: before?.callbackGeneration,
            },
          })
        },
      })
    } finally {
      await server.stop(true)
    }
  }, 60_000)

  test("ordinary admission uses a stored token while callback broker maintenance is unreachable", async () => {
    await using project = await memoryProject()
    const { server } = startOAuthMcpServer({ requireAuthentication: true })
    let stalledBroker: ReturnType<typeof Bun.serve> | undefined
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const mcpConfig = {
            type: "remote" as const,
            transport: "streamable-http" as const,
            url: `http://127.0.0.1:${server.port}/mcp`,
            oauth: { clientId: CLIENT_ID },
          }
          await Config.updateProjectPatchAtomic(() => ({ mcp: { [SERVER]: mcpConfig } }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(mcpConfig.url, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, mcpConfig.url, identity)
          await McpAuth.updateTokens(
            authKey,
            { accessToken: "stored-admission-access", expiresAt: Date.now() / 1000 + 3_600 },
            mcpConfig.url,
            revision,
            identity,
          )
          const binding = await McpOAuthCallback.ensureRunning()
          await McpOAuthCallback.stop()
          stalledBroker = Bun.serve({
            hostname: "127.0.0.1",
            port: Number(new URL(binding.redirectUrl).port),
            fetch: async () => {
              await Bun.sleep(2_000)
              return new Response("stalled")
            },
          })

          const result = await MCP.add(SERVER, mcpConfig)
          const retained = await McpAuth.get(authKey)
          expect({ status: result.status[SERVER], credential: retained?.tokens?.accessToken }).toEqual({
            status: { status: "connected" },
            credential: "stored-admission-access",
          })
        },
      })
    } finally {
      stalledBroker?.stop(true)
      server.stop(true)
    }
  }, 60_000)

  test("an in-flight production refresh commits across callback broker rotation", async () => {
    await using project = await memoryProject()
    let releaseRefresh!: () => void
    let refreshStarted!: () => void
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const refreshObserved = new Promise<void>((resolve) => {
      refreshStarted = resolve
    })
    const { server, tokenRequests } = startOAuthMcpServer({
      requireAuthentication: true,
      acceptedBearerToken: "durable-finish-access-token",
      onRefreshTokenExchange: async () => {
        refreshStarted()
        await refreshGate
      },
    })
    let foreignBroker: ReturnType<typeof Bun.serve> | undefined
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const mcpConfig = {
            type: "remote" as const,
            transport: "streamable-http" as const,
            url: `http://127.0.0.1:${server.port}/mcp`,
            oauth: {} as const,
          }
          await Config.updateProjectPatchAtomic(() => ({ mcp: { [SERVER]: mcpConfig } }))
          const configured = (await Config.get()).mcp?.[SERVER]
          if (!configured || configured.type !== "remote") throw new Error("Production MCP config was not committed")
          const binding = await McpOAuthCallback.ensureRunning()
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const configuredOAuth = typeof configured.oauth === "object" ? configured.oauth : undefined
          const oauthIdentity = {
            clientId: configuredOAuth?.clientId,
            clientSecret: configuredOAuth?.clientSecret,
            scope: configuredOAuth?.scope,
          }
          const identity = McpOAuthProvider.credentialIdentity(configured.url, oauthIdentity)
          const revision = await McpAuth.beginCredentialLease(authKey, configured.url, identity)
          await McpAuth.updateClientInfo(
            authKey,
            { clientId: "rotation-refresh-client" },
            configured.url,
            revision,
            identity,
            binding.generation,
            binding.redirectUrl,
          )
          await McpAuth.updateTokens(
            authKey,
            { accessToken: "expired-before-rotation", refreshToken: "rotation-refresh", expiresAt: 1 },
            configured.url,
            revision,
            identity,
          )

          const admission = MCP.add(SERVER, configured)
          await refreshObserved
          await McpOAuthCallback.stop()
          foreignBroker = Bun.serve({
            hostname: "127.0.0.1",
            port: Number(new URL(binding.redirectUrl).port),
            fetch: () => Response.json({ proof: "foreign-broker-proof" }),
          })
          const replacement = await McpOAuthCallback.ensureRunning()
          releaseRefresh()
          const result = await admission
          const retained = await McpAuth.get(authKey)
          expect({
            status: result.status[SERVER],
            brokerRotation: replacement.generation === binding.generation ? "retained" : "replaced",
            credential: retained?.tokens,
            tokenClient: retained?.tokenClientInfo?.clientId,
            refresh: tokenRequests.find((request) => request.grant_type === "refresh_token"),
          }).toEqual({
            status: { status: "connected" },
            brokerRotation: "replaced",
            credential: expect.objectContaining({
              accessToken: "durable-finish-access-token",
              refreshToken: "durable-finish-refresh-token",
            }),
            tokenClient: "rotation-refresh-client",
            refresh: expect.objectContaining({
              client_id: "rotation-refresh-client",
              refresh_token: "rotation-refresh",
            }),
          })
        },
      })
    } finally {
      releaseRefresh?.()
      foreignBroker?.stop(true)
      server.stop(true)
    }
  }, 60_000)

  test("provider-controlled refresh errors project one fixed connection failure", async () => {
    await using project = await memoryProject()
    const secret = "refresh-token-must-not-enter-status-or-log-fields"
    const { server, tokenRequests } = startOAuthMcpServer({
      requireAuthentication: true,
      acceptedBearerToken: "never-issued-access",
      rejectRefreshWithDescription: `provider echoed ${secret}`,
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const mcpConfig = {
            type: "remote" as const,
            transport: "streamable-http" as const,
            url: `http://127.0.0.1:${server.port}/mcp`,
            oauth: { clientId: CLIENT_ID },
          }
          await Config.updateProjectPatchAtomic(() => ({ mcp: { [SERVER]: mcpConfig } }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(mcpConfig.url, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, mcpConfig.url, identity)
          await McpAuth.updateTokens(
            authKey,
            { accessToken: "expired-refresh-access", refreshToken: secret, expiresAt: 1 },
            mcpConfig.url,
            revision,
            identity,
          )

          const result = await MCP.add(SERVER, mcpConfig)
          expect({
            status: result.status[SERVER],
            refresh: tokenRequests.find((request) => request.grant_type === "refresh_token"),
          }).toEqual({
            status: { status: "failed", error: "MCP OAuth connection failed" },
            refresh: expect.objectContaining({ refresh_token: secret }),
          })
        },
      })
    } finally {
      server.stop(true)
    }
  }, 60_000)

  test("ordinary admission preserves a live startAuth occurrence and its original callback succeeds", async () => {
    await using project = await memoryProject()
    const { server, tokenRequests } = startOAuthMcpServer({ requireAuthentication: true })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const mcpConfig = {
            type: "remote" as const,
            transport: "streamable-http" as const,
            url: `http://127.0.0.1:${server.port}/mcp`,
            oauth: { clientId: CLIENT_ID },
          }
          await Config.updateProjectPatchAtomic(() => ({ mcp: { [SERVER]: mcpConfig } }))
          expect((await MCP.add(SERVER, mcpConfig)).status[SERVER]).toEqual({ status: "needs_auth" })

          const authorization = await MCP.startAuth(SERVER)
          const oauthState = new URL(authorization.authorizationUrl).searchParams.get("state")
          if (!oauthState) throw new Error("OAuth authorization URL did not contain its state")
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const beforeAdmission = await McpAuth.get(authKey)
          if (!beforeAdmission?.codeVerifier) throw new Error("OAuth start did not persist its PKCE verifier")

          const concurrent = await MCP.add(SERVER, mcpConfig)
          const afterAdmission = await McpAuth.get(authKey)
          expect({
            status: concurrent.status[SERVER],
            occurrence: {
              state: afterAdmission?.oauthState,
              verifier: afterAdmission?.codeVerifier,
              revision: afterAdmission?.revision,
            },
          }).toEqual({
            status: { status: "needs_auth" },
            occurrence: {
              state: oauthState,
              verifier: beforeAdmission.codeVerifier,
              revision: beforeAdmission.revision,
            },
          })

          const status = await MCP.finishAuthCallback(SERVER, "original-occurrence-code", oauthState)
          expect({
            status,
            exchange: tokenRequests.find((request) => request.grant_type === "authorization_code"),
          }).toEqual({
            status: { status: "connected" },
            exchange: expect.objectContaining({
              code: "original-occurrence-code",
              code_verifier: beforeAdmission.codeVerifier,
            }),
          })
        },
      })
    } finally {
      server.stop(true)
    }
  }, 60_000)

  test("a process with no in-memory flow finishes the callback from the durable lease, state and verifier", async () => {
    await using project = await memoryProject()
    const { server, tokenRequests } = startOAuthMcpServer()
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `http://127.0.0.1:${server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))

          // The exact durable facts the process that ran authorize leaves
          // behind when it dies before the callback: the credential lease,
          // the OAuth state and the PKCE verifier. This process's
          // pendingOAuthFlows map has never seen the flow.
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, {
            clientId: CLIENT_ID,
            clientSecret: undefined,
            scope: undefined,
          })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          const callbackBinding = await McpOAuthCallback.ensureRunning()
          await McpAuth.updateOAuthState(
            authKey,
            "durable-oauth-state",
            revision,
            url,
            identity,
            callbackBinding.generation,
            callbackBinding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "durable-code-verifier", revision)

          const status = await MCP.finishAuthCallback(SERVER, "authorization-code-1", "durable-oauth-state")
          expect(status.status).toBe("connected")

          // The exchange presented the durable PKCE verifier and the
          // callback's code — the rebuilt owner completed the original flow,
          // not a new one.
          const exchange = tokenRequests.find((form) => form.grant_type === "authorization_code")
          expect(exchange?.code_verifier).toBe("durable-code-verifier")
          expect(exchange?.code).toBe("authorization-code-1")

          // The tokens landed under the same lease generation the dead
          // process held — every write stayed fenced.
          const entry = await McpAuth.get(authKey)
          expect(entry?.tokens?.accessToken).toBe("durable-finish-access-token")
          expect(entry?.revision).toBe(revision)
        },
      })
    } finally {
      server.stop(true)
    }
  }, 60_000)

  test("a peer broker finishes a durable flow and settles the initiating backend waiter", async () => {
    await using project = await memoryProject()
    const { server, tokenRequests, events } = startOAuthMcpServer({
      requireAuthentication: true,
      acceptedBearerToken: "durable-finish-access-token",
    })
    const bindingOutput = path.join(project.path, "broker-binding.json")
    const broker = Bun.spawn([process.execPath, brokerWorker, Global.Path.root, bindingOutput], {
      cwd: path.join(import.meta.dir, "../.."),
      env: currentTestChildEnvironment(),
      stdout: "pipe",
      stderr: "pipe",
    })
    try {
      const callbackBinding = await waitForBrokerBinding(bindingOutput)
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `http://127.0.0.1:${server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          const oauthState = "peer-broker-finish-state"
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            url,
            identity,
            callbackBinding.generation,
            callbackBinding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "peer-broker-verifier", revision)
          const settlement = McpOAuthCallback.waitForCallbackSettlement(oauthState, authKey, "peer-broker-finish")

          const response = await fetch(`${callbackBinding.redirectUrl}?code=peer-broker-code&state=${oauthState}`)
          const waiter = await Promise.race([settlement, Bun.sleep(10_000).then(() => "timeout" as const)])
          expect({
            response: response.status,
            waiter,
            exchange: tokenRequests.find((form) => form.grant_type === "authorization_code"),
            eventCount: events.length,
            issuedEvent: events[0],
            mcpEvents: events.slice(1),
          }).toEqual({
            response: 200,
            waiter: { status: "fulfilled", result: { status: "connected" } },
            exchange: expect.objectContaining({
              code: "peer-broker-code",
              code_verifier: "peer-broker-verifier",
              redirect_uri: callbackBinding.redirectUrl,
            }),
            eventCount: 5,
            issuedEvent: { kind: "authorization_code_token_issued" },
            mcpEvents: expect.arrayContaining([
              {
                kind: "mcp_request",
                method: "POST",
                credential: "accepted",
                rpcMethod: "initialize",
                responseStatus: 200,
              },
              {
                kind: "mcp_request",
                method: "POST",
                credential: "accepted",
                rpcMethod: "notifications/initialized",
                responseStatus: 202,
              },
              {
                kind: "mcp_request",
                method: "GET",
                credential: "accepted",
                rpcMethod: undefined,
                responseStatus: 200,
              },
              {
                kind: "mcp_request",
                method: "POST",
                credential: "accepted",
                rpcMethod: "tools/list",
                responseStatus: 200,
              },
            ]),
          })
        },
      })
    } finally {
      if (broker.exitCode === null) broker.kill()
      await broker.exited
      server.stop(true)
    }
  }, 60_000)

  test("ambiguous token commit and transient terminal publication converge for listener and waiters", async () => {
    await using project = await memoryProject()
    const { server, tokenRequests } = startOAuthMcpServer()
    let peer: ReturnType<typeof Bun.spawn> | undefined
    let write: ReturnType<typeof spyOn> | undefined
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `http://127.0.0.1:${server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          const binding = await McpOAuthCallback.ensureRunning()
          const oauthState = "ambiguous-token-and-terminal-state"
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            url,
            identity,
            binding.generation,
            binding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "ambiguous-token-verifier", revision)
          const localWaiter = McpOAuthCallback.waitForCallbackSettlement(oauthState, authKey, "ambiguous-local")
          const peerOutput = path.join(project.path, "ambiguous-terminal-peer.json")
          peer = Bun.spawn(
            [process.execPath, waiterWorker, Global.Path.root, authKey, oauthState, "ambiguous-peer", peerOutput],
            {
              cwd: path.join(import.meta.dir, "../.."),
              env: currentTestChildEnvironment(),
              stdout: "pipe",
              stderr: "pipe",
            },
          )

          const originalWrite = Filesystem.writeAtomic.bind(Filesystem)
          let tokenCommitFailures = 0
          let injectTerminalFailure = true
          write = spyOn(Filesystem, "writeAtomic").mockImplementation(async (...args) => {
            const data = JSON.parse(String(args[1])) as Record<string, McpAuth.Entry>
            const entry = data[authKey]
            if (tokenCommitFailures === 0 && entry?.tokens?.accessToken === "durable-finish-access-token") {
              tokenCommitFailures++
              throw new Error("token write failed before rename")
            }
            if (tokenCommitFailures === 1 && entry?.tokens?.accessToken === "durable-finish-access-token") {
              tokenCommitFailures++
              await originalWrite(...args)
              throw new Error("token write became ambiguous after rename")
            }
            if (injectTerminalFailure && entry?.oauthCallbackTerminals?.[oauthState]?.outcome === "connected") {
              injectTerminalFailure = false
              throw new Error("terminal write failed before rename")
            }
            return originalWrite(...args)
          })

          const response = await McpOAuthCallback.handleRequest(
            new Request(`${binding.redirectUrl}?code=ambiguous-commit-code&state=${oauthState}`),
          )
          write.mockRestore()
          write = undefined
          const peerExit = await peer.exited
          if (peerExit !== 0) {
            throw new Error(`Ambiguous terminal peer failed (${peerExit}): ${await new Response(peer.stderr).text()}`)
          }
          peer = undefined
          const responseBody = await response.text()
          const exchanges = tokenRequests.filter((request) => request.grant_type === "authorization_code")
          expect({
            injected: { tokenCommitFailures, terminal: !injectTerminalFailure },
            response: { status: response.status, successful: responseBody.includes("Authorization Successful") },
            local: await localWaiter,
            peer: await waitForJson(peerOutput),
            terminal: (await McpAuth.getOAuthCallbackTerminal(authKey, oauthState))?.outcome,
            exchange: { count: exchanges.length, code: exchanges[0]?.code },
          }).toEqual({
            injected: { tokenCommitFailures: 2, terminal: true },
            response: { status: 200, successful: true },
            local: { status: "fulfilled", result: { status: "connected" } },
            peer: { status: "fulfilled", result: { status: "connected" } },
            terminal: "connected",
            exchange: { count: 1, code: "ambiguous-commit-code" },
          })
        },
      })
    } finally {
      write?.mockRestore()
      if (peer?.exitCode === null) peer.kill()
      if (peer) await peer.exited
      server.stop(true)
    }
  }, 60_000)

  for (const scenario of [
    { name: "successful exchange", rejectAuthorizationCode: false, attemptedOutcome: "connected" as const },
    { name: "failed exchange", rejectAuthorizationCode: true, attemptedOutcome: "failed" as const },
  ]) {
    test(`${scenario.name} with persistently failed terminal publication converges to one uncertain outcome`, async () => {
      await using project = await memoryProject()
      const { server, tokenRequests } = startOAuthMcpServer({
        rejectAuthorizationCode: scenario.rejectAuthorizationCode,
      })
      let peer: ReturnType<typeof Bun.spawn> | undefined
      let write: ReturnType<typeof spyOn> | undefined
      const restoreTiming = MCP.TestHooks.setOAuthFinishingLeaseTiming({ durationMs: 700, renewIntervalMs: 100 })
      try {
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            const url = `http://127.0.0.1:${server.port}/mcp`
            await Config.updateProjectPatchAtomic(() => ({
              mcp: {
                [SERVER]: {
                  type: "remote" as const,
                  transport: "streamable-http" as const,
                  url,
                  oauth: { clientId: CLIENT_ID },
                },
              },
            }))
            const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
            const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
            const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
            const binding = await McpOAuthCallback.ensureRunning()
            const oauthState = `persistent-terminal-${scenario.attemptedOutcome}`
            await McpAuth.updateOAuthState(
              authKey,
              oauthState,
              revision,
              url,
              identity,
              binding.generation,
              binding.redirectUrl,
            )
            await McpAuth.updateCodeVerifier(authKey, `persistent-${scenario.attemptedOutcome}-verifier`, revision)
            const localWaiter = McpOAuthCallback.waitForCallbackSettlement(
              oauthState,
              authKey,
              `persistent-terminal-local-${scenario.attemptedOutcome}`,
            )
            const peerOutput = path.join(project.path, `persistent-terminal-peer-${scenario.attemptedOutcome}.json`)
            peer = Bun.spawn(
              [
                process.execPath,
                waiterWorker,
                Global.Path.root,
                authKey,
                oauthState,
                `persistent-terminal-peer-${scenario.attemptedOutcome}`,
                peerOutput,
              ],
              {
                cwd: path.join(import.meta.dir, "../.."),
                env: currentTestChildEnvironment(),
                stdout: "pipe",
                stderr: "pipe",
              },
            )

            const originalWrite = Filesystem.writeAtomic.bind(Filesystem)
            let rejectedTerminalWrites = 0
            write = spyOn(Filesystem, "writeAtomic").mockImplementation(async (...args) => {
              const data = JSON.parse(String(args[1])) as Record<string, McpAuth.Entry>
              if (
                rejectedTerminalWrites < 3 &&
                data[authKey]?.oauthCallbackTerminals?.[oauthState]?.outcome === scenario.attemptedOutcome
              ) {
                rejectedTerminalWrites++
                throw new Error(`${scenario.attemptedOutcome} terminal write failed before rename`)
              }
              return originalWrite(...args)
            })
            const response = await McpOAuthCallback.handleRequest(
              new Request(`${binding.redirectUrl}?code=persistent-terminal-code&state=${oauthState}`),
            )
            write.mockRestore()
            write = undefined
            const duplicate = await McpOAuthCallback.handleRequest(
              new Request(`${binding.redirectUrl}?code=duplicate-code&state=${oauthState}`),
            )
            const peerExit = await peer.exited
            if (peerExit !== 0) {
              throw new Error(
                `Persistent terminal peer failed (${peerExit}): ${await new Response(peer.stderr).text()}`,
              )
            }
            peer = undefined
            const fixed = "MCP OAuth exchange outcome is uncertain and cannot be replayed"
            expect({
              rejectedTerminalWrites,
              response: { status: response.status, fixed: (await response.text()).includes(fixed) },
              duplicate: { status: duplicate.status, fixed: (await duplicate.text()).includes(fixed) },
              local: await localWaiter,
              peer: await waitForJson(peerOutput),
              terminal: (await McpAuth.getOAuthCallbackTerminal(authKey, oauthState))?.outcome,
              exchanges: tokenRequests.filter((request) => request.grant_type === "authorization_code").length,
            }).toEqual({
              rejectedTerminalWrites: 3,
              response: { status: 400, fixed: true },
              duplicate: { status: 400, fixed: true },
              local: { status: "rejected", error: expect.objectContaining({ message: fixed }) },
              peer: { status: "rejected", error: { message: fixed } },
              terminal: "exchange_uncertain",
              exchanges: 1,
            })
          },
        })
      } finally {
        write?.mockRestore()
        restoreTiming()
        if (peer?.exitCode === null) peer.kill()
        if (peer) await peer.exited
        server.stop(true)
      }
    }, 60_000)
  }

  test("persistent pre-rename token-store failure publishes one non-replayable uncertain terminal", async () => {
    await using project = await memoryProject()
    const { server, tokenRequests } = startOAuthMcpServer()
    let peer: ReturnType<typeof Bun.spawn> | undefined
    let write: ReturnType<typeof spyOn> | undefined
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `http://127.0.0.1:${server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          const binding = await McpOAuthCallback.ensureRunning()
          const oauthState = "persistent-token-store-failure-state"
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            url,
            identity,
            binding.generation,
            binding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "persistent-token-store-verifier", revision)
          const localWaiter = McpOAuthCallback.waitForCallbackSettlement(oauthState, authKey, "uncertain-local")
          const peerOutput = path.join(project.path, "persistent-token-store-peer.json")
          peer = Bun.spawn(
            [process.execPath, waiterWorker, Global.Path.root, authKey, oauthState, "uncertain-peer", peerOutput],
            {
              cwd: path.join(import.meta.dir, "../.."),
              env: currentTestChildEnvironment(),
              stdout: "pipe",
              stderr: "pipe",
            },
          )
          const originalWrite = Filesystem.writeAtomic.bind(Filesystem)
          let rejectedTokenWrites = 0
          write = spyOn(Filesystem, "writeAtomic").mockImplementation(async (...args) => {
            const data = JSON.parse(String(args[1])) as Record<string, McpAuth.Entry>
            if (data[authKey]?.tokens?.accessToken === "durable-finish-access-token") {
              rejectedTokenWrites++
              throw new Error("persistent token write failure before rename")
            }
            return originalWrite(...args)
          })
          const response = await McpOAuthCallback.handleRequest(
            new Request(`${binding.redirectUrl}?code=uncertain-token-code&state=${oauthState}`),
          )
          write.mockRestore()
          write = undefined
          const duplicate = await McpOAuthCallback.handleRequest(
            new Request(`${binding.redirectUrl}?code=duplicate-must-not-replay&state=${oauthState}`),
          )
          const peerExit = await peer.exited
          if (peerExit !== 0) {
            throw new Error(`Uncertain terminal peer failed (${peerExit}): ${await new Response(peer.stderr).text()}`)
          }
          peer = undefined
          const fixed = "MCP OAuth exchange outcome is uncertain and cannot be replayed"
          const entry = await McpAuth.get(authKey)
          expect({
            rejectedTokenWrites,
            response: { status: response.status, fixed: (await response.text()).includes(fixed) },
            duplicate: { status: duplicate.status, fixed: (await duplicate.text()).includes(fixed) },
            local: await localWaiter,
            peer: await waitForJson(peerOutput),
            terminal: entry?.oauthCallbackTerminals?.[oauthState]?.outcome,
            accessToken: entry?.tokens?.accessToken,
            exchanges: tokenRequests.filter((request) => request.grant_type === "authorization_code").length,
          }).toEqual({
            rejectedTokenWrites: 3,
            response: { status: 400, fixed: true },
            duplicate: { status: 400, fixed: true },
            local: { status: "rejected", error: expect.objectContaining({ message: fixed }) },
            peer: { status: "rejected", error: { message: fixed } },
            terminal: "exchange_uncertain",
            accessToken: undefined,
            exchanges: 1,
          })
        },
      })
    } finally {
      write?.mockRestore()
      if (peer?.exitCode === null) peer.kill()
      if (peer) await peer.exited
      server.stop(true)
    }
  }, 60_000)

  test("a peer SDK duplicate joins the finishing occurrence owned by another backend", async () => {
    await using project = await memoryProject()
    let finishing: ReturnType<typeof Bun.spawn> | undefined
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const oauthState = "cross-process-sdk-duplicate"
          const revision = await McpAuth.beginCredentialLease(authKey, "https://sdk-duplicate.invalid/mcp")
          await McpAuth.updateOAuthState(authKey, oauthState, revision)
          await McpAuth.updateCodeVerifier(authKey, "cross-process-sdk-verifier", revision)
          const finishingOutput = path.join(project.path, "cross-process-finishing.json")
          finishing = Bun.spawn(
            [
              process.execPath,
              finishingWorker,
              Global.Path.root,
              authKey,
              oauthState,
              revision,
              finishingOutput,
              "60000",
            ],
            {
              cwd: path.join(import.meta.dir, "../.."),
              env: currentTestChildEnvironment(),
              stdout: "pipe",
              stderr: "pipe",
            },
          )
          expect(await waitForJson(finishingOutput)).toEqual({ spent: true })

          const duplicate = MCP.finishAuthCallback(SERVER, "peer-duplicate-code", oauthState)
          const publisher = Bun.spawn(
            [process.execPath, terminalWorker, Global.Path.root, authKey, oauthState, revision],
            {
              cwd: path.join(import.meta.dir, "../.."),
              env: currentTestChildEnvironment(),
              stdout: "pipe",
              stderr: "pipe",
            },
          )
          const publisherExit = await publisher.exited
          if (publisherExit !== 0) {
            throw new Error(
              `Terminal publisher failed (${publisherExit}): ${await new Response(publisher.stderr).text()}`,
            )
          }
          expect({
            result: await duplicate,
            terminal: await McpAuth.getOAuthCallbackTerminal(authKey, oauthState),
          }).toEqual({
            result: { status: "connected" },
            terminal: expect.objectContaining({ outcome: "connected" }),
          })
        },
      })
    } finally {
      if (finishing?.exitCode === null) finishing.kill()
      await finishing?.exited
    }
  }, 60_000)

  test("Project deletion terminalizes its durable OAuth callback for local and peer waiters", async () => {
    await using project = await memoryProject()
    const setup = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const url = "https://deleted-project.invalid/mcp"
        await Config.updateProjectPatchAtomic(() => ({
          mcp: {
            [SERVER]: {
              type: "remote" as const,
              transport: "streamable-http" as const,
              url,
              oauth: { clientId: CLIENT_ID },
            },
          },
        }))
        const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
        const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
        const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
        const binding = await McpOAuthCallback.ensureRunning()
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "deleted-project-pending-client" },
          url,
          revision,
          identity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateTokens(
          authKey,
          { accessToken: "deleted-project-pending-access", refreshToken: "deleted-project-pending-refresh" },
          url,
          revision,
          identity,
        )
        const oauthState = "deleted-project-callback"
        await McpAuth.updateOAuthState(
          authKey,
          oauthState,
          revision,
          url,
          identity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateCodeVerifier(authKey, "deleted-project-verifier", revision)
        const credentialAuthKey = McpAuth.scopedKey({
          projectID: Instance.project.id,
          mcpName: `${SERVER}-credential`,
        })
        const credentialRevision = await McpAuth.beginCredentialLease(credentialAuthKey, url, identity)
        await McpAuth.updateClientInfo(
          credentialAuthKey,
          { clientId: "deleted-project-client" },
          url,
          credentialRevision,
          identity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateTokens(
          credentialAuthKey,
          { accessToken: "deleted-project-access", refreshToken: "deleted-project-refresh" },
          url,
          credentialRevision,
          identity,
        )
        const unrelatedAuthKey = McpAuth.scopedKey({
          projectID: "unrelated-project",
          mcpName: `${SERVER}-credential`,
        })
        const unrelatedRevision = await McpAuth.beginCredentialLease(unrelatedAuthKey, url, identity)
        await McpAuth.updateTokens(
          unrelatedAuthKey,
          { accessToken: "unrelated-project-access" },
          url,
          unrelatedRevision,
          identity,
        )
        return { authKey, credentialAuthKey, unrelatedAuthKey, binding, oauthState, project: Instance.project }
      },
    })
    const localWaiter = McpOAuthCallback.waitForCallbackSettlement(
      setup.oauthState,
      setup.authKey,
      "deleted-project-local-waiter",
    )
    const peerOutput = path.join(project.path, "deleted-project-peer-waiter.json")
    const peer = Bun.spawn(
      [
        process.execPath,
        waiterWorker,
        Global.Path.root,
        setup.authKey,
        setup.oauthState,
        "deleted-project-peer-waiter",
        peerOutput,
      ],
      {
        cwd: path.join(import.meta.dir, "../.."),
        env: currentTestChildEnvironment(),
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const deletion = await deleteProject(setup.project, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_delete_project_with_oauth_callback",
      reason: "Delete Project with a durable OAuth callback",
    })
    const response = await McpOAuthCallback.handleRequest(
      new Request(`${setup.binding.redirectUrl}?code=deleted-project-code&state=${setup.oauthState}`),
    )
    const duplicate = await McpOAuthCallback.handleRequest(
      new Request(`${setup.binding.redirectUrl}?code=deleted-project-duplicate&state=${setup.oauthState}`),
    )
    const peerExit = await peer.exited
    if (peerExit !== 0) {
      throw new Error(`Deleted-Project peer waiter failed (${peerExit}): ${await new Response(peer.stderr).text()}`)
    }
    const fixed = "MCP OAuth authorization was revoked before completion"
    expect({
      deletion,
      response: { status: response.status, body: await response.text() },
      duplicate: { status: duplicate.status, body: await duplicate.text() },
      local: await localWaiter,
      peer: await waitForJson(peerOutput),
      terminal: await McpAuth.getOAuthCallbackTerminal(setup.authKey, setup.oauthState),
      sameProjectCredential: (await McpAuth.get(setup.credentialAuthKey)) ? "active" : "retired",
      unrelatedCredential: (await McpAuth.get(setup.unrelatedAuthKey))?.tokens?.accessToken,
    }).toEqual({
      deletion: expect.objectContaining({ ok: true, status: "committed" }),
      response: { status: 400, body: expect.stringContaining(fixed) },
      duplicate: { status: 400, body: expect.stringContaining(fixed) },
      local: { status: "rejected", error: expect.objectContaining({ message: fixed }) },
      peer: { status: "rejected", error: { message: fixed } },
      terminal: expect.objectContaining({ outcome: "revoked", callbackGeneration: setup.binding.generation }),
      sameProjectCredential: "retired",
      unrelatedCredential: "unrelated-project-access",
    })
  }, 60_000)

  test("a deleted-Project callback can revoke only the occurrence captured before a replacement lease", async () => {
    await using project = await memoryProject()
    const setup = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const url = "https://deleted-project-race.invalid/mcp"
        await Config.updateProjectPatchAtomic(() => ({
          mcp: {
            [SERVER]: {
              type: "remote" as const,
              transport: "streamable-http" as const,
              url,
              oauth: { clientId: CLIENT_ID },
            },
          },
        }))
        const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
        const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
        const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
        const binding = await McpOAuthCallback.ensureRunning()
        const oauthState = "deleted-project-old-occurrence"
        await McpAuth.updateOAuthState(
          authKey,
          oauthState,
          revision,
          url,
          identity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateCodeVerifier(authKey, "deleted-project-old-verifier", revision)
        return { authKey, binding, identity, oauthState, project: Instance.project, url }
      },
    })
    const resolution = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    MCP.TestHooks.setAfterOAuthCallbackScopeResolution(async () => {
      resolution.resolve()
      await release.promise
    })
    try {
      const callback = McpOAuthCallback.handleRequest(
        new Request(`${setup.binding.redirectUrl}?code=old-code&state=${setup.oauthState}`),
      )
      await resolution.promise
      await deleteProject(setup.project, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: "request_delete_project_callback_occurrence_race",
        reason: "Delete Project while callback owner resolution is paused",
      })
      const replacementRevision = await McpAuth.beginCredentialLease(setup.authKey, setup.url, setup.identity)
      const replacementState = "replacement-occurrence-must-survive"
      await McpAuth.updateOAuthState(
        setup.authKey,
        replacementState,
        replacementRevision,
        setup.url,
        setup.identity,
        setup.binding.generation,
        setup.binding.redirectUrl,
      )
      release.resolve()

      const response = await callback
      const entry = await McpAuth.get(setup.authKey)
      expect({
        response: { status: response.status, body: await response.text() },
        revision: entry?.revision,
        state: entry?.oauthState,
        oldTerminal: entry?.oauthCallbackTerminals?.[setup.oauthState]?.outcome,
      }).toEqual({
        response: {
          status: 400,
          body: expect.stringContaining("MCP OAuth authorization was revoked before completion"),
        },
        revision: replacementRevision,
        state: replacementState,
        oldTerminal: "revoked",
      })
    } finally {
      release.resolve()
      MCP.TestHooks.setAfterOAuthCallbackScopeResolution(undefined)
    }
  }, 60_000)

  test("committed Project deletion reports credential residue and durable recovery retires it", async () => {
    await using project = await memoryProject()
    const setup = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const url = "https://deletion-residue.invalid/mcp"
        const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
        const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
        const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
        await McpAuth.updateTokens(
          authKey,
          { accessToken: "credential-awaiting-durable-retirement" },
          url,
          revision,
          identity,
        )
        return {
          authKey,
          authPath: path.join(Global.Path.data, "mcp-auth.json"),
          project: Instance.project,
        }
      },
    })
    const originalWrite = Filesystem.writeAtomic.bind(Filesystem)
    let rejectedRetirements = 0
    const write = spyOn(Filesystem, "writeAtomic").mockImplementation(async (...args) => {
      if (String(args[0]) === setup.authPath) {
        rejectedRetirements++
        throw new Error("credential retirement store unavailable")
      }
      return originalWrite(...args)
    })
    try {
      const deletion = await deleteProject(setup.project, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: "request_delete_project_with_credential_residue",
        reason: "Delete Project while credential retirement storage is unavailable",
      })
      const beforeRecovery = await McpAuth.get(setup.authKey)
      const projectRegistryAfterCommit = Project.get(setup.project.id) ? "retained" : "committed"
      const blockedAdmission = await Project.fromDirectory(project.path).catch((error) => error)
      write.mockRestore()
      const recovery = await recoverProjectDeletionCleanup()
      const afterRecovery = await McpAuth.get(setup.authKey)
      const recreated = await Project.fromDirectory(project.path)

      expect({
        deletion,
        rejectedRetirements,
        projectRegistry: projectRegistryAfterCommit,
        beforeRecovery: beforeRecovery?.tokens?.accessToken,
        blockedAdmission: blockedAdmission instanceof Error ? blockedAdmission.name : blockedAdmission,
        recovery: recovery.unreconciled.length === 0 ? "settled" : "pending",
        afterRecovery: afterRecovery ? "active" : "retired",
        recreatedProject: recreated.project.id,
      }).toEqual({
        deletion: expect.objectContaining({
          ok: true,
          status: "committed_with_residue",
          residue: [expect.objectContaining({ path: setup.authPath })],
        }),
        rejectedRetirements: 3,
        projectRegistry: "committed",
        beforeRecovery: "credential-awaiting-durable-retirement",
        blockedAdmission: "ProjectDirectoryAdmissionClosedError",
        recovery: "settled",
        afterRecovery: "retired",
        recreatedProject: setup.project.id,
      })
    } finally {
      write.mockRestore()
    }
  }, 60_000)

  test("a non-connected post-auth status is one fixed failed terminal for the finisher and waiter", async () => {
    await using project = await memoryProject()
    const { server, tokenRequests } = startOAuthMcpServer({ rejectAuthenticatedMcp: true })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `http://127.0.0.1:${server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          const binding = await McpOAuthCallback.ensureRunning()
          const oauthState = "non-connected-status-state"
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            url,
            identity,
            binding.generation,
            binding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "non-connected-verifier", revision)
          const waiter = McpOAuthCallback.waitForCallbackSettlement(oauthState, authKey, "non-connected-status")
          const finish = await MCP.finishAuthCallback(SERVER, "non-connected-code", oauthState).catch((error) => error)

          expect({
            finish: finish instanceof Error ? finish.message : finish,
            waiter: await waiter,
            terminal: await McpAuth.getOAuthCallbackTerminal(authKey, oauthState),
            exchanges: tokenRequests.filter((request) => request.grant_type === "authorization_code").length,
          }).toEqual({
            finish: "MCP OAuth callback did not establish a connected server",
            waiter: {
              status: "rejected",
              error: expect.objectContaining({ message: "MCP OAuth callback did not establish a connected server" }),
            },
            terminal: expect.objectContaining({ outcome: "failed" }),
            exchanges: 1,
          })
        },
      })
    } finally {
      server.stop(true)
    }
  }, 60_000)

  test("an authorization-code rejection maps one remote exchange to the fixed failed terminal", async () => {
    await using project = await memoryProject()
    const { server, tokenRequests } = startOAuthMcpServer({ rejectAuthorizationCode: true })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `http://127.0.0.1:${server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          const binding = await McpOAuthCallback.ensureRunning()
          const oauthState = "rejected-code-state"
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            url,
            identity,
            binding.generation,
            binding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "rejected-code-verifier", revision)

          const finish = await MCP.finishAuthCallback(SERVER, "rejected-code", oauthState).catch((error) => error)
          expect({
            finish: finish instanceof Error ? finish.message : finish,
            exchanges: tokenRequests.filter((request) => request.grant_type === "authorization_code").length,
            terminal: await McpAuth.getOAuthCallbackTerminal(authKey, oauthState),
          }).toEqual({
            finish: "MCP OAuth callback did not establish a connected server",
            exchanges: 1,
            terminal: expect.objectContaining({ outcome: "failed" }),
          })
        },
      })
    } finally {
      server.stop(true)
    }
  }, 60_000)

  for (const rejection of [
    {
      shape: "provider rejection",
      query: "error=access_denied&error_description=provider-controlled-detail&",
      fixed: "OAuth authorization was rejected by the provider",
      outcome: "provider_rejected" as const,
    },
    {
      shape: "missing code",
      query: "",
      fixed: "OAuth callback did not include an authorization code",
      outcome: "missing_code" as const,
    },
  ]) {
    test(`${rejection.shape} has one fixed listener, local-waiter and peer-waiter contract`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `https://${rejection.outcome}.invalid/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          const binding = await McpOAuthCallback.ensureRunning()
          const oauthState = `placement-independent-${rejection.outcome}`
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            url,
            identity,
            binding.generation,
            binding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, `${rejection.outcome}-verifier`, revision)

          const localWaiter = McpOAuthCallback.waitForCallbackSettlement(
            oauthState,
            authKey,
            `local-${rejection.outcome}`,
          )
          const peerOutput = path.join(project.path, `peer-${rejection.outcome}.json`)
          const peer = Bun.spawn(
            [
              process.execPath,
              waiterWorker,
              Global.Path.root,
              authKey,
              oauthState,
              `peer-${rejection.outcome}`,
              peerOutput,
            ],
            {
              cwd: path.join(import.meta.dir, "../.."),
              env: currentTestChildEnvironment(),
              stdout: "pipe",
              stderr: "pipe",
            },
          )
          const originalWrite = Filesystem.writeAtomic.bind(Filesystem)
          let injectTerminalFailure = true
          const write = spyOn(Filesystem, "writeAtomic").mockImplementation(async (...args) => {
            const data = JSON.parse(String(args[1])) as Record<string, McpAuth.Entry>
            if (
              injectTerminalFailure &&
              data[authKey]?.oauthCallbackTerminals?.[oauthState]?.outcome === rejection.outcome
            ) {
              injectTerminalFailure = false
              throw new Error(`${rejection.outcome} terminal write failed before rename`)
            }
            return originalWrite(...args)
          })
          const response = await McpOAuthCallback.handleRequest(
            new Request(`${binding.redirectUrl}?${rejection.query}state=${oauthState}`),
          )
          write.mockRestore()
          const peerExit = await peer.exited
          if (peerExit !== 0) {
            throw new Error(`Peer callback waiter failed (${peerExit}): ${await new Response(peer.stderr).text()}`)
          }
          expect({
            retriedTerminal: !injectTerminalFailure,
            response: { status: response.status, body: await response.text() },
            local: await localWaiter,
            peer: await waitForJson(peerOutput),
            terminal: await McpAuth.getOAuthCallbackTerminal(authKey, oauthState),
          }).toEqual({
            retriedTerminal: true,
            response: { status: 400, body: expect.stringContaining(rejection.fixed) },
            local: { status: "rejected", error: expect.objectContaining({ message: rejection.fixed }) },
            peer: { status: "rejected", error: { message: rejection.fixed } },
            terminal: expect.objectContaining({ outcome: rejection.outcome }),
          })
        },
      })
    }, 60_000)
  }

  test("a committed configuration replacement maps the authorize-time flow to a revoked terminal", async () => {
    await using project = await memoryProject()
    const authorizeServer = startOAuthMcpServer()
    const replacementServer = startOAuthMcpServer()
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const authorizeUrl = `http://127.0.0.1:${authorizeServer.server.port}/mcp`
          const replacementUrl = `http://127.0.0.1:${replacementServer.server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url: authorizeUrl,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(authorizeUrl, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, authorizeUrl, identity)
          const binding = await McpOAuthCallback.ensureRunning()
          const oauthState = "reconfigured-before-callback"
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            authorizeUrl,
            identity,
            binding.generation,
            binding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "reconfigured-verifier", revision)

          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url: replacementUrl,
                oauth: { clientId: "replacement-client" },
              },
            },
          }))
          const finish = await MCP.finishAuthCallback(SERVER, "old-authorization-code", oauthState).catch(
            (error) => error,
          )
          expect({
            finish: finish instanceof Error ? finish.message : finish,
            terminal: await McpAuth.getOAuthCallbackTerminal(authKey, oauthState),
          }).toEqual({
            finish: "MCP OAuth authorization was revoked before completion",
            terminal: expect.objectContaining({ outcome: "revoked" }),
          })
        },
      })
    } finally {
      authorizeServer.server.stop(true)
      replacementServer.server.stop(true)
    }
  }, 60_000)

  test("a mid-exchange configuration replacement keeps the token request on the authorize-time endpoint", async () => {
    await using project = await memoryProject()
    let admitAuthorizeRequest!: () => void
    const authorizeRequestEntered = new Promise<void>((resolve) => (admitAuthorizeRequest = resolve))
    let releaseAuthorizeRequest!: () => void
    const authorizeRequestGate = new Promise<void>((resolve) => (releaseAuthorizeRequest = resolve))
    const requestTrajectory: Array<{ endpoint: string; code: string | undefined }> = []
    const authorizeServer = startOAuthMcpServer({
      async onAuthorizationCodeExchange(form) {
        requestTrajectory.push({ endpoint: "authorize-time", code: form.code })
        admitAuthorizeRequest()
        await authorizeRequestGate
      },
    })
    const replacementServer = startOAuthMcpServer({
      async onAuthorizationCodeExchange(form) {
        requestTrajectory.push({ endpoint: "replacement", code: form.code })
      },
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const authorizeUrl = `http://127.0.0.1:${authorizeServer.server.port}/mcp`
          const replacementUrl = `http://127.0.0.1:${replacementServer.server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url: authorizeUrl,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(authorizeUrl, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, authorizeUrl, identity)
          const binding = await McpOAuthCallback.ensureRunning()
          const oauthState = "reconfigured-during-exchange"
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            authorizeUrl,
            identity,
            binding.generation,
            binding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "mid-exchange-verifier", revision)

          const finish = MCP.finishAuthCallback(SERVER, "authorize-time-code", oauthState).catch((error) => error)
          await authorizeRequestEntered
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url: replacementUrl,
                oauth: { clientId: "replacement-client" },
              },
            },
          }))
          releaseAuthorizeRequest()

          const result = await finish
          expect({
            finish: result instanceof Error ? result.message : result,
            requestTrajectory,
            terminal: await McpAuth.getOAuthCallbackTerminal(authKey, oauthState),
          }).toEqual({
            finish: "MCP OAuth exchange outcome is uncertain and cannot be replayed",
            requestTrajectory: [{ endpoint: "authorize-time", code: "authorize-time-code" }],
            terminal: expect.objectContaining({ outcome: "exchange_uncertain" }),
          })
        },
      })
    } finally {
      releaseAuthorizeRequest()
      authorizeServer.server.stop(true)
      replacementServer.server.stop(true)
    }
  }, 60_000)

  test("a live finishing owner renews its exact durable lease throughout a slow exchange", async () => {
    await using project = await memoryProject()
    let exchangeStarted!: () => void
    const enteredExchange = new Promise<void>((resolve) => (exchangeStarted = resolve))
    let releaseExchange!: () => void
    const exchangeRelease = new Promise<void>((resolve) => (releaseExchange = resolve))
    const { server } = startOAuthMcpServer({
      async onAuthorizationCodeExchange() {
        exchangeStarted()
        await exchangeRelease
      },
    })
    const restoreTiming = MCP.TestHooks.setOAuthFinishingLeaseTiming({ durationMs: 300, renewIntervalMs: 50 })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `http://127.0.0.1:${server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          const binding = await McpOAuthCallback.ensureRunning()
          const oauthState = "renewed-slow-exchange-state"
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            url,
            identity,
            binding.generation,
            binding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "renewed-slow-verifier", revision)
          const finish = MCP.finishAuthCallback(SERVER, "renewed-slow-code", oauthState)
          await enteredExchange
          await expect(McpAuth.beginCredentialLease(authKey, url, identity)).rejects.toThrow(
            `MCP OAuth finish is still active: ${authKey}`,
          )
          await Bun.sleep(750)

          const live = await McpAuth.get(authKey)
          expect({
            state: live?.oauthFinishing?.oauthState,
            leaseIsLive: (live?.oauthFinishing?.leaseExpiresAt ?? 0) > Date.now(),
            revision: live?.revision,
          }).toEqual({ state: oauthState, leaseIsLive: true, revision })
          releaseExchange()
          expect(await finish).toEqual({ status: "connected" })
        },
      })
    } finally {
      releaseExchange()
      restoreTiming()
      server.stop(true)
    }
  }, 60_000)

  test("an admitted exchange keeps the authorize-time redirect binding across broker rotation", async () => {
    await using project = await memoryProject()
    const { server, tokenRequests } = startOAuthMcpServer()
    let unrelated: ReturnType<typeof Bun.serve> | undefined
    const originalSpend = McpAuth.spendOAuthState
    let authorizeBinding: Awaited<ReturnType<typeof McpOAuthCallback.ensureRunning>> | undefined
    let replacementBinding: Awaited<ReturnType<typeof McpOAuthCallback.ensureRunning>> | undefined
    const spend = spyOn(McpAuth, "spendOAuthState").mockImplementation(async (...args) => {
      const spent = await originalSpend(...args)
      if (!spent || !authorizeBinding) return spent
      await McpOAuthCallback.stop()
      unrelated = Bun.serve({
        hostname: "127.0.0.1",
        port: Number(new URL(authorizeBinding.redirectUrl).port),
        fetch: () => Response.json({ generation: "foreign", proof: "00" }),
      })
      replacementBinding = await McpOAuthCallback.ensureRunning()
      return spent
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `http://127.0.0.1:${server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          authorizeBinding = await McpOAuthCallback.ensureRunning()
          await McpAuth.updateOAuthState(
            authKey,
            "rotation-during-finish-state",
            revision,
            url,
            identity,
            authorizeBinding.generation,
            authorizeBinding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "rotation-during-finish-verifier", revision)

          expect(
            await MCP.finishAuthCallback(SERVER, "rotation-during-finish-code", "rotation-during-finish-state"),
          ).toEqual({ status: "connected" })
          expect({
            rotated: replacementBinding?.generation !== authorizeBinding.generation,
            exchange: tokenRequests.find((form) => form.grant_type === "authorization_code"),
            terminal: (await McpAuth.get(authKey))?.oauthCallbackTerminals?.["rotation-during-finish-state"],
          }).toEqual({
            rotated: true,
            exchange: expect.objectContaining({
              code: "rotation-during-finish-code",
              code_verifier: "rotation-during-finish-verifier",
              redirect_uri: authorizeBinding.redirectUrl,
            }),
            terminal: expect.objectContaining({ outcome: "connected" }),
          })
        },
      })
    } finally {
      spend.mockRestore()
      unrelated?.stop(true)
      server.stop(true)
    }
  }, 60_000)

  test("a new state without its own verifier is not rebuilt from the previous lease", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const url = "https://incomplete-oauth-flow.invalid/mcp"
        await Config.updateProjectPatchAtomic(() => ({
          mcp: {
            [SERVER]: {
              type: "remote" as const,
              transport: "streamable-http" as const,
              url,
              oauth: { clientId: CLIENT_ID },
            },
          },
        }))
        const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
        const identity = McpOAuthProvider.credentialIdentity(url, {
          clientId: CLIENT_ID,
          clientSecret: undefined,
          scope: undefined,
        })
        const firstRevision = await McpAuth.beginCredentialLease(authKey, url, identity)
        const callbackBinding = await McpOAuthCallback.ensureRunning()
        await McpAuth.updateOAuthState(
          authKey,
          "first-state",
          firstRevision,
          url,
          identity,
          callbackBinding.generation,
          callbackBinding.redirectUrl,
        )
        await McpAuth.updateCodeVerifier(authKey, "first-verifier", firstRevision)

        const secondRevision = await McpAuth.beginCredentialLease(authKey, url, identity)
        await McpAuth.updateOAuthState(
          authKey,
          "second-state",
          secondRevision,
          url,
          identity,
          callbackBinding.generation,
          callbackBinding.redirectUrl,
        )

        await expect(MCP.finishAuthCallback(SERVER, "second-code", "second-state")).rejects.toThrow(
          "OAuth flow is no longer current",
        )
        const entry = await McpAuth.get(authKey)
        expect({ state: entry?.oauthState, revision: entry?.revision }).toEqual({
          state: "second-state",
          revision: secondRevision,
        })
      },
    })
  }, 60_000)

  test("listener duplicates and the SDK callback share the winner that spent first and completed last", async () => {
    await using project = await memoryProject()
    let admitExchange!: () => void
    const exchangeStarted = new Promise<void>((resolve) => {
      admitExchange = resolve
    })
    let releaseExchange!: () => void
    const exchangeGate = new Promise<void>((resolve) => {
      releaseExchange = resolve
    })
    const { server, tokenRequests } = startOAuthMcpServer({
      async onAuthorizationCodeExchange() {
        admitExchange()
        await exchangeGate
      },
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `http://127.0.0.1:${server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, {
            clientId: CLIENT_ID,
            clientSecret: undefined,
            scope: undefined,
          })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          const oauthState = "winner-first-slow-state"
          const callbackBinding = await McpOAuthCallback.ensureRunning()
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            url,
            identity,
            callbackBinding.generation,
            callbackBinding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "winner-first-slow-verifier", revision)
          const waiter = McpOAuthCallback.waitForCallbackSettlement(
            oauthState,
            authKey,
            "winner-first-slow-correlation",
          )
          const callback = callbackBinding.redirectUrl

          const winnerResponse = McpOAuthCallback.handleRequest(
            new Request(`${callback}?code=listener-winner-code&state=${oauthState}`),
          )
          await exchangeStarted
          const sdkStatus = MCP.finishAuthCallback(SERVER, "sdk-duplicate-code", oauthState)
          const duplicateResponse = McpOAuthCallback.handleRequest(
            new Request(`${callback}?code=listener-duplicate-code&state=${oauthState}`),
          )
          const providerErrorResponse = McpOAuthCallback.handleRequest(
            new Request(`${callback}?error=access_denied&state=${oauthState}`),
          )
          const missingCodeResponse = McpOAuthCallback.handleRequest(new Request(`${callback}?state=${oauthState}`))
          McpOAuthCallback.cancelPending(authKey)
          const joinDeadline = Date.now() + 5_000
          while (MCP.TestHooks.oauthFinishJoinCount(SERVER, oauthState) < 4) {
            if (Date.now() >= joinDeadline) throw new Error("OAuth finish duplicates did not join the winner")
            await new Promise((resolve) => setTimeout(resolve, 5))
          }
          const joinersAtRelease = MCP.TestHooks.oauthFinishJoinCount(SERVER, oauthState)
          releaseExchange()

          const [winner, duplicate, providerError, missingCode, sdk, settled] = await Promise.all([
            winnerResponse,
            duplicateResponse,
            providerErrorResponse,
            missingCodeResponse,
            sdkStatus,
            waiter,
          ])
          const authorizationExchanges = tokenRequests.filter((form) => form.grant_type === "authorization_code")
          expect({
            responses: [winner.status, duplicate.status, providerError.status, missingCode.status],
            joinersAtRelease,
            sdk,
            waiter: settled,
            exchanges: authorizationExchanges.map((form) => ({ code: form.code, verifier: form.code_verifier })),
          }).toEqual({
            responses: [200, 200, 200, 200],
            joinersAtRelease: 4,
            sdk: { status: "connected" },
            waiter: { status: "fulfilled", result: { status: "connected" } },
            exchanges: [{ code: "listener-winner-code", verifier: "winner-first-slow-verifier" }],
          })
        },
      })
    } finally {
      server.stop(true)
    }
  }, 60_000)

  test("provider-error and missing-code listeners join a peer process terminal winner", async () => {
    await using project = await memoryProject()
    const children: Array<ReturnType<typeof Bun.spawn>> = []
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = "https://peer-terminal-winner.invalid/mcp"
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, { clientId: CLIENT_ID })
          const binding = await McpOAuthCallback.ensureRunning()
          const cases = [
            {
              state: "peer-connected-after-provider-error",
              query: "error=access_denied&",
              outcome: "connected" as const,
              response: 200,
              waiter: { status: "fulfilled", result: { status: "connected" } },
            },
            {
              state: "peer-revoked-after-missing-code",
              query: "",
              outcome: "revoked" as const,
              response: 400,
              waiter: {
                status: "rejected",
                error: { message: "MCP OAuth authorization was revoked before completion" },
              },
            },
          ]
          const observations: unknown[] = []
          for (const item of cases) {
            const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
            await McpAuth.updateOAuthState(
              authKey,
              item.state,
              revision,
              url,
              identity,
              binding.generation,
              binding.redirectUrl,
            )
            await McpAuth.updateCodeVerifier(authKey, `${item.state}-verifier`, revision)
            const waiter = McpOAuthCallback.waitForCallbackSettlement(item.state, authKey, `${item.state}-waiter`)
            let ownerResolved!: () => void
            let releaseOwner!: () => void
            const ownerResolution = new Promise<void>((resolve) => {
              ownerResolved = resolve
            })
            const ownerGate = new Promise<void>((resolve) => {
              releaseOwner = resolve
            })
            McpOAuthCallback.TestHooks.setAfterOwnerResolution(async () => {
              ownerResolved()
              await ownerGate
            })
            const responsePromise = McpOAuthCallback.handleRequest(
              new Request(`${binding.redirectUrl}?${item.query}state=${item.state}`),
            )
            await ownerResolution
            const output = path.join(project.path, `${item.state}.json`)
            const finisher = Bun.spawn(
              [process.execPath, finishingWorker, Global.Path.root, authKey, item.state, revision, output, "10000"],
              {
                cwd: path.join(import.meta.dir, "../.."),
                env: currentTestChildEnvironment(),
                stdout: "pipe",
                stderr: "pipe",
              },
            )
            children.push(finisher)
            await waitForJson(output)
            const terminal = Bun.spawn(
              [process.execPath, terminalWorker, Global.Path.root, authKey, item.state, revision, item.outcome],
              {
                cwd: path.join(import.meta.dir, "../.."),
                env: currentTestChildEnvironment(),
                stdout: "pipe",
                stderr: "pipe",
              },
            )
            children.push(terminal)
            const terminalExit = await terminal.exited
            if (terminalExit !== 0) {
              throw new Error(
                `Peer terminal worker failed (${terminalExit}): ${await new Response(terminal.stderr).text()}`,
              )
            }
            releaseOwner()
            McpOAuthCallback.TestHooks.setAfterOwnerResolution(undefined)
            const response = await responsePromise
            const settledWaiter = await waiter
            observations.push({
              outcome: item.outcome,
              response: response.status,
              waiter:
                settledWaiter.status === "rejected"
                  ? { status: "rejected", error: { message: settledWaiter.error.message } }
                  : settledWaiter,
              terminal: (await McpAuth.getOAuthCallbackTerminal(authKey, item.state))?.outcome,
            })
            finisher.kill()
            await finisher.exited
          }
          expect(observations).toEqual(
            cases.map((item) => ({
              outcome: item.outcome,
              response: item.response,
              waiter: item.waiter,
              terminal: item.outcome,
            })),
          )
        },
      })
    } finally {
      McpOAuthCallback.TestHooks.setAfterOwnerResolution(undefined)
      for (const child of children) {
        if (child.exitCode === null) child.kill()
        await child.exited
      }
    }
  }, 60_000)

  test("a callback that resolved the finishing owner keeps its result after the live operation retires", async () => {
    await using project = await memoryProject()
    let admitExchange!: () => void
    const exchangeStarted = new Promise<void>((resolve) => {
      admitExchange = resolve
    })
    let releaseExchange!: () => void
    const exchangeGate = new Promise<void>((resolve) => {
      releaseExchange = resolve
    })
    let admitResolvedDuplicate!: () => void
    const duplicateResolved = new Promise<void>((resolve) => {
      admitResolvedDuplicate = resolve
    })
    let releaseResolvedDuplicate!: () => void
    const duplicateResolutionGate = new Promise<void>((resolve) => {
      releaseResolvedDuplicate = resolve
    })
    const { server, tokenRequests } = startOAuthMcpServer({
      async onAuthorizationCodeExchange() {
        admitExchange()
        await exchangeGate
      },
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const url = `http://127.0.0.1:${server.port}/mcp`
          await Config.updateProjectPatchAtomic(() => ({
            mcp: {
              [SERVER]: {
                type: "remote" as const,
                transport: "streamable-http" as const,
                url,
                oauth: { clientId: CLIENT_ID },
              },
            },
          }))
          const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, {
            clientId: CLIENT_ID,
            clientSecret: undefined,
            scope: undefined,
          })
          const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
          const oauthState = "resolved-finishing-cleanup-state"
          const callbackBinding = await McpOAuthCallback.ensureRunning()
          await McpAuth.updateOAuthState(
            authKey,
            oauthState,
            revision,
            url,
            identity,
            callbackBinding.generation,
            callbackBinding.redirectUrl,
          )
          await McpAuth.updateCodeVerifier(authKey, "resolved-finishing-cleanup-verifier", revision)
          const waiter = McpOAuthCallback.waitForCallbackSettlement(
            oauthState,
            authKey,
            "resolved-finishing-cleanup-correlation",
          )
          const callback = callbackBinding.redirectUrl

          const winnerResponse = McpOAuthCallback.handleRequest(
            new Request(`${callback}?code=resolved-finishing-winner&state=${oauthState}`),
          )
          await exchangeStarted
          McpOAuthCallback.TestHooks.setAfterOwnerResolution(async () => {
            admitResolvedDuplicate()
            await duplicateResolutionGate
          })
          const duplicateResponse = McpOAuthCallback.handleRequest(
            new Request(`${callback}?error=access_denied&state=${oauthState}`),
          )
          await duplicateResolved

          releaseExchange()
          const winner = await winnerResponse
          const mapCleared = !MCP.TestHooks.oauthFinishInFlight(SERVER, oauthState)
          releaseResolvedDuplicate()
          const [duplicate, settled] = await Promise.all([duplicateResponse, waiter])
          const authorizationExchanges = tokenRequests.filter((form) => form.grant_type === "authorization_code")

          expect({
            responses: [winner.status, duplicate.status],
            mapCleared,
            waiter: settled,
            exchanges: authorizationExchanges.map((form) => ({ code: form.code, verifier: form.code_verifier })),
          }).toEqual({
            responses: [200, 200],
            mapCleared: true,
            waiter: { status: "fulfilled", result: { status: "connected" } },
            exchanges: [{ code: "resolved-finishing-winner", verifier: "resolved-finishing-cleanup-verifier" }],
          })
        },
      })
    } finally {
      server.stop(true)
    }
  }, 60_000)

  for (const rejectedShape of ["provider-error", "missing-code"] as const) {
    test(`${rejectedShape} callback joins a code finish that wins after its pending-state read`, async () => {
      await using project = await memoryProject()
      let admitAbandon!: () => void
      const abandonStarted = new Promise<void>((resolve) => {
        admitAbandon = resolve
      })
      let releaseAbandon!: () => void
      const abandonGate = new Promise<void>((resolve) => {
        releaseAbandon = resolve
      })
      let admitExchange!: () => void
      const exchangeStarted = new Promise<void>((resolve) => {
        admitExchange = resolve
      })
      let releaseExchange!: () => void
      const exchangeGate = new Promise<void>((resolve) => {
        releaseExchange = resolve
      })
      const { server, tokenRequests } = startOAuthMcpServer({
        async onAuthorizationCodeExchange() {
          admitExchange()
          await exchangeGate
        },
      })
      const originalAbandon = McpAuth.abandonOAuthState
      const abandon = spyOn(McpAuth, "abandonOAuthState").mockImplementation(async (...args) => {
        admitAbandon()
        await abandonGate
        return originalAbandon(...args)
      })
      try {
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            const url = `http://127.0.0.1:${server.port}/mcp`
            await Config.updateProjectPatchAtomic(() => ({
              mcp: {
                [SERVER]: {
                  type: "remote" as const,
                  transport: "streamable-http" as const,
                  url,
                  oauth: { clientId: CLIENT_ID },
                },
              },
            }))
            const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
            const identity = McpOAuthProvider.credentialIdentity(url, {
              clientId: CLIENT_ID,
              clientSecret: undefined,
              scope: undefined,
            })
            const revision = await McpAuth.beginCredentialLease(authKey, url, identity)
            const oauthState = `pending-read-race-${rejectedShape}`
            const callbackBinding = await McpOAuthCallback.ensureRunning()
            await McpAuth.updateOAuthState(
              authKey,
              oauthState,
              revision,
              url,
              identity,
              callbackBinding.generation,
              callbackBinding.redirectUrl,
            )
            await McpAuth.updateCodeVerifier(authKey, `pending-read-verifier-${rejectedShape}`, revision)
            const waiter = McpOAuthCallback.waitForCallbackSettlement(
              oauthState,
              authKey,
              `pending-read-correlation-${rejectedShape}`,
            )
            const callback = callbackBinding.redirectUrl
            const rejectedUrl =
              rejectedShape === "provider-error"
                ? `${callback}?error=access_denied&state=${oauthState}`
                : `${callback}?state=${oauthState}`

            // The rejected callback has already resolved a pending owner and
            // entered the durable abandon, but has not linearized it yet.
            const rejectedResponse = McpOAuthCallback.handleRequest(new Request(rejectedUrl))
            await abandonStarted

            // The code callback now creates the canonical operation, spends
            // the state and blocks only after the token exchange begins.
            const winnerResponse = McpOAuthCallback.handleRequest(
              new Request(`${callback}?code=winner-code-${rejectedShape}&state=${oauthState}`),
            )
            await exchangeStarted

            // Complete and retire the winner before the blocked abandon is
            // allowed to observe that it lost. The callback-owned claim, not
            // a second lookup in the live-operation map, must retain the
            // canonical Promise across that cleanup boundary.
            releaseExchange()
            const winner = await winnerResponse
            const mapCleared = !MCP.TestHooks.oauthFinishInFlight(SERVER, oauthState)
            releaseAbandon()

            const [rejected, settled] = await Promise.all([rejectedResponse, waiter])
            const authorizationExchanges = tokenRequests.filter((form) => form.grant_type === "authorization_code")
            expect({
              responses: [rejected.status, winner.status],
              mapCleared,
              waiter: settled,
              exchanges: authorizationExchanges.map((form) => ({ code: form.code, verifier: form.code_verifier })),
            }).toEqual({
              responses: [200, 200],
              mapCleared: true,
              waiter: { status: "fulfilled", result: { status: "connected" } },
              exchanges: [
                {
                  code: `winner-code-${rejectedShape}`,
                  verifier: `pending-read-verifier-${rejectedShape}`,
                },
              ],
            })
          },
        })
      } finally {
        abandon.mockRestore()
        server.stop(true)
      }
    }, 60_000)
  }

  test("callback failure remains the cause when OAuth state cleanup also fails", async () => {
    const callbackError = new Error("canonical callback failure")
    const cleanupError = new Error("credential store cleanup failure")
    const clear = spyOn(McpAuth, "clearOAuthStateIfOwned").mockRejectedValue(cleanupError)
    const error = await MCP.TestHooks.rethrowRejectedOAuthCallback({
      authKey: "aggregate-error-project:aggregate-error-server",
      revision: "aggregate-error-revision",
      callbackError,
    }).catch((cause) => cause)
    clear.mockRestore()

    expect({
      aggregate: error instanceof AggregateError,
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error.cause : undefined,
      errors: error instanceof AggregateError ? error.errors : [],
    }).toEqual({
      aggregate: true,
      message:
        "MCP OAuth callback failed and state cleanup also failed for aggregate-error-project:aggregate-error-server",
      cause: callbackError,
      errors: [callbackError, cleanupError],
    })
  }, 60_000)
})
