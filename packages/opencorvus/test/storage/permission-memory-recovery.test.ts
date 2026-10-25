import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { eq, sql } from "drizzle-orm"
import { Identifier } from "@/id/id"
import { permissionDescriptor } from "@/permission/invocation"
import { permissionRequestIdentity, validateCurrentPermissionLedger } from "@/permission/ledger-facts"
import { PermissionLedgerTable } from "@/permission/permission.sql"
import { ApplicationSchema } from "@/storage/schema"
import { DATABASE_MIGRATIONS } from "@/storage/migrations"
import { migrateSchema, schemaVersion, type SchemaMigration } from "@/storage/schema-migration"
import { validateHistoricalPermissionMemoryDeliveries } from "@/storage/migrations/0005-atomic-permission-memory"
import { EngineTaskTable, EngineInteractionRequestTable } from "@/engine/engine.sql"
import { projectInteractionRowInTransaction } from "@/engine/store"
import { ProjectTable } from "@/project/project.sql"
import { SessionTable } from "@/session/session.sql"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { BusPublicationOutboxTable, BusPublicationDeliveryReceiptTable } from "@/bus/bus.sql"
import { MemoryFileTable, MemoryChunkTable } from "@/memory/memory.sql"
import { Entry, insertEntry } from "@/memory/project-memory-entry"

