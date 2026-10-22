import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-goal-home-run',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/goal-home-run-533-'
function safeProvider(request){
 const reader=request.sourceReader,stream=reader.requestContext.streamRequest
 assert.equal(request.model,'gpt-6.1-sol');assert.equal(stream.apiModelID,'gpt-6.1-sol');assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(reader.state,'settled');assert.equal(reader.terminal.kind,'eof')
 return{model:request.model,streaming:request.streaming,status:request.status,sourceReader:{state:reader.state,terminal:{kind:reader.terminal.kind,at:reader.terminal.at},requestContext:{streamRequest:{requestID:stream.requestID,agentID:stream.agentID,providerID:stream.providerID,modelID:stream.modelID,apiModelID:stream.apiModelID}}}}
}
const names=['prepare.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','qualify-provider.ps1','recheck-settlement.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','build.mjs','http-json.ts','check-goal.ts','objective.txt','plan.json','describe.mjs','archive.mjs','before-initial-settlement.json','before-initial-authority-retirement.json','before-completion-focus.json','before-controller-layout.json','after-create-focus.json','after-completion-focus.json','after-controller-layout.json','after-human-layout.json','after-home-return-focus.json']
for(const stage of ['before','after'])for(const suffix of ['authority-preparation.json','authority-retirement.json','data-preparation.json','goal-identity.json','browser-errors.json','recheck.json'])names.push(stage+'-'+suffix)
for(const name of fs.readdirSync(root))if(/^\d\d-.*\.png$/.test(name))names.push(name)
for(const name of names){
 if(name==='before-initial-settlement.json'){
  const value=JSON.parse(fs.readFileSync(root+'/'+name));value.provider=value.provider.map(safeProvider);value.archiveProjection='Original failed budget metadata and actual native/EOF facts;request payload and headers omitted'
  fs.writeFileSync(out+'/'+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
 }else fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
}
for(const name of fs.readdirSync(root).filter(name=>/^(before|after)-.*-goal\.json$/.test(name))){
 const value=JSON.parse(fs.readFileSync(root+'/'+name))
 value.archiveProjection='Actual Goal/Session/events/visible text and part identities;non-text runtime payload omitted'
 value.messages=value.messages.map(message=>({...message,parts:message.parts.map(part=>({id:part.id,type:part.type,...(part.type==='text'?{text:part.text}:{})}))}))
 fs.writeFileSync(out+'/'+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
}
const compress=(original,name)=>{const bytes=Buffer.isBuffer(original)?original:Buffer.from(original),packed=gzipSync(bytes);assert(gunzipSync(packed).equals(bytes));fs.writeFileSync(out+'/'+name+'.gz',packed,{flag:'wx'})}
for(const name of ['result-observation.json','data-preservation-observation.json','before-build.log','after-build.log'])compress(fs.readFileSync(root+'/'+name),name)
const result=JSON.parse(fs.readFileSync(root+'/result-observation.json'))
const provider=[]
for(const stage of ['before','after']){
 const proof=JSON.parse(fs.readFileSync(base+stage+'/evidence/physical-terminal-and-pair-cleanup.json'))
 assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.maximumRequests,16);assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true)
 for(const key of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[key],true)
 for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
 proof.provider=proof.provider.map(safeProvider)
 proof.archiveProjection='Original native/cleanup/budget fields and qualified wire model/status/EOF;request payload and headers omitted'
 compress(JSON.stringify(proof,null,2)+'\n',stage+'-physical-terminal-and-pair-cleanup.json')
 compress(fs.readFileSync(base+stage+'/evidence/public-shutdown.json'),stage+'-public-shutdown.json')
 provider.push({stage,requests:proof.requests,maximum:proof.maximumRequests,provider:proof.provider})
}
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),screenshots:26,actualRequests:result.actualRequests,maximumRequests:result.maximumRequests,unusedScopeRequestsRetired:result.maximumRequests-result.actualRequests,totalAuthorityMembersRetired:result.totalAuthorityMembersRetired,scopes:result.scopes,provider,limits:result.limits},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({selected:names.length,screenshots:26,actual:result.actualRequests,maximum:result.maximumRequests,retired:result.totalAuthorityMembersRetired}))
