import fs from "node:fs"
import assert from "node:assert/strict"
import path from "node:path"

const root = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/sdk-consumption-observation"
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, ""))
const facts = read("actual-43-readonly-facts.json")
const tools = read("actual-43-readonly-tool-facts.json")
const selected = facts.selected
const archive = "runtime-evidence-43"
const auditName = fs.readdirSync(path.join(root, archive)).filter((name) => /^provider-\d+-.*-\d+\.json$/.test(name)).sort((a, b) => Number(a.match(/-(\d+)\.json$/)![1]) - Number(b.match(/-(\d+)\.json$/)![1])).at(-1)!
const audit = read(`${archive}/${auditName}`)
const trace = fs.readFileSync(path.join(root, "actual-43-task-trace.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line))
const observations = trace.filter((event) => event.kind === "llm_stream_observation")
const activityID = "act_g0VXJ0CH4007K45K1PIY"
const stalled = observations.find((event) => event.payload.activity.id === activityID && event.payload.activity.attempt === 0 && event.payload.phase === "aborted")
assert(stalled)
const o = stalled.payload.observation
assert.equal(o.received, 14828)
assert.equal(o.finished, o.received)
assert.equal(o.types["tool-input-delta"], 14825)
assert.equal(o.acceptedTypes["tool-input-delta"], 14825)
assert.equal(o.heartbeatTypes["tool-input-delta"], 379)
assert.equal(o.reasons.nonsemantic, 14446)
assert.equal(o.phase, "awaiting_event")
const physical = audit.requests.filter((entry: any) => entry.response_reader.requestContext?.activity?.id === activityID)
for (const entry of physical) {
  const context = entry.response_reader.requestContext
  const matching = observations.find((event) => event.payload.activity.id === context.activity.id && event.payload.activity.attempt === context.activity.attempt)
  assert(matching)
  assert.deepEqual(matching.payload.streamRequest, context.streamRequest)
  assert.deepEqual(matching.payload.activity, context.activity)
  assert.equal(matching.sessionID, context.sessionID)
}
assert.deepEqual(physical.map((entry: any) => entry.response_reader.requestContext.activity.attempt), [0, 1])
for (const entry of audit.requests) assert.deepEqual({model: entry.model, streaming: entry.streaming, status: entry.status}, {model: "gpt-6.1-sol", streaming: true, status: 200})
const closure = read("sdk-consumption-43-physical-terminal-and-pair-cleanup.json")
const opened = read(`${archive}/task-boundary-admitted.json`).pinned.openedAt
const wholeElapsedMs = Date.parse(closure.observedAtUtc) - opened
assert(wholeElapsedMs <= 900000)
const sourceFiles = [
  {name: "hello.txt", expected: Buffer.from("Hello from a formal Task.\n")},
  {name: "notes.txt", expected: Buffer.from("Notes from a formal Task.\n".repeat(20))},
].map(({name, expected}) => {
  const actual = fs.readFileSync(path.join(selected.directory, name))
  assert.deepEqual(actual, expected)
  return {name, bytes: actual.length, completeLiteralComparison: "passed", scope: "Root offline source file verification after native closure; cannot substitute for independent participant verification"}
})
const verifierRequests = tools.requests.filter((entry: any) => entry.session_id === stalled.sessionID).map((entry: any) => ({...entry, data: typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data}))
const materializations = verifierRequests.filter((entry: any) => entry.data.tool === "artifact_read" && entry.data.input.reads?.some((item: any) => item.delivery === "materialized_file")).map((entry: any) => {
  const result = tools.results.find((item: any) => item.requestID === entry.id)
  assert(result)
  const value = JSON.parse(result.output).results[0].value
  return {requestID: entry.id, messageID: entry.message_id, locator: value.locator, readRef: value.artifact_read_ref, path: value.materialized_path, complete: value.complete, bytes: value.total_bytes}
})
assert.equal(materializations.length, 3)
assert.deepEqual(materializations.map((entry: any) => ({complete: entry.complete, bytes: entry.bytes})), [{complete: true, bytes: 26}, {complete: true, bytes: 26}, {complete: true, bytes: 520}])
assert.deepEqual(materializations[0].locator, materializations[1].locator)
const checks = verifierRequests.filter((entry: any) => entry.data.tool === "bash").map((entry: any) => {
  const result = tools.results.find((item: any) => item.requestID === entry.id)
  assert(result)
  return {requestID: entry.id, messageID: entry.message_id, output: JSON.parse(result.output)}
})
assert.deepEqual(checks.map((entry: any) => ({step: entry.output.step, bytes: entry.output.bytes, result: entry.output.result, literal: entry.output.literal_match})), [{step: 1, bytes: 26, result: "PASS", literal: true}, {step: 2, bytes: 26, result: "PASS", literal: true}])
const report = {
  observedAtUtc: new Date().toISOString(), originalOutcome: read(`${archive}/failed.json`), selected,
  qualification: {sourceAndFocusedContracts: "passed", realConsumerObservationAndExactAttemptAssociation: "passed", originalTask: "failed", actualSourceFileEditorVisuals: "observed", currentArtifactInspectorResourceAndSnapshotVisuals: "unqualified", independentHelloChecks: "passed_twice", independentNotesCacheCheck: "unmet", independentAcceptanceArtifact: "unmet", taskFormalCompletionAndDownload: "unmet"},
  native: {wholeElapsedMs, fixedWholeMaximumMs: 900000, physical: closure, independent: read("actual-43-independent-closure.json")},
  audit: {requests: audit.requests.length, eof: audit.requests.filter((entry: any) => entry.response_reader.terminal?.kind === "eof").length, aborted: audit.requests.filter((entry: any) => entry.response_reader.terminal?.kind === "aborted").length, originalFailureRequestCount: 53, exactAttemptResponses: physical.map((entry: any) => ({status: entry.status, reader: entry.response_reader}))},
  stalledConsumption: stalled, retryConsumption: observations.filter((entry) => entry.payload.activity.id === activityID && entry.payload.activity.attempt === 1),
  sourceFiles, independentMaterializations: materializations, independentHelloChecks: checks,
  readonly: {sessions: facts.sessions.length, messages: facts.messages.length, ordinaryParts: facts.parts.length, events: facts.events.length, owners: facts.owners.length, pending: facts.pending.length, toolRequests: tools.requests.length, toolProgress: tools.progress.length, toolOutcomes: tools.outcomes.length, toolResults: tools.results.length},
  limits: ["Whitespace SDK Tool deltas were accepted by the handler but did not renew semantic liveness. The precise Provider generation cause and JSON structural position remain unknown.", "Original Task snapshots contain ordinary and admitted Tool facts; the pending transport draft for this assistant is not preserved there. No historical payload or physical request body is reconstructed.", "Original semantic idle and later public shutdown retry cancellation are separate outcomes.", "Restart, multi-project concurrency, Mission, non-Task consumption and helper matrices remain unqualified.", "First processor fixture output was truncated by its original tool; retained transcript explicitly records that limitation."],
}
fs.writeFileSync(path.join(root, "actual-43-first-failure-analysis.json"), JSON.stringify(report, null, 2), {flag: "wx"})
console.log(JSON.stringify({originalTask: report.qualification.originalTask, consumerObservation: report.qualification.realConsumerObservationAndExactAttemptAssociation, requests: report.audit.requests, eof: report.audit.eof, aborted: report.audit.aborted, wholeElapsedMs, materializations: materializations.length, independentChecks: checks.length}))
