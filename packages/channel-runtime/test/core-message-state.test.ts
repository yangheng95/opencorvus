import { describe, expect, mock, test } from "bun:test"
import { sdkMock } from "./sdk-mock"

mock.module("@opencorvus-ai/sdk", () => sdkMock)

const { ChannelRuntime } = await import("../src/core")

describe("channel runtime message state", () => {
  test("cleans per-message caches after completed assistant reply", async () => {
    const core = new ChannelRuntime() as unknown as {
      userMessageIds: Set<string>
      pendingPartTexts: Map<string, string>
      textBuffers: Map<string, string>
      handleEvent(event: unknown): Promise<void>
      sharedMode(): boolean
    }

    core.userMessageIds = new Set<string>()
    core.pendingPartTexts = new Map<string, string>([["message_1", "hello"]])
    core.textBuffers = new Map<string, string>([["message_1", "hello"]])
    core.sharedMode = () => false

    await core.handleEvent({
      type: "message.updated",
      properties: {
        info: {
          id: "message_2",
          sessionID: "session_1",
          role: "assistant",
          parentID: "message_1",
          agent: "opencorvus",
          modelID: "test-model",
          providerID: "test-provider",
          mode: "chat",
          path: {
            cwd: "/tmp",
            root: "/tmp",
          },
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: {
              read: 0,
              write: 0,
            },
          },
          time: {
            created: Date.now(),
            completed: Date.now(),
          },
        },
      },
    })

    expect(core.userMessageIds.has("message_1")).toBe(false)
    expect(core.pendingPartTexts.has("message_1")).toBe(false)
    expect(core.textBuffers.has("message_1")).toBe(false)
  })
})
