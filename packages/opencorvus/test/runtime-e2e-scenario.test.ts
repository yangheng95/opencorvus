import { expect, test } from "bun:test"
import path from "node:path"
import { RuntimeE2EScenarioSchema, scenarioFixturePath } from "../script/runtime-e2e-scenario"

test("scenario input records explicit public Task intent and a portable isolated fixture", () => {
  const scenario = RuntimeE2EScenarioSchema.parse({ caseID: "investigation", title: "Investigate", request: "Read local evidence", promptProfile: "base", requiredAdapters: ["explore"], files: { "src/pricing.ts": "export const price = 10" } })
  expect(scenario.requiredAdapters).toEqual(["explore"])
  expect(scenarioFixturePath(path.resolve("isolated"), "src/pricing.ts")).toBe(path.resolve("isolated/src/pricing.ts"))
})

test("ambiguous Windows names return the portable-path error before any write", () => {
  for (const name of ["AGENTS.md.", "AGENTS.md ", "src/file.txt:stream", "NUL.txt", "dir/../file", "C:/device/file", "\\\\?\\C:\\device\\file"]) {
    expect(() => scenarioFixturePath(path.resolve("isolated"), name)).toThrow("Scenario fixture requires a relative portable file path")
  }
  expect(() => scenarioFixturePath(path.resolve("isolated"), "agents.MD")).toThrow("Scenario fixture must preserve runtime and acceptance ownership")
})
