import { findDispatchLineageByToolExecution } from "./dispatch-lineage"
import { taskIDForSession } from "./task-session-lineage"
import { toolFailureCauseFromUnknown } from "@/session/tool-failure-cause"

export function executionInterruptionFailure(input: {
  sessionID: string
  messageID: string
  toolPartID: string
  toolCallID: string
  toolName: string
  error: unknown
  originSite: string
}) {
  const taskID = taskIDForSession(input.sessionID)
  const lineage =
    input.toolName === "dispatch_agent" && taskID
      ? findDispatchLineageByToolExecution({
          taskID,
          toolPartID: input.toolPartID,
          toolCallID: input.toolCallID,
        })
      : undefined
  return toolFailureCauseFromUnknown({
    error: input.error,
    originSite: input.originSite,
    classification: "llm-activity",
    kind: "process-execution-interrupted",
    data: {
      sessionID: input.sessionID,
      messageID: input.messageID,
      toolName: input.toolName,
      callID: input.toolCallID,
      ...(lineage
        ? {
            taskID: lineage.taskID,
            dispatchLineageID: lineage.artifactID,
            dispatchID: lineage.dispatchID,
            childSessionID: lineage.payload.child_session_id,
            workflowNodeID: lineage.payload.workflow_node_id,
            workflowOccurrenceID: lineage.payload.workflow_occurrence_id,
            occurrenceFact:
              "This logical dispatch occurrence already exists; do not issue another initial dispatch for it.",
          }
        : {}),
    },
  })
}
