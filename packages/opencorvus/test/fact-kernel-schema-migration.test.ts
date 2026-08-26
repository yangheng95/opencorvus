import { Database as SQLite } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { SCHEMA_DDL } from "@/storage/ddl"
import { migrateFactKernelSchema, migratePermissionLedgerProjectRetentionSchema } from "@/storage/fact-kernel-migration"
import { findSchemaDrift } from "@/storage/schema-contract"

function all<T>(sqlite: SQLite, sql: string, ...parameters: unknown[]): T[] {
  const statement = sqlite.query(sql)
  try {
    return statement.all(...parameters as []) as T[]
  } finally {
    statement.finalize()
  }
}

function get<T>(sqlite: SQLite, sql: string, ...parameters: unknown[]): T | null {
  const statement = sqlite.query(sql)
  try {
    return statement.get(...parameters as []) as T | null
  } finally {
    statement.finalize()
  }
}

function installCascadingPermissionLedgerFixture(sqlite: SQLite): void {
  sqlite.exec("PRAGMA legacy_alter_table=ON")
  const definition = get<{ sql: string }>(
    sqlite,
    "SELECT sql FROM sqlite_schema WHERE type='table' AND name='permission_ledger'",
  )?.sql
  if (!definition) throw new Error("Current Permission ledger definition is unavailable")
  const cascading = definition.replace(
    '  CONSTRAINT "permission_ledger_request_owner_shape"',
    '  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,\n  CONSTRAINT "permission_ledger_request_owner_shape"',
  )
  if (cascading === definition) throw new Error("Permission ledger fixture could not add the historical cascade")
  const triggers = all<{ name: string; sql: string }>(
    sqlite,
    "SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name='permission_ledger' AND sql IS NOT NULL",
  )
  const indexes = all<{ name: string; sql: string }>(
    sqlite,
    "SELECT name,sql FROM sqlite_schema WHERE type='index' AND tbl_name='permission_ledger' AND sql IS NOT NULL",
  )
  for (const row of triggers) sqlite.exec(`DROP TRIGGER "${row.name}"`)
  for (const row of indexes) sqlite.exec(`DROP INDEX "${row.name}"`)
  sqlite.exec('ALTER TABLE "permission_ledger" RENAME TO "__permission_ledger_fixture_current"')
  sqlite.exec(cascading)
  const columns = all<{ name: string }>(sqlite, 'PRAGMA table_info("permission_ledger")').map((row) => `"${row.name}"`)
  const projection = columns.join(",")
  sqlite.exec(
    `INSERT INTO "permission_ledger" (${projection}) SELECT ${projection} FROM "__permission_ledger_fixture_current"`,
  )
  sqlite.exec('DROP TABLE "__permission_ledger_fixture_current"')
  for (const row of indexes) sqlite.exec(row.sql)
  for (const row of triggers) sqlite.exec(row.sql)
  sqlite.exec("PRAGMA legacy_alter_table=OFF")
}

function installLegacyControlSchema(sqlite: SQLite): void {
  sqlite.exec(SCHEMA_DDL)
  sqlite.exec(`
    DROP TRIGGER task_root_source_message_no_update;
    DROP TRIGGER task_root_source_message_no_delete;
    DROP TRIGGER task_root_source_part_no_insert;
    DROP TRIGGER task_root_causal_part_no_delete;
    DROP TRIGGER task_root_source_artifact_no_update;
    DROP TRIGGER task_root_source_artifact_no_delete;
    DROP TABLE bus_publication_attempt_receipt;
    DROP TABLE bus_publication_phase_receipt;
    DROP TABLE bus_publication_delivery_receipt;
    DROP TABLE provider_activity_outcome;
    DROP TABLE provider_activity_request;
    DROP TABLE tool_part_outcome;
    DROP TABLE tool_part_progress;
    DROP TABLE tool_part_request;
    DROP TABLE session_control_event;
    DROP TABLE event_job_fire_receipt;
    DROP TABLE automation_run_receipt;
    DROP TABLE protocol_delivery_receipt;
    DROP TABLE engine_interaction_outcome;
    DROP TABLE engine_build_observation_cleanup_receipt;
    DROP TABLE engine_control_activation_lease;
    DROP TABLE engine_task_root_ingress;
    DROP TABLE engine_task_root_ingress_policy;
    ALTER TABLE engine_task ADD COLUMN time_started INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE engine_task ADD COLUMN time_completed INTEGER;
    ALTER TABLE engine_task ADD COLUMN error TEXT;
    ALTER TABLE protocol_inbox ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE protocol_inbox ADD COLUMN last_error TEXT;
    ALTER TABLE protocol_inbox ADD COLUMN delivery_result TEXT;
    ALTER TABLE protocol_inbox ADD COLUMN time_completed INTEGER;
    ALTER TABLE protocol_inbox ADD COLUMN time_updated INTEGER;
    ALTER TABLE bus_publication_outbox ADD COLUMN exact_settled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE bus_publication_outbox ADD COLUMN wildcard_settled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE bus_publication_outbox ADD COLUMN global_settled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE bus_publication_outbox ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE bus_publication_outbox ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE bus_publication_outbox ADD COLUMN last_error TEXT;
    ALTER TABLE bus_publication_delivery ADD COLUMN durable INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE bus_publication_delivery ADD COLUMN settled INTEGER NOT NULL DEFAULT 0;
  `)
}

