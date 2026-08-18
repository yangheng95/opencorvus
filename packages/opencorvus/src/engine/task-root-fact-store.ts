import { Identifier } from "@/id/id"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { AutomationRunTable, AutomationTable } from "@/scheduler/automation.sql"
import {
  MessageTable,
  ProviderActivityOutcomeTable,
  ProviderActivityRequestTable,
  ToolPartOutcomeTable,
  ToolPartRequestTable,
  SessionTable,
} from "@/session/session.sql"
import { Database, and, asc, desc, eq, gt, lt, sql } from "@/storage/db"
import {
  EngineControlActivationLeaseTable,
  EngineArtifactTable,
  EngineTaskTable,
  EngineTaskRootIngressPolicyTable,
  EngineTaskRootIngressTable,
  type EngineTaskRootIngressSource,
} from "./engine.sql"
import {
  reduceTaskRootIngressFacts,
  taskRootIngressReleasesHeadOfLine,
  type ActivityOutcomeFact,
  type ActivityRequestFact,
  type AssistantTurnFact,
  type DecisionFact,
  type DecisionGapFact,
  type InteractionFact,
  type TaskLifecycleFact,
  type TaskRootIngressFacts,
  type TaskRootIngressProjection,
} from "./task-root-ingress-reducer"
import { taskLifecycleProjectionInTransaction } from "./task-lifecycle"
import {
  isTaskRootIngressIntegrityError,
  TaskRootActivationSupersededError,
  TaskRootIngressIntegrityError,
} from "./task-root-ingress-integrity"
import { orchestratorControlOccurrenceIdentity } from "@/orchestrator/control-message-identity"
import { TaskDeletedError, taskDeletedInTransaction } from "./store"
import { Project } from "@/project/project"

export type TaskRootIngressEvidence = {
  turns: readonly AssistantTurnFact[]
  decisions: readonly DecisionFact[]
  decisionGaps: readonly DecisionGapFact[]
  interactions: readonly InteractionFact[]
  activityRequests: readonly ActivityRequestFact[]
  activityOutcomes: readonly ActivityOutcomeFact[]
}

export type TaskRootIngressEvidenceReader = (
  db: Database.TxOrDb,
  ingress: typeof EngineTaskRootIngressTable.$inferSelect,
) => TaskRootIngressEvidence

const EMPTY_EVIDENCE: TaskRootIngressEvidence = {
  turns: [],
  decisions: [],
  decisionGaps: [],
  interactions: [],
  activityRequests: [],
  activityOutcomes: [],
}

/** Frozen acceptance defaults. Each accepted ingress references its immutable
 * content-addressed copy, so later configuration changes cannot rewrite retry
 * or deadline semantics. */
export const DEFAULT_TASK_ROOT_INGRESS_POLICY = {
  semanticTurnLimit: 3,
  activationLimit: 4,
} as const

function policyMaterial(input: {
  semanticTurnLimit: number
  activationLimit: number
  absoluteDeadline?: number
}): string {
  return JSON.stringify([
    "task-root-policy-v1",
    input.semanticTurnLimit,
    input.activationLimit,
    input.absoluteDeadline ?? null,
  ])
}

function assertPolicy(input: { semanticTurnLimit: number; activationLimit: number; absoluteDeadline?: number }): void {
  if (!Number.isSafeInteger(input.semanticTurnLimit) || input.semanticTurnLimit <= 0) {
    throw new Error("Task-root semantic Turn limit must be a positive safe integer")
  }
  if (!Number.isSafeInteger(input.activationLimit) || input.activationLimit <= 0) {
    throw new Error("Task-root activation limit must be a positive safe integer")
  }
  if (
    input.absoluteDeadline !== undefined &&
    (!Number.isSafeInteger(input.absoluteDeadline) || input.absoluteDeadline <= 0)
  ) {
    throw new Error("Task-root absolute deadline must be a positive safe integer")
  }
}

