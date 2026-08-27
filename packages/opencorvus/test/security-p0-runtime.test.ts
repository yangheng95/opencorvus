import { afterEach, describe, expect, test } from "bun:test"
import { mcpDebugClientInformationLine } from "../src/cli/cmd/mcp"
import { McpOAuthCallback } from "../src/mcp/oauth-callback"
import { oauthCallbackReceivedLogFields, oauthConnectionFailureLogFields } from "../src/mcp/oauth-log"
import { OAUTH_CALLBACK_PATH } from "../src/mcp/oauth-provider"
import { Instance } from "../src/project/instance"
import { publicUnknownErrorMessage } from "../src/server/error-handler"
import { writeVcsCommitMessageStreamError } from "../src/server/vcs-stream-error"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await McpOAuthCallback.stop()
})

describe("P0 security runtime paths", () => {
  test("OAuth callback validates durable state before interpreting provider-controlled errors", async () => {
    await McpOAuthCallback.ensureRunning()
    const missing = await McpOAuthCallback.handleRequest(
      new Request(`http://127.0.0.1${OAUTH_CALLBACK_PATH}?error=access_denied`),
    )
    const forged = await McpOAuthCallback.handleRequest(
      new Request(`http://127.0.0.1${OAUTH_CALLBACK_PATH}?state=expired&error=provider-secret-text`),
    )

    expect({
      missing: { status: missing.status, body: (await missing.text()).includes("Missing required state parameter") },
      forged: { status: forged.status, body: (await forged.text()).includes("Invalid or expired state parameter") },
    }).toEqual({
      missing: { status: 400, body: true },
      forged: { status: 400, body: true },
    })
  })

  test("OAuth callback logging projects only fixed presence facts for provider-controlled input", () => {
    expect(
      oauthCallbackReceivedLogFields({
        code: "private-authorization-code",
        error: "provider-sentinel-secret",
        correlationID: "callback-correlation",
      }),
    ).toEqual({ correlationID: "callback-correlation", hasCode: true, hasError: true })
  })

  test("OAuth connection failure logging is a fixed non-secret projection", () => {
    expect(
      oauthConnectionFailureLogFields({
        mcpName: "private-server-name",
        transport: "Streamable HTTP",
        serverUrl: "https://private-user:private-password@example.test/mcp?api_key=private-api-key",
      }),
    ).toEqual({
      mcpName: "private-server-name",
      transport: "Streamable HTTP",
      endpointPresent: true,
      oauthFailure: true,
      error: "MCP OAuth connection failed",
    })
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
