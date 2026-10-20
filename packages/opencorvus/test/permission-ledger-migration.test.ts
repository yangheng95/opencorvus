import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { eq, sql } from "drizzle-orm"
import { Identifier } from "@/id/id"
import { permissionDescriptor } from "@/permission/invocation"
import { permissionAttemptIdentity, permissionRequestIdentity, readPermissionRequestFacts,
  validateCurrentPermissionLedger, PermissionLedgerIntegrityError } from "@/permission/ledger-facts"
import { PermissionLedgerTable, PermissionExecutionResultTable } from "@/permission/permission.sql"
import { ApplicationSchema } from "@/storage/schema"
import { DATABASE_MIGRATIONS } from "@/storage/migrations"
import { migrateSchema, schemaVersion, SchemaMigrationError } from "@/storage/schema-migration"
import { queryAllFinalized } from "@/storage/sqlite-statement"
import { Database, DatabaseUnavailableError } from "@/storage/db"
import { createTestDatabase, editTestDatabase, resetDatabase } from "./fixture/db"
import { Server } from "@/server/server"

type Row = typeof PermissionLedgerTable.$inferSelect
const current = DATABASE_MIGRATIONS.at(-1)!
function fixture() {
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw Error("Migration contract requires the isolated package test runtime")
  const directory = fs.mkdtempSync(path.join(root, "grant-ledger-")), databasePath = path.join(directory, "ledger.db")
  const sqlite = new SQLite(databasePath)
  sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000")
  sqlite.exec(DATABASE_MIGRATIONS[0]!.ddl)
  sqlite.exec("PRAGMA user_version=1")
  const db = drizzle({ client: sqlite, schema: ApplicationSchema })
  return { sqlite, db, databasePath, directory, [Symbol.dispose]() { sqlite.close(true); fs.rmSync(directory, { recursive: true, force: true }) } }
}
async function request(value: ReturnType<typeof fixture>, name: string, options: { project?: string; task?: string; mode?: "ask" | "full_access"; choices?: unknown } = {}) {
  const descriptor = (await permissionDescriptor({ providerKind: "builtin", providerID: "builtin", toolName: "webfetch",
    args: { url: "https://example.test/public-report" } }))!
  const identity = { projectID: options.project ?? "retained-project", sessionID: `retained-session-${name}`,
    messageID: `retained-message-${name}`, toolCallID: `call-${name}`, fingerprint: descriptor.fingerprint }
  const row = value.db.insert(PermissionLedgerTable).values({ id: Identifier.ascending("permission"),
    request_id: permissionRequestIdentity(identity), event_type: "requested", project_id: identity.projectID,
    session_id: identity.sessionID, task_id: options.task, message_id: identity.messageID, tool_call_id: identity.toolCallID,
    mode: options.mode ?? "ask", policy_revision: "captured-policy", provider_kind: descriptor.providerKind,
    provider_id: descriptor.providerID, provider_digest: descriptor.providerDigest, tool_name: descriptor.toolName,
    effect_class: descriptor.effectClass, scope_version: descriptor.scopeVersion, scope: descriptor.scope,
    fingerprint: descriptor.fingerprint, summary: descriptor.summary, time_created: 100,
    ...(Object.hasOwn(options, "choices") ? { metadata: { choices: options.choices } } : {}),
  }).returning().get()!
  return row
}
function event(value: ReturnType<typeof fixture>, owner: Row, type: Row["event_type"], extra: Partial<typeof PermissionLedgerTable.$inferInsert> = {}) {
  return value.db.insert(PermissionLedgerTable).values({ id: Identifier.ascending("permission"), request_id: owner.request_id,
    event_type: type, time_created: 200, ...extra }).returning().get()!
}
function rows(value: ReturnType<typeof fixture>) { return value.db.select().from(PermissionLedgerTable).orderBy(sql`rowid`).all() }
function migrate(value: ReturnType<typeof fixture>) {
  return migrateSchema({ sqlite: value.sqlite, databasePath: value.databasePath, migrations: DATABASE_MIGRATIONS,
    currentDDL: current.ddl, validate: () => validateCurrentPermissionLedger(value.db) })
}
function expectFailure(value: ReturnType<typeof fixture>, reason: PermissionLedgerIntegrityError["reason"]) {
  const before = rows(value)
  let caught: unknown
  try { migrate(value) } catch (error) { caught = error }
  expect(caught instanceof SchemaMigrationError ? { code: caught.code, cause: caught.cause } : caught).toMatchObject({
    code: "SCHEMA_MIGRATION_FAILED", cause: { code: "PERMISSION_LEDGER_INTEGRITY", reason },
  })
  expect({ version: schemaVersion(value.sqlite), rows: rows(value) }).toEqual({ version: 1, rows: before })
  expect(queryAllFinalized(value.sqlite, "PRAGMA locking_mode")).toEqual([{ locking_mode: "normal" }])
}

