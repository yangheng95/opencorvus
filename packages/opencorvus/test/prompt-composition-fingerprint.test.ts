import { describe, expect, test } from "bun:test"
import { renderTaskDescription, type TaskDesc } from "@/engine/describe"
import { LLM } from "@/session/llm"
import {
  comparePromptComposition,
  fingerprintPromptComposition,
  toolPayloadTexts,
} from "@/session/prompt-composition"

/**
 * The fingerprint exists to distinguish two things `context-diagnostics` totals
 * cannot tell apart: a prompt that grew, and a prompt whose early block was
 * rewritten so everything after it lost its cache. A twenty-run batch spent 76%
 * of its uncached input on the second case without any signal naming it.
 */
describe("prompt composition fingerprint", () => {
  const compose = (system: string[], messages: unknown[]) =>
    fingerprintPromptComposition({ system, messages, toolPayloads: [{ name: "read", text: "{}" }] })

  test("records one block per system entry, per message, and one for the Tool table", () => {
    const fingerprint = compose(["env", "instructions"], [{ role: "user", content: "go" }])
    expect(fingerprint.blocks.map((block) => block.label)).toEqual([
      "tools",
      "system[0]",
      "system[1]",
      "message[0]:user",
    ])
    expect(fingerprint.systemBlocks).toBe(2)
    expect(fingerprint.messageBlocks).toBe(1)
    expect(fingerprint.toolCount).toBe(1)
    expect(fingerprint.totalChars).toBeGreaterThan(0)
  })

  test("carries sizes and digests, never bodies", () => {
    const secret = "sk-live-not-a-real-credential"
    const fingerprint = compose([`token ${secret}`], [{ role: "user", content: secret }])
    expect(JSON.stringify(fingerprint)).not.toContain(secret)
    for (const block of fingerprint.blocks) expect(block.sha256).toMatch(/^[0-9a-f]{16}$/)
  })

  test("an appended message leaves every earlier block byte-identical", () => {
    const before = compose(["env"], [{ role: "user", content: "go" }])
    const after = compose(["env"], [{ role: "user", content: "go" }, { role: "assistant", content: "ok" }])
    const divergence = comparePromptComposition(before, after)

    expect(divergence.appendOnly).toBe(true)
    // Tools, system, and the unchanged first message all stay in the prefix —
    // the shape a healthy growing turn has.
    expect(divergence.stablePrefixBlocks).toBe(3)
    expect(divergence.firstDivergentLabel).toBe("message[1]:assistant")
    expect(divergence.stablePrefixTokensEst).toBeGreaterThan(0)
  })

  test("names the rewritten early block and prices the whole tail as lost", () => {
    // The measured Orchestrator shape: the live Task render sits in `system`
    // and is re-resolved on every Provider step, so a long conversation behind
    // it can never enter the prefix cache.
    const history = Array.from({ length: 6 }, (_, index) => ({ role: "assistant", content: `step ${index}` }))
    const before = compose(["env", "instructions", "live-state@t0"], history)
    const after = compose(["env", "instructions", "live-state@t1"], history)
    const divergence = comparePromptComposition(before, after)

    expect(divergence.appendOnly).toBe(false)
    expect(divergence.firstDivergentLabel).toBe("system[2]")
    expect(divergence.firstDivergentIndex).toBe(3)
    // Tools and two system blocks stay; the six messages behind the rewritten
    // live-state block are all re-paid.
    expect(divergence.stablePrefixBlocks).toBe(3)
    expect(divergence.divergentTokensEst).toBeGreaterThan(divergence.stablePrefixTokensEst)

    // Relocating the same volatile text behind the conversation keeps the
    // prefix stable — this is the whole of the proposed Phase 1 in one assertion.
    const relocatedBefore = compose(["env", "instructions"], [...history, { role: "user", content: "live-state@t0" }])
    const relocatedAfter = compose(["env", "instructions"], [...history, { role: "user", content: "live-state@t1" }])
    const relocated = comparePromptComposition(relocatedBefore, relocatedAfter)
    expect(relocated.firstDivergentLabel).toBe("message[6]:user")
    expect(relocated.stablePrefixBlocks).toBe(9)
    expect(relocated.stablePrefixTokensEst).toBeGreaterThan(divergence.stablePrefixTokensEst)
  })

  test("a reordered system array is a divergence even when nothing was edited", () => {
    const before = compose(["a", "b"], [])
    const after = compose(["b", "a"], [])
    expect(comparePromptComposition(before, after).firstDivergentLabel).toBe("system[0]")
    expect(before.compositionSha256).not.toBe(after.compositionSha256)
  })

  test("the first call of a Session has nothing to compare against", () => {
    const divergence = comparePromptComposition(undefined, compose(["env"], []))
    expect(divergence).toMatchObject({ comparable: false, stablePrefixBlocks: 0, appendOnly: false })
    expect(divergence.divergentTokensEst).toBeGreaterThan(0)
  })

  test("splitting a system part at a line boundary is observability-only", () => {
    // `buildSystemParts` used to return the live Task render as the tail of one
    // context blob. Both shapes are joined with a newline by `LLM.stream` before
    // they reach the Provider, so the request bytes are identical; only the
    // number of blocks the fingerprint can name changes. This pins the identity,
    // because the whole justification for the split is that it changes nothing
    // the model sees.
    const instructions = "orchestrator instructions"
    const ctx = ["## Wake", "- id=1", "", "## Identities", "- base-developer"]
    const taskRender = "## Task\n- artifact art_1"

    const before = [instructions, [...ctx, taskRender].join("\n")]
    const after = [instructions, ctx.join("\n"), taskRender]
    expect(after.join("\n")).toBe(before.join("\n"))

    // The observability gain: the Task render now has a digest of its own, so a
    // divergence in it is distinguishable from a divergence in the wake header.
    const fingerprintOf = (system: string[]) =>
      fingerprintPromptComposition({ system, messages: [], toolPayloads: [] })
    expect(fingerprintOf(before).systemBlocks).toBe(2)
    expect(fingerprintOf(after).systemBlocks).toBe(3)

    const changedRender = [instructions, ctx.join("\n"), "## Task\n- artifact art_2"]
    const divergence = comparePromptComposition(fingerprintOf(after), fingerprintOf(changedRender))
    expect(divergence.firstDivergentLabel).toBe("system[2]")

    // Under the old single-block shape the same change reported the blob, which
    // could equally have been the wake header moving.
    const oldChanged = [instructions, [...ctx, "## Task\n- artifact art_2"].join("\n")]
    expect(
      comparePromptComposition(fingerprintOf(before), fingerprintOf(oldChanged)).firstDivergentLabel,
    ).toBe("system[1]")
  })

  test("retains logical labels alongside the physically joined system request", async () => {
    const logicalSystem = ["instructions", "wake", "live task"]
    const labels = [
      "runtime:orchestrator-instructions",
      "runtime:orchestrator-wake-and-capabilities",
      "runtime:orchestrator-live-task-render",
    ]
    const physicalSystem = await LLM.composeSystem({
      agentID: "orchestrator",
      agent: {} as never,
      model: {} as never,
      system: logicalSystem,
      runtimeSystemMode: "complete",
    })
    expect(physicalSystem).toEqual([logicalSystem.join("\n")])

    const fingerprint = fingerprintPromptComposition({
      system: logicalSystem,
      systemLabels: labels,
      physicalSystemText: physicalSystem.join("\n"),
      messages: [],
      toolPayloads: [],
    })
    expect(fingerprint.blocks.map((block) => block.label)).toEqual(["tools", ...labels])
    expect(fingerprint.physicalSystem).toMatchObject({ chars: logicalSystem.join("\n").length })

    const changed = fingerprintPromptComposition({
      system: ["instructions", "wake", "live task changed"],
      systemLabels: labels,
      physicalSystemText: ["instructions", "wake", "live task changed"].join("\n"),
      messages: [],
      toolPayloads: [],
    })
    expect(comparePromptComposition(fingerprint, changed).firstDivergentLabel).toBe(
      "runtime:orchestrator-live-task-render",
    )
  })

  test("Tool payload text follows the normalised schema, not the Zod wrapper", () => {
    const payloads = toolPayloadTexts({
      read: { description: "Read a file", inputSchema: { jsonSchema: { type: "object" } } } as never,
      broken: { description: "No schema" } as never,
    })
    expect(payloads.map((item) => item.name)).toEqual(["read", "broken"])
    expect(payloads[0]!.text).toContain("Read a file")
    // A Tool whose schema cannot be unwrapped contributes its description only,
    // rather than throwing and taking the whole request's fingerprint with it.
    expect(payloads[1]!.text).toBe("No schema")
  })

  test("keeps unchanged owner semantics byte-stable across prompt activity", () => {
    const renderAtActivity = (lastActivityMs: number) => {
      // Preserve the legacy runtime input in this regression so a raw activity timestamp
      // reaching the renderer changes the bytes and fails the stability contract.
      const owner = {
        session_id: "ses_worker",
        session_kind: "base-developer",
        lifecycle_status: "streaming" as const,
        last_activity_ms: lastActivityMs,
      }
      const task: TaskDesc = {
        id: "tsk_cache_stability",
        title: "Cache-stable owner projection",
        status: "in_progress",
        source: "operator",
        request: "Keep semantic prompt-owner state stable.",
        goals: [],
        current_process_prompt_owners: [owner],
        budget: { max_executor_groups: 1 },
      }
      return renderTaskDescription(task)
    }

    const beforeActivity = renderAtActivity(1_000)
    const afterActivity = renderAtActivity(2_000)
    const ownerLine = "- session=ses_worker; kind=base-developer; lifecycle=streaming"

    expect(beforeActivity).toContain(ownerLine)
    expect(afterActivity).toBe(beforeActivity)
  })
})
