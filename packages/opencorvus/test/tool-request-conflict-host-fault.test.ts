/**
 * A Tool request Part is an immutable durable fact. A second write that
 * disagrees with it is a Host invariant violation, and two separate defects
 * turned one such violation into a dead Task (observed 2026-08-16,
 * tsk_g00VSTJYc900STEQzWIq):
 *
 *  1. The thrown error said only "conflicts with its immutable request fact".
 *     The losing payload is persisted nowhere, so the conflict was
 *     undiagnosable without a live reproduction.
 *  2. The error reached `withLLMActivity`'s classifier, which recognizes only
 *     provider-shaped failures and fell through to the retryable `unknown`
 *     default. The runner then asked the processor to retry an attempt whose
 *     tools had already executed — structurally impossible — so the operator
 *     saw `ProcessorUnsafeRetryError` and never the real cause.
 *
 * Defect 2 was first patched by wrapping this one call site in
 * `HostProcessingFaultError`. That left the default itself fail-open: every
 * other deterministic Host invariant in the codebase still classified as
 * `unknown` and still retried. The policy now grants retryability instead of
 * assuming it, so `unknown` terminates on the first attempt and the wrapper is
 * a diagnostic label rather than the only thing standing between an invariant
 * violation and a retry storm.
 */
import { afterEach, describe, expect, test } from "bun:test"
import { DefaultLLMActivityPolicy, withLLMActivity, type LLMActivityEvent } from "@/llm/activity"
import { HostProcessingFaultError, isHostProcessingFault } from "@/llm/host-fault"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { describeToolRequestConflict } from "@/session/tool-part-facts"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const retryingPolicy = {
  ...DefaultLLMActivityPolicy,
  totalMs: 1_000,
  firstByteMs: 100,
  idleMs: 100,
  maxRetries: { default: 2 },
  backoffMs: () => 0,
}

async function toolPartFixture(projectPath: string) {
  const session = await Session.create({ kind: "root", title: "Tool request conflict" })
  const now = Date.now()
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "user",
    author: "user",
    time: { created: now },
    agent: "orchestrator",
    model: { providerID: "openai", modelID: "gpt-5.6-terra" },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    parentID: user.id,
    role: "assistant",
    author: "orchestrator",
    time: { created: now + 1 },
    agent: "orchestrator",
    providerID: "openai",
    modelID: "gpt-5.6-terra",
    path: { cwd: projectPath, root: projectPath },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  return { session, assistant, now }
}

describe("Tool request immutability conflicts", () => {
  test("accepts Provider metadata that arrives after the request fact is durable", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { session, assistant, now } = await toolPartFixture(project.path)
        const partID = Identifier.ascending("part")
        const base = {
          id: partID,
          sessionID: session.id,
          messageID: assistant.id,
          type: "tool" as const,
          callID: "call_late_provider_metadata",
          tool: "artifact_search",
        }
        const input = { version_scope: "current", sort: "newest", limit: 40 }
        // OpenAI streams the function call first, then repeats it carrying the
        // Responses `itemId`. Rejecting the second write failed every OpenAI
        // Tool call outright once these faults stopped being retried.
        await Session.updatePart({ ...base, state: { status: "running", input, time: { start: now + 2 } } })
        const repeated = await Session.updatePart({
          ...base,
          state: { status: "running", input, time: { start: now + 2 } },
          metadata: { openai: { itemId: "fc_01c53e019345dc77016a827a494c6881918e5a5e39bf69c1bf" } },
        })

        // The durable fact is immutable by database trigger, so the first write
        // stays the record; the repeated call must simply be accepted.
        expect(repeated.type).toBe("tool")
        expect((repeated as { state: { status: string } }).state.status).toBe("running")

        // Replacing metadata that the durable fact already carries is still a
        // real conflict, so the tolerance cannot mask a genuinely changed call.
        const annotatedID = Identifier.ascending("part")
        const annotated = {
          ...base,
          id: annotatedID,
          callID: "call_annotated_provider_metadata",
          state: { status: "running" as const, input, time: { start: now + 2 } },
          metadata: { openai: { itemId: "fc_first_durable_item" } },
        }
        await Session.updatePart(annotated)
        const replaced = Session.updatePart({
          ...annotated,
          metadata: { openai: { itemId: "fc_a_completely_different_item" } },
        })
        const error = await replaced.then(
          () => undefined,
          (cause) => cause,
        )
        expect(error).toBeInstanceOf(HostProcessingFaultError)
        expect(String((error as Error).message)).toContain("metadata: stored=")
      },
    })
  })

  test("names the diverging field, stored value, and incoming value", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { session, assistant, now } = await toolPartFixture(project.path)
        const partID = Identifier.ascending("part")
        const base = {
          id: partID,
          sessionID: session.id,
          messageID: assistant.id,
          type: "tool" as const,
          callID: "call_tool_request_conflict",
          tool: "artifact_search",
        }
        await Session.updatePart({
          ...base,
          state: {
            status: "running",
            input: { version_scope: "current", sort: "newest", limit: 40 },
            time: { start: now + 2 },
          },
        })

        const conflicting = Session.updatePart({
          ...base,
          state: {
            status: "completed",
            input: { version_scope: "current", sort: "newest", limit: 20 },
            output: "{}",
            title: "Artifact catalog",
            metadata: {},
            time: { start: now + 2, end: now + 3 },
          },
        })

        const error = await conflicting.then(
          () => undefined,
          (cause) => cause,
        )
        expect(error).toBeInstanceOf(HostProcessingFaultError)
        const message = String((error as Error).message)
        expect(message).toContain(partID)
        expect(message).toContain("input: stored=")
        expect(message).toContain('"limit":40')
        expect(message).toContain('"limit":20')
      },
    })
  })

  test("reports every diverging request field and stays silent when the fact is equivalent", () => {
    const stored = {
      type: "tool-request" as const,
      callID: "call_a",
      tool: "artifact_search",
      input: { limit: 40 },
      time: { start: 1 },
    }
    expect(describeToolRequestConflict(stored, { ...stored, time: { start: 999 } })).toBe("no field diverged")
    const divergence = describeToolRequestConflict(stored, {
      ...stored,
      tool: "artifact_read",
      input: { limit: 20 },
    })
    expect(divergence).toContain("tool: stored=\"artifact_search\" received=\"artifact_read\"")
    expect(divergence).toContain("input: stored=")
  })
})

