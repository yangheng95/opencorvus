import { isDeepStrictEqual } from "node:util"
import { eq, inArray, or, sql } from "drizzle-orm"
import { Identifier } from "@/id/id"
import type { Database } from "@/storage/db"
import { PermissionDecision } from "./decision"
import { resultFromDurable } from "./execution-result"
import { PermissionExecutionResultTable, PermissionLedgerTable } from "./permission.sql"
import { PermissionIdentity, PermissionRequest, type PermissionProviderKind } from "./types"

type Row = typeof PermissionLedgerTable.$inferSelect
type Result = typeof PermissionExecutionResultTable.$inferSelect
type Format = "current" | "historical"
export type PermissionLedgerIntegrityReason =
  | "event_kind_invalid" | "event_shape_invalid" | "request_owner_missing" | "request_owner_conflict"
  | "request_identity_invalid" | "scope_version_unsupported" | "scope_material_invalid"
  | "decision_slot_conflict" | "decision_kind_invalid" | "decision_scope_invalid"
  | "index_shape_invalid" | "index_source_invalid" | "grant_source_invalid" | "grant_scope_mismatch"
  | "grant_capture_conflict" | "grant_capture_ambiguous" | "grant_capture_unindexed"
  | "execution_attempt_invalid" | "execution_start_conflict" | "execution_authority_mismatch"
  | "execution_outcome_invalid" | "execution_result_invalid"

export class PermissionLedgerIntegrityError extends Error {
  override readonly name = "PermissionLedgerIntegrityError"
  readonly code = "PERMISSION_LEDGER_INTEGRITY"
  constructor(readonly reason: PermissionLedgerIntegrityReason, readonly requestID: string,
    readonly eventIDs: readonly string[] = [], readonly field?: string, options?: ErrorOptions) {
    super(`Permission ledger ${reason} for ${requestID}${field ? ` (${field})` : ""}`, options)
  }
}

export function permissionRequestIdentity(input: {
  projectID: string; sessionID: string; messageID: string; toolCallID: string; fingerprint: string
}): string {
  return Identifier.deterministic("permission", `request\0${JSON.stringify({ projectID: input.projectID,
    sessionID: input.sessionID, messageID: input.messageID, toolCallID: input.toolCallID, fingerprint: input.fingerprint })}`)
}

export function permissionAttemptIdentity(requestID: string): string {
  return Identifier.deterministic("permission", `attempt\0${requestID}`)
}

export function permissionProjectGrantEligible(input: {
  providerKind: PermissionProviderKind; toolName: string; effectClass: string; resource: Record<string, unknown>
}): boolean {
  if (input.providerKind !== "builtin") return false
  if (input.effectClass === "read_local") {
    return input.resource.scope_type === "filesystem" && Array.isArray(input.resource.paths) && input.resource.paths.length > 0
  }
  if (input.effectClass === "network_read" && input.toolName === "webfetch") {
    return input.resource.scope_type === "network" && input.resource.endpoint !== undefined
  }
  return false
}

export function permissionChoices(projectGrantEligible: boolean, hasTask: boolean): PermissionDecision[] {
  return ["allow_once", ...(hasTask ? ["allow_task" as const] : []),
    ...(projectGrantEligible ? ["allow_project" as const] : []), "deny"]
}

const ownerFields = ["project_id", "session_id", "task_id", "message_id", "tool_call_id", "mode", "policy_revision",
  "provider_kind", "provider_id", "provider_digest", "tool_name", "effect_class", "scope_version", "scope", "fingerprint"] as const
const eventKinds = new Set<Row["event_type"]>(["requested", "allowed_once", "grant_created", "grant_used",
  "grant_decision_indexed", "denied", "expired", "revoked", "cancelled", "stale", "execution_started",
  "mcp_task_created", "mcp_task_status", "execution_succeeded", "execution_failed", "outcome_unknown", "execution_reconciled"])
const directKinds = new Set<Row["event_type"]>(["allowed_once", "grant_created", "grant_used", "denied", "cancelled", "stale"])
const terminalKinds = new Set<Row["event_type"]>(["execution_succeeded", "execution_failed", "outcome_unknown"])
const attemptKinds = new Set<Row["event_type"]>(["execution_started", "mcp_task_created", "mcp_task_status",
  "execution_succeeded", "execution_failed", "outcome_unknown", "execution_reconciled"])
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value))
function fail(reason: PermissionLedgerIntegrityReason, requestID: string, rows: readonly Row[] = [], field?: string, cause?: unknown): never {
  throw new PermissionLedgerIntegrityError(reason, requestID, rows.map(row => row.id), field, cause === undefined ? undefined : { cause })
}

