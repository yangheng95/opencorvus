import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { ChannelAdapter, IncomingMessage } from "../src/adapter"
import { SessionCoordinator } from "../src/session-coordinator"
import { sdkMock } from "./sdk-mock"

mock.module("@opencorvus-ai/sdk", () => sdkMock)

const { ChannelRuntime } = await import("../src/core")

function adapter(): ChannelAdapter {
  return {
    platform: "slack",
    start: async () => {},
    stop: async () => {},
    sendMessage: async () => {},
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

type PromptCall = { sessionID: string; parts: Array<{ type: "text"; text: string }>; system: string }
type RuntimeCore = {
  adapters: ChannelAdapter[]
  running?: boolean
  session: SessionCoordinator<
    { sessionId: string; adapter: ChannelAdapter; channel: string; thread: string },
    IncomingMessage
  >
  client: {
    session: {
      promptAsync(input: PromptCall): Promise<{ error?: unknown; data?: { taskID: string } }>
    }
  }
  handleMessage(msg: IncomingMessage): Promise<void>
  handleEvent(event: unknown): Promise<void>
  expirePending(): Promise<void>
}

beforeEach(() => {
  delete process.env.OPENCORVUS_CHANNEL_PROTOCOL
  delete process.env.OPENCORVUS_CHANNEL_TASK_MODE
  delete process.env.OPENCORVUS_CHANNEL_TASK_TIMEOUT_MS
  delete process.env.OPENCORVUS_CHANNEL_TASK_SWEEP_MS
})

describe("channel runtime submit mode", () => {
  test("ignores OPENCORVUS_CHANNEL_PROTOCOL inside core unless constructor option enables it", async () => {
    process.env.OPENCORVUS_CHANNEL_PROTOCOL = "1"
    const promptCalls: PromptCall[] = []
    const a = adapter()
    const core = new ChannelRuntime() as unknown as RuntimeCore

    core.adapters = [a]
    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.client = {
      session: {
        promptAsync: async (input) => {
          promptCalls.push(input)
          return { data: { taskID: "task_env_ignored" } }
        },
      },
    }

    await core.handleMessage(incoming("env should not select protocol"))

    expect(promptCalls).toHaveLength(1)
    expect(promptCalls[0]?.parts[0]?.text).toBe("env should not select protocol")
  })

  test("uses session.promptAsync by default", async () => {
    const promptCalls: PromptCall[] = []
    const a = adapter()
    const core = new ChannelRuntime() as unknown as RuntimeCore

    core.adapters = [a]
    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.client = {
      session: {
        promptAsync: async (input) => {
          promptCalls.push(input)
          return { data: { taskID: "task_ship" } }
        },
      },
    }

    await core.handleMessage(incoming("ship it"))

    expect(promptCalls).toHaveLength(1)
    expect(promptCalls[0]?.sessionID).toBe("session_1")
    expect(promptCalls[0]?.parts).toEqual([{ type: "text", text: "ship it" }])
  })

  test("fails when session.promptAsync returns an API error", async () => {
    const sent: string[] = []
    const promptCalls: PromptCall[] = []
    const a: ChannelAdapter = {
      ...adapter(),
      sendMessage: async (_channel, _thread, text) => {
        sent.push(text)
      },
    }
    const core = new ChannelRuntime() as unknown as RuntimeCore

    core.adapters = [a]
    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.client = {
      session: {
        promptAsync: async (input) => {
          promptCalls.push(input)
          return { error: { message: "submit failed" } }
        },
      },
    }

    await core.handleMessage(incoming("submit failure"))

    expect(promptCalls).toHaveLength(1)
    expect(sent.at(-1)).toBe("Failed to send prompt.")
  })

  test("keeps processing until the submitted execution reaches a terminal lifecycle event", async () => {
    const sendCalls: Array<string> = []
    const promptCalls: PromptCall[] = []
    const a: ChannelAdapter = {
      platform: "slack",
      start: async () => {},
      stop: async () => {},
      sendMessage: async (_channel, _thread, text) => {
        sendCalls.push(text)
      },
      uploadImage: async () => {},
      onMessage: () => {},
    }
    const core = new ChannelRuntime() as unknown as RuntimeCore

    core.adapters = [a]
    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.client = {
      session: {
        promptAsync: async (input) => {
          promptCalls.push(input)
          return { data: { taskID: `task_prompt_${promptCalls.length}` } }
        },
      },
    }

    await core.handleMessage(incoming("first"))

    expect(core.session.processing("session_1")).toBe(true)
    expect(sendCalls).toHaveLength(0)
    expect(promptCalls).toHaveLength(1)

    await core.handleEvent({
      type: "agent.execution.lifecycle",
      properties: {
        sessionID: "session_1",
        inputMessageID: "message_1",
        status: { type: "terminal", reason: "completed", emittedAt: Date.now() },
      },
    })
    expect(core.session.processing("session_1")).toBe(false)

    await core.handleMessage(incoming("second"))

    expect(promptCalls).toHaveLength(2)
    expect(promptCalls[1]?.parts[0]?.text).toBe("second")
  })

  test("releases processing on an execution terminal lifecycle event", async () => {
    const a = adapter()
    const core = new ChannelRuntime() as unknown as RuntimeCore
    core.adapters = [a]
    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.client = {
      session: {
        promptAsync: async () => {
          return { data: { taskID: "task_idle" } }
        },
      },
    }

    await core.handleMessage(incoming("release-on-idle"))
    expect(core.session.processing("session_1")).toBe(true)

    await core.handleEvent({
      type: "agent.execution.lifecycle",
      properties: {
        sessionID: "session_1",
        inputMessageID: "message_1",
        status: { type: "terminal", reason: "completed", emittedAt: Date.now() },
      },
    })

    expect(core.session.processing("session_1")).toBe(false)
  })

  test("releases processing when async task watchdog expires", async () => {
    process.env.OPENCORVUS_CHANNEL_TASK_TIMEOUT_MS = "1000"
    const sendCalls: Array<string> = []
    const a: ChannelAdapter = {
      platform: "slack",
      start: async () => {},
      stop: async () => {},
      sendMessage: async (_channel, _thread, text) => {
        sendCalls.push(text)
      },
      uploadImage: async () => {},
      onMessage: () => {},
    }
    const core = new ChannelRuntime() as unknown as RuntimeCore

    core.running = true
    core.adapters = [a]
    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.client = {
      session: {
        promptAsync: async () => {
          return { data: { taskID: "task_watchdog" } }
        },
      },
    }

    await core.handleMessage(incoming("watchdog"))
    expect(core.session.processing("session_1")).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 1100))
    await core.expirePending()

    expect(core.session.processing("session_1")).toBe(false)
    expect(sendCalls.at(-1)).toContain("Task timed out")
  })

  test("dispatches the queued channel request after the current execution reaches terminal", async () => {
    const sent: string[] = []
    const promptCalls: PromptCall[] = []
    const a: ChannelAdapter = {
      ...adapter(),
      sendMessage: async (_channel, _thread, text) => {
        sent.push(text)
      },
    }
    const core = new ChannelRuntime() as unknown as RuntimeCore

    core.adapters = [a]
    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.client = {
      session: {
        promptAsync: async (input) => {
          promptCalls.push(input)
          return { data: { taskID: `task_${promptCalls.length}` } }
        },
      },
    }

    await core.handleMessage(incoming("first-request"))
    await core.handleMessage(incoming("queued-request"))
    await core.handleEvent({
      type: "agent.execution.lifecycle",
      properties: {
        sessionID: "session_1",
        inputMessageID: "message_1",
        status: { type: "terminal", reason: "completed", emittedAt: Date.now() },
      },
    })
    await Bun.sleep(0)
    await Bun.sleep(0)

    expect(promptCalls).toHaveLength(2)
    expect(promptCalls.map((call) => call.parts)).toEqual([
      [{ type: "text", text: "first-request" }],
      [{ type: "text", text: "queued-request" }],
    ])
    expect(sent.some((item) => item.includes("queued (#1)"))).toBe(true)
  })

  test("ignores removed OPENCORVUS_CHANNEL_TASK_MODE and uses session.promptAsync", async () => {
    process.env.OPENCORVUS_CHANNEL_TASK_MODE = "session-async"
    const promptCalls: PromptCall[] = []
    const a = adapter()
    const core = new ChannelRuntime() as unknown as RuntimeCore

    core.adapters = [a]
    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.client = {
      session: {
        promptAsync: async (input) => {
          promptCalls.push(input)
          return { data: { taskID: "task_legacy" } }
        },
      },
    }

    await core.handleMessage(incoming("legacy"))

    expect(promptCalls).toHaveLength(1)
    expect(promptCalls[0]?.parts[0]?.text).toBe("legacy")
  })

  test("releases processing on session.error event", async () => {
    const sent: string[] = []
    const a: ChannelAdapter = {
      platform: "slack",
      start: async () => {},
      stop: async () => {},
      sendMessage: async (_channel, _thread, text) => {
        sent.push(text)
      },
      uploadImage: async () => {},
      onMessage: () => {},
    }
    const core = new ChannelRuntime() as unknown as {
      adapters: ChannelAdapter[]
      session: SessionCoordinator<
        { sessionId: string; adapter: ChannelAdapter; channel: string; thread: string },
        IncomingMessage
      >
      handleEvent(event: unknown): Promise<void>
    }

    core.adapters = [a]
    core.session.bind("slack:C1:T1", {
      sessionId: "session_1",
      adapter: a,
      channel: "C1",
      thread: "T1",
    })
    core.session.start("session_1")

    await core.handleEvent({
      type: "session.error",
      properties: {
        sessionID: "session_1",
        error: {
          name: "UnknownError",
          data: {
            message: "runtime stopped",
          },
        },
      },
    })

    expect(core.session.processing("session_1")).toBe(false)
    expect(sent.at(-1)).toBe("Session failed: runtime stopped")
  })
})
