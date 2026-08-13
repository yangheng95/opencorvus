import z from "zod"
import { EvidenceLocatorListSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { createAgentCoordinationRequest } from "@/engine/agent-coordination"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { Session } from "@/session"
import { validateSessionRuntimeContractForContinuation } from "@/session/runtime-contract-validation"
import { materializeProjectedWorkerBinding } from "@/agent/projected-worker-binding"
import { Tool } from "./tool"
import { withHandoffDrainToolResultControl } from "@/session/tool-result-control"

const RequestOrchestratorDecisionInput = z
  .object({
  summary: z.string().min(1).describe("Short human-readable summary of the scheduling issue."),
  details: z.string().min(1).describe("Concrete evidence and context the orchestrator must decide from."),
  blocking: z.boolean().describe("True when the worker cannot responsibly continue this turn without a decision."),
  requested_decision: z
    .string()
    .min(1)
    .describe(
      "The scheduling question the orchestrator must answer. Do not use response action literals such as redispatch or redispatch_worker here.",
    ),
  evidence_locators: EvidenceLocatorListSchema
    .optional()
    .describe(
      "Exact typed evidence locators. A session_message locator must pair the Message with its actual producing Session; never combine the current worker Session with a Message from another Session. Use Engine/Task Artifact, Session/Message, Delivery Slice revision, or coordination-request locators; raw IDs, paths, and artifact:<id> display strings are invalid.",
    ),
  severity: z.enum(["info", "blocked", "failure"]).optional(),
  })
  .strict()

type RequestOrchestratorDecisionParams = z.infer<typeof RequestOrchestratorDecisionInput>
export async function executeRequestOrchestratorDecision(params: RequestOrchestratorDecisionParams, ctx: Tool.Context) {
  params = RequestOrchestratorDecisionInput.parse(params)
  const executionAuthority = Tool.requireExecutionAuthority(ctx)
  if (executionAuthority.kind !== "task") {
    throw new Error("request_orchestrator_decision requires explicit Task execution authority")
  }
  const taskID = executionAuthority.taskID
  if (!ctx.callID?.trim()) {
    throw new Error("request_orchestrator_decision requires the current tool-call identity")
  }
  const session = await Session.get(ctx.sessionID)
  const runtimeContract = validateSessionRuntimeContractForContinuation({
    sessionID: ctx.sessionID,
    expectedSessionKind: session.kind,
    expectedAgentID: ctx.agent,
    requireRuntimeContract: true,
    requireWorkerTurnDescriptor: true,
  })
  if (!runtimeContract || runtimeContract.identity.identityKind !== "projected-worker") {
    throw new Error(`request_orchestrator_decision requires a projected worker runtime for ${ctx.sessionID}`)
  }
  const workerBinding = materializeProjectedWorkerBinding({
    identity: runtimeContract.identity,
    expertSquadID: runtimeContract.identity.expertSquadID,
    workerTurnDescriptorID: runtimeContract.identity.workerTurnDescriptorID,
    workerTurnDescriptorHash: runtimeContract.identity.workerTurnDescriptorHash,
  })
  const owningTask = taskIDForSession(ctx.sessionID)
  if (owningTask && owningTask !== taskID) {
    throw new Error(
      `request_orchestrator_decision session ${ctx.sessionID} belongs to task ${owningTask}, not ${taskID}`,
    )
  }
  const row = await createAgentCoordinationRequest({
    taskID,
    sessionID: ctx.sessionID,
    agent: ctx.agent,
    workerBinding,
    messageID: ctx.messageID,
    callID: ctx.callID,
    summary: params.summary,
    details: params.details,
    blocking: params.blocking,
    requestedDecision: params.requested_decision,
    evidenceLocators: params.evidence_locators,
    severity: params.severity,
  })
  const dispatchLineageID = row.payload.dispatch_lineage_id
  if (row.payload.origin !== "worker_handoff" || !dispatchLineageID) {
    throw new Error(`request_orchestrator_decision ${row.payload.request_id} has no worker dispatch lineage`)
  }

  if (!row.createdNow) {
    return {
      title: "coordination request",
      output: JSON.stringify({
        coordination_request: {
          source: "coordination_request",
          request_id: row.payload.request_id,
        },
        task_id: taskID,
        session_id: ctx.sessionID,
        blocking: row.payload.blocking,
        replayed: true,
        completion: "coordination_handoff",
        message:
          "Existing coordination request returned for this message replay. No duplicate orchestrator wake emitted.",
      }),
      metadata: withHandoffDrainToolResultControl({
        requestID: row.payload.request_id,
        taskID,
        sessionID: ctx.sessionID,
      }, { requestID: row.payload.request_id, dispatchLineageID }),
    }
  }

  return {
    title: "coordination request",
    output: JSON.stringify({
      coordination_request: {
        source: "coordination_request",
        request_id: row.payload.request_id,
      },
      task_id: taskID,
      session_id: ctx.sessionID,
      blocking: params.blocking,
      completion: "coordination_handoff",
      message:
        "Coordination request recorded. This worker turn is handing control back through its immutable dispatch lineage.",
    }),
    metadata: withHandoffDrainToolResultControl({
      requestID: row.payload.request_id,
      taskID,
      sessionID: ctx.sessionID,
    }, { requestID: row.payload.request_id, dispatchLineageID }),
  }
}

export const RequestOrchestratorDecisionTool = Tool.define("request_orchestrator_decision", {
  description: `Create a visible worker-to-orchestrator coordination request for the current task.

Use this when you need the orchestrator to choose scheduling, scope, retry, cancellation, or user-question policy. The request is persisted as a typed coordination handoff and the current dispatch returns it synchronously to the owning orchestrator. Do not continue the worker turn afterward.

Do not use task messages, hidden notes, or a new subtask chat to ask the orchestrator for a decision.`,
  parameters: RequestOrchestratorDecisionInput,
  executionMode: "turn_control_exclusive",
  async execute(params, ctx) {
    return executeRequestOrchestratorDecision(params, ctx)
  },
})
