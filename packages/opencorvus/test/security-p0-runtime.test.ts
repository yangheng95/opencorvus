import { describe, expect, test } from "bun:test"
import { mcpDebugClientInformationLine } from "../src/cli/cmd/mcp"
import { McpOAuthCallback } from "../src/mcp/oauth-callback"
import { OAUTH_CALLBACK_PATH } from "../src/mcp/oauth-provider"
import { Instance } from "../src/project/instance"
import { publicUnknownErrorMessage } from "../src/server/error-handler"
import { writeVcsCommitMessageStreamError } from "../src/server/vcs-stream-error"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

describe("P0 security runtime paths", () => {
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
    const malformed = McpOAuthCallback.waitForCallbackSettlement(malformedState, owner, "malformed-correlation-id")
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
