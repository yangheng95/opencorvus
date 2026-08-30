import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { Identifier } from "@/id/id"
import {
  MissionExecutionReconciliationMigrationTestHooks,
  migrateMissionExecutionReconciliationFacts,
} from "@/storage/mission-execution-reconciliation-migration"
import { SCHEMA_DDL } from "@/storage/ddl"
import { findSchemaDrift } from "@/storage/schema-contract"

function database(filename = ":memory:") {
  const sqlite = new SQLite(filename)
  sqlite.exec(`
    CREATE TABLE protocol_event (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      session_id TEXT,
      source TEXT NOT NULL,
      correlation_id TEXT,
      seq INTEGER NOT NULL,
      emitted_at INTEGER NOT NULL,
      payload TEXT
    );
    CREATE TABLE session_control_record (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      source TEXT,
      payload TEXT NOT NULL,
      time_created INTEGER NOT NULL
    );
    CREATE TABLE session_control_event (
      id TEXT PRIMARY KEY NOT NULL,
      control_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT,
      time_created INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX session_control_event_terminal_idx
      ON session_control_event(control_id) WHERE kind IN ('consumed','failed');
    CREATE TABLE message (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE part (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE protocol_inbox (
      id TEXT PRIMARY KEY NOT NULL,
      envelope_id TEXT NOT NULL,
      actor TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      visible_at INTEGER NOT NULL,
      time_created INTEGER NOT NULL
    );
    CREATE TABLE protocol_delivery_receipt (
      id TEXT PRIMARY KEY NOT NULL,
      inbox_id TEXT NOT NULL,
      receipt TEXT NOT NULL,
      time_created INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX protocol_delivery_receipt_terminal_idx
      ON protocol_delivery_receipt(inbox_id)
      WHERE json_extract(receipt,'$.kind') <> 'retry_wait';
    CREATE TRIGGER protocol_delivery_receipt_no_update
    BEFORE UPDATE ON protocol_delivery_receipt FOR EACH ROW
    BEGIN SELECT RAISE(ABORT, 'protocol_delivery_receipt: immutable receipt'); END;
    CREATE TRIGGER protocol_event_no_update
    BEFORE UPDATE ON protocol_event FOR EACH ROW
    BEGIN SELECT RAISE(ABORT, 'protocol_event: immutable domain fact'); END;
  `)
  return sqlite
}

function retainedControlIDs(sqlite: SQLite): string[] {
  const query = sqlite.query<{ id: string }, []>("SELECT id FROM session_control_record ORDER BY id")
  try {
    return query.all().map((row) => row.id)
  } finally {
    query.finalize()
  }
}

test("installs the unique Mission delete-retention admission index before current readers", () => {
  const sqlite = database()
  try {
    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(true)
    expect(
      sqlite
        .query<{ name: string; sql: string }, []>(
          "SELECT name,sql FROM sqlite_schema WHERE type='index' AND name='protocol_event_mission_delete_retention_idx'",
        )
        .get(),
    ).toMatchObject({
      name: "protocol_event_mission_delete_retention_idx",
      sql: expect.stringContaining("mission.retention.delete_requested"),
    })
    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(false)
  } finally {
    sqlite.close()
  }
})

const pendingCloseOperations = new WeakMap<SQLite, Map<string, string>>()

function event(
  sqlite: SQLite,
  input: {
    id?: string
    sessionID: string
    type: "mission.execution.opened" | "mission.execution.closing" | "mission.execution.closed"
    operationID?: string
    source?: string
    sequence: number
    emittedAt?: number
    payload: Record<string, unknown>
  },
) {
  const id = input.id ?? Identifier.ascending("protocol_event")
  const operations = pendingCloseOperations.get(sqlite) ?? new Map<string, string>()
  pendingCloseOperations.set(sqlite, operations)
  const operationID =
    input.operationID ??
    (input.type === "mission.execution.closed"
      ? operations.get(input.sessionID) ?? crypto.randomUUID()
      : crypto.randomUUID())
  if (input.type === "mission.execution.closing") operations.set(input.sessionID, operationID)
  if (input.type === "mission.execution.closed") operations.delete(input.sessionID)
  sqlite
    .query(
      `INSERT INTO protocol_event(
        id,type,aggregate_type,aggregate_id,session_id,source,correlation_id,seq,emitted_at,payload
      ) VALUES(?,?,'session',?,NULL,?,?,?, ?,?)`,
    )
    .run(
      id,
      input.type,
      input.sessionID,
      input.source ?? (input.type === "mission.execution.opened" ? "mission.wake" : "mission.abort"),
      operationID,
      input.sequence,
      input.emittedAt ?? Date.now() - 10_000 + input.sequence * 100,
      JSON.stringify(input.payload),
    )
  return id
}

type Marker = ReturnType<typeof markerPayload>

function markerPayload(
  overrides: Partial<{
    occurrenceID: string
    wakeMessageID: string
    wakeTextPartID: string
    wakeControlID: string
    interruptedAssistantMessageIDs: string[]
  }> = {},
) {
  return {
    version: 1 as const,
    occurrenceID: overrides.occurrenceID ?? Identifier.ascending("session_control"),
    attempt: 1,
    interruptedAssistantMessageIDs: overrides.interruptedAssistantMessageIDs ?? [Identifier.ascending("message")],
    wakeMessageID: overrides.wakeMessageID ?? Identifier.ascending("message"),
    wakeTextPartID: overrides.wakeTextPartID ?? Identifier.ascending("part"),
    wakeControlID: overrides.wakeControlID ?? Identifier.ascending("session_control"),
    interruptedAt: Date.now(),
  }
}

function marker(sqlite: SQLite, sessionID: string, payload: Marker, time = Date.now()) {
  sqlite
    .query(
      `INSERT INTO session_control_record(id,session_id,kind,source,payload,time_created)
       VALUES(?,?,'mission_process_recovery','mission.process-recovery',?,?)`,
    )
    .run(payload.occurrenceID, sessionID, JSON.stringify(payload), time)
  for (const interruptedMessageID of payload.interruptedAssistantMessageIDs) {
    message(sqlite, { id: interruptedMessageID, sessionID, role: "assistant" })
  }
}

function message(
  sqlite: SQLite,
  input: {
    id: string
    sessionID: string
    role: "user" | "assistant"
    parentID?: string
    completed?: boolean
    finish?: string
    error?: unknown
    extra?: Record<string, unknown>
    timeCreated?: number
    author?: string
  },
) {
  const now = input.timeCreated ?? Date.now()
  sqlite.query("INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)").run(
    input.id,
    input.sessionID,
    now,
    now,
    JSON.stringify({
      id: input.id,
      sessionID: input.sessionID,
      role: input.role,
      author: input.author ?? (input.role === "user" ? "Historical scheduler" : "mission"),
      agent: "mission",
      ...(input.role === "user"
        ? { model: { providerID: "historical-provider", modelID: "historical-model" } }
        : { providerID: "historical-provider", modelID: "historical-model" }),
      ...(input.parentID ? { parentID: input.parentID } : {}),
      time: { created: now, ...(input.completed ? { completed: now } : {}) },
      ...(input.finish ? { finish: input.finish } : {}),
      ...(input.error === undefined ? {} : { error: input.error }),
      ...(input.extra ? { extra: input.extra } : {}),
    }),
  )
}