test("revision 2 indexes a unique retained capture, preserves original bytes and reopens current facts", async () => {
  using value = fixture()
  const owner = await request(value, "grant"), captured = await request(value, "capture")
  const grant = event(value, owner, "grant_created", { decision_slot: owner.request_id, decision_scope: "project", actor_id: "original-operator" })
  const use = event(value, captured, "grant_used", { source_event_id: grant.id, decision_scope: "project", time_created: 300 })
  event(value, owner, "revoked", { source_event_id: grant.id, actor_id: "later-operator", time_created: 400 })
  const before = rows(value)
  const receipt = migrate(value)
  expect({ from: receipt.from, to: receipt.to }).toEqual({ from: 1, to: current.version })
  const original = rows(value).slice(0, before.length)
  expect(original).toEqual(before)
  const facts = readPermissionRequestFacts(value.db, captured.request_id)!
  expect({ requested: facts.requested, authority: facts.authority, decision: facts.decision, autoReply: facts.autoReply }).toEqual({
    requested: captured, authority: use, decision: "allow_project", autoReply: true,
  })
  expect(facts.slotLocator).toMatchObject({ event_type: "grant_decision_indexed", request_id: captured.request_id,
    decision_slot: captured.request_id, source_event_id: use.id, actor_id: "schema-migration", metadata: { migrationVersion: 2 },
    decision_scope: null, attempt_id: null, outcome_slot: null, reason: null, project_id: null, session_id: null })
  expect(facts.slotLocator!.time_created).toBeGreaterThan(400)
  const backup = new SQLite(receipt.backupPath!, { readonly: true })
  try {
    const backupDB = drizzle({ client: backup, schema: ApplicationSchema })
    expect({ version: schemaVersion(backup), rows: backupDB.select().from(PermissionLedgerTable).orderBy(sql`rowid`).all() })
      .toEqual({ version: 1, rows: before })
  } finally { backup.close(true) }
  const after = rows(value)
  expect(migrate(value)).toEqual({ from: current.version, to: current.version })
  expect(rows(value)).toEqual(after)
})

test("the deterministic started authority selects the original capture among multiple historical observations", async () => {
  using value = fixture()
  const owner = await request(value, "grant"), captured = await request(value, "capture")
  const grant = event(value, owner, "grant_created", { decision_slot: owner.request_id, decision_scope: "project" })
  const earlier = event(value, captured, "grant_used", { source_event_id: grant.id, decision_scope: "project" })
  const chosen = event(value, captured, "grant_used", { source_event_id: grant.id, decision_scope: "project" })
  const attempt = permissionAttemptIdentity(captured.request_id)
  const started = event(value, captured, "execution_started", { source_event_id: chosen.id, attempt_id: attempt })
  value.db.insert(PermissionExecutionResultTable).values({ attempt_id: attempt, result: { kind: "json", value: { output: "original report" } }, time_created: 500 }).run()
  const outcome = event(value, captured, "execution_succeeded", { attempt_id: attempt, outcome_slot: attempt, time_created: 500 })
  migrate(value)
  const facts = readPermissionRequestFacts(value.db, captured.request_id)!
  expect({ authority: facts.authority, start: facts.start, outcome: facts.outcome, captures: facts.rows.filter(row => row.event_type === "grant_used") })
    .toEqual({ authority: chosen, start: started, outcome, captures: [earlier, chosen] })
  expect(facts.result?.result).toEqual({ kind: "json", value: { output: "original report" } })
})

