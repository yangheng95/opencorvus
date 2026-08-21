import { describe, expect, test } from "bun:test"
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
})
