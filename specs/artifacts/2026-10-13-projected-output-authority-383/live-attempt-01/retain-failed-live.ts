import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { Database } from "bun:sqlite"
import { completedToolOutcomeOutput } from "../packages/opencorvus/src/session/tool-outcome-facts"
import { CredentialRedactor } from "../packages/opencorvus/script/real-provider-audit"
const root = import.meta.dir
const owner = JSON.parse(await fs.readFile(path.join(root, "provider-run/launch-owner.json"), "utf8"))
const accepted = JSON.parse(await fs.readFile(path.join(root, "task-accepted.json"), "utf8"))
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile(path.join(owner.runtime, "data/auth.json"), "utf8")))
const productionRequire = createRequire(path.resolve(root, "../packages/opencorvus/package.json"))
const { drizzle } = await import(productionRequire.resolve("drizzle-orm/bun-sqlite"))
const response = await fetch(`http://127.0.0.1:18502/task/${accepted.accepted.task_id}/status`, { headers: { "x-opencorvus-directory": owner.project }, signal: AbortSignal.timeout(10000) })
assert.equal(response.status, 200)
const status = await response.json() as any
assert.equal(status.lifecycleStatus, "failed")
const db = new Database(path.join(owner.runtime, "data/opencorvus.db"), { readonly: true })
let canonical: any
try {
  db.exec("BEGIN")
  const task = db.query("SELECT * FROM engine_task WHERE id=?").get(accepted.accepted.task_id) as any
  assert.equal(task.project_id, accepted.accepted.project_id)
  const sessions = db.query("WITH RECURSIVE tree(id) AS (SELECT ? UNION ALL SELECT s.id FROM session s JOIN tree t ON s.parent_id=t.id) SELECT s.id,s.parent_id,s.kind FROM session s JOIN tree t ON t.id=s.id").all(task.session_id) as any[]
  const outputDB = drizzle({ client: db })
  const tools = sessions.flatMap((session) => db.query("SELECT r.id,r.message_id,r.data,o.data AS outcome_data FROM tool_part_request r LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id JOIN message m ON m.id=r.message_id WHERE m.session_id=? ORDER BY r.time_created,r.id").all(session.id).map((row: any) => {
    const outcome = row.outcome_data ? JSON.parse(row.outcome_data) : null
    return { sessionID: session.id, id: row.id, messageID: row.message_id, request: JSON.parse(row.data), outcome,
      output: outcome?.outcome === "completed" ? completedToolOutcomeOutput(outputDB as any, outcome, () => row.id) : null }
  }))
  const messages = sessions.flatMap((session) => db.query("SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id").all(session.id).map((row: any) => ({ sessionID: session.id, id: row.id, ...JSON.parse(row.data) })))
  const parts = sessions.flatMap((session) => db.query("SELECT p.id,p.message_id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? ORDER BY p.time_created,p.id").all(session.id).map((row: any) => ({ sessionID: session.id, id: row.id, messageID: row.message_id, ...JSON.parse(row.data) })))
  const failures = tools.filter((tool) => tool.request.tool === "capability_search" && tool.outcome?.outcome === "failed")
  assert.equal(failures.length, 4)
  assert.equal(new Set(failures.map((tool) => tool.sessionID)).size, 2)
  for (const tool of failures) {
    assert.equal(tool.outcome.failure.name, "HostProcessingFaultError")
    assert(tool.outcome.failure.message.includes("metadata: stored="))
    assert(tool.outcome.failure.message.includes("received=undefined"))
  }
  const terminal = tools.filter((tool) => tool.request.tool === "manage_task" && tool.request.input.action === "fail_task")
  assert.equal(terminal.length, 1)
  assert.equal(terminal[0].outcome.outcome, "completed")
  assert.equal(terminal[0].outcome.metadata.opencorvusToolResultControl.kind, "immediate_park")
  for (const message of messages.filter((message) => message.role === "assistant")) {
    assert.equal(message.providerID, "openai")
    assert.equal(message.modelID, "gpt-6.1-sol")
    assert(Number.isFinite(message.time.completed))
  }
  canonical = { status, task, sessions, messages, parts, tools }
} finally { db.exec("ROLLBACK"); db.close() }
const auditNames = (await fs.readdir(owner.evidence)).filter((name) => /^provider-.*-\d+\.json$/.test(name))
const audits = await Promise.all(auditNames.map(async (name) => ({ name, value: JSON.parse(await fs.readFile(path.join(owner.evidence, name), "utf8")) })))
audits.sort((a, b) => Date.parse(a.value.observedAt) - Date.parse(b.value.observedAt) || Number(a.name.match(/-(\d+)\.json$/)![1]) - Number(b.name.match(/-(\d+)\.json$/)![1]))
const audit = audits.at(-1)!.value
assert.equal(audit.pid, owner.nativeTarget.pid)
assert.equal(audit.model, "gpt-6.1-sol")
assert.equal(audit.requests.length, 15)
assert.equal(audit.exhausted, false)
for (const request of audit.requests) {
  assert.equal(request.model, "gpt-6.1-sol")
  assert.equal(request.streaming, true)
  assert.equal(request.status, 200)
  assert.equal(request.response_reader.state, "settled")
  assert.equal(request.response_reader.terminal.kind, "eof")
}
const failure = { observedAt: new Date().toISOString(), acceptance: "not-achieved", taskID: canonical.task.id, lifecycleStatus: canonical.status.lifecycleStatus,
  causeObserved: "Four capability_search request metadata conflicts in orchestrator and worker; deeper shared root cause delegated to main audit",
  failedToolParts: canonical.tools.filter((tool: any) => tool.outcome?.outcome === "failed").map((tool: any) => ({ sessionID: tool.sessionID, id: tool.id, failure: tool.outcome.failure })),
  requestedOutputVerification: "Not reached: projected report result and read continuation were not produced",
  providerRequests: audit.requests.length, allRequestsExactModelStreamingHTTP200EOF: true,
  naturalTerminal: "Model invoked real manage_task fail_task; completed outcome and immediate_park persisted", nativeDeadlineAt: owner.nativeDeadlineAt,
  boundary: "Evidence collector succeeded; the requested 383 real model acceptance failed. Native physical closure and desktop review remain separate." }
for (const [name, value] of [["live-failed-canonical.json", canonical], ["live-failed-provider-audit.json", audit], ["live-check-failed.json", failure]] as const)
  await fs.writeFile(path.join(root, name), redactor.redact(JSON.stringify(value, null, 2)) + "\n", { flag: "wx" })
console.log(JSON.stringify({ acceptance: failure.acceptance, taskID: failure.taskID, lifecycleStatus: failure.lifecycleStatus, failedToolParts: failure.failedToolParts.length, providerRequests: failure.providerRequests, allRequestsExactModelStreamingHTTP200EOF: true }))
