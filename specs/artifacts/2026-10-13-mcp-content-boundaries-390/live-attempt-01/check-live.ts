import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { Database } from "bun:sqlite"
import { ProjectRuntimePaths } from "../packages/opencorvus/src/project/runtime-paths"
import { completedToolExecutionResult } from "../packages/opencorvus/src/session/tool-outcome-facts"
import { projectToolPartInTransaction } from "../packages/opencorvus/src/session/tool-part-facts"
import { ToolPartRequestTable } from "../packages/opencorvus/src/session/session.sql"
import { attachmentNameFromUrl } from "../packages/opencorvus/src/storage/attachment-reference"
import { CredentialRedactor } from "../packages/opencorvus/script/real-provider-audit"
const root = path.join(import.meta.dir, "live-attempt-01")
const mode = process.argv[2]
assert(mode === "observe" || mode === "check")
const json = async (name: string) => JSON.parse(await fs.readFile(path.join(root, name), "utf8"))
const owner = await json("provider-run/launch-owner.json")
const accepted = await json("task-accepted.json")
const sent = await json("task-sent.json")
const expected = await json("public-results.json")
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile(path.join(owner.runtime, "data/auth.json"), "utf8")))
const response = await fetch(`http://127.0.0.1:18506/task/${accepted.accepted.task_id}/status`, { headers: { "x-opencorvus-directory": owner.project }, signal: AbortSignal.timeout(10000) })
assert.equal(response.status, 200)
const status = await response.json() as any
const require = createRequire(path.join(import.meta.dir, "../packages/opencorvus/package.json"))
const { drizzle } = await import(require.resolve("drizzle-orm/bun-sqlite"))
const dbPath = path.join(owner.runtime, "data/opencorvus.db")
const db = new Database(dbPath, { readonly: true })
let canonical: any
try {
  db.exec("BEGIN")
  const task = db.query("SELECT * FROM engine_task WHERE id=?").get(accepted.accepted.task_id) as any
  assert.equal(task.project_id, accepted.accepted.project_id)
  assert.equal(task.request_id, sent.requestID)
  const sessions = db.query("WITH RECURSIVE tree(id) AS (SELECT ? UNION ALL SELECT s.id FROM session s JOIN tree t ON s.parent_id=t.id) SELECT s.id,s.parent_id,s.kind,s.directory FROM session s JOIN tree t ON t.id=s.id").all(task.session_id) as any[]
  const outputDB = drizzle({ client: db })
  const messages = sessions.flatMap((session) => db.query("SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id").all(session.id).map((row: any) => ({ sessionID: session.id, id: row.id, ...JSON.parse(row.data) })))
  const messageIDs = new Set(messages.map((message: any) => message.id))
  const tools = outputDB.select().from(ToolPartRequestTable).all().filter((row: any) => messageIDs.has(row.message_id)).map((row: any) => {
    const part = projectToolPartInTransaction(outputDB as any, row)!
    const isMcp = part.state.metadata?.package_mcp_tool_ref || part.state.metadata?.default_mcp_tool_ref
    const receipt = part.state.status === "completed" && isMcp ? completedToolExecutionResult(outputDB as any, part) : undefined
    return { part, receipt }
  })
  const parts = sessions.flatMap((session) => db.query("SELECT p.id,p.message_id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? ORDER BY p.time_created,p.id").all(session.id).map((row: any) => ({ sessionID: session.id, id: row.id, messageID: row.message_id, ...JSON.parse(row.data) })))
  canonical = { observedAt: new Date().toISOString(), task, status, sessions, messages, parts, tools }
} finally { db.exec("ROLLBACK"); db.close() }
const names = (await fs.readdir(owner.evidence)).filter((name) => /^provider-.*-\d+\.json$/.test(name))
const audits = await Promise.all(names.map(async (name) => ({ name, value: JSON.parse(await fs.readFile(path.join(owner.evidence, name), "utf8")) })))
audits.sort((a, b) => Date.parse(a.value.observedAt) - Date.parse(b.value.observedAt) || Number(a.name.match(/-(\d+)\.json$/)![1]) - Number(b.name.match(/-(\d+)\.json$/)![1]))
const audit = audits.at(-1)!.value
if (mode === "observe") {
  await fs.writeFile(path.join(root, `observation-${Date.now()}.json`), redactor.redact(JSON.stringify({ ...canonical, audit }, null, 2)), { flag: "wx" })
  console.log(redactor.redact(JSON.stringify({ lifecycleStatus: status.lifecycleStatus, status: status.status, sessions: canonical.sessions, tools: canonical.tools.map(({part}: any) => ({ tool: part.tool, state: part.state.status, outputLength: part.state.output?.length, failure: part.state.failure })), requests: audit.requests.length, remainingMs: owner.nativeDeadlineAt - Date.now() }, null, 2)))
} else {
  assert.equal(status.lifecycleStatus, "completed")
  assert.equal(status.activity.running, 0)
  const find = (field: string, ref: string, expectedKey: string) => {
    const matches = canonical.tools.filter(({part}: any) => part.state.metadata?.[field] === ref)
    assert.equal(matches.length, 1, `Expected exactly one actual ${ref}`)
    const {part,receipt} = matches[0]
    assert.equal(part.state.status, "completed")
    assert.deepEqual(part.state.metadata.mcp_tool_result, { is_error: false })
    assert(receipt, "Exact successful durable Permission result must exist")
    assert.equal(receipt.projectID, canonical.task.project_id)
    assert.deepEqual(receipt.value.content, expected[expectedKey].content)
    return part
  }
  const link = find("default_mcp_tool_ref", "default/mcp/publicreports/tool/report-reference", "report-reference")
  assert.equal(link.state.output, JSON.stringify(expected["report-reference"].content[0]))
  const empty = find("package_mcp_tool_ref", "content-boundaries-390/shared/reports/tool/empty-export", "empty-export")
  assert.equal(empty.state.output, 'Public export succeeded; zero records.\n\n{"records":0}')
  const audio = find("package_mcp_tool_ref", "content-boundaries-390/shared/reports/tool/audio-clip", "audio-clip")
  assert.equal(audio.state.output, "Public silent audio generated.")
  const namespace = createHash("sha256").update(path.resolve(dbPath).toLowerCase()).digest("hex")
  const attachmentFacts = []
  for (const [part, sample, mime] of [[empty, "empty.csv", "text/csv"], [audio, "silent.wav", "audio/wav"]] as const) {
    assert.equal(part.state.attachments.length, 1)
    const attachment = part.state.attachments[0]
    const ref = attachmentNameFromUrl(attachment.url)!
    assert(ref)
    assert.equal(ref.projectID, canonical.task.project_id)
    assert.equal(attachment.sessionID, part.sessionID)
    assert.equal(attachment.messageID, part.messageID)
    assert.equal(attachment.mime, mime)
    const absolutePath = path.join(ProjectRuntimePaths.attachmentBlobRoot(owner.project), namespace, ref.name)
    const bytes = await fs.readFile(absolutePath)
    assert.deepEqual(bytes, await fs.readFile(path.join(root, sample)))
    const metadata = JSON.parse(await fs.readFile(absolutePath + ".metadata.json", "utf8"))
    assert.equal(metadata.size, bytes.length)
    assert.equal(metadata.mime, mime)
    assert.equal(metadata.url, attachment.url)
    attachmentFacts.push({ toolPartID: part.id, url: attachment.url, absolutePath, bytes: bytes.length, exactPublicSample: true, metadata })
  }
  const calls = (await fs.readFile(path.join(root, "mcp-calls.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line))
  assert.deepEqual(calls.map((call) => call.name).sort(), Object.keys(expected).sort())
  for (const call of calls) assert.deepEqual(call.result, expected[call.name])
  const assistants = canonical.messages.filter((message: any) => message.role === "assistant")
  for (const message of assistants) { assert.equal(message.providerID, "openai"); assert.equal(message.modelID, "gpt-6.1-sol"); assert(Number.isFinite(message.time.completed)) }
  const assistantIDs = new Set(assistants.map((message: any) => message.id))
  const reply = canonical.parts.filter((part: any) => part.type === "text" && assistantIDs.has(part.messageID)).map((part: any) => part.text).join("\n")
  for (const text of ["Public export succeeded; zero records.", "records", "0", "Public silent audio generated.", "audio/wav", "60", "https://example.com/reports/empty.csv", "empty.csv", "Public empty report", "Zero-row public report", "text/csv"]) assert(reply.includes(text), `Visible answer must include ${text}`)
  assert(reply.includes("音频"), "Visible media limitation must be manually reviewed in the canonical reply")
  const terminal = canonical.tools.find(({part}: any) => part.tool === "manage_task" && part.state.input.action === "complete_task" && part.state.status === "completed")
  assert(terminal)
  assert.equal(audit.pid, owner.nativeTarget.pid)
  assert.equal(audit.model, "gpt-6.1-sol")
  assert(audit.requests.length > 0 && audit.requests.length <= 20)
  for (const request of audit.requests) { assert.equal(request.model, "gpt-6.1-sol"); assert.equal(request.streaming, true); assert.equal(request.status, 200); assert.equal(request.response_reader.state, "settled"); assert.equal(request.response_reader.terminal.kind, "eof") }
  assert(Date.now() < owner.nativeDeadlineAt)
  const result = { observedAt: new Date().toISOString(), acceptance: "backend-passed", taskID: canonical.task.id, rootSessionID: canonical.task.session_id, sessions: canonical.sessions, toolPartIDs: [link.id,empty.id,audio.id], exactOriginalDurableContent: true, exactCanonicalOutput: true, actualMcpCalls: calls.length, attachmentFacts, providerRequests: audit.requests.length, allRequestsExactModelStreamingHTTP200EOF: true, nativeDeadlineAt: owner.nativeDeadlineAt, boundary: "Actual Task default/package MCP content and attachments; manual page and physical shutdown are separate; no audio typed transport or linked resource fetching claim" }
  for (const [name, value] of [["live-canonical.json", canonical], ["live-provider-audit.json", audit], ["live-check.json", result]]) await fs.writeFile(path.join(root, name as string), redactor.redact(JSON.stringify(value, null, 2)), { flag: "wx" })
  await fs.writeFile(path.join(root, "visible-answer.txt"), redactor.redact(reply), { flag: "wx" })
  console.log(JSON.stringify(result, null, 2))
}
