import { withImmediateParkToolResultControl } from "@/session/tool-result-control"

export function completedWaitToolResult(input: {
  requestedMs: number
  reason: string
  jobID: string
  nextRun: number
  mode: "task" | "session"
}) {
  const output =
    `Scheduled nonblocking ${input.mode} wait ${input.jobID} for ${new Date(input.nextRun).toISOString()} ` +
    `(requested ${input.requestedMs}ms). Reason: ${input.reason}. End this turn unless another real scheduler ` +
    `decision is immediately responsible; the scheduled wake will re-read current evidence.`
  return {
    title: "Wait Scheduled",
    output,
    metadata: withImmediateParkToolResultControl({
      requestedMs: input.requestedMs,
      aborted: false,
      jobID: input.jobID,
      nextRun: input.nextRun,
      mode: input.mode,
      nonblocking: true,
      truncated: false,
    }),
  }
}
