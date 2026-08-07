import z from "zod"
import { Tool } from "./tool"
import { TaskPlan } from "@/memory/task-plan"

/**
 * Planner tool — task decomposition and progress tracking.
 */
const DESCRIPTION = `Task planner for complex multi-step goals.

**Task Planning** — decompose goals into a tree of subtasks, track status and progress:
- **add_task**: Create a task (optionally as a subtask of an existing task)
- **update_task**: Change task status, notes, or progress
- **list_tasks**: View all tasks for this session`

export const PlannerTool = Tool.define("planner", {
  description: DESCRIPTION,
  parameters: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("add_task"),
      goal: z.string().describe("What this task should accomplish"),
      parentId: z.string().optional().describe("Parent task ID for subtasks"),
      priority: z.coerce.number().int().min(0).max(10).optional().describe("Priority 0-10 (higher = more important)"),
    }),
    z.object({
      action: z.literal("update_task"),
      taskId: z.string().describe("Task ID to update"),
      status: z
        .enum(["pending", "in_progress", "completed", "blocked", "cancelled"])
        .describe("Lifecycle state to assign to the task after this update.")
        .optional(),
      notes: z.string().optional().describe("Update task notes"),
      progressPct: z.coerce.number().int().min(0).max(100).optional().describe("Progress percentage 0-100"),
    }),
    z.object({
      action: z.literal("list_tasks"),
    }),
  ]),
  async execute(params, ctx) {
    const sessionID = ctx.sessionID

    await ctx.ask({
      permission: "planner",
      patterns: ["*"],
      always: ["*"],
      metadata: { action: params.action },
    })

    switch (params.action) {
      case "add_task": {
        const task = TaskPlan.add({
          sessionID,
          parentID: params.parentId,
          goal: params.goal,
          priority: params.priority,
        })
        return {
          title: `Task added: ${params.goal.slice(0, 50)}`,
          output: JSON.stringify({
            id: task.id,
            goal: task.goal,
            parentID: task.parentID,
            status: task.status,
          }),
          metadata: {},
        }
      }

      case "update_task": {
        const updated = TaskPlan.update(params.taskId, {
          status: params.status,
          notes: params.notes,
          progressPct: params.progressPct,
        })
        if (!updated) {
          return {
            title: "Task not found",
            output: JSON.stringify({ error: `Task ${params.taskId} not found` }),
            metadata: {},
          }
        }
        return {
          title: `Updated: ${updated.goal.slice(0, 50)}`,
          output: JSON.stringify({
            id: updated.id,
            goal: updated.goal,
            status: updated.status,
            progressPct: updated.progressPct,
            notes: updated.notes,
          }),
          metadata: {},
        }
      }

      case "list_tasks": {
        const tasks = TaskPlan.list(sessionID)
        const markdown = TaskPlan.toMarkdown(sessionID)
        return {
          title: `${tasks.length} tasks`,
          output: JSON.stringify({
            count: tasks.length,
            tree: markdown ?? "(no tasks)",
            tasks: tasks.map((t) => ({
              id: t.id,
              goal: t.goal,
              status: t.status,
              parentID: t.parentID,
              progressPct: t.progressPct,
              notes: t.notes,
            })),
          }),
          metadata: {},
        }
      }

    }
  },
})
