import { expect, test } from "bun:test"
import { capabilityRecoveryGuidance } from "../../src/capability/recovery-guidance"

test.each([
  { tools: ["request_orchestrator_decision", "question"], route: "Use the callable request_orchestrator_decision" },
  { tools: ["question"], route: "Use the callable question" },
  { tools: ["capability_search"], route: "this occurrence has no callable permission-request tool" },
])("recovery guidance uses the callable route for $tools", ({ tools, route }) => {
  const guidance = capabilityRecoveryGuidance(tools)
  expect(guidance).toContain(route)
  expect(guidance).toContain("copy returned exact_refs to reveal")
  expect(guidance).toContain("Operation approval is requested by invoking an already granted tool")
  expect(guidance).toContain(
    "Filesystem EPERM/EACCES, browser launch, timeout and artifact publication errors are execution failures",
  )
  expect(guidance).toContain("preserve the returned settings target")
})
