import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',out=repo+'/specs/artifacts/2026-10-21-goal-reconciliation-admission'
fs.mkdirSync(out)
for(const name of ['after-data-preparation.json','before-observation.json','before-after-observation.json','runtime-observation.json','runtime-check.log','real-read-check.json','real-read-check.log','data-preservation-observation.json','preserve.log','focused-tests-input-001.log','focused-tests-recheck.log','scheduler-runtime-check.log','typecheck.log','prepare.mjs','prepare-data.ts','check-reads.ts','check-runtime.mjs','compare-observations.mjs','preserve.ts','serve-after.ts','launch-after.ps1','shutdown-after.ps1','settle-after.ps1','archive.mjs'])fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
for(const name of ['service-ready.json','project-plan.json','public-shutdown.json','physical-terminal.json'])fs.copyFileSync(base+'/goal-reconciliation-admission-499-after/evidence/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const pictures=[]
for(const name of fs.readdirSync(root+'/screenshots').filter(n=>n.endsWith('.png')).sort()){
 fs.copyFileSync(root+'/screenshots/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
 pictures.push({name,savedAt:new Date(fs.statSync(root+'/screenshots/'+name).mtimeMs).toISOString(),boundary:'Actually viewed manual IAB1280x720;file-save time,not paint time;no UI automation'})
}
fs.writeFileSync(out+'/screenshots.json',JSON.stringify(pictures,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({files:fs.readdirSync(out).length,pictures:pictures.length,privateFullDatabaseRowsArchived:0,credentialMembersCopied:0,realModelInputs:0}))
