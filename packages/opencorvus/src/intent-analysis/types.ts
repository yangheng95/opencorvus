/**
 * Intent Analysis Agent types.
 *
 * The Intent Analysis Agent runs BEFORE any downstream planning agent
 * (Requirements / Planner / Architect / …). Its job is to read a raw,
 * often very short, user request and return a structured understanding:
 * intent class, complexity band, extracted slots, missing information,
 * and any clarification questions the downstream agents would need
 * answered before they can proceed safely.
 *
 * Wired into the workflow through the orchestrator `analyze_intent` tool.
 * The agent itself is still read-only: it records rich clarification requests,
 * and the orchestrator tool owns surfacing blocker follow-ups to the user.
 */

export type IntentClass = "question" | "bug_fix" | "feature" | "refactor" | "exploration" | "chore" | "unclear"

export type IntentComplexity = "trivial" | "small" | "medium" | "large" | "unknown"

export type ClarificationPriority = "blocker" | "nice"

export interface IntentSlot {
  /** Slot name, e.g. "target_file", "module", "stack", "action_verb". */
  key: string
  /** Extracted value, verbatim or normalized. */
  value: string
  /** Confidence in this extraction, 0-1. */
  confidence: number
}

export interface IntentClarificationOption {
  /** Stable answer value returned to the intent-analysis consumer. */
  value: string
  /** Short selectable answer label shown to the operator. */
  label: string
  /** One-sentence explanation of when this option should be selected. */
  description: string
}

export interface IntentClarification {
  /** Short label shown as the question header. */
  header: string
  /** The clarifying question to ask the user. */
  question: string
  /** Concrete selectable answers. Empty means this is free-form only. */
  options: IntentClarificationOption[]
  /** Whether multiple options may be selected. */
  multiple: boolean
  /** Whether the user may type a custom free-form answer. */
  custom: boolean
  /** Why answering this is needed before downstream agents can proceed. */
  why_needed: string
  /** blocker = downstream cannot start without this; nice = helpful but skippable. */
  priority: ClarificationPriority
}

export interface IntentAnalysisResult {
  intent_class: IntentClass
  complexity: IntentComplexity
  extracted_slots: IntentSlot[]
  /** Keys of information judged missing but important — empty means fully specified. */
  missing_info: string[]
  clarifications: IntentClarification[]
  /** Overall confidence in this analysis, 0-1. */
  confidence: number
  /** One-line statement of what the user wants. */
  summary: string
}
