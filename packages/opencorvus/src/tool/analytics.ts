import { Instance } from "@/project/instance"
import { Database, desc, eq, and, isNotNull, isNull, like, sql } from "@/storage/db"
import { EngineTaskTable, EngineGoalTable } from "@/engine"
import { deriveTaskStatus, isTaskActive, isTaskCompleted, isTaskFailed } from "@/engine/task-status"
import { Tool } from "./tool"
import z from "zod"

const DESCRIPTION = `Query orchestrator analytics for task history, completion rates, and performance metrics.

Actions:
- **summary**: Get aggregate statistics for the current project (total tasks, pass rate, median completion time).
- **search**: Search tasks by title/request text, status, or date range.
- **goal_stats**: Get current Delivery Slice contract statistics across all tasks.`

export const AnalyticsTool = Tool.define("analytics", {
  description: DESCRIPTION,
  parameters: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("summary"),
    }),
    z.object({
      action: z.literal("search"),
      query: z.string().optional().describe("Text to search in task title or request"),
      status: z.enum(["active", "completed", "failed", "cancelled"]).optional().describe("Filter by task status"),
      limit: z
        .number()
        .int()
        .positive()
        .default(20)
        .describe("Maximum number of matching task rows to return from the analytics search."),
    }),
    z.object({
      action: z.literal("goal_stats"),
    }),
  ]),
  async execute(args) {
    const projectID = Instance.project.id

    if (args.action === "summary") {
      const tasks = Database.use((db) =>
        db.select().from(EngineTaskTable).where(eq(EngineTaskTable.project_id, projectID)).all(),
      )
      const total = tasks.length
      const completed = tasks.filter(isTaskCompleted).length
      const failed = tasks.filter(isTaskFailed).length
      const running = tasks.filter(isTaskActive).length
      const blocked = 0

      // 计算完成时间中位数
      const durations = tasks
        .filter((t) => t.time_completed != null)
        .map((t) => t.time_completed! - t.time_started)
        .filter((d) => d > 0)
        .sort((a, b) => a - b)
      const median = durations.length > 0 ? durations[Math.floor((durations.length - 1) / 2)] : null

      return {
        title: "Project Analytics Summary",
        metadata: {},
        output: JSON.stringify(
          {
            total_tasks: total,
            completed,
            failed,
            running,
            blocked,
            pass_rate: total > 0 ? `${Math.round((completed / total) * 100)}%` : "N/A",
            median_completion_ms: median,
            median_completion_readable: median ? `${Math.round(median / 1000)}s` : "N/A",
          },
          null,
          2,
        ),
      }
    }

    if (args.action === "search") {
      const limit = args.limit
      const conditions = [eq(EngineTaskTable.project_id, projectID)]
      if (args.status) {
        // Phase-6-f-2: status column gone; translate to fact conditions.
        const cancelledMark = sql`json_extract(${EngineTaskTable.metadata}, '$.cancelled') = 1`
        switch (args.status) {
          case "active":
            conditions.push(isNull(EngineTaskTable.time_completed))
            break
          case "completed":
            conditions.push(isNotNull(EngineTaskTable.time_completed))
            conditions.push(isNull(EngineTaskTable.error))
            conditions.push(sql`(${cancelledMark}) IS NOT TRUE`)
            break
          case "failed":
            conditions.push(isNotNull(EngineTaskTable.time_completed))
            conditions.push(isNotNull(EngineTaskTable.error))
            conditions.push(sql`(${cancelledMark}) IS NOT TRUE`)
            break
          case "cancelled":
            conditions.push(cancelledMark)
            break
        }
      }
      if (args.query) conditions.push(like(EngineTaskTable.title, `%${args.query}%`))

      const tasks = Database.use((db) =>
        db
          .select()
          .from(EngineTaskTable)
          .where(and(...conditions))
          .orderBy(desc(EngineTaskTable.time_updated))
          .limit(limit)
          .all(),
      )

      const results = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: deriveTaskStatus(t),
        priority: t.priority,
        created: new Date(t.time_created).toISOString(),
        updated: new Date(t.time_updated).toISOString(),
        duration_ms: t.time_completed != null ? t.time_completed - t.time_started : null,
      }))

      return {
        title: `Found ${results.length} task(s)`,
        metadata: {},
        output: JSON.stringify(results, null, 2),
      }
    }

    if (args.action === "goal_stats") {
      const goals = Database.use((db) =>
        db
          .select()
          .from(EngineGoalTable)
          .innerJoin(EngineTaskTable, eq(EngineGoalTable.task_id, EngineTaskTable.id))
          .where(eq(EngineTaskTable.project_id, projectID))
          .all(),
      )
      const total = goals.length
      const blocking = goals.filter((g) => g.engine_goal.priority === "blocking").length
      const advisory = goals.filter((g) => g.engine_goal.priority === "advisory").length

      return {
        title: "Goal Statistics",
        metadata: {},
        output: JSON.stringify(
          {
            total_goals: total,
            blocking,
            advisory,
          },
          null,
          2,
        ),
      }
    }

    return { title: "Unknown action", metadata: {}, output: "Unknown analytics action" }
  },
})
