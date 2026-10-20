import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=path.join(repo,'specs/artifacts/2026-10-21-git-executable-flow'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21'
assert.equal(fs.existsSync(out),false,'Fresh owned evidence directory')
fs.mkdirSync(out)
const copy=(source,name)=>fs.copyFileSync(source,path.join(out,name),fs.constants.COPYFILE_EXCL)
const names=['before-config.json','before-readers.json','after-config.json','after-readers.json','control-before-config.json','control-before-readers.json','control-after-config.json','control-after-readers.json','data-preparation.json','control-data-preparation.json','authority-preparation.json','data-and-authority-preserved.json','physical-scopes.json','git-tests.log','typecheck.log','checker-before-private.log','withdrawn-candidate.patch','withdrawn-host-git-executable.test.ts.txt','prepare.mjs','prepare-data.ts','prepare-control.mjs','prepare-control-data.ts','before-loader.ts','api-wrapper.ts','launch.ps1','launch-control.ps1','launch-checker.ps1','launch-control-checker.ps1','check-config.ts','check-control.ts','settle.ps1','shutdown.ps1','preserve.ts','verify-closed.ps1','archive.mjs']
for(const name of names)copy(path.join(root,name),name)
const matrix=[]
for(const stage of ['before','after','control-before','control-after']){
 const config=JSON.parse(fs.readFileSync(root+'/'+stage+'-config.json','utf8')),reads=JSON.parse(fs.readFileSync(root+'/'+stage+'-readers.json','utf8')),run=base+'/git-executable-flow-492-'+stage
 assert.equal(config.accepted,true);assert.equal(config.restored,true);assert.deepEqual(config.failures,[]);assert.deepEqual(reads.failures,[])
 copy(run+'/evidence/physical-terminal-and-pair-cleanup.json',stage+'-physical-and-pair-cleanup.json')
 copy(run+'/evidence/public-shutdown.json',stage+'-public-shutdown.json')
 copy(run+'/evidence/'+(stage.startsWith('control-')?'api-ready.json':'preflight-ready.json'),stage+'-admission.json')
 matrix.push({stage,saveMs:config.writeMs,restoreMs:config.restoreMs,readMaxMs:Math.max(...reads.results.map(r=>r.ms)),criteria:config.criteria,completeCanonical:config.restored,reads:reads.results.map(r=>({endpoint:r.endpoint,status:r.status,ms:r.ms,providers:r.providers,models:r.models,targetModel:r.targetModel})),modelMaximum:stage.startsWith('control-')?0:2})
}
copy(base+'/git-executable-flow-492-control-before/evidence/source-selection.json','control-before-source-selection.json')
const pictures=[]
for(const name of fs.readdirSync(root+'/screenshots').filter(n=>n.endsWith('.png')).sort()){
 copy(root+'/screenshots/'+name,name)
 const at=fs.statSync(root+'/screenshots/'+name).mtimeMs,writer=JSON.parse(fs.readFileSync(root+'/after-config.json','utf8'))
 pictures.push({name,savedAt:new Date(at).toISOString(),insideAfterWriterWindow:at>=Date.parse(writer.at)&&at<=Date.parse(writer.endedAt),boundary:'Actual manually viewed IAB screenshot;file-save time,not a browser paint timestamp'})
}
fs.writeFileSync(out+'/matrix.json',JSON.stringify({decision:'Withdraw exact production candidate;full performance criteria failed',rows:matrix,maximumModelRequests:4,actualModelRequests:4,controlsActualModelRequests:0},null,2)+'\n',{flag:'wx'})
fs.writeFileSync(out+'/screenshots.json',JSON.stringify(pictures,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({files:fs.readdirSync(out).length,screenshots:pictures.length,matrix:matrix.map(r=>({stage:r.stage,saveMs:r.saveMs,restoreMs:r.restoreMs,readMaxMs:r.readMaxMs})),picture04:pictures.find(p=>p.name.startsWith('04-'))}))
