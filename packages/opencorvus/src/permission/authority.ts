import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Config } from "@/config/config"
import { TaskRootActivationSupersededError } from "@/engine/task-root-ingress-integrity"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Database, and, asc, desc, eq, inArray, isNotNull, sql } from "@/storage/db"
import { fn } from "@/util/fn"
import { Log } from "@/util/log"
import { AwaitTimeoutError, withTimeout } from "@/util/await-with-timeout"
import { createHash } from "node:crypto"
import { AsyncLocalStorage } from "node:async_hooks"
import z from "zod"
import { InteractionUserInput } from "@/memory/interaction-user-input"
import { Identifier } from "@/id/id"
import {
  permissionDescriptor,
  permissionProjectGrantEligible,
  type InvocationPermissionDescriptor,
  PermissionProviderKind,
  ToolInvocationProviderKind,
} from "./invocation"
import { PermissionExecutionResultTable, PermissionLedgerTable, PermissionPolicyTable } from "./permission.sql"
import {
  acquireControlLease,
  assertControlLeaseInTransaction,
  releaseControlLeaseInTransaction,
  releaseControlLeaseOnErrorPath,
  renewControlLease,
} from "@/engine/control-lease"
import { PermissionDecision } from "./decision"
import { permissionRequestOwnerBelongsToProject } from "./project-authority"
// Type-only: the value import stays dynamic so the runtime module cycle with
// SessionLoop is never created.
import type { SessionLoop } from "@/session/loop"
import {
  assertSessionDeletionAdmissionInTransaction,
  SessionDeletionRuntimeNotSettledError,
} from "@/session/deletion-cleanup"

type SessionLoopContinuationOutcome = SessionLoop.PermissionContinuationOutcome

export namespace PermissionAuthority {
  const log = Log.create({ service: "permission-authority" })
  let afterSessionDeletionBatchSelectedForTest:
    | ((input: { sessionIDs: readonly string[]; requestIDs: readonly string[] }) => void | Promise<void>)
    | undefined
  let afterAuthorizationBeforeExecutionStartForTest:
    | ((request: Request) => void | Promise<void>)
    | undefined
  export const Identity = z
    .string()
    .max(Identifier.MAX_LENGTH)
    .regex(Identifier.canonicalPattern("permission"), { message: "Invalid canonical permission identifier" })
    .meta({ ref: "PermissionIdentity" })

  export const Mode = z.enum(["full_access", "ask"]).meta({ ref: "PermissionMode" })
  export type Mode = z.infer<typeof Mode>

  export const Decision = PermissionDecision
  export type Decision = z.infer<typeof Decision>

  export const Request = z
    .object({
      id: Identity,
      projectID: z.string().min(1),
      taskID: z.string().min(1).optional(),
      sessionID: z.string().min(1),
      messageID: z.string().min(1),
      toolCallID: z.string().min(1),
      mode: Mode,
      policyRevision: z.string().min(1),
      providerKind: PermissionProviderKind,
      providerID: z.string().min(1),
      providerDigest: z.string().min(1),
      toolName: z.string().min(1),
      effectClass: z.string().min(1),
      scopeVersion: z.string().min(1),
      scope: z.record(z.string(), z.unknown()),
      fingerprint: z.string().min(1),
      summary: z.string().min(1),
      projectGrantEligible: z.boolean(),
      choices: Decision.array(),
      timeCreated: z.number().int().positive(),
    })
    .meta({ ref: "PermissionRequest" })
  export type Request = z.infer<typeof Request>

  export const LedgerEvent = z
    .object({
      id: Identity,
      request_id: Identity,
      project_id: z.string(),
      session_id: z.string(),
      task_id: z.string().nullable(),
      message_id: z.string(),
      tool_call_id: z.string(),
      attempt_id: Identity.nullable(),
      event_type: z.string(),
      mode: Mode,
      policy_revision: z.string(),
      provider_kind: z.string(),
      provider_id: z.string(),
      provider_digest: z.string(),
      tool_name: z.string(),
      effect_class: z.string(),
      scope_version: z.string(),
      scope: z.record(z.string(), z.unknown()),
      fingerprint: z.string(),
      summary: z.string(),
      decision_scope: z.string().nullable(),
      source_event_id: Identity.nullable(),
      decision_slot: Identity.nullable(),
      outcome_slot: Identity.nullable(),
      actor_id: z.string().nullable(),
      reason: z.string().nullable(),
      time_created: z.number(),
    })
    .passthrough()

  export const Reply = z
    .object({
      requestID: Identity,
      decision: Decision,
      actorID: z.string().min(1).default("local-operator"),
      message: z.string().optional(),
      autoReply: z.boolean().default(false),
    })
    .meta({ ref: "PermissionReply" })
  export type Reply = z.infer<typeof Reply>

  export const UserReply = Reply.extend({ userInput: InteractionUserInput }).omit({ autoReply: true })
  export type UserReply = z.infer<typeof UserReply>

  export const Resolution = z.object({
    request: Request,
    decision: Decision,
    eventID: Identity,
  })
  export type Resolution = z.infer<typeof Resolution>

  export const Reconciliation = z
    .object({
      attemptID: Identity,
      outcome: z.enum(["execution_succeeded", "execution_failed"]),
      actorID: z.string().min(1).default("local-operator"),
      reason: z.string().min(1),
    })
    .meta({ ref: "PermissionExecutionReconciliation" })
  export type Reconciliation = z.infer<typeof Reconciliation>

  export const Event = {
    Asked: BusEvent.define("permission.asked", Request),
    Replied: BusEvent.define(
      "permission.replied",
      z.object({
        sessionID: z.string(),
        requestID: Identity,
        decision: Decision,
        actorID: z.string(),
        autoReply: z.boolean(),
        userInput: InteractionUserInput.optional(),
      }),
    ),
  }

  type Waiter = { resolve: () => void; reject: (error: Error) => void }
  const exactContinuation = new AsyncLocalStorage<string>()
  const executionContext = new AsyncLocalStorage<{
    request: Request
    attemptID: string
    recovering: boolean
  }>()
  const state = createInstanceState(
    async () => {
      reconcileInterruptedAttempts()
      return { waiters: new Map<string, Waiter[]>() }
    },
    async (current) => {
      for (const [requestID, waiters] of current.waiters) {
        for (const waiter of waiters) waiter.reject(new PermissionPausedError(requestID))
      }
      current.waiters.clear()
    },
    "permission-authority",
  )

  type LedgerRow = typeof PermissionLedgerTable.$inferSelect

  function digest(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex")
  }

  function requestIdentity(input: {
    projectID: string
    sessionID: string
    messageID: string
    toolCallID: string
    fingerprint: string
  }): string {
    return Identifier.deterministic(
      "permission",
      `request\0${JSON.stringify({
        projectID: input.projectID,
        sessionID: input.sessionID,
        messageID: input.messageID,
        toolCallID: input.toolCallID,
        fingerprint: input.fingerprint,
      })}`,
    )
  }

  function requestID(input: InvocationIdentity, descriptor: InvocationPermissionDescriptor): string {
    return requestIdentity({ ...input, fingerprint: descriptor.fingerprint })
  }

  function attemptID(requestIDValue: string): string {
    return Identifier.deterministic("permission", `attempt\0${requestIDValue}`)
  }

  function ledgerEventID(): string {
    return Identifier.ascending("permission")
  }

