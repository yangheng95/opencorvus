const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root='specs/artifacts/2026-10-13-compaction-stress',name=process.argv[2];
assert(['user-selection-crash-smoke','user-selection-crash-matrix','user-excerpt-crash-matrix'].includes(name));
const report=JSON.parse(fs.readFileSync(path.join(root,name+'.json')));
assert.equal(report.status,'passed');assert.equal(report.remoteModelRequests,0);
const expected=name.endsWith('smoke')?[['streaming','automatic'],['checkpoint_saved','automatic']]:['streaming','summary_saved','checkpoint_transaction','checkpoint_saved'].flatMap(cut=>['manual','automatic'].map(kind=>[cut,kind]));
assert.deepEqual(report.cases.map(c=>`${c.cut}/${c.kind}`).sort(),expected.map(([cut,kind])=>`${cut}/${kind}`).sort());
const codes={streaming:81,summary_saved:82,checkpoint_transaction:83,checkpoint_saved:84};
const cases=report.cases.map(c=>{
 assert.equal(c.status,'passed');assert.equal(c.settlementConfirmed,true);
 assert.deepEqual(c.phases.map(p=>({mode:p.mode,exit:p.exitCode,settled:p.settlementConfirmed})),[{mode:'cut',exit:codes[c.cut],settled:true},{mode:'recover',exit:0,settled:true},{mode:'inspect',exit:0,settled:true}]);
 const source=c.source,original=source.correction,part=original.parts.find(p=>p.type==='text');
 assert.equal(original.info.role,'user');assert.equal(original.info.author,'user');
 const excerpt=name==='user-excerpt-crash-matrix'?source.correctionExcerpt:{text:part.text,offset:0};
 assert.equal(excerpt.text,'Correction: use eu-west. Permission remains read only.');
 assert.equal(excerpt.offset,name==='user-excerpt-crash-matrix'?'Earlier location: us-east.\n'.length:0);
 assert.equal(part.text.slice(excerpt.offset,excerpt.offset+excerpt.text.length),excerpt.text);
 const retained={...original,parts:original.parts.map(p=>p.type==='text'?{...p,text:excerpt.text}:p)};
 const cut=c.phases[0].events.find(e=>e.stage==='cut');assert.equal(cut.pid,source.cutPID);assert.equal(cut.messageID,source.interruptedMessageID);
 const recovered=c.phases[1].events.find(e=>e.stage==='recovered'),inspected=c.phases[2].events.find(e=>e.stage==='inspect');
 assert.deepEqual(inspected.snapshot,recovered.after);
 assert.deepEqual(recovered.after.retained,[retained]);assert.deepEqual(recovered.after.originalIDs,source.originalIDs);
 assert.equal(recovered.after.control.status,'consumed');const summaryID=recovered.after.control.payload.result_summary_message_id;
 assert.equal(recovered.after.memory.sourceMessageID,summaryID);assert.equal(recovered.after.memory.content,source.checkpoint);
 assert.deepEqual(recovered.after.projection,[source.initialID,summaryID,original.info.id,source.sourceID,...(c.kind==='automatic'?[recovered.resultID]:[])]);
 const published=recovered.after.summaries.find(s=>s.info.id===summaryID);assert.equal(published.info.summary,true);assert.equal(published.info.finish,'stop');assert.equal(published.checkpoints[0].messageID,summaryID);
 const receipt=recovered.after.selection;assert.deepEqual(receipt,published.selected);
 assert.equal(receipt.selection_call_id,`retain_${c.cut}-${c.kind}_${c.cut==='checkpoint_saved'?'cut':'recover'}`);
 assert.deepEqual(receipt.sources.map(s=>({sessionID:s.sessionID,messageID:s.messageID,partID:s.partID,role:s.originalRole,author:s.originalAuthor,offset:s.offset,end:s.end})),[{sessionID:source.sessionID,messageID:original.info.id,partID:part.id,role:'user',author:'user',offset:excerpt.offset,end:excerpt.offset+excerpt.text.length}]);
 const interrupted=recovered.before.summaries.find(s=>s.info.id===source.interruptedMessageID);assert.equal(interrupted.selected.status,'retained');
 if(c.cut==='checkpoint_saved'){
  assert.equal(summaryID,source.interruptedMessageID);assert.deepEqual(recovered.before.retained,[retained]);assert.deepEqual(recovered.before.selection,receipt);
 }else{
  assert.equal(recovered.before.memory.sourceMessageID,source.stableID);assert.deepEqual(recovered.before.retained,[]);assert(recovered.before.projection.includes(original.info.id));
 }
 const compactions=c.requests.filter(q=>q.body.tools.some(t=>t.function.name==='ReadCompactionEvidence'));
 const phases=c.cut==='checkpoint_saved'?['cut']:['cut','recover'];
 assert.deepEqual(compactions.map(q=>[q.mode,q.helperStep]),phases.flatMap(mode=>['select','notes','summary'].map(step=>[mode,step])));
 for(const mode of phases){
  const rows=compactions.filter(q=>q.mode===mode),selection=rows[1].selection;
  assert.deepEqual(rows[2].selection,selection);
  const messages=rows[2].body.messages,callID=selection.selection_call_id;
  const call=messages.flatMap(m=>m.tool_calls??[]).find(t=>t.id===callID);assert.equal(call.function.name,'RetainCompactionUserText');assert.deepEqual(JSON.parse(call.function.arguments),{excerpts:[{part_id:part.id,text:excerpt.text}]});
  const result=messages.find(m=>m.role==='tool'&&m.tool_call_id===callID);assert.deepEqual(JSON.parse(result.content),selection);
 }
 for(const q of c.requests){assert.equal(q.body.stream,true);assert.equal(q.body.model,'checkpoint');}
 const continuations=c.requests.filter(q=>!compactions.includes(q));assert.equal(continuations.length,c.kind==='automatic'?1:0);
 for(const q of continuations){
  assert.equal(q.mode,'recover');const text=q.body.messages.filter(m=>m.role==='user').flatMap(m=>typeof m.content==='string'?[m.content]:m.content.filter(p=>p.type==='text').map(p=>p.text));assert(text.includes(excerpt.text));
 }
 return {cut:c.cut,kind:c.kind,status:c.status,phases:c.phases.map(p=>({mode:p.mode,exit:p.exitCode,settled:p.settlementConfirmed})),requests:c.requests.length,source:{sessionID:source.sessionID,messageID:original.info.id,partID:part.id,text:part.text},excerpt,selectionCallID:receipt.selection_call_id,summaryID,continuations:continuations.length};
});
const result={status:'passed',scope:'Physical child interruption and fresh-process user-source selection reconstruction; scripted streaming mechanics only.',cases,physicalChildPhases:cases.length*3,localRequests:cases.reduce((n,c)=>n+c.requests,0),remoteModelRequests:0,paidCumulativeUnchanged:999,limits:['No real-model semantic reasoning claim.','Task/Mission formal backend selection recovery and whole-OS power loss remain unqualified.']};
fs.writeFileSync(path.join(root,name+'-summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({name,status:result.status,cases:cases.length,physicalChildPhases:result.physicalChildPhases,localRequests:result.localRequests}));