export function ensureTaskRootIngressPolicyInTransaction(
  db: Database.TxOrDb,
  input: { semanticTurnLimit: number; activationLimit: number; absoluteDeadline?: number; now: number },
): string {
  assertPolicy(input)
  const id = Identifier.deterministic("artifact", policyMaterial(input))
  db.insert(EngineTaskRootIngressPolicyTable)
    .values({
      id,
      semantic_turn_limit: input.semanticTurnLimit,
      activation_limit: input.activationLimit,
      absolute_deadline: input.absoluteDeadline ?? null,
      time_created: input.now,
    })
    .onConflictDoNothing()
    .run()
  const exact = db
    .select()
    .from(EngineTaskRootIngressPolicyTable)
    .where(eq(EngineTaskRootIngressPolicyTable.id, id))
    .get()
  if (
    !exact ||
    exact.semantic_turn_limit !== input.semanticTurnLimit ||
    exact.activation_limit !== input.activationLimit ||
    exact.absolute_deadline !== (input.absoluteDeadline ?? null)
  ) {
    throw new Error(`Task-root policy identity collision: ${id}`)
  }
  return id
}

export type AcceptTaskRootIngressInput = {
  taskID: string
  executionEpoch: number
  source: EngineTaskRootIngressSource
  sourceID: string
  inlinePayload?: Record<string, unknown>
  semanticTurnLimit: number
  activationLimit: number
  absoluteDeadline?: number
  now: number
}

export function acceptTaskRootIngressInTransaction(
  db: Database.TxOrDb,
  input: AcceptTaskRootIngressInput,
): typeof EngineTaskRootIngressTable.$inferSelect {
  if (taskDeletedInTransaction(db, input.taskID)) throw new TaskDeletedError(input.taskID)
  if (!Number.isSafeInteger(input.executionEpoch) || input.executionEpoch <= 0) {
    throw new Error("Task-root ingress execution epoch must be a positive safe integer")
  }
  if (!input.sourceID.trim()) throw new Error("Task-root ingress requires an exact source identity")
  if ((input.source === "inline") !== Boolean(input.inlinePayload)) {
    throw new Error("Task-root inline payload exists exactly when source is inline")
  }
  const existing = db
    .select()
    .from(EngineTaskRootIngressTable)
    .where(
      and(
        eq(EngineTaskRootIngressTable.task_id, input.taskID),
        eq(EngineTaskRootIngressTable.source, input.source),
        eq(EngineTaskRootIngressTable.source_id, input.sourceID),
      ),
    )
    .get()
  if (existing) {
    if (existing.execution_epoch !== input.executionEpoch) {
      throw new Error(
        `Task-root source ${input.source}:${input.sourceID} was already accepted in epoch ${existing.execution_epoch}`,
      )
    }
    const expectedInline = input.inlinePayload ?? null
    if (JSON.stringify(existing.inline_payload) !== JSON.stringify(expectedInline)) {
      throw new Error(`Task-root source ${input.source}:${input.sourceID} replay changed its immutable payload`)
    }
    const policy = db.select().from(EngineTaskRootIngressPolicyTable)
      .where(eq(EngineTaskRootIngressPolicyTable.id, existing.policy_id)).get()
    if (
      !policy ||
      policy.semantic_turn_limit !== input.semanticTurnLimit ||
      policy.activation_limit !== input.activationLimit ||
      policy.absolute_deadline !== (input.absoluteDeadline ?? null)
    ) {
      throw new Error(`Task-root source ${input.source}:${input.sourceID} replay changed its immutable policy`)
    }
    return existing
  }
  const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
  if (lifecycle.epoch !== input.executionEpoch) {
    throw new Error(
      `Task-root source ${input.source}:${input.sourceID} targets epoch ${input.executionEpoch}, current epoch is ${lifecycle.epoch}`,
    )
  }
  if (input.source === "message") {
    const task = db.select({ sessionID: EngineTaskTable.session_id }).from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
    const source = db.select({ id: MessageTable.id, sessionID: MessageTable.session_id }).from(MessageTable).where(eq(MessageTable.id, input.sourceID)).get()
    if (!source) throw new Error(`Task-root ingress source Message does not exist: ${input.sourceID}`)
    if (!task?.sessionID || source.sessionID !== task.sessionID) {
      throw new Error(`Task-root ingress source Message ${input.sourceID} is outside Task ${input.taskID} root Session`)
    }
  }
  if (input.source === "protocol_event") {
    const source = db.select({ id: ProtocolEventTable.id, aggregate: ProtocolEventTable.aggregate_type, aggregateID: ProtocolEventTable.aggregate_id }).from(ProtocolEventTable).where(eq(ProtocolEventTable.id, input.sourceID)).get()
    if (!source) throw new Error(`Task-root ingress source Protocol Event does not exist: ${input.sourceID}`)
    if (source.aggregate !== "task" || source.aggregateID !== input.taskID) {
      throw new Error(`Task-root ingress source Protocol Event ${input.sourceID} belongs to ${source.aggregate}:${source.aggregateID}`)
    }
  }
  if (input.source === "task" && input.sourceID !== input.taskID) throw new Error(`Task-root Task source must equal Task identity`)
  if (input.source === "engine_artifact") {
    const source = db.select({ taskID: EngineArtifactTable.task_id }).from(EngineArtifactTable).where(eq(EngineArtifactTable.id, input.sourceID)).get()
    if (!source || source.taskID !== input.taskID) throw new Error(`Task-root ingress Engine Artifact ${input.sourceID} is outside Task ${input.taskID}`)
  }
  if (input.source === "automation_run") {
    const source = db.select({ taskID: AutomationTable.task_id }).from(AutomationRunTable)
      .innerJoin(AutomationTable, eq(AutomationTable.id, AutomationRunTable.automation_revision_id))
      .where(eq(AutomationRunTable.id, input.sourceID)).get()
    if (!source || source.taskID !== input.taskID) throw new Error(`Task-root ingress Automation run ${input.sourceID} is outside Task ${input.taskID}`)
  }
  const policyID = ensureTaskRootIngressPolicyInTransaction(db, input)
  const previous = db
    .select({ sequence: EngineTaskRootIngressTable.sequence })
    .from(EngineTaskRootIngressTable)
    .where(
      and(
        eq(EngineTaskRootIngressTable.task_id, input.taskID),
        eq(EngineTaskRootIngressTable.execution_epoch, input.executionEpoch),
      ),
    )
    .orderBy(desc(EngineTaskRootIngressTable.sequence))
    .get()
  const id = Identifier.deterministic(
    "artifact",
    `task-root-ingress-v1\0${input.taskID}\0${input.source}\0${input.sourceID}`,
  )
  db.insert(EngineTaskRootIngressTable)
    .values({
      id,
      task_id: input.taskID,
      execution_epoch: input.executionEpoch,
      sequence: (previous?.sequence ?? 0) + 1,
      source: input.source,
      source_id: input.sourceID,
      inline_payload: input.inlinePayload ?? null,
      policy_id: policyID,
      time_accepted: input.now,
    })
    .run()
  return db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.id, id)).get()!
}