  function policyRevision(projectID: string, sessionID: string, mode: Mode): string {
    return digest({ projectID, sessionID, mode, schema: 1 })
  }

  async function policyForSession(input: InvocationIdentity): Promise<{ mode: Mode; revision: string }> {
    const stored = Database.use((db) =>
      db.select().from(PermissionPolicyTable).where(eq(PermissionPolicyTable.session_id, input.sessionID)).get(),
    )
    if (stored) return { mode: stored.mode, revision: stored.revision }
    const config = await Config.get()
    const mode = Mode.parse(config.permission_mode)
    const revision = policyRevision(input.projectID, input.sessionID, mode)
    Database.immediateTransaction((db) => {
      const current = db
        .select()
        .from(PermissionPolicyTable)
        .where(eq(PermissionPolicyTable.session_id, input.sessionID))
        .get()
      if (current) return
      db.insert(PermissionPolicyTable)
        .values({
          session_id: input.sessionID,
          project_id: input.projectID,
          mode,
          revision,
          time_created: Date.now(),
        })
        .run()
    })
    return Database.use((db) => {
      const row = db
        .select()
        .from(PermissionPolicyTable)
        .where(eq(PermissionPolicyTable.session_id, input.sessionID))
        .get()
      if (!row) throw new Error(`Permission policy was not persisted for Session ${input.sessionID}`)
      return { mode: row.mode, revision: row.revision }
    })
  }

  function rowBase(request: Request) {
    return {
      request_id: request.id,
      project_id: request.projectID,
      session_id: request.sessionID,
      task_id: request.taskID,
      message_id: request.messageID,
      tool_call_id: request.toolCallID,
      mode: request.mode,
      policy_revision: request.policyRevision,
      provider_kind: request.providerKind,
      provider_id: request.providerID,
      provider_digest: request.providerDigest,
      tool_name: request.toolName,
      effect_class: request.effectClass,
      scope_version: request.scopeVersion,
      scope: request.scope,
      fingerprint: request.fingerprint,
      summary: request.summary,
    }
  }

  function appendEvent(
    request: Request,
    eventType: LedgerRow["event_type"],
    extra: Partial<typeof PermissionLedgerTable.$inferInsert> = {},
  ): LedgerRow {
    const row: typeof PermissionLedgerTable.$inferInsert = {
      id: ledgerEventID(),
      request_id: request.id,
      ...(eventType === "requested" ? rowBase(request) : {}),
      event_type: eventType,
      time_created: Date.now(),
      ...extra,
    }
    Database.immediateTransaction((db) => {
      if (eventType === "requested") assertSessionDeletionAdmissionInTransaction(db, request.sessionID)
      db.insert(PermissionLedgerTable).values(row).run()
    })
    return row as LedgerRow
  }

  type EffectLease = {
    id: string
    ownerOccurrenceID: string
    targetID: string
  }

  function acquireEffectLease(attempt: string): EffectLease | undefined {
    const ownerOccurrenceID = Identifier.ascending("call")
    const acquired = acquireControlLease({
      target: "effect",
      targetID: attempt,
      ownerOccurrenceID,
      now: Date.now(),
      leaseMilliseconds: 120_000,
    })
    return acquired.acquired ? { id: acquired.lease.id, ownerOccurrenceID, targetID: attempt } : undefined
  }

  async function executeUnderEffectLease<T>(lease: EffectLease, execute: () => Promise<T>): Promise<T> {
    let renewalFailure: unknown
    const heartbeat = setInterval(() => {
      try {
        const now = Date.now()
        renewControlLease({
          target: "effect",
          targetID: lease.targetID,
          leaseID: lease.id,
          ownerOccurrenceID: lease.ownerOccurrenceID,
          now,
          expiresAt: now + 120_000,
        })
      } catch (error) {
        renewalFailure ??= error
      }
    }, 30_000)
    try {
      const result = await execute()
      if (renewalFailure) throw renewalFailure
      return result
    } finally {
      clearInterval(heartbeat)
    }
  }

  /**
   * Give up ownership of an attempt this process is no longer executing.
   *
   * An attempt can end without a terminal receipt: the durable MCP task is
   * still open, so the effect outcome is genuinely unknown and must stay
   * recoverable. What must not survive is this process's claim on it — the
   * lease otherwise keeps the exact attempt unclaimable for its full duration,
   * and recovery in the next process waits on an owner that no longer exists.
   */
  function abandonEffectLease(lease: EffectLease): void {
    const handback = releaseControlLeaseOnErrorPath({
      target: "effect",
      targetID: lease.targetID,
      leaseID: lease.id,
      ownerOccurrenceID: lease.ownerOccurrenceID,
      now: Date.now(),
    })
    if (handback.error) {
      log.warn("permission effect lease could not be handed back", {
        attempt: lease.targetID,
        error: handback.error instanceof Error ? handback.error.message : String(handback.error),
      })
    }
  }

  function appendEffectOutcome(
    request: Request,
    eventType: "execution_failed" | "outcome_unknown" | "execution_reconciled",
    extra: Partial<typeof PermissionLedgerTable.$inferInsert>,
    lease?: EffectLease,
  ): LedgerRow {
    const row = {
      id: ledgerEventID(),
      request_id: request.id,
      event_type: eventType,
      time_created: Date.now(),
      ...extra,
    } satisfies typeof PermissionLedgerTable.$inferInsert
    Database.immediateTransaction((db) => {
      const settledAt = Date.now()
      if (lease)
        assertControlLeaseInTransaction(db, {
          target: "effect",
          targetID: lease.targetID,
          leaseID: lease.id,
          ownerOccurrenceID: lease.ownerOccurrenceID,
          now: settledAt,
        })
      db.insert(PermissionLedgerTable).values(row).run()
      if (lease)
        releaseControlLeaseInTransaction(db, {
          target: "effect",
          targetID: lease.targetID,
          leaseID: lease.id,
          ownerOccurrenceID: lease.ownerOccurrenceID,
          now: settledAt,
        })
    })
    return row as LedgerRow
  }

  type DurableExecutionResult = { kind: "json"; value: unknown } | { kind: "undefined" }

  function durableExecutionResult(result: unknown): {
    payload: DurableExecutionResult
  } {
    const payload: DurableExecutionResult =
      result === undefined ? { kind: "undefined" } : { kind: "json", value: result }
    const serialized = JSON.stringify(payload)
    if (serialized === undefined) {
      throw new Error("Tool result cannot be durably represented")
    }
    return { payload: JSON.parse(serialized) as DurableExecutionResult }
  }

