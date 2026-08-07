import { expect, test } from "bun:test"
import ORCHESTRATOR_CORE from "../../src/prompt/core/orchestrator-core.txt" with { type: "text" }
import { ORCHESTRATOR_QUESTION_DESCRIPTION } from "../../src/orchestrator/interaction-tools"

test("projects the complete verification-budget scheduling contract", () => {
  const requiredPromptClauses = [
    "## Metacognitive verification budget",
    "The **acceptance floor** contains every check required",
    "The **optional assurance budget** contains only additional package-executable testing",
    "`skip_optional_testing` as the recommended compact choice",
    "`run_optional_testing` as the smallest concrete additional assurance increment",
    "If the operator rejects the question or its automatic deadline expires, treat the outcome exactly as `skip_optional_testing`",
    "do not dispatch or execute any test or assurance work described by the question",
    "never ask again after it is answered",
    "Continue only with work that was already explicitly required by the operator, repository contract, or selected binding workflow",
    "This preference is not a Host permission gate, workflow state, or authority to remove required evidence.",
  ]

  expect(requiredPromptClauses.map((clause) => ORCHESTRATOR_CORE.includes(clause))).toEqual(
    requiredPromptClauses.map(() => true),
  )
  expect(ORCHESTRATOR_QUESTION_DESCRIPTION).toContain(
    "recommends skip_optional_testing",
  )
  expect(ORCHESTRATOR_QUESTION_DESCRIPTION).toContain(
    "offers run_optional_testing only when the active package can execute a concrete additional confidence increment",
  )
  expect(ORCHESTRATOR_QUESTION_DESCRIPTION).toContain(
    "Rejection or automatic deadline expiry has exactly the skip_optional_testing meaning",
  )
  expect(ORCHESTRATOR_QUESTION_DESCRIPTION).toContain(
    "do not dispatch or execute any testing or assurance work named by the question",
  )
})
