import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { Database } from "bun:sqlite"
import { ProjectRuntimePaths } from "../packages/opencorvus/src/project/runtime-paths"
import { completedToolOutcomeOutput } from "../packages/opencorvus/src/session/tool-outcome-facts"
import { CredentialRedactor } from "../packages/opencorvus/script/real-provider-audit"
const root = path.join(import.meta.dir, "live-attempt-01")
const mode = process.argv[2]
assert(mode === "observe" || mode === "check")
const owner = JSON.parse(await fs.readFile(path.join(root, "provider-run/launch-owner.json"), "utf8"))
const accepted = JSON.parse(await fs.readFile(path.join(root, "task-accepted.json"), "utf8"))
const sent = JSON.parse(await fs.readFile(path.join(root, "task-sent.json"), "utf8"))
const expected = JSON.parse(await fs.readFile(path.join(root, "public-results.json"), "utf8"))
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile(path.join(owner.runtime, "data/auth.json"), "utf8")))
const response = await fetch(`http://127.0.0.1:18506/task/${accepted.accepted.task_id}/status`, { headers: { "x-opencorvus-directory": owner.project }, signal: AbortSignal.timeout(10000) })
assert.equal(response.status, 200)
const status = await response.json() as any
const require = createRequire(path.join(import.meta.dir, "../packages/opencorvus/package.json"))
const { drizzle } = await import(require.resolve("drizzle-orm/bun-sqlite"))
const db = new Database(path.join(owner.runtime, "data/opencorvus.db"), { readonly: true })
let canonical: any
try {
  db.exec("BEGIN")
  const task = db.query("SELECT * FROM engine_task WHERE id=?").get(accepted.accepted.task_id) as any
  assert.equal(task.project_id, accepted.accepted.project_id)
  assert.equal(task.request_id, sent.requestID)
  const sessions = db.query("WITH RECURSIVE tree(id) AS (SELECT ? UNION ALL SELECT s.id FROM session s JOIN tree t ON s.parent_id=t.id) SELECT s.id,s.parent_id,s.kind,s.directory FROM session s JOIN tree t ON t.id=s.id").all(task.session_id) as any[]
  const outputDB = drizzle({ client: db })
  const tools = sessions.flatMap((session) => db.query("SELECT r.id,r.message_id,r.data,o.data AS outcome_data FROM tool_part_request r LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id JOIN message m ON m.id=r.message_id WHERE m.session_id=? ORDER BY r.time_created,r.id").all(session.id).map((row: any) => {
    const outcome = row.outcome_data ? JSON.parse(row.outcome_data) : null
    return { sessionID: session.id, id: row.id, messageID: row.message_id, request: JSON.parse(row.data), outcome, output: outcome?.outcome === "completed" ? completedToolOutcomeOutput(outputDB as any, outcome, () => row.id) : null }
  }))
  const messages = sessions.flatMap((session) => db.query("SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id").all(session.id).map((row: any) => ({ sessionID: session.id, id: row.id, ...JSON.parse(row.data) })))
  const parts = sessions.flatMap((session) => db.query("SELECT p.id,p.message_id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? ORDER BY p.time_created,p.id").all(session.id).map((row: any) => ({ sessionID: session.id, id: row.id, messageID: row.message_id, ...JSON.parse(row.data) })))
  canonical = { observedAt: new Date().toISOString(), task, status, sessions, messages, parts, tools }
} finally { db.exec("ROLLBACK"); db.close() }
const names = (await fs.readdir(owner.evidence)).filter((name) => /^provider-.*-\d+\.json$/.test(name))
const audits = await Promise.all(names.map(async (name) => ({ name, value: JSON.parse(await fs.readFile(path.join(owner.evidence, name), "utf8")) })))
audits.sort((a, b) => Date.parse(a.value.observedAt) - Date.parse(b.value.observedAt) || Number(a.name.match(/-(\d+)\.json$/)![1]) - Number(b.name.match(/-(\d+)\.json$/)![1]))
const audit = audits.at(-1)!.value
if (mode === "observe") {
  await fs.writeFile(path.join(root, `observation-${Date.now()}.json`), redactor.redact(JSON.stringify({ ...canonical, audit }, null, 2)), { flag: "wx" })
  console.log(redactor.redact(JSON.stringify({ lifecycleStatus: status.lifecycleStatus, status: status.status, sessions: canonical.sessions, tools: canonical.tools.map((tool: any) => ({ tool: tool.request.tool, outcome: tool.outcome?.outcome, metadata: tool.outcome?.metadata, failure: tool.outcome?.failure })), requests: audit.requests.length, remainingMs: owner.nativeDeadlineAt - Date.now() }, null, 2)))
} else {
  assert.equal(status.lifecycleStatus, "completed")
  assert.equal(status.activity.running, 0)
  const find = (field: string, ref: string) => {
    const tool = canonical.tools.find((tool: any) => tool.outcome?.metadata?.[field] === ref)
    assert(tool, `Expected real ${ref}`)
    assert.equal(tool.outcome.outcome, "completed")
    assert.deepEqual(tool.outcome.metadata.mcp_tool_result, { is_error: false })
    return tool
  }
  const small = find("default_mcp_tool_ref", "default/mcp/publicreports/tool/public-summary")
  assert.equal(small.output, JSON.stringify(expected["public-summary"].structuredContent))
  const empty = find("package_mcp_tool_ref", "structured-reports-388/shared/reports/tool/empty-note")
  assert.equal(empty.output, "Public note: available.\n\n\n\n" + JSON.stringify(expected["empty-note"].structuredContent))
  const archive = find("package_mcp_tool_ref", "structured-reports-388/shared/reports/tool/report-archive")
  assert.equal(archive.outcome.metadata.truncated, true)
  const outputPath = archive.outcome.metadata.outputPath
  assert.equal(path.dirname(outputPath), ProjectRuntimePaths.toolOutputDir(owner.project, canonical.task.id, archive.sessionID))
  const stored = await fs.readFile(outputPath)
  assert.deepEqual(stored, await fs.readFile(path.join(root, "archive-output.txt")))
  const reads = canonical.tools.filter((tool: any) => tool.request.tool === "read" && path.resolve(tool.request.input.filePath) === path.resolve(outputPath))
  const read = reads.find((tool: any) => tool.outcome?.outcome === "completed" && tool.output?.includes("IRIS-388-ARCHIVE") && tool.output.includes("2400"))
  assert(read, "Actual read of the saved structured archive must expose requested first fields")
  assert(read.request.time.start >= archive.outcome.time.end)
  const assistants = canonical.messages.filter((message: any) => message.role === "assistant")
  for (const message of assistants) { assert.equal(message.providerID, "openai"); assert.equal(message.modelID, "gpt-6.1-sol"); assert(Number.isFinite(message.time.completed)) }
  const assistantIDs = new Set(assistants.map((message: any) => message.id))
  const reply = canonical.parts.filter((part: any) => part.type === "text" && assistantIDs.has(part.messageID)).map((part: any) => part.text).join("\n")
  for (const text of ["LILY-388-SUMMARY", "7", "Public note: available.", "EMPTY-RESOURCE-IS-VALID", "IRIS-388-ARCHIVE", "2400"]) assert(reply.includes(text), `Visible answer must include ${text}`)
  const terminal = canonical.tools.find((tool: any) => tool.request.tool === "manage_task" && tool.request.input.action === "complete_task" && tool.outcome?.outcome === "completed")
  assert(terminal)
  assert.equal(audit.pid, owner.nativeTarget.pid)
  assert.equal(audit.model, "gpt-6.1-sol")
  assert(audit.requests.length > 0 && audit.requests.length <= 20)
  for (const request of audit.requests) { assert.equal(request.model, "gpt-6.1-sol"); assert.equal(request.streaming, true); assert.equal(request.status, 200); assert.equal(request.response_reader.state, "settled"); assert.equal(request.response_reader.terminal.kind, "eof") }
  assert(Date.now() < owner.nativeDeadlineAt)
  const result = { observedAt: new Date().toISOString(), acceptance: "backend-passed", taskID: canonical.task.id, rootSessionID: canonical.task.session_id, sessions: canonical.sessions, smallPartID: small.id, emptyPartID: empty.id, archivePartID: archive.id, readPartID: read.id, outputPath, archiveBytes: stored.length, exactSavedBody: true, exactTaskSessionDirectory: true, providerRequests: audit.requests.length, allRequestsExactModelStreamingHTTP200EOF: true, nativeDeadlineAt: owner.nativeDeadlineAt, boundary: "Real Task default and package MCP result/read acceptance; desktop and physical shutdown remain separate" }
  for (const [name, value] of [["live-canonical.json", canonical], ["live-provider-audit.json", audit], ["live-check.json", result]]) await fs.writeFile(path.join(root, name as string), redactor.redact(JSON.stringify(value, null, 2)), { flag: "wx" })
  console.log(JSON.stringify(result, null, 2))
}