function settleInterruptedAssistant(sqlite: SQLite, sessionID: string, messageID: string, completedAt = Date.now()) {
  const row = sqlite.query<{ data: string }, [string]>("SELECT data FROM message WHERE id=?").get(messageID)
  if (!row) throw new Error(`Missing interrupted assistant ${messageID}`)
  const data = JSON.parse(row.data)
  sqlite.query("UPDATE message SET data=?,time_updated=? WHERE id=?").run(
    JSON.stringify({
      ...data,
      finish: "error",
      time: { ...data.time, completed: completedAt },
      error: {
        name: "UnknownError",
        data: {
          message:
            `ProcessExecutionInterruptedError: Previous process ended before Session ${sessionID} ` +
            `completed assistant message ${messageID}`,
        },
      },
    }),
    completedAt,
    messageID,
  )
}

function textPart(
  sqlite: SQLite,
  input: { id: string; messageID: string; text?: string; timeCreated?: number },
) {
  const parent = sqlite
    .query<{ session_id: string; time_created: number }, [string]>(
      "SELECT session_id,time_created FROM message WHERE id=?",
    )
    .get(input.messageID)
  if (!parent) throw new Error(`Missing Message ${input.messageID}`)
  sqlite.query("INSERT INTO part(id,message_id,time_created,time_updated,data) VALUES(?,?,?,?,?)").run(
    input.id,
    input.messageID,
    input.timeCreated ?? parent.time_created,
    input.timeCreated ?? parent.time_created,
    JSON.stringify({ type: "text", text: input.text ?? "Historical Mission recovery wake" }),
  )
}

function recoveryPrompt(marker: Marker): string {
  const count = marker.interruptedAssistantMessageIDs.length
  return (
    `The backend process restarted while ${count} assistant turn${count === 1 ? " was" : "s were"} ` +
    `still executing. This is recovery attempt ${marker.attempt} for the same process-recovery occurrence. ` +
    "Inspect the persisted process-interruption failures, reconcile durable Mission state, and continue the Mission from the last safe boundary without duplicating completed work."
  )
}

function wakeControl(
  sqlite: SQLite,
  input: { marker: Marker; sessionID: string; missionID: string; openedEventID?: string },
) {
  const now = Date.now()
  sqlite
    .query(
      `INSERT INTO session_control_record(id,session_id,kind,source,payload,time_created)
       VALUES(?,?,'wake_reason','mission.process_recovery',?,?)`,
    )
    .run(
      input.marker.wakeControlID,
      input.sessionID,
      JSON.stringify({
        messageID: input.marker.wakeMessageID,
        wake_reason: input.openedEventID
          ? {
              source: "mission.process_recovery",
              version: 2,
              missionID: input.missionID,
              occurrenceID: input.marker.occurrenceID,
              openedEventID: input.openedEventID,
              ownerGeneration: Identifier.ascending("call"),
              interruptedAssistantMessageIDs: input.marker.interruptedAssistantMessageIDs,
            }
          : {
              source: "mission.process_recovery",
              missionID: input.missionID,
              occurrenceID: input.marker.occurrenceID,
              interruptedAssistantMessageIDs: input.marker.interruptedAssistantMessageIDs,
            },
      }),
      now,
    )
  sqlite
    .query("INSERT INTO session_control_event(id,control_id,kind,payload,time_created) VALUES(?,?,'consumed',NULL,?)")
    .run(
      Identifier.deterministic("session_control", `terminal\0${input.marker.wakeControlID}`),
      input.marker.wakeControlID,
      now,
    )
}

function wakeBundle(sqlite: SQLite, sessionID: string, marker: Marker) {
  const opened = sqlite
    .query<{ payload: string }, [string]>(
      `SELECT payload FROM protocol_event
       WHERE aggregate_type='session' AND aggregate_id=? AND type='mission.execution.opened'
       ORDER BY seq DESC,id DESC LIMIT 1`,
    )
    .get(sessionID)
  if (!opened) throw new Error(`Missing opened Mission occurrence for ${sessionID}`)
  const missionID = JSON.parse(opened.payload).missionID as string
  message(sqlite, {
    id: marker.wakeMessageID,
    sessionID,
    role: "user",
    author: "OpenCorvus runtime recovery",
  })
  textPart(sqlite, {
    id: marker.wakeTextPartID,
    messageID: marker.wakeMessageID,
    text: recoveryPrompt(marker),
  })
  wakeControl(sqlite, { marker, sessionID, missionID })
}

function controlProjection(sqlite: SQLite, controlID: string) {
  return sqlite
    .query<{ kind: string; payload: string | null }, [string]>(
      "SELECT kind,payload FROM session_control_event WHERE control_id=? ORDER BY time_created,id",
    )
    .all(controlID)
    .map((row) => ({ kind: row.kind, payload: row.payload === null ? null : JSON.parse(row.payload) }))
}