type Material = {
  groups: Map<string, Row[]>; byID: Map<string, Row>; slots: Map<string, Row[]>; results: Map<string, Result>
  owners: Map<string, { requested: Row; request: PermissionRequest; rows: Row[] }>
}

function material(rows: Row[], results: Result[]): Material {
  const value: Material = { groups: new Map(), byID: new Map(), slots: new Map(), results: new Map(), owners: new Map() }
  const starts = new Map<string, Row>(), outcomes = new Map<string, Row>()
  for (const row of rows) {
    if (value.byID.has(row.id)) fail("event_shape_invalid", row.request_id, [row], "id")
    value.byID.set(row.id, row)
    const group = value.groups.get(row.request_id) ?? []
    group.push(row); value.groups.set(row.request_id, group)
    if (row.decision_slot !== null) {
      const slot = value.slots.get(row.decision_slot) ?? []
      slot.push(row); value.slots.set(row.decision_slot, slot)
      if (slot.length > 1 || row.decision_slot !== row.request_id) fail("decision_slot_conflict", row.request_id, slot)
    }
    if (row.event_type === "execution_started" && row.attempt_id) {
      const prior = starts.get(row.attempt_id)
      if (prior) fail("execution_start_conflict", row.request_id, [prior, row])
      starts.set(row.attempt_id, row)
    }
    if (row.outcome_slot) {
      const prior = outcomes.get(row.outcome_slot)
      if (prior) fail("execution_outcome_invalid", row.request_id, [prior, row], "outcome_slot")
      outcomes.set(row.outcome_slot, row)
    }
  }
  for (const result of results) {
    if (value.results.has(result.attempt_id)) fail("execution_result_invalid", result.attempt_id)
    value.results.set(result.attempt_id, result)
    if (!starts.has(result.attempt_id)) fail("execution_result_invalid", result.attempt_id, [], "missing start")
  }
  return value
}

function requestOwner(data: Material, requestID: string): { requested: Row; request: PermissionRequest; rows: Row[] } {
  const qualified = data.owners.get(requestID)
  if (qualified) return qualified
  const rows = data.groups.get(requestID) ?? []
  const owners = rows.filter(row => row.event_type === "requested")
  const requested = owners[0]
  if (!requested) fail("request_owner_missing", requestID, rows)
  for (const row of rows) {
    if (!eventKinds.has(row.event_type)) fail("event_kind_invalid", requestID, [row])
    if (!PermissionIdentity.safeParse(row.id).success || !PermissionIdentity.safeParse(row.request_id).success ||
      !Number.isSafeInteger(row.time_created) || row.time_created <= 0) fail("event_shape_invalid", requestID, [row], "id/time")
    if (row.event_type !== "requested" && [...ownerFields, "summary" as const].some(field => row[field] !== null))
      fail("event_shape_invalid", requestID, [row], "delta owner")
    if (row.event_type === "requested" && [row.decision_slot, row.decision_scope, row.source_event_id, row.attempt_id, row.outcome_slot].some(v => v !== null))
      fail("event_shape_invalid", requestID, [row], "requested delta")
  }
  for (const row of owners) {
    for (const field of ownerFields) if (!isDeepStrictEqual(row[field], requested[field]))
      fail("request_owner_conflict", requestID, [requested, row], field)
  }
  if (requested.scope_version !== "2") fail("scope_version_unsupported", requestID, [requested])
  if (!object(requested.scope) || !object(requested.scope.resource)) fail("scope_material_invalid", requestID, [requested])
  for (const field of ["provider_kind", "provider_id", "provider_digest", "tool_name", "effect_class"] as const)
    if (requested.scope[field] !== requested[field]) fail("scope_material_invalid", requestID, [requested], field)
  const parsedProvider = PermissionRequest.shape.providerKind.safeParse(requested.provider_kind)
  if (!parsedProvider.success) fail("scope_material_invalid", requestID, [requested], "provider_kind", parsedProvider.error)
  const eligible = permissionProjectGrantEligible({ providerKind: parsedProvider.data, toolName: requested.tool_name!,
    effectClass: requested.effect_class!, resource: requested.scope.resource })
  const request = PermissionRequest.safeParse({ id: requestID, projectID: requested.project_id,
    taskID: requested.task_id ?? undefined, sessionID: requested.session_id, messageID: requested.message_id,
    toolCallID: requested.tool_call_id, mode: requested.mode, policyRevision: requested.policy_revision,
    providerKind: requested.provider_kind, providerID: requested.provider_id, providerDigest: requested.provider_digest,
    toolName: requested.tool_name, effectClass: requested.effect_class, scopeVersion: requested.scope_version,
    scope: requested.scope, fingerprint: requested.fingerprint, summary: requested.summary,
    projectGrantEligible: eligible, choices: requested.metadata && Object.hasOwn(requested.metadata, "choices")
      ? requested.metadata.choices : permissionChoices(eligible, Boolean(requested.task_id)),
    timeCreated: requested.time_created })
  if (!request.success) fail("scope_material_invalid", requestID, [requested], "Request", request.error)
  if (permissionRequestIdentity(request.data) !== requestID) fail("request_identity_invalid", requestID, [requested])
  const owner = { requested, request: request.data, rows }
  data.owners.set(requestID, owner)
  return owner
}

