import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
import type { Message } from "../../../../../packages/opencorvus/src/session/message"

const [runArg, evidenceArg] = process.argv.slice(2)
assert.equal(process.argv.slice(2).length, 2)
const run = path.resolve(runArg!)
const evidence = path.resolve(evidenceArg!)
const expectedRun = path.resolve("C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/dock-width-final-103-07")
const expectedEvidence = path.resolve("D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/dock-width-103/final-07")
assert.equal(run, expectedRun)
assert.equal(evidence, expectedEvidence)
const taskID = "tsk_g00VXNHELK00AXVDs6hJ"
const projectID = "prj_hohmUdWy83WZD6x0SXK1"
const occurrence = "dock-width-final-103-07-c43a9b29-77a6-469a-b1cf-530a7e9ad3d6"
const sourceURL = "https://www.w3.org/WAI/fundamentals/accessibility-intro/"
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"))
const owner = read(path.join(run, "launch-owner.json"))
const selection = read(path.join(evidence, "actual-current-task-selection.json"))
const request = read(path.join(evidence, "actual-current-task-request.json"))
const audit = read(path.join(evidence, "dock-width-final-103-07-final-provider-audit.json"))
assert.equal(owner.occurrence, occurrence)
assert.equal(path.resolve(owner.runRoot), run)
assert.equal(selection.occurrence, occurrence)
assert.equal(selection.taskID, taskID)
assert.equal(selection.projectID, projectID)
assert.equal(selection.productPillar, "work")
assert.equal(request.input.productPillar, "work")
assert.equal(request.input.requestID, selection.requestID)
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const task = db.query("SELECT * FROM engine_task WHERE id=?").get(taskID) as Record<string, unknown>
  const sessions = db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT s.id,s.parent_id,s.project_id,s.kind FROM session s JOIN tree t ON t.id=s.id ORDER BY s.time_created,s.id").all(taskID) as Array<Record<string, unknown>>
  const sessionIDs = sessions.map(row => String(row.id))
  const placeholders = sessionIDs.map(() => "?").join(",")
  const parts = db.query(`SELECT p.*,m.session_id FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id IN (${placeholders}) ORDER BY p.time_created,p.id`).all(...sessionIDs) as Array<Record<string, unknown>>
  const toolRows = db.query(`SELECT r.*,m.session_id,o.data AS outcome_data FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id IN (${placeholders}) ORDER BY r.time_created,r.id`).all(...sessionIDs) as Array<Record<string, unknown>>
  const lifecycle = db.query("SELECT * FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=? AND type IN ('task.execution.opened','task.execution.reopened','task.completed','task.failed','task.cancelled') ORDER BY seq,id").all(taskID) as Array<Record<string, unknown>>
  const promptOwners = db.query(`SELECT * FROM session_prompt_owner WHERE session_id IN (${placeholders})`).all(...sessionIDs)
  const sourceParts = parts.map(row => ({ row, data: JSON.parse(String(row.data)) })).filter(value => value.data.type === "source-url")
  const webfetch = toolRows.map(row => ({ row, input: JSON.parse(String(row.data)), outcome: row.outcome_data ? JSON.parse(String(row.outcome_data)) : null })).filter(value => value.input.tool === "webfetch").map(value => {
    const envelope = value.outcome?.resultAttemptID ? db.query("SELECT result FROM permission_execution_result WHERE attempt_id=?").get(value.outcome.resultAttemptID) as { result: string } | null : null
    const result = envelope ? JSON.parse(envelope.result).value : value.outcome
    return { ...value, result }
  })
  const facts = { observedAt: new Date().toISOString(), access: "exact owned DB readonly BEGIN/ROLLBACK; no application bootstrap", owner: { occurrence: owner.occurrence, runRoot: owner.runRoot }, selection, task, sessions, lifecycle, promptOwners, sourceParts, webfetch, provider: audit }
  fs.writeFileSync(path.join(evidence, "child-current-source-facts.json"), JSON.stringify(facts, null, 2), { flag: "wx" })
  assert.equal(task.id, taskID)
  assert.equal(task.project_id, projectID)
  assert.equal(task.request_id, selection.requestID)
  assert.equal(task.request, request.input.request)
  assert.equal(task.product_pillar, "work")
  assert.deepEqual(sessions.map(row => row.project_id), sessions.map(() => projectID))
  const opened = lifecycle.filter(row => row.type === "task.execution.opened" || row.type === "task.execution.reopened").at(-1)!
  const terminal = lifecycle.filter(row => row.type === "task.completed" || row.type === "task.failed" || row.type === "task.cancelled").at(-1)!
  assert.equal(JSON.parse(String(opened.payload)).execution_epoch, 1)
  assert.equal(terminal.type, "task.completed")
  assert.equal(JSON.parse(String(terminal.payload)).execution_epoch, 1)
  assert.deepEqual(promptOwners, [])
  assert.ok(webfetch.length > 0)
  const researcherSessions = new Set(webfetch.map(value => String(value.row.session_id)))
  for (const sessionID of researcherSessions) assert.equal(sessions.find(row => row.id === sessionID)?.kind, "explore")
  for (const value of webfetch) {
    assert.equal(value.input.input.url, sourceURL)
    assert.equal(value.outcome.outcome, "completed")
    assert.ok(Array.isArray(value.result.sources) && value.result.sources.length > 0)
    for (const source of value.result.sources as Message.SourceUrlPayload[]) {
      assert.equal(source.type, "source-url")
      assert.equal(source.url, sourceURL)
      const persisted = sourceParts.filter(part => part.row.session_id === value.row.session_id && part.data.sourceId === source.sourceId)
      assert.ok(persisted.length > 0)
      for (const part of persisted) {
        const { id, messageID, sessionID, ...payload } = part.data
        assert.deepEqual(payload, source)
      }
    }
  }
  assert.equal(audit.requests.length, 26)
  assert.deepEqual(audit.requests.map((entry: { model: string; streaming: boolean; status: number; response_reader: { state: string; terminal: { kind: string } } }) => ({ model: entry.model, streaming: entry.streaming, status: entry.status, state: entry.response_reader.state, terminal: entry.response_reader.terminal.kind })), audit.requests.map(() => ({ model: "gpt-6.1-sol", streaming: true, status: 200, state: "settled", terminal: "eof" })))
  db.exec("ROLLBACK")
  console.log(JSON.stringify({ occurrence, taskID, projectID, status: "completed", epoch: 1, sessionIDs, researcherSessionIDs: [...researcherSessions], webfetchCount: webfetch.length, sourcePartCount: sourceParts.length, physicalRequests: audit.requests.length, boundary: "readonly durable/provider data qualification; no UI assertions or Provider request" }))
} finally { db.close() }
