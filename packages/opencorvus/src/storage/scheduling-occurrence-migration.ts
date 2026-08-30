import { Database as SQLite } from "bun:sqlite"
import { createHash } from "node:crypto"
import { SCHEMA_DDL } from "./ddl"
import { taskWaitFireID } from "@/scheduler/task-wait-fire-identity"

type RawDatabase = SQLite

export class SchedulingOccurrenceMigrationError extends Error {
  override readonly name = "SchedulingOccurrenceMigrationError"

  constructor(
    message: string,
    readonly code: "ambiguous_task_wait_lineage" | "ambiguous_legacy_automation_retry" | "foreign_key_violation",
  ) {
    super(message)
  }
}

const REBUILT_TABLES = [
  "automation",
  "automation_definition_tombstone",
  "automation_run",
  "automation_run_receipt",
  "event_job",
  "event_job_definition_tombstone",
] as const

function quote(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function rows<T>(db: RawDatabase, sql: string): T[] {
  const statement = db.query<T, []>(sql)
  try {
    return statement.all()
  } finally {
    statement.finalize()
  }
}

function exists(db: RawDatabase, table: string): boolean {
  return Boolean(
    rows<{ name: string }>(
      db,
      `SELECT name FROM sqlite_schema WHERE type='table' AND name=${literal(table)}`,
    )[0],
  )
}

function schemaObjectExists(db: RawDatabase, type: "index" | "trigger", name: string): boolean {
  return Boolean(
    rows<{ name: string }>(
      db,
      `SELECT name FROM sqlite_schema WHERE type=${literal(type)} AND name=${literal(name)}`,
    )[0],
  )
}

function columns(db: RawDatabase, table: string): string[] {
  return rows<{ name: string }>(db, `PRAGMA table_info(${quote(table)})`).map((row) => row.name)
}

function foreignKeys(db: RawDatabase, table: string): Array<{ from: string; table: string; on_delete: string }> {
  return rows(db, `PRAGMA foreign_key_list(${quote(table)})`)
}

function triggerSQL(db: RawDatabase, trigger: string): string {
  return (
    rows<{ sql: string | null }>(
      db,
      `SELECT sql FROM sqlite_schema WHERE type='trigger' AND name=${literal(trigger)}`,
    )[0]?.sql ?? ""
  )
}

function tableSQL(db: RawDatabase, table: string): string {
  return (
    rows<{ sql: string | null }>(
      db,
      `SELECT sql FROM sqlite_schema WHERE type='table' AND name=${literal(table)}`,
    )[0]?.sql ?? ""
  )
}

function currentAutomationFireSchema(db: RawDatabase): boolean {
  return (
    tableSQL(db, "automation_fire").includes("'legacy'") &&
    schemaObjectExists(db, "index", "automation_fire_revision_frontier_idx")
  )
}

function currentTaskWaitSchema(db: RawDatabase): boolean {
  if (!exists(db, "engine_task_wait_registration") || !exists(db, "engine_task_wait_settlement")) return false
  const registrationIngress = foreignKeys(db, "engine_task_wait_registration").find(
    (key) => key.from === "creator_ingress_id" && key.table === "engine_task_root_ingress",
  )
  const settlementIngress = foreignKeys(db, "engine_task_wait_settlement").find(
    (key) => key.from === "ingress_id" && key.table === "engine_task_root_ingress",
  )
  const lineage = triggerSQL(db, "engine_task_wait_settlement_lineage_insert")
  const retention = triggerSQL(db, "engine_task_wait_settlement_no_delete")
  return (
    registrationIngress?.on_delete.toUpperCase() === "CASCADE" &&
    settlementIngress?.on_delete.toUpperCase() === "CASCADE" &&
    lineage.includes("ingress.source_id=wait.id") &&
    lineage.includes("$.taskWaitWake.fireID')=wait.id") &&
    retention.includes("JOIN engine_task AS task")
  )
}

function createCurrentTable(target: RawDatabase, reference: RawDatabase, table: string): void {
  const definition = rows<{ sql: string }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='table' AND name=${literal(table)}`,
  )[0]?.sql
  if (!definition) throw new Error(`Current schema is missing table ${table}`)
  target.exec(definition)
  for (const object of rows<{ sql: string | null }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='index' AND tbl_name=${literal(table)} ORDER BY name`,
  )) {
    if (object.sql) target.exec(object.sql)
  }
  for (const object of rows<{ sql: string | null }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='trigger' AND tbl_name=${literal(table)} ORDER BY name`,
  )) {
    if (object.sql) target.exec(object.sql)
  }
}

function createCurrentTrigger(target: RawDatabase, reference: RawDatabase, trigger: string): void {
  const definition = rows<{ sql: string }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='trigger' AND name=${literal(trigger)}`,
  )[0]?.sql
  if (!definition) throw new Error(`Current schema is missing trigger ${trigger}`)
  target.exec(definition)
}