function lifecycleKind(type: string): TaskLifecycleFact["kind"] | undefined {
  if (type === "task.execution.opened") return "opened"
  if (type === "task.execution.reopened") return "reopened"
  if (type === "task.cancellation.requested") return "cancellation_requested"
  if (type === "task.cancelled") return "cancelled"
  if (type === "task.completed" || type === "task.failed") return "closed"
  if (type === "task.deleted") return "deleted"
}

function lifecycleFacts(db: Database.TxOrDb, taskID: string): TaskLifecycleFact[] {
  return db
    .select({
      id: ProtocolEventTable.id,
      type: ProtocolEventTable.type,
      payload: ProtocolEventTable.payload,
      time: ProtocolEventTable.emitted_at,
    })
    .from(ProtocolEventTable)
    .where(and(eq(ProtocolEventTable.aggregate_type, "task"), eq(ProtocolEventTable.aggregate_id, taskID)))
    .orderBy(asc(ProtocolEventTable.seq), asc(ProtocolEventTable.id))
    .all()
    .flatMap((row) => {
      const kind = lifecycleKind(row.type)
      if (!kind) return []
      const epoch = row.payload?.execution_epoch
      if (!Number.isSafeInteger(epoch) || Number(epoch) <= 0) {
        throw new Error(`Task lifecycle event ${row.id} is missing a positive execution_epoch`)
      }
      return [{ id: row.id, kind, epoch: Number(epoch), time: row.time }]
    })
}

