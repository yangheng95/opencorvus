export type TaskRootIngressPolicyFact = {
  id: string
  semanticTurnLimit: number
  activationLimit: number
  absoluteDeadline?: number
}

export type TaskRootIngressAcceptedFact = {
  id: string
  taskID: string
  executionEpoch: number
  sequence: number
  policyID: string
  timeAccepted: number
}

export type TaskLifecycleFact = {
  id: string
  kind: "opened" | "cancellation_requested" | "close_requested" | "cancelled" | "closed" | "reopened" | "deleted"
  epoch: number
  time: number
}

export type ActivationLeaseFact = {
  id: string
  targetID: string
  ownerOccurrenceID: string
  timeActivated: number
  expiresAt: number
}

export type AssistantTurnFact = {
  id: string
  activationID: string
  predecessorID: string
  timeCompleted: number
  boundary: "tool_calls" | "final" | "provider_error" | "wait"
}

export type DecisionFact = {
  id: string
  assistantMessageID: string
  command: string
}

export type InteractionFact = {
  id: string
  ingressID: string
  assistantMessageID: string
  outcome?: "answered" | "rejected" | "expired"
  resumeAt?: number
  activityRequestID?: string
}

export type ActivityRequestFact = {
  id: string
  activationID: string
  assistantMessageID: string
  idempotency: "transactional" | "stable_key" | "query_required"
}

export type ActivityOutcomeFact = {
  id: string
  requestID: string
  outcome: "completed" | "failed" | "reconciled_unknown"
}

export type TaskRootIngressFacts = {
  ingress: TaskRootIngressAcceptedFact
  policy: TaskRootIngressPolicyFact
  lifecycle: readonly TaskLifecycleFact[]
  leases: readonly ActivationLeaseFact[]
  turns: readonly AssistantTurnFact[]
  decisions: readonly DecisionFact[]
  interactions: readonly InteractionFact[]
  activityRequests: readonly ActivityRequestFact[]
  activityOutcomes: readonly ActivityOutcomeFact[]
}

export type TaskRootIngressProjection =
  | { state: "blocked"; reason: "integrity_conflict" }
  | { state: "exhausted"; reason: "semantic_limit" | "activation_limit" | "deadline" }
  | { state: "terminal_inapplicable"; boundary: "cancelled" | "closed" | "reopened" | "deleted" }
  | { state: "resolved"; decisionIDs: readonly string[] }
  | { state: "leased"; activationID: string; ownerOccurrenceID: string; expiresAt: number }
  | { state: "reconcile_required"; requestIDs: readonly string[] }
  | { state: "waiting"; interactionID: string; resumeAt?: number }
  | { state: "cancelling"; requestEventID: string }
  | { state: "closing"; requestEventID: string }
  | { state: "ready" }

function exactlyOne<T>(values: readonly T[]): T | undefined {
  return values.length === 1 ? values[0] : undefined
}

function latestLease(facts: TaskRootIngressFacts): ActivationLeaseFact | undefined {
  return facts.leases
    .filter((lease) => lease.targetID === facts.ingress.id)
    .toSorted((left, right) => right.timeActivated - left.timeActivated || right.id.localeCompare(left.id))[0]
}

function activityOutcomeByRequest(facts: TaskRootIngressFacts): Map<string, readonly ActivityOutcomeFact[]> {
  const grouped = new Map<string, ActivityOutcomeFact[]>()
  for (const outcome of facts.activityOutcomes) {
    const current = grouped.get(outcome.requestID) ?? []
    current.push(outcome)
    grouped.set(outcome.requestID, current)
  }
  return grouped
}

function validDecisionSet(facts: TaskRootIngressFacts): readonly DecisionFact[] | undefined {
  const completedTurnIDs = new Set(facts.turns.map((turn) => turn.id))
  const decisions = facts.decisions.filter((decision) => completedTurnIDs.has(decision.assistantMessageID))
  if (decisions.length === 0) return undefined
  const assistantMessageIDs = new Set(decisions.map((decision) => decision.assistantMessageID))
  if (assistantMessageIDs.size !== 1) return undefined
  if (decisions.length > 1 && decisions.some((decision) => decision.command !== "dispatch_agent")) return undefined
  return decisions.toSorted((left, right) => left.id.localeCompare(right.id))
}

function activationConsumed(facts: TaskRootIngressFacts, activationID: string): boolean {
  const outcomes = activityOutcomeByRequest(facts)
  const outstanding = facts.activityRequests.some(
    (request) => request.activationID === activationID && (outcomes.get(request.id)?.length ?? 0) === 0,
  )
  if (outstanding) return false
  return facts.turns.some(
    (turn) =>
      turn.activationID === activationID &&
      (turn.boundary === "final" || turn.boundary === "provider_error" || turn.boundary === "wait"),
  )
}

