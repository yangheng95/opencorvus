import { afterEach, describe, expect, test } from "bun:test"
import { McpAuth } from "@/mcp/auth"
import { McpOAuthCallback } from "@/mcp/oauth-callback"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await McpOAuthCallback.stop()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const CALLBACK = "http://127.0.0.1:19876/mcp/oauth/callback"

function authority(
  projectFlows: Record<string, string>,
  finished: unknown[],
  abandoned: unknown[] = [],
): McpOAuthCallback.CallbackAuthority {
  return {
    resolveState: async (oauthState) => {
      const mcpName = projectFlows[oauthState]
      return mcpName ? { mcpName } : undefined
    },
    finish: async (input) => {
      finished.push(input)
    },
    abandon: async (input) => {
      abandoned.push(input)
      delete projectFlows[input.oauthState]
    },
  }
}

function durableAuthority(input: {
  authKey: string
  revision: string
  mcpName: string
  finished?: unknown[]
}): McpOAuthCallback.CallbackAuthority {
  return {
    async resolveState(oauthState) {
      return (await McpAuth.getOAuthState(input.authKey)) === oauthState ? { mcpName: input.mcpName } : undefined
    },
    async finish(finishInput) {
      input.finished?.push(finishInput)
    },
    async abandon(abandonInput) {
      const abandoned = await McpAuth.abandonOAuthState(input.authKey, abandonInput.oauthState, input.revision)
      if (!abandoned) throw new Error(`OAuth flow ${abandonInput.oauthState} was not current`)
    },
  }
}

