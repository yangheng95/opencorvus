import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-member-stream-reading',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/member-stream-reading-524-'
const selected=['prepare.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','copy-ui.mjs','build.mjs','send.ts','describe.ts','archive.mjs','plan.json']
for(const stage of ['before','after'])for(const suffix of ['authority-preparation.json','authority-retirement.json','data-preparation.json','request.json'])selected.push(stage+'-'+suffix)
for(const name of fs.readdirSync(root))if(/^\d\d-.*\.png$/.test(name))selected.push(name)
for(const name of selected)fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compress=(source,name)=>{const bytes=fs.readFileSync(source),z=gzipSync(bytes);assert(gunzipSync(z).equals(bytes));fs.writeFileSync(out+'/'+name+'.gz',z,{flag:'wx'})}
for(const name of ['result-observation.json','data-preservation-observation.json','after-build.log','before-input.log','after-input.log'])compress(root+'/'+name,name)
const resource=[]
for(const [stage,handle,input,page] of [['before',27173,76011,118],['after',32456,46357,119]]){
 const evidence=base+stage+'/evidence',proof=JSON.parse(fs.readFileSync(evidence+'/physical-terminal-and-pair-cleanup.json','utf8')),shutdown=JSON.parse(fs.readFileSync(evidence+'/public-shutdown.json','utf8')),retired=JSON.parse(fs.readFileSync(root+'/'+stage+'-authority-retirement.json','utf8'))
 assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.maximumRequests,12);assert.equal(proof.requests,6);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.launcher.originalChildExit,0);assert.equal(shutdown.statusCode,200)
 for(const key of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[key],true)
 for(const fact of proof.chain)assert.equal(fact.state,'dead_or_reused');assert.equal(retired.retired.length,2)
 compress(evidence+'/physical-terminal-and-pair-cleanup.json',stage+'-physical-terminal-and-pair-cleanup.json');compress(evidence+'/public-shutdown.json',stage+'-public-shutdown.json')
 const logs=fs.readFileSync(base+stage+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
 const assets=logs.filter(row=>row.service==='server'&&row.data?.path?.startsWith('/ui/assets/main-')&&row.data.status==='completed').map(row=>({time:row.time,path:row.data.path,statusCode:row.data.statusCode}));assert(assets.some(row=>row.path.endsWith('.css')&&row.statusCode===200))
 resource.push({stage,originalServiceHandle:handle,originalServiceExit:0,originalInputHandle:input,originalInputExit:0,page,pageState:'Closed',assets,sourceEOF:'All6 real Sol streaming requests200/eof',runtimePairRetired:proof.copiedPair,privatePairRetired:retired.retired})
}
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),actualRequests:12,maximum:24,unusedRetired:12,copiedAuthorityMembersRetired:8,resources:resource,limits:['Sampled manual UI qualification only','First live coordinate code-copy mismatch retained;root unknown','Completed semantic two-code/source paste contracts observed;not all clipboard or Rendering states qualified']},null,2)+'\n',{flag:'wx'})
let readme=fs.readFileSync(out+'/README.md','utf8');for(const name of selected)if(/^\d\d-.*\.png$/.test(name))readme=readme.replace('| '+name.slice(0,2)+' |','| ['+name.slice(0,2)+']('+name+') |');fs.writeFileSync(out+'/README.md',readme)
console.log(JSON.stringify({selectedFiles:selected.length,screenshots:19,actualRequests:12,maximum:24,pairedMembersRetired:8,assets:resource.map(r=>({stage:r.stage,count:r.assets.length}))}))
