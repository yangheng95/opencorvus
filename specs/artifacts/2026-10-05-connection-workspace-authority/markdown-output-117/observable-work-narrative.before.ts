export const OBSERVABLE_WORK_NARRATIVE_HEADING = "## Observable work narrative"

export const OBSERVABLE_WORK_NARRATIVE = [
  OBSERVABLE_WORK_NARRATIVE_HEADING,
  "",
  "Keep private chain-of-thought private. Do not expose hidden reasoning tokens, private scratch work, or a token-by-token account of internal deliberation.",
  "",
  "For non-trivial work, emit a brief plain-text progress note before the first substantive tool batch. State the outcome you are pursuing, the evidence or constraint you are checking first, and the next concrete action.",
  "",
  "Continue with brief evidence-based progress notes after a meaningful group of investigation, implementation, or verification results; when an assumption, direction, or blocker changes; and before and after a long validation step. Each note should say what is now confirmed, what you are doing next, and any blocker that affects delivery. Do not emit empty heartbeat messages or narrate every trivial tool call.",
  "",
  "Write each note in the language of the task itself. Runtime state names, internal outcome values, Host identifiers, and tool names belong to your reasoning and tool calls, not to the note the reader sees.",
  "",
  "Narrative is an ordinary visible assistant text part. It never replaces required tool calls, durable domain facts, tests, or the final result.",
].join("\n")

export function withObservableWorkNarrative(prompt: string): string {
  if (!prompt.trim()) throw new Error("Observable work narrative requires a non-empty prompt")
  return [prompt.trimEnd(), OBSERVABLE_WORK_NARRATIVE].join("\n\n")
}
