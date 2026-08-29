import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { deriveEngineArtifactCatalogMetadata, serializeEngineArtifactPayload } from "@/engine/artifact-catalog-metadata"
import {
  DispatchLineageOwnerMigrationTestHooks,
  migrateDispatchLineageDeliveryOwners,
} from "@/storage/dispatch-lineage-owner-migration"

function database(filename = ":memory:") {
  const sqlite = new SQLite(filename)
  sqlite.exec(`
    CREATE TABLE engine_artifact_catalog_revision (
      revision INTEGER PRIMARY KEY AUTOINCREMENT
    );
    CREATE TABLE engine_artifact (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      payload TEXT,
      payload_sha256 TEXT NOT NULL,
      payload_bytes INTEGER NOT NULL,
      payload_block_sha256s TEXT NOT NULL,
      payload_block_index_sha256 TEXT NOT NULL,
      catalog_artifact_type TEXT,
      catalog_schema_diagnostic TEXT,
      catalog_producer TEXT,
      catalog_import_source_task_id TEXT,
      catalog_resource_count INTEGER NOT NULL,
      catalog_resource_media_types TEXT NOT NULL,
      catalog_search_text TEXT NOT NULL,
      catalog_search_text_truncated INTEGER NOT NULL,
      catalog_metadata_sha256 TEXT NOT NULL,
      catalog_revision INTEGER NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL
    );
    CREATE TABLE protocol_event (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      aggregate_type TEXT,
      aggregate_id TEXT,
      task_id TEXT,
      session_id TEXT,
      payload TEXT NOT NULL,
      emitted_at INTEGER NOT NULL
    );
    CREATE TABLE worker_turn_descriptor (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE message (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TRIGGER engine_dispatch_lineage_immutable
    BEFORE UPDATE ON engine_artifact
    FOR EACH ROW
    WHEN OLD.kind = 'dispatch_lineage' OR NEW.kind = 'dispatch_lineage'
    BEGIN
      SELECT RAISE(ABORT, 'engine_artifact: dispatch_lineage facts are immutable');
    END;
  `)
  return sqlite
}

function insertArtifact(
  sqlite: SQLite,
  input: { id: string; taskID: string; kind: string; payload: Record<string, unknown>; time: number },
) {
  const revision = sqlite
    .query<{ revision: number }, []>("INSERT INTO engine_artifact_catalog_revision DEFAULT VALUES RETURNING revision")
    .get()!.revision
  sqlite
    .query(
      `INSERT INTO engine_artifact(
        id,task_id,kind,label,payload,payload_sha256,payload_bytes,payload_block_sha256s,
        payload_block_index_sha256,catalog_resource_count,catalog_resource_media_types,
        catalog_search_text,catalog_search_text_truncated,catalog_metadata_sha256,catalog_revision,
        time_created,time_updated
      ) VALUES(?,?,?,?,?,'legacy',1,'[]','legacy',0,'[]','',0,'legacy',?,?,?)`,
    )
    .run(
      input.id,
      input.taskID,
      input.kind,
      input.kind,
      JSON.stringify(input.payload),
      revision,
      input.time,
      input.time,
    )
}

function legacyLineage(input: {
  id: string
  taskID: string
  dispatchID: string
  childSessionID: string
  owner?: string
  time: number
}) {
  return {
    id: input.id,
    taskID: input.taskID,
    kind: "dispatch_lineage",
    time: input.time,
    payload: {
      dispatch_id: input.dispatchID,
      task_id: input.taskID,
      child_session_id: input.childSessionID,
      ...(input.owner ? { owner_process_occurrence_id: input.owner } : {}),
      adapter_input: {},
    },
  }
}

function payload(sqlite: SQLite, id: string): Record<string, any> {
  const text = sqlite
    .query<{ payload: string }, [string]>("SELECT payload FROM engine_artifact WHERE id=?")
    .get(id)!.payload
  return JSON.parse(text) as Record<string, any>
}

