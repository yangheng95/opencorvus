import { describe, expect, test } from "bun:test"
import { Bus } from "../src/bus"
import { mcpDebugClientInformationLine } from "../src/cli/cmd/mcp"
import { McpOAuthCallback } from "../src/mcp/oauth-callback"
import { OAUTH_CALLBACK_PATH } from "../src/mcp/oauth-provider"
import { PermissionNext } from "../src/permission/next"
import { Instance } from "../src/project/instance"
import { publicUnknownErrorMessage } from "../src/server/error-handler"
import { writeVcsCommitMessageStreamError } from "../src/server/vcs-stream-error"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

describe("P0 security runtime paths", () => {
  test("always permission propagation preserves a pending current ask decision", async () => {
    const project = await memoryProject()
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const asked = new Set<string>()
          const replies: Array<{ requestID: string; reply: string; autoReply: boolean }> = []
          let resolveAsked!: () => void
          let resolveReplied!: () => void
          const bothAsked = new Promise<void>((resolve) => (resolveAsked = resolve))
          const bothReplied = new Promise<void>((resolve) => (resolveReplied = resolve))
          const stopAsked = Bus.subscribe(PermissionNext.Event.Asked, ({ properties }) => {
            asked.add(properties.id)
            if (asked.size === 2) resolveAsked()
          })
          const stopReplied = Bus.subscribe(PermissionNext.Event.Replied, ({ properties }) => {
            replies.push(properties)
            if (replies.length === 2) resolveReplied()
          })
          const ruleset = [{ permission: "workspace.write", pattern: "fixture", action: "ask" }] as const
          try {
            const first = PermissionNext.ask({
              id: "per_runtime_first",
              sessionID: "session-runtime",
              permission: "workspace.write",
              patterns: ["fixture"],
              metadata: {},
              always: ["fixture"],
              ruleset,
            })
            const second = PermissionNext.ask({
              id: "per_runtime_second",
              sessionID: "session-runtime",
              permission: "workspace.write",
              patterns: ["fixture"],
              metadata: {},
              always: ["fixture"],
              ruleset,
            })
            await bothAsked

            await PermissionNext.reply({ requestID: "per_runtime_first", reply: "always", autoReply: false })
            await first
            await PermissionNext.reply({ requestID: "per_runtime_second", reply: "once", autoReply: false })
            await second
            await bothReplied

            expect(replies).toEqual([
              {
                sessionID: "session-runtime",
                requestID: "per_runtime_first",
                reply: "always",
                autoReply: false,
              },
              {
                sessionID: "session-runtime",
                requestID: "per_runtime_second",
                reply: "once",
                autoReply: false,
              },
            ])
          } finally {
            stopAsked()
            stopReplied()
          }
        },
      })
    } finally {
      await project[Symbol.asyncDispose]()
      await resetMemoryDatabase()
    }
  })

  test("OAuth callback validates state before handling provider errors", async () => {
    const validState = "valid-oauth-state"
    const owner = "project:mcp"
    const callback = McpOAuthCallback.waitForCallbackSettlement(validState, owner, "flow-correlation-id")

    const invalid = McpOAuthCallback.handleRequest(
      new Request(`http://127.0.0.1${OAUTH_CALLBACK_PATH}?state=expired&error=access_denied`),
    )
    expect(invalid.status).toBe(400)

    const valid = McpOAuthCallback.handleRequest(
      new Request(`http://127.0.0.1${OAUTH_CALLBACK_PATH}?state=${validState}&code=authorization-code`),
    )
    expect(valid.status).toBe(200)
    expect(await callback).toEqual({ status: "fulfilled", code: "authorization-code" })

    const malformedState = "malformed-oauth-state"
    const malformed = McpOAuthCallback.waitForCallbackSettlement(
      malformedState,
      owner,
      "malformed-correlation-id",
    )
    const malformedResponse = McpOAuthCallback.handleRequest(
      new Request(`http://127.0.0.1${OAUTH_CALLBACK_PATH}?state=${malformedState}`),
    )
    expect(malformedResponse.status).toBe(400)
    const malformedResult = await malformed
    expect(malformedResult.status).toBe("rejected")
    if (malformedResult.status === "rejected") {
      expect(malformedResult.error.message).toBe("No authorization code provided")
    }
  })

  test("VCS stream failures write the generic public event and retain private diagnostics", async () => {
    const writes: Array<{ data: string }> = []
    const logs: Array<{ message: string; fields: { requestID: string; error: unknown } }> = []
    const privateError = new Error("database password leaked")
    const event = await writeVcsCommitMessageStreamError({
      stream: {
        async writeSSE(payload) {
          writes.push(payload)
        },
      },
      error: privateError,
      requestID: "request-1",
      logError: (message, fields) => logs.push({ message, fields }),
    })

    expect(event).toEqual({ type: "error", message: publicUnknownErrorMessage() })
    expect(writes).toEqual([{ data: JSON.stringify(event) }])
    expect(logs).toEqual([
      {
        message: "commit message stream failed",
        fields: { requestID: "request-1", error: privateError },
      },
    ])
  })

  test("OAuth debug discovery reports client presence without the client id", () => {
    expect(mcpDebugClientInformationLine({ client_id: "private-client-id" })).toBe("Client ID available: present")
    expect(mcpDebugClientInformationLine(undefined)).toBe("No client ID - dynamic registration will be attempted")
  })
})