function insertLegacyArtifact(sqlite: SQLite, input: {
  id: string
  taskID: string
  kind: string
  payload: unknown
  timeCreated: number
}) {
  const revision = Number(sqlite.query("INSERT INTO engine_artifact_catalog_revision DEFAULT VALUES").run().lastInsertRowid)
  const payload = JSON.stringify(input.payload)
  const digest = "0".repeat(64)
  sqlite.query(`
    INSERT INTO engine_artifact
      (id,task_id,kind,label,payload,payload_sha256,payload_bytes,payload_block_sha256s,payload_block_index_sha256,
       catalog_metadata_sha256,catalog_revision,time_created,time_updated)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    input.id, input.taskID, input.kind, "accepted", payload, digest, Buffer.byteLength(payload), JSON.stringify([digest]), digest,
    digest, revision, input.timeCreated, input.timeCreated,
  )
}

describe("fact-kernel schema migration", () => {
  test("removes the Permission Project cascade while preserving the complete ledger chain", () => {
    const sqlite = new SQLite(":memory:")
    try {
      sqlite.exec(SCHEMA_DDL)
      installCascadingPermissionLedgerFixture(sqlite)
      sqlite.exec(`
        INSERT INTO project (id,worktree,name,icon_url,icon_color,time_created,time_updated,time_pinned,time_initialized,sandboxes,commands,generation)
        VALUES ('project:permission-retention','D:/permission-retention','permission-retention',NULL,NULL,1,1,NULL,NULL,'[]',NULL,'6d68d8c3-d9d2-40fb-bef1-a41d6fd58e7e');
        INSERT INTO permission_ledger(
          id,request_id,project_id,session_id,task_id,message_id,tool_call_id,event_type,mode,policy_revision,
          provider_kind,provider_id,provider_digest,tool_name,effect_class,scope_version,scope,fingerprint,summary,
          metadata,time_created
        ) VALUES (
          'permission:retained:request','permission:retained','project:permission-retention','session:retained',NULL,
          'message:retained','call:retained','requested','full_access','policy:retained','builtin','builtin',
          'digest:retained','read','filesystem_read','2','{"resource":{"path":"README.md"}}','fingerprint:retained',
          'Read retained evidence','{"choices":["allow_once"]}',2
        );
        INSERT INTO permission_ledger(id,request_id,event_type,decision_scope,decision_slot,actor_id,time_created)
        VALUES ('permission:retained:decision','permission:retained','allowed_once','invocation','permission:retained','policy',3);
        INSERT INTO permission_ledger(id,request_id,event_type,attempt_id,source_event_id,time_created)
        VALUES ('permission:retained:start','permission:retained','execution_started','permission:retained:attempt','permission:retained:decision',4);
        INSERT INTO permission_ledger(id,request_id,event_type,attempt_id,outcome_slot,time_created)
        VALUES ('permission:retained:success','permission:retained','execution_succeeded','permission:retained:attempt','permission:retained:attempt',5);
        INSERT INTO permission_ledger(id,request_id,event_type,source_event_id,reason,time_created)
        VALUES ('permission:retained:stale','permission:retained','stale','permission:retained:success','settled',6);
        UPDATE permission_ledger SET rowid=CASE id
          WHEN 'permission:retained:request' THEN 10
          WHEN 'permission:retained:decision' THEN 30
          WHEN 'permission:retained:start' THEN 50
          WHEN 'permission:retained:success' THEN 70
          WHEN 'permission:retained:stale' THEN 90
        END WHERE request_id='permission:retained';
      `)
      const before = all<Record<string, unknown>>(
        sqlite,
        "SELECT rowid,* FROM permission_ledger WHERE request_id='permission:retained' ORDER BY rowid",
      )

      expect(migratePermissionLedgerProjectRetentionSchema(sqlite)).toBe(true)
      expect({
        rows: all<Record<string, unknown>>(
          sqlite,
          "SELECT rowid,* FROM permission_ledger WHERE request_id='permission:retained' ORDER BY rowid",
        ),
        foreignKeys: all(sqlite, 'PRAGMA foreign_key_list("permission_ledger")'),
        legacyAlterTable: get<{ legacy_alter_table: number }>(sqlite, "PRAGMA legacy_alter_table"),
        drift: findSchemaDrift(sqlite),
      }).toEqual({ rows: before, foreignKeys: [], legacyAlterTable: { legacy_alter_table: 0 }, drift: undefined })

      sqlite.exec("DELETE FROM project WHERE id='project:permission-retention'")
      expect(all<{ id: string; event_type: string }>(
        sqlite,
        "SELECT id,event_type FROM permission_ledger WHERE request_id='permission:retained' ORDER BY time_created,id",
      )).toEqual([
        { id: "permission:retained:request", event_type: "requested" },
        { id: "permission:retained:decision", event_type: "allowed_once" },
        { id: "permission:retained:start", event_type: "execution_started" },
        { id: "permission:retained:success", event_type: "execution_succeeded" },
        { id: "permission:retained:stale", event_type: "stale" },
      ])
    } finally {
      sqlite.close(true)
    }
  })

  test("a second database opener settles an admitted historical shape against the first opener's migration", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "opencorvus-permission-migration-race-"))
    const databasePath = path.join(directory, "opencorvus.db")
    const first = new SQLite(databasePath, { create: true })
    let second: SQLite | undefined
    try {
      first.exec(SCHEMA_DDL)
      installCascadingPermissionLedgerFixture(first)
      first.exec(`
        INSERT INTO project (id,worktree,name,icon_url,icon_color,time_created,time_updated,time_pinned,time_initialized,sandboxes,commands,generation)
        VALUES ('project:permission-race','D:/permission-race','permission-race',NULL,NULL,1,1,NULL,NULL,'[]',NULL,'f5897d90-470c-4a9a-87c0-8f7f77807aa0');
        INSERT INTO permission_ledger(
          rowid,id,request_id,project_id,session_id,message_id,tool_call_id,event_type,mode,policy_revision,
          provider_kind,provider_id,provider_digest,tool_name,effect_class,scope_version,scope,fingerprint,summary,time_created
        ) VALUES (
          40,'permission:race:request','permission:race','project:permission-race','session:race','message:race',
          'call:race','requested','ask','policy:race','builtin','builtin','digest:race','webfetch','network_read','2',
          '{"resource":{"url":"https://example.test"}}','fingerprint:race','Race-safe request',2
        );
      `)
      second = new SQLite(databasePath)
      second.run("PRAGMA busy_timeout=5000")
      const settled = migratePermissionLedgerProjectRetentionSchema(first, {
        beforeWriteLockForTest: () => expect(migratePermissionLedgerProjectRetentionSchema(second!)).toBe(true),
      })
      expect({
        settled,
        row: get<{ rowid: number; id: string }>(first, "SELECT rowid,id FROM permission_ledger"),
        foreignKeys: all(first, 'PRAGMA foreign_key_list("permission_ledger")'),
        drift: findSchemaDrift(first),
      }).toEqual({
        settled: false,
        row: { rowid: 40, id: "permission:race:request" },
        foreignKeys: [],
        drift: undefined,
      })
    } finally {
      second?.close(true)
      first.close(true)
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("upgrades the Provider activity index for multiple streamed steps in one assistant Turn", () => {
    const sqlite = new SQLite(":memory:")
    try {
      sqlite.exec(SCHEMA_DDL)
      sqlite.exec(`
        DROP INDEX provider_activity_request_message_idx;
        CREATE UNIQUE INDEX provider_activity_request_message_idx
          ON provider_activity_request (assistant_message_id);
        INSERT INTO project
          (id,worktree,name,icon_url,icon_color,time_created,time_updated,time_pinned,time_initialized,sandboxes,commands,generation)
        VALUES ('project:provider-steps','D:/provider-steps','provider steps',NULL,NULL,1,1,NULL,NULL,'[]',NULL,'generation:provider-steps');
        INSERT INTO session
          (id,project_id,parent_id,slug,directory,title,version,kind,time_created,time_updated)
        VALUES ('session:provider-steps','project:provider-steps',NULL,'provider-steps','D:/provider-steps','provider steps','1','assistant',2,2);
        INSERT INTO message(id,session_id,time_created,time_updated,data)
        VALUES ('message:provider-steps','session:provider-steps',3,3,'{"role":"assistant","author":"assistant","time":{"created":3}}');
      `)

      expect(migrateFactKernelSchema(sqlite)).toBe(true)
      sqlite.exec(`
        INSERT INTO provider_activity_request(id,assistant_message_id,time_created)
        VALUES ('activity:step-1','message:provider-steps',4),
               ('activity:step-2','message:provider-steps',5);
      `)
      expect({
        drift: findSchemaDrift(sqlite),
        activities: all<{ id: string; assistant_message_id: string; time_created: number }>(sqlite, `
          SELECT id,assistant_message_id,time_created
          FROM provider_activity_request ORDER BY time_created,id
        `),
      }).toEqual({
        drift: undefined,
        activities: [
          { id: "activity:step-1", assistant_message_id: "message:provider-steps", time_created: 4 },
          { id: "activity:step-2", assistant_message_id: "message:provider-steps", time_created: 5 },
        ],
      })
    } finally {
      sqlite.close(true)
    }
  })

  test("atomically replaces the mutable control schema with the canonical fact schema", () => {
    const sqlite = new SQLite(":memory:")
    try {
      installLegacyControlSchema(sqlite)
      sqlite.exec(`
        INSERT INTO project (id,worktree,name,icon_url,icon_color,time_created,time_updated,time_pinned,time_initialized,sandboxes,commands,generation)
        VALUES ('project:migration','D:/migration','migration',NULL,NULL,10,10,NULL,NULL,'[]',NULL,'generation:migration');
        INSERT INTO bus_publication_outbox
          (occurrence_id,project_id,directory,event_type,properties,causation,time_created,exact_settled,wildcard_settled,global_settled,attempt_count,next_attempt_at,last_error)
        VALUES ('bus:migration','project:migration','D:/migration','migration.event','{"business":{"terminalEventID":"customer-value","terminalStatus":"keep-me"}}',NULL,20,1,0,1,2,500,'retryable');
        INSERT INTO bus_publication_delivery
          (occurrence_id,phase,subscriber_id,durable,effect_contract,time_created,settled)
        VALUES ('bus:migration','exact','subscriber:migration',1,'idempotent_by_occurrence',21,1);
        INSERT INTO engine_task
          (id,project_id,source,product_pillar,title,request,attachments,system_artifacts,priority,budget,metadata,time_archived,time_pinned,time_created,time_started,time_completed,error)
        VALUES
          ('task:migration','project:migration','api','code','migration task','migrate facts',NULL,'[]','normal',NULL,NULL,NULL,NULL,30,30,40,NULL);
        INSERT INTO session
          (id,project_id,parent_id,slug,directory,title,version,kind,time_created,time_updated)
        VALUES ('session:migration','project:migration',NULL,'migration','D:/migration','migration','1','root',25,25);
        INSERT INTO message(id,session_id,time_created,time_updated,data)
        VALUES ('message:completed-host','session:migration',26,27,'{"role":"assistant","time":{"created":26,"completed":27},"finish":"stop"}');
        INSERT INTO protocol_event
          (id,kind,type,aggregate_type,aggregate_id,source,seq,emitted_at,payload)
        VALUES
          ('protocol:event:delivery','event','scheduler.message','session','session:migration','migration-test',1,31,'{}');
        INSERT INTO protocol_event
          (id,kind,type,aggregate_type,aggregate_id,session_id,source,seq,emitted_at,payload)
        VALUES
          ('protocol:event:lifecycle','event','agent.execution.lifecycle','task','task:migration','session:migration','migration-test',1,33,'{"inputMessageID":"message:completed-host","status":"completed"}');
        INSERT INTO protocol_inbox
          (id,envelope_id,actor,actor_id,visible_at,time_created,status,last_error,delivery_result,time_completed,time_updated)
        VALUES
          ('protocol:inbox:migration','protocol:event:delivery','session','session:migration',31,31,'delivered',NULL,'{"kind":"session_wake","message_id":"message:migration"}',32,32);
      `)

      expect(migrateFactKernelSchema(sqlite)).toBe(true)
      expect(findSchemaDrift(sqlite)).toBeUndefined()
      expect(all(sqlite, "SELECT phase FROM bus_publication_phase_receipt WHERE occurrence_id=? ORDER BY phase", "bus:migration"))
        .toEqual([{ phase: "exact" }, { phase: "global" }])
      expect(get(sqlite, "SELECT error,retry_at FROM bus_publication_attempt_receipt WHERE occurrence_id=?", "bus:migration"))
        .toEqual({ error: "retryable", retry_at: 500 })
      expect(get(sqlite, "SELECT outcome FROM bus_publication_delivery_receipt WHERE occurrence_id=? AND subscriber_id=?", "bus:migration", "subscriber:migration"))
        .toEqual({ outcome: "succeeded" })
      expect(get(sqlite, "SELECT properties FROM bus_publication_outbox WHERE occurrence_id=?", "bus:migration"))
        .toEqual({ properties: '{"business":{"terminalEventID":"customer-value","terminalStatus":"keep-me"}}' })
      expect(get(sqlite, "SELECT json_extract(payload,'$.status') AS status FROM protocol_event WHERE id=?", "protocol:event:lifecycle"))
        .toEqual({ status: "completed" })
      expect(all(sqlite, "SELECT id FROM provider_activity_request")).toEqual([])
      expect(all(sqlite, "SELECT id FROM provider_activity_outcome")).toEqual([])
      expect(all(sqlite, "SELECT type,aggregate_id,task_id FROM protocol_event WHERE aggregate_type='task' ORDER BY seq"))
        .toEqual([
          { type: "task.execution.opened", aggregate_id: "task:migration", task_id: null },
          { type: "agent.execution.lifecycle", aggregate_id: "task:migration", task_id: null },
          { type: "task.completed", aggregate_id: "task:migration", task_id: null },
        ])
      expect(get(sqlite, "SELECT receipt FROM protocol_delivery_receipt WHERE inbox_id=?", "protocol:inbox:migration"))
        .toEqual({ receipt: '{"kind":"session_wake","message_id":"message:migration"}' })
      expect(migrateFactKernelSchema(sqlite)).toBe(false)
    } finally {
      sqlite.close(true)
    }
  })

  test("rolls the whole cutover back when a legacy fact cannot be classified", () => {
    const sqlite = new SQLite(":memory:")
    try {
      installLegacyControlSchema(sqlite)
      sqlite.exec(`
        INSERT INTO protocol_event
          (id,kind,type,aggregate_type,aggregate_id,source,seq,emitted_at,payload)
        VALUES
          ('protocol:event:invalid-mission','event','mission.execution.closure','mission','mission:invalid','migration-test',1,1,'{"state":"ambiguous","missionID":"mission:invalid","requestID":"request:invalid"}');
      `)

      expect(() => migrateFactKernelSchema(sqlite)).toThrow(
        "Mission closure event protocol:event:invalid-mission has invalid legacy state",
      )
      expect(get(sqlite, "SELECT type,payload FROM protocol_event WHERE id=?", "protocol:event:invalid-mission"))
        .toEqual({
          type: "mission.execution.closure",
          payload: '{"state":"ambiguous","missionID":"mission:invalid","requestID":"request:invalid"}',
        })
      expect(all<{ name: string }>(sqlite, "PRAGMA table_info(protocol_inbox)").map((column) => column.name))
        .toContain("status")
    } finally {
      sqlite.close(true)
    }
  })

  test("assigns legacy lifecycle receipts to the unique historical epoch and preserves causal order", () => {
    const sqlite = new SQLite(":memory:")
    try {
      installLegacyControlSchema(sqlite)
      sqlite.exec(`
        INSERT INTO project (id,worktree,name,icon_url,icon_color,time_created,time_updated,time_pinned,time_initialized,sandboxes,commands,generation)
        VALUES ('project:epochs','D:/epochs','epochs',NULL,NULL,1,1,NULL,NULL,'[]',NULL,'generation:epochs');
        INSERT INTO engine_task
          (id,project_id,source,product_pillar,title,request,attachments,system_artifacts,priority,budget,metadata,time_archived,time_pinned,time_created,time_started,time_completed,error)
        VALUES ('task:epochs','project:epochs','api','code','epochs','migrate epochs',NULL,'[]','normal',NULL,NULL,NULL,NULL,90,200,NULL,NULL);
        INSERT INTO protocol_event(id,kind,type,aggregate_type,aggregate_id,source,seq,emitted_at,payload) VALUES
          ('epoch:open:1','event','task.execution.opened','task','task:epochs','legacy',1,100,'{"execution_epoch":1}'),
          ('epoch:terminal:1','event','task.completed','task','task:epochs','legacy',2,150,'{"summary":"first"}'),
          ('epoch:open:2','event','task.execution.reopened','task','task:epochs','legacy',3,200,'{"execution_epoch":2}'),
          ('epoch:terminal:2','event','task.failed','task','task:epochs','legacy',4,250,'{"summary":"second","error":"boom"}');
      `)
      expect(migrateFactKernelSchema(sqlite)).toBe(true)
      expect(all(sqlite, `
        SELECT type,json_extract(payload,'$.execution_epoch') AS epoch
        FROM protocol_event WHERE aggregate_type='task' AND aggregate_id='task:epochs' ORDER BY seq
      `)).toEqual([
        { type: "task.execution.opened", epoch: 1 },
        { type: "task.completed", epoch: 1 },
        { type: "task.execution.reopened", epoch: 2 },
        { type: "task.failed", epoch: 2 },
      ])
    } finally {
      sqlite.close(true)
    }
  })

  test("maps every legacy Task-root ingress family to its sole durable source and removes retired ingress Artifacts", () => {
    const sqlite = new SQLite(":memory:")
    try {
      installLegacyControlSchema(sqlite)
      sqlite.exec(`
        INSERT INTO project (id,worktree,name,icon_url,icon_color,time_created,time_updated,time_pinned,time_initialized,sandboxes,commands,generation)
        VALUES ('project:sources','D:/sources','sources',NULL,NULL,1,1,NULL,NULL,'[]',NULL,'generation:sources');
        INSERT INTO session (id,project_id,parent_id,slug,directory,title,version,kind,time_created,time_updated)
        VALUES ('session:sources','project:sources',NULL,'sources','D:/sources','sources','1','root',90,90);
        INSERT INTO engine_task
          (id,project_id,session_id,source,product_pillar,title,request,attachments,system_artifacts,priority,budget,metadata,time_archived,time_pinned,time_created,time_started,time_completed,error)
        VALUES ('task:sources','project:sources','session:sources','api','code','sources','migrate ingress sources',NULL,'[]','normal',NULL,NULL,NULL,NULL,90,100,NULL,NULL);
        INSERT INTO message (id,session_id,time_created,time_updated,data)
        VALUES ('message:source','session:sources',101,101,'{"role":"user","time":{"created":101}}');
        INSERT INTO protocol_event (id,kind,type,aggregate_type,aggregate_id,session_id,source,seq,emitted_at,payload)
        VALUES ('protocol:source','event','agent.execution.lifecycle','task','task:sources','session:sources','legacy',1,102,'{"inputMessageID":"message:source","status":"completed"}');
        INSERT INTO automation
          (id,definition_id,revision,project_id,session_id,task_id,name,kind,scope,execution_mode,prompt,agent,status,due_at,time_created)
        VALUES ('automation:source','automation:source',1,'project:sources','session:sources','task:sources','wait','delay','session','local','wait','default','active',150,103);
        INSERT INTO automation_run (id,automation_revision_id,fire_id,target_project_id,started_at)
        VALUES ('run:source','automation:source','fire:source',NULL,104);
      `)

      const sourceArtifacts = [
        ["artifact:coordination", "agent_coordination_request", { request_id: "artifact:coordination" }],
        ["artifact:recovery", "task-infrastructure-error", { recovery_fact_id: "artifact:recovery" }],
        ["artifact:dispatch", "task-infrastructure-error", { operation: "dispatch", reason: "failed" }],
      ] as const
      sourceArtifacts.forEach(([id, kind, payload], index) => insertLegacyArtifact(sqlite, {
        id, taskID: "task:sources", kind, payload, timeCreated: 105 + index,
      }))

      const dispatchOutcome = {
        kind: "infrastructure_failure",
        operation: "dispatch",
        message: "failed",
        recovery_authority: { occurrence_status: "occurrence_not_committed" },
        infrastructure_error: {
          source: "engine_artifact",
          artifact_id: "artifact:dispatch",
          catalog_revision: 3,
          expected_sha256: "0".repeat(64),
        },
      }
      const ingresses = [
        ["ingress:message", "operator_message", { rootMessage: { messageID: "message:source", kind: "operator" } }, { message_id: "message:source" }],
        ["ingress:lifecycle", "agent_lifecycle_delivery", { agentLifecycleDelivery: { eventID: "protocol:source", sessionID: "session:sources", dispatchID: "dispatch:source" } }, { lifecycle_event_id: "protocol:source" }],
        ["ingress:task", "task_creation", { taskCreation: { taskID: "task:sources" } }, { task_creation_id: "task:sources" }],
        ["ingress:coordination", "coordination_request", { coordinationRequest: { requestID: "artifact:coordination" } }, { request_id: "artifact:coordination" }],
        ["ingress:recovery", "infrastructure_recovery", { processRecovery: { recoveryFactID: "artifact:recovery" } }, { recovery_fact_id: "artifact:recovery" }],
        ["ingress:dispatch", "dispatch_infrastructure_failure", { dispatchInfrastructureFailure: { infrastructureFactID: "artifact:dispatch", outcome: dispatchOutcome } }, { infrastructure_fact_id: "artifact:dispatch" }],
        ["ingress:wait", "task_wait_wake", { taskWaitWake: { jobID: "automation:source", fireID: "fire:source", dueAt: 150 } }, { wait_job_id: "automation:source" }],
        ["ingress:activity", "task_wait_activity", { taskWaitActivity: { source: "operator", detail: "wait", jobIDs: [] } }, {}],
        ["ingress:event", "orchestrator_event", { note: "exact inline event" }, {}],
      ] as const
      ingresses.forEach(([id, sourceKind, event, extra], index) => insertLegacyArtifact(sqlite, {
        id,
        taskID: "task:sources",
        kind: "task_root_ingress",
        payload: {
          task_occurrence_started_at: 100,
          time_accepted: 120 + index,
          source_kind: sourceKind,
          event,
          ...extra,
        },
        timeCreated: 120 + index,
      }))

      expect(migrateFactKernelSchema(sqlite)).toBe(true)
      expect(all(sqlite, `
        SELECT id,source,source_id,inline_payload IS NOT NULL AS owns_inline
        FROM engine_task_root_ingress WHERE task_id='task:sources' ORDER BY sequence
      `)).toEqual([
        { id: "ingress:message", source: "message", source_id: "message:source", owns_inline: 0 },
        { id: "ingress:lifecycle", source: "protocol_event", source_id: "protocol:source", owns_inline: 0 },
        { id: "ingress:task", source: "task", source_id: "task:sources", owns_inline: 0 },
        { id: "ingress:coordination", source: "engine_artifact", source_id: "artifact:coordination", owns_inline: 0 },
        { id: "ingress:recovery", source: "engine_artifact", source_id: "artifact:recovery", owns_inline: 0 },
        { id: "ingress:dispatch", source: "engine_artifact", source_id: "artifact:dispatch", owns_inline: 0 },
        { id: "ingress:wait", source: "automation_run", source_id: "run:source", owns_inline: 0 },
        { id: "ingress:activity", source: "inline", source_id: "ingress:activity", owns_inline: 1 },
        { id: "ingress:event", source: "inline", source_id: "ingress:event", owns_inline: 1 },
      ])
      expect(get(sqlite, "SELECT count(*) AS count FROM engine_artifact WHERE kind='task_root_ingress'"))
        .toEqual({ count: 0 })
    } finally {
      sqlite.close(true)
    }
  })

  test("fills a partially recorded lifecycle per exact epoch and terminals only the current occurrence", () => {
    const sqlite = new SQLite(":memory:")
    try {
      installLegacyControlSchema(sqlite)
      sqlite.exec(`
        INSERT INTO project (id,worktree,name,icon_url,icon_color,time_created,time_updated,time_pinned,time_initialized,sandboxes,commands,generation)
        VALUES ('project:partial','D:/partial','partial',NULL,NULL,1,1,NULL,NULL,'[]',NULL,'generation:partial');
        INSERT INTO engine_task
          (id,project_id,source,product_pillar,title,request,attachments,system_artifacts,priority,budget,metadata,time_archived,time_pinned,time_created,time_started,time_completed,error)
        VALUES ('task:partial','project:partial','api','code','partial','partial lifecycle',NULL,'[]','normal',NULL,NULL,NULL,NULL,90,200,250,'current failed');
        INSERT INTO protocol_event (id,kind,type,aggregate_type,aggregate_id,source,seq,emitted_at,payload) VALUES
          ('partial:open:1','event','task.execution.opened','task','task:partial','legacy',1,100,'{"execution_epoch":1}'),
          ('partial:terminal:1','event','task.completed','task','task:partial','legacy',2,150,'{"execution_epoch":1,"summary":"first"}');
      `)
      insertLegacyArtifact(sqlite, {
        id: "partial:ingress:2",
        taskID: "task:partial",
        kind: "task_root_ingress",
        payload: {
          task_occurrence_started_at: 200,
          time_accepted: 210,
          source_kind: "orchestrator_event",
          event: { note: "second occurrence" },
        },
        timeCreated: 210,
      })

      expect(migrateFactKernelSchema(sqlite)).toBe(true)
      expect(all(sqlite, `
        SELECT type,json_extract(payload,'$.execution_epoch') AS epoch
        FROM protocol_event WHERE aggregate_type='task' AND aggregate_id='task:partial' ORDER BY seq
      `)).toEqual([
        { type: "task.execution.opened", epoch: 1 },
        { type: "task.completed", epoch: 1 },
        { type: "task.execution.reopened", epoch: 2 },
        { type: "task.failed", epoch: 2 },
      ])
      expect(get(sqlite, "SELECT execution_epoch FROM engine_task_root_ingress WHERE id='partial:ingress:2'"))
        .toEqual({ execution_epoch: 2 })
    } finally {
      sqlite.close(true)
    }
  })

  test("normalizes legacy Channel, Git, and Permission authorities without retaining request mirrors", () => {
    const sqlite = new SQLite(":memory:")
    try {
      installLegacyControlSchema(sqlite)
      sqlite.exec(`
        DROP TABLE permission_execution_result;
        DROP TABLE permission_ledger;
        CREATE TABLE permission_ledger (
          id TEXT PRIMARY KEY, request_id TEXT NOT NULL, project_id TEXT, session_id TEXT, task_id TEXT,
          message_id TEXT, tool_call_id TEXT, attempt_id TEXT, event_type TEXT NOT NULL, mode TEXT,
          policy_revision TEXT, provider_kind TEXT, provider_id TEXT, provider_digest TEXT, tool_name TEXT,
          effect_class TEXT, scope_version TEXT, scope TEXT, fingerprint TEXT, summary TEXT, decision_scope TEXT,
          source_event_id TEXT, decision_slot TEXT, outcome_slot TEXT, actor_id TEXT, reason TEXT, metadata TEXT,
          time_created INTEGER NOT NULL
        );
        CREATE TABLE channel_ingress_receipt (
          project_id TEXT NOT NULL, platform TEXT NOT NULL, request_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL, result TEXT NOT NULL, time_created INTEGER NOT NULL
        );
        INSERT INTO project (id,worktree,name,icon_url,icon_color,time_created,time_updated,time_pinned,time_initialized,sandboxes,commands,generation)
        VALUES ('project:effects','D:/effects','effects',NULL,NULL,1,1,NULL,NULL,'[]',NULL,'generation:effects');
        INSERT INTO engine_task
          (id,project_id,source,product_pillar,title,request,attachments,system_artifacts,priority,budget,metadata,time_archived,time_pinned,time_created,time_started,time_completed,error)
        VALUES (
          'task:effects','project:effects','api','code','effects','migrate effects',NULL,'[]','normal',NULL,
          NULL,
          NULL,NULL,10,10,12,NULL
        );
        INSERT INTO channel_ingress_receipt(project_id,platform,request_id,fingerprint,result,time_created)
        VALUES ('project:effects','slack','channel:req','{"platform":"slack","request_id":"channel:req","message":{"text":"hello"}}','{"type":"pong"}',20);
        INSERT INTO permission_ledger(
          id,request_id,project_id,session_id,task_id,message_id,tool_call_id,event_type,mode,policy_revision,
          provider_kind,provider_id,provider_digest,tool_name,effect_class,scope_version,scope,fingerprint,summary,
          decision_scope,decision_slot,actor_id,time_created
        ) VALUES (
          'permission:legacy:allowed','permission:req','project:effects','session:effects','task:effects','message:effects','call:effects',
          'full_access','full_access','policy:v1','builtin','builtin','digest','read','filesystem_read','v1','{"path":"README.md"}',
          'fingerprint','Read README','request','decision:slot','operator',30
        );
      `)
      sqlite.exec(`
        PRAGMA ignore_check_constraints=ON;
        UPDATE engine_task SET metadata='{"git":{"baseline":{"commit":"base","time":11},"result":{"commit":"result","time":12}}}'
        WHERE id='task:effects';
        PRAGMA ignore_check_constraints=OFF;
      `)

      expect(all(sqlite, "SELECT id FROM engine_task WHERE id='task:effects'")).toEqual([{ id: "task:effects" }])
      expect(migrateFactKernelSchema(sqlite)).toBe(true)
      expect(get(sqlite, "SELECT input FROM channel_ingress_accepted WHERE platform='slack' AND request_id='channel:req'"))
        .toEqual({ input: '{"message":{"text":"hello"}}' })
      expect(get(sqlite, "SELECT result FROM channel_ingress_outcome"))
        .toEqual({ result: '{"type":"pong"}' })
      expect(all(sqlite, "SELECT id,metadata FROM engine_task WHERE id='task:effects'"))
        .toEqual([{ id: "task:effects", metadata: "{}" }])
      expect(all(sqlite, `
        SELECT stage,operation_key,json_extract(result,'$.commit') AS commit_value
        FROM engine_git_checkpoint_request
        JOIN engine_git_checkpoint_outcome ON engine_git_checkpoint_outcome.request_id=engine_git_checkpoint_request.id
        WHERE task_id='task:effects' ORDER BY stage
      `)).toEqual([
        { stage: "baseline", operation_key: "baseline:1", commit_value: "base" },
        { stage: "result", operation_key: "result:1", commit_value: "result" },
      ])
      expect(all(sqlite, `
        SELECT event_type,project_id,session_id,message_id,tool_call_id,mode,tool_name
        FROM permission_ledger WHERE request_id='permission:req' ORDER BY event_type
      `)).toEqual([
        { event_type: "allowed_once", project_id: null, session_id: null, message_id: null, tool_call_id: null, mode: null, tool_name: null },
        { event_type: "requested", project_id: "project:effects", session_id: "session:effects", message_id: "message:effects", tool_call_id: "call:effects", mode: "full_access", tool_name: "read" },
      ])
    } finally {
      sqlite.close(true)
    }
  })
})
