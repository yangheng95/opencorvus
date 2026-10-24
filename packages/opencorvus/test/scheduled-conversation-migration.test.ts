import { afterEach, expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Identifier } from "@/id/id"
import { deterministicAutomationID } from "@/scheduler/automation-identity"
import { Database, DatabaseUnavailableError } from "@/storage/db"
import { queryAllFinalized } from "@/storage/sqlite-statement"
import { DATABASE_MIGRATIONS } from "@/storage/migrations"
import { createTestDatabase, editTestDatabase, resetDatabase } from "./fixture/db"

afterEach(resetDatabase)

const currentVersion = DATABASE_MIGRATIONS.at(-1)!.version

async function createVersionTwoDatabase() {
  await resetDatabase()
  const databasePath = Database.Path()
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  using sqlite = new SQLite(databasePath)
  sqlite.exec("PRAGMA journal_mode=WAL")
  sqlite.exec(DATABASE_MIGRATIONS[1]!.ddl)
  sqlite.exec("PRAGMA user_version=2")
  const identity = randomUUID()
  sqlite.run("INSERT INTO database_authority(key,instance_id,time_created) VALUES('primary',?,?)", [identity, Date.now()])
  return identity
}

function seed(conversation?: unknown) {
  const projectID = Identifier.ascending("project"),
    eventJobID = Identifier.ascending("event_job")
  const eventID = Identifier.ascending("session"),
    chatID = Identifier.ascending("session"),
    ordinaryID = Identifier.ascending("session")
  const automationID = Identifier.ascending("automation"),
    fireID = Identifier.ascending("call")
  const runID = deterministicAutomationID("atr", fireID, `project:${projectID}`)
  const automationSessionID = deterministicAutomationID("ses", runID)
  const messageID = Identifier.ascending("message"),
    partID = Identifier.ascending("part")
  const now = Date.now() - 100_000,
    directory = path.dirname(Database.Path())
  let sessions: any[] = [],
    messages: any[] = [],
    parts: any[] = []
  editTestDatabase((sqlite) => {
    sqlite.run(
      "INSERT INTO project(id,worktree,time_created,time_updated,sandboxes,generation) VALUES(?,?,?,?,'[]',?)",
      [projectID, directory, now, now + 1, randomUUID()],
    )
    const metadata = [
      { retained: { owner: "原操作人", choices: [1, 2] }, ...(conversation === undefined ? {} : { conversation }) },
      { retained: "原Chat", conversation: { surface: "right-sidebar", experience: "chat" } },
      { retained: "普通指定目标" },
      { retained: "原Automation" },
    ]
    for (const [index, id] of [eventID, chatID, ordinaryID, automationSessionID].entries()) {
      sqlite.run(
        `INSERT INTO session(id,project_id,slug,directory,title,version,kind,metadata,permission,time_created,time_updated)
        VALUES(?,?,?,?,?,?,'assistant',?,?,?,?)`,
        [
          id,
          projectID,
          `retained-${index}`,
          directory,
          `原始标题${index}`,
          "local",
          JSON.stringify(metadata[index]),
          JSON.stringify([{ permission: "read", pattern: "README.md", action: "allow" }]),
          now + index,
          now + index + 10,
        ],
      )
    }
    sqlite.run(
      `INSERT INTO event_job(id,definition_id,revision,project_id,name,event_type,prompt,enabled,time_created)
      VALUES(?,?,1,?,'original event','test.visible','原始输入',0,?)`,
      [eventJobID, eventJobID, projectID, now],
    )
    for (const [index, sessionID] of [eventID, chatID].entries()) {
      const occurrenceID = Identifier.ascending("call")
      sqlite.run(
        "INSERT INTO event_occurrence(id,project_id,event_type,properties,time_created) VALUES(?,?,'test.visible','{}',?)",
        [occurrenceID, projectID, now],
      )
      sqlite.run(
        `INSERT INTO event_job_fire(id,definition_id,queue_position,event_job_revision_id,event_occurrence_id,created_session_id,time_created)
        VALUES(?,?,?,?,?,?,?)`,
        [Identifier.ascending("call"), eventJobID, index + 1, eventJobID, occurrenceID, sessionID, now],
      )
    }
    sqlite.run(
      `INSERT INTO automation(id,definition_id,revision,name,kind,scope,recurrence,execution_mode,prompt,status,time_created)
      VALUES(?,?,1,'original project automation','recurring','project',?,'local','原始定时输入','paused',?)`,
      [automationID, automationID, "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", now],
    )
    sqlite.run("INSERT INTO automation_project_target(automation_revision_id,project_id,position) VALUES(?,?,0)", [
      automationID,
      projectID,
    ])
    sqlite.run(
      "INSERT INTO automation_fire(id,automation_revision_id,scheduled_due_at,origin,time_created) VALUES(?,?,?,'manual_api',?)",
      [fireID, automationID, now, now],
    )
    sqlite.run(
      "INSERT INTO automation_run(id,automation_revision_id,fire_id,target_project_id,started_at) VALUES(?,?,?,?,?)",
      [runID, automationID, fireID, projectID, now],
    )
    sqlite.run("INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)", [
      messageID,
      eventID,
      now,
      now,
      JSON.stringify({
        role: "user",
        author: "orchestrator",
        agent: "coding",
        model: { providerID: "openai", modelID: "gpt-6.1-sol" },
        time: { created: now },
      }),
    ])
    sqlite.run("INSERT INTO part(id,message_id,time_created,time_updated,data) VALUES(?,?,?,?,?)", [
      partID,
      messageID,
      now,
      now,
      JSON.stringify({ type: "text", text: "原文与来源保留：仅用于界面测试。" }),
    ])
    sessions = queryAllFinalized(sqlite, "SELECT rowid,* FROM session ORDER BY id")
    messages = queryAllFinalized(sqlite, "SELECT rowid,* FROM message ORDER BY id")
    parts = queryAllFinalized(sqlite, "SELECT rowid,* FROM part ORDER BY id")
  })
  return { eventID, chatID, ordinaryID, automationSessionID, projectID, sessions, messages, parts }
}

