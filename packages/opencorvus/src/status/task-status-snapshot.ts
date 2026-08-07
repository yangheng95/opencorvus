import z from "zod"
import { TaskBoard } from "@/engine/model"
import { ProductPillarSchema } from "@opencorvus-ai/sdk/expert-squad-manifest-v1"

export const TaskActivityState = z.enum(["running", "inactive"])

export const TaskActivitySummary = z.object({
  total: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  inactive: z.number().int().nonnegative(),
})

export const TaskStatusGoalDetail = z.object({
  goalID: z.string(),
  deliverySliceID: TaskBoard.shape.goals.element.shape.deliverySliceID,
  deliverySliceRevisionID: TaskBoard.shape.goals.element.shape.deliverySliceRevisionID,
  revision: TaskBoard.shape.goals.element.shape.revision,
  title: z.string(),
  objective: z.string().optional(),
  orderIndex: z.number().int(),
  priority: z.enum(["blocking", "advisory"]),
  activity: TaskBoard.shape.goals.element.shape.activity,
  reviewAssociations: TaskBoard.shape.goals.element.shape.reviewAssociations,
  acceptance: TaskBoard.shape.goals.element.shape.acceptance,
})

export const TaskStatusDetail = z.object({
  taskID: z.string(),
  title: z.string(),
  status: TaskActivityState,
  lifecycleStatus: z.enum(["queued", "active", "completed", "failed", "cancelled"]),
  source: z.string(),
  productPillar: ProductPillarSchema,
  priority: z.enum(["critical", "high", "normal", "low"]),
  directory: z.string().optional(),
  error: z.string().optional(),
  activity: TaskActivitySummary,
  sessionInvocationTopology: TaskBoard.shape.sessionInvocationTopology,
  executionProjection: TaskBoard.shape.executionProjection,
  requirements: TaskBoard.shape.requirements,
  goals: TaskStatusGoalDetail.array(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
    started: z.number().optional(),
    completed: z.number().optional(),
  }),
})

export const MissionTaskCounts = z.object({
  total: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  inactive: z.number().int().nonnegative(),
})

export const MissionStatusSnapshot = z.object({
  missionID: z.string(),
  sessionID: z.string(),
  title: z.string(),
  directory: z.string(),
  productPillar: ProductPillarSchema,
  status: TaskActivityState,
  taskCounts: MissionTaskCounts,
  activity: TaskActivitySummary,
  tasks: TaskStatusDetail.array(),
  generatedAt: z.number(),
})

export type TaskActivityState = z.infer<typeof TaskActivityState>
export type TaskStatusDetail = z.infer<typeof TaskStatusDetail>
export type MissionStatusSnapshot = z.infer<typeof MissionStatusSnapshot>

const TaskStatusBoardProjection = z
  .object({
    task: TaskBoard.shape.task,
    sessionInvocationTopology: TaskBoard.shape.sessionInvocationTopology,
    executionProjection: TaskBoard.shape.executionProjection,
    requirements: TaskBoard.shape.requirements,
    goals: TaskBoard.shape.goals,
  })
  .passthrough()

export function activityFromTaskLifecycle(
  rawStatus: "queued" | "active" | "completed" | "failed" | "cancelled",
): TaskActivityState {
  return rawStatus === "active" ? "running" : "inactive"
}

function activitySummary(states: TaskActivityState[]): z.infer<typeof TaskActivitySummary> {
  const counts = states.reduce(
    (current, state) => {
      current[state] += 1
      return current
    },
    { running: 0, inactive: 0 },
  )
  return TaskActivitySummary.parse({
    total: states.length,
    ...counts,
  })
}

export function taskStatusDetailFromBoard(input: unknown): TaskStatusDetail {
  const board = TaskStatusBoardProjection.parse(input)
  const goals = board.goals.map((goal) =>
    TaskStatusGoalDetail.parse({
      goalID: goal.goalID,
      deliverySliceID: goal.deliverySliceID,
      deliverySliceRevisionID: goal.deliverySliceRevisionID,
      revision: goal.revision,
      title: goal.goalTitle,
      objective: goal.goalObjective,
      orderIndex: goal.orderIndex,
      priority: goal.priority,
      activity: goal.activity,
      reviewAssociations: goal.reviewAssociations,
      acceptance: goal.acceptance,
    }),
  )

  const activityStatus = activityFromTaskLifecycle(board.task.status)
  const activity = activitySummary([activityStatus])
  return TaskStatusDetail.parse({
    taskID: board.task.id,
    title: board.task.title,
    status: activityStatus,
    lifecycleStatus: board.task.status,
    source: board.task.source,
    productPillar: board.task.productPillar,
    priority: board.task.priority,
    directory: board.task.directory,
    error: board.task.error,
    activity,
    sessionInvocationTopology: board.sessionInvocationTopology,
    executionProjection: board.executionProjection,
    requirements: board.requirements,
    goals,
    time: board.task.time,
  })
}

export function missionStatusSnapshot(input: {
  missionID: string
  sessionID: string
  title: string
  directory: string
  productPillar: z.infer<typeof ProductPillarSchema>
  tasks: TaskStatusDetail[]
  generatedAt?: number
}): MissionStatusSnapshot {
  const taskCounts = input.tasks.reduce(
    (counts, task) => {
      counts.total += 1
      counts[task.status] += 1
      return counts
    },
    { total: 0, running: 0, inactive: 0 },
  )
  const activity = activitySummary(input.tasks.map((task) => task.status))
  const status: TaskActivityState = taskCounts.running > 0 ? "running" : "inactive"

  return MissionStatusSnapshot.parse({
    missionID: input.missionID,
    sessionID: input.sessionID,
    title: input.title,
    directory: input.directory,
    productPillar: input.productPillar,
    status,
    taskCounts,
    activity,
    tasks: input.tasks,
    generatedAt: input.generatedAt ?? Date.now(),
  })
}
