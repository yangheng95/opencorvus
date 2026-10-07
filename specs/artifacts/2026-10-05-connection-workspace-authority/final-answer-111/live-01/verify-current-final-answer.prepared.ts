import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { Database } from "bun:sqlite"
import { timelineOrderKey, compareTimelineOrderKeys } from "../packages/opencorvus/src/timeline/order"

const args = process.argv.slice(2)
assert.equal(args.length, 6, "Mandatory Run/Evidence/Case/Prefix/Manifest/FinalAudit")
const [run, evidence] = args
assert.ok(run && evidence)
const guard = spawnSync(process.execPath, [path.resolve(import.meta.dir, "verify-current-source-facts.ts"), ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
fs.writeFileSync(path.join(evidence, "final-answer-source-checker.stdout.log"), guard.stdout ?? "", { flag: "wx" })
fs.writeFileSync(path.join(evidence, "final-answer-source-checker.stderr.log"), guard.stderr ?? "", { flag: "wx" })
fs.writeFileSync(path.join(evidence, "final-answer-source-checker-exit.json"), JSON.stringify({ status: guard.status, signal: guard.signal, spawnError: guard.error?.message }, null, 2), { flag: "wx" })
assert.equal(guard.status, 0, "Original Source checker must qualify once")
const source = JSON.parse(fs.readFileSync(path.join(evidence, "child-current-source-facts.json"), "utf8"))
type Row = { id: string; message_id: string; session_id: string; data: string; time_created: number; outcome_data?: string | null }
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const decisions = db.query("SELECT id,payload,time_created FROM engine_artifact WHERE task_id=? AND kind='task_completion_decision' ORDER BY time_created,id").all(source.taskID) as { id: string; payload: string; time_created: number }[]
  const messages = db.query("SELECT m.id,m.session_id,m.data,m.time_created FROM message m WHERE m.session_id IN (WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree ON s.parent_id=tree.id) SELECT id FROM tree) ORDER BY m.time_created,m.id").all(source.taskID) as { id: string; session_id: string; data: string; time_created: number }[]
  const parts = db.query("SELECT p.id,p.message_id,m.session_id,p.data,p.time_created FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id IN (WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree ON s.parent_id=tree.id) SELECT id FROM tree) ORDER BY p.time_created,p.id").all(source.taskID) as Row[]
  const tools = db.query("SELECT r.id,r.message_id,m.session_id,r.data,r.time_created,o.data outcome_data FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id IN (WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree ON s.parent_id=tree.id) SELECT id FROM tree) ORDER BY r.time_created,r.id").all(source.taskID) as Row[]
  const decodedMessages = messages.map(row => ({ ...row, data: JSON.parse(row.data) }))
  const texts = parts.map(row => ({ ...row, data: JSON.parse(row.data), orderKey: timelineOrderKey({ domain: "part", time: row.time_created, id: row.id }) })).filter(row => row.data.type === "text")
  const decodedTools = tools.map(row => ({ ...row, data: JSON.parse(row.data), outcome: row.outcome_data ? JSON.parse(row.outcome_data) : null, orderKey: timelineOrderKey({ domain: "part", time: row.time_created, id: row.id }) }))
  const decodedDecisions = decisions.map(row => ({ ...row, payload: JSON.parse(row.payload) }))
  const facts = { boundary: "actual CLOSED DB readonly BEGIN/ROLLBACK; Source guards called once; no application bootstrap/UI assertion", sourceFactsFile: "child-current-source-facts.json", taskID: source.taskID, projectID: source.projectID, occurrence: source.occurrence, requestID: source.requestID, events: source.events, messages: decodedMessages, texts, tools: decodedTools, decisions: decodedDecisions }
  fs.writeFileSync(path.join(evidence, "child-current-final-answer-facts.json"), JSON.stringify(facts, null, 2), { flag: "wx" })
  assert.equal(decodedDecisions.length, 1)
  const decision = decodedDecisions[0]!.payload
  const terminal = decodedTools.find(row => row.id === decision.tool_part_id)
  assert.ok(terminal)
  assert.equal(terminal.session_id, decision.orchestrator_session_id)
  assert.equal(terminal.message_id, decision.orchestrator_message_id)
  assert.equal(terminal.data.callID, decision.tool_call_id)
  assert.equal(terminal.data.tool, "manage_task")
  assert.equal(terminal.data.input.action, "complete_task")
  assert.equal(terminal.outcome?.outcome, "completed")
  const answer = texts.filter(row => row.session_id === decision.orchestrator_session_id && decodedMessages.find(message => message.id === row.message_id)?.data.role === "assistant" && compareTimelineOrderKeys(row.orderKey, terminal.orderKey) < 0)
  assert.ok(answer.length > 0)
  for (const url of source.requestedURLs) assert.ok(answer.some(row => typeof row.data.text === "string" && row.data.text.includes(url)), "Actual orchestrator assistant answer contains requested URL before terminal")
  assert.ok(Array.isArray(decision.evidence_locators) && decision.evidence_locators.length > 0)
  const workerEvidence = decision.evidence_locators.filter((locator: { source: string; session_id?: string }) => locator.source === "session_message" && locator.session_id !== decision.orchestrator_session_id)
  assert.ok(workerEvidence.length > 0)
  for (const locator of workerEvidence) {
    assert.equal(locator.source, "session_message")
    const message = decodedMessages.find(row => row.id === locator.message_id && row.session_id === locator.session_id)
    assert.ok(message)
    assert.equal(message.data.role, "assistant")
  }
  console.log(JSON.stringify({ status: "qualified", taskID: source.taskID, terminalPartID: terminal.id, answerPartIDs: answer.map(row => row.id), requestedURLCount: source.requestedURLs.length, boundary: "Actual text/terminal/decision chronology; Chinese three-summary content requires Root manual reading" }))
} finally {
  db.exec("ROLLBACK")
  db.close()
}