test("conflicting preexisting authority retains the complete old graph and reports the exact migration error", async () => {
  using value = fixture()
  const owner = await request(value, "grant"), captured = await request(value, "capture")
  const grant = event(value, owner, "grant_created", { decision_slot: owner.request_id, decision_scope: "project" })
  event(value, captured, "grant_used", { source_event_id: grant.id, decision_scope: "project" })
  event(value, captured, "denied", { decision_slot: captured.request_id, decision_scope: "invocation", actor_id: "operator" })
  expectFailure(value, "grant_capture_conflict")
})

test("ambiguous capture observations preserve their v1 graph with an explicit diagnostic", async () => {
  using value = fixture()
  const owner = await request(value, "grant"), captured = await request(value, "capture")
  const grant = event(value, owner, "grant_created", { decision_slot: owner.request_id, decision_scope: "project" })
  event(value, captured, "grant_used", { source_event_id: grant.id, decision_scope: "project" })
  event(value, captured, "grant_used", { source_event_id: grant.id, decision_scope: "project" })
  expectFailure(value, "grant_capture_ambiguous")
})

test("the current reader validates all direct decisions including original Full-access policy authority", async () => {
  using value = fixture()
  for (const type of ["allowed_once", "denied", "cancelled", "stale"] as const) {
    const owner = await request(value, type)
    const decision = event(value, owner, type, { decision_slot: owner.request_id, decision_scope: "invocation", actor_id: "operator" })
    const facts = readPermissionRequestFacts(value.db, owner.request_id)!
    expect({ authority: facts.authority, slot: facts.slotLocator, decision: facts.decision, auto: facts.autoReply })
      .toEqual({ authority: decision, slot: decision, decision: type === "allowed_once" ? "allow_once" : "deny", auto: false })
  }
  const owner = await request(value, "full", { mode: "full_access" })
  const decision = event(value, owner, "allowed_once", { decision_slot: owner.request_id, actor_id: "full-access-policy" })
  expect(readPermissionRequestFacts(value.db, owner.request_id)).toMatchObject({ authority: decision, decision: "allow_once", autoReply: false })
  migrate(value)
  expect(schemaVersion(value.sqlite)).toBe(current.version)
})

test("current slotless captures, cross-Project grants and conflicting immutable owners have precise integrity errors", async () => {
  for (const kind of ["unindexed", "project", "owner"] as const) {
    using value = fixture()
    const owner = await request(value, "grant"), captured = await request(value, "capture", kind === "project" ? { project: "another-project" } : {})
    const grant = event(value, owner, "grant_created", { decision_slot: owner.request_id, decision_scope: "project" })
    if (kind === "owner") value.db.insert(PermissionLedgerTable).values({ ...captured, id: Identifier.ascending("permission"), tool_name: "changed" }).run()
    else event(value, captured, "grant_used", { source_event_id: grant.id, decision_scope: "project", ...(kind === "project" ? { decision_slot: captured.request_id } : {}) })
    let caught: unknown
    try { readPermissionRequestFacts(value.db, captured.request_id) } catch (error) { caught = error }
    expect(caught).toMatchObject({ code: "PERMISSION_LEDGER_INTEGRITY",
      reason: kind === "unindexed" ? "grant_capture_unindexed" : kind === "project" ? "grant_scope_mismatch" : "request_owner_conflict" })
  }
})

test("read snapshots preserve nested savepoint ownership and canonical duplicate requested observations", async () => {
  using value = fixture()
  const owner = await request(value, "retained")
  value.db.insert(PermissionLedgerTable).values({ ...owner, id: Identifier.ascending("permission"), summary: "Later observation", time_created: 600 }).run()
  const inside = value.db.transaction(tx => {
    const facts = readPermissionRequestFacts(tx, owner.request_id)!
    event(value, owner, "allowed_once", { decision_slot: owner.request_id, decision_scope: "invocation" })
    return { before: facts.request, after: readPermissionRequestFacts(tx, owner.request_id)!.decision }
  })
  expect({ originalTime: inside.before.timeCreated, originalSummary: inside.before.summary, after: inside.after })
    .toEqual({ originalTime: owner.time_created, originalSummary: owner.summary!, after: "allow_once" })
  validateCurrentPermissionLedger(value.db)
  expect(value.db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.request_id, owner.request_id)).all()).toHaveLength(3)
})

