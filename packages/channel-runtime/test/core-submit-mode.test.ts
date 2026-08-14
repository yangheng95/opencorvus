import { describe, expect, mock, test } from "bun:test"
import type { ChannelAdapter, IncomingMessage } from "../src/adapter"
import { SessionCoordinator } from "../src/session-coordinator"
import { sdkMock } from "./sdk-mock"

mock.module("@opencorvus-ai/sdk", () => sdkMock)

const { ChannelRuntime } = await import("../src/core")

type PromptCall = {
  sessionID: string
  messageID?: string
  parts: Array<{ type: "text"; text: string }>
}

type RuntimeCore = {
  adapters: ChannelAdapter[]
  session: SessionCoordinator<{ sessionId: string; adapter: ChannelAdapter; channel: string; thread: string }>
  client: {
    session: {
      prompt(input: PromptCall, options?: { signal?: AbortSignal }): Promise<{ error?: unknown; data?: unknown }>
    }
  }
  pending: Map<string, { executionId: string; sessionID: string; messageID: string }>
  stop(): Promise<void>
  handleMessage(msg: IncomingMessage): Promise<void>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function adapter(sent: string[] = []): ChannelAdapter {
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

function incoming(text: string, thread = "T1", id = `event-${text}`): IncomingMessage {
  return {
    id,
    platform: "slack",
    channel: "C1",
    thread,
    user: "U1",
    text,
  }
}

function bind(core: RuntimeCore, owner: ChannelAdapter, sessionID: string, thread: string) {
  core.session.bind(`slack:C1:${thread}`, {
    sessionId: sessionID,
    adapter: owner,
    channel: "C1",
    thread,
  })
}

describe("channel runtime direct Session prompt", () => {
  test("waits for the exact prompt result and releases Session ownership", async () => {
    const calls: PromptCall[] = []
    const owner = adapter()
    const core = new ChannelRuntime() as unknown as RuntimeCore
    core.adapters = [owner]
    bind(core, owner, "session_1", "T1")
    core.client = {
      session: {
        prompt: async (input) => {
          calls.push(input)
          return { data: { info: { id: "assistant_1" }, parts: [] } }
        },
      },
    }

    await core.handleMessage(incoming("ship it"))

    expect(calls).toHaveLength(1)
    expect(calls[0]?.sessionID).toBe("session_1")
    expect(calls[0]?.messageID).toMatch(/^msg_h[0-9a-f]{19}$/)
    expect(calls[0]?.parts).toEqual([{ type: "text", text: "ship it" }])
    expect(core.pending.size).toBe(0)
  })

  test("submits overlapping events for one Session with exact independent message identities", async () => {
    const owner = adapter()
    const firstGate = deferred<{ data: unknown }>()
    const secondGate = deferred<{ data: unknown }>()
    const calls: PromptCall[] = []
    const core = new ChannelRuntime() as unknown as RuntimeCore
    core.adapters = [owner]
    bind(core, owner, "session_1", "T1")
    core.client = {
      session: {
        prompt: async (input) => {
          calls.push(input)
          return calls.length === 1 ? firstGate.promise : secondGate.promise
        },
      },
    }

    const first = core.handleMessage(incoming("first", "T1", "event-overlap-first"))
    const second = core.handleMessage(incoming("second", "T1", "event-overlap-second"))
    while (calls.length < 2) await Promise.resolve()
    expect({
      sessionIDs: calls.map((call) => call.sessionID),
      messageIDs: calls.map((call) => call.messageID),
      pending: core.pending.size,
    }).toEqual({
      sessionIDs: ["session_1", "session_1"],
      messageIDs: [expect.stringMatching(/^msg_h[0-9a-f]{19}$/), expect.stringMatching(/^msg_h[0-9a-f]{19}$/)],
      pending: 2,
    })

    firstGate.resolve({ data: { info: { id: "assistant_1" }, parts: [] } })
    await first
    expect(core.pending.size).toBe(1)
    secondGate.resolve({ data: { info: { id: "assistant_2" }, parts: [] } })
    await second
    expect(core.pending.size).toBe(0)
  })

  test("starts independent Sessions without shared Host admission", async () => {
    const owner = adapter()
    const gates = new Map<string, ReturnType<typeof deferred<{ data: unknown }>>>()
    const calls: string[] = []
    const core = new ChannelRuntime() as unknown as RuntimeCore
    core.adapters = [owner]
    bind(core, owner, "session_1", "T1")
    bind(core, owner, "session_2", "T2")
    core.client = {
      session: {
        prompt: async (input) => {
          calls.push(input.sessionID)
          const gate = deferred<{ data: unknown }>()
          gates.set(input.sessionID, gate)
          return gate.promise
        },
      },
    }

    const first = core.handleMessage(incoming("one", "T1"))
    const second = core.handleMessage(incoming("two", "T2"))
    while (calls.length < 2) await Promise.resolve()

    expect(calls.sort()).toEqual(["session_1", "session_2"])
    gates.get("session_1")!.resolve({ data: {} })
    gates.get("session_2")!.resolve({ data: {} })
    await Promise.all([first, second])
  })

  test("aborts and joins the exact direct prompt before Channel runtime stop settles", async () => {
    const owner = adapter()
    const gate = deferred<{ data: unknown }>()
    let promptSignal: AbortSignal | undefined
    const core = new ChannelRuntime() as unknown as RuntimeCore
    core.adapters = [owner]
    bind(core, owner, "session_1", "T1")
    core.client = {
      session: {
        prompt: async (_input, options) => {
          promptSignal = options?.signal
          return gate.promise
        },
      },
    }

    const prompt = core.handleMessage(incoming("long request", "T1", "event-stop-owner"))
    while (!promptSignal) await Promise.resolve()
    let stopSettled = false
    const stop = core.stop().then(() => {
      stopSettled = true
    })
    await Promise.resolve()
    expect({ aborted: promptSignal.aborted, stopSettled }).toEqual({ aborted: true, stopSettled: false })

    gate.resolve({ data: { info: { id: "assistant_after_abort" }, parts: [] } })
    await Promise.all([prompt, stop])
    expect({ stopSettled, pending: core.pending.size }).toEqual({
      stopSettled: true,
      pending: 0,
    })
  })

  test("closes direct prompt admission before stop snapshots active operations", async () => {
    const owner = adapter()
    const createGate = deferred<{ data: { id: string }; error?: unknown }>()
    let createStarted = false
    let promptCalls = 0
    const core = new ChannelRuntime() as unknown as RuntimeCore
    core.adapters = [owner]
    core.client = {
      session: {
        create: async () => {
          createStarted = true
          return createGate.promise
        },
        prompt: async () => {
          promptCalls += 1
          return { data: {} }
        },
      },
    } as any

    const incomingOperation = core.handleMessage(incoming("arrived before stop", "T-new", "event-before-stop"))
    while (!createStarted) await Promise.resolve()
    await core.stop()
    createGate.resolve({ data: { id: "session_after_stop" } })
    await incomingOperation
    expect({ promptCalls, activePromptOwners: core.pending.size }).toEqual({
      promptCalls: 0,
      activePromptOwners: 0,
    })
  })
})
