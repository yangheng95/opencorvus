import { Database } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"

const [root, evidence, evidenceCase] = process.argv.slice(2)
if (!root || !evidence || !/^\d+$/.test(evidenceCase ?? "")) throw new Error("Exact owned root, evidence and case are required")
const owner = JSON.parse(fs.readFileSync(`${root}/launch-owner.json`, "utf8"))
if (path.resolve(root) !== path.resolve(owner.runRoot) || path.resolve(evidence) !== path.resolve(owner.settlementEvidenceRoot)) throw new Error("Readonly measurement must bind exact admitted owned paths")
const selected = JSON.parse(fs.readFileSync(`${root}/task-selection.json`, "utf8"))
if (selected.occurrence !== owner.occurrence) throw new Error("Readonly selection must bind original occurrence")
const db = new Database(`${root}/runtime/data/opencorvus.db`, { readonly: true })
try {
  db.exec("BEGIN")
  const sessions = db.query("SELECT id,project_id,parent_id,directory,title,kind,metadata,time_created,time_updated FROM session ORDER BY time_created").all()
  const messages = db.query("SELECT id,session_id,time_created,time_updated,data FROM message ORDER BY time_created").all()
  const parts = db.query("SELECT id,message_id,time_created,time_updated,data FROM part ORDER BY time_created").all()
  const events = db.query("SELECT * FROM protocol_event WHERE task_id = ? OR (aggregate_type = 'task' AND aggregate_id = ?) ORDER BY emitted_at,id").all(selected.taskID, selected.taskID)
  const owners = db.query("SELECT * FROM session_prompt_owner").all()
  const pending = db.query("SELECT i.* FROM protocol_inbox i LEFT JOIN protocol_delivery_receipt r ON r.inbox_id=i.id WHERE r.id IS NULL").all()
  fs.writeFileSync(`${evidence}/actual-${evidenceCase}-readonly-facts.json`, JSON.stringify({ observedAtUtc: new Date().toISOString(), access: "bun:sqlite readonly after exact native closure; explicit read transaction; own isolated actual sessions only; no product bootstrap", selected, sessions, messages, parts, events, owners, pending }, null, 2), { flag: "wx" })
  db.exec("COMMIT")
  console.log(JSON.stringify({ sessions: sessions.length, messages: messages.length, parts: parts.length, events: events.length, owners: owners.length, pending: pending.length }))
} finally { db.close() }
