import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { MCP } from "@/mcp"
import { McpAuth } from "@/mcp/auth"
import { McpOAuthCallback } from "@/mcp/oauth-callback"
import { McpOAuthProvider } from "@/mcp/oauth-provider"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await McpOAuthCallback.stop()
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
function startOAuthMcpServer(input?: {
  onAuthorizationCodeExchange?: (form: Record<string, string>) => Promise<void>
}) {
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
        const fields = Object.fromEntries(form.entries())
        tokenRequests.push(fields)
        if (fields.grant_type === "authorization_code") await input?.onAuthorizationCodeExchange?.(fields)
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
        await McpAuth.updateOAuthState(authKey, "first-state", firstRevision, url, identity)
        await McpAuth.updateCodeVerifier(authKey, "first-verifier", firstRevision)

        const secondRevision = await McpAuth.beginCredentialLease(authKey, url, identity)
        await McpAuth.updateOAuthState(authKey, "second-state", secondRevision, url, identity)

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
          await McpAuth.updateOAuthState(authKey, oauthState, revision, url, identity)
          await McpAuth.updateCodeVerifier(authKey, "winner-first-slow-verifier", revision)
          await MCP.TestHooks.registerOAuthCallbackAuthority()
          const waiter = McpOAuthCallback.waitForCallbackSettlement(
            oauthState,
            authKey,
            "winner-first-slow-correlation",
          )
          const callback = `http://127.0.0.1:19876/mcp/oauth/callback`

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
          await McpAuth.updateOAuthState(authKey, oauthState, revision, url, identity)
          await McpAuth.updateCodeVerifier(authKey, "resolved-finishing-cleanup-verifier", revision)
          await MCP.TestHooks.registerOAuthCallbackAuthority()
          const waiter = McpOAuthCallback.waitForCallbackSettlement(
            oauthState,
            authKey,
            "resolved-finishing-cleanup-correlation",
          )
          const callback = "http://127.0.0.1:19876/mcp/oauth/callback"

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

  test("a non-owner project cannot delay the owner receipt until after its winner retires", async () => {
    await using nonOwnerProject = await memoryProject()
    await using ownerProject = await memoryProject()
    let admitNonOwnerRead!: () => void
    const nonOwnerReadStarted = new Promise<void>((resolve) => {
      admitNonOwnerRead = resolve
    })
    let unblockNonOwnerRead!: () => void
    const nonOwnerReadGate = new Promise<void>((resolve) => {
      unblockNonOwnerRead = resolve
    })
    await Instance.provide({
      directory: nonOwnerProject.path,
      fn: async () => {
        await MCP.TestHooks.registerOAuthCallbackAuthority({
          async resolveState() {
            admitNonOwnerRead()
            await nonOwnerReadGate
            return undefined
          },
          async finish() {
            throw new Error("Non-owner authority cannot finish the owner's flow")
          },
          async joinFinish() {
            throw new Error("Non-owner authority cannot join the owner's flow")
          },
          async abandon() {
            throw new Error("Non-owner authority cannot abandon the owner's flow")
          },
        })
      },
    })

    const { server, tokenRequests } = startOAuthMcpServer()
    const oauthState = "multi-project-owner-receipt-state"
    let ownerAuthKey = ""
    try {
      await Instance.provide({
        directory: ownerProject.path,
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
          ownerAuthKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
          const identity = McpOAuthProvider.credentialIdentity(url, {
            clientId: CLIENT_ID,
            clientSecret: undefined,
            scope: undefined,
          })
          const revision = await McpAuth.beginCredentialLease(ownerAuthKey, url, identity)
          await McpAuth.updateOAuthState(ownerAuthKey, oauthState, revision, url, identity)
          await McpAuth.updateCodeVerifier(ownerAuthKey, "multi-project-owner-verifier", revision)
          await MCP.TestHooks.registerOAuthCallbackAuthority()
        },
      })
      const waiter = McpOAuthCallback.waitForCallbackSettlement(
        oauthState,
        ownerAuthKey,
        "multi-project-owner-receipt-correlation",
      )
      const callback = "http://127.0.0.1:19876/mcp/oauth/callback"

      // Resolution invokes the earlier non-owner and the true owner before it
      // awaits either. The non-owner remains blocked while the owner receipt
      // must already be able to capture an SDK winner.
      const duplicateResponse = McpOAuthCallback.handleRequest(
        new Request(`${callback}?error=access_denied&state=${oauthState}`),
      )
      await nonOwnerReadStarted
      const winner = await Instance.provide({
        directory: ownerProject.path,
        fn: () => MCP.finishAuthCallback(SERVER, "multi-project-owner-code", oauthState),
      })
      const mapCleared = await Instance.provide({
        directory: ownerProject.path,
        fn: async () => !MCP.TestHooks.oauthFinishInFlight(SERVER, oauthState),
      })

      unblockNonOwnerRead()
      const [duplicate, settled] = await Promise.all([duplicateResponse, waiter])
      const authorizationExchanges = tokenRequests.filter((form) => form.grant_type === "authorization_code")
      expect({
        winner,
        duplicate: duplicate.status,
        mapCleared,
        waiter: settled,
        exchanges: authorizationExchanges.map((form) => ({ code: form.code, verifier: form.code_verifier })),
      }).toEqual({
        winner: { status: "connected" },
        duplicate: 200,
        mapCleared: true,
        waiter: { status: "fulfilled", result: { status: "connected" } },
        exchanges: [{ code: "multi-project-owner-code", verifier: "multi-project-owner-verifier" }],
      })
    } finally {
      unblockNonOwnerRead()
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
            await McpAuth.updateOAuthState(authKey, oauthState, revision, url, identity)
            await McpAuth.updateCodeVerifier(authKey, `pending-read-verifier-${rejectedShape}`, revision)
            await MCP.TestHooks.registerOAuthCallbackAuthority()
            const waiter = McpOAuthCallback.waitForCallbackSettlement(
              oauthState,
              authKey,
              `pending-read-correlation-${rejectedShape}`,
            )
            const callback = "http://127.0.0.1:19876/mcp/oauth/callback"
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
