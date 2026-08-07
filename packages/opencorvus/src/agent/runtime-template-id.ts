/** Exact runtime-template identifiers (IDs) owned by the worker runtime. */
export const RUNTIME_TEMPLATE_IDS = Object.freeze([
  "delegated-worker",
  "intent-analysis",
  "requirements",
  "architect",
  "goal-workload-analyst",
  "build",
  "explore",
  "deep-research",
  "frontend-research",
  "frontend-design",
  "visual-qa",
  "integrity",
  "fact-check",
] as const)

export type RuntimeTemplateID = (typeof RUNTIME_TEMPLATE_IDS)[number]

const exactIDs: ReadonlySet<string> = new Set(RUNTIME_TEMPLATE_IDS)

function parse(value: unknown): RuntimeTemplateID {
  if (typeof value !== "string" || !exactIDs.has(value)) {
    throw new Error(`Unknown runtime template ID: ${JSON.stringify(value)}`)
  }
  return value as RuntimeTemplateID
}

/** Frozen fail-fast access surface; it does not discover or infer templates. */
export const RuntimeTemplateID = Object.freeze({
  ids: RUNTIME_TEMPLATE_IDS,
  is(value: string): value is RuntimeTemplateID {
    return exactIDs.has(value)
  },
  parse,
  get(id: string): RuntimeTemplateID {
    return parse(id)
  },
})
