import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Config } from "@/config/config"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Database, and, asc, desc, eq, inArray, isNotNull, sql } from "@/storage/db"
import { fn } from "@/util/fn"
import { Log } from "@/util/log"
import { createHash, randomUUID } from "node:crypto"
import { AsyncLocalStorage } from "node:async_hooks"
import z from "zod"
import { InteractionUserInput } from "@/memory/project-memory"
import {
  permissionDescriptor,
  permissionProjectGrantEligible,
  type InvocationPermissionDescriptor,
  PermissionProviderKind,
} from "./invocation"
import { PermissionExecutionResultTable, PermissionLedgerTable, PermissionPolicyTable } from "./permission.sql"

export namespace PermissionAuthority {
  const log = Log.create({ service: "permission-authority" })

  export const Mode = z.enum(["full_access", "ask"]).meta({ ref: "PermissionMode" })
  export type Mode = z.infer<typeof Mode>

  export const Decision = z.enum(["allow_once", "allow_task", "allow_project", "deny"]).meta({
    ref: "PermissionDecision",
  })
  export type Decision = z.infer<typeof Decision>

  export const Request = z
    .object({
      id: z.string().min(1),
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
      id: z.string(),
      request_id: z.string(),
      project_id: z.string(),
      session_id: z.string(),
      task_id: z.string().nullable(),
      message_id: z.string(),
      tool_call_id: z.string(),
      attempt_id: z.string().nullable(),
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
      source_event_id: z.string().nullable(),
      actor_id: z.string().nullable(),
      reason: z.string().nullable(),
      time_created: z.number(),
    })
    .passthrough()

  export const Reply = z
    .object({
      requestID: z.string().min(1),
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
    eventID: z.string().min(1),
  })
  export type Resolution = z.infer<typeof Resolution>

  export const Reconciliation = z
    .object({
      attemptID: z.string().min(1),
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
        requestID: z.string(),
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

  function requestID(input: InvocationIdentity, descriptor: InvocationPermissionDescriptor): string {
    return `prm_${digest({
      projectID: input.projectID,
      sessionID: input.sessionID,
      messageID: input.messageID,
      toolCallID: input.toolCallID,
      fingerprint: descriptor.fingerprint,
    }).slice(0, 40)}`
  }

  function attemptID(requestIDValue: string): string {
    return `pat_${digest(requestIDValue).slice(0, 40)}`
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
    const migration = config.permission_migration
    if (migration) {
      const slot = `permission-migration:${input.projectID}:v${migration.version}`
      const scope = { migration }
      try {
        Database.transaction((db) =>
          db
            .insert(PermissionLedgerTable)
            .values({
              id: `ple_${randomUUID()}`,
              request_id: slot,
              project_id: input.projectID,
              session_id: input.sessionID,
              message_id: input.messageID,
              tool_call_id: input.toolCallID,
              event_type: "policy_migrated",
              mode,
              policy_revision: digest({ slot, mode }),
              provider_kind: "builtin",
              provider_id: "config",
              provider_digest: digest(scope),
              tool_name: "permission_config_migration",
              effect_class: "internal",
              scope_version: "2",
              scope,
              fingerprint: digest({ slot, scope }),
              summary: `Legacy permission configuration migrated to ${mode}`,
              decision_slot: slot,
              actor_id: "config-migration",
              reason: migration.reason,
              metadata: { source_fields: migration.source_fields },
              time_created: Date.now(),
            })
            .run(),
        )
      } catch (error) {
        if (!decisionFor(slot)) throw error
      }
    }
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
      id: `ple_${randomUUID()}`,
      ...rowBase(request),
      event_type: eventType,
      time_created: Date.now(),
      ...extra,
    }
    Database.transaction((db) => db.insert(PermissionLedgerTable).values(row).run())
    return row as LedgerRow
  }

  type DurableExecutionResult = { kind: "json"; value: unknown } | { kind: "undefined" }

  function durableExecutionResult(result: unknown): {
    payload: DurableExecutionResult
    serialized: string
    sha256: string
  } {
    const payload: DurableExecutionResult =
      result === undefined ? { kind: "undefined" } : { kind: "json", value: result }
    const serialized = JSON.stringify(payload)
    if (serialized === undefined) {
      throw new Error("Tool result cannot be durably represented")
    }
    return { payload: JSON.parse(serialized) as DurableExecutionResult, serialized, sha256: digest(serialized) }
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
    metadata?: Record<string, unknown>
  }): T {
    const durable = durableExecutionResult(input.result)
    const event: typeof PermissionLedgerTable.$inferInsert = {
      id: `ple_${randomUUID()}`,
      ...rowBase(input.request),
      event_type: "execution_succeeded",
      attempt_id: input.attempt,
      outcome_slot: input.attempt,
      metadata: {
        result_owner: "session_tool_part",
        ...(input.toolPartID ? { tool_part_id: input.toolPartID } : {}),
        result_sha256: durable.sha256,
        ...input.metadata,
      },
      time_created: Date.now(),
    }
    Database.immediateTransaction((db) => {
      db.insert(PermissionExecutionResultTable)
        .values({
          attempt_id: input.attempt,
          session_id: input.request.sessionID,
          tool_part_id: input.toolPartID ?? input.request.toolCallID,
          result: durable.payload,
          result_sha256: durable.sha256,
          time_created: Date.now(),
        })
        .onConflictDoNothing()
        .run()
      db.insert(PermissionLedgerTable).values(event).run()
    })
    return input.result
  }

