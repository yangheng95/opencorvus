import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
import { CredentialRedactor } from "../../packages/opencorvus/script/real-provider-audit"
const run = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/side-source-269-live-01"
const evidence = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/side-source-269/live-01"
const phase = process.argv[2]
if (!phase || !/^[a-z0-9-]+$/.test(phase)) throw Error("Exact owned observation phase required")
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(fs.readFileSync("C:/Users/hengu/AppData/Local/opencorvus/data/auth.json", "utf8")))
const owner = JSON.parse(fs.readFileSync(path.join(run, "launch-owner.json"), "utf8"))
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
let result: unknown
try {
  db.exec("BEGIN")
  result = {
    observedAtUtc: new Date().toISOString(), occurrence: owner.occurrence,
    sessions: db.query("SELECT id,project_id,directory,kind,parent_id,metadata FROM session ORDER BY time_created,id").all(),
    messages: (db.query("SELECT id,session_id,data FROM message ORDER BY time_created,id").all() as any[])
      .map(row => ({ id: row.id, sessionID: row.session_id, data: JSON.parse(row.data) })),
    parts: (db.query("SELECT id,message_id,data FROM part ORDER BY time_created,id").all() as any[])
      .map(row => ({ id: row.id, messageID: row.message_id, data: JSON.parse(row.data) })),
    access: "Actual owned canonical readonly BEGIN/ROLLBACK; no synthetic messages, mutation, UI assertions or completeness inference",
  }
} finally { db.exec("ROLLBACK"); db.close() }
fs.writeFileSync(path.join(evidence, `canonical-${phase}.json`), redactor.redact(JSON.stringify(result, null, 2))+"\n", { flag: "wx" })
console.log(JSON.stringify({ phase, captured: true }))
