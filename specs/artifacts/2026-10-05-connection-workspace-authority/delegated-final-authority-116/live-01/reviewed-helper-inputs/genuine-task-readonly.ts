import { Database } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"
import { normalizeToolResult } from "../packages/opencorvus/src/session/tool-result-normalization"

const [root, evidence, evidenceCase, mode] = process.argv.slice(2)
if (mode !== undefined && mode !== "tools") throw new Error("Unknown readonly measurement mode")
if (!root || !evidence || !/^\d+$/.test(evidenceCase ?? "")) throw new Error("Exact owned root, evidence and case are required")
const owner = JSON.parse(fs.readFileSync(`${root}/launch-owner.json`, "utf8"))
if (path.resolve(root) !== path.resolve(owner.runRoot) || path.resolve(evidence) !== path.resolve(owner.settlementEvidenceRoot)) throw new Error("Readonly measurement must bind exact admitted owned paths")
const selected = JSON.parse(fs.readFileSync(`${root}/task-selection.json`, "utf8"))
if (selected.occurrence !== owner.occurrence) throw new Error("Readonly selection must bind original occurrence")
const db = new Database(`${root}/runtime/data/opencorvus.db`, { readonly: true })
try {
  db.exec("BEGIN")
  if (mode === "tools") {
    const requests = db.query("WITH RECURSIVE task_sessions(id) AS (SELECT session_id FROM engine_task WHERE id = ? UNION ALL SELECT s.id FROM session s JOIN task_sessions p ON s.parent_id=p.id) SELECT r.*,m.session_id,s.project_id,s.kind FROM tool_part_request r JOIN message m ON m.id=r.message_id JOIN session s ON s.id=m.session_id JOIN task_sessions ts ON ts.id=s.id ORDER BY r.time_created,r.id").all(selected.taskID)
    const scopedIDs = new Set(requests.map((row: any) => row.id))
    const progress = db.query("SELECT * FROM tool_part_progress ORDER BY time_created,id").all().filter((row: any) => scopedIDs.has(row.request_part_id))
    const outcomes = db.query("SELECT * FROM tool_part_outcome ORDER BY time_created,id").all().filter((row: any) => scopedIDs.has(row.request_part_id))
    const results = outcomes.map((row: any) => {
      const outcome = JSON.parse(row.data)
      if (!outcome.resultAttemptID) return { outcomeID: row.id, requestID: row.request_part_id, output: outcome.output }
      const stored = db.query("SELECT * FROM permission_execution_result WHERE attempt_id = ?").get(outcome.resultAttemptID) as any
      if (!stored) throw new Error(`Missing actual durable result ${outcome.resultAttemptID}`)
      const envelope = JSON.parse(stored.result)
      if (envelope.kind !== "json" && envelope.kind !== "undefined") throw new Error("Invalid actual durable result envelope")
      return { outcomeID: row.id, requestID: row.request_part_id, stored, output: envelope.kind === "undefined" ? "" : normalizeToolResult(envelope.value).output }
    })
    fs.writeFileSync(`${evidence}/actual-${evidenceCase}-readonly-tool-facts.json`, JSON.stringify({ observedAtUtc: new Date().toISOString(), access: "same isolated readonly transaction after exact native closure; exact Task Session lineage; raw canonical facts and production-normalized durable outputs", selected, requests, progress, outcomes, results }, null, 2), { flag: "wx" })
    db.exec("COMMIT")
    console.log(JSON.stringify({ requests: requests.length, progress: progress.length, outcomes: outcomes.length, results: results.length }))
  } else {
  const sessions = db.query("SELECT id,project_id,parent_id,directory,title,kind,metadata,time_created,time_updated FROM session ORDER BY time_created").all()
  const messages = db.query("SELECT id,session_id,time_created,time_updated,data FROM message ORDER BY time_created").all()
  const parts = db.query("SELECT id,message_id,time_created,time_updated,data FROM part ORDER BY time_created").all()
  const events = db.query("SELECT * FROM protocol_event WHERE task_id = ? OR (aggregate_type = 'task' AND aggregate_id = ?) ORDER BY emitted_at,id").all(selected.taskID, selected.taskID)
  const owners = db.query("SELECT * FROM session_prompt_owner").all()
  const pending = db.query("SELECT i.* FROM protocol_inbox i LEFT JOIN protocol_delivery_receipt r ON r.inbox_id=i.id WHERE r.id IS NULL").all()
  fs.writeFileSync(`${evidence}/actual-${evidenceCase}-readonly-facts.json`, JSON.stringify({ observedAtUtc: new Date().toISOString(), access: "bun:sqlite readonly after exact native closure; explicit read transaction; own isolated actual sessions only; no product bootstrap", selected, sessions, messages, parts, events, owners, pending }, null, 2), { flag: "wx" })
  db.exec("COMMIT")
  console.log(JSON.stringify({ sessions: sessions.length, messages: messages.length, parts: parts.length, events: events.length, owners: owners.length, pending: pending.length }))
  }
} finally { db.close() }
