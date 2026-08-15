import z from "zod"
import { Database, and, eq } from "@/storage/db"
import { Budget } from "./model"
import { EngineConfig } from "./config"
import { EngineInteractionOutcomeTable, EngineInteractionRequestTable, type EngineBudget, type EngineTaskStatus } from "./engine.sql"
import type { TaskRow } from "./store"
import { listInteractions } from "./store"

export const ORCHESTRATOR_POLL_INTERVAL_MS = 500
export { deriveTitle } from "@/title/derive"

// orchestratorState moved to ./orchestrator-state — see that file's header
// for the cycle rationale. Helpers must not run `Instance.state(...)` at
// module-init because helpers is re-exported through the engine barrel.

export function progressStatus(status: EngineTaskStatus) {
  if (status === "completed") return "completed" as const
  if (status === "cancelled") return "cancelled" as const
  if (status === "failed") return "failed" as const
  return "active" as const
}

export function budgetRow(input?: z.infer<typeof Budget>): EngineBudget | undefined {
  if (!input) return undefined
  return {
    max_executor_groups: input.maxExecutorGroups,
  }
}

/**
 * Resolve the effective parallel-agent ceiling for a task.
 * Priority: task budget > config (env + jsonc) > DEFAULTS.max_executor_groups.
 *
 * Reads the live `EngineConfig.get()` snapshot so UI-driven updates to
 * opencorvus.jsonc take effect on the next orchestrator tick — no restart,
 * no cache invalidation. Callers must be in async context; the three
 * budget-class helpers here share that contract.
 */
export async function effectiveMaxAgentParallelism(task: TaskRow): Promise<number> {
  const budgetMax = (task.budget as EngineBudget | null)?.max_executor_groups
  if (typeof budgetMax === "number" && budgetMax >= 1) return budgetMax
  const cfg = await EngineConfig.get()
  return cfg.max_executor_groups
}

/**
 * Query answered clarification interactions for a task and format as a prompt section.
 * Single source of truth for all clarification Q&A: every agent (Orchestrator, Requirements,
 * Architect, frontend_design, Acceptance) reads the same transcript so
 * downstream agents never duplicate questions already answered upstream.
 *
 * Returns "" when no answered question interactions exist.
 */
/**
 * Caps for clarification transcript. Every sub-agent (orchestrator,
 * requirements, architect, acceptance) reads this section
 * into its own system prompt; an unbounded transcript would get multiplied
 * across N parallel prompts and amplify token cost linearly in both
 * question count and active sub-agent count. We keep the most recent
 * questions (operators usually refine over time, latest is authoritative)
 * and trim per-entry question/answer text.
 */
const CLARIFICATION_MAX_ENTRIES = 30
const CLARIFICATION_QA_CHAR_CAP = 800

export function clarificationTranscriptSection(taskID: string): string {
  const rows = listInteractions(taskID).filter((interaction) => interaction.request_type === "question" && interaction.status === "answered")
    .map((interaction) => ({ request: interaction, response: interaction.response, resolvedAt: interaction.time_resolved }))
    .toSorted((left, right) => (left.resolvedAt ?? 0) - (right.resolvedAt ?? 0))
  if (rows.length === 0) return ""
  const entries: string[] = []
  const trim = (s: string) =>
    s.length > CLARIFICATION_QA_CHAR_CAP
      ? s.slice(0, CLARIFICATION_QA_CHAR_CAP) + `… [${s.length - CLARIFICATION_QA_CHAR_CAP} chars omitted]`
      : s
  for (const row of rows) {
    const payload = (row.request.payload ?? {}) as Record<string, unknown>
    const response = (row.response ?? {}) as Record<string, unknown>
    const questions = Array.isArray(payload.questions) ? payload.questions : []
    const rawAnswers = response.answers
    const answerList = Array.isArray(rawAnswers) ? rawAnswers : []
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i] as Record<string, unknown> | undefined
      const questionText = typeof q?.question === "string" ? q.question : ""
      if (!questionText) continue
      const raw = answerList[i]
      const answerText = Array.isArray(raw)
        ? raw.filter((item) => typeof item === "string" && item.trim()).join(", ")
        : typeof raw === "string"
          ? raw
          : ""
      entries.push(`- Q: ${trim(questionText)}\n  A: ${trim(answerText) || "(no answer)"}`)
    }
  }
  if (entries.length === 0) return ""
  // Keep the most recent N entries; transcripts are ordered ascending by
  // time_resolved so the tail is most recent. Drop older entries with an
  // explicit count so the operator sees the cap is biting.
  const omitted = entries.length - CLARIFICATION_MAX_ENTRIES
  const shown = omitted > 0 ? entries.slice(-CLARIFICATION_MAX_ENTRIES) : entries
  if (omitted > 0)
    shown.unshift(`- (${omitted} older Q&A entries omitted — they are superseded by the more recent ones below)`)
  return [
    "",
    "",
    "## Clarifications Already Answered",
    "",
    "The operator has already answered these questions for this task. Treat the answers",
    "as authoritative requirements. Do NOT ask the user again; build on them directly.",
    "",
    shown.join("\n"),
    "",
  ].join("\n")
}