function conflict(facts: TaskRootIngressFacts): boolean {
  if (facts.policy.id !== facts.ingress.policyID) return true
  const lifecycleByKindAndEpoch = new Map<string, TaskLifecycleFact[]>()
  for (const fact of facts.lifecycle) {
    const key = `${fact.epoch}:${fact.kind}`
    lifecycleByKindAndEpoch.set(key, [...(lifecycleByKindAndEpoch.get(key) ?? []), fact])
  }
  if ([...lifecycleByKindAndEpoch.values()].some((rows) => rows.length > 1)) return true
  const terminal = facts.lifecycle.filter(
    (fact) => fact.epoch === facts.ingress.executionEpoch && (fact.kind === "cancelled" || fact.kind === "closed"),
  )
  if (terminal.length > 1) return true
  const completedTurnIDs = new Set(facts.turns.map((turn) => turn.id))
  const decisions = facts.decisions.filter((decision) => completedTurnIDs.has(decision.assistantMessageID))
  if (decisions.length > 0 && !validDecisionSet(facts)) return true
  const outcomes = activityOutcomeByRequest(facts)
  if ([...outcomes.values()].some((rows) => rows.length > 1)) return true
  return facts.turns.some((turn) => !facts.leases.some((lease) => lease.id === turn.activationID))
}

export function taskRootIngressSemanticTurnIDs(facts: TaskRootIngressFacts): string[] {
  return facts.turns
    .filter(
      (turn) =>
        turn.boundary === "final" &&
        !facts.decisions.some((decision) => decision.assistantMessageID === turn.id) &&
        !facts.interactions.some((interaction) => interaction.assistantMessageID === turn.id),
    )
    .map((turn) => turn.id)
}

/** Total reduction over durable facts. Its order is part of the public
 * correctness contract: conflicts win before any apparent completion. */
export function reduceTaskRootIngressFacts(facts: TaskRootIngressFacts, now: number): TaskRootIngressProjection {
  if (conflict(facts)) return { state: "blocked", reason: "integrity_conflict" }

  const currentEpoch = Math.max(
    0,
    ...facts.lifecycle.filter((fact) => fact.kind === "opened" || fact.kind === "reopened").map((fact) => fact.epoch),
  )
  if (currentEpoch > facts.ingress.executionEpoch) return { state: "terminal_inapplicable", boundary: "reopened" }
  const deleted = exactlyOne(facts.lifecycle.filter((fact) => fact.kind === "deleted"))
  if (deleted) return { state: "terminal_inapplicable", boundary: "deleted" }
  const terminal = exactlyOne(
    facts.lifecycle.filter(
      (fact) => fact.epoch === facts.ingress.executionEpoch && (fact.kind === "cancelled" || fact.kind === "closed"),
    ),
  )
  if (terminal && terminal.time >= facts.ingress.timeAccepted) {
    return { state: "terminal_inapplicable", boundary: terminal.kind === "cancelled" ? "cancelled" : "closed" }
  }

  const decisions = validDecisionSet(facts)
  if (decisions) return { state: "resolved", decisionIDs: decisions.map((decision) => decision.id) }

  const latest = latestLease(facts)
  if (latest && latest.expiresAt > now && !activationConsumed(facts, latest.id)) {
    return {
      state: "leased",
      activationID: latest.id,
      ownerOccurrenceID: latest.ownerOccurrenceID,
      expiresAt: latest.expiresAt,
    }
  }

  const outcomes = activityOutcomeByRequest(facts)
  const pendingReconciliationRequests = new Set(
    facts.interactions
      .filter((interaction) => interaction.activityRequestID && !interaction.outcome)
      .map((interaction) => interaction.activityRequestID!),
  )
  const unknown = facts.activityRequests.filter(
    (request) =>
      (outcomes.get(request.id)?.length ?? 0) === 0 &&
      !pendingReconciliationRequests.has(request.id) &&
      (!latest || latest.expiresAt <= now || activationConsumed(facts, request.activationID)),
  )
  if (unknown.length > 0)
    return { state: "reconcile_required", requestIDs: unknown.map((request) => request.id).toSorted() }

  const cancellationRequest = exactlyOne(
    facts.lifecycle.filter(
      (fact) => fact.epoch === facts.ingress.executionEpoch && fact.kind === "cancellation_requested",
    ),
  )
  if (cancellationRequest) return { state: "cancelling", requestEventID: cancellationRequest.id }
  const closeRequest = exactlyOne(
    facts.lifecycle.filter((fact) => fact.epoch === facts.ingress.executionEpoch && fact.kind === "close_requested"),
  )
  if (closeRequest) return { state: "closing", requestEventID: closeRequest.id }

  if (facts.policy.absoluteDeadline !== undefined && now >= facts.policy.absoluteDeadline) {
    return { state: "exhausted", reason: "deadline" }
  }

  const waiting = facts.interactions
    .filter(
      (interaction) =>
        interaction.ingressID === facts.ingress.id &&
        !interaction.outcome &&
        (interaction.resumeAt === undefined || interaction.resumeAt > now),
    )
    .toSorted((left, right) => left.id.localeCompare(right.id))
  if (waiting.length > 1) return { state: "blocked", reason: "integrity_conflict" }
  if (waiting[0])
    return {
      state: "waiting",
      interactionID: waiting[0].id,
      ...(waiting[0].resumeAt === undefined ? {} : { resumeAt: waiting[0].resumeAt }),
    }

  const semanticTurns = taskRootIngressSemanticTurnIDs(facts).length
  if (semanticTurns >= facts.policy.semanticTurnLimit) return { state: "exhausted", reason: "semantic_limit" }
  if (facts.leases.filter((lease) => lease.targetID === facts.ingress.id).length >= facts.policy.activationLimit) {
    return { state: "exhausted", reason: "activation_limit" }
  }
  return { state: "ready" }
}
