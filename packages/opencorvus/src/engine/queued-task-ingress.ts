import z from "zod"
import { OrchestratorEventSchema, TaskIntentSchema, type OrchestratorEvent } from "@/orchestrator/event"

export const TerminalIngressResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("completed"),
      assistant_message_id: z.string().min(1),
      time_completed: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      status: z.literal("passive_delivered"),
      time_completed: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      status: z.literal("terminal_inapplicable"),
      reason: z.string().min(1),
      time_completed: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      status: z.literal("delivery_failed"),
      error_name: z.string().min(1),
      message: z.string().min(1),
      time_completed: z.number().int().positive(),
    })
    .strict(),
])

export type TerminalIngressResult = z.infer<typeof TerminalIngressResultSchema>

export function sameTerminalIngressResult(left: TerminalIngressResult, right: TerminalIngressResult): boolean {
  if (left.status !== right.status) return false
  if (left.status === "completed" && right.status === "completed") {
    return left.assistant_message_id === right.assistant_message_id && left.time_completed === right.time_completed
  }
  if (left.status === "passive_delivered" && right.status === "passive_delivered") {
    return left.time_completed === right.time_completed
  }
  if (left.status === "terminal_inapplicable" && right.status === "terminal_inapplicable") {
    return left.reason === right.reason && left.time_completed === right.time_completed
  }
  if (left.status === "delivery_failed" && right.status === "delivery_failed") {
    return (
      left.error_name === right.error_name &&
      left.message === right.message &&
      left.time_completed === right.time_completed
    )
  }
  return false
}

const CommonShape = {
  wake_id: z.string().min(1),
  delivery_attempt: z.number().int().positive(),
  task_id: z.string().min(1),
  root_session_id: z.string().min(1),
  time_queued: z.number().int().nonnegative(),
  queued_by_process_id: z.number().int().nonnegative(),
  queued_by_instance_directory: z.string().optional(),
  queued_by_project_id: z.string().optional(),
  delivery_result: TerminalIngressResultSchema.optional(),
}

const NoteShape = { note: z.string().optional() }

const OperatorMessage = z
  .object({
    ...CommonShape,
    source_kind: z.literal("operator_message"),
    message_id: z.string().min(1),
    event: z
      .object({
        ...NoteShape,
        rootMessage: z.object({ messageID: z.string().min(1), kind: z.literal("operator") }).strict(),
      })
      .strict(),
  })
  .strict()

const OrchestratorMessage = z
  .object({
    ...CommonShape,
    source_kind: z.literal("orchestrator_message"),
    message_id: z.string().min(1),
    event: z
      .object({
        ...NoteShape,
        rootMessage: z.object({ messageID: z.string().min(1), kind: z.literal("orchestrator") }).strict(),
      })
      .strict(),
  })
  .strict()

const OperatorIntent = z
  .object({
    ...CommonShape,
    source_kind: z.literal("operator_intent"),
    event: z.object({ ...NoteShape, taskIntent: TaskIntentSchema }).strict(),
  })
  .strict()

const MissionAcceptanceResume = z
  .object({
    ...CommonShape,
    source_kind: z.literal("mission_acceptance_resume"),
    message_id: z.string().min(1),
    event: z
      .object({
        ...NoteShape,
        missionAcceptanceResume: OrchestratorEventSchema.shape.missionAcceptanceResume.unwrap(),
      })
      .strict(),
  })
  .strict()

const CoordinationRequest = z
  .object({
    ...CommonShape,
    source_kind: z.literal("coordination_request"),
    request_id: z.string().min(1),
    event: z
      .object({
        ...NoteShape,
        coordinationRequest: z.object({ requestID: z.string().min(1) }).strict(),
      })
      .strict(),
  })
  .strict()

const InfrastructureRecovery = z
  .object({
    ...CommonShape,
    source_kind: z.literal("infrastructure_recovery"),
    recovery_fact_id: z.string().min(1),
    event: z
      .object({
        ...NoteShape,
        processRecovery: z.object({ recoveryFactID: z.string().min(1) }).strict(),
      })
      .strict(),
  })
  .strict()

const DispatchInfrastructureFailure = z
  .object({
    ...CommonShape,
    source_kind: z.literal("dispatch_infrastructure_failure"),
    infrastructure_fact_id: z.string().min(1),
    event: z
      .object({
        ...NoteShape,
        dispatchInfrastructureFailure: OrchestratorEventSchema.shape.dispatchInfrastructureFailure.unwrap(),
      })
      .strict(),
  })
  .strict()

const AgentLifecycleDelivery = z
  .object({
    ...CommonShape,
    source_kind: z.literal("agent_lifecycle_delivery"),
    lifecycle_event_id: z.string().min(1),
    event: z
      .object({
        ...NoteShape,
        agentLifecycleDelivery: OrchestratorEventSchema.shape.agentLifecycleDelivery.unwrap(),
      })
      .strict(),
  })
  .strict()

