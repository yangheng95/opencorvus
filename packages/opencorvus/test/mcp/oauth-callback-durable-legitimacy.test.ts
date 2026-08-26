import { afterEach, describe, expect, test } from "bun:test"
import { McpOAuthCallback } from "@/mcp/oauth-callback"

afterEach(async () => {
  await McpOAuthCallback.stop()
})

const CALLBACK = "http://127.0.0.1:19876/mcp/oauth/callback"

describe("the OAuth callback listener asks the durable authority, not its own map", () => {
  test("a callback with no waiter in this process finishes the flow the durable authority names", async () => {
    const finished: { mcpName: string; authorizationCode: string; oauthState: string }[] = []

    // The listener has never seen this flow: the process that opened it died,
    // or its waiter timed out. Every fact the completion needs is durable.
    await McpOAuthCallback.ensureRunning({
      resolveState: async (oauthState) => (oauthState === "durable-state" ? { mcpName: "durable-server" } : undefined),
      finish: async (input) => {
        finished.push(input)
      },
    })

    const response = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?code=authorization-code-1&state=durable-state`),
    )

    expect({ status: response.status, finished }).toEqual({
      status: 200,
      finished: [{ mcpName: "durable-server", authorizationCode: "authorization-code-1", oauthState: "durable-state" }],
    })
  }, 60_000)

  test("a state no durable flow claims is refused", async () => {
    await McpOAuthCallback.ensureRunning({
      resolveState: async () => undefined,
      finish: async () => {
        throw new Error("an unclaimed state must never reach the finish path")
      },
    })

    const response = await McpOAuthCallback.handleRequest(
      new Request(`${CALLBACK}?code=authorization-code-1&state=forged-state`),
    )

    expect({ status: response.status, body: (await response.text()).includes("Invalid or expired state") }).toEqual({
      status: 400,
      body: true,
    })
  }, 60_000)
})
