export type AutomationBenchmarkReference = {
  readonly model: string
  readonly strictPassRate: number
}

export type AutomationBenchmarkFacts = {
  readonly benchmark: "AutomationBench"
  readonly system: "OpenCorvus Mission Base"
  readonly model: "openai/gpt-5.6-luna"
  readonly evaluatedCases: number
  readonly baselineStrictPassRate: number
  readonly missionStrictPassRate: number
  readonly percentagePointLift: number
  readonly relativeLift: number
  readonly officialReferences: readonly AutomationBenchmarkReference[]
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits))

const evaluatedCases = 100
const baselineStrictPassRate = 8.07
const missionStrictPassRate = 34

/**
 * The accepted public benchmark facts. Current-run values come from the user's latest correction;
 * the four reference values are carried from the supplied official held-out comparison image and
 * are deliberately kept outside the current-run result because their sample is different.
 */
export const automationBenchmarkFacts: AutomationBenchmarkFacts = Object.freeze({
  benchmark: "AutomationBench",
  system: "OpenCorvus Mission Base",
  model: "openai/gpt-5.6-luna",
  evaluatedCases,
  baselineStrictPassRate,
  missionStrictPassRate,
  percentagePointLift: round(missionStrictPassRate - baselineStrictPassRate),
  relativeLift: round(missionStrictPassRate / baselineStrictPassRate),
  officialReferences: Object.freeze([
    { model: "Gemini 3.7 Flash High", strictPassRate: 30.44 },
    { model: "Claude Opus 5 Max", strictPassRate: 26.94 },
    { model: "GPT-5.6 Terra Max", strictPassRate: 21 },
    { model: "GPT-5.6 Sol Max", strictPassRate: 19.63 },
  ]),
})