function directDecision(row: Row, request: PermissionRequest): PermissionDecision {
  if (!directKinds.has(row.event_type)) fail("decision_kind_invalid", request.id, [row])
  if (row.attempt_id !== null || row.outcome_slot !== null) fail("event_shape_invalid", request.id, [row], "decision attempt")
  if (row.event_type !== "grant_used" && row.source_event_id !== null) fail("event_shape_invalid", request.id, [row], "decision source")
  if (row.event_type === "denied" || row.event_type === "cancelled" || row.event_type === "stale") {
    if (row.decision_scope !== "invocation") fail("decision_scope_invalid", request.id, [row])
    return "deny"
  }
  if (row.event_type === "allowed_once") {
    if (row.decision_scope === "invocation" ||
      (row.decision_scope === null && request.mode === "full_access" && row.actor_id === "full-access-policy")) return "allow_once"
    fail("decision_scope_invalid", request.id, [row])
  }
  if (row.decision_scope === "task" && request.taskID && request.choices.includes("allow_task")) return "allow_task"
  if (row.decision_scope === "project" && request.projectGrantEligible && request.choices.includes("allow_project")) return "allow_project"
  fail("decision_scope_invalid", request.id, [row])
}

function sourceGrant(data: Material, row: Row): { grant: Row; request: PermissionRequest } {
  const grant = row.source_event_id ? data.byID.get(row.source_event_id) : undefined
  if (!grant || grant.event_type !== "grant_created" || grant.decision_slot !== grant.request_id)
    fail("grant_source_invalid", row.request_id, [row])
  const source = requestOwner(data, grant.request_id)
  if (data.slots.get(grant.request_id)?.length !== 1) fail("grant_source_invalid", row.request_id, [row, grant])
  directDecision(grant, source.request)
  const conflictingUses = source.rows.filter(candidate => candidate.event_type === "grant_used")
  if (conflictingUses.length) fail("grant_capture_conflict", grant.request_id, [grant, ...conflictingUses])
  return { grant, request: source.request }
}

type BaseFacts = { requested: Row; request: PermissionRequest; rows: readonly Row[]; start?: Row; outcome?: Row; result?: Result; retirement?: Row }
export type PermissionRequestFacts = BaseFacts & (
  | { slotLocator: undefined; authority: undefined; decision: undefined; autoReply: false }
  | { slotLocator: Row; authority: Row; decision: PermissionDecision; autoReply: boolean }
)

