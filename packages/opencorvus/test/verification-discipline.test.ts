import { describe, expect, test } from "bun:test"
import { HelperAgentRegistry } from "../src/agent/helper-agent-registry"
import { PrimaryAssistantRegistry } from "../src/agent/primary-assistant-registry"
import { RuntimeTemplateRegistry } from "../src/agent/runtime-template-registry"
import { withObservableWorkNarrative } from "../src/prompt/fragments/observable-work-narrative"
import { VERIFICATION_DISCIPLINE } from "../src/prompt/fragments/verification-discipline"
import { LLM } from "../src/session/llm"

describe("shared execution verification contract", () => {
  test.each(PrimaryAssistantRegistry.ids)(
    "projects the shared policy after %s custom instructions",
    async (agentID) => {
      const result = await LLM.composeSystem({
        agentID,
        agent: { options: {}, prompt: "Configured execution instructions", promptAppend: "Project additions" },
        model: {} as never,
        system: ["Current task evidence"],
      })
      expect(result).toEqual([
        withObservableWorkNarrative(
          ["Configured execution instructions\nProject additions\nCurrent task evidence", VERIFICATION_DISCIPLINE].join(
            "\n\n",
          ),
        ),
      ])
    },
  )

  test.each(["orchestrator", ...RuntimeTemplateRegistry.ids])(
    "projects the policy into complete %s execution prompts on each physical Turn",
    async (identity) => {
      const agentID = identity === "orchestrator" ? identity : `package-${identity}`
      const core = identity === "orchestrator" ? "Task scheduler" : RuntimeTemplateRegistry.get(identity).corePromptSeed
      const invoke = (context: string) =>
        LLM.composeSystem({
          agentID,
          agent: { options: {}, prompt: "Native default" },
          model: {} as never,
          system: [core, context],
          runtimeSystemMode: "complete",
        })
      const contexts = ["Project A initial", "Project B parallel", "Project A continuation", "Project A recovery"]
      const results = await Promise.all(contexts.map(invoke))
      for (const [index, result] of results.entries()) {
        expect(result).toEqual([[`${core}\n${contexts[index]}`, VERIFICATION_DISCIPLINE].join("\n\n")])
      }
    },
  )

  test.each(HelperAgentRegistry.ids)("preserves the dedicated native %s helper prompt", async (agentID) => {
    expect(
      await LLM.composeSystem({
        agentID,
        agent: { options: {}, prompt: "Tool-free helper instructions" },
        model: {} as never,
        system: ["Helper input"],
      }),
    ).toEqual(["Tool-free helper instructions\nHelper input"])
  })

  test("defines the ban for explicit input requirements and retains meaningful verification", () => {
    expect(VERIFICATION_DISCIPLINE).toContain(
      "even when user input, an attachment, a specification, a package instruction, or an earlier acceptance inventory explicitly requests them",
    )
    expect(VERIFICATION_DISCIPLINE).toContain(
      "against an independently established reference under the same representation contract",
    )
    expect(VERIFICATION_DISCIPLINE).toContain(
      "Keep genuine protocol, immutable attachment/resource, signed-download, and other security/integrity verification",
    )
    expect(VERIFICATION_DISCIPLINE).toContain(
      "inspect the causal tool inputs and outputs before another repair or acceptance decision",
    )
    expect(VERIFICATION_DISCIPLINE).toContain("distinguish a removed invalid check from a passed check")
  })

  test("defines promise-derived input coverage, independent correctness and final consumption", () => {
    for (const clause of [
      "Choose verification from the promised capability.",
      "development-sample correctness, supported-input correctness, and final-deliverable execution",
      "exercise reasonable legal variations beyond the development examples",
      "Establish expected results independently of the implementation under test",
      "actually consume the final submitted entry point and its outputs in the intended runtime",
      "Make completion claims match verification coverage.",
      "executing directly, delegating, reviewing, and accepting work",
    ])
      expect(VERIFICATION_DISCIPLINE).toContain(clause)
  })

  test("defines evidence-based quality selection and released-strategy verification", () => {
    for (const clause of [
      "Prefer mature format readers and existing project primitives",
      "Separate feasibility, threshold compliance, and comparative outcome quality.",
      "Keep training, strategy selection, and final evaluation data appropriately separated",
      "make the released configuration and final entry point actually execute that choice",
      "compare the released outputs with independently established expectations",
    ])
      expect(VERIFICATION_DISCIPLINE).toContain(clause)
  })

  test("derives allowed input domains from each interface role", () => {
    for (const clause of [
      "Treat input admissibility as a correctness claim.",
      "identify each value's role and the contract authority at each boundary",
      "share a validator only when those contracts agree",
      "Independently establish why a value is permitted or rejected",
      "contract-permitted distinctions between roles and equivalent representations through the final consumer",
      "identify a plausible wrong rule that the selected checks would still accept",
      "actual fixture construction and serialization, the final-entry invocation, and an independently grounded assertion",
      "strengthen the producer's own checks for material gaps",
      "Attribute checks to their actual author, executor and time",
    ])
      expect(VERIFICATION_DISCIPLINE).toContain(clause)
  })
})
