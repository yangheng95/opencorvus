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
  kind: "opened" | "cancellation_requested" | "cancelled" | "closed" | "reopened" | "deleted"
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

export type DecisionGapFact = {
  id: string
  activationID: string
  assistantMessageID: string
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
  /** Set when reading durable evidence observed a violation of the persisted
   * integrity contract. The reduction is total over persisted facts, so a
   * violation is a `host_fault` value here rather than an exception at the
   * reader; see `TaskRootIngressIntegrityError`. */
  integrityViolation?: { message: string }
  ingress: TaskRootIngressAcceptedFact
  policy: TaskRootIngressPolicyFact
  lifecycle: readonly TaskLifecycleFact[]
  leases: readonly ActivationLeaseFact[]
  turns: readonly AssistantTurnFact[]
  decisions: readonly DecisionFact[]
  decisionGaps: readonly DecisionGapFact[]
  interactions: readonly InteractionFact[]
  activityRequests: readonly ActivityRequestFact[]
  activityOutcomes: readonly ActivityOutcomeFact[]
}

/**
 * Which of the Host's own write invariants this ingress found broken.
 *
 * Each reason names one exact invariant rather than one opaque word, because
 * the surfaced fault has to tell an operator what to look at. None of them is
 * a user-facing condition: every one describes the Host contradicting itself,
 * which is why the settlement is local to this ingress and never terminalizes
 * the Task or holds the Task's FIFO.
 */
export type TaskRootIngressHostFaultReason =
  /** An evidence reader raised `TaskRootIngressIntegrityError`. */
  | "evidence_violation"
  /** The policy row read back is not the one this ingress was accepted with. */
  | "policy_drift"
  /** Completed-Turn decisions that no single assistant Turn can own. */
  | "decision_ambiguous"
  /** One activity request carries more than one outcome. */
  | "outcome_ambiguous"
  /** A completed Turn references an activation with no lease fact. */
  | "turn_without_activation"
  /** One ingress holds more than one unresolved Interaction. */
  | "interaction_ambiguous"

export type TaskRootIngressProjection =
  | { state: "host_fault"; reason: TaskRootIngressHostFaultReason }
  | { state: "exhausted"; reason: "semantic_limit" | "activation_limit" | "deadline" }
  | { state: "terminal_inapplicable"; boundary: "cancelled" | "closed" | "reopened" | "deleted" }
  | { state: "resolved"; decisionIDs: readonly string[] }
  | { state: "leased"; activationID: string; ownerOccurrenceID: string; expiresAt: number }
  | { state: "reconcile_required"; requestIDs: readonly string[] }
  | { state: "waiting"; interactionID: string; resumeAt?: number }
  | { state: "cancelling"; requestEventID: string }
  | { state: "ready" }

function exactlyOne<T>(values: readonly T[]): T | undefined {
  return values.length === 1 ? values[0] : undefined
}

/**
 * Has this ingress stopped owning the Task's head-of-line order?
 *
 * Head-of-line order exists so one ingress's pending decision cannot be
 * overtaken by the next one's. An ingress that will never decide anything has
 * nothing left to protect: `resolved` and `terminal_inapplicable` reached their
 * verdict, `exhausted` gave up its budget, and `host_fault` executed no effect
 * and never will, because the reduction returns it before any decision can be
 * read. Holding the line for such an ingress stalls every later operator
 * message behind a state that nothing but an operator can change — which is
 * exactly how one broken Host write used to wedge a whole Task.
 *
 * This is the single definition of that release, shared by the durable
 * acquisition fence and the scan.
 */
