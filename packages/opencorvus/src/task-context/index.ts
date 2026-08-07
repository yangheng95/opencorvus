/**
 * TaskContext — a point-in-time projection of durable Task facts.
 *
 * Stage agents (intent-analysis / requirements / frontend-design / architect /
 * integrity / build / visual-qa) used to start with a static system prompt
 * (`prompt/core/<kind>-core.txt`) that knew nothing about prior phases. The
 * benchmark caught the consequence: each agent's first move was a 14-48s
 * memory.search loop using task-title keywords as queries against an empty
 * temp home — pure waste, because the data the agent actually needed was
 * sitting in `engine_task` columns and the decision-log all along.
 *
 * This module pulls that data into a single markdown block injected at the
 * tail of every stage agent's system prompt by `agent/runner.ts`. One source
 * of truth (rule 22): the same DB rows the orchestrator already writes.
 */
import { Database, eq } from "@/storage/db"
import { EngineTaskTable, EngineGoalTable } from "@/engine/engine.sql"
import { Log } from "@/util/log"
import { createDecisionLog } from "@/decision-log"
import { renderUserRequestSection } from "@/intent/request-prompt"
import { parseAcceptanceSpecs } from "@/acceptance/types"

const log = Log.create({ service: "task-context" })

const RECENT_DECISION_LIMIT = 20
const VALUE_CAP_BYTES = 400

export namespace TaskContext {
  /**
   * Build a markdown block summarising the durable facts for `taskID`. Returns
   * an empty string when the task is unknown — the caller (runner) is
   * expected to inject the result unconditionally; an empty string is a no-op.
   */
  export function snapshot(taskID: string): string {
    if (!taskID) return ""

    const task = Database.use((db) => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get())
    if (!task) {
      log.warn("snapshot: task not found", { taskID })
      return ""
    }

    const goals = Database.use((db) =>
      db
        .select()
        .from(EngineGoalTable)
        .where(eq(EngineGoalTable.task_id, taskID))
        .orderBy(EngineGoalTable.order_index)
        .all(),
    )

    const decisionLog = createDecisionLog(taskID)
    const decisions = decisionLog.read()
    const recentDecisions = decisions.slice(-RECENT_DECISION_LIMIT)
    const clarifiedRequest = [...decisions]
      .reverse()
      .find((entry) => entry.phase === "intent_analysis" && entry.key === "intent_clarified_user_request")

    const sections: string[] = []

    sections.push("## Task Context")
    sections.push("")
    sections.push(`**Title**: ${task.title}`)
    if (task.request) {
      sections.push(renderUserRequestSection({ heading: "### Request", request: String(task.request), taskID }))
    }
    if (clarifiedRequest?.value.trim()) {
      sections.push("")
      sections.push("### Clarified Request")
      sections.push("")
      sections.push(
        "Use this clarified request for downstream scope decisions. The original request above remains the audit source.",
      )
      sections.push("")
      sections.push(clarifiedRequest.value)
    }

    const attachments = Array.isArray(task.attachments) ? task.attachments : []
    if (attachments.length > 0) {
      sections.push(`**Attachments**: ${attachments.length}`)
    }

    if (goals.length > 0) {
      sections.push("")
      sections.push(`### Goals (${goals.length})`)
      for (const goal of goals) {
        const accept = parseAcceptanceSpecs(goal.acceptance_specs, `engine_goal ${goal.id}.acceptance_specs`).length
        const objective = String(goal.objective ?? "").slice(0, 200)
        sections.push(
          `- **${goal.id}** ${goal.title} — ${objective}` +
            (accept > 0 ? ` (${accept} acceptance specs)` : ""),
        )
      }
    }

    if (recentDecisions.length > 0) {
      sections.push("")
      sections.push(`### Decision Log (latest ${recentDecisions.length})`)
      for (const entry of recentDecisions) {
        const value = entry.value.slice(0, VALUE_CAP_BYTES)
        const goalSuffix = entry.goalID ? ` @${entry.goalID}` : ""
        sections.push(`- *${entry.phase}*${goalSuffix} **${entry.key}**: ${value}`)
      }
    }

    return sections.join("\n")
  }
}
