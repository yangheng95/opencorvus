import { Database } from "bun:sqlite"
const sessionID = "ses_h0wiOTw2b6yPztYlG8J4"
const db = new Database("C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/live-sol-publication-50/runtime/data/opencorvus.db", { readonly: true })
try {
  db.exec("BEGIN")
  const messages = db.query(`SELECT id,session_id,time_created,time_updated,json_extract(data,'$.role') role,json_extract(data,'$.parentID') parentID,json_extract(data,'$.time.completed') completed,json_extract(data,'$.finish') finish FROM message WHERE session_id=? ORDER BY time_created,id`).all(sessionID)
  const events = db.query(`SELECT id,type,aggregate_type,aggregate_id,task_id,session_id,emitted_at,payload FROM protocol_event WHERE session_id=? OR (aggregate_type='session' AND aggregate_id=?) ORDER BY emitted_at,id`).all(sessionID,sessionID)
  const owners = db.query("SELECT * FROM session_prompt_owner WHERE session_id=?").all(sessionID)
  console.log(JSON.stringify({ access: "readonly closed original50 database; explicit transaction; exact Session only",sessionID,messages,events,owners },null,2))
  db.exec("ROLLBACK")
} finally { db.close() }
