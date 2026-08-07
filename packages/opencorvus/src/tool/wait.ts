import { Tool } from "./tool"
import { Log } from "@/util/log"
import { createDecisionLog } from "@/decision-log"
import { AutomationService } from "@/scheduler/automation-service"
import { Instance } from "@/project/instance"
import { TOOL_RESULT_PARK_METADATA_KEY } from "@/session/tool-result-control"
import { WaitToolDescription, WaitToolParameters } from "./wait-contract"
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

  const scheduled = input.taskID
    ? await AutomationService.createTaskWake({
        name: "task wait",
        projectId: Instance.project.id,
        taskId: input.taskID,
        durationMs: input.duration_ms,
        reason: input.reason,
      })
    : await AutomationService.createDelayedSessionWake({
        name: "session wait",
        projectId: Instance.project.id,
        sessionId: input.sessionID,
        durationMs: input.duration_ms,
        surface: input.surface,
        prompt: [
          "Scheduled wait completed.",
          `Requested delay: ${input.duration_ms}ms.`,
          `Reason: ${input.reason}`,
          "Continue from the current visible conversation state.",
        ].join("\n"),
      })
  const mode = input.taskID ? "task" : "session"
  if (input.taskID) {
    createDecisionLog(input.taskID).append({
      phase: input.logPhase ?? "wait",
      key: `wait_${Date.now()}`,
      value: `scheduled wait ${input.duration_ms}ms automation=${scheduled.id}`,
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
  const output =
    `Scheduled nonblocking ${mode} wait ${scheduled.id} for ${new Date(scheduled.nextRun).toISOString()} ` +
    `(requested ${input.duration_ms}ms). Reason: ${input.reason}. End this turn unless another real scheduler decision is immediately responsible; the scheduled wake will re-read current evidence.`
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
  async execute(params, ctx) {
    const taskID = typeof ctx.extra?.taskID === "string" ? ctx.extra.taskID : undefined
    const result = await executeWait({
      duration_ms: params.duration_ms,
      reason: params.reason,
      signal: ctx.abort,
      sessionID: ctx.sessionID,
      taskID,
      logPhase: taskID ? "agent" : undefined,
      surface: typeof ctx.extra?.surface === "string" ? ctx.extra.surface : undefined,
    })
    return {
      title: result.aborted ? "Wait Not Scheduled" : "Wait Scheduled",
      output: result.output,
      metadata: {
        requestedMs: params.duration_ms,
        aborted: result.aborted,
        jobID: result.jobID,
        nextRun: result.nextRun,
        mode: result.mode,
        nonblocking: true,
        ...(result.aborted ? {} : { [TOOL_RESULT_PARK_METADATA_KEY]: true }),
      },
    }
  },
})
