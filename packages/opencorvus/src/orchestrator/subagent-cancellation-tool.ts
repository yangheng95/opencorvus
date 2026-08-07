import { tool } from "ai"
import z from "zod"
import { SessionRuntimeContractStore, type ProjectedWorkerRuntimeContract } from "@/session/runtime-contract"
import { cancelDispatchedSession } from "./subagent-cancellation-runtime"

export function createSubagentCancellationTool(input: {
  taskID: string
  assertDirectReplySessionLineage: (input: { taskID: string; sessionID: string }) => {
    kind: string
    baseRole: string
    runtimeContract: ProjectedWorkerRuntimeContract
  }
}) {
  const { taskID } = input
  return {
    cancel_subagent: tool({
      description:
        "Request cancellation of one exact child agent Session when explicit cancellation evidence requires it. " +
        "The Session prompt controller and terminal Session status are the only execution-control facts. " +
        "Pending durable coordination requests remain visible facts and do not replace the exact session_id.",
      inputSchema: z
        .object({
          session_id: z.string().min(1).describe("Exact child agent Session ID to cancel."),
          reason: z.string().min(1).describe("Why this exact child Session must be cancelled."),
        })
        .strict(),
      execute: async ({ session_id, reason }, { toolCallId }) => {
        const { kind, runtimeContract } = input.assertDirectReplySessionLineage({
          taskID,
          sessionID: session_id,
        })
        using _runtimeContractOwnership = SessionRuntimeContractStore.claimOperation(
          session_id,
          runtimeContract,
          "sub-agent cancellation",
        )
        const cancellation = await cancelDispatchedSession({
          taskID,
          sessionID: session_id,
          reason,
          reasonPrefix: "cancel_subagent",
          requestID: toolCallId,
        })
        return (
          `Cancellation requested for dispatch_agent session ${session_id} (kind=${kind}). Reason: ${reason}.` +
          cancellation.summary +
          " If more work is required, dispatch the exact projected agent explicitly."
        )
      },
    }),
  }
}
