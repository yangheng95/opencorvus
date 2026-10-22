import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-permission-focus-dismissal',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/permission-focus-dismissal-530-'
const selected=['prepare.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','build.mjs','build-diagnostic.mjs','send.ts','http-json.ts','pending.ts','describe.ts','archive.mjs','plan.json','after-long-wait-handle.json','before-browser-errors.json','after-browser-errors.json','before-manual-observations.json','after-manual-observations.json']
for(const stage of ['before','after'])for(const suffix of ['authority-preparation.json','authority-retirement.json','data-preparation.json','request.json'])selected.push(stage+'-'+suffix)
for(const name of fs.readdirSync(root))if(/^\d\d-.*\.png$/.test(name)||/^before-console-.*\.json$/.test(name)||/^(before|after)-.*-pending\.json$/.test(name))selected.push(name)
for(const name of selected)fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compress=(file,name)=>{const original=fs.readFileSync(file),bytes=gzipSync(original);assert(gunzipSync(bytes).equals(original));fs.writeFileSync(out+'/'+name+'.gz',bytes,{flag:'wx'})}
for(const name of ['result-observation.json','data-preservation-observation.json','before-build.log','after-build.log','before-input.log','after-input.log'])compress(root+'/'+name,name)
const scopes=[]
for(const [stage,service,input,page]of [['before',94717,59476,130],['after',60460,86812,131]]){
 const evidence=base+stage+'/evidence',proof=JSON.parse(fs.readFileSync(evidence+'/physical-terminal-and-pair-cleanup.json')),retired=JSON.parse(fs.readFileSync(root+'/'+stage+'-authority-retirement.json')),shutdown=JSON.parse(fs.readFileSync(evidence+'/public-shutdown.json'))
 assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.maximumRequests,8);assert.equal(proof.pairedCleanupComplete,true);assert.equal(shutdown.statusCode,200);assert.equal(proof.launcher.originalChildExit,0)
 for(const key of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[key],true)
 for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
 assert.equal(retired.retired.length,2)
 for(const item of proof.provider)assert.equal(item.sourceReader.requestContext.streamRequest.apiModelID,'gpt-6.1-sol')
 compress(evidence+'/physical-terminal-and-pair-cleanup.json',stage+'-physical-terminal-and-pair-cleanup.json');compress(evidence+'/public-shutdown.json',stage+'-public-shutdown.json')
 const logs=fs.readFileSync(base+stage+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
 const assets=logs.filter(row=>row.service==='server'&&row.data?.path?.startsWith('/ui/assets/main-')&&row.data.status==='completed').map(row=>({time:row.time,path:row.data.path,statusCode:row.data.statusCode}))
 const errors=logs.filter(row=>row.level==='error').map(row=>({time:row.time,service:row.service,message:row.message,errorName:typeof row.data?.error==='object'?row.data.error?.name:undefined}))
 scopes.push({stage,originalServiceHandle:service,originalServiceExit:0,originalInputHandle:input,originalInputExit:0,page,pageState:'Closed',actualRequests:proof.requests,maximumRequests:8,provider:proof.provider,assets,runtimeErrors:errors,runtimePairRetired:proof.copiedPair,privatePairRetired:retired.retired})
}
const actualRequests=scopes.reduce((n,s)=>n+s.actualRequests,0),observations=JSON.parse(fs.readFileSync(root+'/result-observation.json'))
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),actualRequests,maximum:16,unusedRetired:16-actualRequests,copiedAuthorityMembersRetired:8,screenshots:selected.filter(n=>n.endsWith('.png')).length,scopes,longWait:observations.longWait,limits:observations.limits},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({selected:selected.length,screenshots:selected.filter(n=>n.endsWith('.png')).length,actualRequests,maximum:16,pairedMembersRetired:8,errors:scopes.map(s=>({stage:s.stage,errors:s.runtimeErrors.length})),longWait:observations.longWait.elapsedBeforeApprovalMs,postAfter:observations.longWait.originalPostRoundTripMs}))