test("classifies every historical dispatch owner into the current exact owner fact", () => {
  const sqlite = database()
  try {
    const now = Date.now()
    insertArtifact(
      sqlite,
      legacyLineage({
        id: "art_runtime_lineage",
        taskID: "tsk_runtime",
        dispatchID: "dispatch-runtime",
        childSessionID: "ses_runtime",
        owner: "runtime-peer-occurrence",
        time: now,
      }),
    )
    insertArtifact(
      sqlite,
      legacyLineage({
        id: "art_settled_lineage",
        taskID: "tsk_settled",
        dispatchID: "dispatch-settled",
        childSessionID: "ses_settled",
        time: now + 1,
      }),
    )
    insertArtifact(sqlite, {
      id: "art_existing_settlement",
      taskID: "tsk_settled",
      kind: "dispatch_settlement",
      payload: {
        task_id: "tsk_settled",
        dispatch_lineage_id: "art_settled_lineage",
        dispatch_id: "dispatch-settled",
        session_id: "ses_settled",
      },
      time: now + 2,
    })
    insertArtifact(
      sqlite,
      legacyLineage({
        id: "art_terminal_lineage",
        taskID: "tsk_terminal",
        dispatchID: "dispatch-terminal",
        childSessionID: "ses_terminal",
        time: now + 3,
      }),
    )
    sqlite.query("INSERT INTO worker_turn_descriptor(id,session_id,payload) VALUES(?,?,?)").run(
      "wtd_terminal",
      "ses_terminal",
      JSON.stringify({
        messageAuthority: { user_message_id: "msg_terminal_input" },
        dispatchTurn: { current_dispatch_id: "dispatch-terminal" },
      }),
    )
    sqlite
      .query(
        "INSERT INTO protocol_event(id,type,aggregate_type,aggregate_id,task_id,session_id,payload,emitted_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        "pev_terminal",
        "agent.execution.lifecycle",
        "task",
        "tsk_terminal",
        null,
        "ses_terminal",
        JSON.stringify({
          inputMessageID: "msg_terminal_input",
          status: { type: "terminal", reason: "completed", final_message_id: "msg_terminal_final" },
        }),
        now + 4,
      )
    sqlite.query("INSERT INTO message(id,session_id,data) VALUES(?,?,?)").run(
      "msg_terminal_final",
      "ses_terminal",
      JSON.stringify({
        role: "assistant",
        parentID: "msg_terminal_input",
        time: { created: now + 3, completed: now + 4 },
        finish: "stop",
      }),
    )
    insertArtifact(
      sqlite,
      legacyLineage({
        id: "art_unreplayable_lineage",
        taskID: "tsk_unreplayable",
        dispatchID: "dispatch-unreplayable",
        childSessionID: "ses_unreplayable",
        time: now + 5,
      }),
    )
    sqlite.query("INSERT INTO worker_turn_descriptor(id,session_id,payload) VALUES(?,?,?)").run(
      "wtd_unreplayable",
      "ses_unreplayable",
      JSON.stringify({
        messageAuthority: { user_message_id: "msg_unreplayable_input" },
        dispatchTurn: { current_dispatch_id: "dispatch-unreplayable" },
      }),
    )
    sqlite
      .query(
        "INSERT INTO protocol_event(id,type,aggregate_type,aggregate_id,task_id,session_id,payload,emitted_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        "pev_unreplayable",
        "agent.execution.lifecycle",
        "task",
        "tsk_unreplayable",
        null,
        "ses_unreplayable",
        JSON.stringify({
          inputMessageID: "msg_unreplayable_input",
          status: { type: "terminal", reason: "completed" },
        }),
        now + 6,
      )
    insertArtifact(
      sqlite,
      legacyLineage({
        id: "art_interrupted_lineage",
        taskID: "tsk_interrupted",
        dispatchID: "dispatch-interrupted",
        childSessionID: "ses_interrupted",
        time: now + 7,
      }),
    )

    expect(migrateDispatchLineageDeliveryOwners(sqlite)).toBe(true)

    const runtime = payload(sqlite, "art_runtime_lineage")
    const settled = payload(sqlite, "art_settled_lineage")
    const terminal = payload(sqlite, "art_terminal_lineage")
    const unreplayable = payload(sqlite, "art_unreplayable_lineage")
    const interrupted = payload(sqlite, "art_interrupted_lineage")
    const migrationSettlement = sqlite
      .query<{ id: string; payload: string }, []>(
        `SELECT id,payload FROM engine_artifact
         WHERE task_id='tsk_interrupted' AND kind='dispatch_settlement'`,
      )
      .get()!
    const migrationInfrastructure = sqlite
      .query<{ id: string; payload: string }, []>(
        `SELECT id,payload FROM engine_artifact
         WHERE task_id='tsk_interrupted' AND kind='task-infrastructure-error'`,
      )
      .get()!
    const rewritten = sqlite
      .query<
        { payload: string; payload_sha256: string },
        [string]
      >("SELECT payload,payload_sha256 FROM engine_artifact WHERE id=?")
      .get("art_interrupted_lineage")!
    const exactMetadata = deriveEngineArtifactCatalogMetadata({
      kind: "dispatch_lineage",
      payloadText: serializeEngineArtifactPayload(JSON.parse(rewritten.payload)),
    })
    const trigger = sqlite
      .query<
        { name: string },
        []
      >("SELECT name FROM sqlite_schema WHERE type='trigger' AND name='engine_dispatch_lineage_immutable'")
      .get()

    expect({
      runtimeOwner: runtime.delivery_owner,
      settledOwner: settled.delivery_owner,
      terminalOwner: terminal.delivery_owner,
      unreplayableOwner: unreplayable.delivery_owner,
      interruptedOwner: interrupted.delivery_owner,
      migrationOutcome: JSON.parse(migrationSettlement.payload).outcome,
      migrationInfrastructure: JSON.parse(migrationInfrastructure.payload),
      exactPayloadSHA256: rewritten.payload_sha256,
      expectedPayloadSHA256: exactMetadata.payload_sha256,
      trigger: trigger?.name,
      secondMigrationChanged: migrateDispatchLineageDeliveryOwners(sqlite),
    }).toMatchObject({
      runtimeOwner: { kind: "runtime_process", process_occurrence_id: "runtime-peer-occurrence" },
      settledOwner: {
        kind: "historical_reconciliation",
        source: { kind: "dispatch_settlement", artifact_id: "art_existing_settlement" },
      },
      terminalOwner: {
        kind: "historical_reconciliation",
        source: { kind: "agent_execution_lifecycle", event_id: "pev_terminal" },
      },
      unreplayableOwner: {
        kind: "historical_reconciliation",
        source: { kind: "dispatch_settlement" },
      },
      interruptedOwner: {
        kind: "historical_reconciliation",
        source: { kind: "dispatch_settlement", artifact_id: migrationSettlement.id },
      },
      migrationOutcome: {
        kind: "infrastructure_failure",
        operation: "migrate-unattributed-dispatch-owner",
        session_id: "ses_interrupted",
        infrastructure_error: { artifact_id: migrationInfrastructure.id },
      },
      migrationInfrastructure: {
        component: "dispatch-agent",
        operation: "migrate-unattributed-dispatch-owner",
        sessionID: "ses_interrupted",
      },
      exactPayloadSHA256: exactMetadata.payload_sha256,
      expectedPayloadSHA256: exactMetadata.payload_sha256,
      trigger: "engine_dispatch_lineage_immutable",
      secondMigrationChanged: false,
    })
  } finally {
    sqlite.close(true)
  }
})

