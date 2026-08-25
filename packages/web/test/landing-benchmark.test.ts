import { describe, expect, test } from "bun:test"
import { automationBenchmarkFacts } from "../src/content/landing-benchmark"

describe("landing AutomationBench facts", () => {
  test("projects the accepted 100-case Luna baseline and Mission result", () => {
    expect({
      benchmark: automationBenchmarkFacts.benchmark,
      system: automationBenchmarkFacts.system,
      model: automationBenchmarkFacts.model,
      cases: automationBenchmarkFacts.evaluatedCases,
      baseline: automationBenchmarkFacts.baselineStrictPassRate,
      mission: automationBenchmarkFacts.missionStrictPassRate,
      percentagePointLift: automationBenchmarkFacts.percentagePointLift,
      relativeLift: automationBenchmarkFacts.relativeLift,
      officialReferenceRates: automationBenchmarkFacts.officialReferences.map((entry) => entry.strictPassRate),
    }).toEqual({
      benchmark: "AutomationBench",
      system: "OpenCorvus Mission Base",
      model: "openai/gpt-5.6-luna",
      cases: 100,
      baseline: 8.07,
      mission: 34,
      percentagePointLift: 25.93,
      relativeLift: 4.21,
      officialReferenceRates: [30.44, 26.94, 21, 19.63],
    })
  })
})