  function resultFromDurable<T>(stored: unknown): T {
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      throw new Error("Durable Tool result has an invalid envelope")
    }
    const payload = stored as Partial<DurableExecutionResult>
    if (payload.kind === "undefined") return undefined as T
    if (payload.kind === "json" && "value" in payload) return payload.value as T
    throw new Error("Durable Tool result has an unknown envelope")
  }

  function completeExecution<T>(input: {
    request: Request
    attempt: string
    toolPartID?: string
    result: T
    lease?: EffectLease
  }): T {
    const durable = durableExecutionResult(input.result)
    const event: typeof PermissionLedgerTable.$inferInsert = {
      id: ledgerEventID(),
      request_id: input.request.id,
      event_type: "execution_succeeded",
      attempt_id: input.attempt,
      outcome_slot: input.attempt,
      time_created: Date.now(),
    }
    Database.immediateTransaction((db) => {
      const settledAt = Date.now()
      if (input.lease)
        assertControlLeaseInTransaction(db, {
          target: "effect",
          targetID: input.lease.targetID,
          leaseID: input.lease.id,
          ownerOccurrenceID: input.lease.ownerOccurrenceID,
          now: settledAt,
        })
      db.insert(PermissionExecutionResultTable)
        .values({
          attempt_id: input.attempt,
          result: durable.payload,
          time_created: settledAt,
        })
        .onConflictDoNothing()
        .run()
      db.insert(PermissionLedgerTable).values(event).run()
      // A full-access invocation never has an Ask-me continuation to carry
      // across processes: the decision was policy-settled inline and the
      // durable result is committed in this very transaction. Retiring it here
      // keeps it out of every later recovery scan — an unretired inline
      // success is exactly what let a project open replay a live Turn's own
      // Tool calls back onto its still-streaming assistant Message.
      if (input.request.mode === "full_access") {
        db.insert(PermissionLedgerTable)
          .values({
            id: ledgerEventID(),
            request_id: input.request.id,
            event_type: "stale",
            source_event_id: event.id,
            reason: "Full-access inline execution committed its durable result",
            time_created: Date.now(),
          })
          .run()
      }
      // The durable result is the terminal receipt for this attempt. Its lease
      // ends with it, so nothing else has to wait out the remaining duration.
      // The fence above already proved this owner holds it at `settledAt`.
      if (input.lease)
        releaseControlLeaseInTransaction(db, {
          target: "effect",
          targetID: input.lease.targetID,
          leaseID: input.lease.id,
          ownerOccurrenceID: input.lease.ownerOccurrenceID,
          now: settledAt,
        })
    })
    return input.result
  }

  function requestFromRow(row: LedgerRow): Request {
    const authority =
      row.event_type === "requested"
        ? row
        : Database.use((db) =>
            db
              .select()
              .from(PermissionLedgerTable)
              .where(
                and(
                  eq(PermissionLedgerTable.request_id, row.request_id),
                  eq(PermissionLedgerTable.event_type, "requested"),
                ),
              )
              .get(),
          )
    if (!authority) throw new Error(`Permission event ${row.id} references missing request ${row.request_id}`)
    const resource =
      authority.scope && typeof authority.scope === "object" && !Array.isArray(authority.scope)
        ? (authority.scope.resource as Record<string, unknown> | undefined)
        : undefined
    const projectGrantEligible =
      authority.scope_version === "2" && resource
        ? permissionProjectGrantEligible({
            providerKind: PermissionProviderKind.parse(authority.provider_kind),
            toolName: authority.tool_name!,
            effectClass: authority.effect_class as InvocationPermissionDescriptor["effectClass"],
            resource,
          })
        : false
    return Request.parse({
      id: authority.request_id,
      projectID: authority.project_id,
      taskID: authority.task_id ?? undefined,
      sessionID: authority.session_id,
      messageID: authority.message_id,
      toolCallID: authority.tool_call_id,
      mode: authority.mode,
      policyRevision: authority.policy_revision,
      providerKind: authority.provider_kind,
      providerID: authority.provider_id,
      providerDigest: authority.provider_digest,
      toolName: authority.tool_name,
      effectClass: authority.effect_class,
      scopeVersion: authority.scope_version,
      scope: authority.scope,
      fingerprint: authority.fingerprint,
      summary: authority.summary,
      projectGrantEligible,
      choices: Array.isArray(authority.metadata?.choices)
        ? authority.metadata.choices
        : choices(projectGrantEligible, Boolean(authority.task_id)),
      timeCreated: authority.time_created,
    })
  }

  function choices(projectGrantEligible: boolean, hasTask: boolean): Decision[] {
    return [
      "allow_once",
      ...(hasTask ? (["allow_task"] as const) : []),
      ...(projectGrantEligible ? (["allow_project"] as const) : []),
      "deny",
    ]
  }

  function decisionFor(requestIDValue: string): LedgerRow | undefined {
    return Database.use((db) =>
      db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.decision_slot, requestIDValue)).get(),
    )
  }

  function assertRequestIdentity(request: Request): void {
    const existing = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(and(eq(PermissionLedgerTable.request_id, request.id), eq(PermissionLedgerTable.event_type, "requested")))
        .get(),
    )
    if (!existing) return
    const exact = requestFromRow(existing)
    const existingID = requestIdentity({
      projectID: exact.projectID,
      sessionID: exact.sessionID,
      messageID: exact.messageID,
      toolCallID: exact.toolCallID,
      fingerprint: exact.fingerprint,
    })
    if (existingID !== request.id) throw new PermissionIdentityCollisionError(request.id, "request")
    if (
      existing.project_id !== request.projectID ||
      existing.session_id !== request.sessionID ||
      existing.message_id !== request.messageID ||
      existing.tool_call_id !== request.toolCallID ||
      existing.fingerprint !== request.fingerprint
    )
      throw new PermissionIdentityCollisionError(request.id, "request")
  }

  function assertAttemptIdentity(request: Request, attempt: string): void {
    const existing = Database.use((db) =>
      db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.attempt_id, attempt)).all(),
    )
    if (existing.some((row) => row.request_id !== request.id)) {
      throw new PermissionIdentityCollisionError(attempt, "attempt")
    }
    const storedResult = Database.use((db) =>
      db
        .select()
        .from(PermissionExecutionResultTable)
        .where(eq(PermissionExecutionResultTable.attempt_id, attempt))
        .get(),
    )
    if (!storedResult) return
    const succeeded = existing.find((row) => row.event_type === "execution_succeeded" && row.outcome_slot === attempt)
    if (!succeeded) {
      throw new PermissionIdentityCollisionError(attempt, "attempt")
    }
  }

  function staleFor(requestIDValue: string): LedgerRow | undefined {
    return Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(and(eq(PermissionLedgerTable.request_id, requestIDValue), eq(PermissionLedgerTable.event_type, "stale")))
        .get(),
    )
  }

  function decisionFromRow(row: LedgerRow): Decision {
    if (row.event_type === "denied" || row.event_type === "cancelled" || row.event_type === "stale") return "deny"
    if (row.decision_scope === "task") return "allow_task"
    if (row.decision_scope === "project") return "allow_project"
    return "allow_once"
  }

  function settleDecision(
    request: Request,
    eventType: "allowed_once" | "grant_created" | "denied" | "cancelled" | "stale",
    extra: Partial<typeof PermissionLedgerTable.$inferInsert>,
  ): { settled: LedgerRow; won: boolean } {
    try {
      return {
        settled: appendEvent(request, eventType, {
          ...extra,
          decision_slot: request.id,
        }),
        won: true,
      }
    } catch (error) {
      const winner = decisionFor(request.id)
      if (!winner) throw error
      return { settled: winner, won: false }
    }
  }

  function settleDecisionInTransaction(
    db: Database.TxOrDb,
    request: Request,
    eventType: "allowed_once" | "grant_created" | "denied" | "cancelled" | "stale",
    extra: Partial<typeof PermissionLedgerTable.$inferInsert>,
  ): { settled: LedgerRow; won: boolean } {
    const row = {
      id: ledgerEventID(),
      request_id: request.id,
      event_type: eventType,
      time_created: Date.now(),
      ...extra,
      decision_slot: request.id,
    } satisfies typeof PermissionLedgerTable.$inferInsert
    try {
      db.insert(PermissionLedgerTable).values(row).run()
      return { settled: row as LedgerRow, won: true }
    } catch (error) {
      const winner = db
        .select()
        .from(PermissionLedgerTable)
        .where(eq(PermissionLedgerTable.decision_slot, request.id))
        .get()
      if (!winner) throw error
      return { settled: winner, won: false }
    }
  }

  async function releaseDecisionWaiters(request: Request, settled: LedgerRow): Promise<number> {
    const current = await state()
    const waiters = current.waiters.get(request.id) ?? []
    current.waiters.delete(request.id)
    for (const waiter of waiters) {
      if (["denied", "cancelled", "stale"].includes(settled.event_type)) {
        waiter.reject(new RejectedError(request.id, settled.reason ?? undefined))
      } else {
        waiter.resolve()
      }
    }
    return waiters.length
  }

  function assertSessionDeletionDeadline(deadline: number | undefined, label: string): void {
    if (deadline === undefined || Date.now() < deadline) return
    throw new SessionDeletionRuntimeNotSettledError(`Session deletion exceeded its deadline while ${label}`)
  }

  async function awaitWithinSessionDeletionDeadline<T>(
    settled: Promise<T>,
    deadline: number | undefined,
    label: string,
  ): Promise<T> {
    if (deadline === undefined) return await settled
    assertSessionDeletionDeadline(deadline, label)
    try {
      return await withTimeout(settled, Math.max(1, deadline - Date.now()), label)
    } catch (error) {
      if (error instanceof AwaitTimeoutError) {
        throw new SessionDeletionRuntimeNotSettledError(`Session deletion exceeded its deadline while ${label}`)
      }
      throw error
    }
  }

  async function awaitExecutionSettlement(request: Request, deadline?: number): Promise<void> {
    const attempt = attemptID(request.id)
    for (let remaining = 0; remaining < 1_000; remaining += 1) {
      assertSessionDeletionDeadline(deadline, `waiting for Permission execution ${attempt}`)
      const outcome = Database.use((db) =>
        db
          .select({ id: PermissionLedgerTable.id })
          .from(PermissionLedgerTable)
          .where(eq(PermissionLedgerTable.outcome_slot, attempt))
          .get(),
      )
      if (outcome) return
      await Bun.sleep(deadline === undefined ? 10 : Math.max(1, Math.min(10, deadline - Date.now())))
    }
    throw new Error(`Permission execution ${attempt} did not settle before Session deletion`)
  }

  function pendingRequest(requestIDValue: string): LedgerRow | undefined {
    const requested = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(
          and(eq(PermissionLedgerTable.request_id, requestIDValue), eq(PermissionLedgerTable.event_type, "requested")),
        )
        .get(),
    )
    return requested && !decisionFor(requestIDValue) ? requested : undefined
  }

  function activeGrant(request: Request): LedgerRow | undefined {
    const grants = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(
          and(
            eq(PermissionLedgerTable.event_type, "grant_created"),
            permissionRequestOwnerBelongsToProject(request.projectID),
          ),
        )
        .orderBy(desc(sql`rowid`))
        .all(),
    )
    if (grants.length === 0) return undefined
    const terminal = Database.use((db) =>
      db
        .select({ source: PermissionLedgerTable.source_event_id })
        .from(PermissionLedgerTable)
        .where(
          and(
            inArray(PermissionLedgerTable.event_type, ["revoked", "expired"]),
            isNotNull(PermissionLedgerTable.source_event_id),
          ),
        )
        .all(),
    )
    const inactive = new Set(terminal.map((row) => row.source).filter((value): value is string => Boolean(value)))
    return grants.find((grant) => {
      if (inactive.has(grant.id)) return false
      const owner = requestFromRow(grant)
      if (owner.projectID !== request.projectID || owner.fingerprint !== request.fingerprint) return false
      return (
        grant.decision_scope === "project" ||
        (grant.decision_scope === "task" && Boolean(request.taskID) && owner.taskID === request.taskID)
      )
    })
  }

  async function waitForDecision(request: Request): Promise<void> {
    const current = await state()
    const waiting = new Promise<void>((resolve, reject) => {
      const waiters = current.waiters.get(request.id) ?? []
      waiters.push({ resolve, reject })
      current.waiters.set(request.id, waiters)
    })
    // Register before publishing so a reply delivered by an event consumer
    // cannot commit between the durable decision check and waiter creation.
    const existing = decisionFor(request.id)
    if (existing) {
      current.waiters.delete(request.id)
      if (["denied", "cancelled", "stale"].includes(existing.event_type))
        throw new RejectedError(request.id, existing.reason ?? undefined)
      return
    }
    try {
      await Bus.publish(Event.Asked, request)
    } catch (error) {
      current.waiters.delete(request.id)
      throw error
    }
    return waiting
  }

  async function authorize(request: Request): Promise<LedgerRow> {
    assertRequestIdentity(request)
    const pending = pendingRequest(request.id)
    if (!pending)
      appendEvent(request, "requested", {
        metadata: { choices: request.choices, projectGrantEligible: request.projectGrantEligible },
      })
    if (request.mode === "full_access") {
      const existing = decisionFor(request.id)
      if (existing) return existing
      return settleDecision(request, "allowed_once", { actor_id: "full-access-policy" }).settled
    }
    const stale = staleFor(request.id)
    if (stale) throw new StaleContinuationError(request.id, stale.reason ?? undefined)
    const exactDecision = decisionFor(request.id)
    if (exactDecision) {
      if (["denied", "cancelled", "stale"].includes(exactDecision.event_type))
        throw new RejectedError(request.id, exactDecision.reason ?? undefined)
      return exactDecision
    }
    const grant = activeGrant(request)
    if (grant)
      return appendEvent(request, "grant_used", { source_event_id: grant.id, decision_scope: grant.decision_scope })
    await waitForDecision(request)
    const settled = decisionFor(request.id)
    if (!settled) throw new Error(`Permission request ${request.id} resumed without a durable decision`)
    if (["denied", "cancelled", "stale"].includes(settled.event_type))
      throw new RejectedError(request.id, settled.reason ?? undefined)
    return settled
  }

  export type InvocationIdentity = Readonly<{
    projectID: string
    sessionID: string
    messageID: string
    toolCallID: string
    toolPartID?: string
    providerKind: z.infer<typeof ToolInvocationProviderKind>
    providerID: string
    providerDigest?: string
    toolName: string
    args: unknown
  }>

  export const McpTask = z.object({
    taskId: z.string().min(1),
    status: z.enum(["working", "input_required", "completed", "failed", "cancelled"]),
    ttl: z.number().nullable(),
    createdAt: z.string(),
    lastUpdatedAt: z.string(),
    pollInterval: z.number().optional(),
    statusMessage: z.string().optional(),
  })
  export type McpTask = z.infer<typeof McpTask>

  function mcpTaskEvent(attempt: string): LedgerRow | undefined {
    return Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(
          and(
            eq(PermissionLedgerTable.attempt_id, attempt),
            inArray(PermissionLedgerTable.event_type, ["mcp_task_created", "mcp_task_status"]),
          ),
        )
        .orderBy(desc(sql`rowid`))
        .get(),
    )
  }

  function taskFromEvent(row: LedgerRow | undefined): McpTask | undefined {
    const parsed = McpTask.safeParse(row?.metadata?.task)
    return parsed.success ? parsed.data : undefined
  }

  /**
   * Returns the protocol task attached to the currently admitted MCP execution.
   * A recovered executor must query this task instead of issuing tools/call again.
   */
  export function currentMcpTask(): McpTask | undefined {
    const context = executionContext.getStore()
    return context ? taskFromEvent(mcpTaskEvent(context.attemptID)) : undefined
  }

  export function requireMcpExecutionContext(): { recovering: boolean; task?: McpTask } {
    const context = executionContext.getStore()
    if (!context) throw new Error("MCP Tool execution is outside the canonical permission authority")
    return { recovering: context.recovering, task: taskFromEvent(mcpTaskEvent(context.attemptID)) }
  }

  export function recordMcpTask(taskInput: McpTask): McpTask {
    const context = executionContext.getStore()
    if (!context) throw new Error("MCP protocol Task may only be recorded inside an admitted Tool execution")
    const task = McpTask.parse(taskInput)
    const existing = currentMcpTask()
    if (existing && existing.taskId !== task.taskId) {
      throw new Error(
        `Permission execution ${context.attemptID} changed MCP task identity from ${existing.taskId} to ${task.taskId}`,
      )
    }
    appendEvent(context.request, existing ? "mcp_task_status" : "mcp_task_created", {
      attempt_id: context.attemptID,
      metadata: { task },
    })
    return task
  }

  export async function authorizeAndExecute<T>(input: InvocationIdentity, execute: () => Promise<T>): Promise<T> {
    if (input.projectID !== Instance.project.id) {
      throw new Error(
        `Permission invocation project ${input.projectID} does not match active project ${Instance.project.id}`,
      )
    }
    const descriptor = await permissionDescriptor(input)
    if (!descriptor) {
      const expectedRequestID = exactContinuation.getStore()
      if (expectedRequestID) {
        const expected = pendingOrRequestedRequest(expectedRequestID)
        if (expected && !staleFor(expectedRequestID)) {
          appendEvent(expected, "stale", {
            reason: `Recovered Tool ${input.toolName} is no longer permission-bearing`,
          })
        }
        throw new StaleContinuationError(expectedRequestID, "The Tool permission classification changed after restart")
      }
      return execute()
    }
    const policy = await policyForSession(input)
    const taskID = taskIDForSession(input.sessionID)
    const request = Request.parse({
      id: requestID(input, descriptor),
      projectID: input.projectID,
      taskID,
      sessionID: input.sessionID,
      messageID: input.messageID,
      toolCallID: input.toolCallID,
      mode: policy.mode,
      policyRevision: policy.revision,
      providerKind: descriptor.providerKind,
      providerID: descriptor.providerID,
      providerDigest: descriptor.providerDigest,
      toolName: descriptor.toolName,
      effectClass: descriptor.effectClass,
      scopeVersion: descriptor.scopeVersion,
      scope: descriptor.scope,
      fingerprint: descriptor.fingerprint,
      summary: descriptor.summary,
      projectGrantEligible: descriptor.projectGrantEligible,
      choices: choices(descriptor.projectGrantEligible, Boolean(taskID)),
      timeCreated: Date.now(),
    })
    const expectedRequestID = exactContinuation.getStore()
    if (expectedRequestID && expectedRequestID !== request.id) {
      const expected = pendingOrRequestedRequest(expectedRequestID)
      if (expected && !staleFor(expectedRequestID)) {
        appendEvent(expected, "stale", {
          source_event_id: request.id,
          reason:
            `Recovered Tool identity changed: expected permission request ${expectedRequestID}, ` +
            `resolved ${request.id}`,
        })
      }
      throw new StaleContinuationError(expectedRequestID, "The Tool identity or input changed after restart")
    }
    const attempt = attemptID(request.id)
    assertAttemptIdentity(request, attempt)
    const authority = await authorize(request)
    await afterAuthorizationBeforeExecutionStartForTest?.(request)
    const existingStart = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(
          and(eq(PermissionLedgerTable.attempt_id, attempt), eq(PermissionLedgerTable.event_type, "execution_started")),
        )
        .get(),
    )
    const resolveExistingAttempt = async (start: LedgerRow): Promise<T> => {
      const outcome = Database.use((db) =>
        db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.outcome_slot, attempt)).get(),
      )
      if (!outcome) {
        const task = taskFromEvent(mcpTaskEvent(attempt))
        if (task) {
          const lease = acquireEffectLease(attempt)
          if (!lease) {
            await awaitExecutionSettlement(request)
            return resolveExistingAttempt(start)
          }
          let result: T
          try {
            result = await executeUnderEffectLease(lease, () =>
              executionContext.run({ request, attemptID: attempt, recovering: true }, execute),
            )
          } catch (error) {
            const latest = currentTaskForAttempt(attempt)
            if (latest && ["working", "input_required"].includes(latest.status)) {
              abandonEffectLease(lease)
              throw error
            }
            appendEffectOutcome(
              request,
              "execution_failed",
              {
                attempt_id: attempt,
                outcome_slot: attempt,
                reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
              },
              lease,
            )
            throw error
          }
          return completeExecution({
            request,
            attempt,
            toolPartID: input.toolPartID,
            result,
            lease,
          })
        }
        throw new OutcomeUnknownError(attempt)
      }
      if (outcome.event_type === "outcome_unknown") throw new OutcomeUnknownError(attempt)
      if (outcome.event_type === "execution_succeeded") {
        const stored = Database.use((db) =>
          db
            .select()
            .from(PermissionExecutionResultTable)
            .where(eq(PermissionExecutionResultTable.attempt_id, attempt))
            .get(),
        )
        if (!stored) throw new ExecutionAlreadySucceededError(request.id, attempt, input.toolPartID)
        return resultFromDurable<T>(stored.result)
      }
      if (outcome.event_type === "execution_reconciled" && outcome.metadata?.outcome === "execution_succeeded") {
        throw new OutcomeUnknownError(attempt)
      }
      throw new Error(`Permission execution ${attempt} already ended as ${outcome.event_type} and cannot be duplicated`)
    }
    if (existingStart) return resolveExistingAttempt(existingStart)
    try {
      appendEvent(request, "execution_started", { attempt_id: attempt, source_event_id: authority.id })
    } catch (error) {
      const winner = Database.use((db) =>
        db
          .select()
          .from(PermissionLedgerTable)
          .where(
            and(
              eq(PermissionLedgerTable.attempt_id, attempt),
              eq(PermissionLedgerTable.event_type, "execution_started"),
            ),
          )
          .get(),
      )
      if (winner) return resolveExistingAttempt(winner)
      throw error
    }
    const lease = acquireEffectLease(attempt)
    if (!lease) {
      await awaitExecutionSettlement(request)
      return resolveExistingAttempt(
        existingStart ??
          Database.use((db) =>
            db
              .select()
              .from(PermissionLedgerTable)
              .where(
                and(
                  eq(PermissionLedgerTable.attempt_id, attempt),
                  eq(PermissionLedgerTable.event_type, "execution_started"),
                ),
              )
              .get(),
          )!,
      )
    }
    let result: T
    try {
      result = await executeUnderEffectLease(lease, () =>
        executionContext.run({ request, attemptID: attempt, recovering: false }, execute),
      )
    } catch (error) {
      const task = currentTaskForAttempt(attempt)
      // Once the server has returned a protocol task identity, transport loss
      // or process shutdown is not a failed external effect. Leave the attempt
      // open so recovery reconnects and queries this exact task — but release
      // the effect owner, because this process is not the one that will.
      if (task && !["completed", "failed", "cancelled"].includes(task.status)) {
        abandonEffectLease(lease)
        throw error
      }
      appendEffectOutcome(
        request,
        "execution_failed",
        {
          attempt_id: attempt,
          outcome_slot: attempt,
          reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        },
        lease,
      )
      throw error
    }
    // A persistence failure here leaves a start without an outcome. Recovery
    // records outcome_unknown; it must not rewrite an effect that already ran
    // as execution_failed.
    return completeExecution({ request, attempt, toolPartID: input.toolPartID, result, lease })
  }

  function currentTaskForAttempt(attempt: string): McpTask | undefined {
    return taskFromEvent(mcpTaskEvent(attempt))
  }

  async function replyValidated(input: Reply & { userInput?: InteractionUserInput }) {
    const requested = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(
          and(eq(PermissionLedgerTable.request_id, input.requestID), eq(PermissionLedgerTable.event_type, "requested")),
        )
        .get(),
    )
    if (!requested) throw new Error(`Permission request not found: ${input.requestID}`)
    const request = requestFromRow(requested)
    if (!request.choices.includes(input.decision)) {
      throw new Error(`Permission decision ${input.decision} is not eligible for request ${input.requestID}`)
    }
    const eventType =
      input.decision === "deny" ? "denied" : input.decision === "allow_once" ? "allowed_once" : "grant_created"
    const timeResolved = Date.now()
    let settled: LedgerRow
    let wonDecision: boolean
    let userPublication: Bus.Publication | undefined
    if (input.userInput) {
      const result = Database.transaction((db) => {
        const decision = settleDecisionInTransaction(db, request, eventType, {
          decision_scope:
            input.decision === "allow_task" ? "task" : input.decision === "allow_project" ? "project" : "invocation",
          actor_id: input.actorID,
          reason: input.message,
          time_created: timeResolved,
        })
        if (decision.won) {
          const winnerDecision = decisionFromRow(decision.settled)
          userPublication = Bus.publishOwnedInTransaction(Event.Replied, {
            sessionID: request.sessionID,
            requestID: request.id,
            decision: winnerDecision,
            actorID: decision.settled.actor_id ?? input.actorID,
            autoReply: false,
            userInput: input.userInput,
          })
        }
        return decision
      })
      settled = result.settled
      wonDecision = result.won
    } else {
      const result = settleDecision(request, eventType, {
        decision_scope:
          input.decision === "allow_task" ? "task" : input.decision === "allow_project" ? "project" : "invocation",
        actor_id: input.actorID,
        reason: input.message,
      })
      settled = result.settled
      wonDecision = result.won
    }
    if (input.userInput) {
      // Only the transaction that won the authoritative decision owns the
      // terminal user occurrence. A concurrent loser returns that decision
      // without publishing its different text or a second terminal event.
      if (userPublication) await userPublication.retry()
    } else
      await Bus.publish(Event.Replied, {
        sessionID: request.sessionID,
        requestID: request.id,
        decision: decisionFromRow(settled),
        actorID: settled.actor_id ?? input.actorID,
        autoReply: input.autoReply,
      })
    const waiterCount = await releaseDecisionWaiters(request, settled)
    if (wonDecision && !["denied", "cancelled", "stale"].includes(settled.event_type) && waiterCount === 0) {
      await resumeRequest(request)
    }
    return Resolution.parse({
      request: requestFromRow(requested),
      decision: decisionFromRow(settled),
      eventID: settled.id,
    })
  }

  export const reply = fn(Reply, replyValidated)
  export const replyUser = fn(UserReply, async (input) => replyValidated({ ...input, autoReply: false }))

  export async function list(): Promise<Request[]> {
    const requested = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(eq(PermissionLedgerTable.event_type, "requested"))
        .orderBy(asc(sql`rowid`))
        .all(),
    )
    return requested.filter((row) => !decisionFor(row.request_id)).map(requestFromRow)
  }

  function pendingOrRequestedRequest(requestIDValue: string): Request | undefined {
    const requested = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(
          and(eq(PermissionLedgerTable.request_id, requestIDValue), eq(PermissionLedgerTable.event_type, "requested")),
        )
        .get(),
    )
    return requested ? requestFromRow(requested) : undefined
  }

  async function resumeRequest(request: Request): Promise<SessionLoopContinuationOutcome> {
    const { SessionLoop } = await import("@/session/loop")
    const outcome = await exactContinuation.run(request.id, () => SessionLoop.resumePermissionContinuation(request))
    if (outcome === "unresumable") {
      retireContinuation(request, "The persisted ToolPart is already terminal; no continuation can advance it")
      return outcome
    }
    // `live` is not a conclusion: the owning in-process Turn is still writing.
    // The request stays open so a scan after the Turn releases ownership can
    // settle it; retiring here would discard a continuation the owner may
    // still need recovered if it dies before persisting the outcome.
    if (outcome === "live") return outcome
    // `resumed` means the continuation reached its persisted conclusion, so it
    // is as finished as `unresumable` is and must be retired for the same
    // reason. Without this the request stays a replay candidate forever: every
    // later project open re-derives the same conclusion and writes nothing,
    // which is a non-convergent recovery whose cost is linear in the project's
    // whole approved history. A replay interrupted before its conclusion throws
    // instead of returning, and is left open on purpose.
    retireContinuation(request, "The continuation reached its persisted conclusion")
    return outcome
  }

  /**
   * Append the terminal ledger fact that closes a continuation which can never
   * run again. Retirement is what keeps recovery convergent: without it the
   * same dead request is rescanned by every later bootstrap.
   */
  function retireContinuation(request: Request, reason: string): void {
    try {
      if (staleFor(request.id)) return
      appendEvent(request, "stale", { reason })
    } catch (error) {
      log.error("permission continuation retirement failed", {
        requestID: request.id,
        sessionID: request.sessionID,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      })
    }
  }

  /**
   * Recovery is deliberately fault-isolated: one continuation that cannot run
   * must leave the remaining continuations — and the project bootstrap that
   * triggered recovery — intact.
   *
   * Every conclusion retires the request, because every conclusion is a
   * determinate fact about persisted state: `resumed` carried the continuation
   * to its end, `unresumable` says the ToolPart already holds a terminal fact,
   * and a stale continuation says the Tool surface, identity, classification or
   * input no longer matches what was approved, which nothing later can undo.
   * Leaving any of them open made recovery non-convergent: every project open
   * replayed the whole concluded backlog serially, and a few hundred of them
   * hold the first project-scoped request — the one the UI makes to open a
   * Task — for minutes.
   *
   * Any other fault is recorded and left open, because recovery cannot tell a
   * permanent fault from a transient one and must never discard a continuation
   * that a later attempt could still complete.
   */
  async function recoverContinuation(request: Request): Promise<SessionLoopContinuationOutcome | "failed"> {
    try {
      return await resumeRequest(request)
    } catch (error) {
      const stale = error instanceof StaleContinuationError || error instanceof TaskRootActivationSupersededError
      if (stale) retireContinuation(request, (error as Error).message)
      log.error("permission continuation recovery failed", {
        requestID: request.id,
        sessionID: request.sessionID,
        toolName: request.toolName,
        retired: stale,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      })
      return "failed"
    }
  }

  /**
   * Replay every approved continuation owned by the active project. The scan is
   * project-scoped because a ledger request only means anything inside the
   * project that produced it; a foreign project's evidence must never be
   * replayed here, and must never decide whether this project can open.
   *
   * Project open awaits this scan, so its cost is the first project-scoped
   * request's latency. Retirement is what bounds it: a converged ledger replays
   * nothing. The summary below is the observable that says whether it converged
   * — a `replayed` count that does not fall to zero across restarts is the
   * signature of a continuation class that concludes without being retired.
   * `live` replays are the one intentional exception: a request whose assistant
   * Message is owned by a prompt Turn running in this process is skipped
   * without retirement, because the owning Turn — not recovery — is the sole
   * writer; it converges on the first scan after that Turn releases ownership.
   */
  export async function resumeApprovedContinuations(): Promise<number> {
    const scanStarted = Date.now()
    const projectID = Instance.project.id
    const requested = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(and(eq(PermissionLedgerTable.event_type, "requested"), eq(PermissionLedgerTable.project_id, projectID)))
        .orderBy(asc(sql`rowid`))
        .all(),
    )
    let resumed = 0
    let replayed = 0
    let live = 0
    const replay = async (row: LedgerRow) => {
      replayed += 1
      const outcome = await recoverContinuation(requestFromRow(row))
      if (outcome === "resumed") resumed += 1
      if (outcome === "live") live += 1
    }
    for (const row of requested) {
      if (staleFor(row.request_id)) continue
      const decision = decisionFor(row.request_id)
      if (!decision || ["denied", "cancelled", "stale"].includes(decision.event_type)) continue
      const attempt = attemptID(row.request_id)
      const started = Database.use((db) =>
        db
          .select({ id: PermissionLedgerTable.id })
          .from(PermissionLedgerTable)
          .where(
            and(
              eq(PermissionLedgerTable.attempt_id, attempt),
              eq(PermissionLedgerTable.event_type, "execution_started"),
            ),
          )
          .get(),
      )
      if (started) {
        const outcome = Database.use((db) =>
          db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.outcome_slot, attempt)).get(),
        )
        if (outcome?.event_type === "execution_succeeded") {
          await replay(row)
          continue
        }
        if (!outcome && currentTaskForAttempt(attempt)) await replay(row)
        continue
      }
      await replay(row)
    }
    log.info("permission continuation recovery", {
      projectID,
      requested: requested.length,
      replayed,
      resumed,
      live,
      duration: Date.now() - scanStarted,
    })
    return resumed
  }

  export async function history(projectID = Instance.project.id): Promise<LedgerRow[]> {
    return Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(permissionRequestOwnerBelongsToProject(projectID))
        .orderBy(desc(sql`rowid`))
        .all(),
    )
  }

  export async function grants(projectID = Instance.project.id): Promise<LedgerRow[]> {
    const rows = await history(projectID)
    const inactive = new Set(
      rows
        .filter((row) => row.event_type === "revoked" || row.event_type === "expired")
        .map((row) => row.source_event_id)
        .filter((value): value is string => Boolean(value)),
    )
    return rows.filter((row) => row.event_type === "grant_created" && !inactive.has(row.id))
  }

  export async function revoke(grantID: string, actorID = "local-operator"): Promise<void> {
    const grant = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(and(eq(PermissionLedgerTable.id, grantID), eq(PermissionLedgerTable.event_type, "grant_created")))
        .get(),
    )
    if (!grant) throw new Error(`Permission grant not found: ${grantID}`)
    const request = requestFromRow(grant)
    appendEvent(request, "revoked", { source_event_id: grant.id, actor_id: actorID })
  }

  export async function expire(grantID: string, reason: string, actorID = "system"): Promise<void> {
    const grant = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(and(eq(PermissionLedgerTable.id, grantID), eq(PermissionLedgerTable.event_type, "grant_created")))
        .get(),
    )
    if (!grant) throw new Error(`Permission grant not found: ${grantID}`)
    appendEvent(requestFromRow(grant), "expired", {
      source_event_id: grant.id,
      actor_id: actorID,
      reason,
    })
  }

  export async function settleStale(requestIDValue: string, reason: string, actorID = "system"): Promise<Resolution> {
    const requested = pendingRequest(requestIDValue)
    if (!requested) {
      const settled = decisionFor(requestIDValue)
      if (!settled) throw new Error(`Permission request not found: ${requestIDValue}`)
      return Resolution.parse({
        request: requestFromRow(settled),
        decision: decisionFromRow(settled),
        eventID: settled.id,
      })
    }
    const request = requestFromRow(requested)
    const { settled } = settleDecision(request, "stale", {
      decision_scope: "invocation",
      actor_id: actorID,
      reason,
    })
    await releaseDecisionWaiters(request, settled)
    return Resolution.parse({ request, decision: decisionFromRow(settled), eventID: settled.id })
  }

  export const reconcileExecution = fn(Reconciliation, async (input) => {
    const unknown = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(
          and(
            eq(PermissionLedgerTable.attempt_id, input.attemptID),
            eq(PermissionLedgerTable.event_type, "outcome_unknown"),
          ),
        )
        .get(),
    )
    if (!unknown) throw new Error(`Unknown permission execution outcome not found: ${input.attemptID}`)
    const already = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(
          and(
            eq(PermissionLedgerTable.attempt_id, input.attemptID),
            eq(PermissionLedgerTable.event_type, "execution_reconciled"),
          ),
        )
        .get(),
    )
    if (already) return already
    return appendEvent(requestFromRow(unknown), "execution_reconciled", {
      attempt_id: input.attemptID,
      source_event_id: unknown.id,
      actor_id: input.actorID,
      reason: input.reason,
      metadata: { outcome: input.outcome },
    })
  })

  export async function cancelPendingForSession(
    sessionID: string,
    reason: string,
    actorID = "system",
  ): Promise<number> {
    return cancelPendingForSessions([sessionID], reason, actorID)
  }

  export function assertRequestsSettledForSessionsInTransaction(
    db: Database.TxOrDb,
    sessionIDs: readonly string[],
  ): void {
    const uniqueSessionIDs = [...new Set(sessionIDs)]
    for (let offset = 0; offset < uniqueSessionIDs.length; offset += 64) {
      const unsettled = db
        .select({ requestID: PermissionLedgerTable.request_id, sessionID: PermissionLedgerTable.session_id })
        .from(PermissionLedgerTable)
        .where(
          and(
            eq(PermissionLedgerTable.event_type, "requested"),
            inArray(PermissionLedgerTable.session_id, uniqueSessionIDs.slice(offset, offset + 64)),
            sql`(
              EXISTS (
                SELECT 1 FROM permission_ledger AS execution_start
                WHERE execution_start.request_id = ${PermissionLedgerTable.request_id}
                  AND execution_start.event_type = 'execution_started'
                  AND NOT EXISTS (
                    SELECT 1 FROM permission_ledger AS execution_outcome
                    WHERE execution_outcome.outcome_slot = execution_start.attempt_id
                  )
              )
              OR (
                NOT EXISTS (
                  SELECT 1 FROM permission_ledger AS execution_start
                  WHERE execution_start.request_id = ${PermissionLedgerTable.request_id}
                    AND execution_start.event_type = 'execution_started'
                )
                AND NOT EXISTS (
                  SELECT 1 FROM permission_ledger AS retirement
                  WHERE retirement.request_id = ${PermissionLedgerTable.request_id}
                    AND retirement.event_type IN ('denied', 'cancelled', 'stale')
                )
              )
            )`,
          ),
        )
        .orderBy(asc(sql`rowid`))
        .get()
      if (unsettled) {
        throw new SessionDeletionRuntimeNotSettledError(
          `Session deletion cannot settle while Permission request ${unsettled.requestID} for ${unsettled.sessionID} has no retired continuation or terminal execution outcome`,
        )
      }
    }
  }

  export async function cancelPendingForSessions(
    sessionIDs: readonly string[],
    reason: string,
    actorID = "system",
    options: { maxBatchesPerPage?: number; deadline?: number } = {},
  ): Promise<number> {
    const uniqueSessionIDs = [...new Set(sessionIDs)]
    let cancelled = 0
    for (let offset = 0; offset < uniqueSessionIDs.length; offset += 64) {
      const sessionPage = uniqueSessionIDs.slice(offset, offset + 64)
      const maxBatches = options.maxBatchesPerPage ?? Number.POSITIVE_INFINITY
      for (let batch = 0; batch < maxBatches; batch++) {
        if (options.deadline !== undefined && Date.now() >= options.deadline) {
          throw new SessionDeletionRuntimeNotSettledError(
            `Session deletion Permission settlement exceeded its deadline for ${sessionPage[0]}`,
          )
        }
        const pending = Database.use((db) =>
          db
            .select()
            .from(PermissionLedgerTable)
            .where(
              and(
                eq(PermissionLedgerTable.event_type, "requested"),
                inArray(PermissionLedgerTable.session_id, sessionPage),
                sql`NOT EXISTS (
                  SELECT 1
                  FROM permission_ledger AS decision
                  WHERE decision.decision_slot = ${PermissionLedgerTable.request_id}
                )`,
              ),
            )
            .orderBy(asc(sql`rowid`))
            .limit(64)
            .all(),
        )
        if (pending.length === 0) break
        if (afterSessionDeletionBatchSelectedForTest) {
          await awaitWithinSessionDeletionDeadline(
            Promise.resolve(
              afterSessionDeletionBatchSelectedForTest({
                sessionIDs: sessionPage,
                requestIDs: pending.map((row) => row.request_id),
              }),
            ),
            options.deadline,
            `preparing Permission settlement for ${sessionPage[0]}`,
          )
        }
        for (const row of pending) {
          assertSessionDeletionDeadline(options.deadline, `settling Permission request ${row.request_id}`)
          const request = requestFromRow(row)
          const { settled, won } = settleDecision(request, "cancelled", {
            decision_scope: "invocation",
            actor_id: actorID,
            reason,
          })
          const waiterCount = await awaitWithinSessionDeletionDeadline(
            releaseDecisionWaiters(request, settled),
            options.deadline,
            `releasing Permission waiters for ${request.id}`,
          )
          if (won) {
            cancelled += 1
            continue
          }
          if (["denied", "cancelled", "stale"].includes(settled.event_type)) continue
          if (waiterCount === 0) {
            await awaitWithinSessionDeletionDeadline(
              resumeRequest(request),
              options.deadline,
              `resuming Permission request ${request.id}`,
            )
          }
          await awaitExecutionSettlement(request, options.deadline)
        }
      }
    }
    return cancelled
  }

  export const TestHooks = {
    installAfterAuthorizationBeforeExecutionStart(hook: (request: Request) => void | Promise<void>): Disposable {
      if (afterAuthorizationBeforeExecutionStartForTest) {
        throw new Error("Permission authorization-before-execution hook is already installed")
      }
      afterAuthorizationBeforeExecutionStartForTest = hook
      return {
        [Symbol.dispose]() {
          if (afterAuthorizationBeforeExecutionStartForTest === hook) {
            afterAuthorizationBeforeExecutionStartForTest = undefined
          }
        },
      }
    },
    installAfterSessionDeletionBatchSelected(
      hook: (input: { sessionIDs: readonly string[]; requestIDs: readonly string[] }) => void | Promise<void>,
    ): Disposable {
      if (afterSessionDeletionBatchSelectedForTest) {
        throw new Error("Session deletion Permission batch hook is already installed")
      }
      afterSessionDeletionBatchSelectedForTest = hook
      return {
        [Symbol.dispose]() {
          if (afterSessionDeletionBatchSelectedForTest === hook) afterSessionDeletionBatchSelectedForTest = undefined
        },
      }
    },
  }

  export function reconcileInterruptedAttempts(): number {
    const starts = Database.use((db) =>
      db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.event_type, "execution_started")).all(),
    )
    let reconciled = 0
    // One malformed or unreadable ledger row degrades its own attempt only.
    // This runs inside project open, so throwing here would let a single bad
    // row keep the whole Project permanently unopenable.
    for (const start of starts) {
      try {
        if (!start.attempt_id) throw new Error(`Permission execution start ${start.id} has no attempt identity`)
        const outcome = Database.use((db) =>
          db
            .select()
            .from(PermissionLedgerTable)
            .where(eq(PermissionLedgerTable.outcome_slot, start.attempt_id!))
            .get(),
        )
        if (outcome) continue
        if (currentTaskForAttempt(start.attempt_id)) continue
        appendEvent(requestFromRow(start), "outcome_unknown", {
          attempt_id: start.attempt_id,
          outcome_slot: start.attempt_id,
          source_event_id: start.id,
          reason: "Runtime restarted before a terminal Tool outcome was recorded",
        })
        log.warn("permission execution outcome unknown after recovery", { attemptID: start.attempt_id })
        reconciled += 1
      } catch (error) {
        log.error("permission execution attempt could not be reconciled after recovery", {
          eventID: start.id,
          attemptID: start.attempt_id ?? "<missing>",
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return reconciled
  }

  export class RejectedError extends Error {
    constructor(
      readonly requestID: string,
      message?: string,
    ) {
      super(message ? `The operator denied this Tool call: ${message}` : "The operator denied this Tool call.")
    }
  }

  export class PermissionIdentityCollisionError extends Error {
    override readonly name = "PermissionIdentityCollisionError"
    readonly code = "PERMISSION_IDENTITY_COLLISION"

    constructor(
      readonly identity: string,
      readonly family: "request" | "attempt",
    ) {
      super(`Compact Permission ${family} identity ${identity} is already bound to different canonical material`)
    }
  }

  export class PermissionPausedError extends Error {
    constructor(readonly requestID: string) {
      super(`Permission request ${requestID} remains durably pending after runtime release.`)
    }
  }

  export class OutcomeUnknownError extends Error {
    constructor(readonly attemptID: string) {
      super(`Tool execution ${attemptID} has an unknown outcome and must be reconciled before retry.`)
    }
  }

  export class ExecutionAlreadySucceededError extends Error {
    constructor(
      readonly requestID: string,
      readonly attemptID: string,
      readonly toolPartID?: string,
    ) {
      super(`Tool execution ${attemptID} already succeeded; its result belongs to the canonical Session ToolPart.`)
      this.name = "ExecutionAlreadySucceededError"
    }
  }

  export class StaleContinuationError extends Error {
    constructor(
      readonly requestID: string,
      message?: string,
    ) {
      super(message ? `Permission continuation is stale: ${message}` : "Permission continuation is stale.")
      this.name = "StaleContinuationError"
    }
  }
}