test("takes the writer reservation before it scans legacy lineages", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "opencorvus-dispatch-owner-migration-"))
  const filename = path.join(directory, "migration.db")
  const sqlite = database(filename)
  const peer = new SQLite(filename)
  try {
    peer.exec("PRAGMA busy_timeout=0")
    insertArtifact(
      sqlite,
      legacyLineage({
        id: "art_before_admission",
        taskID: "tsk_before_admission",
        dispatchID: "dispatch-before-admission",
        childSessionID: "ses_before_admission",
        owner: "runtime-before-admission",
        time: Date.now(),
      }),
    )
    using _admission = DispatchLineageOwnerMigrationTestHooks.replaceAfterAdmission(() => {
      expect(() =>
        insertArtifact(
          peer,
          legacyLineage({
            id: "art_after_admission",
            taskID: "tsk_after_admission",
            dispatchID: "dispatch-after-admission",
            childSessionID: "ses_after_admission",
            owner: "runtime-after-admission",
            time: Date.now(),
          }),
        ),
      ).toThrow()
    })
    expect(migrateDispatchLineageDeliveryOwners(sqlite)).toBe(true)
    expect(payload(sqlite, "art_before_admission").delivery_owner).toEqual({
      kind: "runtime_process",
      process_occurrence_id: "runtime-before-admission",
    })
    expect(sqlite.query("SELECT id FROM engine_artifact WHERE id='art_after_admission'").get()).toBeNull()
  } finally {
    peer.close(true)
    sqlite.close(true)
    rmSync(directory, { recursive: true, force: true })
  }
})

test("rolls back every rewritten lineage and restores the trigger when classification fails", () => {
  const sqlite = database()
  try {
    const now = Date.now()
    insertArtifact(
      sqlite,
      legacyLineage({
        id: "art_rollback_valid",
        taskID: "tsk_rollback",
        dispatchID: "dispatch-rollback-valid",
        childSessionID: "ses_rollback_valid",
        owner: "runtime-rollback",
        time: now,
      }),
    )
    const invalid = legacyLineage({
      id: "art_rollback_invalid",
      taskID: "tsk_rollback",
      dispatchID: "dispatch-rollback-invalid",
      childSessionID: "ses_rollback_invalid",
      time: now + 1,
    })
    invalid.payload.owner_process_occurrence_id = 42 as never
    insertArtifact(sqlite, invalid)

    expect(() => migrateDispatchLineageDeliveryOwners(sqlite)).toThrow(
      "Dispatch lineage art_rollback_invalid has an invalid legacy process owner",
    )
    expect({
      valid: payload(sqlite, "art_rollback_valid"),
      invalid: payload(sqlite, "art_rollback_invalid"),
      trigger: sqlite
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_schema WHERE type='trigger' AND name='engine_dispatch_lineage_immutable'",
        )
        .get()?.name,
    }).toMatchObject({
      valid: { owner_process_occurrence_id: "runtime-rollback" },
      invalid: { owner_process_occurrence_id: 42 },
      trigger: "engine_dispatch_lineage_immutable",
    })
  } finally {
    sqlite.close(true)
  }
})
