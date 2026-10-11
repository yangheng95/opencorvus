import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
import { InteractiveArtifactPayload } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/interactive-artifact/schema"
import { CredentialRedactor } from "D:/myhexin-local/opencorvus/packages/opencorvus/script/real-provider-audit"
const run = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/diff-review-290-live-01"
const evidence = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/diff-review-290/live-01"
const expected = JSON.parse(fs.readFileSync(path.join(evidence, "expected-git-files.json"), "utf8"))
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(fs.readFileSync("C:/Users/hengu/AppData/Local/opencorvus/data/auth.json", "utf8")))
const text = (value: string) => value.replace(/\r\n?/g, "\n").replace(/\n$/, "")
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const rows = db.query("SELECT a.*,m.session_id FROM interactive_artifact a JOIN message m ON m.id=a.message_id ORDER BY a.time_created,a.id").all() as any[]
  const artifacts = rows.map(row => ({ ...row, payload: InteractiveArtifactPayload.parse(JSON.parse(row.payload)) }))
  const results = artifacts.map(row => ({ id: row.id, messageID: row.message_id, sessionID: row.session_id, renderer: row.payload.renderer, ...(row.payload.renderer === "diff@1" ? { originalLogicalContent: text(row.payload.original) === text(expected.original) ? "equal" : "different", modifiedLogicalContent: text(row.payload.modified) === text(expected.modified) ? "equal" : "different", originalChars: row.payload.original.length, modifiedChars: row.payload.modified.length } : {}) }))
  const messages = db.query("SELECT id,session_id,json_extract(data,'$.role') AS role,json_extract(data,'$.time.completed') AS completed_at,json_extract(data,'$.finish') AS finish FROM message ORDER BY time_created,id").all()
  const tasks = db.query("SELECT id FROM engine_task ORDER BY id").all()
  const result = { observedAtUtc: new Date().toISOString(), results, messages, tasks, boundary: "Actual canonical persisted model-produced artifacts compared to exact existing Git logical text; CRLF form and one terminal newline are not acceptance proxies. Root real UI review remains separate." }
  if (process.argv[2] === "final") {
    fs.writeFileSync(path.join(evidence, "actual-artifacts.json"), redactor.redact(JSON.stringify(artifacts, null, 2)), { flag: "wx" })
    fs.writeFileSync(path.join(evidence, "artifact-content-check.json"), redactor.redact(JSON.stringify(result, null, 2)), { flag: "wx" })
    if (results.length !== 1 || results[0].renderer !== "diff@1" || results[0].originalLogicalContent !== "equal" || results[0].modifiedLogicalContent !== "equal") process.exitCode = 1
  }
  console.log(redactor.redact(JSON.stringify(result)))
} finally { db.exec("ROLLBACK"); db.close() }
