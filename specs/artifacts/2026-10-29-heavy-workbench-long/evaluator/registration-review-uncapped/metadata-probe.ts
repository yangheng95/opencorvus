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
  metadata: { occurrence: "uncapped-final-probe", nested: { keep: ["value", { x: 1 }] } }, comparable: false,
}
const actual = parseHeavyWorkbenchRegistration(input)
assert.deepStrictEqual(actual, input)
assert.equal(actual.budget.total_model_tokens, null)
assert.equal(actual.inactivitySeconds, 1234)
let numericPolicyError: unknown
try {
  parseHeavyWorkbenchRegistration({ ...input, budget: { total_model_tokens: 17 } })
} catch (error: any) {
  numericPolicyError = error.issues.map(({ code, path }: any) => ({ code, path }))
}
assert.deepStrictEqual(numericPolicyError, [{ code: "invalid_type", path: ["budget", "total_model_tokens"] }])
console.log(JSON.stringify({
  probe: "pure_uncapped_registration_contract", rootAndBudgetMetadataPreserved: true,
  explicitNullPreserved: true, numericCutoffMapsToExplicitFieldError: numericPolicyError,
  explicitInactivitySecondsPreserved: 1234,
  scope: "parser only; no launcher/service/provider/credentials",
}))
