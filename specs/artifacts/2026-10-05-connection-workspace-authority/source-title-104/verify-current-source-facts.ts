import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"

const run = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/source-title-104-01"
const evidence = import.meta.dir
const taskID = "tsk_g00VXNWt2u00YplT6eUw"
const projectID = "prj_hyuRk1rfJuHe8i5OMv2M"
const occurrence = "source-title-104-01-77ddba54-aab8-4b41-b4f3-4b825bcb068c"
const requestID = "e367b615-131e-40f6-931d-aad72339e06d"
const url = "https://www.w3.org/WAI/fundamentals/accessibility-intro/"
const title = "Introduction to Web Accessibility | Web Accessibility Initiative (WAI) | W3C"
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"))
const owner = read(path.join(run, "launch-owner.json"))
const selection = read(path.join(evidence, "actual-10401-task-selection.json"))
const request = read(path.join(evidence, "actual-10401-task-request-input.json"))
const auditFile = "source-title-104-01-final-provider-audit.json"
const audit = read(path.join(evidence, auditFile))
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const task = db.query("SELECT id,project_id,session_id,request_id,request,product_pillar FROM engine_task WHERE id=?").get(taskID) as Record<string, unknown>
  const sessions = db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT s.id,s.parent_id,s.project_id,s.kind FROM session s JOIN tree t ON t.id=s.id ORDER BY s.time_created,s.id").all(taskID) as Array<Record<string, unknown>>
  const ids = sessions.map(row => String(row.id))
  const placeholders = ids.map(() => "?").join(",")
  const parts = db.query(`SELECT p.id,p.message_id,p.data,m.session_id FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id IN (${placeholders}) ORDER BY p.time_created,p.id`).all(...ids) as Array<Record<string, unknown>>
  const tools = db.query(`SELECT r.id,r.message_id,r.data,m.session_id,o.data AS outcome_data FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id IN (${placeholders}) ORDER BY r.time_created,r.id`).all(...ids) as Array<Record<string, unknown>>
  const lifecycle = db.query("SELECT id,seq,type,payload FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=? AND type IN ('task.execution.opened','task.execution.reopened','task.completed','task.failed','task.cancelled') ORDER BY seq,id").all(taskID) as Array<Record<string, unknown>>
  const owners = db.query(`SELECT session_id FROM session_prompt_owner WHERE session_id IN (${placeholders})`).all(...ids)
  const sources = parts.map(row => ({ id: row.id, messageID: row.message_id, sessionID: row.session_id, payload: JSON.parse(String(row.data)) })).filter(row => row.payload.type === "source-url")
  const webfetch = tools.map(row => ({ row, request: JSON.parse(String(row.data)), outcome: row.outcome_data ? JSON.parse(String(row.outcome_data)) : null })).filter(row => row.request.tool === "webfetch").map(row => {
    const envelope = row.outcome?.resultAttemptID ? db.query("SELECT result FROM permission_execution_result WHERE attempt_id=?").get(row.outcome.resultAttemptID) as { result: string } | null : null
    const result = envelope ? JSON.parse(envelope.result).value : row.outcome
    return { partID: row.row.id, messageID: row.row.message_id, sessionID: row.row.session_id, input: row.request.input, outcome: row.outcome.outcome, sources: result.sources }
  })
  const provider = audit.requests.map((row: { model: string; streaming: boolean; status: number; response_reader: { state: string; terminal: { kind: string } } }) => ({ model: row.model, streaming: row.streaming, status: row.status, state: row.response_reader.state, terminal: row.response_reader.terminal.kind }))
  const events = lifecycle.map(row => ({ id: row.id, seq: row.seq, type: row.type, epoch: JSON.parse(String(row.payload)).execution_epoch }))
  const facts = { access: "closed exact DB readonly BEGIN/ROLLBACK; no application imports/bootstrap", occurrence, taskID, projectID, requestID, task, sessions, events, promptOwners: owners, webfetch, sources, provider: { sourceFile: auditFile, requests: provider } }
  fs.writeFileSync(path.join(evidence, "child-current-source-facts.json"), JSON.stringify(facts, null, 2), { flag: "wx" })
  assert.equal(owner.occurrence, occurrence)
  assert.equal(path.resolve(owner.runRoot), path.resolve(run))
  assert.equal(selection.taskID, taskID)
  assert.equal(selection.projectID, projectID)
  assert.equal(selection.requestID, requestID)
  assert.equal(task.request_id, requestID)
  assert.equal(task.project_id, projectID)
  assert.equal(task.request, request.request)
  assert.equal(task.product_pillar, "work")
  assert.deepEqual(sessions.map(row => row.project_id), sessions.map(() => projectID))
  assert.equal(events.filter(row => row.type === "task.execution.opened" || row.type === "task.execution.reopened").at(-1)!.epoch, 1)
  assert.deepEqual({ type: events.at(-1)!.type, epoch: events.at(-1)!.epoch }, { type: "task.completed", epoch: 1 })
  assert.deepEqual(owners, [])
  assert.equal(webfetch.length, 1)
  for (const tool of webfetch) {
    assert.equal(tool.input.url, url)
    assert.equal(tool.outcome, "completed")
    assert.equal(tool.sources.length, 1)
    const source = tool.sources[0]
    assert.deepEqual({ type: source.type, title: source.title, url: source.url }, { type: "source-url", title, url })
    const persisted = sources.filter(row => row.sessionID === tool.sessionID && row.messageID === tool.messageID && row.payload.sourceId === source.sourceId)
    assert.equal(persisted.length, 1)
    const { id, messageID, sessionID, ...payload } = persisted[0]!.payload
    assert.deepEqual(payload, source)
  }
  assert.equal(provider.length, 10)
  assert.deepEqual(provider, Array.from({ length: 10 }, () => ({ model: "gpt-6.1-sol", streaming: true, status: 200, state: "settled", terminal: "eof" })))
  db.exec("ROLLBACK")
  console.log(JSON.stringify({ status: "qualified", taskID, projectID, occurrence, epoch: 1, terminal: "task.completed", webfetch, sessionKinds: sessions.map(row => ({ id: row.id, kind: row.kind })), providerCount: provider.length, boundary: "actual durable/source/provider scalar facts; no UI assertion or physical caller inferred from audit index" }))
} finally { db.close() }

