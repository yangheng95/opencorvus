import { describe, expect, test } from "bun:test"
import ORCHESTRATOR_CORE from "../src/prompt/core/orchestrator-core.txt" with { type: "text" }

describe("Orchestrator unavailable-evidence acceptance contract", () => {
  test("routes an accepted domain stop condition through terminal evidence and normal lifecycle settlement", () => {
    expect(ORCHESTRATOR_CORE).toContain(
      "A declared stop condition stops the unsafe analysis or action, not the Task evidence workflow.",
    )
    expect(ORCHESTRATOR_CORE).toContain(
      "otherwise the evidence-backed unavailable result is the deliverable and must be terminalized normally.",
    )
    expect(ORCHESTRATOR_CORE).toContain(
      "Preserve each missing field, the analysis it blocks, the decision withheld, the evidence needed later, and the qualified owner",
    )
  })
})
