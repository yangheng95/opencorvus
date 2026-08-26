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
      return mcpName ? { mcpName, phase: "pending" } : undefined
    },
    finish: async (input) => {
      finished.push({
        mcpName: input.resolution.mcpName,
        authorizationCode: input.authorizationCode,
        oauthState: input.oauthState,
      })
      return { status: "connected" }
    },
    joinFinish: async () => {
      throw new Error("No finish is in flight in this authority fixture")
    },
    abandon: async (input) => {
      abandoned.push({
        mcpName: input.resolution.mcpName,
        oauthState: input.oauthState,
        reason: input.reason,
      })
      delete projectFlows[input.oauthState]
      return { outcome: "abandoned" }
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
      return (await McpAuth.getOAuthState(input.authKey)) === oauthState
        ? { mcpName: input.mcpName, phase: "pending" }
        : undefined
    },
    async finish(finishInput) {
      input.finished?.push({
        mcpName: finishInput.resolution.mcpName,
        authorizationCode: finishInput.authorizationCode,
        oauthState: finishInput.oauthState,
      })
      return { status: "connected" }
    },
    async joinFinish() {
      throw new Error("No finish is in flight in this authority fixture")
    },
    async abandon(abandonInput) {
      const abandoned = await McpAuth.abandonOAuthState(input.authKey, abandonInput.oauthState, input.revision)
      if (!abandoned) throw new Error(`OAuth flow ${abandonInput.oauthState} was not current`)
      return { outcome: "abandoned" }
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
        finish: async () => ({ status: "connected" }),
        joinFinish: async () => {
          throw new Error("No finish is in flight in this authority fixture")
        },
        abandon: async () => ({ outcome: "abandoned" }),
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
        finish: async () => ({ status: "connected" }),
        joinFinish: async () => {
          throw new Error("No finish is in flight in this authority fixture")
        },
        abandon: async () => ({ outcome: "abandoned" }),
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

  test("a duplicate callback gives the local waiter the winning completed finish", async () => {
    const oauthState = "duplicate-race-state"
    const timeline: string[] = []
    let admitLocalFinish!: () => void
    const localFinishStarted = new Promise<void>((resolve) => {
      admitLocalFinish = resolve
    })
    let releaseLocalFinish!: () => void
    const localFinishGate = new Promise<void>((resolve) => {
      releaseLocalFinish = resolve
    })
    await McpOAuthCallback.ensureRunning({
      projectID: "duplicate-race-project",
      authority: {
        resolveState: async (state) =>
          state === oauthState ? { mcpName: "duplicate-race-server", phase: "pending" } : undefined,
        async finish(input) {
          if (input.authorizationCode === "local-code") {
            timeline.push("local-finish-started")
            admitLocalFinish()
            await localFinishGate
            timeline.push("local-finish-lost")
            throw new Error("OAuth state was already spent")
          }
          timeline.push("duplicate-finish-complete")
          return { status: "connected" }
        },
        async joinFinish() {
          throw new Error("No finish is in flight in this authority fixture")
        },
        async abandon() {
          return { outcome: "abandoned" }
        },
      },
    })
    const settlement = McpOAuthCallback.waitForCallbackSettlement(
      oauthState,
      "duplicate-race-project:duplicate-race-server",
      "duplicate-race-correlation",
    )

    const localRequest = McpOAuthCallback.handleRequest(new Request(`${CALLBACK}?code=local-code&state=${oauthState}`))
    await localFinishStarted
    McpOAuthCallback.cancelPending("duplicate-race-project:duplicate-race-server")
    timeline.push("cancel-requested")
    const duplicateResponse = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?code=duplicate-code&state=${oauthState}`),
    )
    timeline.push("duplicate-response")
    const waiter = await settlement
    timeline.push("waiter-observed")
    releaseLocalFinish()
    const localResponse = await localRequest
    timeline.push("local-response")

    expect({
      timeline,
      duplicateResponse: duplicateResponse.status,
      localResponse: localResponse.status,
      waiter,
    }).toEqual({
      timeline: [
        "local-finish-started",
        "cancel-requested",
        "duplicate-finish-complete",
        "duplicate-response",
        "waiter-observed",
        "local-finish-lost",
        "local-response",
      ],
      duplicateResponse: 200,
      localResponse: 400,
      waiter: { status: "fulfilled", result: { status: "connected" } },
    })
  }, 60_000)

  test("listener shutdown cannot replace an accepted finish with a waiter failure", async () => {
    const oauthState = "shutdown-during-finish-state"
    const timeline: string[] = []
    let admitFinish!: () => void
    const finishStarted = new Promise<void>((resolve) => {
      admitFinish = resolve
    })
    let releaseFinish!: () => void
    const finishGate = new Promise<void>((resolve) => {
      releaseFinish = resolve
    })
    await McpOAuthCallback.ensureRunning({
      projectID: "shutdown-during-finish-project",
      authority: {
        resolveState: async (state) =>
          state === oauthState ? { mcpName: "shutdown-server", phase: "pending" } : undefined,
        async finish() {
          timeline.push("finish-started")
          admitFinish()
          await finishGate
          timeline.push("finish-complete")
          return { status: "connected" }
        },
        async joinFinish() {
          throw new Error("No finish is in flight in this authority fixture")
        },
        async abandon() {
          return { outcome: "abandoned" }
        },
      },
    })
    const settlement = McpOAuthCallback.waitForCallbackSettlement(
      oauthState,
      "shutdown-during-finish-project:shutdown-server",
      "shutdown-during-finish-correlation",
    )

    const request = McpOAuthCallback.handleRequest(new Request(`${CALLBACK}?code=finish-code&state=${oauthState}`))
    await finishStarted
    await McpOAuthCallback.stop()
    timeline.push("listener-stopped")
    releaseFinish()
    const response = await request
    timeline.push("response-observed")
    const waiter = await settlement
    timeline.push("waiter-observed")

    expect({ timeline, response: response.status, waiter }).toEqual({
      timeline: ["finish-started", "listener-stopped", "finish-complete", "response-observed", "waiter-observed"],
      response: 200,
      waiter: { status: "fulfilled", result: { status: "connected" } },
    })
  }, 60_000)

  test("durable abandonment failure settles provider-error and missing-code waiters", async () => {
    const states = new Set(["abandon-failure-provider-state", "abandon-failure-missing-code-state"])
    await McpOAuthCallback.ensureRunning({
      projectID: "abandon-failure-project",
      authority: {
        resolveState: async (state) =>
          states.has(state) ? { mcpName: "abandon-failure-server", phase: "pending" } : undefined,
        async finish() {
          return { status: "connected" }
        },
        async joinFinish() {
          throw new Error("No finish is in flight in this authority fixture")
        },
        async abandon() {
          throw new Error("durable abandon failed")
        },
      },
    })

    const providerState = "abandon-failure-provider-state"
    const providerWaiter = McpOAuthCallback.waitForCallbackSettlement(
      providerState,
      "abandon-failure-project:abandon-failure-server",
      "abandon-failure-provider-correlation",
    )
    const providerResponse = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?error=access_denied&state=${providerState}`),
    )
    const providerSettlement = await providerWaiter

    const missingCodeState = "abandon-failure-missing-code-state"
    const missingCodeWaiter = McpOAuthCallback.waitForCallbackSettlement(
      missingCodeState,
      "abandon-failure-project:abandon-failure-server",
      "abandon-failure-missing-code-correlation",
    )
    const missingCodeResponse = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?state=${missingCodeState}`),
    )
    const missingCodeSettlement = await missingCodeWaiter

    expect({
      provider: {
        response: providerResponse.status,
        settlement:
          providerSettlement.status === "rejected" ? providerSettlement.error.message : providerSettlement.status,
      },
      missingCode: {
        response: missingCodeResponse.status,
        settlement:
          missingCodeSettlement.status === "rejected"
            ? missingCodeSettlement.error.message
            : missingCodeSettlement.status,
      },
    }).toEqual({
      provider: { response: 500, settlement: "durable abandon failed" },
      missingCode: { response: 500, settlement: "durable abandon failed" },
    })
  }, 60_000)
})