test("the production version-2 upgrade exposes exact Event and project Automation results and preserves their original graph and backup", async () => {
  const identity = await createVersionTwoDatabase()
  const before = seed()
  Database.Client()
  expect(Database.allFinalized("PRAGMA user_version")).toEqual([{ user_version: currentVersion }])
  expect(Database.Identity()).toBe(identity)
  const expected = before.sessions.map((row) =>
    [before.eventID, before.automationSessionID].includes(row.id)
      ? {
          ...row,
          metadata: JSON.stringify({
            ...JSON.parse(row.metadata),
            conversation: { experience: "work", surface: "right-sidebar" },
          }),
        }
      : row,
  )
  expect(Database.allFinalized("SELECT rowid,* FROM session ORDER BY id")).toEqual(expected)
  expect(Database.allFinalized("SELECT rowid,* FROM message ORDER BY id")).toEqual(before.messages)
  expect(Database.allFinalized("SELECT rowid,* FROM part ORDER BY id")).toEqual(before.parts)
  const backupDirectory = path.join(path.dirname(Database.Path()), "migration-backups")
  const backupName = fs
    .readdirSync(backupDirectory)
    .filter((name) => name.startsWith(`${path.basename(Database.Path())}.v2-to-v${currentVersion}.`))
    .sort()
    .at(-1)!
  const backup = new SQLite(path.join(backupDirectory, backupName), { readonly: true })
  try {
    expect(queryAllFinalized(backup, "PRAGMA user_version")).toEqual([{ user_version: 2 }])
    expect(queryAllFinalized(backup, "SELECT rowid,* FROM session ORDER BY id")).toEqual(before.sessions)
    expect(queryAllFinalized(backup, "SELECT rowid,* FROM message ORDER BY id")).toEqual(before.messages)
    expect(queryAllFinalized(backup, "SELECT rowid,* FROM part ORDER BY id")).toEqual(before.parts)
  } finally {
    backup.close(true)
  }
  Database.close()
  expect(Database.Identity()).toBe(identity)
  expect(Database.allFinalized("SELECT rowid,* FROM session ORDER BY id")).toEqual(expected)
})

test("a conflicting historical result identity returns the precise maintenance error with the original version and graph retained", async () => {
  await createVersionTwoDatabase()
  const before = seed({ surface: "foreign-owner", experience: "work" })
  let error: unknown
  try {
    Database.Client()
  } catch (caught) {
    error = caught
  }
  expect(DatabaseUnavailableError.isInstance(error) ? error.data : error).toMatchObject({
    operation: "Database.Client.schemaMigration",
    code: "SCHEMA_MIGRATION_REQUIRED",
  })
  editTestDatabase((sqlite) => {
    expect(queryAllFinalized(sqlite, "PRAGMA user_version")).toEqual([{ user_version: 2 }])
    expect(queryAllFinalized(sqlite, "SELECT rowid,* FROM session ORDER BY id")).toEqual(before.sessions)
    expect(queryAllFinalized(sqlite, "SELECT rowid,* FROM message ORDER BY id")).toEqual(before.messages)
  })
})

for (const [conversation, code] of [
  [undefined, "DATA_MIGRATION_REQUIRED"],
  [{ surface: "foreign-owner", experience: "work" }, "DATA_INTEGRITY_ERROR"],
] as const) {
  test(`the current production opener reports ${code} for the exact standalone result identity`, async () => {
    await createTestDatabase()
    const before = seed(conversation)
    let error: unknown
    try {
      Database.Client()
    } catch (caught) {
      error = caught
    }
    expect(DatabaseUnavailableError.isInstance(error) ? error.data : error).toMatchObject({
      operation: "Database.Client.dataIntegrity.scheduledConversationIdentity",
      code,
    })
    editTestDatabase((sqlite) => {
      expect(queryAllFinalized(sqlite, "PRAGMA user_version")).toEqual([{ user_version: currentVersion }])
      expect(queryAllFinalized(sqlite, "SELECT rowid,* FROM session ORDER BY id")).toEqual(before.sessions)
    })
  })
}
