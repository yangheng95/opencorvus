import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"

const { parseHeavyWorkbenchRegistration } = await import(
  pathToFileURL("D:/myhexin-local/opencorvus/script/benchmark/heavy-workbench-registration.ts").href
)
const input = {
  benchmark: "HeavyWorkBench-Long/0.2.0-dev", case: "L01", model: "openai/gpt-6.1-sol",
  inactivitySeconds: 1234, tokenBudgetScope: "task-session-lineage",
  budget: { total_model_tokens: null, total_wall_seconds: null, policy: { origin: "user", values: [0, false, null] } },
  runRoot: "D:/review-owned/run", project: "D:/review-owned/run/project",
  metadata: { occurrence: "new-probe", nested: { keep: ["value", { x: 1 }] } }, comparable: false,
}
const parsed = parseHeavyWorkbenchRegistration(input)
assert.deepStrictEqual(parsed, input)
assert.equal(parsed.budget.total_model_tokens, null)
assert.equal(parsed.inactivitySeconds, 1234)
const capped = { ...input, budget: { ...input.budget, total_model_tokens: 17 } }
assert.deepStrictEqual(parseHeavyWorkbenchRegistration(capped), capped)
console.log(JSON.stringify({
  probe: "pure_registration_metadata", nestedRootAndBudgetMetadataPreserved: true,
  explicitNullPreserved: true, positiveBudgetPreserved: 17, explicitInactivitySecondsPreserved: 1234,
  scope: "parser only; launcher/service/provider not imported or started",
}))