export function taskRootIngressFactsInTransaction(
  db: Database.TxOrDb,
  ingressID: string,
  readEvidence: TaskRootIngressEvidenceReader = () => EMPTY_EVIDENCE,
): TaskRootIngressFacts {
  const ingress = db
    .select()
    .from(EngineTaskRootIngressTable)
    .where(eq(EngineTaskRootIngressTable.id, ingressID))
    .get()
  if (!ingress) throw new Error(`Task-root ingress not found: ${ingressID}`)
  const policy = db
    .select()
    .from(EngineTaskRootIngressPolicyTable)
    .where(eq(EngineTaskRootIngressPolicyTable.id, ingress.policy_id))
    .get()
  if (!policy) throw new Error(`Task-root ingress ${ingressID} references missing policy ${ingress.policy_id}`)
  let evidence: TaskRootIngressEvidence
  let integrityViolation: { message: string } | undefined
  try {
    evidence = readEvidence(db, ingress)
  } catch (error) {
    if (!isTaskRootIngressIntegrityError(error)) throw error
    evidence = EMPTY_EVIDENCE
    integrityViolation = { message: error.message }
  }
  return {
    ...(integrityViolation ? { integrityViolation } : {}),
    ingress: {
      id: ingress.id,
      taskID: ingress.task_id,
      executionEpoch: ingress.execution_epoch,
      sequence: ingress.sequence,
      policyID: ingress.policy_id,
      timeAccepted: ingress.time_accepted,
    },
    policy: {
      id: policy.id,
      semanticTurnLimit: policy.semantic_turn_limit,
      activationLimit: policy.activation_limit,
      ...(policy.absolute_deadline === null ? {} : { absoluteDeadline: policy.absolute_deadline }),
    },
    lifecycle: lifecycleFacts(db, ingress.task_id),
    leases: db
      .select()
      .from(EngineControlActivationLeaseTable)
      .where(
        and(
          eq(EngineControlActivationLeaseTable.target, "task_root_ingress"),
          eq(EngineControlActivationLeaseTable.target_id, ingress.id),
        ),
      )
      .orderBy(asc(EngineControlActivationLeaseTable.time_activated), asc(EngineControlActivationLeaseTable.id))
      .all()
      .map((lease) => ({
        id: lease.id,
        targetID: lease.target_id,
        ownerOccurrenceID: lease.owner_occurrence_id,
        timeActivated: lease.time_activated,
        expiresAt: lease.expires_at,
      })),
    ...evidence,
  }
}

export function projectTaskRootIngress(
  ingressID: string,
  now: number,
  readEvidence?: TaskRootIngressEvidenceReader,
): TaskRootIngressProjection {
  return Database.use((db) => reduceTaskRootIngressFacts(taskRootIngressFactsInTransaction(db, ingressID, readEvidence), now))
}

export type AcquireTaskRootIngressLeaseResult =
  | { acquired: true; activationID: string; expiresAt: number }
  | { acquired: false; projection: TaskRootIngressProjection; blockedByIngressID?: string }

