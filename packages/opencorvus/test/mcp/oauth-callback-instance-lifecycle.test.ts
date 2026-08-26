import { afterEach, expect, test } from "bun:test"
import { MCP } from "@/mcp"
import { McpOAuthCallback } from "@/mcp/oauth-callback"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const CALLBACK = "http://127.0.0.1:19876/mcp/oauth/callback"

afterEach(async () => {
  await Instance.disposeAll()
  await McpOAuthCallback.stop()
  await resetMemoryDatabase()
})

function authority(input: {
  flows?: Record<string, string>
  finished?: unknown[]
}): McpOAuthCallback.CallbackAuthority {
  return {
    async resolveState(oauthState) {
      const mcpName = input.flows?.[oauthState]
      return mcpName ? { mcpName, phase: "pending" } : undefined
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
    async abandon() {
      return { outcome: "abandoned" }
    },
  }
}

test("MCP Instance disposal retires its callback authority before another project resolves", async () => {
  await using retiredProject = await memoryProject()
  await Instance.provide({
    directory: retiredProject.path,
    fn: () =>
      MCP.TestHooks.registerOAuthCallbackAuthority(
        authority({ flows: { "live-state": "retired-server" }, finished: [] }),
      ),
  })
  await Instance.disposeAll()

  await using liveProject = await memoryProject()
  const finished: unknown[] = []
  const response = await Instance.provide({
    directory: liveProject.path,
    fn: async () => {
      await MCP.TestHooks.registerOAuthCallbackAuthority(
        authority({ flows: { "live-state": "live-server" }, finished }),
      )
      return McpOAuthCallback.handleRequest(new Request(`${CALLBACK}?code=live-code&state=live-state`))
    },
  })

  expect({ status: response.status, finished }).toEqual({
    status: 200,
    finished: [{ mcpName: "live-server", authorizationCode: "live-code", oauthState: "live-state" }],
  })
}, 60_000)

test("MCP Instance stores and disposes only the newest same-project authority generation", async () => {
  await using project = await memoryProject()
  const finished: unknown[] = []
  const response = await Instance.provide({
    directory: project.path,
    fn: async () => {
      await MCP.TestHooks.registerOAuthCallbackAuthority(authority({ flows: { "old-state": "old-server" } }))
      await MCP.TestHooks.registerOAuthCallbackAuthority(
        authority({ flows: { "current-state": "current-server" }, finished }),
      )
      return McpOAuthCallback.handleRequest(new Request(`${CALLBACK}?code=current-code&state=current-state`))
    },
  })
  await Instance.disposeAll()
  const afterDispose = await McpOAuthCallback.handleRequest(
    new Request(`${CALLBACK}?code=late-code&state=current-state`),
  )
  const afterDisposeBody = await afterDispose.text()

  expect({
    response: response.status,
    afterDispose: afterDispose.status,
    afterDisposeContract: afterDisposeBody.includes("Invalid or expired state"),
    finished,
  }).toEqual({
    response: 200,
    afterDispose: 400,
    afterDisposeContract: true,
    finished: [{ mcpName: "current-server", authorizationCode: "current-code", oauthState: "current-state" }],
  })
}, 60_000)
