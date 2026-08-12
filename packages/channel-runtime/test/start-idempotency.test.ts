import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

// audit-2026-04-29 W2-V14 mock — instrumented createOpencode that
// ChannelRuntime.start can be observed against. We need a fresh
// counter PER TEST so the mock module is wired with a callable
// indirection (`createOpencode = (...a) => _impl(...a)`) and the
// test swaps `_impl` to the desired behaviour.
let createCount = 0
let throwOnNext = false
let clientInputs: unknown[] = []
let promptInputs: unknown[] = []
let channelInputs: unknown[] = []
let observeChannelInput: ((input: unknown) => void) | undefined
let serverCloseCount = 0

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
      server: {
        url: "http://127.0.0.1:0",
        close() {
          serverCloseCount += 1
        },
      },
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
    channel: {
      message: async (input: unknown) => {
        channelInputs.push(input)
        observeChannelInput?.(input)
        return { data: { kind: "message" as const, message: "" }, error: undefined }
      },
    },
    global: { event: async () => ({ stream: emptyStream() }) },
    permission: { reply: async () => ({ data: {}, error: undefined }) },
    session: {
      create: async () => ({ data: { id: "session_mock" }, error: undefined }),
      get: async () => ({ data: undefined, error: undefined }),
      message: async () => ({ data: { parts: [] }, error: undefined }),
      promptAsync: async (input: unknown) => {
        promptInputs.push(input)
        return { data: { taskID: "task_mock" }, error: undefined }
      },
    },
  }
}

mock.module("@opencorvus-ai/sdk", () => recordingMock)

const [{ ChannelRuntime }, { SignalAdapter }] = await Promise.all([
  import("../src/core"),
  import("../src/adapters/signal"),
])

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
    promptInputs = []
    channelInputs = []
    observeChannelInput = undefined
    serverCloseCount = 0
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

