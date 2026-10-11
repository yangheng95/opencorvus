import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { controlTextSHA256 } from "@/orchestrator/dispatch-turn-projection"
import type { Session } from "@/session"
import { publishSettledSessionTerminalStatus } from "@/session/status-publication"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"

/** Real backend authority facts for a manually materialized worker report, without a Provider claim. */
export async function recordTestSettledWorkerReport(input: {
  taskID: string
  rootSessionID: string
  worker: Session.Info
  capability: Awaited<ReturnType<typeof PromptProfileResolver.resolveWorkerCapability>>
  inputMessageID: string
  controlPartID: string
  finalMessageID: string
  dispatchID: string
  workflowBinding: SelectedWorkflowBinding
  request: string
}) {
  const cap = input.capability
  const descriptor = WorkerTurnDescriptor.create({
    sessionID: input.worker.id,
    payload: {
      identity: cap.identity,
      expertSquadID: cap.expertSquadID,
      packageRevision: cap.packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test" },
      prompt: { systemMode: "complete", systemSha256: controlTextSHA256("Backend report authority fixture") },
      tools: {
        enabled: cap.builtInToolIDs,
        stageOwned: [],
        stageMaterializers: {},
        coordinationHandoff: "request_orchestrator_decision",
      },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID: input.taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: input.inputMessageID,
        control_text_parts: [{ part_id: input.controlPartID, text_sha256: controlTextSHA256(input.request) }],
      },
      dispatchTurn: {
        kind: "initial",
        current_dispatch_id: input.dispatchID,
        workflow_binding: input.workflowBinding,
        workflow_node_id: null,
        workflow_occurrence_id: input.dispatchID,
        delivery_slice_revision_ids: [],
        evidence_locators: [],
        task_authority: {
          task_id: input.taskID,
          root_session_id: input.rootSessionID,
          request_sha256: controlTextSHA256(input.request),
          initial_control_text_parts: [],
        },
      },
    },
  })
  const status = await publishSettledSessionTerminalStatus({
    session: input.worker,
    taskID: input.taskID,
    inputMessageID: input.inputMessageID,
    status: { type: "terminal", reason: "completed", final_message_id: input.finalMessageID },
  })
  return { descriptor, status }
}
