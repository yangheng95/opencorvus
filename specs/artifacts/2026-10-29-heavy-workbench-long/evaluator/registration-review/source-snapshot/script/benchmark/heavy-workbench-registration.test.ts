import { expect, test } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { z } from "zod"
import { parseHeavyWorkbenchRegistration } from "./heavy-workbench-registration"

const execution = {
  model: "openai/gpt-6.1-sol",
  inactivitySeconds: 600,
  tokenBudgetScope: "task-session-lineage" as const,
  budget: { total_model_tokens: null, policy: "user-corrected-development-no-resource-cutoff" },
  runRoot: "D:/isolated-benchmark/run-a",
  project: "D:/isolated-benchmark/run-a/project",
}

test("completed H05 registration preserves execution and provenance metadata", () => {
  const input = JSON.parse(
    fs.readFileSync(
      path.resolve(
        import.meta.dir,
        "../../specs/artifacts/2026-10-29-heavy-workbench-h05-opencorvus/attempt-4-uncapped/registration.json",
      ),
      "utf8",
    ),
  )
  expect(parseHeavyWorkbenchRegistration(input)).toEqual(input)
})

test("long-study profile enters the same registration contract with an explicit uncapped budget", () => {
  const profile = JSON.parse(
    fs.readFileSync(
      path.resolve(import.meta.dir, "../../specs/artifacts/2026-10-29-heavy-workbench-long/public/profile.json"),
      "utf8",
    ),
  )
  const input = {
    ...execution,
    budget: { ...execution.budget, ...profile.budget },
    benchmark: profile.benchmark,
    case: profile.case,
    profileStatus: profile.status,
  }
  const actual = parseHeavyWorkbenchRegistration(input)
  expect(actual).toEqual(input)
  expect({ benchmark: actual.benchmark, case: actual.case, total: actual.budget.total_model_tokens }).toEqual({
    benchmark: "HeavyWorkBench-Long/0.2.0-dev",
    case: "L01",
    total: null,
  })
})

test("a missing total-token policy yields the precise registration field error", () => {
  const result = (() => {
    try {
      return parseHeavyWorkbenchRegistration({
        ...execution,
        benchmark: "HeavyWorkBench-Long/0.2.0-dev",
        case: "L01",
        budget: {},
      })
    } catch (error) {
      if (!(error instanceof z.ZodError)) throw error
      return error.issues.map(({ code, path }) => ({ code, path }))
    }
  })()
  expect(result).toEqual([{ code: "invalid_type", path: ["budget", "total_model_tokens"] }])
})