export function acquireTaskRootIngressLease(input: {
  ingressID: string
  ownerOccurrenceID: string
  now: number
  leaseMilliseconds: number
  readEvidence?: TaskRootIngressEvidenceReader
}): AcquireTaskRootIngressLeaseResult {
  if (!Number.isSafeInteger(input.leaseMilliseconds) || input.leaseMilliseconds <= 0) {
    throw new Error("Task-root lease duration must be a positive safe integer")
  }
  return Database.immediateTransaction((db) => {
    const facts = taskRootIngressFactsInTransaction(db, input.ingressID, input.readEvidence)
    const task = db
      .select({ projectID: EngineTaskTable.project_id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, facts.ingress.taskID))
      .get()
    if (!task) throw new Error(`Task-root ingress ${input.ingressID} references a missing Task`)
    Project.assertDurableAdmissionOpen(db, task.projectID)
    const projection = reduceTaskRootIngressFacts(facts, input.now)
    if (projection.state !== "ready") return { acquired: false, projection }
    const prior = db
      .select({ id: EngineTaskRootIngressTable.id })
      .from(EngineTaskRootIngressTable)
      .where(
        and(
          eq(EngineTaskRootIngressTable.task_id, facts.ingress.taskID),
          eq(EngineTaskRootIngressTable.execution_epoch, facts.ingress.executionEpoch),
          lt(EngineTaskRootIngressTable.sequence, facts.ingress.sequence),
        ),
      )
      .orderBy(asc(EngineTaskRootIngressTable.sequence), asc(EngineTaskRootIngressTable.id))
      .all()
    for (const candidate of prior) {
      const preceding = reduceTaskRootIngressFacts(
        taskRootIngressFactsInTransaction(db, candidate.id, input.readEvidence),
        input.now,
      )
      if (!taskRootIngressReleasesHeadOfLine(preceding)) {
        return { acquired: false, projection, blockedByIngressID: candidate.id }
      }
    }
    const activationID = Identifier.ascending("activity")
    const expiresAt = input.now + input.leaseMilliseconds
    db.insert(EngineControlActivationLeaseTable)
      .values({
        id: activationID,
        target: "task_root_ingress",
        target_id: input.ingressID,
        owner_occurrence_id: input.ownerOccurrenceID,
        time_activated: input.now,
        expires_at: expiresAt,
      })
      .run()
    return { acquired: true, activationID, expiresAt }
  })
}

export function renewTaskRootIngressLease(input: {
  ingressID: string
  activationID: string
  ownerOccurrenceID: string
  now: number
  expiresAt: number
}): void {
  if (input.expiresAt <= input.now) throw new Error("Task-root lease renewal must extend into the future")
  Database.immediateTransaction((db) => {
    const ingress = db
      .select({ projectID: EngineTaskTable.project_id })
      .from(EngineTaskRootIngressTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineTaskRootIngressTable.task_id))
      .where(eq(EngineTaskRootIngressTable.id, input.ingressID))
      .get()
    if (!ingress) throw new Error(`Task-root ingress ${input.ingressID} has no Project authority`)
    Project.assertDurableAdmissionOpen(db, ingress.projectID)
    const fence = assertTaskRootActivationLeaseFenceInTransaction(db, {
      activationID: input.activationID,
      now: input.now,
    })
    if (fence.ingressID !== input.ingressID || fence.ownerOccurrenceID !== input.ownerOccurrenceID) {
      throw new Error(`Task-root activation fence rejected lease renewal ${input.activationID}`)
    }
    const latest = db
      .select()
      .from(EngineControlActivationLeaseTable)
      .where(
        and(
          eq(EngineControlActivationLeaseTable.target, "task_root_ingress"),
          eq(EngineControlActivationLeaseTable.target_id, input.ingressID),
        ),
      )
      .orderBy(desc(EngineControlActivationLeaseTable.time_activated), desc(EngineControlActivationLeaseTable.id))
      .get()
    if (
      !latest ||
      latest.id !== input.activationID ||
      latest.owner_occurrence_id !== input.ownerOccurrenceID ||
      latest.expires_at <= input.now
    ) {
      throw new Error(`Task-root activation fence rejected lease renewal ${input.activationID}`)
    }
    const renewed = db.update(EngineControlActivationLeaseTable)
      .set({ expires_at: input.expiresAt })
      .where(
        and(
          eq(EngineControlActivationLeaseTable.id, input.activationID),
          eq(EngineControlActivationLeaseTable.expires_at, latest.expires_at),
          gt(EngineControlActivationLeaseTable.expires_at, input.now),
        ),
      )
      .returning({ id: EngineControlActivationLeaseTable.id })
      .get()
    if (!renewed) {
      throw new Error(`Task-root activation fence lost lease renewal ${input.activationID}`)
    }
  })
}

