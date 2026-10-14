const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{Database}=require('bun:sqlite');
const root='specs/artifacts/2026-10-13-compaction-stress';
const names=['runtime-user-selection-task-after-repair','runtime-user-selection-mission-after-repair','runtime-user-selection-task-during-repair','runtime-user-selection-mission-during-repair'];
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const runs=names.map(name=>{
 const report=read(path.join(root,name+'.json')),evidence=path.join(root,name+'.json.evidence');
 assert.equal(report.status,'passed');assert.equal(report.remoteModelRequests,0);assert.deepEqual(report.cases.map(c=>c.name),['alpha','beta']);
 assert.deepEqual(report.settlement.map(s=>({signal:s.signalCode,forced:s.forcedCleanup})),[{signal:'SIGKILL',forced:false},{signal:'SIGTERM',forced:false}]);
 for(const request of report.requests){assert.equal(request.body.stream,true);assert.equal(request.body.model,'checkpoint');assert(['alpha','beta'].includes(request.project));}
 const db=new Database(report.databasePath,{readonly:true});
 const usage=db.query('SELECT provider_id,model_id FROM provider_usage_event').all();
 assert.equal(usage.length,report.requests.length-2,'Exactly the two physically interrupted streams have no final usage receipt');
 for(const row of usage)assert.deepEqual(row,{provider_id:'opencorvus-compaction-crash',model_id:'checkpoint'});
 const before=read(path.join(evidence,'before-facts.json')),after=read(path.join(evidence,'after-facts.json')),beforeControls=read(path.join(evidence,'before-controls.json'));
 const cases=report.cases.map((c,index)=>{
  assert.deepEqual(c.acceptedInputs.map(i=>i.stage),['initial','correction','exercise']);
  const prior=before[index],current=after[index];assert.equal(prior.session.id,c.rootSessionID);assert.equal(current.session.id,c.rootSessionID);
  const checkpoint=read(path.join(evidence,c.name+'-checkpoint.json'));assert.equal(checkpoint.status,'valid_checkpoint');assert.equal(checkpoint.processExitCode,0);
  const selections=c.sourceSelections;assert.deepEqual(selections.map(s=>s.generation),report.cut==='during-compaction'?['before','recover']:['before']);
  const latest=selections.at(-1);assert.equal(checkpoint.summaryID,latest.helperID);
  for(const selected of selections){
   const req=db.query('SELECT message_id,data FROM tool_part_request WHERE id=?').get(selected.requestPartID),input=JSON.parse(req.data);
   assert.equal(req.message_id,selected.helperID);assert.equal(input.tool,'RetainCompactionUserText');assert.equal(input.callID,selected.callID);
   assert.deepEqual(input.input,{excerpts:[{part_id:selected.source.id,text:c.correctionQuote}]});
   const outcome=JSON.parse(db.query('SELECT data FROM tool_part_outcome WHERE request_part_id=?').get(selected.requestPartID).data);assert.equal(outcome.outcome,'completed');assert.deepEqual(JSON.parse(outcome.output),selected.receipt);
   const source=db.query('SELECT p.id,p.message_id,p.data,m.session_id,m.data owner FROM part p JOIN message m ON m.id=p.message_id WHERE p.id=?').get(selected.source.id),part=JSON.parse(source.data),owner=JSON.parse(source.owner);
   assert.equal(source.session_id,c.sessionID);assert.equal(owner.role,'user');assert.equal(owner.author,'user');assert.equal(part.text,c.correctionText);
   const refs=selected.receipt.sources;assert.equal(refs.length,1);const ref=refs[0];
   assert.deepEqual({sessionID:ref.sessionID,messageID:ref.messageID,partID:ref.partID,role:ref.originalRole,author:ref.originalAuthor},{sessionID:c.sessionID,messageID:source.message_id,partID:source.id,role:'user',author:'user'});
   const prefix=c.correctionText.slice(0,c.correctionText.indexOf(c.correctionQuote));assert(prefix.includes('😀'));
   assert.equal(ref.offset,prefix.length);assert.equal(ref.end,prefix.length+c.correctionQuote.length);assert.equal(part.text.slice(ref.offset,ref.end),c.correctionQuote);
   const pinned=report.requests.filter(q=>q.compaction&&q.project===c.name&&q.generation===selected.generation).filter(q=>q.body.messages.some(m=>m.role==='tool'&&m.tool_call_id===selected.callID));
   assert(pinned.length>=2,'The genuine selection frame remains visible before and after saving notes');
   for(const request of pinned)assert.deepEqual(JSON.parse(request.body.messages.find(m=>m.role==='tool'&&m.tool_call_id===selected.callID).content),selected.receipt);
  }
  const ref=latest.receipt.sources[0];assert.deepEqual(checkpoint.retainedUserSources,[{messageID:ref.messageID,role:'user',author:'user',parts:[{partID:ref.partID,text:c.correctionQuote}]}]);
  const accepted=c.acceptedInputs[1];assert.equal(accepted.text,c.correctionText);
  if(report.ownerKind==='task'){
   assert.equal(accepted.response.user_message.info.id,ref.messageID);assert.equal(accepted.response.user_message.info.role,'user');assert.equal(accepted.response.user_message.info.author,'user');
   assert.equal(accepted.response.user_message.parts.find(p=>p.type==='text').id,ref.partID);assert.equal(accepted.response.user_message.parts.find(p=>p.type==='text').text,c.correctionText);
   const ingress=db.query('SELECT source_id,task_id FROM engine_task_root_ingress WHERE id=?').get(accepted.response.ingress_id);assert.deepEqual(ingress,{source_id:ref.messageID,task_id:c.ownerID});
  }else for(const input of c.acceptedInputs){assert.equal(input.response.missionID,c.ownerID);assert.equal(input.response.sessionID,c.rootSessionID);}
  const recovered=report.requests.filter(q=>q.project===c.name&&q.generation==='recover'&&!q.compaction&&!q.textOnlyHelper);assert(recovered.length>0);
  for(const q of recovered){const values=q.body.messages.filter(m=>m.role==='user').flatMap(m=>typeof m.content==='string'?[m.content]:m.content.filter(p=>p.type==='text').map(p=>p.text));assert(values.includes(c.correctionQuote));}
  const originalReads=prior.tools.filter(t=>t.data.tool==='read');assert(originalReads.length>=2);
  for(const tool of originalReads){assert.equal(path.resolve(tool.data.input.filePath),path.resolve(c.project,'evidence.txt'));assert(prior.outcomes.some(o=>o.request_part_id===tool.id&&o.data.outcome==='completed'));}
  for(const collection of ['parts','tools','outcomes'])for(const old of prior[collection])assert.deepEqual(current[collection].find(v=>v.id===old.id)?.data,old.data);
  const interrupted=current.messages.find(m=>m.id===c.cutMessageID);assert.equal(interrupted.data.error.name,'ProcessExecutionInterruptedError');assert.equal(typeof interrupted.data.time.completed,'number');
  const summary=JSON.parse(db.query('SELECT data FROM message WHERE id=?').get(checkpoint.summaryID).data);assert.equal(summary.summary,true);assert.equal(summary.finish,'stop');assert.equal(typeof summary.time.completed,'number');
  const control=beforeControls[index].records.findLast(r=>r.kind==='compaction_request');assert(control);
  const events=db.query('SELECT kind,payload FROM session_control_event WHERE control_id=? ORDER BY time_created,id').all(control.id);assert.equal(events.findLast(e=>['consumed','failed'].includes(e.kind)).kind,'consumed');
  const amended=events.filter(e=>e.kind==='amended').map(e=>JSON.parse(e.payload)).at(-1);assert.equal(amended.result_summary_message_id,checkpoint.summaryID);
  const priorState=beforeControls[index].events.filter(e=>e.control_id===control.id&&['consumed','failed'].includes(e.kind)).at(-1)?.kind??'pending';assert.equal(priorState,report.cut==='during-compaction'?'pending':'consumed');
  const action=current.tools.find(t=>t.data.callID==='recovered_'+c.name);assert(action);assert.equal(action.data.tool,report.ownerKind==='task'?'no_action':'panel_complete_mission');assert(current.outcomes.some(o=>o.request_part_id===action.id&&o.data.outcome==='completed'));
  if(report.ownerKind==='mission'){const publicOutcome=read(path.join(evidence,c.name+'-public-outcome.json'));assert.equal(publicOutcome.outcome.kind,'accepted');assert.equal(publicOutcome.outcome.toolPartID,action.id);assert.equal(publicOutcome.outcome.toolCallID,action.data.callID);}
  return {name:c.name,ownerID:c.ownerID,sessionID:c.sessionID,rootSessionID:c.rootSessionID,originalUser:{messageID:ref.messageID,partID:ref.partID,role:'user',author:'user',offset:ref.offset,end:ref.end,text:c.correctionQuote},selections:selections.map(s=>({generation:s.generation,helperID:s.helperID,callID:s.callID,requestPartID:s.requestPartID})),summaryID:checkpoint.summaryID,controlID:control.id,control:'consumed',normalRecoveredRequests:recovered.length,trace:c.trace,interruptedMessageID:c.cutMessageID,completionTool:action.data.tool};
 });
 db.close();
 return {name,status:'passed',owner:report.ownerKind,cut:report.cut,localRequests:report.requests.length,finalUsageReceipts:usage.length,interruptedStreams:2,settledBackends:report.settlement,cases};
});
const result={status:'passed_mechanics',runs,cases:runs.flatMap(r=>r.cases).length,localRequests:runs.reduce((n,r)=>n+r.localRequests,0),finalUsageReceipts:runs.reduce((n,r)=>n+r.finalUsageReceipts,0),interruptedStreams:8,paidRequestsAdded:0,paidCumulative:999,limits:['Scripted transport proves source delivery, storage and physical backend recovery; not real-model instruction reasoning.','Luna alternating-read/action failure, larger scale, cross-vendor/native product state and whole-OS power loss remain open.']};
assert.equal(result.cases,8);assert.equal(result.localRequests,120);assert.equal(result.finalUsageReceipts,112);
fs.writeFileSync(path.join(root,'runtime-user-selection-matrix-summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,cases:result.cases,localRequests:result.localRequests,finalUsageReceipts:result.finalUsageReceipts,interruptedStreams:result.interruptedStreams}));
