import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
const root = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/stream-stop-258-live-01"
const output = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/stream-stop-258/live-01"
const stage = process.argv[2]
if (!stage || !/^[a-z0-9-]+$/.test(stage)) throw Error("Exact current observation label required")
const db = new Database(path.join(root, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const sessions = db.query("SELECT id,project_id,directory,kind,parent_id FROM session ORDER BY time_created,id").all()
  const messages = (db.query("SELECT id,session_id,data FROM message ORDER BY time_created,id").all() as any[]).map(row => {
    const info = JSON.parse(row.data)
    return { id: row.id, sessionID: row.session_id, role: info.role, author: info.author, time: info.time, finish: info.finish, error: info.error, model: info.model, modelID: info.modelID, providerID: info.providerID }
  })
  const parts = (db.query("SELECT id,message_id,data FROM part ORDER BY time_created,id").all() as any[]).map(row => {
    const part = JSON.parse(row.data)
    return { id: row.id, messageID: row.message_id, type: part.type, chars: typeof part.text === "string" ? part.text.length : undefined, time: part.time, ...(part.type === "source-url" ? { title: part.title, url: part.url } : {}) }
  })
  const result = { observedAtUtc: new Date().toISOString(), access: "Actual readonly SQLite BEGIN/ROLLBACK, current canonical metadata only", sessions, messages, parts }
  fs.writeFileSync(path.join(output, stage + "-canonical.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify(result))
} finally { db.exec("ROLLBACK"); db.close() }
