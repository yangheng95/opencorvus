import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21'
const artifact=repo+'/specs/artifacts/2026-10-21-real-deliverable-review'
fs.mkdirSync(artifact,{recursive:true})
function copy(source,target){
 if(fs.existsSync(target)){assert(fs.readFileSync(source).equals(fs.readFileSync(target)));return}
 fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL)
}
const names=['prepare.mjs','prepare-data.ts','prepare-authority.mjs','serve.ts','launch.ps1','shutdown.ps1','settle.ps1','preserve.ts','create-task.ts','snapshot.ts','inspect-flow.ts','cancel-incomplete.ts','retire-authority.mjs','audit-cancellation.ts',
 'prepare-recovery.mjs','prepare-recovery-data.ts','prepare-recovery-final.mjs','prepare-recovery-final-data.ts','serve-recovery.ts','serve-recovery-final.ts','launch-recovery.ps1','launch-recovery-final.ps1','shutdown-recovery.ps1','shutdown-recovery-final.ps1','settle-recovery.ps1','settle-recovery-final.ps1','preserve-recovery.ts','preserve-recovery-final.ts','check-recovery-http.ts','check-recovery-final-http.ts','complete-recovery-observation.mjs','check-recovery-observation.ts',
 'before-data-preparation.json','recovery-data-preparation.json','recovery-final-data-preparation.json','authority-preparation.json','authority-retirement.json','task-create-request.json','task-create-response.json','task-create-corrected-request.json','task-create-corrected-response.json','task-observation-001.json','task-observation-002.json','flow-observation-001.json','incomplete-cancellation.json','cancelled-durable-facts.json','data-preservation-observation.json','recovery-data-preservation-observation.json','recovery-final-data-preservation-observation.json','recovery-http-receipts.json','recovery-final-http-receipts.json','recovery-final-observation-receipts.json','recovery-final-observation-summary.json','focused-tests-final.log','typecheck-final.log',
 '01-live-task-start.png','02-real-delivery-contract-approval.png','03-cancelled-incomplete-task.png','04-recovered-cancelled-task.png','05-real-deliverable-expanded-en.png','06-real-deliverable-expanded-zh.png','07-real-deliverable-environment-zh.png']
for(const name of names){copy(root+(['01-live-task-start.png','02-real-delivery-contract-approval.png','03-cancelled-incomplete-task.png'].includes(name)?'/screenshots/':'/')+name,artifact+'/'+name)}
const scopes=[['before','physical-terminal-and-pair-cleanup.json'],['recovery','physical-terminal.json'],['recovery-final','physical-terminal.json']]
for(const [stage,proof]of scopes){
 const dir=base+'/real-deliverable-review-501-'+stage+'/evidence'
 for(const file of [proof,'native-host-ready.json','native-host-settled.json','launcher-child-exit.json','public-shutdown.json']){
  copy(dir+'/'+file,artifact+'/'+stage+'-'+file)
 }
}
const audit=JSON.parse(fs.readFileSync(base+'/real-deliverable-review-501-before/evidence/provider-final-redacted-private.json'))
const original=JSON.parse(fs.readFileSync(root+'/before-original-private.json'))
const current=JSON.parse(fs.readFileSync(root+'/cancelled-durable-facts.json'))
const lease=original.original.runtime_execution_capacity_lease.map(old=>{
 const now=current.leases.find(row=>row.rowid===old.rowid)
 return {slot:old.slot,original:{owner:old.owner_id,acquired:old.time_acquired,expires:old.expires_at},current:{owner:now.owner_id,acquired:now.time_acquired,expires:now.expires_at},
  acquisitionChanged:old.lease_id!==now.lease_id,currentExpiredBeforeCancellation:now.expires_at<1792552858178,
  releasedBeforeOriginalThirtySecondLease:now.expires_at<now.time_acquired+30000}
})
fs.writeFileSync(artifact+'/actual-provider-and-capacity-summary.json',JSON.stringify({maximumRequests:audit.maxRequests,requests:audit.requests.map(r=>({model:r.model,streaming:r.streaming,status:r.status,response_reader:r.response_reader})),leases:lease},null,2)+'\n',{flag:'wx'})
copy(root+'/archive-evidence.mjs',artifact+'/archive-evidence.mjs')
console.log(JSON.stringify({artifact,files:fs.readdirSync(artifact).length,originalPrivateHistories:'Not archived',authorityPairs:'Not archived;retired',scopeRequests:audit.requests.length}))
