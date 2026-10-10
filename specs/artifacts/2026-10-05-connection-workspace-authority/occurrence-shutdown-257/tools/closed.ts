import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
const source = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/occurrence-shutdown-257-live-01"
const output = "D:/myhexin-local/opencorvus/.tmp-product-iteration/occurrence-shutdown-257/closed-protocol.json"
const db = new Database(path.join(source, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const tables = (db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {name:string}[]).map(row => row.name)
  const lifecycle = (db.query("SELECT id,aggregate_type,aggregate_id,session_id,seq,emitted_at,payload FROM protocol_event WHERE type='agent.execution.lifecycle' ORDER BY emitted_at,id").all() as any[]).map(row => ({ ...row, payload: JSON.parse(row.payload) }))
  const sessions = db.query("SELECT id,project_id,kind,directory,parent_id FROM session ORDER BY time_created,id").all()
  const ownershipTables = tables.filter(name => /prompt_owner|task_root_ingress|engine_task$|session_wake|mission_execution/.test(name))
  const counts = ownershipTables.map(name => ({ table: name, rows: db.query(`SELECT COUNT(*) AS count FROM "${name}"`).get() }))
  const observation = { observedAtUtc: new Date().toISOString(), access: "Current 257 physically closed canonical SQLite readonly BEGIN/ROLLBACK; lifecycle facts and ownership counts only", source, sessions, counts, lifecycle }
  fs.writeFileSync(output, JSON.stringify(observation,null,2)+"\n", {flag:"wx"})
  console.log(JSON.stringify({sessions,counts,latest: lifecycle.slice(-9)},null,2))
} finally { db.exec("ROLLBACK"); db.close() }