export function assertTaskRootActivationLeaseFenceInTransaction(
  db: Database.TxOrDb,
  input: { activationID: string; now: number; allowAcceptedActivitySettlement?: boolean },
): { ingressID: string; taskID: string; ownerOccurrenceID: string; expiresAt: number } {
  const lease = db
    .select()
    .from(EngineControlActivationLeaseTable)
    .where(eq(EngineControlActivationLeaseTable.id, input.activationID))
    .get()
  if (!lease || lease.target !== "task_root_ingress") {
    throw new Error(`Task-root activation fence rejected unknown activation ${input.activationID}`)
  }
  const latest = db
    .select()
    .from(EngineControlActivationLeaseTable)
    .where(
      and(
        eq(EngineControlActivationLeaseTable.target, "task_root_ingress"),
        eq(EngineControlActivationLeaseTable.target_id, lease.target_id),
      ),
    )
    .orderBy(desc(EngineControlActivationLeaseTable.time_activated), desc(EngineControlActivationLeaseTable.id))
    .get()
  const ingress = db
    .select()
    .from(EngineTaskRootIngressTable)
    .where(eq(EngineTaskRootIngressTable.id, lease.target_id))
    .get()
  if (!ingress) throw new Error(`Task-root activation ${input.activationID} has no accepted ingress`)
  if (taskDeletedInTransaction(db, ingress.task_id)) throw new TaskDeletedError(ingress.task_id)
  const lifecycle = taskLifecycleProjectionInTransaction(db, ingress.task_id)
  const policy = db
    .select({ absoluteDeadline: EngineTaskRootIngressPolicyTable.absolute_deadline })
    .from(EngineTaskRootIngressPolicyTable)
    .where(eq(EngineTaskRootIngressPolicyTable.id, ingress.policy_id))
    .get()
  if (!policy) throw new Error(`Task-root ingress ${ingress.id} references missing policy ${ingress.policy_id}`)
  const activationMessages = db
    .select()
    .from(MessageTable)
    .where(sql`json_extract(${MessageTable.data}, '$.activationID') = ${input.activationID}`)
    .all()
  const activationConsumed = activationMessages.some((row) => {
    const message = row.data as {
      role?: string
      time?: { completed?: number }
      finish?: string
      error?: unknown
    }
    if (message.role !== "assistant" || !message.time?.completed) return false
    const toolRequests = db
      .select({ id: ToolPartRequestTable.id })
      .from(ToolPartRequestTable)
      .where(eq(ToolPartRequestTable.message_id, row.id))
      .all()
    const providerRequests = db
      .select({ id: ProviderActivityRequestTable.id })
      .from(ProviderActivityRequestTable)
      .where(eq(ProviderActivityRequestTable.assistant_message_id, row.id))
      .all()
    const outstandingTool = toolRequests.some(
      (request) =>
        !db
          .select({ id: ToolPartOutcomeTable.id })
          .from(ToolPartOutcomeTable)
          .where(eq(ToolPartOutcomeTable.request_part_id, request.id))
          .get(),
    )
    const outstandingProvider = providerRequests.some(
      (request) =>
        !db
          .select({ id: ProviderActivityOutcomeTable.id })
          .from(ProviderActivityOutcomeTable)
          .where(eq(ProviderActivityOutcomeTable.request_id, request.id))
          .get(),
    )
    return !outstandingTool && !outstandingProvider && (Boolean(message.error) || !message.finish?.includes("tool"))
  })
  const terminalConversation =
    lifecycle.terminalAt !== undefined && lifecycle.terminalAt < ingress.time_accepted
  if (
    latest?.id !== lease.id ||
    (!input.allowAcceptedActivitySettlement && lease.expires_at <= input.now) ||
    (!input.allowAcceptedActivitySettlement && policy.absoluteDeadline !== null && input.now >= policy.absoluteDeadline) ||
    activationConsumed ||
    lifecycle.epoch !== ingress.execution_epoch ||
    (lifecycle.status !== "active" && !terminalConversation && !input.allowAcceptedActivitySettlement)
  ) {
    // A superseded epoch, a consumed activation and a terminal Task are all
    // permanent: no later attempt can make this activation current again.
    // Typing the rejection lets recovery retire the continuations that hold
    // it, instead of replaying a dead backlog on every project open.
    const permanent =
      activationConsumed || lifecycle.epoch !== ingress.execution_epoch || latest?.id !== lease.id
    const detail =
      `Task-root activation fence rejected ${input.activationID}; ` +
      `latest=${latest?.id ?? "none"} expiry=${lease.expires_at} deadline=${policy.absoluteDeadline ?? "none"} consumed=${activationConsumed} epoch=${lifecycle.epoch}/${ingress.execution_epoch} status=${lifecycle.status}`
    throw permanent ? new TaskRootActivationSupersededError(ingress.id, detail) : new Error(detail)
  }
  return {
    ingressID: ingress.id,
    taskID: ingress.task_id,
    ownerOccurrenceID: lease.owner_occurrence_id,
    expiresAt: lease.expires_at,
  }
}

