import { describe, expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import { createHash } from "node:crypto"
import { SCHEMA_DDL } from "../src/storage/ddl"
import {
  migrateSchedulingOccurrences,
  SchedulingOccurrenceMigrationError,
} from "../src/storage/scheduling-occurrence-migration"
import { taskWaitFireID } from "../src/scheduler/task-wait-fire-identity"

function tableSchemaObjects(db: SQLite, table: string) {
  const statement = db.query<{ type: string; name: string; sql: string | null }, [string, string]>(`
    SELECT type,name,sql FROM sqlite_schema
    WHERE (type='table' AND name=?) OR (tbl_name=? AND type IN ('index','trigger') AND sql IS NOT NULL)
    ORDER BY type,name
  `)
  try {
    return statement.all(table, table).map((item) => ({
      ...item,
      sql: item.sql?.replace(/\s+/g, " ").trim() ?? null,
    }))
  } finally {
    statement.finalize()
  }
}

function row<T>(db: SQLite, sql: string): T | null {
  const statement = db.query<T, []>(sql)
  try {
    return statement.get()
  } finally {
    statement.finalize()
  }
}

function legacyAutomationID(prefix: "cal" | "arc", ...parts: string[]): string {
  const digest = createHash("sha256").update(parts.join("\u0000")).digest("hex")
  return `${prefix}_automation_${digest.slice(0, 32)}`
}

function legacyDatabase(): SQLite {
  const db = new SQLite(":memory:")
  db.exec(SCHEMA_DDL)
  db.exec(`
    PRAGMA foreign_keys=OFF;
    DROP TABLE automation_fire_attempt_receipt;
    DROP TABLE automation_fire_attempt;
    DROP TABLE automation_delay_settlement;
    DROP TABLE automation_run_receipt;
    DROP TABLE automation_run;
    DROP TABLE automation_fire;
    DROP TABLE engine_task_wait_settlement;
    DROP TABLE engine_task_wait_registration;
    DROP TABLE automation_definition_tombstone;
    DROP TABLE automation;
    DROP TABLE event_job_definition_tombstone;
    DROP TABLE event_job;
    CREATE TABLE automation (
      id text PRIMARY KEY, definition_id text NOT NULL, revision integer NOT NULL,
      project_id text, session_id text, task_id text, name text NOT NULL,
      kind text NOT NULL, scope text, recurrence text, execution_mode text NOT NULL DEFAULT 'local',
      model_provider_id text, model_id text, reasoning_effort text, surface text,
      prompt text NOT NULL, agent text NOT NULL DEFAULT 'default', status text NOT NULL DEFAULT 'active',
      due_at integer, time_created integer NOT NULL
    );
    CREATE TABLE automation_definition_tombstone (
      id text PRIMARY KEY, definition_id text NOT NULL, revision integer NOT NULL, time_created integer NOT NULL
    );
    CREATE TABLE automation_run (
      id text PRIMARY KEY, automation_revision_id text NOT NULL, fire_id text NOT NULL,
      target_project_id text, mission_opened_event_id text, mission_disposition text,
      mission_closure_event_id text, started_at integer NOT NULL
    );
    CREATE TABLE automation_run_receipt (
      id text PRIMARY KEY, run_id text NOT NULL, outcome text NOT NULL, disposition text,
      closure_event_id text, retry_at integer, error text, time_created integer NOT NULL
    );
    CREATE TABLE event_job (
      id text PRIMARY KEY, definition_id text NOT NULL, revision integer NOT NULL,
      project_id text NOT NULL, session_id text, name text NOT NULL, event_type text NOT NULL,
      match_json text, prompt text NOT NULL, agent text NOT NULL DEFAULT 'default',
      enabled integer NOT NULL DEFAULT 1, one_shot integer NOT NULL DEFAULT 0,
      cooldown_ms integer NOT NULL DEFAULT 0, time_created integer NOT NULL
    );
    CREATE TABLE event_job_definition_tombstone (
      id text PRIMARY KEY, definition_id text NOT NULL, revision integer NOT NULL, time_created integer NOT NULL
    );
  `)
  return db
}

function installFormerCurrentTaskWaitTables(db: SQLite): void {
  db.exec(`
    PRAGMA foreign_keys=OFF;
    DROP TABLE engine_task_wait_settlement;
    DROP TABLE engine_task_wait_registration;
    CREATE TABLE engine_task_wait_registration (
      id text PRIMARY KEY,
      task_id text NOT NULL REFERENCES engine_task(id) ON DELETE CASCADE,
      execution_epoch integer NOT NULL,
      due_at integer NOT NULL,
      reason text NOT NULL,
      tool_part_id text,
      creator_ingress_id text REFERENCES engine_task_root_ingress(id) ON DELETE RESTRICT,
      creator_activation_id text,
      legacy_automation_definition_id text,
      input_digest text NOT NULL,
      time_created integer NOT NULL
    );
    CREATE TABLE engine_task_wait_settlement (
      wait_id text PRIMARY KEY REFERENCES engine_task_wait_registration(id) ON DELETE CASCADE,
      ingress_id text NOT NULL REFERENCES engine_task_root_ingress(id) ON DELETE RESTRICT,
      disposition text NOT NULL,
      time_created integer NOT NULL
    );
    CREATE TRIGGER engine_task_wait_settlement_no_delete
    BEFORE DELETE ON engine_task_wait_settlement FOR EACH ROW
    BEGIN SELECT RAISE(ABORT, 'engine_task_wait_settlement: immutable settlement'); END;
    PRAGMA foreign_keys=ON;
  `)
}

function installFormerCurrentAutomationFireTable(db: SQLite): void {
  db.exec(`
    PRAGMA foreign_keys=OFF;
    DROP TABLE automation_fire;
    CREATE TABLE automation_fire (
      id text PRIMARY KEY,
      automation_revision_id text NOT NULL REFERENCES automation(id) ON DELETE RESTRICT,
      scheduled_due_at integer NOT NULL,
      origin text NOT NULL,
      tool_part_id text,
      input_digest text,
      time_created integer NOT NULL,
      CONSTRAINT automation_fire_origin_shape CHECK (
        (origin='scheduled' AND tool_part_id IS NULL AND input_digest IS NULL)
        OR (origin='manual_api' AND tool_part_id IS NULL AND input_digest IS NULL)
        OR (origin='manual_tool' AND tool_part_id IS NOT NULL AND input_digest IS NOT NULL)
      )
    );
    CREATE UNIQUE INDEX automation_fire_scheduled_occurrence_idx
      ON automation_fire(automation_revision_id,scheduled_due_at) WHERE origin='scheduled';
    CREATE UNIQUE INDEX automation_fire_tool_occurrence_idx
      ON automation_fire(tool_part_id) WHERE tool_part_id IS NOT NULL;
    CREATE INDEX automation_fire_due_idx ON automation_fire(scheduled_due_at);
    PRAGMA foreign_keys=ON;
  `)
}

describe("scheduling occurrence migration", () => {
  test("migrates active Task delays and existing Automation runs into their single current occurrence facts", () => {
    const db = legacyDatabase()
    const reference = new SQLite(":memory:")
    reference.exec(SCHEMA_DDL)
    try {
      db.exec(`
        INSERT INTO project (id,worktree,time_created,time_updated,sandboxes,generation)
        VALUES ('prj_migration','C:/migration',1,1,'[]','00000000-0000-0000-0000-000000000000');
        INSERT INTO engine_task (
          id,project_id,source,product_pillar,title,request,system_artifacts,priority,time_created
        ) VALUES (
          'tsk_migration','prj_migration','test','code','Migration Task','Migrate wait','[]','normal',1
        );
        INSERT INTO engine_task_root_ingress_policy (
          id,semantic_turn_limit,activation_limit,time_created
        ) VALUES ('pol_migration',1,1,1);
        INSERT INTO protocol_event (
          id,kind,type,aggregate_type,aggregate_id,source,seq,emitted_at,payload
        ) VALUES (
          'pev_open','event','task.execution.opened','task','tsk_migration','test',1,100,'{"execution_epoch":1}'
        );
        INSERT INTO automation (
          id,definition_id,revision,project_id,task_id,name,kind,prompt,status,due_at,time_created
        ) VALUES (
          'atm_wait','atm_wait',1,'prj_migration','tsk_migration','wait','delay','re-read evidence','active',500,200
        );
        INSERT INTO automation_run VALUES (
          'atr_wait','atm_wait','cal_wait',NULL,NULL,NULL,NULL,500
        );
        INSERT INTO engine_task_root_ingress (
          id,task_id,execution_epoch,sequence,source,source_id,policy_id,time_accepted
        ) VALUES (
          'ing_wait','tsk_migration',1,1,'automation_run','atr_wait','pol_migration',501
        );
        INSERT INTO automation (
          id,definition_id,revision,project_id,name,kind,scope,recurrence,prompt,status,time_created
        ) VALUES (
          'atm_recurring','atm_recurring',1,'prj_migration','recurring','recurring','project',
          'DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY','run','active',250
        );
        INSERT INTO automation_run VALUES (
          'atr_legacy','atm_recurring','cal_legacy','prj_migration',NULL,NULL,NULL,300
        );
        INSERT INTO automation_run_receipt VALUES (
          'arc_legacy','atr_legacy','retry_wait',NULL,NULL,400,'temporary',350
        );
      `)

      expect(migrateSchedulingOccurrences(db)).toBe(true)

      expect(
        row(db,
          "SELECT id,task_id,execution_epoch,due_at,reason,legacy_automation_definition_id FROM engine_task_wait_registration",
        ),
      ).toEqual({
        id: "atm_wait",
        task_id: "tsk_migration",
        execution_epoch: 1,
        due_at: 500,
        reason: "re-read evidence",
        legacy_automation_definition_id: "atm_wait",
      })
      expect(
        row(db, "SELECT definition_id,revision FROM automation_definition_tombstone WHERE definition_id='atm_wait'"),
      ).toEqual({ definition_id: "atm_wait", revision: 2 })
      expect(
        row(db, "SELECT wait_id,ingress_id,disposition FROM engine_task_wait_settlement WHERE wait_id='atm_wait'"),
      ).toEqual({ wait_id: "atm_wait", ingress_id: "ing_wait", disposition: "due_ingress_accepted" })
      expect(
        row(db, "SELECT source,source_id,inline_payload FROM engine_task_root_ingress WHERE id='ing_wait'"),
      ).toEqual({
        source: "inline",
        source_id: "atm_wait",
        inline_payload:
          '{"note":"Task wait atm_wait became due","taskWaitWake":{"jobID":"atm_wait","fireID":"atm_wait","dueAt":500}}',
      })
      expect(
        row(db,
          "SELECT id,automation_revision_id,scheduled_due_at,origin,time_created FROM automation_fire WHERE id='cal_legacy'",
        ),
      ).toEqual({
        id: "cal_legacy",
        automation_revision_id: "atm_recurring",
        scheduled_due_at: 300,
        origin: "legacy",
        time_created: 300,
      })
      expect(row(db, "SELECT fire_id FROM automation_run WHERE id='atr_legacy'")).toEqual({
        fire_id: "cal_legacy",
      })
      expect(row(db, "SELECT * FROM pragma_foreign_key_check LIMIT 1")).toBeNull()
      for (const table of [
        "automation",
        "automation_definition_tombstone",
        "automation_fire",
        "automation_fire_attempt",
        "automation_fire_attempt_receipt",
        "automation_delay_settlement",
        "automation_run",
        "automation_run_receipt",
        "event_job",
        "event_job_definition_tombstone",
        "engine_task_wait_registration",
        "engine_task_wait_settlement",
        "engine_task_root_ingress",
      ]) {
        expect(tableSchemaObjects(db, table)).toEqual(tableSchemaObjects(reference, table))
      }
      expect(migrateSchedulingOccurrences(db)).toBe(false)
    } finally {
      reference.close(true)
      db.close(true)
    }
  })

  test("folds provable legacy retry chains into one logical Fire with one current outcome", () => {
    const db = legacyDatabase()
    const firstRetryFire = legacyAutomationID("cal", "atm_retry_chain", "200")
    const secondRetryFire = legacyAutomationID("cal", "atm_retry_chain", "300")
    const pendingRetryFire = legacyAutomationID("cal", "atm_pending_chain", "500")
    try {
      db.exec(`
        INSERT INTO automation (
          id,definition_id,revision,project_id,name,kind,scope,recurrence,prompt,status,time_created
        ) VALUES
          ('atm_retry_chain','atm_retry_chain',1,'prj_chain','chain','recurring','project',
           'DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY','run','active',1),
          ('atm_pending_chain','atm_pending_chain',1,'prj_chain','pending','recurring','project',
           'DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY','run','active',1);
        INSERT INTO automation_run VALUES
          ('run_a_ok','atm_retry_chain','cal_chain_root','prj_a',NULL,NULL,NULL,100),
          ('run_b_retry_1','atm_retry_chain','cal_chain_root','prj_b',NULL,NULL,NULL,100),
          ('run_b_retry_2','atm_retry_chain','${firstRetryFire}','prj_b',NULL,NULL,NULL,200),
          ('run_b_ok','atm_retry_chain','${secondRetryFire}','prj_b',NULL,NULL,NULL,300),
          ('run_pending_1','atm_pending_chain','cal_pending_root','prj_c',NULL,NULL,NULL,400),
          ('run_pending_2','atm_pending_chain','${pendingRetryFire}','prj_c',NULL,NULL,NULL,500);
        INSERT INTO automation_run_receipt VALUES
          ('receipt_a_ok','run_a_ok','succeeded',NULL,NULL,NULL,NULL,110),
          ('receipt_b_retry_1','run_b_retry_1','retry_wait',NULL,NULL,200,'retry one',120),
          ('receipt_b_retry_2','run_b_retry_2','retry_wait',NULL,NULL,300,'retry two',220),
          ('receipt_b_ok','run_b_ok','succeeded',NULL,NULL,NULL,NULL,310),
          ('receipt_pending_1','run_pending_1','retry_wait',NULL,NULL,500,'retry pending one',420),
          ('receipt_pending_2','run_pending_2','retry_wait',NULL,NULL,600,'retry pending two',520);
      `)

      expect(migrateSchedulingOccurrences(db)).toBe(true)
      expect(row(db, "SELECT count(*) AS count FROM automation_fire WHERE automation_revision_id='atm_retry_chain'"))
        .toEqual({ count: 1 })
      expect(row(db, "SELECT count(*) AS count FROM automation_run WHERE fire_id='cal_chain_root'"))
        .toEqual({ count: 4 })
      expect(row(db, `
        SELECT count(*) AS count
        FROM automation_run AS run
        WHERE run.automation_revision_id='atm_retry_chain'
          AND (
            SELECT receipt.outcome FROM automation_run_receipt AS receipt
            WHERE receipt.run_id=run.id
            ORDER BY receipt.time_created DESC,receipt.id DESC LIMIT 1
          )='retry_wait'
      `)).toEqual({ count: 0 })
      expect(row(db, `
        SELECT count(*) AS count
        FROM automation_run_receipt
        WHERE outcome='disposition' AND disposition='superseded'
          AND run_id IN ('run_b_retry_1','run_b_retry_2')
      `)).toEqual({ count: 2 })
      expect(row(db, "SELECT count(*) AS count FROM automation_fire WHERE automation_revision_id='atm_pending_chain'"))
        .toEqual({ count: 1 })
      expect(row(db, "SELECT count(*) AS count FROM automation_run WHERE fire_id='cal_pending_root'"))
        .toEqual({ count: 2 })
      expect(row(db, `
        SELECT receipt.outcome,retry_at
        FROM automation_run_receipt AS receipt
        WHERE receipt.run_id='run_pending_2'
        ORDER BY receipt.time_created DESC,receipt.id DESC LIMIT 1
      `)).toEqual({ outcome: "retry_wait", retry_at: 600 })
      expect(migrateSchedulingOccurrences(db)).toBe(false)
    } finally {
      db.close(true)
    }
  })

  test("rolls back a legacy retry whose next Fire is not its exact deterministic successor", () => {
    const db = legacyDatabase()
    try {
      db.exec(`
        INSERT INTO automation (
          id,definition_id,revision,project_id,name,kind,scope,recurrence,prompt,status,time_created
        ) VALUES (
          'atm_ambiguous_retry','atm_ambiguous_retry',1,'prj_chain','ambiguous','recurring','project',
          'DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY','run','active',1
        );
        INSERT INTO automation_run VALUES
          ('run_ambiguous_retry','atm_ambiguous_retry','cal_ambiguous_root','prj_a',NULL,NULL,NULL,100),
          ('run_manual_after_retry','atm_ambiguous_retry','cal_manual_unknown','prj_a',NULL,NULL,NULL,200);
        INSERT INTO automation_run_receipt VALUES
          ('receipt_ambiguous_retry','run_ambiguous_retry','retry_wait',NULL,NULL,200,'retry',110),
          ('receipt_manual_after_retry','run_manual_after_retry','succeeded',NULL,NULL,NULL,NULL,210);
      `)
      let failure: unknown
      try {
        migrateSchedulingOccurrences(db)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(SchedulingOccurrenceMigrationError)
      expect(failure).toMatchObject({ code: "ambiguous_legacy_automation_retry" })
      expect(row(db, "SELECT fire_id FROM automation_run WHERE id='run_manual_after_retry'"))
        .toEqual({ fire_id: "cal_manual_unknown" })
      expect(row(db, "SELECT count(*) AS count FROM automation_run_receipt WHERE outcome='disposition'"))
        .toEqual({ count: 0 })
      expect(row(db, "SELECT name FROM sqlite_schema WHERE type='table' AND name='automation_fire'"))
        .toBeNull()
    } finally {
      db.close(true)
    }
  })

  test("rolls back an active legacy Task wait whose creation epoch has multiple possible owners", () => {
    const db = legacyDatabase()
    try {
      db.exec(`
        INSERT INTO protocol_event (
          id,kind,type,aggregate_type,aggregate_id,source,seq,emitted_at,payload
        ) VALUES
          ('pev_open_1','event','task.execution.opened','task','tsk_ambiguous','test',1,100,'{"execution_epoch":1}'),
          ('pev_open_2','event','task.execution.reopened','task','tsk_ambiguous','test',2,200,'{"execution_epoch":2}');
        INSERT INTO automation (
          id,definition_id,revision,project_id,task_id,name,kind,prompt,status,due_at,time_created
        ) VALUES (
          'atm_ambiguous','atm_ambiguous',1,'prj_migration','tsk_ambiguous','wait','delay',
          'ambiguous wait','active',500,150
        );
      `)
      expect(row(db, "SELECT count(*) AS count FROM protocol_event WHERE aggregate_id='tsk_ambiguous'"))
        .toEqual({ count: 2 })
      expect(row(db, "SELECT id,task_id FROM automation WHERE id='atm_ambiguous'"))
        .toEqual({ id: "atm_ambiguous", task_id: "tsk_ambiguous" })
      expect(row(db, `
        SELECT CAST((
          SELECT max(json_extract(opened.payload, '$.execution_epoch'))
          FROM protocol_event AS opened
          WHERE opened.aggregate_type='task'
            AND opened.aggregate_id='tsk_ambiguous'
            AND opened.type IN ('task.execution.opened','task.execution.reopened')
          HAVING count(*)=1
        ) AS INTEGER) AS epoch
      `)).toEqual({ epoch: null })
      expect(() => migrateSchedulingOccurrences(db)).toThrow(
        "Legacy Task wait atm_ambiguous cannot be assigned to its creation execution epoch",
      )
      expect(row(db, "SELECT id FROM automation WHERE id='atm_ambiguous'")).toEqual({ id: "atm_ambiguous" })
      expect(row(db, "SELECT name FROM sqlite_schema WHERE type='table' AND name='engine_task_wait_registration'"))
        .toBeNull()
    } finally {
      db.close(true)
    }
  })

  test("migrates a tombstoned delivered Task wait from its exact ingress epoch", () => {
    const db = legacyDatabase()
    try {
      db.exec(`
        INSERT INTO project (id,worktree,time_created,time_updated,sandboxes,generation)
        VALUES ('prj_delivered','C:/delivered',1,1,'[]','00000000-0000-0000-0000-000000000000');
        INSERT INTO engine_task (
          id,project_id,source,product_pillar,title,request,system_artifacts,priority,time_created
        ) VALUES (
          'tsk_delivered','prj_delivered','test','code','Delivered Task','Migrate delivered wait','[]','normal',1
        );
        INSERT INTO engine_task_root_ingress_policy (
          id,semantic_turn_limit,activation_limit,time_created
        ) VALUES ('pol_delivered',1,1,1);
        INSERT INTO protocol_event (
          id,kind,type,aggregate_type,aggregate_id,source,seq,emitted_at,payload
        ) VALUES
          ('pev_delivered_open_1','event','task.execution.opened','task','tsk_delivered','test',1,100,'{"execution_epoch":1}'),
          ('pev_delivered_open_2','event','task.execution.reopened','task','tsk_delivered','test',2,400,'{"execution_epoch":2}');
        INSERT INTO automation (
          id,definition_id,revision,project_id,task_id,name,kind,prompt,status,due_at,time_created
        ) VALUES (
          'atm_delivered','atm_delivered',1,'prj_delivered','tsk_delivered','delivered wait','delay',
          'resume exact epoch','active',300,150
        );
        INSERT INTO automation_run VALUES (
          'atr_delivered','atm_delivered','cal_delivered',NULL,NULL,NULL,NULL,300
        );
        INSERT INTO engine_task_root_ingress (
          id,task_id,execution_epoch,sequence,source,source_id,policy_id,time_accepted
        ) VALUES (
          'ing_delivered','tsk_delivered',1,1,'automation_run','atr_delivered','pol_delivered',301
        );
        INSERT INTO automation_definition_tombstone VALUES (
          'adt_delivered','atm_delivered',2,302
        );
      `)

      expect(migrateSchedulingOccurrences(db)).toBe(true)
      expect(
        row(db, `
          SELECT registration.id,registration.execution_epoch,settlement.ingress_id,settlement.disposition
          FROM engine_task_wait_registration AS registration
          JOIN engine_task_wait_settlement AS settlement ON settlement.wait_id=registration.id
          WHERE registration.id='atm_delivered'
        `),
      ).toEqual({
        id: "atm_delivered",
        execution_epoch: 1,
        ingress_id: "ing_delivered",
        disposition: "due_ingress_accepted",
      })
      expect(
        row(db, "SELECT source,source_id FROM engine_task_root_ingress WHERE id='ing_delivered'"),
      ).toEqual({ source: "inline", source_id: "atm_delivered" })
      expect(row(db, "SELECT name FROM pragma_table_info('automation') WHERE name='task_id'")).toBeNull()
    } finally {
      db.close(true)
    }
  })

  test("accepts a fresh current schema without rewriting it", () => {
    const db = new SQLite(":memory:")
    try {
      db.exec(SCHEMA_DDL)
      expect(migrateSchedulingOccurrences(db)).toBe(false)
    } finally {
      db.close(true)
    }
  })

  test("rebuilds the former current wait schema into retention-safe exact lineage", () => {
    const db = new SQLite(":memory:")
    const formerFireID = taskWaitFireID("wait_upgrade")
    try {
      db.exec(SCHEMA_DDL)
      installFormerCurrentTaskWaitTables(db)
      installFormerCurrentAutomationFireTable(db)
      db.exec(`
        INSERT INTO project (id,worktree,time_created,time_updated,sandboxes,generation)
        VALUES ('prj_upgrade','C:/upgrade',1,1,'[]','00000000-0000-0000-0000-000000000000');
        INSERT INTO engine_task (
          id,project_id,source,product_pillar,title,request,system_artifacts,priority,time_created
        ) VALUES ('tsk_upgrade','prj_upgrade','test','code','Upgrade','Upgrade waits','[]','normal',1);
        INSERT INTO engine_task_root_ingress_policy(id,semantic_turn_limit,activation_limit,time_created)
        VALUES ('pol_upgrade',1,1,1);
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,inline_payload,policy_id,time_accepted
        ) VALUES (
          'ing_upgrade','tsk_upgrade',1,1,'inline','${formerFireID}',
          '{"taskWaitWake":{"jobID":"wait_upgrade","fireID":"${formerFireID}","dueAt":100}}',
          'pol_upgrade',100
        );
        INSERT INTO engine_task_wait_registration(
          id,task_id,execution_epoch,due_at,reason,legacy_automation_definition_id,input_digest,time_created
        ) VALUES ('wait_upgrade','tsk_upgrade',1,100,'upgrade','wait_upgrade','digest',10);
        INSERT INTO engine_task_wait_settlement(wait_id,ingress_id,disposition,time_created)
        VALUES ('wait_upgrade','ing_upgrade','due_ingress_accepted',100);
      `)

      expect(migrateSchedulingOccurrences(db)).toBe(true)
      expect(
        row<{ from: string; on_delete: string }>(db,
          "SELECT `from`,on_delete FROM pragma_foreign_key_list('engine_task_wait_registration') WHERE `from`='creator_ingress_id'",
        ),
      ).toEqual({ from: "creator_ingress_id", on_delete: "CASCADE" })
      expect(
        row(db, "SELECT source_id,inline_payload FROM engine_task_root_ingress WHERE id='ing_upgrade'"),
      ).toEqual({
        source_id: "wait_upgrade",
        inline_payload: '{"taskWaitWake":{"jobID":"wait_upgrade","fireID":"wait_upgrade","dueAt":100}}',
      })
      db.exec("DELETE FROM engine_task WHERE id='tsk_upgrade'")
      expect(row(db, "SELECT count(*) AS count FROM engine_task_wait_registration")).toEqual({ count: 0 })
      expect(row(db, "SELECT * FROM pragma_foreign_key_check LIMIT 1")).toBeNull()
      expect(row<{ sql: string }>(db,
        "SELECT sql FROM sqlite_schema WHERE type='table' AND name='automation_fire'",
      )?.sql).toContain("'legacy'")
      expect(row(db,
        "SELECT name FROM sqlite_schema WHERE type='index' AND name='automation_fire_revision_frontier_idx'",
      )).toEqual({ name: "automation_fire_revision_frontier_idx" })
      expect(migrateSchedulingOccurrences(db)).toBe(false)
    } finally {
      db.close(true)
    }
  })

  test("rejects an unproved former-current due lineage without rewriting its ingress", () => {
    const db = new SQLite(":memory:")
    try {
      db.exec(SCHEMA_DDL)
      installFormerCurrentTaskWaitTables(db)
      db.exec(`
        INSERT INTO project (id,worktree,time_created,time_updated,sandboxes,generation)
        VALUES ('prj_ambiguous_lineage','C:/ambiguous-lineage',1,1,'[]','00000000-0000-0000-0000-000000000000');
        INSERT INTO engine_task (
          id,project_id,source,product_pillar,title,request,system_artifacts,priority,time_created
        ) VALUES ('tsk_ambiguous_lineage','prj_ambiguous_lineage','test','code','Ambiguous','Reject rewrite','[]','normal',1);
        INSERT INTO engine_task_root_ingress_policy(id,semantic_turn_limit,activation_limit,time_created)
        VALUES ('pol_ambiguous_lineage',1,1,1);
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,inline_payload,policy_id,time_accepted
        ) VALUES (
          'ing_ordinary','tsk_ambiguous_lineage',1,1,'inline','ordinary-source',
          '{"note":"ordinary ingress","taskWaitWake":{"jobID":"wait_ambiguous","fireID":"invented","dueAt":100}}',
          'pol_ambiguous_lineage',100
        );
        INSERT INTO engine_task_wait_registration(
          id,task_id,execution_epoch,due_at,reason,legacy_automation_definition_id,input_digest,time_created
        ) VALUES ('wait_ambiguous','tsk_ambiguous_lineage',1,100,'ambiguous','wait_ambiguous','digest',10);
        INSERT INTO engine_task_wait_settlement(wait_id,ingress_id,disposition,time_created)
        VALUES ('wait_ambiguous','ing_ordinary','due_ingress_accepted',100);
      `)
      const before = row(db, "SELECT source,source_id,inline_payload FROM engine_task_root_ingress WHERE id='ing_ordinary'")
      let failure: unknown
      try {
        migrateSchedulingOccurrences(db)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(SchedulingOccurrenceMigrationError)
      expect(failure).toMatchObject({ code: "ambiguous_task_wait_lineage" })
      expect(row(db, "SELECT source,source_id,inline_payload FROM engine_task_root_ingress WHERE id='ing_ordinary'"))
        .toEqual(before)
      expect(row(db, "SELECT name FROM sqlite_schema WHERE type='table' AND name='__scheduling_occurrence_old_engine_task_wait_registration'"))
        .toBeNull()
    } finally {
      db.close(true)
    }
  })

  test("rolls back the legacy rebuild when its canonical foreign-key gate finds an orphan", () => {
    const db = legacyDatabase()
    try {
      db.exec(`
        INSERT INTO automation_project_target(automation_revision_id,project_id,position)
        VALUES ('missing_revision','prj_orphan',0);
      `)
      let failure: unknown
      try {
        migrateSchedulingOccurrences(db)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(SchedulingOccurrenceMigrationError)
      expect(failure).toMatchObject({ code: "foreign_key_violation" })
      expect(row(db, "SELECT automation_revision_id,project_id FROM automation_project_target WHERE automation_revision_id='missing_revision'"))
        .toEqual({ automation_revision_id: "missing_revision", project_id: "prj_orphan" })
      expect(row(db, "SELECT name FROM sqlite_schema WHERE type='table' AND name='automation_fire'")).toBeNull()
    } finally {
      db.close(true)
    }
  })
})
