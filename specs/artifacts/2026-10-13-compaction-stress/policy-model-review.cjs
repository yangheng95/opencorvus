const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{Database}=require('bun:sqlite');
const root=path.resolve('specs/artifacts/2026-10-13-compaction-stress'),name=process.argv[2];assert(name&&/^cross-model-[a-z-]+$/.test(name));
const expectedModel=process.argv[4]??"openai/gpt-6-luna",apiModel=expectedModel.split("/")[1];
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8')),r=read(name+'.json'),audit=read(name+'.json.requests.json');
assert.equal(r.status,process.argv[3]??'passed');assert.equal(r.model,expectedModel);assert.equal(r.requests.length,audit.length);
for(const q of audit){assert.equal(q.model,apiModel);assert.equal(q.streaming,true);assert.equal(q.status,200);assert.equal(q.response_reader.state,'settled');assert.equal(q.response_reader.terminal.kind,'eof');assert.equal(q.response_reader.requestContext.streamRequest.apiModelID,apiModel);}
const dataRoot=path.join(r.runtime,'runtime/data'),db=new Database(path.join(dataRoot,'opencorvus.db'),{readonly:true});
const cleanup={runtimePresent:fs.existsSync(r.runtime),dataPresent:fs.existsSync(path.join(dataRoot,'opencorvus.db')),authPresent:fs.existsSync(path.join(dataRoot,'auth.json')),catalogPresent:fs.existsSync(path.join(dataRoot,'models.json'))};assert.deepEqual(cleanup,{runtimePresent:true,dataPresent:true,authPresent:false,catalogPresent:false});
const usage=db.query('SELECT * FROM provider_usage_event ORDER BY occurred_at,id').all();assert.equal(usage.length,audit.length);for(const row of usage){assert.equal(row.provider_id,'openai');assert.equal(row.model_id,apiModel);}
const cases=r.cases.map(c=>{
 assert(['passed','failed'].includes(c.status));assert.equal(c.checkpoint.status,'valid_checkpoint');assert.equal(c.checkpoint.processExitCode,0);
 const summary=JSON.parse(db.query('SELECT data FROM message WHERE id=?').get(c.checkpoint.summaryID).data);assert.equal(summary.summary,true);assert.equal(summary.finish,'stop');assert.equal(summary.parentID,c.sourceID);
 assert.equal(c.compactionCapacity.tokens,19000);
 const lanes=c.lanes.map(l=>{
  assert(['passed','failed'].includes(l.status));assert.equal(l.effects.length,1);const e=l.effects[0],file=JSON.parse(fs.readFileSync(e.file,'utf8'));
  const passedFields=Object.keys(c.expected).filter(k=>e.action[k]===c.expected[k]).length;assert.equal(l.status,passedFields===Object.keys(c.expected).length?'passed':'failed');assert.deepEqual(file,{callID:e.callID,sessionID:l.sessionID,action:e.action});
  const requests=db.query('SELECT id,data FROM tool_part_request WHERE message_id=?').all(l.assistantMessageID).map(x=>({...x,data:JSON.parse(x.data)}));
  const request=requests.find(x=>x.data.callID===e.callID);assert(request);assert.equal(request.data.tool,'WriteDeliveryArtifact');assert.deepEqual(request.data.input,e.action);
  const outcome=JSON.parse(db.query('SELECT data FROM tool_part_outcome WHERE request_part_id=?').get(request.id).data);assert.equal(outcome.outcome,'completed');if(outcome.output!==undefined)assert.deepEqual(JSON.parse(outcome.output),file);
  const assistant=JSON.parse(db.query('SELECT data FROM message WHERE id=?').get(l.assistantMessageID).data);assert.equal(typeof assistant.time.completed,'number');
  const capacity=l.lane==='full'?256000:19000;assert.equal(l.contextCapacity.tokens,capacity);
  const tokens=usage.filter(u=>u.session_id===l.sessionID).reduce((a,u)=>({requests:a.requests+1,uncachedInput:a.uncachedInput+u.input_tokens,cachedInput:a.cachedInput+u.cache_read_tokens+u.cache_write_tokens,output:a.output+u.output_tokens}),{requests:0,uncachedInput:0,cachedInput:0,output:0});
  return {lane:l.lane,status:l.status,sessionID:l.sessionID,assistantMessageID:l.assistantMessageID,capacity:l.contextCapacity,effects:[{...e,partID:request.id}],passedFields,usage:tokens};
 });
 assert.deepEqual(lanes.map(l=>l.lane),['full','compacted']);
 return {name:c.name,round:c.round,status:c.status,sessionID:c.sessionID,sourceID:c.sourceID,summaryID:c.checkpoint.summaryID,compactionCapacity:c.compactionCapacity,requestStart:c.requestStart,requestEnd:c.requestEnd,summary:c.summary,lanes};
});
assert.deepEqual(cases.map(c=>c.round),[1,2,3,4,5]);
const result={name,status:r.status,model:r.model,contextTokens:r.contextTokens,fullContextTokens:r.fullContextTokens,requests:audit.length,completedRounds:cases.length,actualActions:cases.reduce((n,c)=>n+c.lanes.length,0),passedActions:cases.reduce((n,c)=>n+c.lanes.filter(l=>l.status==='passed').length,0),passedFields:cases.reduce((n,c)=>n+c.lanes.reduce((s,l)=>s+l.passedFields,0),0),cleanup,cases,usageRecords:usage,sourceReaders:{http200:audit.filter(q=>q.status===200).length,settledEOF:audit.filter(q=>q.response_reader.terminal.kind==='eof').length},limits:['Authored histories and one exact model per run; not a universal semantic guarantee.','Full-history controls use a larger explicit input budget.','Catalog zero costs do not establish zero billing.']};db.close();
fs.writeFileSync(path.join(root,name+'-summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({name,requests:result.requests,rounds:result.completedRounds,actions:result.passedActions,fields:result.passedFields,usageRecords:usage.length,cleanup}));
