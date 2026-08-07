export type Tone = "" | "accent" | "good" | "bad"

export interface VerdictInput {
  passed: number
  failed: number
  total: number
}

export function verdictTone(verdict: VerdictInput): Tone {
  if (verdict.failed > 0) return "bad"
  if (verdict.passed === verdict.total && verdict.total > 0) return "good"
  return "accent"
}

export function activeTone(active: boolean): Tone {
  return active ? "accent" : ""
}
