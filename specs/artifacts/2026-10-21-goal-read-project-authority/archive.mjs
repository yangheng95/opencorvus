import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',out=repo+'/specs/artifacts/2026-10-21-goal-read-project-authority'
fs.mkdirSync(out)
for(const name of ['before-data-preparation.json','after-data-preparation.json','goal-before-http.json','goal-after-http.json','real-read-check.json','real-read-check.log','data-preservation-observation.json','preserve.log','preserve-binary-001.log','focused-tests.log','typecheck.log','prepare.ts','check-reads.ts','preserve.ts','serve-before.ts','serve-after.ts','launch-before.ps1','launch-after.ps1','shutdown-before.ps1','shutdown-after.ps1','settle-before.ps1','settle-after.ps1','archive.mjs'])fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
for(const stage of ['before','after'])for(const name of ['service-ready.json','public-shutdown.json','physical-terminal.json'])fs.copyFileSync(base+'/goal-deliverable-navigation-498-'+stage+'/evidence/'+name,out+'/'+stage+'-'+name,fs.constants.COPYFILE_EXCL)
const pictures=[]
for(const name of fs.readdirSync(root+'/screenshots').filter(n=>n.endsWith('.png')).sort()){
 fs.copyFileSync(root+'/screenshots/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
 pictures.push({name,savedAt:new Date(fs.statSync(root+'/screenshots/'+name).mtimeMs).toISOString(),boundary:'Manually viewed actual IAB1280x720;file save time,not paint timing;03 is an incorrect QA experience URL,not a successful Goal view'})
}
fs.writeFileSync(out+'/screenshots.json',JSON.stringify(pictures,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({files:fs.readdirSync(out).length,pictures:pictures.length,privateWholeDatabaseRowsArchived:0,credentialMembersCopied:0,modelInputs:0}))