describe("ChannelRuntime adapter startup settlement", () => {
  beforeEach(() => {
    createCount = 0
    throwOnNext = false
    clientInputs = []
    promptInputs = []
    channelInputs = []
    observeChannelInput = undefined
    serverCloseCount = 0
  })

  function adapter(
    platform: string,
    behavior?: { startError?: Error; stopErrors?: Error[]; startupTexts?: string[] },
  ) {
    let startCount = 0
    let stopCount = 0
    let handler: ((message: any) => Promise<void>) | undefined
    const owner = {
      platform,
      async start() {
        startCount += 1
        for (const [index, text] of (behavior?.startupTexts ?? []).entries()) {
          await handler?.({
            platform,
            channel: `${platform}-channel`,
            thread: `${index + 1}`,
            user: `${platform}-user`,
            text,
          })
        }
        if (behavior?.startError) throw behavior.startError
      },
      async stop() {
        stopCount += 1
        const error = behavior?.stopErrors?.shift()
        if (error) throw error
      },
      async sendMessage() {},
      async uploadImage() {},
      onMessage(next: (message: any) => Promise<void>) {
        handler = next
      },
      counts() {
        return { startCount, stopCount }
      },
    }
    return owner
  }

  test("returns only physical started adapters and settles a rejected owner", async () => {
    const active = adapter("slack", { startupTexts: ["first", "second"] })
    const rejected = adapter("telegram", {
      startError: new Error("invalid token"),
      startupTexts: ["discarded"],
    })
    const runtime = new ChannelRuntime({ directory: "D:/repo/runtime", channelProtocol: true })
    runtime.register(active).register(rejected)

    const receipt = await runtime.start()
    expect({ receipt, adapterCount: runtime.adapterCount, rejected: rejected.counts(), channelInputs }).toEqual({
      receipt: { channels: ["slack"], failedChannels: ["telegram"] },
      adapterCount: 1,
      rejected: { startCount: 1, stopCount: 1 },
      channelInputs: [
        {
          platform: "slack",
          channel: "slack-channel",
          thread: "1",
          text: "first",
          user_id: "slack-user",
          request_id: undefined,
          source: "slack",
          allow_create: true,
        },
        {
          platform: "slack",
          channel: "slack-channel",
          thread: "2",
          text: "second",
          user_id: "slack-user",
          request_id: undefined,
          source: "slack",
          allow_create: true,
        },
      ],
    })

    await runtime.stop()
    expect(active.counts()).toEqual({ startCount: 1, stopCount: 1 })
  })

  test("zero physical adapters rolls back the adapter and server owners", async () => {
    const rejected = adapter("telegram", { startError: new Error("invalid token") })
    const runtime = new ChannelRuntime({ directory: "D:/repo/runtime" })
    runtime.register(rejected)

    const failure = await runtime.start().catch((error) => error)
    expect({ failure, adapterCount: runtime.adapterCount, rejected: rejected.counts(), serverCloseCount }).toEqual({
      failure: expect.objectContaining({ message: "Channel runtime did not start any configured adapter" }),
      adapterCount: 0,
      rejected: { startCount: 1, stopCount: 1 },
      serverCloseCount: 1,
    })
  })

  test("retains and retries a rejected adapter whose initial cleanup fails", async () => {
    const rejected = adapter("telegram", {
      startError: new Error("invalid token"),
      stopErrors: [new Error("poller still closing")],
    })
    const runtime = new ChannelRuntime({ directory: "D:/repo/runtime" })
    runtime.register(rejected)

    const failure = await runtime.start().catch((error) => error)
    expect({ failure, rejected: rejected.counts(), serverCloseCount }).toEqual({
      failure: expect.objectContaining({ message: "Channel runtime could not settle 1 rejected adapter owner(s)" }),
      rejected: { startCount: 1, stopCount: 2 },
      serverCloseCount: 1,
    })
  })

  test("admits and delivers Signal readiness messages after the physical adapter becomes active", async () => {
    const originalFetch = globalThis.fetch
    let receiveCount = 0
    let settleNextReceive: ((response: Response) => void) | undefined
    const nextReceive = new Promise<Response>((resolve) => {
      settleNextReceive = resolve
    })
    globalThis.fetch = (async () => {
      receiveCount += 1
      if (receiveCount === 1) {
        return Response.json([
          {
            envelope: {
              source: "+15550001111",
              timestamp: 101,
              dataMessage: { message: "initial hello", timestamp: 101 },
            },
          },
        ])
      }
      return nextReceive
    }) as unknown as typeof fetch

    const runtime = new ChannelRuntime({ baseUrl: "http://127.0.0.1:7878", directory: "D:/repo/runtime" })
    runtime.register(new SignalAdapter({ service: "http://signal.test", account: "+15550002222" }))
    try {
      const receipt = await runtime.start()
      expect({ receipt, adapterCount: runtime.adapterCount, promptInputs }).toEqual({
        receipt: { channels: ["signal"], failedChannels: [] },
        adapterCount: 1,
        promptInputs: [
          {
            sessionID: "session_mock",
            parts: [{ type: "text", text: "initial hello" }],
          },
        ],
      })

      const stopped = runtime.stop()
      settleNextReceive!(Response.json([]))
      await stopped
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("admits a ready adapter and drains live messages while a sibling start remains pending", async () => {
    let settleSlowStart: (() => void) | undefined
    const slowStart = new Promise<void>((resolve) => {
      settleSlowStart = resolve
    })
    let readyHandler: ((message: any) => Promise<void>) | undefined
    const slow = adapter("matrix")
    slow.start = async () => slowStart
    const ready = {
      platform: "slack",
      async start() {
        await readyHandler?.({
          platform: "slack",
          channel: "slack-channel",
          thread: "ready",
          user: "slack-user",
          text: "readiness",
        })
      },
      async stop() {},
      async sendMessage() {},
      async uploadImage() {},
      onMessage(handler: (message: any) => Promise<void>) {
        readyHandler = handler
      },
    }
    const delivered = new Promise<void>((resolve) => {
      observeChannelInput = () => {
        if (channelInputs.length === 1) resolve()
      }
    })
    const runtime = new ChannelRuntime({ directory: "D:/repo/runtime", channelProtocol: true })
    runtime.register(slow).register(ready)

    const starting = runtime.start()
    await delivered
    await readyHandler!({
      platform: "slack",
      channel: "slack-channel",
      thread: "live",
      user: "slack-user",
      text: "after readiness",
    })
    expect({ adapterCount: runtime.adapterCount, channelInputs }).toMatchObject({
      adapterCount: 1,
      channelInputs: [
        { platform: "slack", thread: "ready", text: "readiness" },
        { platform: "slack", thread: "live", text: "after readiness" },
      ],
    })

    settleSlowStart!()
    expect(await starting).toEqual({ channels: ["matrix", "slack"], failedChannels: [] })
    await runtime.stop()
  })

  test("settles startup overload explicitly before a candidate buffer can grow without bound", async () => {
    const overloaded = adapter("telegram", {
      startupTexts: Array.from({ length: 1_001 }, (_, index) => `startup-${index}`),
    })
    const runtime = new ChannelRuntime({ directory: "D:/repo/runtime", channelProtocol: true })
    runtime.register(overloaded)

    const failure = await runtime.start().catch((error) => error)
    expect({ failure, overloaded: overloaded.counts(), adapterCount: runtime.adapterCount, channelInputs }).toEqual({
      failure: expect.objectContaining({
        message: "Channel runtime did not start any configured adapter",
        errors: [
          expect.objectContaining({
            message: "telegram adapter exceeded 1000 buffered startup messages before readiness",
          }),
        ],
      }),
      overloaded: { startCount: 1, stopCount: 1 },
      adapterCount: 0,
      channelInputs: [],
    })
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