const current = DATABASE_MIGRATIONS.at(-1)!
const subscriber = "engine.interaction.permission-replied"
function fixture(version = 4) {
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw Error("Recovery tests require the isolated package runner")
  const directory = fs.mkdtempSync(path.join(root, "permission-memory-")),
    databasePath = path.join(directory, "history.db")
  const sqlite = new SQLite(databasePath)
  sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000")
  sqlite.exec(DATABASE_MIGRATIONS[version - 1]!.ddl)
  sqlite.exec(`PRAGMA user_version=${version}`)
  const db = drizzle({ client: sqlite, schema: ApplicationSchema })
  return {
    sqlite,
    db,
    databasePath,
    [Symbol.dispose]() {
      sqlite.close(true)
      fs.rmSync(directory, { recursive: true, force: true })
    },
  }
}
type Fixture = ReturnType<typeof fixture>
function snapshot(value: Fixture) {
  return value.sqlite
    .query<{ name: string; wr: number }, []>(
      "SELECT name,wr FROM pragma_table_list WHERE schema='main' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map(({ name, wr }) => ({ name, rows: value.sqlite.query(`SELECT ${wr ? "" : "rowid,"}* FROM "${name}"`).all() }))
}
function run(value: Fixture, migrations: readonly SchemaMigration[] = DATABASE_MIGRATIONS) {
  return migrateSchema({
    ...value,
    migrations,
    currentDDL: current.ddl,
    validate: () => validateCurrentPermissionLedger(value.db),
  })
}
async function source(
  value: Fixture,
  name = "original",
  state: "pending" | "covered" | "unknown" | "fresh" | "success" | "early" | "retired" = "unknown",
) {
  const { db, sqlite } = value
  const projectID = `project-${name}`,
    sessionID = `session-${name}`,
    taskID = `task-${name}`
  db.insert(ProjectTable).values({ id: projectID, worktree: value.databasePath, sandboxes: [] }).run()
  db.insert(SessionTable)
    .values({
      id: sessionID,
      project_id: projectID,
      directory: value.databasePath,
      slug: name,
      title: "Old Session",
      version: "test",
      kind: "root",
    })
    .run()
  db.insert(EngineTaskTable)
    .values({
      id: taskID,
      project_id: projectID,
      session_id: sessionID,
      product_pillar: "work",
      title: "Later Task title",
      request: "Original task",
      time_created: 50,
    })
    .run()
  const descriptor = (await permissionDescriptor({
    providerKind: "builtin",
    providerID: "builtin",
    toolName: "webfetch",
    args: { url: `https://example.test/${name}` },
  }))!
  const requestID = permissionRequestIdentity({
    projectID,
    sessionID,
    messageID: `message-${name}`,
    toolCallID: `call-${name}`,
    fingerprint: descriptor.fingerprint,
  })
  const requested = db
    .insert(PermissionLedgerTable)
    .values({
      id: Identifier.ascending("permission"),
      request_id: requestID,
      event_type: "requested",
      project_id: projectID,
      session_id: sessionID,
      task_id: taskID,
      message_id: `message-${name}`,
      tool_call_id: `call-${name}`,
      mode: "ask",
      policy_revision: "original-policy",
      provider_kind: descriptor.providerKind,
      provider_id: descriptor.providerID,
      provider_digest: descriptor.providerDigest,
      tool_name: descriptor.toolName,
      effect_class: descriptor.effectClass,
      scope_version: descriptor.scopeVersion,
      scope: descriptor.scope,
      fingerprint: descriptor.fingerprint,
      summary: descriptor.summary,
      time_created: 100,
    })
    .returning()
    .get()!
  db.insert(PermissionLedgerTable)
    .values({
      id: Identifier.ascending("permission"),
      request_id: requestID,
      event_type: "allowed_once",
      decision_slot: requestID,
      decision_scope: "invocation",
      actor_id: "original-operator",
      time_created: 200,
    })
    .run()
  const occurrenceID = `original-publication-${name}`,
    interactionID = `interaction-${name}`
  const input = {
    surface: "http.permission",
    text: "Original human evidence.",
    structured: { decision: "allow_once", message: "Original human evidence." },
  }
  db.insert(BusPublicationOutboxTable)
    .values({
      occurrence_id: occurrenceID,
      project_id: name === "cross-project" ? "conflicting-project" : projectID,
      directory: value.databasePath,
      event_type: "permission.replied",
      properties: {
        requestID,
        sessionID,
        decision: "allow_once",
        actorID: "original-operator",
        autoReply: false,
        userInput: input,
      },
      time_created: 200,
    })
    .run()
  if (state !== "early") {
    if (name === "orphan-conflict") db.insert(EngineTaskTable).values({ id: "conflicting-original-task", project_id: projectID,
      product_pillar: "work", title: "Different retained owner", request: "Independent original task", time_created: 50 }).run()
    db.insert(EngineInteractionRequestTable)
      .values({ id: interactionID, source_kind: "permission_request", source_id: requested.id })
      .run()
    db.insert(ProtocolEventTable)
      .values({
        id: Identifier.ascending("protocol_event"),
        kind: "event",
        type: "interaction.requested",
        aggregate_type: "task",
        aggregate_id: name === "orphan-conflict" ? "conflicting-original-task" : taskID,
        project_id: projectID,
        interaction_id: interactionID,
        source: "interaction.permission",
        seq: 1,
        emitted_at: 100,
        payload: { requestType: "permission", summary: "Original request" },
      })
      .run()
  }
  sqlite.run(
    "INSERT INTO engine_control_activation_lease(id,target,target_id,owner_occurrence_id,time_activated,expires_at) VALUES(?,?,?,?,?,?)",
    [`lease-${name}`, "bus_delivery", `${occurrenceID}\0exact\0${subscriber}`, `old-owner-${name}`, 200, 300],
  )
  if (state === "pending")
    insertEntry(
      db,
      Entry.parse({
        version: 1,
        occurrenceKind: "interaction_reply",
        occurrenceID: interactionID,
        projectID,
        sessionID,
        taskID,
        ownerKind: "task",
        ownerID: taskID,
        ownerNameAtCapture: "Actual old Task title",
        ...input,
        timeCreated: 200,
        attachments: [],
        context: [
          { messageID: "old-context", role: "user", author: "user", text: "Only the old context", attachments: [] },
        ],
      }),
    )
  if (state === "covered" || state === "unknown") {
    const fileID = Identifier.deterministic("memory", `project-context\0${projectID}`)
    const chunkID = Identifier.deterministic("memchunk", `project-context\0${projectID}`)
    const content = JSON.stringify({
      version: 1,
      revision: 2,
      markdown: "# Preserve original document\n",
      tokenCount: 9,
      status: "idle",
      recentCoveredOccurrenceIDs:
        state === "covered" ? [interactionID] : Array.from({ length: 500 }, (_, i) => `later-${i}`),
      droppedPendingCount: 0,
      availabilityGeneration: 0,
      timeCreated: 100,
      timeUpdated: 900,
    })
    db.insert(MemoryFileTable)
      .values({
        id: fileID,
        project_id: projectID,
        title: "Project MEMORY.MD",
        source: "reflection",
        kind: "project_context",
        key: "project-memory-document",
      })
      .run()
    db.insert(MemoryChunkTable)
      .values({ id: chunkID, file_id: fileID, project_id: projectID, content, token_count: 9 })
      .run()
  }
  if (state === "success")
    db.insert(BusPublicationDeliveryReceiptTable)
      .values({
        id: "old-success",
        occurrence_id: occurrenceID,
        phase: "exact",
        subscriber_id: subscriber,
        outcome: "succeeded",
        time_created: 210,
      })
      .run()
  if (state === "retired")
    db.insert(ProtocolEventTable)
      .values({
        id: Identifier.ascending("protocol_event"),
        kind: "event",
        type: "task.deleted",
        aggregate_type: "task",
        aggregate_id: taskID,
        project_id: projectID,
        source: "task.delete",
        seq: 2,
        emitted_at: 500,
        payload: { origin: "operator" },
      })
      .run()
  return { projectID, sessionID, taskID, requestID, occurrenceID, interactionID, input }
}
function memory(value: Fixture) {
  return value.db
    .select()
    .from(MemoryChunkTable)
    .orderBy(sql`rowid`)
    .all()
}

test("an original pending payload keeps its exact bytes when its physical owner is missing", async () => {
  using value = fixture()
  const original = await source(value, "orphan-pending", "pending")
  value.db.delete(EngineTaskTable).where(eq(EngineTaskTable.id, original.taskID)).run()
  const before = memory(value)
  expect(run(value)).toMatchObject({ from: 4, to: current.version })
  expect(memory(value)).toEqual(before)
  expect(receipts(value)).toEqual([
    expect.objectContaining({ occurrence_id: original.occurrenceID, outcome: "succeeded" }),
  ])
})

test("a retained interaction owner conflict is diagnosed before unresolved-owner preservation", async () => {
  using value = fixture()
  const original = await source(value, "orphan-conflict", "fresh")
  value.db.delete(EngineTaskTable).where(eq(EngineTaskTable.id, original.taskID)).run()
  const before = snapshot(value)
  expect(() => run(value)).toThrow(
    expect.objectContaining({
      code: "SCHEMA_MIGRATION_REQUIRED",
      message: expect.stringContaining("conflicting immutable Task owner"),
    }),
  )
  expect({ version: schemaVersion(value.sqlite), data: snapshot(value) }).toEqual({ version: 4, data: before })
})
function receipts(value: Fixture) {
  return value.db
    .select()
    .from(BusPublicationDeliveryReceiptTable)
    .orderBy(sql`rowid`)
    .all()
}

for (const state of ["pending", "covered", "unknown", "fresh", "success", "early", "retired"] as const) {
  test(`v6 upgrades the original ${state} permission input and preserves its evidence on repeat`, async () => {
    using value = fixture()
    const original = await source(value, state, state),
      oldMemory = memory(value)
    const oldSource = value.db.select().from(BusPublicationOutboxTable).all()
    const oldLedger = value.db.select().from(PermissionLedgerTable).all()
    const oldLeases = value.sqlite.query("SELECT * FROM engine_control_activation_lease").all()
    const started = Date.now()
    if (state !== "success")
      expect(() => validateHistoricalPermissionMemoryDeliveries(value.sqlite)).toThrow(
        expect.objectContaining({ code: "SCHEMA_MIGRATION_REQUIRED" }),
      )
    const result = run(value)
    expect({ from: result.from, to: result.to, version: schemaVersion(value.sqlite) }).toEqual({
      from: 4,
      to: current.version,
      version: current.version,
    })
    expect({
      source: value.db.select().from(BusPublicationOutboxTable).all(),
      ledger: value.db.select().from(PermissionLedgerTable).all(),
      leases: value.sqlite.query("SELECT * FROM engine_control_activation_lease").all(),
    }).toEqual({ source: oldSource, ledger: oldLedger, leases: oldLeases })
    expect(receipts(value)).toEqual([
      expect.objectContaining({
        occurrence_id: original.occurrenceID,
        outcome: "succeeded",
        time_created: state === "success" ? 210 : expect.any(Number),
      }),
    ])
    if (state !== "success") expect(receipts(value)[0]!.time_created).toBeGreaterThanOrEqual(started)
    if (["pending", "covered", "success", "retired"].includes(state)) expect(memory(value)).toEqual(oldMemory)
    else {
      const entries = memory(value)
        .filter((c) => JSON.parse(c.content).recovery)
        .map((c) => JSON.parse(c.content))
      expect(entries).toEqual([
        expect.objectContaining({
          projectID: original.projectID,
          taskID: original.taskID,
          sessionID: original.sessionID,
          surface: original.input.surface,
          text: original.input.text,
          structured: original.input.structured,
          timeCreated: 200,
          context: [],
          recovery: {
            kind: "permission_memory_recovery",
            schemaVersion: 6,
            publicationID: original.occurrenceID,
            previousCapture: "unknown",
            recoveredAt: expect.any(Number),
          },
        }),
      ])
      for (const row of oldMemory) expect(memory(value).find((r) => r.id === row.id)).toEqual(row)
      const row = value.db.select().from(EngineInteractionRequestTable).all()[0]!
      expect(projectInteractionRowInTransaction(value.db, row)).toMatchObject({
        task_id: original.taskID,
        session_id: original.sessionID,
        external_id: original.requestID,
        request_type: "permission",
        status: "answered",
        time_resolved: 200,
      })
    }
    const complete = snapshot(value)
    expect(run(value)).toEqual({ from: current.version, to: current.version })
    expect(snapshot(value)).toEqual(complete)
    using backup = new SQLite(result.backupPath!, { readonly: true })
    expect(schemaVersion(backup)).toBe(4)
  })
}

for (const version of [1, 2, 3, 5])
  test(`v${version} joins the same preserved v6 recovery chain`, async () => {
    using value = fixture(version)
    await source(value, `version-${version}`, "fresh")
    expect(run(value)).toMatchObject({ from: version, to: current.version })
    expect(receipts(value).map((r) => r.outcome)).toEqual(["succeeded"])
    expect(memory(value).map((c) => JSON.parse(c.content).recovery.schemaVersion)).toEqual([6])
  })

test("different Projects recover their exact original owners in one transaction", async () => {
  using value = fixture()
  const first = await source(value, "first", "fresh"),
    second = await source(value, "second", "fresh")
  run(value)
  expect(
    memory(value)
      .map((c) => JSON.parse(c.content))
      .map((e) => ({ projectID: e.projectID, ownerID: e.ownerID })),
  ).toEqual([
    { projectID: first.projectID, ownerID: first.taskID },
    { projectID: second.projectID, ownerID: second.taskID },
  ])
})

for (const cut of ["inbox", "receipt", "after-prepare"] as const)
  test(`the ${cut} SQL failure rolls back all original data then permits real recovery`, async () => {
    using value = fixture()
    await source(value, cut, "fresh")
    const before = snapshot(value)
    if (cut !== "after-prepare")
      value.sqlite.exec(
        `CREATE TEMP TRIGGER recovery_fault BEFORE INSERT ON ${cut === "inbox" ? "memory_chunk" : "bus_publication_delivery_receipt"} BEGIN SELECT RAISE(ABORT,'REAL_RECOVERY_FAULT'); END`,
      )
    const migrations =
      cut === "after-prepare"
        ? DATABASE_MIGRATIONS.map((m) =>
            m.version === 6
              ? {
                  ...m,
                  migrate: () => {
                    throw new Error("REAL_RECOVERY_FAULT")
                  },
                }
              : m,
          )
        : DATABASE_MIGRATIONS
    expect(() => run(value, migrations)).toThrow(
      expect.objectContaining({
        code: "SCHEMA_MIGRATION_FAILED",
        message: expect.stringContaining("REAL_RECOVERY_FAULT"),
      }),
    )
    expect({ version: schemaVersion(value.sqlite), data: snapshot(value) }).toEqual({ version: 4, data: before })
    if (cut !== "after-prepare") value.sqlite.exec("DROP TRIGGER recovery_fault")
    expect(run(value)).toMatchObject({ from: 4, to: current.version })
    expect(receipts(value).map((r) => r.outcome)).toEqual(["succeeded"])
  })

for (const conflict of ["ignored", "cross-project", "pending-source"] as const)
  test(`the ${conflict} conflict preserves original data with the precise recovery error`, async () => {
    using value = fixture()
    const original = await source(value, conflict, conflict === "pending-source" ? "pending" : "fresh")
    if (conflict === "ignored")
      value.db
        .insert(BusPublicationDeliveryReceiptTable)
        .values({
          id: "original-ignored",
          occurrence_id: original.occurrenceID,
          phase: "exact",
          subscriber_id: subscriber,
          outcome: "ignored",
          time_created: 300,
        })
        .run()
    if (conflict === "pending-source") {
      const row = memory(value)[0]!,
        entry = JSON.parse(row.content)
      value.db
        .update(MemoryChunkTable)
        .set({ content: JSON.stringify({ ...entry, text: "Conflicting input source" }) })
        .where(eq(MemoryChunkTable.id, row.id))
        .run()
    }
    const before = snapshot(value)
    expect(() => run(value)).toThrow(
      expect.objectContaining({
        code: "SCHEMA_MIGRATION_REQUIRED",
        message: expect.stringContaining(original.occurrenceID),
      }),
    )
    expect({ version: schemaVersion(value.sqlite), data: snapshot(value) }).toEqual({ version: 4, data: before })
  })
