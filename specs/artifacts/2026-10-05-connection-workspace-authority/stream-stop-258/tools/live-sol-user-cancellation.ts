import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
import { ExecutionCancellationOrigin } from "../packages/opencorvus/src/session/prompt/cancellation"
const [run, providerPath, output] = process.argv.slice(2)
assert(run && providerPath && output && process.argv.slice(2).length === 3)
for (const target of [run, providerPath, output]) assert(path.isAbsolute(target))
const owner = JSON.parse(fs.readFileSync(path.join(run, "launch-owner.json"), "utf8"))
const native = JSON.parse(fs.readFileSync(path.join(owner.evidence, "native-host-settled.json"), "utf8"))
assert.equal(owner.qualificationKind, "NativeServiceCancellation")
assert.equal(native.occurrence, owner.occurrence)
assert.deepEqual(native.target, owner.nativeTarget)
assert.equal(native.terminal.reason, "exited")
assert.equal(native.terminal.exitCode, 0)
assert.equal(native.physicalCompletion, true)
assert.equal(native.outputDrainComplete, true)
assert.equal(native.requestCleanupComplete, true)
const provider = JSON.parse(fs.readFileSync(providerPath, "utf8"))
assert.equal(provider.pid, owner.nativeTarget.pid)
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const cancelled = provider.requests.filter((r: any) => r.response_reader?.terminal?.kind !== "eof").map((request: any) => {
    const reader = request.response_reader
    assert.equal(request.model, "gpt-6.1-sol")
    assert.equal(request.streaming, true)
    assert.equal(request.status, 200)
    assert.equal(reader.state, "settled")
    assert.equal(reader.identityState, "observed")
    assert.equal(reader.terminal.kind, "aborted")
    assert(reader.byteCount > 0 && reader.chunkCount > 0)
    const context = reader.requestContext
    assert.equal(context.streamRequest.apiModelID, "gpt-6.1-sol")
    const activityID = context.activity.id
    const fact = db.query(`SELECT r.assistant_message_id,o.data,o.time_created FROM provider_activity_request r
      JOIN provider_activity_outcome o ON o.request_id=r.id WHERE r.id=?`).get(activityID) as any
    assert(fact)
    assert.equal(fact.assistant_message_id, context.activity.assistantMessageID)
    const result = JSON.parse(fact.data)
    assert.equal(result.outcome, "aborted")
    assert.equal(result.error_class, "external_abort")
    const row = db.query("SELECT session_id,data FROM message WHERE id=?").get(fact.assistant_message_id) as any
    assert.equal(row.session_id, context.sessionID)
    const message = JSON.parse(row.data)
    assert.equal(message.role, "assistant")
    assert.equal(message.error.name, "MessageAbortedError")
    const cancellation = ExecutionCancellationOrigin.parse(message.error.data.cancellation)
    assert.equal(cancellation.actor, "user")
    assert.equal(cancellation.source, "session.abort")
    assert.equal(cancellation.targetSessionID, context.sessionID)
    const input = db.query("SELECT session_id,data FROM message WHERE id=?").get(message.parentID) as any
    assert.equal(input.session_id, context.sessionID)
    assert.equal(JSON.parse(input.data).role, "user")
    const lifecycle = (db.query(`SELECT payload,emitted_at FROM protocol_event WHERE type='agent.execution.lifecycle'
      AND aggregate_type='session' AND aggregate_id=? ORDER BY seq,id`).all(context.sessionID) as any[])
      .map(r => ({ at: r.emitted_at, ...JSON.parse(r.payload) }))
    const terminal = lifecycle.filter(r => r.inputMessageID === message.parentID).at(-1)
    assert.equal(terminal.status.type, "terminal")
    assert.equal(terminal.status.reason, "aborted")
    const text = db.query("SELECT data FROM part WHERE message_id=?").all(fact.assistant_message_id) as any[]
    const chars = text.reduce((n, p) => { const part = JSON.parse(p.data); return n + (part.type === "text" ? part.text.length : 0) }, 0)
    assert(chars > 0, "Actual partial assistant text must be retained")
    const later = db.query(`SELECT m.id,m.data FROM message m JOIN provider_activity_request r ON r.assistant_message_id=m.id
      JOIN provider_activity_outcome o ON o.request_id=r.id WHERE m.session_id=? AND o.time_created>? AND json_extract(o.data,'$.outcome')='done'
      ORDER BY o.time_created,m.id`).all(context.sessionID, terminal.at) as any[]
    const continuation = later.find(row => {
      const info = JSON.parse(row.data)
      const end = lifecycle.filter(r => r.inputMessageID === info.parentID).at(-1)
      return info.parentID !== message.parentID && info.time?.completed && end?.status.type === "idle"
    })
    assert(continuation, "Subsequent real input must complete naturally in the same Session")
    const followupChars = (db.query("SELECT data FROM part WHERE message_id=?").all(continuation.id) as any[])
      .reduce((n, p) => { const part = JSON.parse(p.data); return n + (part.type === "text" ? part.text.length : 0) }, 0)
    assert(followupChars > 0)
    return { activityID, sessionID: context.sessionID, assistantMessageID: fact.assistant_message_id,
      inputMessageID: message.parentID, readerTerminal: reader.terminal, byteCount: reader.byteCount,
      outcome: result, cancellation, inputTerminal: terminal, retainedTextChars: chars,
      subsequentAssistantMessageID: continuation.id, subsequentInputMessageID: JSON.parse(continuation.data).parentID,
      subsequentTextChars: followupChars }
  })
  assert(cancelled.length >= 1)
  const result = { observedAtUtc: new Date().toISOString(), occurrence: owner.occurrence, pid: owner.nativeTarget.pid,
    cancelled, access: "Physically closed original canonical SQLite readonly BEGIN/ROLLBACK; exact actual Response binding and immutable request/outcome plus input lifecycle" }
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ userCancelledRequests: cancelled.length, canonicalCancellationQualified: true }))
} finally { db.exec("ROLLBACK"); db.close() }
