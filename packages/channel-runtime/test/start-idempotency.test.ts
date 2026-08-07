import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

// audit-2026-04-29 W2-V14 mock — instrumented createOpencode that
// ChannelRuntime.start can be observed against. We need a fresh
// counter PER TEST so the mock module is wired with a callable
// indirection (`createOpencode = (...a) => _impl(...a)`) and the
// test swaps `_impl` to the desired behaviour.
let createCount = 0
let throwOnNext = false
let clientInputs: unknown[] = []

const recordingMock = {
  createOpencode: async () => {
    createCount++
    await new Promise((r) => setTimeout(r, 5))
    if (throwOnNext) {
      throwOnNext = false
      throw new Error("port collision simulation")
    }
    return {
      client: stubClient(),
      server: { url: "http://127.0.0.1:0", close() {} },
    }
  },
  createOpencodeClient: () => stubClient(),
  createOpenCorvus: async () => recordingMock.createOpencode(),
  createOpenCorvusClient: (input?: unknown) => {
    clientInputs.push(input)
    return stubClient()
  },
  createOpenCorvusServer: async () => ({ url: "http://127.0.0.1:0", close() {} }),
  createOpencodeServer: async () => ({ url: "http://127.0.0.1:0", close() {} }),
  OpencodeClient: class {} as any,
  OpenCorvusClient: class {} as any,
}

async function* emptyStream() {}

function stubClient() {
  return {
    auth: { set: async () => ({ data: {}, error: undefined }) },
    channel: { message: async () => ({ data: { kind: "message" as const, message: "" }, error: undefined }) },
    global: { event: async () => ({ stream: emptyStream() }) },
    permission: { reply: async () => ({ data: {}, error: undefined }) },
    session: {
      create: async () => ({ data: { id: "session_mock" }, error: undefined }),
      get: async () => ({ data: undefined, error: undefined }),
      message: async () => ({ data: { parts: [] }, error: undefined }),
      promptAsync: async () => ({ data: {}, error: undefined }),
    },
  }
}

mock.module("@opencorvus-ai/sdk", () => recordingMock)

const { ChannelRuntime } = await import("../src/core")

/**
 * audit-2026-04-29 W2-V14. ChannelRuntime.start() lacked an
 * idempotency guard: two near-simultaneous callers both saw
 * `this.running === false`, both spawned an OpenCorvus server,
 * both registered adapter handlers, both kicked off
 * `subscribeEvents` (creating duplicate SSE reconnect loops with
 * double event dispatch). Lock the contract.
 */

describe("ChannelRuntime.start idempotency (audit W2-V14)", () => {
  beforeEach(() => {
    createCount = 0
    throwOnNext = false
    clientInputs = []
  })

  test("two concurrent start() calls share one OpenCorvus spawn", async () => {
    const rt = new ChannelRuntime({ directory: "D:/repo/runtime" }) as unknown as {
      start: () => Promise<void>
      stop: () => Promise<void>
    }
    await Promise.all([rt.start(), rt.start(), rt.start()])
    expect(createCount).toBe(1)
    expect(clientInputs).toEqual([{ baseUrl: "http://127.0.0.1:0", directory: "D:/repo/runtime" }])
    await rt.stop()
  })

  test("subsequent start() after a successful start is a no-op (createCount stays 1)", async () => {
    const rt = new ChannelRuntime({ directory: "D:/repo/runtime" }) as unknown as {
      start: () => Promise<void>
      stop: () => Promise<void>
    }
    await rt.start()
    expect(createCount).toBe(1)
    await rt.start()
    await rt.start()
    expect(createCount).toBe(1)
    await rt.stop()
  })

  test("a failed start rolls back `running` so a retry can proceed", async () => {
    const rt = new ChannelRuntime({ directory: "D:/repo/runtime" }) as unknown as {
      start: () => Promise<void>
      stop: () => Promise<void>
      running: boolean
    }
    throwOnNext = true
    await expect(rt.start()).rejects.toThrow("port collision")
    expect(rt.running).toBe(false)
    expect(createCount).toBe(1)
    // Retry — should succeed.
    await rt.start()
    expect(rt.running).toBe(true)
    expect(createCount).toBe(2)
    await rt.stop()
  })

  test("start fails loudly without a configured project directory", async () => {
    const rt = new ChannelRuntime() as unknown as {
      start: () => Promise<void>
      running: boolean
    }

    await expect(rt.start()).rejects.toThrow("ChannelRuntime requires options.directory")
    expect(rt.running).toBe(false)
    expect(createCount).toBe(0)
    expect(clientInputs).toEqual([])
  })

  test("existing-server mode binds the SDK client to the configured directory", async () => {
    const rt = new ChannelRuntime({
      baseUrl: "http://127.0.0.1:7878",
      directory: "D:/repo/from-env",
    }) as unknown as {
      start: () => Promise<void>
      stop: () => Promise<void>
    }

    await rt.start()

    expect(createCount).toBe(0)
    expect(clientInputs).toEqual([{ baseUrl: "http://127.0.0.1:7878", directory: "D:/repo/from-env" }])
    await rt.stop()
  })
})

describe("ChannelRuntime.stop resource ownership", () => {
  test("releases every resource and retains only failed cleanup owners for retry", async () => {
    let failedAdapterAttempts = 0
    let releasedAdapterAttempts = 0
    let serverCloseAttempts = 0
    const failedAdapter = {
      async stop() {
        failedAdapterAttempts += 1
        if (failedAdapterAttempts === 1) throw new Error("adapter stop failed")
      },
    }
    const releasedAdapter = {
      async stop() {
        releasedAdapterAttempts += 1
      },
    }
    const runtime = new ChannelRuntime() as unknown as {
      adapters: Array<{ stop(): Promise<void> }>
      server?: { close(): void }
      stop(): Promise<void>
    }
    runtime.adapters = [failedAdapter, releasedAdapter]
    runtime.server = {
      close() {
        serverCloseAttempts += 1
      },
    }

    const failure = await runtime.stop().catch((error) => error)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([expect.objectContaining({ message: "adapter stop failed" })])
    expect(failedAdapterAttempts).toBe(1)
    expect(releasedAdapterAttempts).toBe(1)
    expect(serverCloseAttempts).toBe(1)
    expect(runtime.adapters).toEqual([failedAdapter])
    expect(runtime.server).toBeUndefined()

    await runtime.stop()
    expect(failedAdapterAttempts).toBe(2)
    expect(releasedAdapterAttempts).toBe(1)
    expect(serverCloseAttempts).toBe(1)
    expect(runtime.adapters).toEqual([])
  })
})
