import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"

const [runRoot, evidenceRoot] = process.argv.slice(2)
assert(runRoot && evidenceRoot && path.isAbsolute(runRoot) && path.isAbsolute(evidenceRoot))
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(evidenceRoot, name), "utf8"))
const owner = read("launch-owner.json")
const completion = read("task-complete.json")
const closure = read("root-independent-closure.json")
const audit = read("provider-final.json")
assert.equal(path.resolve(runRoot), path.resolve(owner.runRoot))
assert.equal(path.resolve(evidenceRoot), path.resolve(owner.settlementEvidenceRoot))
assert.equal(completion.occurrence, owner.occurrence)
assert.equal(closure.occurrence, owner.occurrence)
const researcher = "ses_hC0FrYCKPxwmNEAOGRIp"
const db = new Database(path.join(owner.runtime, "data", "opencorvus.db"), { readonly: true })
const facts = db.transaction(() => {
  const task = db.query("SELECT id,project_id,session_id,request_id FROM engine_task WHERE id=?").get(completion.selected.taskID)
  const session = db.query("SELECT id,project_id,kind,parent_id FROM session WHERE id=?").get(researcher)
  const sources = db.query(`SELECT p.id,p.message_id,m.session_id,p.time_created,p.data
    FROM part p JOIN message m ON m.id=p.message_id
    WHERE m.session_id=? AND json_extract(p.data,'$.type')='source-url'
    ORDER BY p.time_created,p.id`).all(researcher).map((row: any) => ({
      id: row.id, messageID: row.message_id, sessionID: row.session_id, createdAt: row.time_created,
      source: JSON.parse(row.data),
    }))
  const tools = db.query(`SELECT r.id,r.message_id,m.session_id,
    json_extract(r.data,'$.tool') AS tool,json_extract(r.data,'$.input.url') AS url,
    o.id AS outcome_id,json_extract(o.data,'$.outcome') AS outcome,
    json_extract(o.data,'$.title') AS title
    FROM tool_part_request r JOIN message m ON m.id=r.message_id
    JOIN tool_part_outcome o ON o.request_part_id=r.id
    WHERE m.session_id=? AND json_extract(r.data,'$.tool')='webfetch'
    ORDER BY r.time_created,r.id`).all(researcher)
  return { task, session, sources, tools }
})()
db.close()
const requests = audit.requests.map((request: any) => ({
  model: request.model, streaming: request.streaming, status: request.status,
  readerState: request.response_reader.state, terminal: request.response_reader.terminal.kind,
  participant: request.response_reader.requestContext.streamRequest,
  sessionID: request.response_reader.requestContext.sessionID,
}))
const output = { observedAtUtc: new Date().toISOString(), readonly: true,
  boundary: "Actual completed owned Task/Session/Source/Tool/provider facts; no UI assertions or inferred Tool-to-Source relation",
  occurrence: owner.occurrence, facts, requests, lifecycle: completion.lifecycle,
  requestCap: audit.maxRequests, requestCount: requests.length }
fs.writeFileSync(path.join(evidenceRoot, "root-final-source-contract.json"), JSON.stringify(output, null, 2), { flag: "wx" })
const expectedURLs = ["https://www.w3.org/TR/css-scroll-anchoring-1/", "https://www.w3.org/TR/css-overflow-3/"]
assert.equal((facts.task as any).id, completion.selected.taskID)
assert.equal((facts.task as any).project_id, completion.selected.projectID)
assert.equal((facts.task as any).request_id, completion.selected.requestID)
assert.equal((facts.session as any).id, researcher)
assert.equal((facts.session as any).kind, "explore")
assert.equal((facts.session as any).project_id, completion.selected.projectID)
assert.deepEqual(facts.sources.map((part) => part.source.url), expectedURLs)
for (const source of facts.sources) {
  assert.equal(source.sessionID, researcher)
  assert.equal(source.source.provider, "opencorvus-webfetch")
  assert.equal(source.source.type, "source-url")
}
assert.deepEqual(facts.tools.map((tool: any) => tool.url), expectedURLs)
assert.deepEqual(facts.tools.map((tool: any) => tool.outcome), ["completed", "completed"])
assert.equal(completion.lifecycle.status, "completed")
assert.equal(audit.maxRequests, 24)
assert.equal(requests.length, completion.requests)
for (const request of requests) {
  assert.equal(request.model, "gpt-6.1-sol")
  assert.equal(request.participant.apiModelID, "gpt-6.1-sol")
  assert.equal(request.streaming, true)
  assert.equal(request.status, 200)
  assert.equal(request.readerState, "settled")
  assert.equal(request.terminal, "eof")
}
console.log(JSON.stringify({ outcome: "qualified", sourceURLs: expectedURLs, actualSourceParts: facts.sources.length,
  actualWebfetchOutcomes: facts.tools.length, actualStreamedRequests: requests.length,
  taskID: completion.selected.taskID, researcher, lifecycle: completion.lifecycle.status, readonly: true }))