test("migrates strict close provenance and reduces every legacy recovery marker to current real facts", () => {
  const sqlite = database()
  try {
    const base = Date.now() - 20_000
    const sessionClosing = Identifier.ascending("session")
    const sessionUnanswered = Identifier.ascending("session")
    const sessionSuccessful = Identifier.ascending("session")
    const sessionFailed = Identifier.ascending("session")
    const sessionMissing = Identifier.ascending("session")
    const sessionTerminal = Identifier.ascending("session")
    event(sqlite, {
      sessionID: sessionClosing,
      type: "mission.execution.opened",
      sequence: 1,
      emittedAt: base + 100,
      payload: { missionID: "mission-closing", requestID: "request-open-closing" },
    })
    const closingID = event(sqlite, {
      sessionID: sessionClosing,
      type: "mission.execution.closing",
      sequence: 2,
      emittedAt: base + 300,
      payload: { missionID: "mission-closing", requestID: "request-closing" },
    })
    const closedID = event(sqlite, {
      sessionID: sessionClosing,
      type: "mission.execution.closed",
      sequence: 3,
      emittedAt: base + 400,
      payload: { missionID: "mission-closing", requestID: "request-closing" },
    })
    event(sqlite, {
      sessionID: sessionUnanswered,
      type: "mission.execution.opened",
      sequence: 1,
      payload: { missionID: "mission-unanswered", requestID: "request-unanswered" },
    })
    for (const [sessionID, missionID] of [
      [sessionSuccessful, "mission-successful"],
      [sessionFailed, "mission-failed"],
      [sessionMissing, "mission-missing"],
      [sessionTerminal, "mission-terminal"],
    ] as const) {
      event(sqlite, {
        sessionID,
        type: "mission.execution.opened",
        sequence: 1,
        payload: { missionID, requestID: `request-${missionID}` },
      })
    }

    const closingMarker = markerPayload()
    marker(sqlite, sessionClosing, closingMarker, base + 200)

    const unansweredMarker = markerPayload()
    marker(sqlite, sessionUnanswered, unansweredMarker)
    wakeBundle(sqlite, sessionUnanswered, unansweredMarker)

    const successfulMarker = markerPayload()
    marker(sqlite, sessionSuccessful, successfulMarker)
    wakeBundle(sqlite, sessionSuccessful, successfulMarker)
    const successfulReplyID = Identifier.ascending("message")
    message(sqlite, {
      id: successfulReplyID,
      sessionID: sessionSuccessful,
      role: "assistant",
      parentID: successfulMarker.wakeMessageID,
      completed: true,
      finish: "stop",
    })

    const failedMarker = markerPayload()
    marker(sqlite, sessionFailed, failedMarker)
    wakeBundle(sqlite, sessionFailed, failedMarker)
    const failedReplyID = Identifier.ascending("message")
    message(sqlite, {
      id: failedReplyID,
      sessionID: sessionFailed,
      role: "assistant",
      parentID: failedMarker.wakeMessageID,
      completed: true,
      finish: "error",
      error: {
        name: "ProcessExecutionInterruptedError",
        data: {
          message:
            `Previous process ended before Session ${sessionFailed} ` +
            `completed assistant message ${failedReplyID}`,
        },
      },
    })

    const missingMarker = markerPayload()
    marker(sqlite, sessionMissing, missingMarker)

    const terminalMarker = markerPayload()
    marker(sqlite, sessionTerminal, terminalMarker)
    const terminalEffective = { ...terminalMarker, attempt: 2 }
    sqlite
      .query("INSERT INTO session_control_event(id,control_id,kind,payload,time_created) VALUES(?,?,'amended',?,?)")
      .run(
        Identifier.ascending("session_control"),
        terminalMarker.occurrenceID,
        JSON.stringify(terminalEffective),
        Date.now() + 1,
      )
    wakeBundle(sqlite, sessionTerminal, terminalEffective)
    settleInterruptedAssistant(
      sqlite,
      sessionTerminal,
      terminalEffective.interruptedAssistantMessageIDs[0]!,
      Date.now() + 2,
    )
    message(sqlite, {
      id: Identifier.ascending("message"),
      sessionID: sessionTerminal,
      role: "assistant",
      parentID: terminalEffective.wakeMessageID,
      completed: true,
      finish: "stop",
    })
    sqlite
      .query("INSERT INTO session_control_event(id,control_id,kind,payload,time_created) VALUES(?,?,'consumed',NULL,?)")
      .run(Identifier.ascending("session_control"), terminalMarker.occurrenceID, Date.now() + 3)

    const exactTriggerBefore = sqlite
      .query<
        { sql: string },
        []
      >("SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='protocol_event_no_update'")
      .get()!.sql

    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(true)

    const migratedClosing = JSON.parse(
      sqlite.query<{ payload: string }, [string]>("SELECT payload FROM protocol_event WHERE id=?").get(closingID)!
        .payload,
    )
    const migratedClosed = JSON.parse(
      sqlite.query<{ payload: string }, [string]>("SELECT payload FROM protocol_event WHERE id=?").get(closedID)!
        .payload,
    )
    const exactTriggerAfter = sqlite
      .query<
        { sql: string },
        []
      >("SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='protocol_event_no_update'")
      .get()!.sql

    expect({
      closingProvenance: migratedClosing.provenance,
      closedProvenance: migratedClosed.provenance,
      retainedControlIDs: retainedControlIDs(sqlite),
      terminalInterruptedError: JSON.parse(
        sqlite
          .query<{ data: string }, [string]>("SELECT data FROM message WHERE id=?")
          .get(terminalEffective.interruptedAssistantMessageIDs[0]!)!.data,
      ).error,
      triggerRestoredExactly: exactTriggerAfter === exactTriggerBefore,
      secondMigrationChanged: migrateMissionExecutionReconciliationFacts(sqlite),
    }).toMatchObject({
      closingProvenance: { kind: "historical_reconciliation", sourceEventID: closingID },
      closedProvenance: { kind: "historical_reconciliation", sourceEventID: closingID },
      retainedControlIDs: [
        closingMarker.wakeControlID,
        failedMarker.wakeControlID,
        missingMarker.wakeControlID,
        successfulMarker.wakeControlID,
        terminalMarker.wakeControlID,
        unansweredMarker.wakeControlID,
      ].sort(),
      terminalInterruptedError: {
        name: "ProcessExecutionInterruptedError",
        data: {
          message: expect.stringContaining("Previous process ended before Session"),
        },
      },
      triggerRestoredExactly: true,
      secondMigrationChanged: false,
    })
  } finally {
    sqlite.close()
  }
})

test("rolls back a terminal legacy recovery marker without its exact durable recovery outcome", () => {
  const sqlite = database()
  try {
    const sessionID = Identifier.ascending("session")
    event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      sequence: 1,
      payload: { missionID: "mission-terminal-marker-conflict", requestID: "request-terminal-marker-conflict" },
    })
    const terminal = markerPayload()
    marker(sqlite, sessionID, terminal)
    sqlite
      .query("INSERT INTO session_control_event(id,control_id,kind,payload,time_created) VALUES(?,?,'consumed',NULL,?)")
      .run(Identifier.ascending("session_control"), terminal.occurrenceID, Date.now() + 1)

    expect(() => migrateMissionExecutionReconciliationFacts(sqlite)).toThrow("has no exact wake bundle")
    expect(retainedControlIDs(sqlite)).toEqual([terminal.occurrenceID])
  } finally {
    sqlite.close()
  }
})

