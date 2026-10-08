import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
const args=process.argv.slice(2)
assert.equal(args.length,4,"Mandatory Run/Evidence/Case/Prefix")
const [run,evidence,evidenceCase,prefix]=args
assert.ok(run&&evidence&&evidenceCase&&prefix)
assert.equal(path.resolve(run),path.resolve("C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/source-file-live-128-01"))
assert.equal(path.resolve(evidence),path.resolve("D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-file-live-128/live-01"))
assert.equal(evidenceCase,"12801");assert.equal(prefix,"source-file-live-128-01")
const read=(file:string)=>JSON.parse(fs.readFileSync(file,"utf8"))
const owner=read(path.join(run,"launch-owner.json")), selected=read(path.join(evidence,`actual-${evidenceCase}-task-selection.json`)), physical=read(path.join(evidence,`${prefix}-physical-terminal-and-pair-cleanup.json`))
assert.equal(owner.occurrence,selected.occurrence);assert.equal(physical.occurrence,owner.occurrence);assert.equal(owner.evidencePrefix,prefix);assert.equal(path.resolve(owner.runRoot),path.resolve(run));assert.equal(path.resolve(owner.settlementEvidenceRoot),path.resolve(evidence));assert.equal(owner.port,18089)
assert.equal(physical.physicalCompletion,true);assert.equal(physical.pairedCleanupComplete,true);assert.equal(physical.nativeSettlement.occurrence,owner.occurrence);assert.equal(physical.nativeSettlement.outputDrainComplete,true);assert.equal(physical.nativeSettlement.requestCleanupComplete,true)
assert.deepEqual(physical.nativeSettlement.host,owner.host);assert.deepEqual(physical.nativeSettlement.target,owner.nativeTarget)
for(const name of ["auth.json","models.json"]){const expected=path.join(run,"runtime/data",name);const member=physical.copiedPair.find((row:{path:string})=>path.resolve(row.path)===path.resolve(expected));assert.ok(member);assert.equal(member.presentAfter,false);assert.equal(fs.existsSync(expected),false)}
const errorScalars=(failure:unknown):unknown=>{
 if(!failure||typeof failure!=="object")return {kind:typeof failure}
 const value=failure as Record<string,unknown>, output:Record<string,unknown>={}
 for(const key of ["kind","domain","name","code","message","originSite","classification"]){if(typeof value[key]==="string")output[key]=key==="message"?(value[key] as string).split(/\r?\n/,1)[0]:value[key]}
 if(value.data&&typeof value.data==="object"){const data=value.data as Record<string,unknown>;for(const key of ["code","error_code","error_name"]){if(typeof data[key]==="string")output[key]=data[key]}}
 return output
}
const db=new Database(path.join(run,"runtime/data/opencorvus.db"),{readonly:true})
try{db.exec("BEGIN")
 const task=db.query("SELECT id,project_id,session_id,request_id,product_pillar FROM engine_task WHERE id=?").get(selected.taskID) as Record<string,unknown>|null
 const sessions=db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT s.id,s.parent_id,s.project_id,s.kind,s.directory FROM session s JOIN tree t ON t.id=s.id ORDER BY s.time_created,s.id").all(selected.taskID) as Record<string,unknown>[]
 const ids=sessions.map(row=>String(row.id)), placeholders=ids.map(()=>"?").join(",")
 const events=db.query("SELECT id,type,seq,payload,emitted_at FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=? ORDER BY seq,id").all(selected.taskID) as Record<string,unknown>[]
 const lifecycle=events.filter(row=>String(row.type).startsWith("task.execution.")||["task.completed","task.failed","task.cancelled","task.cancellation.requested"].includes(String(row.type))).map(row=>{const data=JSON.parse(String(row.payload));return {id:row.id,type:row.type,seq:row.seq,emittedAt:row.emitted_at,epoch:data.execution_epoch,terminalReason:data.terminalReason,error:errorScalars(data.error)}})
 const rows=db.query(`SELECT r.id,r.message_id,m.session_id,r.data,o.data outcome_data FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id IN (${placeholders}) ORDER BY r.time_created,r.id`).all(...ids) as Record<string,unknown>[]
 const tools=rows.map(row=>{const req=JSON.parse(String(row.data)),out=row.outcome_data?JSON.parse(String(row.outcome_data)):null;return {partID:row.id,messageID:row.message_id,sessionID:row.session_id,callID:req.callID,tool:req.tool,input:req.tool==="read"?{filePath:req.input?.filePath,offset:req.input?.offset,limit:req.input?.limit}:undefined,outcome:out?.outcome,failure:errorScalars(out?.failure),resultAttemptID:out?.resultAttemptID}}).filter(row=>row.tool==="read"||row.tool==="question")
 const sourceRows=db.query(`SELECT p.id,p.message_id,m.session_id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id IN (${placeholders}) AND json_extract(p.data,'$.type') IN ('source-url','source-file','source-document') ORDER BY p.time_created,p.id`).all(...ids) as Record<string,unknown>[]
 const sources=sourceRows.map(row=>{const data=JSON.parse(String(row.data));return {partID:row.id,messageID:row.message_id,sessionID:row.session_id,type:data.type,sourceID:data.sourceId,path:data.path,range:data.range,provider:data.provider}})
 const bindings=db.query("SELECT id,payload FROM engine_artifact WHERE task_id=? AND kind='task_execution_capsule_binding' ORDER BY time_created,id").all(selected.taskID) as Record<string,unknown>[]
 const capsule=bindings.map(row=>{const p=JSON.parse(String(row.payload));return {artifactID:row.id,protocol:p.protocol,taskID:p.task_id,projectID:p.project_id,mode:p.mode,logicalWorkspaceRoot:p.logical_workspace_root,workspaceRoot:p.workspace_root,workspace:p.workspace?{root:p.workspace.root,access:p.workspace.access}:undefined,timeCreated:p.time_created}})
 const interactions=db.query("SELECT i.id,i.source_kind,i.source_id,i.session_id,i.request_type,e.id owner_event_id,b.event_type,b.properties,o.outcome,o.source_occurrence_id,terminal.event_type terminal_event_type FROM engine_interaction_request i JOIN protocol_event e ON e.interaction_id=i.id AND e.type='interaction.requested' AND e.aggregate_type='task' AND e.aggregate_id=? LEFT JOIN bus_publication_outbox b ON i.source_kind='bus_question' AND b.occurrence_id=i.source_id LEFT JOIN engine_interaction_outcome o ON o.interaction_id=i.id LEFT JOIN bus_publication_outbox terminal ON terminal.occurrence_id=o.source_occurrence_id ORDER BY i.id").all(selected.taskID) as Record<string,unknown>[]
 const questions=interactions.map(row=>{const props=row.properties?JSON.parse(String(row.properties)):null;const sessionID=props?.sessionID??row.session_id;const actor=sessions.find(session=>session.id===sessionID);return {interactionID:row.id,ownerEventID:row.owner_event_id,sourceKind:row.source_kind,sourceOccurrenceID:row.source_id,sourceEventType:row.event_type,requestType:row.request_type,questionID:props?.id,sessionID,actorKind:actor?.kind,parentSessionID:actor?.parent_id,projectID:actor?.project_id,tool:props?.tool,questionCount:Array.isArray(props?.questions)?props.questions.length:undefined,outcome:row.outcome,outcomeOccurrenceID:row.source_occurrence_id,terminalEventType:row.terminal_event_type}})
 const facts={observedAt:new Date().toISOString(),access:"Closed exact SQLite readonly BEGIN/ROLLBACK, scalar only; no complete oracle/bootstrap",occurrence:owner.occurrence,selected,task,sessions,lifecycle,tools,questions,sourceCount:sources.length,sources,capsule}
 fs.writeFileSync(path.join(evidence,"actual-12801-blocked-facts.json"),JSON.stringify(facts,null,2),{flag:"wx"})
 assert.ok(task);assert.equal(task.id,selected.taskID);assert.equal(task.project_id,selected.projectID);assert.equal(task.request_id,selected.requestID)
 for(const binding of capsule){assert.equal(binding.taskID,selected.taskID);assert.equal(binding.projectID,selected.projectID)}
 console.log(JSON.stringify({status:"observed_blocked_case",taskID:selected.taskID,readTools:tools.filter(row=>row.tool==="read"),sourceCount:sources.length,questionCount:questions.length,capsule,boundary:"No Taskcomplete or permission decision inferred; original blocked failure preserved"}))
}finally{db.exec("ROLLBACK");db.close()}