function qualifyRequestGraph(data: Material, requestID: string, format: Format): {
  facts: PermissionRequestFacts; index?: { requestID: string; sourceEventID: string }
} {
  const { requested, request, rows } = requestOwner(data, requestID)
  const attempt = permissionAttemptIdentity(requestID)
  const starts = rows.filter(row => row.event_type === "execution_started")
  if (starts.length > 1) fail("execution_start_conflict", requestID, starts)
  const start = starts[0]
  const uses = rows.filter(row => row.event_type === "grant_used")
  const locator = data.slots.get(requestID)?.[0]
  if (locator && locator.event_type !== "grant_decision_indexed" && uses.some(use => use.id !== locator.id))
    fail("grant_capture_conflict", requestID, [locator, ...uses])
  for (const use of uses) {
    directDecision(use, request)
    const source = sourceGrant(data, use)
    const grantOwner = source.request
    if (use.decision_scope !== source.grant.decision_scope || request.projectID !== grantOwner.projectID ||
      request.fingerprint !== grantOwner.fingerprint || request.providerKind !== grantOwner.providerKind ||
      request.providerID !== grantOwner.providerID || request.providerDigest !== grantOwner.providerDigest ||
      request.toolName !== grantOwner.toolName || request.effectClass !== grantOwner.effectClass ||
      request.scopeVersion !== grantOwner.scopeVersion || !isDeepStrictEqual(request.scope, grantOwner.scope) ||
      (use.decision_scope === "task" && (!request.taskID || request.taskID !== grantOwner.taskID)))
      fail("grant_scope_mismatch", requestID, [use, source.grant])
  }
  let authority: Row | undefined = locator
  let index: { requestID: string; sourceEventID: string } | undefined
  if (locator?.event_type === "grant_decision_indexed") {
    if (locator.actor_id !== "schema-migration" || !isDeepStrictEqual(locator.metadata, { migrationVersion: 2 }) ||
      [locator.decision_scope, locator.attempt_id, locator.outcome_slot, locator.reason].some(v => v !== null))
      fail("index_shape_invalid", requestID, [locator])
    authority = locator.source_event_id ? data.byID.get(locator.source_event_id) : undefined
    if (!authority || authority.event_type !== "grant_used" || authority.request_id !== requestID || authority.decision_slot !== null)
      fail("index_source_invalid", requestID, [locator])
  } else if (locator) {
    directDecision(locator, request)
  } else if (uses.length) {
    if (format === "current") fail("grant_capture_unindexed", requestID, uses)
    authority = uses.length === 1 ? uses[0] : uses.find(use => use.id === start?.source_event_id)
    if (!authority) fail("grant_capture_ambiguous", requestID, uses)
    index = { requestID, sourceEventID: authority.id }
  }
  if (uses.length > 1 && authority && (!start || start.source_event_id !== authority.id))
    fail("grant_capture_ambiguous", requestID, uses)
  for (const row of rows) {
    if (row.event_type === "grant_decision_indexed" && row.id !== locator?.id) fail("index_shape_invalid", requestID, [row])
    if (directKinds.has(row.event_type) && row.event_type !== "grant_used" && row.event_type !== "stale" && row.id !== locator?.id)
      fail("decision_slot_conflict", requestID, [row])
    if (row.event_type === "revoked" || row.event_type === "expired") {
      const source = sourceGrant(data, row)
      if (source.grant.request_id !== requestID || row.decision_scope !== null) fail("grant_source_invalid", requestID, [row])
    }
    if (row.event_type === "stale" && row.decision_slot === null && row.source_event_id !== null &&
      !PermissionIdentity.safeParse(row.source_event_id).success) fail("event_shape_invalid", requestID, [row], "retirement source")
    if (attemptKinds.has(row.event_type)) {
      if (row.attempt_id !== attempt || row.decision_slot !== null || row.decision_scope !== null)
        fail("execution_attempt_invalid", requestID, [row])
      if (!start) fail("execution_attempt_invalid", requestID, [row], "missing start")
      if (terminalKinds.has(row.event_type)) {
        if (row.outcome_slot !== attempt) fail("execution_outcome_invalid", requestID, [row])
      } else if (row.outcome_slot !== null) fail("execution_outcome_invalid", requestID, [row])
    } else if (row.attempt_id !== null || row.outcome_slot !== null) fail("execution_attempt_invalid", requestID, [row])
    if (row.event_type === "outcome_unknown" && row.source_event_id !== start?.id) fail("execution_outcome_invalid", requestID, [row])
    if (row.event_type === "execution_reconciled") {
      const source = row.source_event_id ? data.byID.get(row.source_event_id) : undefined
      if (source?.event_type !== "outcome_unknown" || source.request_id !== requestID || source.attempt_id !== attempt ||
        !["execution_succeeded", "execution_failed"].includes(String(row.metadata?.outcome))) fail("execution_outcome_invalid", requestID, [row])
    }
  }
  const decision = authority ? directDecision(authority, request) : undefined
  if (start && (!authority || decision === "deny" || start.source_event_id !== authority.id))
    fail("execution_authority_mismatch", requestID, [start, ...(authority ? [authority] : [])])
  const outcomes = rows.filter(row => terminalKinds.has(row.event_type))
  if (outcomes.length > 1) fail("execution_outcome_invalid", requestID, outcomes)
  const outcome = outcomes[0], result = data.results.get(attempt)
  if ((outcome?.event_type === "execution_succeeded") !== Boolean(result)) fail("execution_result_invalid", requestID, outcomes)
  if (result) {
    try { resultFromDurable(result.result) } catch (cause) { fail("execution_result_invalid", requestID, outcomes, "envelope", cause) }
    if (!Number.isSafeInteger(result.time_created) || result.time_created <= 0) fail("execution_result_invalid", requestID, [], "time")
  }
  const base = { requested, request, rows, start, outcome, result,
    retirement: rows.find(row => row.event_type === "stale") }
  // Historical selections are returned only as migration plans, never runtime facts.
  if (!locator) return { facts: { ...base, slotLocator: undefined, authority: undefined, decision: undefined, autoReply: false }, index }
  if (!authority || !decision) fail("decision_kind_invalid", requestID, [locator])
  return { facts: { ...base, slotLocator: locator, authority, decision, autoReply: authority.event_type === "grant_used" } }
}

