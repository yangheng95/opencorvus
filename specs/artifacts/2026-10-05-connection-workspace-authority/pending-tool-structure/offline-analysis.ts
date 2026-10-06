import fs from "node:fs"
import assert from "node:assert/strict"
import path from "node:path"

const root = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/pending-tool-structure"
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, ""))
const facts = read("actual-44-readonly-facts.json")
const tools = read("actual-44-readonly-tool-facts.json")
const audit = read("pending-tool-44-final-provider-audit.json")
const trace = fs.readFileSync(path.join(root, "actual-44-task-trace.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line))
const observations = trace.filter((event) => event.kind === "llm_stream_observation")
const activityID = "act_g0VXJAaiy002l8wVlwuO"
const stalled = observations.find((event) => event.payload.activity.id === activityID && event.payload.activity.attempt === 0 && event.payload.phase === "aborted")
assert(stalled)
assert.equal(stalled.sessionID, "ses_ht0m2MzpqpDVkv2mc2J0")
const o = stalled.payload.observation
assert.deepEqual({received:o.received, finished:o.finished, deltas:o.types["tool-input-delta"], accepted:o.acceptedTypes["tool-input-delta"], heartbeats:o.heartbeats, nonsemantic:o.reasons.nonsemantic, phase:o.phase}, {received:11733, finished:11733, deltas:11730, accepted:11730, heartbeats:350, nonsemantic:11382, phase:"awaiting_event"})
assert.deepEqual(stalled.payload.pendingToolInputs, {pendingCount:1,totalUTF16Length:107584,observedUTF16Length:107584,trimmedUTF16Length:1030,nonWhitespaceUTF16Length:967,trailingWhitespaceUTF16Length:106554,states:{complete_json:0,syntax_error:1,non_object:0,empty:0,unobserved_size_limit:0},rootFieldCount:0,valueTypes:{null:0,array:0,object:0,string:0,number:0,boolean:0},bookkeepingFailures:0,sourceUTF16Budget:262144})
const physical = audit.requests.filter((entry: any) => entry.response_reader.requestContext?.activity?.id === activityID)
assert.deepEqual(physical.map((entry: any) => entry.response_reader.requestContext.activity.attempt), [0,1])
for (const entry of physical) {
  const context = entry.response_reader.requestContext
  const matching = observations.find((event) => event.payload.activity.id === activityID && event.payload.activity.attempt === context.activity.attempt)
  assert(matching)
  assert.deepEqual(matching.payload.streamRequest, context.streamRequest)
  assert.deepEqual(matching.payload.activity, context.activity)
  assert.equal(matching.sessionID, context.sessionID)
}
for (const entry of audit.requests) assert.deepEqual({model:entry.model, streaming:entry.streaming, status:entry.status}, {model:"gpt-6.1-sol",streaming:true,status:200})
assert.equal(audit.requests.length,58)
const shapes = physical.map((entry: any) => ({attempt:entry.response_reader.requestContext.activity.attempt, declarations:entry.tool_declarations.entries.map((tool: any) => ({index:tool.index,names:tool.names,schema_shapes:tool.schema_shapes}))}))
const closure = read("pending-tool-44-physical-terminal-and-pair-cleanup.json")
const opened = read("runtime-evidence-44/task-boundary-admitted.json").pinned.openedAt
const wholeElapsedMs = Date.parse(closure.observedAtUtc)-opened
assert(wholeElapsedMs <= 900000)
const sourceFiles = [{name:"hello.txt", expected:Buffer.from("Hello from a formal Task.\n")},{name:"notes.txt",expected:Buffer.from("Notes from a formal Task.\n".repeat(20))}].map(({name,expected}) => {
  const actual = fs.readFileSync(path.join(facts.selected.directory,name))
  assert.deepEqual(actual,expected)
  return {name,bytes:actual.length,completeLiteralComparison:"passed",scope:"Root offline source comparison after native closure; separate from participant acceptance"}
})
const requests = tools.requests.filter((entry: any) => entry.session_id === stalled.sessionID).map((entry: any) => ({...entry,data:typeof entry.data === "string" ? JSON.parse(entry.data):entry.data}))
const resultFor = (request: any) => {const result=tools.results.find((entry:any)=>entry.requestID===request.id); assert(result); return result.output}
const materializations = requests.filter((entry:any)=>entry.data.tool==="artifact_read" && entry.data.input.reads?.some((item:any)=>item.delivery==="materialized_file")).map((entry:any)=>{
  const value=JSON.parse(resultFor(entry)).results[0].value
  return {requestID:entry.id,messageID:entry.message_id,locator:value.locator,readRef:value.artifact_read_ref,path:value.materialized_path,complete:value.complete,bytes:value.total_bytes}
})
assert.deepEqual(materializations.map((entry:any)=>({complete:entry.complete,bytes:entry.bytes})),[{complete:true,bytes:26},{complete:true,bytes:26}])
assert.deepEqual(materializations[0].locator,materializations[1].locator)
const checks=requests.filter((entry:any)=>entry.data.tool==="bash").map((entry:any)=>({requestID:entry.id,messageID:entry.message_id,input:entry.data.input,output:resultFor(entry)}))
assert.equal(checks.length,1)
assert.equal(checks[0].output.split(/\r?\n/)[0],"hello read 1 PASS; rb reopened; read to EOF; bytes=26; every byte exact; LF=1; CR=0; BOM=false; UTF-8 valid")
const report={observedAtUtc:new Date().toISOString(),originalOutcome:read("runtime-evidence-44/failed.json"),selected:facts.selected,
  qualification:{sourceAndFocusedContracts:"passed",actualPendingStructureAndExactAttemptAssociation:"passed",originalTask:"failed",explorerRefreshFocusMenuAndCurrentFileVisuals:"passed_scoped",independentHelloFirstCacheCheck:"passed",independentHelloSecondCacheCheck:"unmet",independentNotesMaterializationAndCheck:"unmet",independentAcceptanceArtifact:"unmet",taskFormalCompletionArtifactInspectorAndDownload:"unmet"},
  native:{wholeElapsedMs,fixedWholeMaximumMs:900000,physical:closure,independent:read("actual-44-independent-closure.json")},
  audit:{requests:audit.requests.length,eof:audit.requests.filter((entry:any)=>entry.response_reader.terminal?.kind==="eof").length,aborted:audit.requests.filter((entry:any)=>entry.response_reader.terminal?.kind==="aborted").length,originalFailureRequestCount:57,exactAttemptResponses:physical.map((entry:any)=>({status:entry.status,reader:entry.response_reader})),actualSchemaShapes:shapes},
  stalledConsumption:stalled,retryConsumption:observations.filter((entry:any)=>entry.payload.activity.id===activityID && entry.payload.activity.attempt===1),sourceFiles,independentMaterializations:materializations,independentHelloChecks:checks,
  readonly:{sessions:facts.sessions.length,messages:facts.messages.length,ordinaryParts:facts.parts.length,events:facts.events.length,owners:facts.owners.length,pending:facts.pending.length,toolRequests:tools.requests.length,toolProgress:tools.progress.length,toolOutcomes:tools.outcomes.length,toolResults:tools.results.length},
  limits:["Native JSON.parse of the original current-attempt aggregate reports syntax_error, not complete JSON. Its exact grammatical position and Provider generation cause are unknown; raw pending arguments were not saved or reconstructed.","Whitespace deltas were consumed and accepted but did not renew the unchanged semantic idle. This does not justify executing an incomplete Tool or renewing idle on transport bytes.","Outgoing strict was absent/unknown; root required/property and nullable counts are observed shape, not a full recursive schema validity proof or evidence of causality.","Attempt1 public-shutdown cancellation is separate from attempt0 idle.","UI evidence qualifies the manually observed Explorer subset only; virtual/search/selection/retirement and formal ArtifactInspector delivery remain unqualified.","Restart, multi-project, Mission, non-Task and helper matrices remain unqualified by this genuine run."]}
fs.writeFileSync(path.join(root,"actual-44-first-failure-analysis.json"),JSON.stringify(report,null,2),{flag:"wx"})
console.log(JSON.stringify({originalTask:report.qualification.originalTask,structure:report.qualification.actualPendingStructureAndExactAttemptAssociation,requests:report.audit.requests,eof:report.audit.eof,aborted:report.audit.aborted,wholeElapsedMs,materializations:materializations.length,independentChecks:checks.length,physical:physical.map((entry:any)=>({attempt:entry.response_reader.requestContext.activity.attempt,chunks:entry.response_reader.chunkCount,bytes:entry.response_reader.byteCount,lastByte:entry.response_reader.lastByteReadAt,terminal:entry.response_reader.terminal}))}))
