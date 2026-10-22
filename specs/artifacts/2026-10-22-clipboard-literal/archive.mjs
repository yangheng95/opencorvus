import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-clipboard-literal',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/clipboard-literal-525-'
const selected=['prepare.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','copy-ui.mjs','build.mjs','send.ts','describe.ts','archive.mjs','plan.json']
for(const stage of ['before','after'])for(const suffix of ['authority-preparation.json','authority-retirement.json','data-preparation.json','request.json'])selected.push(stage+'-'+suffix)
for(const name of fs.readdirSync(root))if(/^\d\d-.*\.png$/.test(name))selected.push(name)
for(const name of selected)fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compress=(source,name)=>{const bytes=fs.readFileSync(source),z=gzipSync(bytes);assert(gunzipSync(z).equals(bytes));fs.writeFileSync(out+'/'+name+'.gz',z,{flag:'wx'})}
for(const name of ['result-observation.json','data-preservation-observation.json','after-build.log','before-input.log','after-input.log'])compress(root+'/'+name,name)
const resource=[]
for(const [stage,handle,input,page] of [['before',46545,7388,120],['after',19799,9165,121]]){
 const evidence=base+stage+'/evidence',proof=JSON.parse(fs.readFileSync(evidence+'/physical-terminal-and-pair-cleanup.json','utf8')),shutdown=JSON.parse(fs.readFileSync(evidence+'/public-shutdown.json','utf8')),retired=JSON.parse(fs.readFileSync(root+'/'+stage+'-authority-retirement.json','utf8'))
 assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.maximumRequests,8);assert.equal(proof.requests,4);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.launcher.originalChildExit,0);assert.equal(shutdown.statusCode,200)
 for(const key of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[key],true)
 for(const fact of proof.chain)assert.equal(fact.state,'dead_or_reused');assert.equal(retired.retired.length,2)
 compress(evidence+'/physical-terminal-and-pair-cleanup.json',stage+'-physical-terminal-and-pair-cleanup.json');compress(evidence+'/public-shutdown.json',stage+'-public-shutdown.json')
 const logs=fs.readFileSync(base+stage+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
 const assets=logs.filter(row=>row.service==='server'&&row.data?.path?.startsWith('/ui/assets/main-')&&row.data.status==='completed').map(row=>({time:row.time,path:row.data.path,statusCode:row.data.statusCode}));assert(assets.some(row=>row.path.endsWith('.css')&&row.statusCode===200))
 resource.push({stage,originalServiceHandle:handle,originalServiceExit:0,originalInputHandle:input,originalInputExit:0,page,pageState:'Closed',assets,sourceEOF:'All4 real Sol streaming requests200/eof',runtimePairRetired:proof.copiedPair,privatePairRetired:retired.retired})
}
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),actualRequests:8,maximum:16,unusedRetired:8,copiedAuthorityMembersRetired:8,resources:resource,limits:['Known-baseline manual UI copy qualification;initial-host handshake remains unqualified','Main probe rejected delegated identity by current public contract;not Main visual qualification','No all-entry/Native WebView2/continuous-frame Rendering qualification']},null,2)+'\n',{flag:'wx'})
let readme=fs.readFileSync(out+'/README.md','utf8');for(const name of selected)if(/^\d\d-.*\.png$/.test(name))readme=readme.replace('| '+name.slice(0,2)+' |','| ['+name.slice(0,2)+']('+name+') |');fs.writeFileSync(out+'/README.md',readme)
console.log(JSON.stringify({selectedFiles:selected.length,screenshots:8,actualRequests:8,maximum:16,pairedMembersRetired:8,assets:resource.map(r=>({stage:r.stage,count:r.assets.length}))}))
