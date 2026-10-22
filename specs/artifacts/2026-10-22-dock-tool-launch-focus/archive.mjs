import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-dock-tool-launch-focus',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/dock-tool-launch-focus-527-'
const selected=['launch.ps1','serve.ts','shutdown.ps1','settle.ps1','preserve.ts','build.mjs','prepare-data.ts','plan.json','manual-observations.json','before-data-preparation.json','after-data-preparation.json','verification.json','archive.mjs']
for(const file of fs.readdirSync(root))if(/^\d\d-.*\.png$/.test(file))selected.push(file)
for(const file of selected){
 if(file==='archive.mjs'||file==='verification.json')fs.writeFileSync(out+'/'+file,fs.readFileSync(root+'/'+file))
 else if(fs.existsSync(out+'/'+file))assert(fs.readFileSync(out+'/'+file).equals(fs.readFileSync(root+'/'+file)))
 else fs.copyFileSync(root+'/'+file,out+'/'+file,fs.constants.COPYFILE_EXCL)
}
const compress=(source,name)=>{const bytes=fs.readFileSync(source),target=out+'/'+name+'.gz';if(fs.existsSync(target)){assert(gunzipSync(fs.readFileSync(target)).equals(bytes));return}const z=gzipSync(bytes);assert(gunzipSync(z).equals(bytes));fs.writeFileSync(target,z,{flag:'wx'})}
compress(root+'/data-preservation-observation.json','data-preservation-observation.json');compress(root+'/after-build.log','after-build.log')
const resources=[]
for(const [stage,handle,page,js]of [['before',49254,124,'main-7Ue7jCbp.js'],['after',58855,125,'main-BZBJ5jFW.js']]){
 const evidence=base+stage+'-service/evidence',proof=JSON.parse(fs.readFileSync(evidence+'/physical-terminal.json','utf8'))
 assert.equal(proof.originalHandle,handle);assert.equal(proof.originalExit,0);assert.equal(proof.shutdown.statusCode,200);assert.equal(proof.launcher.childExitCode,0)
 for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
 for(const fact of proof.chain)assert.equal(fact.state,'dead_or_reused');assert.equal(proof.provider.maximum,0);assert.equal(proof.provider.actual,0);assert.equal(proof.provider.exhausted,false)
 compress(evidence+'/physical-terminal.json',stage+'-physical-terminal.json');compress(root+'/'+stage+'-browser-errors.json',stage+'-browser-errors.json')
 const rows=fs.readFileSync(base+stage+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
 const assets=rows.filter(r=>r.service==='server'&&r.data?.path?.startsWith('/ui/assets/main-')&&r.data.status==='completed').map(r=>({time:r.time,path:r.data.path,statusCode:r.data.statusCode}))
 assert(assets.some(r=>r.path==='/ui/assets/'+js&&r.statusCode===200));assert(assets.some(r=>r.path.endsWith('.css')&&r.statusCode===200))
 const errors=rows.filter(r=>r.level==='error').map(r=>({time:r.time,service:r.service,message:r.message,data:r.data}))
 fs.writeFileSync(out+'/'+stage+'-runtime-errors.json',JSON.stringify(errors,null,2)+'\n')
 resources.push({stage,originalHandle:handle,originalExit:0,page,pageState:'Closed',provider:proof.provider,assets,physical:'Original native/output/request/launcher/exact host and target fully settled',runtimeErrors:errors.length})
}
const result={at:new Date().toISOString(),actualModels:0,maximum:0,authorityCopies:'None staged',screenshots:selected.filter(f=>/^\d\d-.*\.png$/.test(f)).length,resources,qualification:'Actual manual empty-chooser Files/Requirements/Browser launch,Tab/menu/close observations;no UI assertions',limits:['Three actual entries cover ordinary and Browser branches;other three catalog tools not independently qualified','No active stream/Side/Native WebView2/all Rendering qualification','Zero-model configuration errors are retained;not console-clean qualification']}
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({selectedFiles:selected.length,screenshots:result.screenshots,scopes:resources.map(r=>({stage:r.stage,originalExit:r.originalExit,models:r.provider.actual,errors:r.runtimeErrors}))}))