function wholeGraph(db: Database.TxOrDb, format: Format) {
  const rows = db.select().from(PermissionLedgerTable).orderBy(sql`rowid`).all()
  const data = material(rows, db.select().from(PermissionExecutionResultTable).all())
  return [...data.groups.keys()].map(requestID => qualifyRequestGraph(data, requestID, format))
}

/** Already inside the physical startup/migration transaction. No nested BEGIN. */
export function validateCurrentPermissionLedger(db: Database.TxOrDb): void { wholeGraph(db, "current") }

/** Validate the complete historical graph before the caller appends any index facts. */
export function planHistoricalGrantDecisionIndexes(db: Database.TxOrDb): Array<{ requestID: string; sourceEventID: string }> {
  return wholeGraph(db, "historical").flatMap(value => value.index ? [value.index] : [])
}

/** Fixed reference depth: this request, then its explicit source grants' request groups. */
export function readPermissionRequestFacts(db: Database.TxOrDb, requestID: string): PermissionRequestFacts | undefined {
  return db.transaction(tx => {
    const rows = tx.select().from(PermissionLedgerTable)
      .where(or(eq(PermissionLedgerTable.request_id, requestID), eq(PermissionLedgerTable.decision_slot, requestID)))
      .orderBy(sql`rowid`).all()
    if (!rows.length) return undefined
    const grantIDs = [...new Set(rows.filter(row => row.event_type === "grant_used" || row.event_type === "revoked" || row.event_type === "expired")
      .flatMap(row => row.source_event_id ? [row.source_event_id] : []))]
    let sourceRequests: string[] = []
    if (grantIDs.length) {
      const sources = tx.select().from(PermissionLedgerTable).where(inArray(PermissionLedgerTable.id, grantIDs)).all()
      sourceRequests = [...new Set(sources.map(row => row.request_id).filter(id => id !== requestID))]
      if (sourceRequests.length) rows.push(...tx.select().from(PermissionLedgerTable)
        .where(inArray(PermissionLedgerTable.request_id, sourceRequests)).orderBy(sql`rowid`).all())
    }
    const attempts = [...new Set(rows.flatMap(row => row.attempt_id ? [row.attempt_id] : [])), permissionAttemptIdentity(requestID)]
    const results = tx.select().from(PermissionExecutionResultTable).where(inArray(PermissionExecutionResultTable.attempt_id, attempts)).all()
    const data = material(rows, results)
    // A source grant is a direct-slot owner. Its complete graph must satisfy
    // the same rules; qualifying those fixed-depth groups needs no recursive reads.
    for (const sourceRequest of sourceRequests) qualifyRequestGraph(data, sourceRequest, "current")
    return qualifyRequestGraph(data, requestID, "current").facts
  })
}
