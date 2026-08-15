import { Identifier } from "@/id/id"
import { Memory } from "@/memory"
import { parseAcceptanceSpecs, renderSpecsAsText } from "@/acceptance/types"
import { Database, eq } from "@/storage/db"
import { EngineGoalTable, EngineTaskTable } from "@/engine"
import { findTask, listCurrentGoals, type TaskRow } from "@/engine/store"
import { WorkbenchBriefSnapshotTable } from "./workbench.sql"

const BRIEF_VERSION = "brief-v2"

export function compileBrief(input: { taskID: string; sessionID?: string }) {
  const task = findTask(input.taskID)
  if (!task) throw new Error(`Task not found: ${input.taskID}`)
  const goals = listCurrentGoals(task.id)
  const signature = briefSignature({
    task,
    goals,
    prefs: [],
  })
  const snapshot = Database.use((db) =>
    db
      .select()
      .from(WorkbenchBriefSnapshotTable)
      .where(eq(WorkbenchBriefSnapshotTable.task_id, task.id))
      .orderBy(WorkbenchBriefSnapshotTable.time_created)
      .all()
      .at(-1),
  )
  if (snapshot?.inputs?.signature === signature) {
    return {
      content: snapshot.content,
      updatedAt: snapshot.time_created,
      goals,
    }
  }

  const memory = recallMemory(task)
  const content = [
    "<assistant-brief>",
    `Task: ${task.title}`,
    `Request: ${task.request}`,
    [
      "Git workflow:",
      "- The workspace is auto-managed with git when needed.",
      "- A startup checkpoint is captured before the first execution run.",
      "- The orchestrator may record internal checkpoint commits automatically.",
      "- Do not create extra user-facing commits unless explicitly requested.",
      "- If you do create a commit, use a concise, meaningful message grounded in the task request and plan.",
    ].join("\n"),
    goals.length > 0
      ? "Goals:\n" +
        goals
          .map(
            (goal) =>
              `- ${goal.title} (acceptance:\n${renderSpecsAsText(parseAcceptanceSpecs(goal.acceptance_specs, `engine_goal(${goal.id}).acceptance_specs`))}${
                Array.isArray((goal.metadata as Record<string, unknown> | null | undefined)?.check_selector)
                  ? `; checks: ${(((goal.metadata as Record<string, unknown>).check_selector as unknown[]) ?? [])
                      .filter((item): item is string => typeof item === "string")
                      .join(", ")}`
                  : ""
              })`,
          )
          .join("\n")
      : "",
    memory.length > 0
      ? "Relevant memory:\n" +
        memory.map((item) => `- [${item.scope}] ${item.fileTitle}: ${item.content.slice(0, 200)}`).join("\n")
      : "",
    "</assistant-brief>",
    "Use the brief above to align your work before executing the task.",
  ]
    .filter(Boolean)
    .join("\n\n")

  const now = Date.now()
  Database.use((db) =>
    db
      .insert(WorkbenchBriefSnapshotTable)
      .values({
        id: Identifier.ascending("brief"),
        task_id: task.id,
        content,
        inputs: {
          signature,
          template: BRIEF_VERSION,
          memory: memory.length,
        },
        time_created: now,
        time_updated: now,
      })
      .run(),
  )

  return {
    content,
    updatedAt: now,
    goals,
  }
}

function briefSignature(input: {
  task: TaskRow
  goals: Array<typeof EngineGoalTable.$inferSelect>
  prefs: unknown[]
}) {
  const goalUpdated = input.goals.reduce((max, item) => Math.max(max, item.time_updated), 0)
  return [
    input.task.id,
    input.task.time_updated,
    input.goals.length,
    goalUpdated,
  ].join("|")
}

function recallMemory(task: typeof EngineTaskTable.$inferSelect) {
  const query = [task.title, task.request]
    .join(" ")
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .split(/\s+/)
    .filter((item) => item.length > 2)
    .slice(0, 6)
    .join(" ")
  if (!query) return []
  const primary = Memory.recall({
    query,
    projectId: task.project_id,
    limit: 5,
  })
  const requestLine = task.request.split("\n").find(Boolean)?.trim()
  if (!requestLine || requestLine === query) return primary
  const secondary = Memory.recall({
    query: requestLine.slice(0, 120),
    projectId: task.project_id,
    limit: 3,
  })
  const seen = new Set(primary.map((item) => item.chunkId))
  for (const item of secondary) {
    if (!seen.has(item.chunkId)) {
      primary.push(item)
      seen.add(item.chunkId)
    }
  }
  return primary.slice(0, 8)
}