function createCurrentIndex(target: RawDatabase, reference: RawDatabase, index: string): void {
  const definition = rows<{ sql: string }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='index' AND name=${literal(index)}`,
  )[0]?.sql
  if (!definition) throw new Error(`Current schema is missing index ${index}`)
  target.exec(definition)
}

function prepareRebuild(target: RawDatabase, reference: RawDatabase, table: string): string {
  const legacy = `__scheduling_occurrence_old_${table}`
  if (exists(target, legacy)) throw new Error(`Scheduling occurrence migration found stale table ${legacy}`)
  for (const index of rows<{ name: string }>(
    target,
    `SELECT name FROM sqlite_schema WHERE type='index' AND tbl_name=${literal(table)} AND sql IS NOT NULL`,
  )) {
    target.exec(`DROP INDEX ${quote(index.name)}`)
  }
  for (const trigger of rows<{ name: string }>(
    target,
    `SELECT name FROM sqlite_schema WHERE type='trigger' AND tbl_name=${literal(table)}`,
  )) {
    target.exec(`DROP TRIGGER ${quote(trigger.name)}`)
  }
  target.exec(`ALTER TABLE ${quote(table)} RENAME TO ${quote(legacy)}`)
  createCurrentTable(target, reference, table)
  return legacy
}

function copySharedColumns(target: RawDatabase, table: string, legacy: string): void {
  const old = new Set(columns(target, legacy))
  const shared = columns(target, table).filter((column) => old.has(column))
  if (shared.length === 0) throw new Error(`Scheduling occurrence migration cannot copy table ${table}`)
  const projection = shared.map(quote).join(",")
  target.exec(`INSERT INTO ${quote(table)} (${projection}) SELECT ${projection} FROM ${quote(legacy)} ORDER BY rowid`)
}

function normalizeCurrentTaskWaitIngresses(db: RawDatabase): void {
  const candidates = rows<{
    wait_id: string
    wait_task_id: string
    wait_execution_epoch: number
    due_at: number
    ingress_id: string
    ingress_task_id: string
    ingress_execution_epoch: number
    source: string
    source_id: string
    inline_payload: string | null
    time_accepted: number
  }>(db, `
    SELECT
      wait.id AS wait_id,
      wait.task_id AS wait_task_id,
      wait.execution_epoch AS wait_execution_epoch,
      wait.due_at,
      ingress.id AS ingress_id,
      ingress.task_id AS ingress_task_id,
      ingress.execution_epoch AS ingress_execution_epoch,
      ingress.source,
      ingress.source_id,
      ingress.inline_payload,
      ingress.time_accepted
    FROM engine_task_wait_settlement AS settlement
    JOIN engine_task_wait_registration AS wait ON wait.id=settlement.wait_id
    JOIN engine_task_root_ingress AS ingress ON ingress.id=settlement.ingress_id
    WHERE settlement.disposition='due_ingress_accepted'
    ORDER BY wait.id;
  `)
  const update = db.query<never, [string, string, number, string]>(`
    UPDATE engine_task_root_ingress
    SET source='inline',
        source_id=?1,
        inline_payload=json_set(
          inline_payload,
          '$.taskWaitWake.jobID', ?1,
          '$.taskWaitWake.fireID', ?2,
          '$.taskWaitWake.dueAt', ?3
        )
    WHERE id=?4
  `)
  try {
    for (const candidate of candidates) {
      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(candidate.inline_payload ?? "null") as Record<string, unknown>
      } catch {
        payload = {}
      }
      const wake = payload?.taskWaitWake
      const wakeRecord = wake && typeof wake === "object" ? (wake as Record<string, unknown>) : undefined
      const exactRelation =
        candidate.wait_task_id === candidate.ingress_task_id &&
        candidate.wait_execution_epoch === candidate.ingress_execution_epoch &&
        candidate.source === "inline" &&
        candidate.time_accepted >= candidate.due_at &&
        wakeRecord?.jobID === candidate.wait_id &&
        wakeRecord?.dueAt === candidate.due_at
      const canonical =
        exactRelation &&
        candidate.source_id === candidate.wait_id &&
        wakeRecord?.fireID === candidate.wait_id
      const formerFireID = taskWaitFireID(candidate.wait_id)
      const formerProduction =
        exactRelation &&
        candidate.source_id === formerFireID &&
        wakeRecord?.fireID === formerFireID
      if (!canonical && !formerProduction) {
        throw new SchedulingOccurrenceMigrationError(
          `Task wait ${candidate.wait_id} settlement ${candidate.ingress_id} has no exact former-production due lineage`,
          "ambiguous_task_wait_lineage",
        )
      }
      if (formerProduction) {
        update.run(candidate.wait_id, candidate.wait_id, candidate.due_at, candidate.ingress_id)
      }
    }
  } finally {
    update.finalize()
  }
}

function migrateCurrentTaskWaitSchema(db: RawDatabase, reference: RawDatabase): void {
  const legacyAlterTable = rows<{ legacy_alter_table: number }>(db, "PRAGMA legacy_alter_table")[0]
    ?.legacy_alter_table
  db.exec("PRAGMA legacy_alter_table=ON")
  db.exec("BEGIN IMMEDIATE")
  try {
    if (!exists(db, "engine_task_wait_registration")) {
      createCurrentTable(db, reference, "engine_task_wait_registration")
    }
    if (!exists(db, "engine_task_wait_settlement")) {
      createCurrentTable(db, reference, "engine_task_wait_settlement")
    }
    db.exec("DROP TRIGGER IF EXISTS engine_task_root_ingress_no_update")
    normalizeCurrentTaskWaitIngresses(db)
    if (!currentTaskWaitSchema(db)) {
      const oldRegistration = prepareRebuild(db, reference, "engine_task_wait_registration")
      const oldSettlement = prepareRebuild(db, reference, "engine_task_wait_settlement")
      copySharedColumns(db, "engine_task_wait_registration", oldRegistration)
      copySharedColumns(db, "engine_task_wait_settlement", oldSettlement)
      db.exec(`DROP TABLE ${quote(oldSettlement)}`)
      db.exec(`DROP TABLE ${quote(oldRegistration)}`)
    }
    if (!tableSQL(db, "automation_fire").includes("'legacy'")) {
      const oldFire = prepareRebuild(db, reference, "automation_fire")
      copySharedColumns(db, "automation_fire", oldFire)
      db.exec(`DROP TABLE ${quote(oldFire)}`)
    }
    createCurrentTrigger(db, reference, "engine_task_root_ingress_no_update")
    for (const index of ["automation_session_delay_frontier_idx", "automation_fire_revision_frontier_idx"] as const) {
      if (!schemaObjectExists(db, "index", index)) createCurrentIndex(db, reference, index)
    }
    const violation = rows<Record<string, unknown>>(db, "PRAGMA foreign_key_check")[0]
    if (violation) {
      throw new SchedulingOccurrenceMigrationError(
        `Task wait schema migration left a foreign-key violation: ${JSON.stringify(violation)}`,
        "foreign_key_violation",
      )
    }
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  } finally {
    db.exec(`PRAGMA legacy_alter_table=${legacyAlterTable ? "ON" : "OFF"}`)
  }
}

function migrateLegacyTaskWaits(db: RawDatabase): void {
  const duplicateDelivered = rows<{ definition_id: string }>(db, `
    SELECT definition.definition_id
    FROM automation AS definition
    JOIN automation_run AS run ON run.automation_revision_id=definition.id
    JOIN engine_task_root_ingress AS ingress
      ON ingress.source='automation_run' AND ingress.source_id=run.id
    WHERE definition.task_id IS NOT NULL AND definition.kind='delay'
    GROUP BY definition.definition_id
    HAVING count(DISTINCT ingress.id)>1
    LIMIT 1
  `)[0]
  if (duplicateDelivered) {
    throw new Error(
      `Legacy Task wait ${duplicateDelivered.definition_id} owns multiple accepted ingresses and cannot be migrated`,
    )
  }
  const invalidDelivered = rows<{ definition_id: string; ingress_id: string }>(db, `
    SELECT definition.definition_id, ingress.id AS ingress_id
    FROM automation AS definition
    JOIN automation_run AS run ON run.automation_revision_id=definition.id
    JOIN engine_task_root_ingress AS ingress
      ON ingress.source='automation_run' AND ingress.source_id=run.id
    WHERE definition.task_id IS NOT NULL
      AND definition.kind='delay'
      AND ingress.task_id<>definition.task_id
    LIMIT 1
  `)[0]
  if (invalidDelivered) {
    throw new Error(
      `Legacy Task wait ${invalidDelivered.definition_id} accepted unrelated ingress ${invalidDelivered.ingress_id}`,
    )
  }
  const ambiguousEpoch = rows<{ definition_id: string }>(db, `
    SELECT current.definition_id
    FROM automation AS current
    WHERE current.task_id IS NOT NULL
      AND current.kind='delay'
      AND current.due_at IS NOT NULL
      AND current.revision=(
        SELECT max(candidate.revision) FROM automation AS candidate
        WHERE candidate.definition_id=current.definition_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM automation_definition_tombstone AS tombstone
        WHERE tombstone.definition_id=current.definition_id
          AND tombstone.revision>=current.revision
      )
      AND NOT EXISTS (
        SELECT 1
        FROM automation AS delivered_definition
        JOIN automation_run AS delivered_run ON delivered_run.automation_revision_id=delivered_definition.id
        JOIN engine_task_root_ingress AS delivered_ingress
          ON delivered_ingress.source='automation_run' AND delivered_ingress.source_id=delivered_run.id
        WHERE delivered_definition.definition_id=current.definition_id
      )
      AND (
        SELECT count(*) FROM protocol_event AS opened
        WHERE opened.aggregate_type='task'
          AND opened.aggregate_id=current.task_id
          AND opened.type IN ('task.execution.opened','task.execution.reopened')
      )<>1
    LIMIT 1
  `)[0]
  if (ambiguousEpoch) {
    throw new Error(
      `Legacy Task wait ${ambiguousEpoch.definition_id} cannot be assigned to its creation execution epoch`,
    )
  }
  db.exec(`
    INSERT INTO engine_task_wait_registration (
      id, task_id, execution_epoch, due_at, reason, tool_part_id, creator_ingress_id, creator_activation_id,
      legacy_automation_definition_id, input_digest, time_created
    )
    SELECT
      definition.definition_id,
      definition.task_id,
      ingress.execution_epoch,
      definition.due_at,
      definition.prompt,
      NULL,
      NULL,
      NULL,
      definition.definition_id,
      'legacy-automation-definition:' || definition.definition_id,
      definition.time_created
    FROM automation AS definition
    JOIN automation_run AS run ON run.automation_revision_id=definition.id
    JOIN engine_task_root_ingress AS ingress
      ON ingress.source='automation_run' AND ingress.source_id=run.id
    WHERE definition.task_id IS NOT NULL
      AND definition.kind='delay'
      AND definition.due_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM engine_task_wait_registration AS migrated
        WHERE migrated.legacy_automation_definition_id=definition.definition_id
      );

    INSERT INTO engine_task_wait_registration (
      id, task_id, execution_epoch, due_at, reason, tool_part_id, creator_ingress_id, creator_activation_id,
      legacy_automation_definition_id, input_digest, time_created
    )
    SELECT
      current.definition_id,
      current.task_id,
      CAST((
        SELECT max(json_extract(opened.payload, '$.execution_epoch'))
        FROM protocol_event AS opened
        WHERE opened.aggregate_type='task'
          AND opened.aggregate_id=current.task_id
          AND opened.type IN ('task.execution.opened','task.execution.reopened')
        HAVING count(*)=1
      ) AS INTEGER),
      current.due_at,
      current.prompt,
      NULL,
      NULL,
      NULL,
      current.definition_id,
      'legacy-automation-definition:' || current.definition_id,
      current.time_created
    FROM automation AS current
    WHERE current.task_id IS NOT NULL
      AND current.kind='delay'
      AND current.due_at IS NOT NULL
      AND current.revision=(
        SELECT max(candidate.revision) FROM automation AS candidate
        WHERE candidate.definition_id=current.definition_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM automation_definition_tombstone AS tombstone
        WHERE tombstone.definition_id=current.definition_id
          AND tombstone.revision>=current.revision
      )
      AND NOT EXISTS (
        SELECT 1
        FROM automation AS delivered_definition
        JOIN automation_run AS delivered_run ON delivered_run.automation_revision_id=delivered_definition.id
        JOIN engine_task_root_ingress AS delivered_ingress
          ON delivered_ingress.source='automation_run' AND delivered_ingress.source_id=delivered_run.id
        WHERE delivered_definition.definition_id=current.definition_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM engine_task_wait_registration AS migrated
        WHERE migrated.legacy_automation_definition_id=current.definition_id
      );
  `)
  const missingEpoch = rows<{ id: string }>(
    db,
    `SELECT id FROM engine_task_wait_registration WHERE execution_epoch IS NULL LIMIT 1`,
  )[0]
  if (missingEpoch) {
    throw new Error(`Legacy Task wait ${missingEpoch.id} cannot be assigned to its creation execution epoch`)
  }
}

function tombstoneMigratedLegacyTaskWaits(db: RawDatabase): void {
  db.exec(`
    INSERT INTO engine_task_wait_settlement (wait_id, ingress_id, disposition, time_created)
    SELECT
      wait.id,
      ingress.id,
      'due_ingress_accepted',
      ingress.time_accepted
    FROM engine_task_wait_registration AS wait
    JOIN automation AS definition
      ON definition.definition_id=wait.legacy_automation_definition_id
    JOIN automation_run AS run ON run.automation_revision_id=definition.id
    JOIN engine_task_root_ingress AS ingress
      ON ingress.source='automation_run' AND ingress.source_id=run.id
    WHERE wait.legacy_automation_definition_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM engine_task_wait_settlement AS settlement WHERE settlement.wait_id=wait.id
      );
  `)
  db.exec(`
    UPDATE engine_task_root_ingress AS ingress
    SET
      source='inline',
      source_id=(
        SELECT wait.id
        FROM engine_task_wait_registration AS wait
        JOIN automation AS definition
          ON definition.definition_id=wait.legacy_automation_definition_id
        JOIN automation_run AS run ON run.automation_revision_id=definition.id
        WHERE run.id=ingress.source_id
        LIMIT 1
      ),
      inline_payload=json_object(
        'note', 'Task wait ' || (
          SELECT wait.id
          FROM engine_task_wait_registration AS wait
          JOIN automation AS definition
            ON definition.definition_id=wait.legacy_automation_definition_id
          JOIN automation_run AS run ON run.automation_revision_id=definition.id
          WHERE run.id=ingress.source_id
          LIMIT 1
        ) || ' became due',
        'taskWaitWake', json_object(
          'jobID', (
            SELECT wait.id
            FROM engine_task_wait_registration AS wait
            JOIN automation AS definition
              ON definition.definition_id=wait.legacy_automation_definition_id
            JOIN automation_run AS run ON run.automation_revision_id=definition.id
            WHERE run.id=ingress.source_id
            LIMIT 1
          ),
          'fireID', (
            SELECT wait.id
            FROM engine_task_wait_registration AS wait
            JOIN automation AS definition
              ON definition.definition_id=wait.legacy_automation_definition_id
            JOIN automation_run AS run ON run.automation_revision_id=definition.id
            WHERE run.id=ingress.source_id
            LIMIT 1
          ),
          'dueAt', (
            SELECT wait.due_at
            FROM engine_task_wait_registration AS wait
            JOIN automation AS definition
              ON definition.definition_id=wait.legacy_automation_definition_id
            JOIN automation_run AS run ON run.automation_revision_id=definition.id
            WHERE run.id=ingress.source_id
            LIMIT 1
          )
        )
      )
    WHERE ingress.source='automation_run'
      AND EXISTS (
        SELECT 1
        FROM engine_task_wait_registration AS wait
        JOIN automation AS definition
          ON definition.definition_id=wait.legacy_automation_definition_id
        JOIN automation_run AS run ON run.automation_revision_id=definition.id
        WHERE run.id=ingress.source_id
      );
  `)
  db.exec(`
    INSERT INTO automation_definition_tombstone (
      id, definition_id, revision, tool_part_id, tool_input_digest, time_created
    )
    SELECT
      wait.legacy_automation_definition_id,
      wait.legacy_automation_definition_id,
      definition.revision + 1,
      NULL,
      NULL,
      max(wait.time_created, definition.time_created)
    FROM engine_task_wait_registration AS wait
    JOIN automation AS definition
      ON definition.definition_id=wait.legacy_automation_definition_id
     AND definition.revision=(
       SELECT max(candidate.revision) FROM automation AS candidate
       WHERE candidate.definition_id=wait.legacy_automation_definition_id
     )
    WHERE wait.legacy_automation_definition_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM automation_definition_tombstone AS tombstone
        WHERE tombstone.definition_id=wait.legacy_automation_definition_id
          AND tombstone.revision>=definition.revision
      );
  `)
}

function migrateLegacyAutomationFires(db: RawDatabase): void {
  type LegacyRun = {
    id: string
    fire_id: string
    automation_revision_id: string
    definition_id: string
    started_at: number
  }
  type LegacyReceipt = {
    id: string
    run_id: string
    outcome: "retry_wait" | "succeeded" | "failed" | "disposition"
    retry_at: number | null
    time_created: number
  }
  const runs = rows<LegacyRun>(db, `
    SELECT
      run.id,
      run.fire_id,
      run.automation_revision_id,
      definition.definition_id,
      run.started_at
    FROM automation_run AS run
    JOIN automation AS definition ON definition.id=run.automation_revision_id
    ORDER BY definition.definition_id,run.started_at,run.id
  `)
  const receipts = rows<LegacyReceipt>(db, `
    SELECT id,run_id,outcome,retry_at,time_created
    FROM automation_run_receipt
    ORDER BY run_id,time_created,id
  `)
  const latestReceipt = new Map<string, LegacyReceipt>()
  for (const receipt of receipts) latestReceipt.set(receipt.run_id, receipt)
  const definitions = new Map<string, Map<string, LegacyRun[]>>()
  for (const run of runs) {
    const fires = definitions.get(run.definition_id) ?? new Map<string, LegacyRun[]>()
    const members = fires.get(run.fire_id) ?? []
    members.push(run)
    fires.set(run.fire_id, members)
    definitions.set(run.definition_id, fires)
  }
  const deterministicID = (prefix: "cal" | "arc", ...parts: string[]) =>
    `${prefix}_automation_${createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32)}`
  const ambiguity = (definitionID: string, message: string): never => {
    throw new SchedulingOccurrenceMigrationError(
      `Legacy Automation ${definitionID} retry chain is ambiguous: ${message}`,
      "ambiguous_legacy_automation_retry",
    )
  }
  for (const [definitionID, fires] of definitions) {
    const ordered = [...fires.entries()]
      .map(([fireID, members]) => ({
        fireID,
        members,
        revisionID: members[0]!.automation_revision_id,
        startedAt: Math.min(...members.map((member) => member.started_at)),
      }))
      .sort((left, right) => left.startedAt - right.startedAt || left.fireID.localeCompare(right.fireID))
    let index = 0
    while (index < ordered.length) {
      const canonical = ordered[index]!
      let current = canonical
      while (true) {
        const retryMembers = current.members.flatMap((member) => {
          const receipt = latestReceipt.get(member.id)
          return receipt?.outcome === "retry_wait" ? [{ member, receipt }] : []
        })
        const runningMembers = current.members.filter((member) => !latestReceipt.has(member.id))
        const next = ordered[index + 1]
        if (runningMembers.length > 0) {
          if (retryMembers.length > 0 || next) {
            ambiguity(definitionID, `fire ${current.fireID} has an unreceipted run before a later occurrence`)
          }
          break
        }
        if (retryMembers.length === 0) break
        const retryTimes = [...new Set(retryMembers.map(({ receipt }) => receipt.retry_at))]
        if (retryTimes.length !== 1 || retryTimes[0] === null) {
          ambiguity(definitionID, `fire ${current.fireID} has no single exact retry deadline`)
        }
        if (!next) break
        const expectedSuccessorID = deterministicID("cal", definitionID, String(retryTimes[0]))
        if (next.fireID !== expectedSuccessorID || next.revisionID !== current.revisionID) {
          ambiguity(
            definitionID,
            `fire ${current.fireID} expects successor ${expectedSuccessorID} in revision ${current.revisionID}, received ${next.fireID} in ${next.revisionID}`,
          )
        }
        for (const { member, receipt } of retryMembers) {
          const dispositionID = deterministicID("arc", "legacy-superseded", member.id, next.fireID)
          const settledAt = Math.max(next.startedAt, receipt.time_created + 1)
          db.exec(`
            INSERT INTO automation_run_receipt (
              id,run_id,outcome,disposition,closure_event_id,retry_at,error,time_created
            ) VALUES (
              ${literal(dispositionID)},${literal(member.id)},'disposition','superseded',NULL,NULL,NULL,${settledAt}
            )
          `)
        }
        for (const member of next.members) {
          db.exec(
            `UPDATE automation_run SET fire_id=${literal(canonical.fireID)} WHERE id=${literal(member.id)}`,
          )
          member.fire_id = canonical.fireID
        }
        canonical.members.push(...next.members)
        current = next
        index += 1
      }
      index += 1
    }
  }
  db.exec(`
    INSERT INTO automation_fire (
      id, automation_revision_id, scheduled_due_at, origin,
      tool_part_id, input_digest, time_created
    )
    SELECT
      run.fire_id,
      run.automation_revision_id,
      COALESCE(definition.due_at, min(run.started_at)),
      'legacy',
      NULL,
      NULL,
      min(run.started_at)
    FROM automation_run AS run
    JOIN automation AS definition ON definition.id=run.automation_revision_id
    GROUP BY run.fire_id, run.automation_revision_id, definition.due_at;
  `)
  const ambiguous = rows<{ fire_id: string }>(
    db,
    `SELECT fire_id FROM automation_run GROUP BY fire_id HAVING count(DISTINCT automation_revision_id)>1 LIMIT 1`,
  )[0]
  if (ambiguous) {
    throw new Error(`Legacy Automation fire ${ambiguous.fire_id} spans multiple definition revisions`)
  }
}

/** Atomic cutover from Automation-owned Task delays and unowned run fire IDs
 * to native Task waits, immutable Automation fires, and exact Tool causation.
 * Historical fire schedule time and invocation origin were not persisted, so
 * migrated fires use explicit legacy provenance. A retry successor is folded
 * into its first exact deterministic Fire and the superseded physical run is
 * terminalized; ambiguous successor identity rolls back the whole cutover.
 * Legacy Fires advance recurrence only as a terminal baseline and can never
 * be created by a current runtime writer. */
export function migrateSchedulingOccurrences(sqlite: RawDatabase): boolean {
  if (!exists(sqlite, "automation")) return false
  const currentSchedulingSchema =
    exists(sqlite, "automation_fire") &&
    exists(sqlite, "automation_delay_settlement") &&
    exists(sqlite, "automation_fire_attempt") &&
    exists(sqlite, "automation_fire_attempt_receipt") &&
    columns(sqlite, "automation").includes("tool_part_id") &&
    columns(sqlite, "event_job").includes("tool_part_id")

  const reference = new SQLite(":memory:")
  reference.exec(SCHEMA_DDL)
  if (currentSchedulingSchema) {
    try {
      const currentFrontierIndexes =
        schemaObjectExists(sqlite, "index", "automation_session_delay_frontier_idx") &&
        schemaObjectExists(sqlite, "index", "automation_fire_revision_frontier_idx")
      if (currentTaskWaitSchema(sqlite) && currentAutomationFireSchema(sqlite) && currentFrontierIndexes) return false
      migrateCurrentTaskWaitSchema(sqlite, reference)
      return true
    } finally {
      reference.close(true)
    }
  }
  const legacyAlterTable = rows<{ legacy_alter_table: number }>(sqlite, "PRAGMA legacy_alter_table")[0]
    ?.legacy_alter_table
  sqlite.exec("PRAGMA legacy_alter_table=ON")
  sqlite.exec("BEGIN IMMEDIATE")
  try {
    for (const table of [
      "engine_task_wait_registration",
      "engine_task_wait_settlement",
      "automation_delay_settlement",
      "automation_fire_attempt",
      "automation_fire_attempt_receipt",
    ] as const) {
      if (!exists(sqlite, table)) createCurrentTable(sqlite, reference, table)
    }
    sqlite.exec("DROP TRIGGER IF EXISTS engine_task_root_ingress_no_update")
    migrateLegacyTaskWaits(sqlite)
    const legacyTables = new Map<string, string>()
    for (const table of [
      "automation",
      "automation_definition_tombstone",
      "event_job",
      "event_job_definition_tombstone",
    ] as const) {
      const legacy = prepareRebuild(sqlite, reference, table)
      legacyTables.set(table, legacy)
      copySharedColumns(sqlite, table, legacy)
    }
    tombstoneMigratedLegacyTaskWaits(sqlite)
    createCurrentTrigger(sqlite, reference, "engine_task_root_ingress_no_update")
    if (!exists(sqlite, "automation_fire")) createCurrentTable(sqlite, reference, "automation_fire")
    migrateLegacyAutomationFires(sqlite)
    for (const table of ["automation_run", "automation_run_receipt"] as const) {
      const legacy = prepareRebuild(sqlite, reference, table)
      legacyTables.set(table, legacy)
      copySharedColumns(sqlite, table, legacy)
    }
    for (const table of REBUILT_TABLES.toReversed()) {
      const legacy = legacyTables.get(table)
      if (legacy && exists(sqlite, legacy)) sqlite.exec(`DROP TABLE ${quote(legacy)}`)
    }
    const violation = rows<Record<string, unknown>>(sqlite, "PRAGMA foreign_key_check")[0]
    if (violation) {
      throw new SchedulingOccurrenceMigrationError(
        `Scheduling occurrence migration left a foreign-key violation: ${JSON.stringify(violation)}`,
        "foreign_key_violation",
      )
    }
    sqlite.exec("COMMIT")
    return true
  } catch (error) {
    sqlite.exec("ROLLBACK")
    throw error
  } finally {
    reference.close(true)
    sqlite.exec(`PRAGMA legacy_alter_table=${legacyAlterTable ? "ON" : "OFF"}`)
  }
}