test("reduces a failed terminal legacy recovery marker only through its typed durable reply", () => {
  const sqlite = database()
  try {
    const sessionID = Identifier.ascending("session")
    event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      sequence: 1,
      payload: { missionID: "mission-terminal-marker-failed", requestID: "request-terminal-marker-failed" },
    })
    const terminal = markerPayload()
    marker(sqlite, sessionID, terminal)
    wakeBundle(sqlite, sessionID, terminal)
    settleInterruptedAssistant(sqlite, sessionID, terminal.interruptedAssistantMessageIDs[0]!)
    const replyID = Identifier.ascending("message")
    message(sqlite, {
      id: replyID,
      sessionID,
      role: "assistant",
      parentID: terminal.wakeMessageID,
      completed: true,
      finish: "error",
      error: {
        name: "ProcessExecutionInterruptedError",
        data: {
          message: `Previous process ended before Session ${sessionID} completed assistant message ${replyID}`,
        },
      },
    })
    sqlite
      .query("INSERT INTO session_control_event(id,control_id,kind,payload,time_created) VALUES(?,?,'failed',?,?)")
      .run(
        Identifier.ascending("session_control"),
        terminal.occurrenceID,
        JSON.stringify({ error: "historical recovery reply failed" }),
        Date.now() + 1,
      )

    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(true)
    expect({
      retainedControlIDs: retainedControlIDs(sqlite),
      replyError: JSON.parse(
        sqlite.query<{ data: string }, [string]>("SELECT data FROM message WHERE id=?").get(replyID)!.data,
      ).error,
    }).toEqual({
      retainedControlIDs: [terminal.wakeControlID],
      replyError: {
        name: "ProcessExecutionInterruptedError",
        data: { message: `Previous process ended before Session ${sessionID} completed assistant message ${replyID}` },
      },
    })
  } finally {
    sqlite.close()
  }
})

test("rolls back closure rewrites and marker settlement on an exact identity conflict", () => {
  const sqlite = database()
  try {
    const sessionID = Identifier.ascending("session")
    event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      sequence: 1,
      payload: { missionID: "mission-rollback", requestID: "request-open-rollback" },
    })
    const closingID = event(sqlite, {
      sessionID,
      type: "mission.execution.closing",
      sequence: 2,
      payload: { missionID: "mission-rollback", requestID: "request-rollback" },
    })
    const markerID = Identifier.ascending("session_control")
    marker(
      sqlite,
      sessionID,
      markerPayload({ occurrenceID: markerID.replace("sctl_", "sctl_conflict_") }),
      Date.now() - 9_850,
    )
    // Preserve the row id while making the strict embedded occurrence identity drift.
    sqlite.query("UPDATE session_control_record SET id=?").run(markerID)
    const originalPayload = sqlite
      .query<{ payload: string }, [string]>("SELECT payload FROM protocol_event WHERE id=?")
      .get(closingID)!.payload
    const originalTrigger = sqlite
      .query<
        { sql: string },
        []
      >("SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='protocol_event_no_update'")
      .get()!.sql

    expect(() => migrateMissionExecutionReconciliationFacts(sqlite)).toThrow("conflicting occurrence identity")

    expect({
      closurePayload: sqlite
        .query<{ payload: string }, [string]>("SELECT payload FROM protocol_event WHERE id=?")
        .get(closingID)!.payload,
      triggerSQL: sqlite
        .query<
          { sql: string },
          []
        >("SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='protocol_event_no_update'")
        .get()!.sql,
      markerEvents: controlProjection(sqlite, markerID),
    }).toEqual({ closurePayload: originalPayload, triggerSQL: originalTrigger, markerEvents: [] })
  } finally {
    sqlite.close()
  }
})

test("takes the immediate writer reservation before scanning Mission history", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "opencorvus-mission-reconciliation-migration-"))
  const filename = path.join(directory, "migration.db")
  const sqlite = database(filename)
  const peer = new SQLite(filename)
  try {
    peer.exec("PRAGMA busy_timeout=0")
    const sessionID = Identifier.ascending("session")
    event(sqlite, {
      sessionID,
      type: "mission.execution.closing",
      sequence: 1,
      payload: { missionID: "mission-admission", requestID: "request-admission" },
    })
    using _admission = MissionExecutionReconciliationMigrationTestHooks.replaceAfterAdmission(() => {
      expect(() =>
        event(peer, {
          sessionID,
          type: "mission.execution.closed",
          sequence: 2,
          payload: { missionID: "mission-admission", requestID: "request-admission" },
        }),
      ).toThrow()
    })

    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(true)
    expect(sqlite.query("SELECT id FROM protocol_event WHERE type='mission.execution.closed'").get()).toBeNull()
  } finally {
    peer.close(true)
    sqlite.close(true)
    rmSync(directory, { recursive: true, force: true })
  }
})

test("fails closed when two pending legacy markers claim the same wake identity", () => {
  const sqlite = database()
  try {
    const sessionID = Identifier.ascending("session")
    event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      sequence: 1,
      payload: { missionID: "mission-conflicting-markers", requestID: "request-conflicting-markers" },
    })
    const sharedMessageID = Identifier.ascending("message")
    const first = markerPayload({ wakeMessageID: sharedMessageID })
    const second = markerPayload({ wakeMessageID: sharedMessageID })
    marker(sqlite, sessionID, first)
    marker(sqlite, sessionID, second)

    expect(() => migrateMissionExecutionReconciliationFacts(sqlite)).toThrow("claim one opened occurrence")
    expect({
      first: controlProjection(sqlite, first.occurrenceID),
      second: controlProjection(sqlite, second.occurrenceID),
    }).toEqual({ first: [], second: [] })
  } finally {
    sqlite.close()
  }
})

test("fails closed when a legacy marker has multiple opened occurrences and no causal pointer", () => {
  const sqlite = database()
  try {
    const base = Date.now() - 20_000
    const sessionID = Identifier.ascending("session")
    event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      sequence: 1,
      emittedAt: base + 100,
      payload: { missionID: "mission-reopen", requestID: "request-open-1" },
    })
    event(sqlite, {
      sessionID,
      type: "mission.execution.closing",
      sequence: 2,
      emittedAt: base + 300,
      payload: { missionID: "mission-reopen", requestID: "request-close-1" },
    })
    event(sqlite, {
      sessionID,
      type: "mission.execution.closed",
      sequence: 3,
      emittedAt: base + 400,
      payload: { missionID: "mission-reopen", requestID: "request-close-1" },
    })
    event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      sequence: 4,
      emittedAt: base + 500,
      payload: { missionID: "mission-reopen", requestID: "request-open-2" },
    })
    const legacy = markerPayload()
    marker(sqlite, sessionID, legacy, base + 200)

    expect(() => migrateMissionExecutionReconciliationFacts(sqlite)).toThrow(
      "2 opened events and no exact causal pointer",
    )
    expect({
      markerIDs: retainedControlIDs(sqlite),
    }).toEqual({
      markerIDs: [legacy.occurrenceID],
    })
  } finally {
    sqlite.close()
  }
})