export function taskRootIngressReleasesHeadOfLine(projection: TaskRootIngressProjection): boolean {
  return (
    projection.state === "resolved" ||
    projection.state === "terminal_inapplicable" ||
    projection.state === "exhausted" ||
    projection.state === "host_fault"
  )
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

/**
 * Name the broken Host write invariant, if this ingress's evidence has one.
 *
 * Duplicate lifecycle facts are deliberately not checked here. Every lifecycle
 * kind is already unique per (Task, epoch) in the durable schema — one open per
 * epoch, one boundary request per epoch, one terminal per epoch across all
 * terminal types, one deletion per Task — so re-deriving those predicates in
 * the reducer only restated a guarantee the database already holds, and did it
 * with a verdict that used to stop the Task.
 */
function hostFault(facts: TaskRootIngressFacts): TaskRootIngressHostFaultReason | undefined {
  if (facts.policy.id !== facts.ingress.policyID) return "policy_drift"
  const completedTurnIDs = new Set(facts.turns.map((turn) => turn.id))
  const decisions = facts.decisions.filter((decision) => completedTurnIDs.has(decision.assistantMessageID))
  if (decisions.length > 0 && !validDecisionSet(facts)) return "decision_ambiguous"
  const outcomes = activityOutcomeByRequest(facts)
  if ([...outcomes.values()].some((rows) => rows.length > 1)) return "outcome_ambiguous"
  if (facts.turns.some((turn) => !facts.leases.some((lease) => lease.id === turn.activationID))) {
    return "turn_without_activation"
  }
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

/** Immutable Provider boundaries are the canonical semantic-attempt counter
 * for current data. Completed legacy Turns without StepFinish evidence remain
 * countable so restart and existing databases keep their prior budget. */
export function taskRootIngressSemanticAttemptIDs(facts: TaskRootIngressFacts): string[] {
  const gapAssistantIDs = new Set(facts.decisionGaps.map((gap) => gap.assistantMessageID))
  const legacyTurnIDs = taskRootIngressSemanticTurnIDs(facts).filter((id) => !gapAssistantIDs.has(id))
  return [...facts.decisionGaps.map((gap) => gap.id), ...legacyTurnIDs]
}

/** How long a Task may rest in `cancelling` before the control plane
 * re-attempts convergence. The state is not absorbing — an owner is expected
 * to finish it — so it must carry a finite wake rather than depend on a
 * restart. */
export const CANCELLATION_RECONCILE_WAKE_MS = 15_000

/**
 * Why this projection may rest, and until when.
 *
 * - `absorbing`: no further transition is possible; no wake is owed.
 * - `finite_wake`: the projection changes at `wakeAt` with no new fact.
 * - `operator_gated`: a legal resting state that only an operator (or the
 *   surfaced gate's resolution) can leave. `surface` names the durable
 *   artifact that must make it visible, because an unsurfaced rest state is
 *   indistinguishable from a deadlock.
 * - `fifo_deferred`: activation of this ingress is owned by the scan's FIFO
 *   walk, not by a timer.
 *
 * Totality is the point: every arm of `TaskRootIngressProjection` maps to
 * exactly one class, checked at compile time. A state with neither a wake nor
 * a surface is a silent permanent stall, which is the defect this replaces.
 */
export type TaskRootIngressWakeClassification =
  | { class: "absorbing" }
  | { class: "finite_wake"; wakeAt: number }
  | { class: "operator_gated"; surface: "infrastructure_fact" | "interaction" }
  | { class: "fifo_deferred" }

function minDefined(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) return right
  if (right === undefined) return left
  return Math.min(left, right)
}

function finiteWake(instant: number, absoluteDeadline: number | undefined): TaskRootIngressWakeClassification {
  return { class: "finite_wake", wakeAt: minDefined(instant, absoluteDeadline)! }
}

function deadlineOr(
  absoluteDeadline: number | undefined,
  fallback: TaskRootIngressWakeClassification,
): TaskRootIngressWakeClassification {
  return absoluteDeadline === undefined ? fallback : { class: "finite_wake", wakeAt: absoluteDeadline }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Task-root ingress projection: ${JSON.stringify(value)}`)
}

/**
 * Classify when — or whether — this projection can next change.
 *
 * `reduceTaskRootIngressFacts` reads `now` only through a lease expiry, an
 * Interaction resume deadline and the immutable absolute deadline, so the
 * projection is piecewise-constant in time between those finitely many
 * instants. A reconciler that re-scans at the returned instant therefore
 * observes every time-triggered transition; every other transition is a fact
 * append, which its producer signals.
 *
 * `host_fault` and `exhausted` deliberately ignore `absoluteDeadline`: both are
 * absorbing for this ingress under the reduction above, so a timer would only
 * re-derive the same value. Their exit is the surfaced fact, not the clock, and
 * neither holds the Task's FIFO.
 */
export function classifyTaskRootIngressWake(
  projection: TaskRootIngressProjection,
  absoluteDeadline: number | undefined,
  now: number,
): TaskRootIngressWakeClassification {
  switch (projection.state) {
    case "resolved":
    case "terminal_inapplicable":
      return { class: "absorbing" }
    case "leased":
      return finiteWake(projection.expiresAt, absoluteDeadline)
    case "waiting":
      return projection.resumeAt !== undefined
        ? finiteWake(projection.resumeAt, absoluteDeadline)
        : deadlineOr(absoluteDeadline, { class: "operator_gated", surface: "interaction" })
    case "cancelling":
      return finiteWake(now + CANCELLATION_RECONCILE_WAKE_MS, absoluteDeadline)
    case "reconcile_required":
      return deadlineOr(absoluteDeadline, { class: "operator_gated", surface: "interaction" })
    case "host_fault":
      return { class: "operator_gated", surface: "infrastructure_fact" }
    case "exhausted":
      return { class: "operator_gated", surface: "infrastructure_fact" }
    case "ready":
      return deadlineOr(absoluteDeadline, { class: "fifo_deferred" })
    default:
      return assertNever(projection)
  }
}

/** The finite instant this projection changes on its own, if any. Thin
 * projection of `classifyTaskRootIngressWake` for callers that only arm
 * timers; an operator-gated rest state returns `undefined` here and must be
 * surfaced by the caller instead. */
export function taskRootIngressWakeInstant(
  projection: TaskRootIngressProjection,
  absoluteDeadline?: number,
  now: number = Date.now(),
): number | undefined {
  const classification = classifyTaskRootIngressWake(projection, absoluteDeadline, now)
  return classification.class === "finite_wake" ? classification.wakeAt : undefined
}

/** Total reduction over durable facts. Its order is part of the public
 * correctness contract: a Host fault wins before any apparent completion, so
 * no ambiguous evidence can be read as a decision and executed. */
export function reduceTaskRootIngressFacts(facts: TaskRootIngressFacts, now: number): TaskRootIngressProjection {
  if (facts.integrityViolation) return { state: "host_fault", reason: "evidence_violation" }
  const fault = hostFault(facts)
  if (fault) return { state: "host_fault", reason: fault }

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
  if (waiting.length > 1) return { state: "host_fault", reason: "interaction_ambiguous" }
  if (waiting[0])
    return {
      state: "waiting",
      interactionID: waiting[0].id,
      ...(waiting[0].resumeAt === undefined ? {} : { resumeAt: waiting[0].resumeAt }),
    }

  const semanticAttempts = taskRootIngressSemanticAttemptIDs(facts).length
  if (semanticAttempts >= facts.policy.semanticTurnLimit) return { state: "exhausted", reason: "semantic_limit" }
  if (facts.leases.filter((lease) => lease.targetID === facts.ingress.id).length >= facts.policy.activationLimit) {
    return { state: "exhausted", reason: "activation_limit" }
  }
  return { state: "ready" }
}
