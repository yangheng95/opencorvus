import { describe, expect, test } from "bun:test"
import {
  DefaultLLMActivityPolicy,
  NonReplayableLLMActivityPolicy,
  chunkHeartbeatKind,
  collectLLMText,
  withLLMActivity,
  type LLMActivityEvent,
} from "@/llm/activity"
import { abortableIterable } from "@/util/stream-activity"
import { ProviderAuthRequiredError } from "@/provider/auth-required-error"

const policy = {
  ...DefaultLLMActivityPolicy,
  totalMs: 1_000,
  firstByteMs: 100,
  idleMs: 30,
  maxRetries: { default: 0, idle: 1 },
  backoffMs: () => 0,
}

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const rejectAbort = () => reject(signal.reason)
    if (signal.aborted) rejectAbort()
    else signal.addEventListener("abort", rejectAbort, { once: true })
  })
}

describe("LLM semantic activity", () => {
  test("collects streamed helper text through one semantic activity lifecycle", async () => {
    const events: LLMActivityEvent[] = []
    const deltas: string[] = []
    const result = await collectLLMText({
      context: { sessionID: "session-text-helper", provider: "test", model: "text-helper" },
      external: new AbortController().signal,
      policy,
      sink: (event) => events.push(event),
      onTextDelta: (delta) => {
        deltas.push(delta)
      },
      start: () => ({
        fullStream: (async function* () {
          yield { type: "start" }
          yield { type: "reasoning-delta", id: "reasoning-1", text: "working" }
          yield { type: "text-delta", id: "text-1", text: "bounded " }
          yield { type: "text-delta", id: "text-1", text: "result" }
          yield { type: "finish" }
        })(),
      }),
    })

    expect({ result, deltas }).toEqual({ result: "bounded result", deltas: ["bounded ", "result"] })
    expect(events.filter((event) => event.type === "heartbeat").map((event) => event.kind)).toEqual([
      "first-byte",
      "reasoning-delta",
      "text-delta",
      "text-delta",
    ])
    expect(events.at(-1)).toMatchObject({ type: "terminal", outcome: "done" })
  })

  test("restarts a helper stream once after a bounded first-byte stall", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0
    const result = await collectLLMText({
      context: { sessionID: "session-text-retry", provider: "test", model: "text-retry" },
      external: new AbortController().signal,
      policy: {
        ...policy,
        firstByteMs: 20,
        maxRetries: { default: 0, first_byte: 1 },
      },
      sink: (event) => events.push(event),
      start: (run) => {
        attempts += 1
        if (run.attempt === 0) {
          return {
            fullStream: (async function* () {
              await waitForAbort(run.signal)
            })(),
          }
        }
        return {
          fullStream: (async function* () {
            yield { type: "text-delta", id: "text-1", text: "recovered" }
          })(),
        }
      },
    })

    expect({ result, attempts }).toEqual({ result: "recovered", attempts: 2 })
    expect(events.find((event) => event.type === "retry")).toMatchObject({
      type: "retry",
      attempt: 1,
      cls: "first_byte",
    })
    expect(events.at(-1)).toMatchObject({ type: "terminal", outcome: "done" })
  })

  test("settles a non-replayable helper stream on its first bounded timeout", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0
    await expect(
      collectLLMText({
        context: { sessionID: "session-non-replayable", provider: "test", model: "non-replayable" },
        external: new AbortController().signal,
        policy: {
          ...NonReplayableLLMActivityPolicy,
          totalMs: 1_000,
          firstByteMs: 20,
          idleMs: 30,
          backoffMs: () => 0,
        },
        sink: (event) => events.push(event),
        start: (run) => {
          attempts += 1
          return {
            fullStream: (async function* () {
              await waitForAbort(run.signal)
            })(),
          }
        },
      }),
    ).rejects.toMatchObject({ name: "LLMActivityError", cls: "first_byte", attempts: 0 })
    expect({ attempts, terminal: events.at(-1) }).toMatchObject({
      attempts: 1,
      terminal: { type: "terminal", outcome: "failed", cls: "first_byte" },
    })
  })

  test("recovers through the observed idle, network, idle transient sequence", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0
    const result = await withLLMActivity(
      { sessionID: "session-mixed-transient-budget", provider: "openai", model: "gpt-5.6-sol" },
      {
        ...DefaultLLMActivityPolicy,
        totalMs: 1_000,
        idleMs: 20,
        firstByteMs: 20,
        backoffMs: () => 0,
      },
      new AbortController().signal,
      async (run) => {
        attempts += 1
        run.bump("text-delta")
        if (run.attempt === 1) {
          throw new Error("Cannot connect to API: The socket connection was closed unexpectedly")
        }
        if (run.attempt < 3) return waitForAbort(run.signal)
        return "recovered"
      },
      (event) => events.push(event),
    )

    expect({ result, attempts }).toEqual({ result: "recovered", attempts: 4 })
    expect(
      events.filter((event) => event.type === "retry").map((event) => ({ attempt: event.attempt, cls: event.cls })),
    ).toEqual([
      { attempt: 1, cls: "idle" },
      { attempt: 2, cls: "network" },
      { attempt: 3, cls: "idle" },
    ])
    expect(events.at(-1)).toMatchObject({ type: "terminal", outcome: "done" })
  })

  test("settles transport-only idle after the first-byte retry budget", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0
    await expect(
      withLLMActivity(
        { sessionID: "session-transport-only-idle", provider: "test", model: "transport-only-idle" },
        {
          ...DefaultLLMActivityPolicy,
          totalMs: 1_000,
          idleMs: 20,
          firstByteMs: 20,
          backoffMs: () => 0,
        },
        new AbortController().signal,
        async (run) => {
          attempts += 1
          run.bump("first-byte")
          return waitForAbort(run.signal)
        },
        (event) => events.push(event),
      ),
    ).rejects.toMatchObject({ name: "LLMActivityError", cls: "idle", attempts: 1 })
    expect({ attempts, retries: events.filter((event) => event.type === "retry") }).toMatchObject({
      attempts: 2,
      retries: [{ type: "retry", attempt: 1, cls: "idle" }],
    })
  })

  test("settles repeated first-byte stalls after its one retry budget", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0
    await expect(
      withLLMActivity(
        { sessionID: "session-first-byte-budget", provider: "test", model: "first-byte-budget" },
        {
          ...DefaultLLMActivityPolicy,
          totalMs: 1_000,
          idleMs: 20,
          firstByteMs: 20,
          backoffMs: () => 0,
        },
        new AbortController().signal,
        async (run) => {
          attempts += 1
          return waitForAbort(run.signal)
        },
        (event) => events.push(event),
      ),
    ).rejects.toMatchObject({ name: "LLMActivityError", cls: "first_byte", attempts: 1 })
    expect({ attempts, retries: events.filter((event) => event.type === "retry") }).toMatchObject({
      attempts: 2,
      retries: [{ type: "retry", attempt: 1, cls: "first_byte" }],
    })
  })

  test("terminates a typed missing Provider credential after one attempt", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0
    await expect(
      withLLMActivity(
        { sessionID: "session-auth-required", provider: "openai", model: "gpt-5.6-terra" },
        policy,
        new AbortController().signal,
        async () => {
          attempts += 1
          throw new ProviderAuthRequiredError({
            providerID: "openai",
            message: "OpenAI Codex OAuth credential is required",
          })
        },
        (event) => events.push(event),
      ),
    ).rejects.toMatchObject({ name: "LLMActivityError", cls: "auth_required", attempts: 0 })
    expect(attempts).toBe(1)
    expect(events.filter((event) => event.type === "retry")).toEqual([])
    expect(events.at(-1)).toMatchObject({ type: "terminal", outcome: "failed", cls: "auth_required" })
  })
  test("lets the idle authority preempt an immediately resolving no-op provider stream", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0
    const result = await withLLMActivity(
      { sessionID: "session-hot-semantic-idle", provider: "test", model: "hot-semantic-idle" },
      policy,
      new AbortController().signal,
      async (run) => {
        attempts += 1
        if (run.attempt > 0) {
          run.bump("text-delta")
          return "recovered"
        }
        run.bump("first-byte")
        const immediatelyResolvingNoOpStream = (async function* () {
          while (true) yield { type: "unknown-provider-keepalive" }
        })()
        for await (const _chunk of abortableIterable(immediatelyResolvingNoOpStream, run.signal)) {
          // No semantic heartbeat: the idle authority must win.
        }
        throw new Error("hot provider stream ended without the idle authority")
      },
      (event) => events.push(event),
    )

    expect({ result, attempts }).toEqual({ result: "recovered", attempts: 2 })
    expect(events.find((event) => event.type === "retry")).toMatchObject({
      type: "retry",
      attempt: 1,
      cls: "idle",
      lastHeartbeat: { kind: "first-byte" },
    })
    expect(events.at(-1)).toMatchObject({ type: "terminal", outcome: "done" })
  })

  test("retries an attempt whose transport emits only repeated no-op first-byte observations", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0
    const result = await withLLMActivity(
      { sessionID: "session-semantic-idle", provider: "test", model: "semantic-idle" },
      policy,
      new AbortController().signal,
      async (run) => {
        attempts += 1
        if (run.attempt > 0) {
          run.bump("text-delta")
          return "recovered"
        }
        run.bump("first-byte")
        const noOpTransport = setInterval(() => run.bump("first-byte"), 5)
        try {
          return await waitForAbort(run.signal)
        } finally {
          clearInterval(noOpTransport)
        }
      },
      (event) => events.push(event),
    )

    expect(result).toBe("recovered")
    expect(attempts).toBe(2)
    expect(events.filter((event) => event.type === "heartbeat" && event.kind === "first-byte")).toHaveLength(2)
    expect(events.find((event) => event.type === "retry")).toMatchObject({
      type: "retry",
      attempt: 1,
      cls: "idle",
      lastHeartbeat: { kind: "first-byte" },
    })
    expect(events.at(-1)).toMatchObject({ type: "terminal", outcome: "done" })
  })

  test("keeps one attempt alive while nonempty semantic deltas arrive inside the idle window", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0
    const result = await withLLMActivity(
      { sessionID: "session-semantic-progress", provider: "test", model: "semantic-progress" },
      policy,
      new AbortController().signal,
      async (run) => {
        attempts += 1
        run.bump("first-byte")
        for (let index = 0; index < 5; index += 1) {
          await new Promise((resolve) => setTimeout(resolve, 10))
          run.signal.throwIfAborted()
          run.bump("tool-input-delta")
        }
        return "completed"
      },
      (event) => events.push(event),
    )

    expect({ result, attempts }).toEqual({ result: "completed", attempts: 1 })
    expect(events.some((event) => event.type === "retry")).toBe(false)
    expect(events.filter((event) => event.type === "heartbeat" && event.kind === "tool-input-delta")).toHaveLength(5)
    expect(events.at(-1)).toMatchObject({ type: "terminal", outcome: "done" })
  })

  test("classifies the observed OpenAI socket closure as network and recovers on the next attempt", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0
    const result = await withLLMActivity(
      { sessionID: "session-openai-socket-close", provider: "openai", model: "gpt-5.6-terra" },
      {
        ...policy,
        maxRetries: { default: 0, network: 1 },
      },
      new AbortController().signal,
      async (run) => {
        attempts += 1
        run.bump("first-byte")
        if (run.attempt === 0) {
          throw new Error(
            "Cannot connect to API: The socket connection was closed unexpectedly. For more information, pass verbose true to fetch()",
          )
        }
        run.bump("text-delta")
        return "recovered"
      },
      (event) => events.push(event),
    )

    expect({ result, attempts }).toEqual({ result: "recovered", attempts: 2 })
    expect(events.find((event) => event.type === "retry")).toMatchObject({
      type: "retry",
      attempt: 1,
      cls: "network",
      lastHeartbeat: { kind: "first-byte" },
    })
    expect(events.at(-1)).toMatchObject({ type: "terminal", outcome: "done" })
  })

  test("classifies only accepted nonempty chunk payloads as semantic progress", () => {
    expect([
      chunkHeartbeatKind({ type: "start" }),
      chunkHeartbeatKind({ type: "tool-input-delta", toolCallId: "call-1", inputTextDelta: "" }),
      chunkHeartbeatKind({ type: "reasoning-delta", id: "reasoning-1", text: "" }),
      chunkHeartbeatKind({ type: "unknown-provider-keepalive" }),
      chunkHeartbeatKind({
        type: "tool-input-delta",
        toolCallId: "call-1",
        inputTextDelta: '{"query":"NVDA"}',
      }),
      chunkHeartbeatKind({ type: "text-delta", id: "text-1", text: "NVIDIA" }),
    ]).toEqual([null, null, null, null, "tool-input-delta", "text-delta"])
  })
})
