import { afterEach, describe, expect, test } from "bun:test"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { MCP } from "@/mcp"
import { McpAuth } from "@/mcp/auth"
import { McpOAuthProvider } from "@/mcp/oauth-provider"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const SERVER = "durable-finish-server"
const CLIENT_ID = "durable-finish-client"

/**
 * One local endpoint playing both roles the finish needs: the OAuth
 * authorization server (metadata + token endpoint) and the MCP server the
 * authenticated connection lands on.
 */
function startOAuthMcpServer() {
  const tokenRequests: Record<string, string>[] = []
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
      if (url.pathname.startsWith("/.well-known/")) return new Response("not found", { status: 404 })
      if (url.pathname === "/token" && request.method === "POST") {
        const form = new URLSearchParams(await request.text())
        tokenRequests.push(Object.fromEntries(form.entries()))
        return Response.json({
          access_token: "durable-finish-access-token",
          token_type: "Bearer",
          refresh_token: "durable-finish-refresh-token",
          expires_in: 3600,
        })
      }
      if (url.pathname === "/mcp") {
        const mcp = new McpServer({ name: "durable-finish-fixture", version: "1.0.0" })
        mcp.tool("ping", async () => ({ content: [{ type: "text" as const, text: "pong" }] }))
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        })
        await mcp.connect(transport)
        return transport.handleRequest(request)
      }
      return new Response("not found", { status: 404 })
    },
  })
  return { server, tokenRequests }
}

describe("MCP OAuth finish from durable facts", () => {
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
          await McpAuth.updateOAuthState(authKey, "durable-oauth-state", revision, url, identity)
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
})
