// Resolve an accent colour for a card's stage. Known stages reference the
// per-stage CSS variables defined in card.css so theme switches keep working.

const KNOWN_STAGES = new Set([
  "user",
  "assistant",
  "system",
  "orchestrator",
  "mission",
  "intent-analysis",
  "spec",
  "requirements",
  "frontend-design",
  "frontend-research",
  "visual-qa",
  "architect",
  "goal-workload-analyst",
  "planner",
  "executor",
  "build",
  "explore",
  "deep-research",
  "acceptance",
  "integrity",
  "fact-check",
  "tool",
])

export function stageAccent(stage: string | undefined | null): string | undefined {
  if (!stage) return undefined
  const s = String(stage).trim()
  if (!s) return undefined
  if (KNOWN_STAGES.has(s)) return `var(--card-stage-${s})`
  return undefined
}
