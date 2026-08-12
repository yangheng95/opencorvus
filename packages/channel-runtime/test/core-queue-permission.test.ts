import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { ChannelAdapter, IncomingMessage } from "../src/adapter"
import { SessionCoordinator } from "../src/session-coordinator"
import { sdkMock } from "./sdk-mock"

mock.module("@opencorvus-ai/sdk", () => sdkMock)
mock.module("@opencorvus-ai/sdk", () => sdkMock)

const { ChannelRuntime } = await import("../src/core")

function adapter(sent: string[]): ChannelAdapter {
  return {
    platform: "slack",
    start: async () => {},
    stop: async () => {},
    sendMessage: async (_channel, _thread, text) => {
      sent.push(text)
    },
    uploadImage: async () => {},
    onMessage: () => {},
  }
}

function incoming(text: string): IncomingMessage {
  return {
    platform: "slack",
    channel: "C1",
    thread: "T1",
    user: "U1",
    text,
  }
}

beforeEach(() => {
  delete process.env.OPENCORVUS_CHANNEL_SESSION_QUEUE_LIMIT
})

describe("channel runtime queue guard", () => {
  test("rejects new inbound message when per-session queue is full", async () => {
    process.env.OPENCORVUS_CHANNEL_SESSION_QUEUE_LIMIT = "2"
    const sent: string[] = []
    const a = adapter(sent)
    const core = new ChannelRuntime() as unknown as {
      adapters: ChannelAdapter[]
      session: SessionCoordinator<
        { sessionId: string; adapter: ChannelAdapter; channel: string; thread: string },
        IncomingMessage
      >
      handleMessage(msg: IncomingMessage): Promise<void>
    }

    core.adapters = [a]
    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.session.start("session_1")
    core.session.enqueue("session_1", { msg: incoming("one"), text: "one" }, 2)
    core.session.enqueue("session_1", { msg: incoming("two"), text: "two" }, 2)

    await core.handleMessage(incoming("overflow"))

    expect(core.session.dequeue("session_1").item?.text).toBe("one")
    expect(core.session.dequeue("session_1").item?.text).toBe("two")
    expect(core.session.dequeue("session_1").item).toBeUndefined()
    expect(sent.at(-1)).toBe("Current task is still running. Queue is full (2). Please retry later.")
  })
})

describe("channel runtime permission asked", () => {
  test("surfaces permission request without replying", async () => {
    const sent: string[] = []
    const calls: Array<{ requestID: string; decision: "allow_once" | "allow_task" | "allow_project" | "deny" }> = []
    const a = adapter(sent)
    const core = new ChannelRuntime() as unknown as {
      session: SessionCoordinator<
        { sessionId: string; adapter: ChannelAdapter; channel: string; thread: string },
        IncomingMessage
      >
      client: {
        permission: {
          reply(input: {
            requestID: string
            decision: "allow_once" | "allow_task" | "allow_project" | "deny"
          }): Promise<{ error?: unknown }>
        }
      }
      handleEvent(event: unknown): Promise<void>
    }

    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.client = {
      permission: {
        reply: async (input) => {
          calls.push(input)
          return {}
        },
      },
    }

    await core.handleEvent({
      type: "permission.asked",
      properties: {
        id: "permission_1",
        sessionID: "session_1",
        toolName: "bash",
        summary: "bash (process)",
      },
    })

    expect(calls).toEqual([])
    expect(sent.at(-1)).toBe("Permission requested: bash — bash (process). Waiting for operator reply.")
  })
})