test("uses an explicit persisted pointer to migrate a legacy marker across multiple opened occurrences", () => {
  const sqlite = database()
  try {
    const sessionID = Identifier.ascending("session")
    const firstOpenedID = event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      sequence: 1,
      payload: { missionID: "mission-pointed-recovery", requestID: "request-open-1" },
    })
    const closeOperationID = crypto.randomUUID()
    event(sqlite, {
      sessionID,
      type: "mission.execution.closing",
      operationID: closeOperationID,
      sequence: 2,
      payload: { missionID: "mission-pointed-recovery", requestID: "request-close-1" },
    })
    event(sqlite, {
      sessionID,
      type: "mission.execution.closed",
      operationID: closeOperationID,
      sequence: 3,
      payload: { missionID: "mission-pointed-recovery", requestID: "request-close-1" },
    })
    event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      sequence: 4,
      payload: { missionID: "mission-pointed-recovery", requestID: "request-open-2" },
    })
    const legacy = markerPayload()
    marker(sqlite, sessionID, legacy)
    message(sqlite, {
      id: legacy.wakeMessageID,
      sessionID,
      role: "user",
      author: "OpenCorvus runtime recovery",
    })
    textPart(sqlite, {
      id: legacy.wakeTextPartID,
      messageID: legacy.wakeMessageID,
      text: recoveryPrompt(legacy),
    })
    wakeControl(sqlite, {
      marker: legacy,
      sessionID,
      missionID: "mission-pointed-recovery",
      openedEventID: firstOpenedID,
    })

    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(true)
    const migratedReason = JSON.parse(
      sqlite.query<{ data: string }, [string]>("SELECT data FROM message WHERE id=?").get(legacy.wakeMessageID)!.data,
    ).extra.wake_reason
    expect(migratedReason).toEqual(
      expect.objectContaining({
        source: "mission.process_recovery",
        version: 3,
        occurrenceID: legacy.occurrenceID,
        openedEventID: firstOpenedID,
      }),
    )
  } finally {
    sqlite.close()
  }
})

test("upgrades a uniquely bound legacy operator Message and preserves current strict identities", () => {
  const sqlite = database()
  try {
    const base = Date.now() - 20_000
    const legacySession = Identifier.ascending("session")
    const currentSession = Identifier.ascending("session")
    const legacyOpened = event(sqlite, {
      sessionID: legacySession,
      type: "mission.execution.opened",
      sequence: 1,
      emittedAt: base + 100,
      payload: { missionID: "mission-legacy-operator", requestID: "legacy-open" },
    })
    const openedFingerprint = "a".repeat(64)
    const currentOpened = event(sqlite, {
      sessionID: currentSession,
      type: "mission.execution.opened",
      sequence: 1,
      emittedAt: base + 100,
      payload: {
        missionID: "mission-current-operator",
        requestID: "current-open",
        requestFingerprint: openedFingerprint,
      },
    })
    const legacyMessageID = Identifier.ascending("message")
    message(sqlite, {
      id: legacyMessageID,
      sessionID: legacySession,
      role: "user",
      timeCreated: base + 200,
      extra: { wake_reason: { source: "mission.operator", missionID: "mission-legacy-operator" } },
    })
    const currentRequestID = "current-operator-request"
    const currentFingerprint = "b".repeat(64)
    const currentIdentity = `mission-operator-request\0${currentSession}\0mission.wake\0${currentRequestID}`
    const currentMessageID = Identifier.deterministic(
      "message",
      `${currentIdentity}\0message`,
    )
    const currentReason = {
      source: "mission.operator",
      missionID: "mission-current-operator",
      requestID: currentRequestID,
      requestFingerprint: currentFingerprint,
      openedEventID: currentOpened,
    }
    message(sqlite, {
      id: currentMessageID,
      sessionID: currentSession,
      role: "user",
      timeCreated: base + 200,
      author: "base",
      extra: { wake_reason: currentReason },
    })
    const currentTextPartID = Identifier.deterministic("part", `${currentIdentity}\0text`)
    textPart(sqlite, {
      id: currentTextPartID,
      messageID: currentMessageID,
      text: "Current operator request",
      timeCreated: base + 214,
    })
    const currentControlID = Identifier.deterministic("session_control", `${currentIdentity}\0control`)
    sqlite
      .query(
        `INSERT INTO session_control_record(id,session_id,kind,source,payload,time_created)
         VALUES(?,?,'wake_reason','mission.operator',?,?)`,
      )
      .run(
        currentControlID,
        currentSession,
        JSON.stringify({ messageID: currentMessageID, wake_reason: currentReason }),
        base + 200,
      )
    sqlite
      .query("INSERT INTO session_control_event(id,control_id,kind,payload,time_created) VALUES(?,?,'consumed',NULL,?)")
      .run(Identifier.deterministic("session_control", `terminal\0${currentControlID}`), currentControlID, base + 200)

    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(true)
    const readReason = (messageID: string) =>
      JSON.parse(sqlite.query<{ data: string }, [string]>("SELECT data FROM message WHERE id=?").get(messageID)!.data)
        .extra.wake_reason
    expect({
      legacyOpenedFingerprint: JSON.parse(
        sqlite.query<{ payload: string }, [string]>("SELECT payload FROM protocol_event WHERE id=?").get(legacyOpened)!
          .payload,
      ).requestFingerprint,
      legacyReason: readReason(legacyMessageID),
      currentReason: readReason(currentMessageID),
      secondChanged: migrateMissionExecutionReconciliationFacts(sqlite),
    }).toEqual({
      legacyOpenedFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      legacyReason: {
        source: "mission.operator",
        missionID: "mission-legacy-operator",
        requestID: `legacy-message:${legacyMessageID}`,
        requestFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        openedEventID: legacyOpened,
      },
      currentReason,
      secondChanged: false,
    })
  } finally {
    sqlite.close()
  }
})

test("fails closed when a legacy operator Message has multiple opened occurrences and no causal pointer", () => {
  const sqlite = database()
  try {
    const sessionID = Identifier.ascending("session")
    const firstOperationID = crypto.randomUUID()
    event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      operationID: firstOperationID,
      sequence: 1,
      payload: { missionID: "mission-ambiguous-operator", requestID: "request-open-1" },
    })
    event(sqlite, {
      sessionID,
      type: "mission.execution.closing",
      operationID: crypto.randomUUID(),
      sequence: 2,
      payload: { missionID: "mission-ambiguous-operator", requestID: "request-close-1" },
    })
    event(sqlite, {
      sessionID,
      type: "mission.execution.closed",
      operationID: pendingCloseOperations.get(sqlite)!.get(sessionID),
      sequence: 3,
      payload: { missionID: "mission-ambiguous-operator", requestID: "request-close-1" },
    })
    event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      sequence: 4,
      payload: { missionID: "mission-ambiguous-operator", requestID: "request-open-2" },
    })
    const messageID = Identifier.ascending("message")
    message(sqlite, {
      id: messageID,
      sessionID,
      role: "user",
      extra: { wake_reason: { source: "mission.operator", missionID: "mission-ambiguous-operator" } },
    })

    expect(() => migrateMissionExecutionReconciliationFacts(sqlite)).toThrow(
      "2 opened events and no exact causal pointer",
    )
    expect(
      JSON.parse(sqlite.query<{ data: string }, [string]>("SELECT data FROM message WHERE id=?").get(messageID)!.data)
        .extra.wake_reason,
    ).toEqual({ source: "mission.operator", missionID: "mission-ambiguous-operator" })
  } finally {
    sqlite.close()
  }
})

