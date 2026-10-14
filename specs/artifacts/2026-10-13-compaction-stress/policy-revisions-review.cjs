const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{Database}=require('bun:sqlite');
const root=path.resolve('specs/artifacts/2026-10-13-compaction-stress');
const name=process.argv[2],expectedModel=process.argv[3]??'openai/gpt-6-luna';assert(/^cross-model-policy-revisions(?:-range|-sol)?$/.test(name));
const r=JSON.parse(fs.readFileSync(path.join(root,name+'.json'),'utf8')),audit=JSON.parse(fs.readFileSync(path.join(root,name+'.json.requests.json'),'utf8'));
const actionSummary=JSON.parse(fs.readFileSync(path.join(root,name+'-summary.json'),'utf8'));
const db=new Database(path.join(r.runtime,'runtime/data/opencorvus.db'),{readonly:true});
assert.equal(r.model,expectedModel);assert.equal(r.requests.length,audit.length);
const sourceIDs=new Set();
const cases=r.cases.map(c=>{
 const nonce=c.expected.artifact_id.slice('ARTIFACT-'.length),revision=nonce+'-r'+c.round;
 const expected={kind:c.round%2===0?'draft':'release',channel:'CHANNEL-'+revision,region:'REGION-'+revision,artifact_id:'ARTIFACT-'+nonce,policy_revision:'POLICY-'+revision};
 assert.deepEqual(c.expected,expected);sourceIDs.add(c.updateID);assert.equal(sourceIDs.size,c.round);
 const source=db.query('SELECT id,data FROM part WHERE message_id=? ORDER BY time_created,id').all(c.updateID).map(p=>({id:p.id,...JSON.parse(p.data)})).find(p=>p.type==='text');assert(source);
 const info=JSON.parse(db.query('SELECT data FROM message WHERE id=?').get(c.updateID).data);assert.equal(info.role,'user');assert.equal(info.author,'user');
 const originalAuthorization=source.text.split('\n').find(line=>Object.values(expected).every(value=>line.includes(value)));assert(originalAuthorization);
 const selected=(c.retainedUserSources??[]).filter(m=>m.messageID===c.updateID);
 const selectedText=selected.flatMap(m=>{assert.equal(m.role,'user');assert.equal(m.author,'user');return m.parts.map(p=>{assert.equal(p.partID,source.id);assert(source.text.includes(p.text));return p.text})}).join('\n');
 const scopeFields=Object.fromEntries(Object.entries(expected).map(([key,value])=>[key,selectedText.includes(value)]));
 const lanes=c.lanes.map(l=>{
  const q=audit[l.requestStart];assert(q);const probe=q.input_evidence.probes.find(p=>p.id==='policy-revisions.r'+c.round);assert(probe);
  const userMatches=probe.matches.filter(m=>m.message_role==='user'&&/^\/(?:input|messages)\/\d+\/role$/.test(m.role_json_pointer));
  if(l.lane==='full')assert(userMatches.length>0);
  return {lane:l.lane,status:l.status,requestIndex:l.requestStart,action:l.effects[0].action,currentSourceInUserRole:userMatches.length>0,matches:probe.matches};
 });
 const tools=db.query('SELECT r.id,r.data AS request,o.data AS outcome FROM tool_part_request r JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE r.message_id=? ORDER BY r.time_created,r.id').all(c.checkpoint.summaryID).map(row=>{
  const request=JSON.parse(row.request),outcome=JSON.parse(row.outcome);let output;try{output=JSON.parse(outcome.output)}catch{}
  return {partID:row.id,callID:request.callID,tool:request.tool,input:request.input,outcome:outcome.outcome,...(output?{receipt:request.tool==='ReadCompactionEvidence'?{partID:output.partID,field:output.field,offset:output.offset,end:output.end,nextOffset:output.nextOffset,totalChars:output.totalChars,containsCurrentRegion:output.content?.includes(expected.region)}:output}:{failure:outcome.failure})};
 });
 return {round:c.round,status:c.status,expected,source:{messageID:c.updateID,partID:source.id,totalChars:source.text.length,originalAuthorization},selected,scopeFields,
  sourceRolePreserved:Object.values(scopeFields).every(Boolean)&&lanes.find(l=>l.lane==='compacted').currentSourceInUserRole,lanes,tools};
});db.close();assert.deepEqual(cases.map(c=>c.round),[1,2,3,4,5]);assert.equal(new Set(cases.map(c=>c.expected.artifact_id)).size,1);
const result={name,status:r.status,model:r.model,requests:audit.length,completedCheckpoints:5,actualActions:10,passedActions:actionSummary.passedActions,passedFields:actionSummary.passedFields,
 sourceRolePreserved:cases.filter(c=>c.sourceRolePreserved).length,fullPassed:cases.filter(c=>c.lanes.find(l=>l.lane==='full').status==='passed').length,compactedPassed:cases.filter(c=>c.lanes.find(l=>l.lane==='compacted').status==='passed').length,cases,
 limits:['A failed full-history action is a baseline reasoning failure, not attributed solely to compression.','Exact authored revisions alternate kind and change scope; this is a bounded five-round observation.','No opaque native persistence, cross-vendor or general reliability guarantee.']};
fs.writeFileSync(path.join(root,name+'-role-evidence.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,cases:undefined}));
