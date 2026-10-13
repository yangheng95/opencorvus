const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stage=process.argv[2];assert(['after','final'].includes(stage));
const root=path.resolve('.tmp-codex-provider-empty-declarations-01a133',stage),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8')),records=[];
const suffix='?directory='+encodeURIComponent(ready.project),origin='http://127.0.0.1:'+ready.port;
const call=async(route,method='GET',body)=>{
 const response=await fetch(origin+route+suffix,{method,...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})});
 return {status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),body:await response.json()};
};
(async()=>{
 const inherited={owned:'Project inherited',keep:'Project kept'};
 const configured=await call('/config','PATCH',{prompt:inherited});assert.equal(configured.status,200);assert.deepEqual(configured.body.prompt,inherited);
 records.push({operation:'set-owned-project-prompt',status:configured.status,requestID:configured.requestID,prompt:configured.body.prompt});
 const created=await call('/coding/chat/session','POST',{model:'owned-ready/ready-known'});assert.equal(created.status,201);
 const id=created.body.session.id;assert.equal(typeof id,'string');
 records.push({operation:'create-real-chat-session',status:created.status,requestID:created.requestID,sessionID:id,kind:created.body.session.kind,overlay:created.body.session.metadata?.configOverlay});
 for(const [operation,patch,prompt,stored]of [
  ['delete-missing-override',{prompt:{owned:null}},inherited,{}],
  ['set-override',{prompt:{owned:'Session override'}},{owned:'Session override',keep:'Project kept'},{owned:'Session override'}],
  ['delete-existing-override',{prompt:{owned:null}},inherited,{}]
 ]){
  const updated=await call('/session/'+id+'/config','PATCH',patch);assert.equal(updated.status,200);assert.deepEqual(updated.body.config.prompt,prompt);
  const durable=await call('/session/'+id);assert.equal(durable.status,200);assert.deepEqual(durable.body.metadata.configOverlay,{model:'owned-ready/ready-known',prompt:stored});
  records.push({operation,status:updated.status,requestID:updated.requestID,effective:updated.body.config.prompt,origin:updated.body.origin.prompt,durableStatus:durable.status,durableRequestID:durable.requestID,stored:durable.body.metadata.configOverlay});
  fs.writeFileSync(root+'/session-protocol.json',JSON.stringify({boundary:'Actual production TCP and durable Session metadata, no synthetic messages or model inference',sessionID:id,records},null,2)+'\n');
 }
 const source=JSON.parse(fs.readFileSync(root+'/project/.opencorvus/opencorvus.jsonc','utf8'));assert.deepEqual(source.prompt,inherited);
 records.push({operation:'canonical-project-source',prompt:source.prompt});
 fs.writeFileSync(root+'/session-protocol.json',JSON.stringify({boundary:'Actual production TCP and durable Session metadata, no synthetic messages or model inference',sessionID:id,records},null,2)+'\n');
 console.log(JSON.stringify({stage,sessionID:id,qualifiedOperations:records.length,source:'Canonical project and real persisted overlay match explicit inheritance contracts'}));
})().catch(error=>{console.error(error);process.exitCode=1});