test("accepts a recovered historical close that reuses the exact closing provenance on restart", () => {
  const sqlite = database()
  try {
    const sessionID = Identifier.ascending("session")
    const operationID = crypto.randomUUID()
    const closingID = event(sqlite, {
      sessionID,
      type: "mission.execution.closing",
      operationID,
      sequence: 1,
      payload: { missionID: "mission-historical-resume", requestID: "request-historical-resume" },
    })
    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(true)
    const closingPayload = JSON.parse(
      sqlite.query<{ payload: string }, [string]>("SELECT payload FROM protocol_event WHERE id=?").get(closingID)!.payload,
    )
    event(sqlite, {
      sessionID,
      type: "mission.execution.closed",
      operationID,
      sequence: 2,
      payload: {
        missionID: "mission-historical-resume",
        requestID: "request-historical-resume",
        provenance: closingPayload.provenance,
      },
    })

    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(false)
    expect(closingPayload.provenance).toEqual({
      kind: "historical_reconciliation",
      sourceEventID: closingID,
    })
  } finally {
    sqlite.close()
  }
})

test("rebuilds legacy scheduler fire facts to the exact Mission disposition schema", () => {
  const sqlite = database()
  try {
    sqlite.exec(`
      CREATE TABLE session (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL
      );
      CREATE TABLE automation (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT
      );
      CREATE TABLE event_job (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT
      );
      CREATE TABLE event_occurrence (
        id TEXT PRIMARY KEY NOT NULL
      );
      CREATE TABLE automation_run (
        id TEXT PRIMARY KEY NOT NULL,
        automation_revision_id TEXT NOT NULL,
        fire_id TEXT NOT NULL,
        target_project_id TEXT,
        started_at INTEGER NOT NULL
      );
      CREATE TABLE automation_run_receipt (
        id TEXT PRIMARY KEY NOT NULL,
        run_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        retry_at INTEGER,
        error TEXT,
        time_created INTEGER NOT NULL
      );
      CREATE TABLE event_job_fire (
        id TEXT PRIMARY KEY NOT NULL,
        event_job_revision_id TEXT NOT NULL,
        event_occurrence_id TEXT NOT NULL,
        causation_fire_id TEXT,
        created_session_id TEXT,
        time_created INTEGER NOT NULL
      );
      CREATE TABLE event_job_fire_receipt (
        id TEXT PRIMARY KEY NOT NULL,
        fire_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        disposition TEXT,
        message_id TEXT,
        retry_at INTEGER,
        error TEXT,
        time_created INTEGER NOT NULL
      );
    `)

    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(true)
    const columns = (table: string) =>
      sqlite.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all().map((row) => row.name)
    expect({
      automationRun: columns("automation_run"),
      automationReceipt: columns("automation_run_receipt"),
      eventFire: columns("event_job_fire"),
      eventReceipt: columns("event_job_fire_receipt"),
      eventReceiptDDL: sqlite
        .query<{ sql: string }, []>(
          "SELECT sql FROM sqlite_schema WHERE type='table' AND name='event_job_fire_receipt'",
        )
        .get()!.sql,
      secondChanged: migrateMissionExecutionReconciliationFacts(sqlite),
    }).toMatchObject({
      automationRun: expect.arrayContaining(["mission_opened_event_id"]),
      automationReceipt: expect.arrayContaining(["disposition", "closure_event_id"]),
      eventFire: expect.arrayContaining(["mission_opened_event_id"]),
      eventReceipt: expect.arrayContaining(["closure_event_id"]),
      eventReceiptDDL: expect.stringContaining("mission_closed"),
      secondChanged: false,
    })
  } finally {
    sqlite.close()
  }
})

test.each([
  {
    label: "automation run",
    setup(sqlite: SQLite, sessionID: string) {
      sqlite.exec(`
        CREATE TABLE session(id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL);
        CREATE TABLE automation(id TEXT PRIMARY KEY NOT NULL, session_id TEXT);
        CREATE TABLE automation_run(
          id TEXT PRIMARY KEY NOT NULL,
          automation_revision_id TEXT NOT NULL,
          fire_id TEXT NOT NULL,
          target_project_id TEXT,
          started_at INTEGER NOT NULL
        );
      `)
      sqlite.query("INSERT INTO session(id,kind) VALUES(?,'mission')").run(sessionID)
      sqlite.query("INSERT INTO automation(id,session_id) VALUES('automation-legacy-mission',?)").run(sessionID)
      sqlite
        .query(
          "INSERT INTO automation_run(id,automation_revision_id,fire_id,target_project_id,started_at) VALUES('run-legacy-mission','automation-legacy-mission','fire-legacy',NULL,?)",
        )
        .run(Date.now())
      return {
        table: "automation_run",
        id: "run-legacy-mission",
        columns: ["id", "automation_revision_id", "fire_id", "target_project_id", "started_at"],
      }
    },
  },
  {
    label: "Event fire",
    setup(sqlite: SQLite, sessionID: string) {
      sqlite.exec(`
        CREATE TABLE session(id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL);
        CREATE TABLE event_job(id TEXT PRIMARY KEY NOT NULL, session_id TEXT);
        CREATE TABLE event_job_fire(
          id TEXT PRIMARY KEY NOT NULL,
          event_job_revision_id TEXT NOT NULL,
          event_occurrence_id TEXT NOT NULL,
          causation_fire_id TEXT,
          created_session_id TEXT,
          time_created INTEGER NOT NULL
        );
      `)
      sqlite.query("INSERT INTO session(id,kind) VALUES(?,'mission')").run(sessionID)
      sqlite.query("INSERT INTO event_job(id,session_id) VALUES('event-legacy-mission',?)").run(sessionID)
      sqlite
        .query(
          "INSERT INTO event_job_fire(id,event_job_revision_id,event_occurrence_id,causation_fire_id,created_session_id,time_created) VALUES('event-fire-legacy-mission','event-legacy-mission','occurrence-legacy',NULL,NULL,?)",
        )
        .run(Date.now())
      return {
        table: "event_job_fire",
        id: "event-fire-legacy-mission",
        columns: [
          "id",
          "event_job_revision_id",
          "event_occurrence_id",
          "causation_fire_id",
          "created_session_id",
          "time_created",
        ],
      }
    },
  },
])("rolls back an ambiguous legacy Mission $label instead of guessing an opened occurrence", ({ setup }) => {
  const sqlite = database()
  try {
    const seeded = setup(sqlite, Identifier.ascending("session"))
    expect(() => migrateMissionExecutionReconciliationFacts(sqlite)).toThrow(
      "has no durable opened occurrence pointer",
    )
    expect({
      row: sqlite.query<{ id: string }, []>(`SELECT id FROM ${seeded.table}`).get()?.id,
      columns: sqlite.query<{ name: string }, []>(`PRAGMA table_info(${seeded.table})`).all().map((row) => row.name),
    }).toEqual({
      row: seeded.id,
      columns: seeded.columns,
    })
  } finally {
    sqlite.close()
  }
})

