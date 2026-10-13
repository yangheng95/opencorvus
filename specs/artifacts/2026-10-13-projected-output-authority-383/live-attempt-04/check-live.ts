import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { Database } from "bun:sqlite"
import { ProjectRuntimePaths } from "../packages/opencorvus/src/project/runtime-paths"
import { completedToolOutcomeOutput } from "../packages/opencorvus/src/session/tool-outcome-facts"
import { CredentialRedactor } from "../packages/opencorvus/script/real-provider-audit"

assert(["live-attempt-03", "live-attempt-04"].includes(process.argv[2]!))
const sourceRoot = import.meta.dir
const root = path.join(sourceRoot, process.argv[2])
const owner = JSON.parse(await fs.readFile(path.join(root, "provider-run/launch-owner.json"), "utf8"))
const accepted = JSON.parse(await fs.readFile(path.join(root, "task-accepted.json"), "utf8"))
const sent = JSON.parse(await fs.readFile(path.join(root, "task-sent.json"), "utf8"))
const imported = JSON.parse(await fs.readFile(path.join(root, "package-import-receipt-02.json"), "utf8"))
const expected = await fs.readFile(path.join(sourceRoot, "public-report.txt"))
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile(path.join(owner.runtime, "data/auth.json"), "utf8")))
const response = await fetch(`http://127.0.0.1:18502/task/${accepted.accepted.task_id}/status`, { headers: { "x-opencorvus-directory": owner.project }, signal: AbortSignal.timeout(10000) })
assert.equal(response.status, 200)
const status = await response.json() as any
assert.equal(status.lifecycleStatus, "completed")
assert.equal(status.activity.running, 0)
const productionRequire = createRequire(path.resolve(sourceRoot, "../packages/opencorvus/package.json"))
const { drizzle } = await import(productionRequire.resolve("drizzle-orm/bun-sqlite"))
const db = new Database(path.join(owner.runtime, "data/opencorvus.db"), { readonly: true })
let canonical: any
try {
  db.exec("BEGIN")
  const task = db.query("SELECT * FROM engine_task WHERE id=?").get(accepted.accepted.task_id) as any
  assert.equal(task.project_id, accepted.accepted.project_id)
  assert.equal(task.request_id, sent.requestID)
  assert.equal(task.request.trim(), sent.request.trim())
  const sessions = db.query("WITH RECURSIVE tree(id) AS (SELECT ? UNION ALL SELECT s.id FROM session s JOIN tree t ON s.parent_id=t.id) SELECT s.id,s.parent_id,s.kind,s.directory FROM session s JOIN tree t ON t.id=s.id").all(task.session_id) as any[]
  const outputDB = drizzle({ client: db })
  const tools = sessions.flatMap((session) => db.query("SELECT r.id,r.message_id,r.data,o.data AS outcome_data FROM tool_part_request r JOIN tool_part_outcome o ON o.request_part_id=r.id JOIN message m ON m.id=r.message_id WHERE m.session_id=? ORDER BY r.time_created,r.id").all(session.id).map((row: any) => {
    const outcome = JSON.parse(row.outcome_data)
    return { sessionID: session.id, id: row.id, messageID: row.message_id, request: JSON.parse(row.data), outcome,
      output: outcome.outcome === "completed" ? completedToolOutcomeOutput(outputDB as any, outcome, () => row.id) : null }
  }))
  const messages = sessions.flatMap((session) => db.query("SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id").all(session.id).map((row: any) => ({ sessionID: session.id, id: row.id, ...JSON.parse(row.data) })))
  const parts = sessions.flatMap((session) => db.query("SELECT p.id,p.message_id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? ORDER BY p.time_created,p.id").all(session.id).map((row: any) => ({ sessionID: session.id, id: row.id, messageID: row.message_id, ...JSON.parse(row.data) })))
  const reportCalls = tools.filter((tool) => tool.outcome.metadata?.package_tool_ref === "projected-report-383/shared/load-public-report")
  assert.equal(reportCalls.length, 1)
  const report = reportCalls[0]!
  assert.equal(report.outcome.outcome, "completed")
  assert.equal(report.outcome.metadata.expert_squad_id, "projected-report-383")
  assert.equal(report.outcome.metadata.truncated, true)
  const outputPath = report.outcome.metadata.outputPath
  assert.equal(path.dirname(outputPath), ProjectRuntimePaths.toolOutputDir(owner.project, task.id, report.sessionID))
  const stored = await fs.readFile(outputPath)
  assert.deepEqual(stored, expected)
  assert.equal(stored.length, 96717)
  assert(report.output.includes(`Full output saved to: ${outputPath}`))
  assert(report.output.includes("TOTAL DATA ROWS: 2100"))
  const reads = tools.filter((tool) => tool.request.tool === "read" && path.resolve(tool.request.input.filePath) === path.resolve(outputPath))
  assert(reads.length >= 1)
  const firstPage = reads.find((tool) => tool.output?.includes("PUBLIC REVIEW CODE: ORCHID-383-ALPHA"))
  assert(firstPage)
  assert.equal(firstPage.outcome.outcome, "completed")
  assert(firstPage.request.time.start >= report.outcome.time.end)
  const searches = tools.filter((tool) => tool.request.tool === "capability_search")
  assert(searches.length >= 1)
  for (const search of searches) {
    assert.equal(search.outcome.outcome, "completed")
    assert.equal(typeof search.request.metadata.openai.itemId, "string")
    assert.equal(typeof search.outcome.metadata.opencorvus_capability_reveal_v2.revision, "number")
  }
  const terminal = tools.filter((tool) => tool.request.tool === "manage_task" && tool.request.input.action === "complete_task")
  assert.equal(terminal.length, 1)
  assert.equal(terminal[0].outcome.outcome, "completed")
  assert.equal(terminal[0].outcome.metadata.opencorvusToolResultControl.kind, "immediate_park")
  const assistants = messages.filter((message) => message.role === "assistant")
  for (const message of assistants) {
    assert.equal(message.providerID, "openai")
    assert.equal(message.modelID, "gpt-6.1-sol")
    assert(Number.isFinite(message.time.completed))
  }
  const assistantIDs = new Set(assistants.map((message) => message.id))
  const reply = parts.filter((part) => assistantIDs.has(part.messageID) && part.type === "text").map((part) => part.text).join("\n")
  assert(reply.includes("ORCHID-383-ALPHA") && reply.includes("2100"))
  canonical = { status, task, sessions, messages, parts, tools, observation: {
    reportToolPartID: report.id, reportSessionID: report.sessionID, outputPath, fullOutputBytes: stored.length,
    exactSavedBody: true, exactTaskSessionDirectory: true, readToolPartIDs: reads.map((tool) => tool.id),
    firstPageReadPartID: firstPage.id, completedMetadataSearchParts: searches.map((tool) => tool.id),
    completionPartID: terminal[0].id, packageDigest: imported.result.after.packageDigest,
  } }
} finally { db.exec("ROLLBACK"); db.close() }
const names = (await fs.readdir(owner.evidence)).filter((name) => /^provider-.*-\d+\.json$/.test(name))
const audits = await Promise.all(names.map(async (name) => ({ name, value: JSON.parse(await fs.readFile(path.join(owner.evidence, name), "utf8")) })))
audits.sort((a, b) => Date.parse(a.value.observedAt) - Date.parse(b.value.observedAt) || Number(a.name.match(/-(\d+)\.json$/)![1]) - Number(b.name.match(/-(\d+)\.json$/)![1]))
const audit = audits.at(-1)!.value
assert.equal(audit.pid, owner.nativeTarget.pid)
assert.equal(audit.model, "gpt-6.1-sol")
assert(audit.requests.length > 0 && audit.requests.length <= 16)
assert.equal(audit.exhausted, false)
for (const request of audit.requests) {
  assert.equal(request.model, "gpt-6.1-sol")
  assert.equal(request.streaming, true)
  assert.equal(request.status, 200)
  assert.equal(request.response_reader.state, "settled")
  assert.equal(request.response_reader.terminal.kind, "eof")
}
assert(Date.now() < owner.nativeDeadlineAt)
const result = { observedAt: new Date().toISOString(), acceptance: "backend-passed", taskID: canonical.task.id,
  lifecycleStatus: canonical.status.lifecycleStatus, ...canonical.observation, providerRequests: audit.requests.length,
  allRequestsExactModelStreamingHTTP200EOF: true, nativeDeadlineAt: owner.nativeDeadlineAt,
  boundary: "Real Task and package Tool/read CAS acceptance; desktop review and exact native shutdown remain separate" }
for (const [name, value] of [["live-canonical.json", canonical], ["live-provider-audit.json", audit], ["live-check.json", result]] as const)
  await fs.writeFile(path.join(root, name), redactor.redact(JSON.stringify(value, null, 2)) + "\n", { flag: "wx" })
console.log(JSON.stringify(result, null, 2))
