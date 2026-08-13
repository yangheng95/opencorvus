import { expect, test } from "bun:test"
import { renderInitialDispatchContractInstruction } from "@/orchestrator/agent"

test("initial dispatch guidance preserves delegated-worker instruction and rationale as separate required fields", () => {
  const guidance = renderInitialDispatchContractInstruction()

  expect(guidance).toContain("Supply every field required by that target schema")
  expect(guidance).toContain("When `instruction` is listed, it carries the complete bounded work")
  expect(guidance).toContain("When `reason` is listed, it separately explains why that work is needed now")
  expect(guidance).toContain("never substitutes for `instruction`")
})