  function requestFromRow(row: LedgerRow): Request {
    const resource =
      row.scope && typeof row.scope === "object" && !Array.isArray(row.scope)
        ? (row.scope.resource as Record<string, unknown> | undefined)
        : undefined
    const projectGrantEligible =
      row.scope_version === "2" && resource
        ? permissionProjectGrantEligible({
            providerKind: PermissionProviderKind.parse(row.provider_kind),
            toolName: row.tool_name,
            effectClass: row.effect_class as InvocationPermissionDescriptor["effectClass"],
            resource,
          })
        : false
    return Request.parse({
      id: row.request_id,
      projectID: row.project_id,
      taskID: row.task_id ?? undefined,
      sessionID: row.session_id,
      messageID: row.message_id,
      toolCallID: row.tool_call_id,
      mode: row.mode,
      policyRevision: row.policy_revision,
      providerKind: row.provider_kind,
      providerID: row.provider_id,
      providerDigest: row.provider_digest,
      toolName: row.tool_name,
      effectClass: row.effect_class,
      scopeVersion: row.scope_version,
      scope: row.scope,
      fingerprint: row.fingerprint,
      summary: row.summary,
      projectGrantEligible,
      choices: choices(projectGrantEligible, Boolean(row.task_id)),
      timeCreated: row.time_created,
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
      id: `ple_${randomUUID()}`,
      ...rowBase(request),
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

  async function awaitExecutionSettlement(request: Request): Promise<void> {
    const attempt = attemptID(request.id)
    for (let remaining = 0; remaining < 1_000; remaining += 1) {
      const outcome = Database.use((db) =>
        db
          .select({ id: PermissionLedgerTable.id })
          .from(PermissionLedgerTable)
          .where(eq(PermissionLedgerTable.outcome_slot, attempt))
          .get(),
      )
      if (outcome) return
      await Bun.sleep(10)
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
            eq(PermissionLedgerTable.project_id, request.projectID),
            eq(PermissionLedgerTable.fingerprint, request.fingerprint),
            eq(PermissionLedgerTable.event_type, "grant_created"),
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
    return grants.find(
      (grant) =>
        !inactive.has(grant.id) &&
        (grant.decision_scope === "project" ||
          (grant.decision_scope === "task" && Boolean(request.taskID) && grant.task_id === request.taskID)),
    )
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
    if (request.mode === "full_access") return appendEvent(request, "full_access")
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
    const pending = pendingRequest(request.id)
    if (!pending) appendEvent(request, "requested")
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
    providerKind: z.infer<typeof PermissionProviderKind>
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
    const authority = await authorize(request)
    const attempt = attemptID(request.id)
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
          let result: T
          try {
            result = await executionContext.run({ request, attemptID: attempt, recovering: true }, execute)
          } catch (error) {
            const latest = currentTaskForAttempt(attempt)
            if (latest && ["working", "input_required"].includes(latest.status)) throw error
            appendEvent(request, "execution_failed", {
              attempt_id: attempt,
              outcome_slot: attempt,
              reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
            })
            throw error
          }
          return completeExecution({
            request,
            attempt,
            toolPartID: input.toolPartID,
            result,
            metadata: { mcp_task_id: task.taskId },
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
    let result: T
    try {
      result = await executionContext.run({ request, attemptID: attempt, recovering: false }, execute)
    } catch (error) {
      const task = currentTaskForAttempt(attempt)
      // Once the server has returned a protocol task identity, transport loss
      // or process shutdown is not a failed external effect. Leave the attempt
      // open so recovery reconnects and queries this exact task.
      if (task && !["completed", "failed", "cancelled"].includes(task.status)) throw error
      appendEvent(request, "execution_failed", {
        attempt_id: attempt,
        outcome_slot: attempt,
        reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      })
      throw error
    }
    // A persistence failure here leaves a start without an outcome. Recovery
    // records outcome_unknown; it must not rewrite an effect that already ran
    // as execution_failed.
    return completeExecution({ request, attempt, toolPartID: input.toolPartID, result })
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

  async function resumeRequest(request: Request): Promise<void> {
    const { SessionLoop } = await import("@/session/loop")
    await exactContinuation.run(request.id, () => SessionLoop.resumePermissionContinuation(request))
  }

  export async function resumeApprovedContinuations(): Promise<number> {
    const requested = Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(eq(PermissionLedgerTable.event_type, "requested"))
        .orderBy(asc(sql`rowid`))
        .all(),
    )
    let resumed = 0
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
          await resumeRequest(requestFromRow(row))
          resumed += 1
          continue
        }
        if (!outcome && currentTaskForAttempt(attempt)) {
          await resumeRequest(requestFromRow(row))
          resumed += 1
        }
        continue
      }
      await resumeRequest(requestFromRow(row))
      resumed += 1
    }
    return resumed
  }

  export async function history(projectID = Instance.project.id): Promise<LedgerRow[]> {
    return Database.use((db) =>
      db
        .select()
        .from(PermissionLedgerTable)
        .where(eq(PermissionLedgerTable.project_id, projectID))
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
    const pending = (await list()).filter((request) => request.sessionID === sessionID)
    let cancelled = 0
    for (const request of pending) {
      const { settled, won } = settleDecision(request, "cancelled", {
        decision_scope: "invocation",
        actor_id: actorID,
        reason,
      })
      const waiterCount = await releaseDecisionWaiters(request, settled)
      if (won) {
        cancelled += 1
        continue
      }
      if (["denied", "cancelled", "stale"].includes(settled.event_type)) continue
      if (waiterCount === 0) await resumeRequest(request)
      await awaitExecutionSettlement(request)
    }
    return cancelled
  }

  export function reconcileInterruptedAttempts(): number {
    const starts = Database.use((db) =>
      db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.event_type, "execution_started")).all(),
    )
    let reconciled = 0
    for (const start of starts) {
      if (!start.attempt_id) throw new Error(`Permission execution start ${start.id} has no attempt identity`)
      const outcome = Database.use((db) =>
        db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.outcome_slot, start.attempt_id!)).get(),
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
