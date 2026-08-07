import { Database, eq } from "@/storage/db"
import { TaskPlanTable } from "./task-plan.sql"
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import z from "zod"

/**
 * Hierarchical task planner.
 *
 * Provides structured goal decomposition with parent-child relationships.
 * Tasks can be nested (subtasks), have status tracking, and progress indicators.
 */
export namespace TaskPlan {
  const log = Log.create({ service: "task-plan" })

  export type Status = "pending" | "in_progress" | "completed" | "blocked" | "cancelled"

  export interface Task {
    id: string
    sessionID: string
    parentID: string | null
    goal: string
    status: Status
    priority: number
    notes: string | null
    progressPct: number
    timeCreated: number
    timeUpdated: number
  }

  export const Event = {
    Updated: BusEvent.define(
      "task_plan.updated",
      z.object({
        task: z.object({
          id: z.string(),
          sessionID: z.string(),
          goal: z.string(),
          status: z.string(),
        }),
      }),
    ),
  }

  function fromRow(row: typeof TaskPlanTable.$inferSelect): Task {
    return {
      id: row.id,
      sessionID: row.session_id,
      parentID: row.parent_id,
      goal: row.goal,
      status: row.status as Status,
      priority: row.priority,
      notes: row.notes,
      progressPct: row.progress_pct,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  }

  export function add(input: { sessionID: string; parentID?: string; goal: string; priority?: number }): Task {
    const id = Identifier.ascending("task")
    Database.use((db) =>
      db
        .insert(TaskPlanTable)
        .values({
          id,
          session_id: input.sessionID,
          parent_id: input.parentID ?? null,
          goal: input.goal,
          priority: input.priority ?? 0,
        })
        .run(),
    )
    const task = get(id)!
    log.info("task added", { id, goal: input.goal })
    Bus.publish(Event.Updated, {
      task: { id, sessionID: input.sessionID, goal: input.goal, status: "pending" },
    })
    return task
  }

  export function get(taskID: string): Task | null {
    const row = Database.use((db) => db.select().from(TaskPlanTable).where(eq(TaskPlanTable.id, taskID)).get())
    return row ? fromRow(row) : null
  }

  export function update(
    taskID: string,
    changes: Partial<Pick<Task, "status" | "notes" | "progressPct" | "goal" | "priority">>,
  ): Task | null {
    const existing = get(taskID)
    if (!existing) return null

    const set: Record<string, unknown> = {}
    if (changes.status !== undefined) set.status = changes.status
    if (changes.notes !== undefined) set.notes = changes.notes
    if (changes.progressPct !== undefined) set.progress_pct = changes.progressPct
    if (changes.goal !== undefined) set.goal = changes.goal
    if (changes.priority !== undefined) set.priority = changes.priority

    if (Object.keys(set).length > 0) {
      Database.use((db) => db.update(TaskPlanTable).set(set).where(eq(TaskPlanTable.id, taskID)).run())
    }

    const updated = get(taskID)!
    log.info("task updated", { id: taskID, changes })
    Bus.publish(Event.Updated, {
      task: {
        id: taskID,
        sessionID: updated.sessionID,
        goal: updated.goal,
        status: updated.status,
      },
    })
    return updated
  }

  export function remove(taskID: string): void {
    // Also removes child tasks via cascade or manual cleanup
    Database.use((db) => db.delete(TaskPlanTable).where(eq(TaskPlanTable.id, taskID)).run())
    log.info("task removed", { id: taskID })
  }

  export function list(sessionID: string): Task[] {
    const rows = Database.use((db) =>
      db.select().from(TaskPlanTable).where(eq(TaskPlanTable.session_id, sessionID)).all(),
    )
    return rows.map(fromRow)
  }

  /**
   * Build a tree of tasks and render as markdown.
   * Returns null if no tasks exist for this session.
   */
  export function toMarkdown(sessionID: string): string | null {
    const tasks = list(sessionID)
    if (tasks.length === 0) return null

    // Build parent→children map
    const childrenMap = new Map<string | null, Task[]>()
    for (const task of tasks) {
      const key = task.parentID
      if (!childrenMap.has(key)) childrenMap.set(key, [])
      childrenMap.get(key)!.push(task)
    }

    // Sort children by priority (descending) then creation time
    for (const [, children] of childrenMap) {
      children.sort((a, b) => b.priority - a.priority || a.timeCreated - b.timeCreated)
    }

    const lines: string[] = ["<task-plan>"]
    renderTree(null, 0, childrenMap, lines)
    lines.push("</task-plan>")
    lines.push("")
    lines.push("Use the planner tool to update task status, add subtasks, or modify the plan.")

    return lines.join("\n")
  }

  function renderTree(
    parentID: string | null,
    depth: number,
    childrenMap: Map<string | null, Task[]>,
    lines: string[],
  ): void {
    const children = childrenMap.get(parentID)
    if (!children) return

    for (const task of children) {
      const indent = "  ".repeat(depth)
      const icon = statusIcon(task.status)
      const progress = task.progressPct > 0 && task.progressPct < 100 ? ` (${task.progressPct}%)` : ""
      const notes = task.notes ? ` — ${task.notes}` : ""
      lines.push(`${indent}${icon} ${task.goal}${progress}${notes} [${task.id}]`)
      renderTree(task.id, depth + 1, childrenMap, lines)
    }
  }

  function statusIcon(status: Status): string {
    switch (status) {
      case "pending":
        return "[ ]"
      case "in_progress":
        return "[~]"
      case "completed":
        return "[x]"
      case "blocked":
        return "[!]"
      case "cancelled":
        return "[-]"
    }
  }
}
