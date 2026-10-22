import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-source-live-owner-continuity',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-live-owner-continuity-529-'
const selected=['prepare.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','build.mjs','build-diagnostic.mjs','send-original.ts','send.ts','http-json.ts','reconcile.ts','observe.mjs','archive.mjs','plan.json','after-focus-observations.json','after-reconciled-result.json','after-pending-permissions.json','after-recovered-permission-ledger.json','browser-errors.json','after-browser-errors.json']
for(const stage of ['before','after'])for(const suffix of ['authority-preparation.json','authority-retirement.json','data-preparation.json','request.json'])selected.push(stage+'-'+suffix)
for(const name of fs.readdirSync(root))if(/^\d\d-.*\.png$/.test(name)||/^console-\d+\.json$/.test(name))selected.push(name)
for(const name of selected)fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compress=(file,name)=>{const original=fs.readFileSync(file),bytes=gzipSync(original);assert(gunzipSync(bytes).equals(original));fs.writeFileSync(out+'/'+name+'.gz',bytes,{flag:'wx'})}
for(const name of ['owner-observation.json','manual-observations.json','data-preservation-observation.json','before-input.log','after-input.log','after-build.log','diagnostic-build.log'])compress(root+'/'+name,name)
const scopes=[]
for(const [stage,service,input,page]of [['before',44270,54009,128],['after',72930,63551,129]]){
 const evidence=base+stage+'/evidence',proof=JSON.parse(fs.readFileSync(evidence+'/physical-terminal-and-pair-cleanup.json')),retired=JSON.parse(fs.readFileSync(root+'/'+stage+'-authority-retirement.json')),shutdown=JSON.parse(fs.readFileSync(evidence+'/public-shutdown.json'))
 assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.maximumRequests,8);assert.equal(proof.pairedCleanupComplete,true);assert.equal(shutdown.statusCode,200);assert.equal(proof.launcher.originalChildExit,0)
 for(const key of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[key],true)
 for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
 assert.equal(retired.retired.length,2)
 compress(evidence+'/physical-terminal-and-pair-cleanup.json',stage+'-physical-terminal-and-pair-cleanup.json');compress(evidence+'/public-shutdown.json',stage+'-public-shutdown.json')
 const logs=fs.readFileSync(base+stage+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
 const assets=logs.filter(row=>row.service==='server'&&row.data?.path?.startsWith('/ui/assets/main-')&&row.data.status==='completed').map(row=>({time:row.time,path:row.data.path,statusCode:row.data.statusCode}))
 const errors=logs.filter(row=>row.level==='error').map(row=>({time:row.time,service:row.service,message:row.message,errorName:typeof row.data?.error==='object'?row.data.error?.name:undefined}))
 scopes.push({stage,originalServiceHandle:service,originalServiceExit:0,originalInputHandle:input,originalInputExit:stage==='before'?0:1,page,pageState:'Closed',actualRequests:proof.requests,maximumRequests:8,provider:proof.provider,assets,runtimeErrors:errors,runtimePairRetired:proof.copiedPair,privatePairRetired:retired.retired,inputQualification:stage==='before'?'Original POST200/stop':'Original POST idle TimeoutError;same persisted input/final read HTTP200 by repaired bounded checker;not redispatched'})
}
const actualRequests=scopes.reduce((n,s)=>n+s.actualRequests,0)
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),actualRequests,maximum:16,unusedRetired:16-actualRequests,copiedAuthorityMembersRetired:8,screenshots:23,scopes,qualificationLimits:['Sampled before diagnostic owners,not continuous-frame/all-entry Rendering proof','After original POST exited1;canonical input/final identity verified separately,not a passing original transport','Pending MDN UI disappearance recovered by own-page reload and real Allow Once;outside-focus dismissal is a code-supported inference,not instrumented cause','No production permission/queue/recovery change or full cross-owner restart qualification']},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({selected:selected.length,screenshots:23,actualRequests,maximum:16,pairedMembersRetired:8,errors:scopes.map(s=>({stage:s.stage,errors:s.runtimeErrors.length,assets:s.assets.filter(a=>a.path.endsWith('.js'))}))}))