test.each([
  {
    label: "unknown source",
    seed(sqlite: SQLite, sessionID: string) {
      return event(sqlite, {
        sessionID,
        type: "mission.execution.opened",
        source: "mission.test",
        sequence: 1,
        payload: { missionID: "mission-invalid-source", requestID: "request-invalid-source" },
      })
    },
  },
  {
    label: "non-UUID operation",
    seed(sqlite: SQLite, sessionID: string) {
      return event(sqlite, {
        sessionID,
        type: "mission.execution.opened",
        operationID: "legacy-operation",
        sequence: 1,
        payload: { missionID: "mission-invalid-operation", requestID: "request-invalid-operation" },
      })
    },
  },
  {
    label: "closed event without the exact closing operation",
    seed(sqlite: SQLite, sessionID: string) {
      event(sqlite, {
        sessionID,
        type: "mission.execution.closing",
        operationID: crypto.randomUUID(),
        sequence: 1,
        payload: { missionID: "mission-invalid-sequence", requestID: "request-invalid-sequence" },
      })
      return event(sqlite, {
        sessionID,
        type: "mission.execution.closed",
        operationID: crypto.randomUUID(),
        sequence: 2,
        payload: { missionID: "mission-invalid-sequence", requestID: "request-invalid-sequence" },
      })
    },
  },
  {
    label: "closing event after closed without a reopened occurrence",
    seed(sqlite: SQLite, sessionID: string) {
      const operationID = crypto.randomUUID()
      event(sqlite, {
        sessionID,
        type: "mission.execution.closing",
        operationID,
        sequence: 1,
        payload: { missionID: "mission-closed-sequence", requestID: "request-closed-sequence" },
      })
      event(sqlite, {
        sessionID,
        type: "mission.execution.closed",
        operationID,
        sequence: 2,
        payload: { missionID: "mission-closed-sequence", requestID: "request-closed-sequence" },
      })
      return event(sqlite, {
        sessionID,
        type: "mission.execution.closing",
        sequence: 3,
        payload: { missionID: "mission-closed-sequence", requestID: "request-next-close" },
      })
    },
  },
  {
    label: "reopened occurrence with a different Mission identity",
    seed(sqlite: SQLite, sessionID: string) {
      const operationID = crypto.randomUUID()
      event(sqlite, {
        sessionID,
        type: "mission.execution.closing",
        operationID,
        sequence: 1,
        payload: { missionID: "mission-original", requestID: "request-original" },
      })
      event(sqlite, {
        sessionID,
        type: "mission.execution.closed",
        operationID,
        sequence: 2,
        payload: { missionID: "mission-original", requestID: "request-original" },
      })
      return event(sqlite, {
        sessionID,
        type: "mission.execution.opened",
        sequence: 3,
        payload: { missionID: "mission-replaced", requestID: "request-replaced" },
      })
    },
  },
])("rolls back a legacy Mission closure with $label", ({ seed }) => {
  const sqlite = database()
  try {
    const eventID = seed(sqlite, Identifier.ascending("session"))
    const before = sqlite.query<{ payload: string }, [string]>("SELECT payload FROM protocol_event WHERE id=?").get(eventID)!
      .payload
    expect(() => migrateMissionExecutionReconciliationFacts(sqlite)).toThrow()
    expect(
      sqlite.query<{ payload: string }, [string]>("SELECT payload FROM protocol_event WHERE id=?").get(eventID)!.payload,
    ).toBe(before)
  } finally {
    sqlite.close()
  }
})

test("maps a closing-only legacy Mission wake receipt without terminal lineage to one migration error", () => {
  const sqlite = database()
  try {
    const now = Date.now()
    const sessionID = Identifier.ascending("session")
    event(sqlite, {
      sessionID,
      type: "mission.execution.opened",
      sequence: 1,
      payload: { missionID: "mission-closing-wake-migration", requestID: "open-closing-wake-migration" },
    })
    const schedulerEventID = Identifier.ascending("protocol_event")
    sqlite
      .query(
        `INSERT INTO protocol_event(
          id,type,aggregate_type,aggregate_id,session_id,source,correlation_id,seq,emitted_at,payload
        ) VALUES(?,'scheduler.message','session',?,NULL,'scheduler.message',?,2,?,?)`,
      )
      .run(schedulerEventID, sessionID, crypto.randomUUID(), now, JSON.stringify({ message_kind: "notification" }))
    const closureID = event(sqlite, {
      sessionID,
      type: "mission.execution.closing",
      sequence: 3,
      payload: { missionID: "mission-closing-wake-migration", requestID: "close-closing-wake-migration" },
    })
    const inboxID = Identifier.ascending("protocol_inbox")
    const messageID = Identifier.ascending("message")
    const receiptID = Identifier.ascending("protocol_inbox")
    sqlite
      .query(
        "INSERT INTO protocol_inbox(id,envelope_id,actor,actor_id,visible_at,time_created) VALUES(?,?,'session',?,?,?)",
      )
      .run(inboxID, schedulerEventID, sessionID, now, now)
    sqlite
      .query("INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)")
      .run(
        messageID,
        sessionID,
        now,
        now,
        JSON.stringify({
          role: "user",
          author: "orchestrator",
          time: { created: now },
          agent: "mission",
          model: { providerID: "test", modelID: "test" },
          extra: {
            wake_reason: {
              source: "scheduler.message",
              eventID: schedulerEventID,
              inboxID,
              threadID: "thread-closing-wake-migration",
              messageKind: "notification",
              sourceEndpoint: {
                kind: "task_scheduler",
                project_id: "project-closing-wake-migration",
                task_id: Identifier.ascending("task"),
                root_session_id: Identifier.ascending("session"),
              },
              targetEndpoint: {
                kind: "mission_scheduler",
                project_id: "project-closing-wake-migration",
                mission_id: "mission-closing-wake-migration",
                session_id: sessionID,
              },
            },
          },
        }),
      )
    const legacyReceipt = {
      kind: "mission_wake_closed",
      message_id: messageID,
      closure_event_id: closureID,
    }
    sqlite
      .query("INSERT INTO protocol_delivery_receipt(id,inbox_id,receipt,time_created) VALUES(?,?,?,?)")
      .run(receiptID, inboxID, JSON.stringify(legacyReceipt), now + 1)

    expect(() => migrateMissionExecutionReconciliationFacts(sqlite)).toThrow(
      `Legacy Mission wake closure receipt ${receiptID} has no terminal assistant reply`,
    )
    expect({
      receipt: JSON.parse(
        sqlite
          .query<{ receipt: string }, [string]>("SELECT receipt FROM protocol_delivery_receipt WHERE id=?")
          .get(receiptID)!.receipt,
      ),
      immutableTrigger: sqlite
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_schema WHERE type='trigger' AND name='protocol_delivery_receipt_no_update'",
        )
        .get()?.name,
    }).toEqual({
      receipt: legacyReceipt,
      immutableTrigger: "protocol_delivery_receipt_no_update",
    })
  } finally {
    sqlite.close()
  }
})

