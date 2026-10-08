import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"

const run = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-09/settlement-sources-192-01"
const evidence = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/settlement-sources-192/live-01"
const owner = JSON.parse(fs.readFileSync(path.join(run, "launch-owner.json"), "utf8"))
const physical = JSON.parse(fs.readFileSync(path.join(evidence, `${owner.evidencePrefix}-physical-terminal-and-pair-cleanup.json`), "utf8"))
if (physical.occurrence !== owner.occurrence || !physical.physicalCompletion || !physical.pairedCleanupComplete) throw Error("Exact closed owned history required")
const preflight = JSON.parse(fs.readFileSync(path.join(run, "evidence/preflight-ready.json"), "utf8"))
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
db.exec("BEGIN")
try {
  const rows = db.query("SELECT p.id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? AND json_extract(p.data,'$.type') IN ('source-url','tool') ORDER BY p.time_created,p.id").all(preflight.preflight.sessionID) as {id: string; data: string}[]
  const sources = rows.flatMap(row => {
    const p = JSON.parse(row.data)
    return p.type === "source-url" ? [{ partID: row.id, title: p.title, snippetLength: p.snippet?.length ?? 0, snippetStart: p.snippet?.slice(0, 500), provider: p.provider }] : []
  })
  const tools = rows.flatMap(row => {
    const p = JSON.parse(row.data)
    return p.type === "tool" && ["websearch", "webfetch"].includes(p.tool) ? [{partID: row.id, tool: p.tool, status: p.state?.status, outputStart: p.state?.output?.slice(0, 700)}] : []
  })
  const observed = { observedAtUtc: new Date().toISOString(), occurrence: owner.occurrence, sessionID: preflight.preflight.sessionID, access: "readonly exact closed ordinary Session BEGIN/ROLLBACK", sources, tools, boundary: "Persisted Source payload observation only; no UI test or producer upstream capture" }
  fs.writeFileSync(path.join(evidence, "persisted-source-snippet-observation.json"), JSON.stringify(observed, null, 2), {flag: "wx"})
  console.log(JSON.stringify({sourceCount: sources.length, tools: tools.map(t=>({tool:t.tool,status:t.status})), firstSnippet: sources[0]?.snippetStart}))
} finally {
  db.exec("ROLLBACK")
  db.close()
}
