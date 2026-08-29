import { expect, test } from "bun:test"
import { renderInitialDispatchContractInstruction } from "@/orchestrator/agent"

test("initial dispatch guidance preserves delegated-worker instruction and rationale as separate required fields", () => {
  const guidance = renderInitialDispatchContractInstruction()

  expect(guidance).toContain("Supply every field required by that target schema")
  expect(guidance).toContain("When `instruction` is listed, it carries the complete bounded work")
  expect(guidance).toContain("When `reason` is listed, it separately explains why that work is needed now")
  expect(guidance).toContain("never substitutes for `instruction`")
})

test("frontier dispatch guidance asks for one complete structured ready set", () => {
  const guidance = renderInitialDispatchContractInstruction({ frontier: true })

  expect(guidance).toContain("Call `dispatch_agents` once")
  expect(guidance).toContain("complete current dependency-ready frontier")
  expect(guidance).toContain("include all mutually independent ready members")
  expect(guidance).toContain("`team` and `dispatches`")
  expect(guidance).toContain("Every team row is the visible Task-local name")
  expect(guidance).toContain("exact target-discriminated dispatch")
})
