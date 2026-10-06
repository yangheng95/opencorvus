import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"

const root="D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/explorer-initial-loading"
const read=(name:string)=>JSON.parse(fs.readFileSync(path.join(root,name),"utf8").replace(/^\uFEFF/,""))
const facts=read("actual-50-readonly-facts.json")
const tools=read("actual-50-readonly-tool-facts.json")
const complete=read("runtime-evidence-50/task-complete.json")
const audit=read("initial-loading-50-final-provider-audit.json")
const closure=read("initial-loading-50-physical-terminal-and-pair-cleanup.json")
const trace=fs.readFileSync(path.join(root,"actual-50-task-trace.jsonl"),"utf8").trim().split("\n").map(line=>JSON.parse(line))
const observations=trace.filter(event=>event.kind==="llm_stream_observation")
const taskSessionIDs=new Set(complete.sessionIDs)
assert.deepEqual({status:complete.lifecycle.status,epoch:complete.lifecycle.epoch,event:complete.lifecycle.terminalEventID,owners:complete.ownedPromptSessions},{status:"completed",epoch:1,event:"pev_g0VXJLtCd00R3G8q0jLs",owners:[]})
assert.equal(complete.selected.taskID,facts.selected.taskID)
assert.equal(audit.requests.length,71)
let associated=0
for(const request of audit.requests){
  assert.deepEqual({model:request.model,stream:request.streaming,status:request.status,terminal:request.response_reader.terminal.kind},{model:"gpt-6.1-sol",stream:true,status:200,terminal:"eof"})
  const context=request.response_reader.requestContext
  if(!context?.activity||!taskSessionIDs.has(context.sessionID))continue
  const event=observations.find(event=>event.payload.phase==="settled"&&event.payload.activity.id===context.activity.id&&event.payload.activity.attempt===context.activity.attempt)
  assert(event)
  assert.deepEqual(event.payload.streamRequest,context.streamRequest)
  assert.deepEqual(event.payload.activity,context.activity)
  assert.equal(event.sessionID,context.sessionID)
  associated++
}
assert.equal(associated,68)
const wholeElapsedMs=Date.parse(closure.observedAtUtc)-complete.pinned.openedAt
assert(wholeElapsedMs<=900000)
assert.equal(wholeElapsedMs,886676)
const expectedHello=Buffer.from("Hello from a formal Task.\n")
const expectedNotes=Buffer.from("Notes from a formal Task.\n".repeat(20))
const sourceFiles=[{name:"hello.txt",expected:expectedHello},{name:"notes.txt",expected:expectedNotes}].map(({name,expected})=>{
  const bytes=fs.readFileSync(path.join(facts.selected.directory,name));assert.deepEqual(bytes,expected)
  return{name,bytes:bytes.length,completeLiteralComparison:"passed",scope:"Root offline actual source, separate from participant checks"}
})
const requests=tools.requests.map((request:any)=>({...request,data:JSON.parse(request.data)}))
const verifier=requests.filter((request:any)=>request.session_id==="ses_hBkcd6U9aAxsXULs3wIs")
const resultFor=(request:any)=>{const result=tools.results.find((result:any)=>result.requestID===request.id);assert(result);return JSON.parse(result.output)}
const reads=verifier.filter((request:any)=>request.data.tool==="artifact_read"&&request.data.input.reads?.some((item:any)=>item.delivery==="materialized_file")).map((request:any)=>{
  const value=resultFor(request).results[0].value
  return{requestID:request.id,messageID:request.message_id,locator:value.locator,readRef:value.artifact_read_ref,path:value.materialized_path,complete:value.complete,bytes:value.total_bytes}
})
assert.deepEqual(reads.map((value:any)=>({complete:value.complete,bytes:value.bytes})),[{complete:true,bytes:26},{complete:true,bytes:26},{complete:true,bytes:520}])
assert.deepEqual(reads[0].locator,reads[1].locator)
const checks=verifier.filter((request:any)=>request.data.tool==="bash").map((request:any)=>({requestID:request.id,messageID:request.message_id,input:request.data.input,output:resultFor(request)}))
assert.deepEqual(checks.map((check:any)=>({step:check.output.step,mode:check.output.mode,eof:check.output.read_to_eof,bytes:check.output.bytes,exact:check.output.exact_match,bom:check.output.bom,cr:check.output.cr_count,lf:check.output.lf_count,lines:check.output.line_count})),[{step:2,mode:"rb",eof:true,bytes:26,exact:true,bom:false,cr:0,lf:1,lines:1},{step:4,mode:"rb",eof:true,bytes:26,exact:true,bom:false,cr:0,lf:1,lines:1},{step:6,mode:"rb",eof:true,bytes:520,exact:true,bom:false,cr:0,lf:20,lines:20}])
checks.forEach((check:any,index:number)=>assert.deepEqual(Buffer.from(check.output.full_bytes_hex,"hex"),index===2?expectedNotes:expectedHello))
const sequence=verifier.filter((request:any)=>reads.some((read:any)=>read.requestID===request.id)||checks.some((check:any)=>check.requestID===request.id))
assert.deepEqual(sequence.map((request:any)=>request.data.tool),["artifact_read","bash","artifact_read","bash","artifact_read","bash"])
const acceptance=verifier.find((request:any)=>request.data.tool==="artifact_publish"&&request.data.input.artifact_type==="task-resource-qa/independent-acceptance")
assert(acceptance)
const acceptanceResult=resultFor(acceptance)
assert.equal(acceptanceResult.locator.source,"engine_artifact")
const snapshot=reads[0].locator.ref.snapshot
assert.deepEqual(reads[2].locator.ref.snapshot,snapshot)
const downloaded=read("actual-50-native-notes-download.json")
assert.deepEqual(fs.readFileSync(downloaded.file.FullName),expectedNotes)
const report={observedAtUtc:new Date().toISOString(),selected:facts.selected,completion:complete,
  qualification:{originalTask:"passed",actualProviderStreamingModelAndCallerAssociation:"passed",independentHelloCacheReopens:"passed_twice",independentNotesCacheReopen:"passed",independentAcceptancePublication:"passed",formalResourceSnapshotPreviewsAndNativeNotesDownload:"passed_scoped",initialExplorerPendingToList:"passed",old44Task:"failed_unchanged"},
  native:{wholeElapsedMs,fixedWholeMaximumMs:900000,closure,independent:read("actual-50-independent-closure.json")},audit:{requests:audit.requests.length,eof:audit.requests.length,actualFormalActivityResponsesAssociated:associated},
  independentMaterializations:reads,independentChecks:checks,acceptance:{requestID:acceptance.id,messageID:acceptance.message_id,result:acceptanceResult},snapshot,sourceFiles,nativeDownload:downloaded,
  readonly:{sessions:facts.sessions.length,messages:facts.messages.length,ordinaryParts:facts.parts.length,events:facts.events.length,owners:facts.owners.length,pending:facts.pending.length,toolRequests:tools.requests.length,toolProgress:tools.progress.length,toolOutcomes:tools.outcomes.length,toolResults:tools.results.length},
  consumption:{logicalSettledSnapshots:observations.filter(event=>event.payload.phase==="settled").length,pendingStates:observations.map(event=>({activity:event.payload.activity,phase:event.payload.phase,pending:event.payload.pendingToolInputs}))},
  limits:["Successful50 does not repair or erase original44 generation idle, and concise request phrasing is not a proven causal explanation.","Initial pending/nonempty list, same-row focus and current-file body are actual Root visual observations; successful empty, failure/Retry, reactivation pending instant and search-no-match remain unqualified.","Formal resource preview top/bottom and snapshot child were viewed; the separately named middle screenshot returned to top, so it does not prove a middle-row visual range.","Producer full-conversation pointer clicks did not show the expected panel; pointer/keyboard hit-path diagnosis remains open51.","Restart/Mission/multi-project concurrency/helper matrices and earlier missing evidence remain unqualified."]}
fs.writeFileSync(path.join(root,"actual-50-offline-qualification.json"),JSON.stringify(report,null,2),{flag:"wx"})
console.log(JSON.stringify({task:report.qualification.originalTask,requests:audit.requests.length,eof:audit.requests.length,associated,wholeElapsedMs,materializations:reads.length,independentChecks:checks.length,acceptance:acceptanceResult.locator,downloadBytes:downloaded.bytes}))
