import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

// Regression for the post-refactor /event scoping bug: ChannelRuntime
// historically called `client.event.subscribe()` (project-scoped, requires
// `?directory=`). After the route layering refactor that endpoint started
// rejecting un-scoped callers with DirectoryRequiredError, putting
// ChannelRuntime in a 1s reconnect loop. The fix routes it through
// `client.global.event()` (cross-instance, no directory). These tests pin
// both the positive contract (global is called) and the negative contract
// (project-scoped subscribe is NOT called — rule 36 "断言该自动行为不再发生").

let globalEventCalls = 0
let projectSubscribeCalls = 0
let runtimeDirectory: string | undefined

async function* eventStream(): AsyncGenerator<{
  directory: string
  payload: { type: string; properties: Record<string, never> }
}> {
  yield { directory: "/tmp/proj-a", payload: { type: "server.connected", properties: {} } }
}

const recordingMock = {
  createOpencode: async () => ({
    client: stubClient(),
    server: { url: "http://127.0.0.1:0", close() {} },
  }),
  createOpencodeClient: () => stubClient(),
  createOpenCorvus: async () => recordingMock.createOpencode(),
  createOpenCorvusClient: () => stubClient(),
  createOpenCorvusServer: async () => ({ url: "http://127.0.0.1:0", close() {} }),
  createOpencodeServer: async () => ({ url: "http://127.0.0.1:0", close() {} }),
  OpencodeClient: class {} as any,
  OpenCorvusClient: class {} as any,
}

function stubClient() {
  return {
    auth: { set: async () => ({ data: {}, error: undefined }) },
    channel: { message: async () => ({ data: { kind: "message" as const, message: "" }, error: undefined }) },
    global: {
      event: async () => {
        globalEventCalls++
        return { stream: eventStream() }
      },
    },
    event: {
      subscribe: async () => {
        projectSubscribeCalls++
        return { stream: eventStream() }
      },
    },
    permission: { reply: async () => ({ data: {}, error: undefined }) },
    session: {
      create: async () => ({ data: { id: "session_mock" }, error: undefined }),
      get: async () => ({ data: undefined, error: undefined }),
      message: async () => ({ data: { parts: [] }, error: undefined }),
      prompt: async () => ({ data: {}, error: undefined }),
    },
  }
}

mock.module("@opencorvus-ai/sdk", () => recordingMock)

const { ChannelRuntime } = await import("../src/core")

describe("ChannelRuntime.subscribeEvents routes through /global/event", () => {
  beforeEach(() => {
    globalEventCalls = 0
    projectSubscribeCalls = 0
  })

  afterEach(async () => {
    if (!runtimeDirectory) return
    await rm(runtimeDirectory, { recursive: true, force: true })
    runtimeDirectory = undefined
  })

  test("uses cross-instance global.event(), never project-scoped event.subscribe()", async () => {
    runtimeDirectory = await mkdtemp(join(tmpdir(), "opencorvus-channel-global-event-"))
    const rt = new ChannelRuntime({ directory: runtimeDirectory }) as unknown as {
      start: () => Promise<void>
      stop: () => Promise<void>
    }
    await rt.start()
    // Yield once so the subscribe loop runs at least one iteration.
    await new Promise((r) => setTimeout(r, 20))
    expect(globalEventCalls).toBeGreaterThanOrEqual(1)
    expect(projectSubscribeCalls).toBe(0)
    await rt.stop()
  })
})
