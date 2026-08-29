import { Database as SQLite } from "bun:sqlite"
import { Identifier } from "@/id/id"

type RawDatabase = SQLite

function rows<T>(db: RawDatabase, sql: string): T[] {
  const statement = db.query(sql)
  try {
    return statement.all() as T[]
  } finally {
    statement.finalize()
  }
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function tableExists(db: RawDatabase, name: string): boolean {
  return Boolean(rows(db, `SELECT name FROM sqlite_schema WHERE type='table' AND name=${literal(name)}`)[0])
}

/** Append-only provenance authority for the pre-provenance Mission closure
 * schema. The legacy lifecycle rows stay byte-for-byte immutable. */
export function migrateMissionClosureCancellationProvenance(sqlite: RawDatabase): number {
  if (!tableExists(sqlite, "protocol_event")) return 0
  sqlite.exec("BEGIN IMMEDIATE")
  try {
    let appended = 0
    const legacyRows = rows<{
      id: string
      type: string
      aggregate_type: string
      aggregate_id: string
      session_id: string | null
      source: string
      correlation_id: string | null
      emitted_at: number
      payload: string
    }>(sqlite, `
      SELECT id,type,aggregate_type,aggregate_id,session_id,source,correlation_id,emitted_at,payload
      FROM protocol_event
      WHERE type IN ('mission.execution.closing','mission.execution.closed')
        AND json_type(payload,'$.cancellation') IS NULL
      ORDER BY aggregate_id,seq,id
    `)
    for (const row of legacyRows) {
      if (row.aggregate_type !== "session" || row.session_id !== null || !row.correlation_id) {
        throw new Error(`Historical Mission closure event ${row.id} has invalid envelope identity`)
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.correlation_id)) {
        throw new Error(`Historical Mission closure event ${row.id} has invalid operation identity`)
      }
      if (!["mission.abort", "mission.archive", "mission.delete"].includes(row.source)) {
        throw new Error(`Historical Mission closure event ${row.id} has invalid operator source ${row.source}`)
      }
      const payload = JSON.parse(row.payload) as Record<string, unknown>
      if (
        Object.keys(payload).toSorted().join("\0") !== "missionID\0requestID" ||
        typeof payload.missionID !== "string" ||
        !payload.missionID ||
        typeof payload.requestID !== "string" ||
        !payload.requestID
      ) {
        throw new Error(`Historical Mission closure event ${row.id} has an invalid baseline payload`)
      }
      const type = row.type === "mission.execution.closing"
        ? "mission.execution.cancellation_provenance.required"
        : "mission.execution.cancellation_provenance.unavailable_terminal"
      const id = Identifier.deterministic("protocol_event", `mission-closure-provenance-boundary\0${row.id}`)
      const authorityPayload = JSON.stringify({
        version: 1,
        missionID: payload.missionID,
        requestID: payload.requestID,
        requiredSource: row.source,
      })
      const existing = rows<{
        type: string
        aggregate_id: string
        source: string
        causation_id: string | null
        correlation_id: string | null
        payload: string
      }>(sqlite, `SELECT type,aggregate_id,source,causation_id,correlation_id,payload FROM protocol_event WHERE id=${literal(id)}`)[0]
      if (existing) {
        if (
          existing.type !== type ||
          existing.aggregate_id !== row.aggregate_id ||
          existing.source !== "storage.mission-closure-provenance-migration" ||
          existing.causation_id !== row.id ||
          existing.correlation_id !== row.correlation_id ||
          existing.payload !== authorityPayload
        ) {
          throw new Error(`Mission closure provenance authority ${id} conflicts with its historical boundary`)
        }
        continue
      }
      const seq = rows<{ seq: number }>(sqlite, `
        SELECT coalesce(max(seq),0)+1 AS seq FROM protocol_event
        WHERE aggregate_type='session' AND aggregate_id=${literal(row.aggregate_id)}
      `)[0]?.seq ?? 1
      sqlite.query(`
        INSERT INTO protocol_event(
          id,kind,type,aggregate_type,aggregate_id,task_id,session_id,source,
          causation_id,correlation_id,seq,emitted_at,payload
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        id,
        "event",
        type,
        "session",
        row.aggregate_id,
        null,
        null,
        "storage.mission-closure-provenance-migration",
        row.id,
        row.correlation_id,
        seq,
        row.emitted_at,
        authorityPayload,
      )
      appended += 1
    }
    sqlite.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS protocol_event_mission_closure_provenance_boundary_idx
      ON protocol_event(causation_id)
      WHERE type IN (
        'mission.execution.cancellation_provenance.required',
        'mission.execution.cancellation_provenance.unavailable_terminal'
      );
      CREATE UNIQUE INDEX IF NOT EXISTS protocol_event_mission_closure_provenance_supplied_idx
      ON protocol_event(aggregate_id,correlation_id)
      WHERE type='mission.execution.cancellation_provenance.supplied';
    `)
    sqlite.exec("COMMIT")
    return appended
  } catch (error) {
    sqlite.exec("ROLLBACK")
    throw error
  }
}