test("a captured grant's original execution graph has the same canonical validation as the requested graph", async () => {
  for (const kind of ["authority", "result", "capture"] as const) {
    using value = fixture()
    const owner = await request(value, "grant"), captured = await request(value, "capture")
    const grant = event(value, owner, "grant_created", { decision_slot: owner.request_id, decision_scope: "project" })
    event(value, captured, "grant_used", { source_event_id: grant.id, decision_scope: "project", decision_slot: captured.request_id,
      actor_id: "saved-grant-policy" })
    const attempt = permissionAttemptIdentity(owner.request_id)
    if (kind === "capture") event(value, owner, "grant_used", { source_event_id: grant.id, decision_scope: "project" })
    else {
      event(value, owner, "execution_started", { attempt_id: attempt,
        source_event_id: kind === "authority" ? Identifier.ascending("permission") : grant.id })
      if (kind === "result") event(value, owner, "execution_succeeded", { attempt_id: attempt, outcome_slot: attempt })
    }
    const reason = kind === "authority" ? "execution_authority_mismatch" : kind === "result" ? "execution_result_invalid" : "grant_capture_conflict"
    for (const read of [() => readPermissionRequestFacts(value.db, captured.request_id), () => validateCurrentPermissionLedger(value.db)]) {
      let caught: unknown
      try { read() } catch (error) { caught = error }
      expect(caught).toMatchObject({ code: "PERMISSION_LEDGER_INTEGRITY", reason, requestID: owner.request_id })
    }
  }
})

test("the current production opener reports an unindexed capture as data integrity with the existing public 503 contract", async () => {
  using value = fixture()
  const owner = await request(value, "grant"), captured = await request(value, "capture")
  const grant = event(value, owner, "grant_created", { decision_slot: owner.request_id, decision_scope: "project" })
  event(value, captured, "grant_used", { source_event_id: grant.id, decision_scope: "project" })
  const original = rows(value)
  await createTestDatabase()
  try {
    editTestDatabase(sqlite => {
      const db = drizzle({ client: sqlite, schema: ApplicationSchema })
      db.insert(PermissionLedgerTable).values(original).run()
    })
    let caught: unknown
    try { Database.Client() } catch (error) { caught = error }
    expect(DatabaseUnavailableError.isInstance(caught) ? caught.data : caught).toMatchObject({
      code: "DATA_INTEGRITY_ERROR", operation: "Database.Client.dataIntegrity.permissionLedger",
    })
    expect(caught instanceof Error ? caught.cause : undefined).toMatchObject({
      name: "DatabaseUnavailableError", cause: {
        code: "PERMISSION_LEDGER_INTEGRITY", reason: "grant_capture_unindexed", requestID: captured.request_id,
      },
    })
    const response = await Server.App().request("/permission", { headers: { "x-opencorvus-directory": value.directory } })
    expect({ status: response.status, body: await response.json() }).toMatchObject({
      status: 503, body: { name: "DatabaseUnavailableError", data: { code: "DATA_INTEGRITY_ERROR" } },
    })
    editTestDatabase(sqlite => {
      const db = drizzle({ client: sqlite, schema: ApplicationSchema })
      expect({ version: schemaVersion(sqlite), rows: db.select().from(PermissionLedgerTable).orderBy(sql`rowid`).all() })
        .toEqual({ version: current.version, rows: original })
    })
  } finally { await resetDatabase() }
})

test("an explicitly present null choice set reports its scope integrity error and retains the original owner", async () => {
  using value = fixture()
  const owner = await request(value, "explicit-null-choices", { choices: null })
  let caught: unknown
  try { readPermissionRequestFacts(value.db, owner.request_id) } catch (error) { caught = error }
  expect(caught).toMatchObject({ code: "PERMISSION_LEDGER_INTEGRITY", reason: "scope_material_invalid",
    requestID: owner.request_id, field: "Request" })
  expect(rows(value)).toEqual([owner])
})
