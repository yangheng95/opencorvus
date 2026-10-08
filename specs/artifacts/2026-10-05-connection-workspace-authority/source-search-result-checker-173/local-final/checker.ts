import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import { Database } from 'bun:sqlite'
import { Message } from '../packages/opencorvus/src/session/message'
import { timelineOrderKey, compareTimelineOrderKeys } from '../packages/opencorvus/src/timeline/order'

// Import is deliberately NOT pure: production Message initializes Sharp and BusEvent definitions.
type Source = ReturnType<typeof Message.SourcePayload.parse>
type Persisted = { partID:string;messageID:string;sessionID:string;orderKey:string;payload:unknown }
export type Batch = {partID:string;messageID:string;sessionID:string;outcome:string;sources:unknown;failure?:unknown}
export class SearchSourceQualificationError extends Error {
 constructor(readonly code:string){super(code);this.name='SearchSourceQualificationError'}
}
function requireFact(ok:unknown,code:string):asserts ok{if(!ok)throw new SearchSourceQualificationError(code)}
function parseSource(raw:unknown):Source{
 try {
  const parsed=Message.SourcePayload.safeParse(raw)
  if(!parsed.success)throw new SearchSourceQualificationError('SEARCH_SOURCE_PAYLOAD_INVALID')
  return parsed.data
 } catch {throw new SearchSourceQualificationError('SEARCH_SOURCE_PAYLOAD_INVALID')}
}
const identity=(x:Source)=>`${x.type}\0${x.sourceId}`
export function qualifyBatch(batch:Batch,persisted:readonly Persisted[],allBatches:readonly Batch[]){
 if(batch.outcome==='failed')return {state:'actual_tool_error' as const,partID:batch.partID,failure:batch.failure}
 if(batch.outcome!=='completed')return {state:'actual_tool_pending' as const,partID:batch.partID}
 requireFact(Array.isArray(batch.sources),'SEARCH_RESULT_SOURCES_ABSENT')
 const sources=batch.sources.map(parseSource)
 const unique=new Map<string,Source>()
 for(const source of sources)if(!unique.has(identity(source)))unique.set(identity(source),source)
 const current=persisted.filter(p=>p.messageID===batch.messageID&&p.sessionID===batch.sessionID).map(p=>({...p,payload:parseSource(p.payload)}))
 const memberships=[...unique].map(([key,source])=>{
  const matches=current.filter(p=>identity(p.payload)===key)
  requireFact(matches.length===1,'SEARCH_DURABLE_SOURCE_MEMBERSHIP_INVALID')
  const row=matches[0]!
  const otherProducers=allBatches.filter(other=>other.partID!==batch.partID&&other.messageID===batch.messageID&&other.sessionID===batch.sessionID&&other.outcome==='completed'&&Array.isArray(other.sources)&&other.sources.map(parseSource).some(s=>identity(s)===key)).map(x=>x.partID)
  if(otherProducers.length>0)return {partID:row.partID,identity:key,state:'ambiguous_multi_producer_batch' as const,otherProducers,persisted:row.payload,returned:source,orderKey:row.orderKey}
  requireFact(isDeepStrictEqual(row.payload,source),'SEARCH_DURABLE_SOURCE_PAYLOAD_MISMATCH')
  return {partID:row.partID,identity:key,state:'full_payload_membership' as const,otherProducers,persisted:row.payload,returned:source,orderKey:row.orderKey}
 })
 const ambiguous=memberships.some(x=>x.state==='ambiguous_multi_producer_batch')
 if(!ambiguous)for(let i=1;i<memberships.length;i++)requireFact(compareTimelineOrderKeys(memberships[i-1]!.orderKey,memberships[i]!.orderKey)<0,'SEARCH_DURABLE_SOURCE_ORDER_MISMATCH')
 return {state:ambiguous?'ambiguous_multi_producer_batch':sources.length!==unique.size?'repeated_identity_first_winner':'valid_batch_durable_projection',partID:batch.partID,returnedCount:sources.length,distinctCount:unique.size,memberships,boundary:'Same-message payload membership/order, not inferred minting or rendered group count'}
}
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'))
const save=(p:string,v:unknown)=>fs.writeFileSync(p,JSON.stringify(v,null,2),{flag:'wx'})
type Row=Record<string,any>
const tree=`WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION SELECT s.id FROM session s JOIN tree t ON s.parent_id=t.id)`

