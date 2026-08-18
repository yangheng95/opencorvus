import { OrchestratorEventSchema, type OrchestratorEvent } from "@/orchestrator/event"

export type TaskRootIngressSourceKind =
  | "task_creation"
  | "operator_message"
  | "orchestrator_message"
  | "mission_message"
  | "mission_acceptance_resume"
  | "coordination_request"
  | "infrastructure_recovery"
  | "dispatch_infrastructure_failure"
  | "agent_lifecycle_delivery"
  | "task_wait_activity"
  | "task_wait_wake"
  | "orchestrator_event"

export function taskRootIngressSourceKind(event: OrchestratorEvent): TaskRootIngressSourceKind {
  const parsed = OrchestratorEventSchema.parse(event)
  const candidates: TaskRootIngressSourceKind[] = []
  if (parsed.taskCreation) candidates.push("task_creation")
  if (parsed.rootMessage?.kind === "operator") candidates.push("operator_message")
  if (parsed.rootMessage?.kind === "orchestrator") candidates.push("orchestrator_message")
  if (parsed.rootMessage?.kind === "mission") candidates.push("mission_message")
  if (parsed.missionAcceptanceResume) candidates.push("mission_acceptance_resume")
  if (parsed.coordinationRequest) candidates.push("coordination_request")
  if (parsed.processRecovery) candidates.push("infrastructure_recovery")
  if (parsed.dispatchInfrastructureFailure) candidates.push("dispatch_infrastructure_failure")
  if (parsed.agentLifecycleDelivery) candidates.push("agent_lifecycle_delivery")
  if (parsed.taskWaitActivity) candidates.push("task_wait_activity")
  if (parsed.taskWaitWake) candidates.push("task_wait_wake")
  if (parsed.note && candidates.length === 0) candidates.push("orchestrator_event")
  if (candidates.length !== 1) {
    throw new Error(`Task root ingress requires exactly one source kind; received ${candidates.join(", ") || "none"}`)
  }
  return candidates[0]!
}
