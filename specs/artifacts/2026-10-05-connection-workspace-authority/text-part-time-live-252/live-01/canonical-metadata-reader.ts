import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
import { CredentialRedactor } from "../packages/opencorvus/script/real-provider-audit"

const run = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/text-part-time-live-252-live-01"
const evidence = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/text-part-time-live-252/live-01"
const stage = process.argv[2]
if (stage !== "running" && stage !== "final") throw new Error("Explicit current observation stage required")
const owner = JSON.parse(fs.readFileSync(path.join(run, "launch-owner.json"), "utf8"))
if (path.resolve(owner.runRoot) !== path.resolve(run) || owner.port !== 18186) throw new Error("Exact owned current Run required")
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(fs.readFileSync("C:/Users/hengu/AppData/Local/opencorvus/data/auth.json", "utf8")))
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const sessions = db.query("SELECT id,project_id,directory,kind,parent_id,title FROM session ORDER BY time_created,id").all()
  const messages = (db.query("SELECT id,session_id,data FROM message ORDER BY time_created,id").all() as any[]).map(row => {
    const data = JSON.parse(row.data)
    return { id: row.id, sessionID: row.session_id, role: data.role, model: data.model, providerID: data.providerID, modelID: data.modelID, time: data.time, finish: data.finish, error: data.error }
  })
  const parts = (db.query("SELECT p.id,p.message_id,m.session_id,p.data FROM part p JOIN message m ON m.id=p.message_id ORDER BY p.time_created,p.id").all() as any[]).map(row => {
    const data = JSON.parse(row.data)
    return { id: row.id, messageID: row.message_id, sessionID: row.session_id, type: data.type, textChars: typeof data.text === "string" ? data.text.length : undefined, time: data.time, ...(data.type === "source-url" ? { sourceId: data.sourceId, url: data.url, title: data.title, provider: data.provider } : {}) }
  })
  const requests = db.query("SELECT id,assistant_message_id FROM provider_activity_request ORDER BY time_created,id").all()
  const outcomes = db.query("SELECT id,request_id FROM provider_activity_outcome ORDER BY time_created,id").all()
  const result = { observedAtUtc: new Date().toISOString(), stage, owner: owner.nativeTarget, occurrence: owner.occurrence, access: "Actual owned SQLite readonly BEGIN/ROLLBACK; accepted participant metadata and actual text/source Part clocks; no synthesis or UI assertions", sessions, messages, parts, requests, outcomes }
  fs.writeFileSync(path.join(evidence, `${stage}-canonical-metadata.json`), redactor.redact(JSON.stringify(result, null, 2)) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ observedAtUtc: result.observedAtUtc, stage, sessions, messages, sources: parts.filter(part => part.type === "source-url"), text: parts.filter(part => part.type === "text"), providerRequests: requests.length, providerOutcomes: outcomes.length }))
} finally {
  db.exec("ROLLBACK")
  db.close()
}
