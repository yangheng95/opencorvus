import { describe, expect, spyOn, test } from "bun:test"
import { DefaultLLMActivityPolicy, chunkHeartbeatKind, withLLMActivity, type LLMActivityEvent } from "@/llm/activity"
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
  test("bounds long-duration idle and first-byte recovery to one retry", async () => {
    const random = spyOn(Math, "random").mockReturnValue(1)
    const maximumFirstRetryBackoff = Math.max(
      DefaultLLMActivityPolicy.backoffMs("idle", 0, Number.MAX_SAFE_INTEGER),
      DefaultLLMActivityPolicy.backoffMs("first_byte", 0, Number.MAX_SAFE_INTEGER),
    )
    random.mockRestore()
    expect(
      2 * (DefaultLLMActivityPolicy.firstByteMs + DefaultLLMActivityPolicy.idleMs) + maximumFirstRetryBackoff,
    ).toBeLessThan(600_000)
    for (const cls of ["idle", "first_byte"] as const) {
      const events: LLMActivityEvent[] = []
      let attempts = 0
      await expect(
        withLLMActivity(
          { sessionID: `session-${cls}-budget`, provider: "test", model: `${cls}-budget` },
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
            if (cls === "idle") run.bump("first-byte")
            return waitForAbort(run.signal)
          },
          (event) => events.push(event),
        ),
      ).rejects.toMatchObject({ name: "LLMActivityError", cls, attempts: 1 })
      expect({ attempts, retries: events.filter((event) => event.type === "retry") }).toMatchObject({
        attempts: 2,
        retries: [{ type: "retry", attempt: 1, cls }],
      })
    }
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