function closedAudit(args:string[]){
 requireFact(args.length===5,'SEARCH_AUDIT_ARGUMENTS_INVALID')
 const [runArg,evidenceArg,numeric,prefix,auditArg]=args as [string,string,string,string,string]
 requireFact(path.isAbsolute(runArg)&&path.isAbsolute(evidenceArg)&&path.isAbsolute(auditArg)&&/^\d+$/.test(numeric)&&/^[a-z0-9-]+$/.test(prefix),'SEARCH_AUDIT_ARGUMENTS_INVALID')
 const run=path.resolve(runArg),e=path.resolve(evidenceArg)
 let db:Database|undefined
 try{
  const owner=read(path.join(run,'launch-owner.json')),selection=read(path.join(e,`actual-${numeric}-task-selection.json`)),request=read(path.join(e,`actual-${numeric}-task-request-input.json`)),complete=read(path.join(e,'task-complete.json')),boundary=read(path.join(e,'task-boundary-admitted.json')),physical=read(path.join(e,`${prefix}-physical-terminal-and-pair-cleanup.json`)),settled=read(path.join(e,'native-host-settled.json')),fresh=read(path.join(e,'search-sources-fresh-native-guard.json')),audit=read(auditArg)
  save(path.join(e,'search-sources-custody-173.json'),{owner:{occurrence:owner.occurrence,runRoot:owner.runRoot,evidencePrefix:owner.evidencePrefix,settlementEvidenceRoot:owner.settlementEvidenceRoot,port:owner.port,project:owner.project,host:owner.host,target:owner.nativeTarget},selection,pinned:complete.pinned,lifecycle:complete.lifecycle,fresh})
  assert.equal(path.resolve(owner.runRoot),run);assert.equal(owner.evidencePrefix,prefix);assert.equal(path.resolve(owner.settlementEvidenceRoot),e);assert.equal(selection.occurrence,owner.occurrence);assert.equal(path.resolve(selection.directory),path.resolve(owner.project));assert.equal(selection.productPillar,'work');assert.equal(request.requestID,selection.requestID)
  assert.deepEqual(complete.selected,selection);assert.deepEqual(boundary.selected,selection);assert.deepEqual(boundary.pinned,complete.pinned);assert.equal(boundary.totalDeadlineMs,complete.pinned.openedAt+900000);assert.equal(complete.pid,owner.nativeTarget.pid);assert.equal(complete.occurrence,owner.occurrence);assert.equal(complete.lifecycle.status,'completed');assert.equal(complete.lifecycle.epoch,complete.pinned.epoch);assert.equal(complete.pinned.taskID,selection.taskID);assert.equal(complete.pinned.projectID,selection.projectID);assert.equal(complete.lifecycle.openedEventID,complete.pinned.openedEventID);assert.equal(complete.lifecycle.openedAt,complete.pinned.openedAt)
  for(const s of [physical.nativeSettlement,settled]){assert.equal(s.occurrence,owner.occurrence);assert.equal(s.outcome,'settled');assert.deepEqual(s.host,owner.host);assert.deepEqual(s.target,owner.nativeTarget);assert.equal(s.physicalCompletion,true);assert.equal(s.outputDrainComplete,true);assert.equal(s.requestCleanupComplete,true)}
  assert.equal(physical.occurrence,owner.occurrence);assert.equal(physical.physicalCompletion,true);assert.equal(physical.pairedCleanupComplete,true);assert.equal(physical.copiedPair.length,2);for(const p of physical.copiedPair)assert.equal(p.presentAfter,false)
  assert.equal(fresh.occurrence,owner.occurrence);assert.deepEqual(fresh.host,owner.host);assert.deepEqual(fresh.target,owner.nativeTarget);assert.equal(fresh.port,owner.port);assert.equal(fresh.hostState,'dead_or_reused');assert.equal(fresh.targetState,'dead_or_reused');assert.equal(fresh.listenerCount,0);assert.equal(fresh.authPresent,false);assert.equal(fresh.modelsPresent,false)
  db=new Database(path.join(run,'runtime/data/opencorvus.db'),{readonly:true});db.exec('BEGIN')
  const task=db.query('SELECT id,project_id,session_id,request_id,request,product_pillar FROM engine_task WHERE id=?').get(selection.taskID) as Row
  const sessions=db.query(tree+' SELECT s.id,s.project_id,s.parent_id,s.kind FROM session s JOIN tree ON tree.id=s.id ORDER BY s.time_created,s.id').all(selection.taskID) as Row[]
  const lifecycle=db.query("SELECT id,type,seq,emitted_at,json_extract(payload,'$.execution_epoch') AS epoch FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=? AND type IN ('task.execution.opened','task.execution.reopened','task.completed','task.failed','task.cancelled') ORDER BY seq,id").all(selection.taskID) as Row[]
  const owners=db.query(tree+' SELECT o.session_id FROM session_prompt_owner o JOIN tree ON tree.id=o.session_id').all(selection.taskID)
  const partRows=db.query(tree+' SELECT p.id,p.message_id,p.data,p.time_created,m.session_id FROM part p JOIN message m ON m.id=p.message_id JOIN tree ON tree.id=m.session_id ORDER BY p.time_created,p.id').all(selection.taskID) as Row[]
  const tools=db.query(tree+' SELECT r.id,r.message_id,r.data,r.time_created,m.session_id,o.data AS outcome_data FROM tool_part_request r JOIN message m ON m.id=r.message_id JOIN tree ON tree.id=m.session_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id ORDER BY r.time_created,r.id').all(selection.taskID) as Row[]
  const batches:Batch[]=[],searchFacts:unknown[]=[]
  const terminalTools:Row[]=[]
  for(const row of tools){const input=JSON.parse(row.data),outcome=row.outcome_data?JSON.parse(row.outcome_data):null
   if(input.tool==='manage_task')terminalTools.push({...row,data:input,outcome,orderKey:timelineOrderKey({domain:'part',time:row.time_created,id:row.id})})
   let result:Row|null=null
   if(outcome?.outcome==='completed'&&outcome.resultAttemptID){const envelope=db.query('SELECT result FROM permission_execution_result WHERE attempt_id=?').get(outcome.resultAttemptID) as Row|null;if(envelope){const parsed=JSON.parse(envelope.result);if(parsed.kind==='json')result=parsed.value}}
   const batch={partID:row.id,messageID:row.message_id,sessionID:row.session_id,outcome:outcome?.outcome??'pending',sources:result?.sources,failure:outcome?.failure}
   if(Array.isArray(result?.sources)||input.tool==='websearch')batches.push(batch)
   if(input.tool==='websearch')searchFacts.push({...batch,query:input.input?.query,metadata:outcome?.metadata,resultAttemptID:outcome?.resultAttemptID,resultEnvelopePresent:result!==null})
  }
  const sources:Persisted[]=partRows.flatMap(row=>{const p=JSON.parse(row.data);if(!['source-url','source-file','source-document'].includes(p.type))return[];const {id,messageID,sessionID,...payload}=p;return[{partID:row.id,messageID:row.message_id,sessionID:row.session_id,orderKey:timelineOrderKey({domain:'part',time:row.time_created,id:row.id}),payload}]})
  const texts=db.query('SELECT p.id,p.message_id,p.time_created,p.data,m.session_id FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? AND json_extract(m.data,\'$.role\')=\'assistant\' AND json_extract(p.data,\'$.type\')=\'text\' ORDER BY p.time_created,p.id').all(complete.pinned.rootSessionID) as Row[]
  const decisions=db.query("SELECT id,payload FROM engine_artifact WHERE task_id=? AND kind='task_completion_decision' ORDER BY time_created,id").all(selection.taskID) as Row[]
  const provider=audit.requests.map((r:Row)=>({model:r.model,streaming:r.streaming,status:r.status,state:r.response_reader?.state,terminal:r.response_reader?.terminal?.kind,context:r.context}))
  save(path.join(e,'search-sources-facts-173.json'),{access:'readonly BEGIN/ROLLBACK; no bootstrap; nonpure Message schema import',selection,task,sessions,lifecycle,promptOwners:owners,searchFacts,batches,sources,texts:texts.map(r=>({partID:r.id,messageID:r.message_id,sessionID:r.session_id,orderKey:timelineOrderKey({domain:'part',time:r.time_created,id:r.id}),text:JSON.parse(r.data).text})),decisions:decisions.map(r=>({id:r.id,payload:JSON.parse(r.payload)})),terminalTools,provider})
  assert.ok(task);assert.equal(task.request_id,selection.requestID);assert.equal(task.request,request.request);assert.equal(task.project_id,selection.projectID);assert.equal(task.product_pillar,'work');assert.equal(task.session_id,complete.pinned.rootSessionID);for(const s of sessions)assert.equal(s.project_id,selection.projectID);assert.deepEqual(sessions.map(s=>s.id).sort(),[...complete.sessionIDs].sort());assert.deepEqual(owners,[])
  assert.equal(lifecycle.at(-1)?.id,complete.lifecycle.terminalEventID);assert.equal(lifecycle.at(-1)?.type,'task.completed');assert.equal(lifecycle.at(-1)?.epoch,complete.pinned.epoch);assert.equal(lifecycle.at(-1)?.emitted_at,complete.lifecycle.terminalAt);const opened=lifecycle.find(x=>x.id===complete.pinned.openedEventID);assert.ok(opened);assert.equal(opened.epoch,complete.pinned.epoch);assert.equal(opened.emitted_at,complete.pinned.openedAt)
  assert.equal(provider.length,complete.requests);for(const p of provider)assert.deepEqual({model:p.model,streaming:p.streaming,status:p.status,state:p.state,terminal:p.terminal},{model:'gpt-6.1-sol',streaming:true,status:200,state:'settled',terminal:'eof'});assert.equal(audit.maxRequests,owner.requestBudget);assert.ok(provider.length<=owner.requestBudget)
  requireFact(decisions.length===1,'SEARCH_COMPLETION_DECISION_INVALID');const decision=JSON.parse(decisions[0]!.payload);const terminal=terminalTools.find(t=>t.id===decision.tool_part_id);requireFact(terminal,'SEARCH_TERMINAL_TOOL_MISSING');assert.equal(terminal.data.input.action,'complete_task');assert.equal(terminal.data.callID,decision.tool_call_id);assert.equal(terminal.session_id,decision.orchestrator_session_id);assert.equal(terminal.message_id,decision.orchestrator_message_id);assert.equal(terminal.outcome?.outcome,'completed')
  const answer=texts.filter(t=>typeof JSON.parse(t.data).text==='string'&&JSON.parse(t.data).text.trim().length>0&&compareTimelineOrderKeys(timelineOrderKey({domain:'part',time:t.time_created,id:t.id}),terminal.orderKey)<0);requireFact(answer.length>0,'SEARCH_PRETERMINAL_ANSWER_MISSING')
  const searchIDs=new Set((searchFacts as Row[]).map(s=>s.partID));const qualifications=batches.filter(b=>searchIDs.has(b.partID)).map(b=>qualifyBatch(b,sources,batches));save(path.join(e,'search-sources-qualification-173.json'),{qualifications,answerPartIDs:answer.map(t=>t.id),terminalPartID:terminal.id,boundary:'Chinese semantics and rendered Source grouping require Root manual review'})
  requireFact(qualifications.some(q=>'distinctCount' in q&&typeof q.distinctCount==='number'&&q.distinctCount>1&&q.state==='valid_batch_durable_projection'),'SEARCH_MULTI_SOURCE_OBJECTIVE_UNMET')
  requireFact(qualifications.every(q=>q.state==='valid_batch_durable_projection'||q.state==='repeated_identity_first_winner'),'SEARCH_BATCH_INCOMPLETE')
  console.log(JSON.stringify({status:'qualified',taskID:selection.taskID,qualifications,answerPartIDs:answer.map(t=>t.id),boundary:'Data contract only, not UI/group-count/official guidance semantics'}))
 }catch(error){save(path.join(e,'search-sources-error-173.json'),{name:error instanceof Error?error.name:'UnknownError',code:error instanceof SearchSourceQualificationError?error.code:'SEARCH_AUDIT_SCOPE_OR_DATA_CONTRACT_FAILED'});throw error}finally{if(db){try{db.exec('ROLLBACK')}finally{db.close()}}}
}
if(import.meta.main)closedAudit(process.argv.slice(2))
