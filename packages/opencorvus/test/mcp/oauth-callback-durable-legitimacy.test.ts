import { afterEach, describe, expect, test } from "bun:test"
import { McpOAuthCallback } from "@/mcp/oauth-callback"

afterEach(async () => {
  await McpOAuthCallback.stop()
})

const CALLBACK = "http://127.0.0.1:19876/mcp/oauth/callback"

function authority(projectFlows: Record<string, string>, finished: unknown[]): McpOAuthCallback.CallbackAuthority {
  return {
    resolveState: async (oauthState) => {
      const mcpName = projectFlows[oauthState]
      return mcpName ? { mcpName } : undefined
    },
    finish: async (input) => {
      finished.push(input)
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