describe("Host faults inside one LLM activity", () => {
  test("fails a Host processing fault on the first attempt instead of retrying it", async () => {
    const events: LLMActivityEvent[] = []
    const retryBoundaries: unknown[] = []
    let attempts = 0

    await expect(
      withLLMActivity(
        { sessionID: "session-host-fault", provider: "openai", model: "gpt-5.6-terra" },
        retryingPolicy,
        new AbortController().signal,
        async () => {
          attempts += 1
          throw new HostProcessingFaultError("Tool request Part prt_x conflicts with its immutable request fact", {
            cause: new Error("input: stored={} received={\"limit\":1}"),
          })
        },
        (event) => events.push(event),
        { beforeRetry: async (boundary) => void retryBoundaries.push(boundary) },
      ),
    ).rejects.toMatchObject({ name: "LLMActivityError", cls: "host_fault" })

    // The retry boundary is where a started-tool attempt becomes an
    // unrecoverable ProcessorUnsafeRetryError; a Host fault must never reach it.
    expect(attempts).toBe(1)
    expect(retryBoundaries).toEqual([])
    expect(events.filter((event) => event.type === "retry")).toEqual([])
    expect(events.at(-1)).toMatchObject({ type: "terminal", outcome: "failed", cls: "host_fault" })
  })

  test("terminates an unrecognized error on the first attempt instead of assuming it is transient", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0

    await expect(
      withLLMActivity(
        { sessionID: "session-unknown-terminal", provider: "openai", model: "gpt-5.6-terra" },
        retryingPolicy,
        new AbortController().signal,
        async () => {
          attempts += 1
          throw new Error("something the classifier does not recognize")
        },
        (event) => events.push(event),
      ),
    ).rejects.toThrow()

    expect(attempts).toBe(1)
    expect(events.filter((event) => event.type === "retry")).toEqual([])
    expect(events.at(-1)).toMatchObject({ type: "terminal", outcome: "failed", cls: "unknown" })
  })

  test("still retries a transport failure the classifier does recognize, under the same policy", async () => {
    const events: LLMActivityEvent[] = []
    let attempts = 0

    const result = await withLLMActivity(
      { sessionID: "session-network-retry", provider: "openai", model: "gpt-5.6-terra" },
      retryingPolicy,
      new AbortController().signal,
      async (run) => {
        attempts += 1
        if (run.attempt === 0) throw new Error("fetch failed: ECONNRESET")
        run.bump("text-delta")
        return "recovered"
      },
      (event) => events.push(event),
    )

    expect(result).toBe("recovered")
    expect(attempts).toBe(2)
    expect(events.filter((event) => event.type === "retry")).toMatchObject([{ cls: "network" }])
  })

  test("recognizes a Host fault after the activity runner wraps it", () => {
    const wrapped = new Error("outer", { cause: new HostProcessingFaultError("inner") })
    expect(isHostProcessingFault(wrapped)).toBe(true)
    expect(isHostProcessingFault(new Error("plain"))).toBe(false)
  })

  test("treats a storage constraint refusal as a deterministic Host fault", () => {
    // Any RAISE(ABORT) trigger, UNIQUE, or CHECK that ever bites the Host's
    // own write must cost one clean failure — never a retry storm. The 1415
    // identical retries of 2026-08-16 were this exact shape with a trigger.
    const trigger = Object.assign(new Error("tool_part_request: immutable request fact"), {
      code: "SQLITE_CONSTRAINT_TRIGGER",
    })
    expect(isHostProcessingFault(trigger)).toBe(true)
    expect(isHostProcessingFault(new Error("outer", { cause: trigger }))).toBe(true)

    const unique = Object.assign(new Error("UNIQUE constraint failed"), { code: "SQLITE_CONSTRAINT_UNIQUE" })
    expect(isHostProcessingFault(unique)).toBe(true)

    // Non-constraint SQLite conditions (busy, locked) stay retryable-shaped.
    const busy = Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" })
    expect(isHostProcessingFault(busy)).toBe(false)
  })
})
