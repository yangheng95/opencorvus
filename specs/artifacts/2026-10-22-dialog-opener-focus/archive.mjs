import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-dialog-opener-focus',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/dialog-opener-focus-531-'
const selected=['prepare.mjs','prepare-data.ts','serve.ts','launch.ps1','shutdown.ps1','settle.ps1','preserve.ts','build.mjs','build-diagnostic.mjs','describe.mjs','archive.mjs','plan.json','before-data-preparation.json','after-data-preparation.json','before-browser-errors.json','after-browser-errors.json','before-manual-observations.json','after-manual-observations.json']
for(const name of fs.readdirSync(root))if(/^\d\d-.*\.png$/.test(name)||/^before-console-.*\.json$/.test(name))selected.push(name)
for(const name of selected)fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compress=(file,name)=>{const original=fs.readFileSync(file),bytes=gzipSync(original);assert(gunzipSync(bytes).equals(original));fs.writeFileSync(out+'/'+name+'.gz',bytes,{flag:'wx'})}
for(const name of ['result-observation.json','data-preservation-observation.json','before-build.log','after-build.log'])compress(root+'/'+name,name)
const result=JSON.parse(fs.readFileSync(root+'/result-observation.json'))
for(const scope of result.scopes){
 assert.equal(scope.originalServiceExit,0);assert.equal(scope.shutdownStatus,200);assert.equal(scope.provider.actual,0);assert.equal(scope.provider.maximum,0)
 for(const key of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(scope.native[key],true)
 for(const item of scope.chain)assert.equal(item.state,'dead_or_reused')
 for(const name of ['physical-terminal.json','public-shutdown.json'])compress(base+scope.stage+'-service/evidence/'+name,scope.stage+'-'+name)
}
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),screenshots:selected.filter(name=>name.endsWith('.png')).length,actualRequests:result.actualRequests,maximumRequests:result.maximumRequests,authority:result.authority,scopes:result.scopes,limits:result.limits},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({selected:selected.length,screenshots:selected.filter(name=>name.endsWith('.png')).length,services:result.scopes.map(s=>({stage:s.stage,original:s.originalServiceHandle,exit:s.originalServiceExit,page:s.page,pageState:s.pageState})),actualRequests:0}))