test("runs against the complete production schema without leaving schema drift", () => {
  const sqlite = new SQLite(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    const now = Date.now()
    const sessionID = Identifier.ascending("session")
    const closureID = Identifier.ascending("protocol_event")
    const openedID = Identifier.ascending("protocol_event")
    const schedulerEventID = Identifier.ascending("protocol_event")
    const schedulerInboxID = Identifier.ascending("protocol_inbox")
    const schedulerReceiptID = Identifier.ascending("protocol_inbox")
    const schedulerMessageID = Identifier.ascending("message")
    const schedulerReplyID = Identifier.ascending("message")
    const markerData = markerPayload()
    sqlite
      .query("INSERT INTO project(id,worktree,time_created,time_updated,sandboxes,generation) VALUES(?,?,?,?,?,?)")
      .run("project-mission-migration", "/mission-migration", now, now, "[]", crypto.randomUUID())
    sqlite
      .query(
        `INSERT INTO session(id,project_id,slug,directory,title,version,kind,metadata,time_created,time_updated)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        sessionID,
        "project-mission-migration",
        "mission-migration",
        "/mission-migration",
        "Mission migration",
        "test",
        "mission",
        JSON.stringify({
          mission: {
            id: "mission-production-schema",
            channelKey: "mission:mission-production-schema",
            cwd: "/mission-migration",
            productPillar: "code",
            visibleExpertSquadIDs: ["base"],
          },
        }),
        now - 500,
        now,
      )
    sqlite
      .query(
        `INSERT INTO protocol_event(
          id,kind,type,aggregate_type,aggregate_id,source,correlation_id,seq,emitted_at,payload
        ) VALUES(?,'event','mission.execution.opened','session',?,'mission.wake',?,1,?,?)`,
      )
      .run(
        openedID,
        sessionID,
        crypto.randomUUID(),
        now - 200,
        JSON.stringify({ missionID: "mission-production-schema", requestID: "request-open-production-schema" }),
      )
    sqlite
      .query(
        `INSERT INTO protocol_event(
          id,kind,type,aggregate_type,aggregate_id,source,correlation_id,seq,emitted_at,payload
        ) VALUES(?,'event','mission.execution.closing','session',?,'mission.abort',?,3,?,?)`,
      )
      .run(
        closureID,
        sessionID,
        crypto.randomUUID(),
        now + 200,
        JSON.stringify({ missionID: "mission-production-schema", requestID: "request-production-schema" }),
      )
    sqlite
      .query(
        `INSERT INTO protocol_event(
          id,kind,type,aggregate_type,aggregate_id,source,correlation_id,seq,emitted_at,payload
        ) VALUES(?,'event','scheduler.message','session',?,'scheduler.message',?,2,?,?)`,
      )
      .run(
        schedulerEventID,
        sessionID,
        crypto.randomUUID(),
        now,
        JSON.stringify({ message_kind: "notification" }),
      )
    sqlite
      .query(
        `INSERT INTO protocol_inbox(id,envelope_id,actor,actor_id,visible_at,time_created)
         VALUES(?,?,'session',?,?,?)`,
      )
      .run(schedulerInboxID, schedulerEventID, sessionID, now, now)
    const schedulerSource = {
      kind: "task_scheduler",
      project_id: "project-mission-migration",
      task_id: Identifier.ascending("task"),
      root_session_id: Identifier.ascending("session"),
    }
    const schedulerTarget = {
      kind: "mission_scheduler",
      project_id: "project-mission-migration",
      mission_id: "mission-production-schema",
      session_id: sessionID,
    }
    sqlite
      .query("INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)")
      .run(
        schedulerMessageID,
        sessionID,
        now,
        now,
        JSON.stringify({
          role: "user",
          author: "orchestrator",
          time: { created: now },
          agent: "mission",
          model: { providerID: "test", modelID: "test" },
          extra: {
            wake_reason: {
              source: "scheduler.message",
              eventID: schedulerEventID,
              inboxID: schedulerInboxID,
              threadID: "thread-mission-migration",
              messageKind: "notification",
              sourceEndpoint: schedulerSource,
              targetEndpoint: schedulerTarget,
            },
          },
        }),
      )
    sqlite
      .query("INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)")
      .run(
        schedulerReplyID,
        sessionID,
        now + 1,
        now + 1,
        JSON.stringify({
          role: "assistant",
          author: "mission",
          parentID: schedulerMessageID,
          time: { created: now + 1, completed: now + 2 },
          agent: "mission",
          providerID: "test",
          modelID: "test",
          path: { cwd: "/mission-migration", root: "/mission-migration" },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          error: { name: "UnknownError", data: { message: "Historical close settlement" } },
        }),
      )
    sqlite
      .query(
        `INSERT INTO protocol_delivery_receipt(id,inbox_id,receipt,time_created)
         VALUES(?,?,?,?)`,
      )
      .run(
        schedulerReceiptID,
        schedulerInboxID,
        JSON.stringify({
          kind: "mission_wake_closed",
          message_id: schedulerMessageID,
          closure_event_id: closureID,
        }),
        now + 3,
      )
    marker(sqlite, sessionID, markerData, now)
    sqlite.exec("PRAGMA foreign_keys=ON")

    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(true)

    const closurePayload = JSON.parse(
      sqlite.query<{ payload: string }, [string]>("SELECT payload FROM protocol_event WHERE id=?").get(closureID)!
        .payload,
    )
    const schedulerReceipt = JSON.parse(
      sqlite
        .query<{ receipt: string }, [string]>("SELECT receipt FROM protocol_delivery_receipt WHERE id=?")
        .get(schedulerReceiptID)!.receipt,
    )
    expect({
      provenance: closurePayload.provenance,
      retainedControls: retainedControlIDs(sqlite),
      schemaDrift: findSchemaDrift(sqlite),
      schedulerReceipt,
    }).toMatchObject({
      provenance: { kind: "historical_reconciliation", sourceEventID: closureID },
      retainedControls: [markerData.wakeControlID],
      schemaDrift: undefined,
      schedulerReceipt: { kind: "session_wake", message_id: schedulerMessageID },
    })
    expect(migrateMissionExecutionReconciliationFacts(sqlite)).toBe(false)
  } finally {
    sqlite.close()
  }
})