describe("the OAuth callback listener asks the durable authority, not its own map", () => {
  test("a callback with no waiter in this process finishes the flow the durable authority names", async () => {
    const finished: unknown[] = []

    // The listener has never seen this flow: the caller that opened it timed
    // out, or the listener outlived it. Every fact the completion needs is
    // durable, and admission is single-use inside the credential store.
    await McpOAuthCallback.ensureRunning({
      projectID: "project-alpha",
      authority: authority({ "durable-state": "durable-server" }, finished),
    })

    const response = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?code=authorization-code-1&state=durable-state`),
    )

    expect({ status: response.status, finished }).toEqual({
      status: 200,
      finished: [{ mcpName: "durable-server", authorizationCode: "authorization-code-1", oauthState: "durable-state" }],
    })
  }, 60_000)

  test("each registered project answers for its own flows", async () => {
    const alpha: unknown[] = []
    const beta: unknown[] = []

    // Two active projects. A single shared authority slot would be
    // last-writer-wins and would resolve alpha's callback under beta's
    // identity, refusing a legitimate completion.
    await McpOAuthCallback.ensureRunning({
      projectID: "project-alpha",
      authority: authority({ "alpha-state": "alpha-server" }, alpha),
    })
    await McpOAuthCallback.ensureRunning({
      projectID: "project-beta",
      authority: authority({ "beta-state": "beta-server" }, beta),
    })

    const response = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?code=authorization-code-alpha&state=alpha-state`),
    )

    expect({ status: response.status, alpha, beta }).toEqual({
      status: 200,
      alpha: [{ mcpName: "alpha-server", authorizationCode: "authorization-code-alpha", oauthState: "alpha-state" }],
      beta: [],
    })
  }, 60_000)

  test("a retired authority cannot block the live project that owns a callback", async () => {
    const finished: unknown[] = []
    await McpOAuthCallback.ensureRunning({
      projectID: "retired-project",
      authority: {
        resolveState: async () => {
          throw new Error("retired project is no longer active")
        },
        finish: async () => {},
        abandon: async () => {},
      },
    })
    await McpOAuthCallback.ensureRunning({
      projectID: "live-project",
      authority: authority({ "live-state": "live-server" }, finished),
    })

    const response = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?code=live-authorization-code&state=live-state`),
    )

    expect({ status: response.status, finished }).toEqual({
      status: 200,
      finished: [{ mcpName: "live-server", authorizationCode: "live-authorization-code", oauthState: "live-state" }],
    })
  }, 60_000)

  test("an old registration receipt cannot remove a newer authority for the same project", async () => {
    const finished: unknown[] = []
    const oldRegistration = await McpOAuthCallback.ensureRunning({
      projectID: "same-project",
      authority: authority({ "old-state": "old-server" }, []),
    })
    await McpOAuthCallback.ensureRunning({
      projectID: "same-project",
      authority: authority({ "new-state": "new-server" }, finished),
    })
    expect(oldRegistration).toBeDefined()
    oldRegistration!.unregister()

    const response = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?code=new-authorization-code&state=new-state`),
    )

    expect({ status: response.status, finished }).toEqual({
      status: 200,
      finished: [{ mcpName: "new-server", authorizationCode: "new-authorization-code", oauthState: "new-state" }],
    })
  }, 60_000)

  test("an unattended provider rejection terminalizes the durable flow", async () => {
    const flows = { "rejected-state": "durable-server" }
    const abandoned: unknown[] = []
    await McpOAuthCallback.ensureRunning({
      projectID: "project-alpha",
      authority: authority(flows, [], abandoned),
    })

    const rejection = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?error=access_denied&error_description=operator-declined&state=rejected-state`),
    )
    const replay = await McpOAuthCallback.handleRequest(new Request(`${CALLBACK}?code=late-code&state=rejected-state`))

    expect({ rejection: rejection.status, replay: replay.status, abandoned }).toEqual({
      rejection: 400,
      replay: 400,
      abandoned: [{ mcpName: "durable-server", oauthState: "rejected-state", reason: "operator-declined" }],
    })
  }, 60_000)

  test("an unattended callback without a code terminalizes the durable flow", async () => {
    const flows = { "missing-code-state": "durable-server" }
    const abandoned: unknown[] = []
    await McpOAuthCallback.ensureRunning({
      projectID: "project-alpha",
      authority: authority(flows, [], abandoned),
    })

    const response = await McpOAuthCallback.handleRequest(new Request(`${CALLBACK}?state=missing-code-state`))

    expect({ status: response.status, abandoned }).toEqual({
      status: 400,
      abandoned: [
        { mcpName: "durable-server", oauthState: "missing-code-state", reason: "No authorization code provided" },
      ],
    })
  }, 60_000)

  test("a local waiter provider rejection durably abandons before the listener responds", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mcpName = "local-rejection-server"
        const oauthState = "local-rejection-state"
        const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName })
        const revision = await McpAuth.beginCredentialLease(authKey, "https://local-rejection.invalid/mcp")
        await McpAuth.updateOAuthState(authKey, oauthState, revision)
        await McpAuth.updateCodeVerifier(authKey, "rejected-verifier", revision)
        await McpOAuthCallback.ensureRunning({
          projectID: Instance.project.id,
          authority: durableAuthority({ authKey, revision, mcpName }),
        })
        const settlement = McpOAuthCallback.waitForCallbackSettlement(oauthState, mcpName, "local-rejection")

        const response = await McpOAuthCallback.handleRequest(
          new Request(`${CALLBACK}?error=access_denied&state=${oauthState}`),
        )
        const settled = await settlement
        const replay = await McpOAuthCallback.handleRequest(
          new Request(`${CALLBACK}?code=late-code&state=${oauthState}`),
        )
        const replayBody = await replay.text()

        expect({
          response: response.status,
          settlement: settled.status,
          replay: replay.status,
          replayContract: replayBody.includes("Invalid or expired state"),
        }).toEqual({
          response: 200,
          settlement: "rejected",
          replay: 400,
          replayContract: true,
        })
      },
    })
  }, 60_000)

  test("a local waiter missing-code callback durably abandons before the listener responds", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mcpName = "local-missing-code-server"
        const oauthState = "local-missing-code-state"
        const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName })
        const revision = await McpAuth.beginCredentialLease(authKey, "https://local-missing-code.invalid/mcp")
        await McpAuth.updateOAuthState(authKey, oauthState, revision)
        await McpAuth.updateCodeVerifier(authKey, "missing-code-verifier", revision)
        await McpOAuthCallback.ensureRunning({
          projectID: Instance.project.id,
          authority: durableAuthority({ authKey, revision, mcpName }),
        })
        const settlement = McpOAuthCallback.waitForCallbackSettlement(oauthState, mcpName, "local-missing-code")

        const response = await McpOAuthCallback.handleRequest(new Request(`${CALLBACK}?state=${oauthState}`))
        const settled = await settlement
        const replay = await McpOAuthCallback.handleRequest(
          new Request(`${CALLBACK}?code=late-code&state=${oauthState}`),
        )
        const replayBody = await replay.text()

        expect({
          response: response.status,
          settlement: settled.status,
          replay: replay.status,
          replayContract: replayBody.includes("Invalid or expired state"),
        }).toEqual({
          response: 400,
          settlement: "rejected",
          replay: 400,
          replayContract: true,
        })
      },
    })
  }, 60_000)

  test("a state no durable flow claims is refused", async () => {
    await McpOAuthCallback.ensureRunning({
      projectID: "project-alpha",
      authority: authority({}, []),
    })

    const response = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?code=authorization-code-1&state=forged-state`),
    )

    expect({ status: response.status, body: (await response.text()).includes("Invalid or expired state") }).toEqual({
      status: 400,
      body: true,
    })
  }, 60_000)

  test("an authority that cannot answer produces an error page, not an unhandled rejection", async () => {
    await McpOAuthCallback.ensureRunning({
      projectID: "project-alpha",
      authority: {
        resolveState: async () => {
          throw new Error("project is no longer active")
        },
        finish: async () => {},
        abandon: async () => {},
      },
    })

    const response = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?code=authorization-code-1&state=any-state`),
    )

    expect({ status: response.status, body: (await response.text()).includes("no longer active") }).toEqual({
      status: 500,
      body: true,
    })
  }, 60_000)
})