const TaskWaitActivity = z
  .object({
    ...CommonShape,
    source_kind: z.literal("task_wait_activity"),
    event: z
      .object({
        ...NoteShape,
        taskWaitActivity: z.object({ source: z.string(), detail: z.string(), jobIDs: z.array(z.string()) }).strict(),
      })
      .strict(),
  })
  .strict()

const TaskWaitWake = z
  .object({
    ...CommonShape,
    source_kind: z.literal("task_wait_wake"),
    wait_job_id: z.string().min(1),
    event: z
      .object({
        ...NoteShape,
        taskWaitWake: z
          .object({
            jobID: z.string().min(1),
            fireID: z.string().min(1),
            dueAt: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()

const OrchestratorEvent = z
  .object({
    ...CommonShape,
    source_kind: z.literal("orchestrator_event"),
    event: z
      .object({
        ...NoteShape,
      })
      .strict(),
  })
  .strict()

export const QueuedTaskIngressSchema = z
  .discriminatedUnion("source_kind", [
    OperatorMessage,
    OrchestratorMessage,
    OperatorIntent,
    MissionAcceptanceResume,
    CoordinationRequest,
    InfrastructureRecovery,
    DispatchInfrastructureFailure,
    AgentLifecycleDelivery,
    TaskWaitActivity,
    TaskWaitWake,
    OrchestratorEvent,
  ])
  .superRefine((payload, context) => {
    if (payload.source_kind === "operator_message" || payload.source_kind === "orchestrator_message") {
      if (payload.message_id !== payload.event.rootMessage.messageID) {
        context.addIssue({ code: "custom", message: "queued message identity does not match rootMessage" })
      }
    }
    if (
      payload.source_kind === "mission_acceptance_resume" &&
      payload.message_id !== payload.event.missionAcceptanceResume.messageID
    ) {
      context.addIssue({ code: "custom", message: "Mission acceptance-resume message identity does not match event" })
    }
    if (
      payload.source_kind === "coordination_request" &&
      payload.request_id !== payload.event.coordinationRequest.requestID
    ) {
      context.addIssue({ code: "custom", message: "queued request identity does not match coordinationRequest" })
    }
    if (
      payload.source_kind === "infrastructure_recovery" &&
      payload.recovery_fact_id !== payload.event.processRecovery.recoveryFactID
    ) {
      context.addIssue({ code: "custom", message: "queued recovery identity does not match processRecovery" })
    }
    if (
      payload.source_kind === "dispatch_infrastructure_failure" &&
      payload.infrastructure_fact_id !== payload.event.dispatchInfrastructureFailure.infrastructureFactID
    ) {
      context.addIssue({
        code: "custom",
        message: "queued dispatch infrastructure identity does not match dispatchInfrastructureFailure",
      })
    }
    if (
      payload.source_kind === "agent_lifecycle_delivery" &&
      payload.lifecycle_event_id !== payload.event.agentLifecycleDelivery.eventID
    ) {
      context.addIssue({ code: "custom", message: "queued lifecycle delivery identity does not match event" })
    }
    if (payload.source_kind === "task_wait_wake" && payload.wait_job_id !== payload.event.taskWaitWake.jobID) {
      context.addIssue({ code: "custom", message: "queued task wait identity does not match taskWaitWake" })
    }
  })

export type QueuedTaskIngress = z.infer<typeof QueuedTaskIngressSchema>
export type QueuedTaskIngressSourceKind = QueuedTaskIngress["source_kind"]

export function queuedTaskIngressSourceKind(event: OrchestratorEvent): QueuedTaskIngressSourceKind {
  const parsed = OrchestratorEventSchema.parse(event)
  const candidates: QueuedTaskIngressSourceKind[] = []
  if (parsed.rootMessage?.kind === "operator") candidates.push("operator_message")
  if (parsed.rootMessage?.kind === "orchestrator") candidates.push("orchestrator_message")
  if (parsed.taskIntent) candidates.push("operator_intent")
  if (parsed.missionAcceptanceResume) candidates.push("mission_acceptance_resume")
  if (parsed.coordinationRequest) candidates.push("coordination_request")
  if (parsed.processRecovery) candidates.push("infrastructure_recovery")
  if (parsed.dispatchInfrastructureFailure) candidates.push("dispatch_infrastructure_failure")
  if (parsed.agentLifecycleDelivery) candidates.push("agent_lifecycle_delivery")
  if (parsed.taskWaitActivity) candidates.push("task_wait_activity")
  if (parsed.taskWaitWake) candidates.push("task_wait_wake")
  if (parsed.note && candidates.length === 0) candidates.push("orchestrator_event")
  if (candidates.length !== 1) {
    throw new Error(`Queued Task ingress requires exactly one source kind; received ${candidates.join(", ") || "none"}`)
  }
  return candidates[0]!
}