export function assertTaskRootAssistantActivationFenceInTransaction(
  db: Database.TxOrDb,
  input: {
    assistantMessageID: string
    now: number
    candidate?: { sessionID: string; parentID: string; activationID: string }
    allowAcceptedActivitySettlement?: boolean
  },
): void {
  const message = db
    .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
    .from(MessageTable)
    .where(eq(MessageTable.id, input.assistantMessageID))
    .get()
  const activationID = input.candidate?.activationID ?? (
    message?.data && typeof message.data === "object" && "activationID" in message.data
      ? (message.data as { activationID?: unknown }).activationID
      : undefined)
  if (activationID === undefined) return
  if (typeof activationID !== "string" || !activationID) {
    throw new Error(`Assistant Message ${input.assistantMessageID} has invalid Task-root activation identity`)
  }
  let acceptedActivitySettlementRequired = false
  let fence: ReturnType<typeof assertTaskRootActivationLeaseFenceInTransaction>
  try {
    fence = assertTaskRootActivationLeaseFenceInTransaction(db, { activationID, now: input.now })
  } catch (strictFenceError) {
    if (!input.allowAcceptedActivitySettlement) throw strictFenceError
    fence = assertTaskRootActivationLeaseFenceInTransaction(db, {
      activationID,
      now: input.now,
      allowAcceptedActivitySettlement: true,
    })
    acceptedActivitySettlementRequired = true
  }
  const task = db.select({ sessionID: EngineTaskTable.session_id, projectID: EngineTaskTable.project_id }).from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, fence.taskID)).get()
  const assistant = input.candidate ?? (message?.data as { parentID?: unknown } | undefined)
  const sessionID = input.candidate?.sessionID ?? message?.sessionID
  const session = typeof sessionID === "string"
    ? db.select({ parentID: SessionTable.parent_id, projectID: SessionTable.project_id, kind: SessionTable.kind })
        .from(SessionTable).where(eq(SessionTable.id, sessionID)).get()
    : undefined
  if (
    !task?.sessionID ||
    !session ||
    session.parentID !== task.sessionID ||
    session.projectID !== task.projectID ||
    session.kind !== "orchestrator" ||
    typeof assistant?.parentID !== "string"
  ) {
    throw new Error(`Assistant Message ${input.assistantMessageID} is outside Task-root activation ${activationID}`)
  }
  const parent = db.select({ data: MessageTable.data, sessionID: MessageTable.session_id }).from(MessageTable)
    .where(eq(MessageTable.id, assistant.parentID)).get()
  const control = (parent?.data as { extra?: { orchestrator_control_ingress?: { ingress_id?: unknown; predecessor_id?: unknown } } } | undefined)
    ?.extra?.orchestrator_control_ingress
  if (
    parent?.sessionID !== sessionID ||
    control?.ingress_id !== fence.ingressID ||
    typeof control.predecessor_id !== "string" ||
    orchestratorControlOccurrenceIdentity(fence.ingressID, control.predecessor_id).messageID !== assistant.parentID
  ) {
    throw new Error(`Assistant Message ${input.assistantMessageID} has invalid Task-root continuation parent`)
  }
  // These reject the write, which is the safety half and must stay. They are
  // typed so the Orchestrator can tell an integrity conflict — a durable,
  // operator-gated condition the control plane already reduces to `blocked` —
  // apart from an ordinary execution fault, and therefore stop terminally
  // failing the whole Task over one refused append.
  const peers = db.select({ id: MessageTable.id }).from(MessageTable)
    .where(sql`json_extract(${MessageTable.data}, '$.activationID') = ${activationID}`).all()
  if (peers.some((peer) => peer.id !== input.assistantMessageID)) {
    throw new TaskRootIngressIntegrityError(
      fence.ingressID,
      `Task-root activation ${activationID} has multiple assistant Messages`,
    )
  }
  // A compaction summary is a legitimate system-authored sibling: the
  // compaction writer parents it under the newest user Message, which in an
  // Orchestrator Session is the just-written control occurrence. It carries no
  // activation, no decisions and no Tool requests, so it cannot be the second
  // *turn* this conflict exists to refuse. Counting it here rejected the real
  // activation assistant — killing the Turn — while the summary itself passed
  // unfenced (no activationID), which inverted the guarantee: every Session
  // long enough to compact lost its Task to this check.
  // `IS` rather than `=`: a sibling missing its author field entirely must
  // stay counted, and under three-valued logic `NULL = 'compaction'` would
  // drop the whole row from the conflict instead of failing the exemption.
  const siblingAssistants = db.select({ id: MessageTable.id }).from(MessageTable)
    .where(
      sql`json_extract(${MessageTable.data}, '$.role') = 'assistant' AND json_extract(${MessageTable.data}, '$.parentID') = ${assistant.parentID}
        AND NOT (json_extract(${MessageTable.data}, '$.author') IS 'compaction' AND json_extract(${MessageTable.data}, '$.activationID') IS NULL)`,
    )
    .all()
  if (siblingAssistants.some((peer) => peer.id !== input.assistantMessageID)) {
    throw new TaskRootIngressIntegrityError(
      fence.ingressID,
      `Task-root continuation ${assistant.parentID} has multiple assistant Messages`,
    )
  }
  if (acceptedActivitySettlementRequired) {
    const providerRequests = db.select({ id: ProviderActivityRequestTable.id })
      .from(ProviderActivityRequestTable)
      .where(eq(ProviderActivityRequestTable.assistant_message_id, input.assistantMessageID)).all()
    const toolRequests = db.select({ id: ToolPartRequestTable.id })
      .from(ToolPartRequestTable)
      .where(eq(ToolPartRequestTable.message_id, input.assistantMessageID)).all()
    const providerSettled = providerRequests.every((request) => Boolean(
      db.select({ id: ProviderActivityOutcomeTable.id }).from(ProviderActivityOutcomeTable)
        .where(eq(ProviderActivityOutcomeTable.request_id, request.id)).get(),
    ))
    const toolsSettled = toolRequests.every((request) => Boolean(
      db.select({ id: ToolPartOutcomeTable.id }).from(ToolPartOutcomeTable)
        .where(eq(ToolPartOutcomeTable.request_part_id, request.id)).get(),
    ))
    if (providerRequests.length + toolRequests.length === 0 || !providerSettled || !toolsSettled) {
      throw new Error(
        `Task-root assistant ${input.assistantMessageID} cannot settle before every accepted activity has an exact outcome`,
      )
    }
  }
}

export function assertTaskRootActivationFenceInTransaction(
  db: Database.TxOrDb,
  input: { ingressID: string; activationID: string; now: number; readEvidence?: TaskRootIngressEvidenceReader },
): void {
  const facts = taskRootIngressFactsInTransaction(db, input.ingressID, input.readEvidence)
  const projection = reduceTaskRootIngressFacts(facts, input.now)
  if (projection.state !== "leased" || projection.activationID !== input.activationID) {
    throw new Error(
      `Task-root activation fence rejected ${input.activationID}; current projection is ${projection.state}`,
    )
  }
}

export function listTaskRootIngresses(taskID: string, executionEpoch: number) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineTaskRootIngressTable)
      .where(
        and(
          eq(EngineTaskRootIngressTable.task_id, taskID),
          eq(EngineTaskRootIngressTable.execution_epoch, executionEpoch),
        ),
      )
      .orderBy(asc(EngineTaskRootIngressTable.sequence), asc(EngineTaskRootIngressTable.id))
      .all(),
  )
}
