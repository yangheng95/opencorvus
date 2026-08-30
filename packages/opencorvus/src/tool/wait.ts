import { Tool } from "./tool"
import { Log } from "@/util/log"
import { createDecisionLog } from "@/decision-log"
import { createDelayedSessionWake } from "@/scheduler/delayed-wake-schedule"
import { Instance } from "@/project/instance"
import { WaitToolDescription, WaitToolParameters } from "./wait-contract"
import { completedWaitToolResult } from "./wait-result"
import { createTaskWait, type TaskWaitToolOccurrence } from "@/engine/task-wait"
export { WAIT_MAX_MS, WAIT_MIN_MS, WaitToolDescription, WaitToolParameters } from "./wait-contract"

const log = Log.create({ service: "wait-tool" })

export async function executeWait(input: {
  duration_ms: number
  reason: string
  signal?: AbortSignal
  sessionID: string
  taskID?: string
  logPhase?: string
  surface?: string
  occurrence: TaskWaitToolOccurrence
}): Promise<{
  requestedMs: number
  aborted: boolean
  jobID?: string
  nextRun?: number
  mode?: "task" | "session"
  output: string
}> {
  if (input.signal?.aborted) {
    const output = `wait was not scheduled because the current execution was already aborted. Reason: ${input.reason}`
    return { requestedMs: input.duration_ms, aborted: true, output }
  }

  let scheduled: { id: string; name: string; nextRun: number }
  if (input.taskID) {
    const wait = createTaskWait({
        projectID: Instance.project.id,
        taskID: input.taskID,
        durationMs: input.duration_ms,
        reason: input.reason,
        occurrence: input.occurrence,
      })
    scheduled = { id: wait.id, name: "task wait", nextRun: wait.dueAt }
  } else {
    scheduled = await createDelayedSessionWake({
        name: "session wait",
        projectId: Instance.project.id,
        sessionId: input.sessionID,
        durationMs: input.duration_ms,
        surface: input.surface,
        occurrence: input.occurrence,
        prompt: [
          "Scheduled wait completed.",
          `Requested delay: ${input.duration_ms}ms.`,
          `Reason: ${input.reason}`,
          "Continue from the current visible conversation state.",
        ].join("\n"),
      })
  }
  const mode = input.taskID ? "task" : "session"
  if (input.taskID) {
    createDecisionLog(input.taskID).append({
      phase: input.logPhase ?? "wait",
      key: `wait_${Date.now()}`,
      value: `scheduled wait ${input.duration_ms}ms occurrence=${scheduled.id}`,
      reason: input.reason,
    })
  }
  log.info("wait scheduled", {
    taskID: input.taskID,
    sessionID: input.sessionID,
    requestedMs: input.duration_ms,
    jobID: scheduled.id,
    nextRun: scheduled.nextRun,
    mode,
  })
  const output = completedWaitToolResult({
    requestedMs: input.duration_ms,
    reason: input.reason,
    jobID: scheduled.id,
    nextRun: scheduled.nextRun,
    mode,
  }).output
  return {
    requestedMs: input.duration_ms,
    aborted: false,
    jobID: scheduled.id,
    nextRun: scheduled.nextRun,
    mode,
    output,
  }
}

export const WaitTool = Tool.define("wait", {
  description: WaitToolDescription,
  parameters: WaitToolParameters,
  executionMode: "turn_control_exclusive",
  async execute(params, ctx) {
    const executionAuthority = Tool.requireExecutionAuthority(ctx)
    const taskID = executionAuthority.kind === "task" ? executionAuthority.taskID : undefined
    const toolPartID = typeof ctx.extra?.toolPartID === "string" ? ctx.extra.toolPartID : ""
    const toolCallID = ctx.callID ?? ""
    if (!toolPartID || !toolCallID) throw new Error("wait requires an exact persisted Tool request occurrence")
    const result = await executeWait({
      duration_ms: params.duration_ms,
      reason: params.reason,
      signal: ctx.abort,
      sessionID: ctx.sessionID,
      taskID,
      logPhase: taskID ? "agent" : undefined,
      surface: typeof ctx.extra?.surface === "string" ? ctx.extra.surface : undefined,
      occurrence: {
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        toolPartID,
        toolCallID,
      },
    })
    if (!result.aborted && result.jobID && result.nextRun && result.mode) {
      return completedWaitToolResult({
        requestedMs: params.duration_ms,
        reason: params.reason,
        jobID: result.jobID,
        nextRun: result.nextRun,
        mode: result.mode,
      })
    }
    return {
      title: "Wait Not Scheduled",
      output: result.output,
      metadata: {
        requestedMs: params.duration_ms,
        aborted: result.aborted,
        jobID: result.jobID,
        nextRun: result.nextRun,
        mode: result.mode,
        nonblocking: true,
      },
    }
  },
})
