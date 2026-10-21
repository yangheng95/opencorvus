import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),old=root+'/../markdown-batch-continuity-497',name='real-deliverable-review-501'
let authority=fs.readFileSync(old+'/prepare-authority.mjs','utf8').replaceAll('markdown-batch-continuity-497',name)
 .replace('claims.exp*1000>Date.now()','claims.exp*1000>Date.now()+1200000')
 .replaceAll('maximumBatchRequests:16','maximumBatchRequests:12').replaceAll('scopeBudgets:{before:8,after:8}','scopeBudgets:{before:12}')
fs.writeFileSync(root+'/prepare-authority.mjs',authority,{flag:'wx'})
let data=fs.readFileSync(root+'/../goal-deliverable-interface-500/prepare-data.ts','utf8')
 .replace("name='goal-deliverable-interface-500',source=base+'/goal-reconciliation-admission-499-after-data'","name='"+name+"',source=base+'/goal-deliverable-interface-500-after-data'")
 .replace("base+'/goal-reconciliation-admission-499-after/evidence/physical-terminal.json'","base+'/goal-deliverable-interface-500-after/evidence/physical-terminal.json'")
 .replace("name+'-'+stage+'-data'","name+'-'+stage")
 .replace('modelInputBudget:0','modelInputBudget:12').replaceAll('source499','source500')
data=data.slice(0,data.indexOf("const prior=repo+'/.tmp-product-iteration/member-reading-lifecycle-487'"))
assert(data.includes("source=base+'/goal-deliverable-interface-500-after-data'"))
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
let serve=fs.readFileSync(repo+'/.tmp-product-iteration/live-sol-task-guidance-413.ts','utf8')
 .replace('path.resolve(import.meta.dir, "../packages/opencorvus")','path.resolve(import.meta.dir, "../../packages/opencorvus")')
 .replace('const startupDeadline = Date.now() + 180_000','let startupActivityAt = Date.now()\n    let previousStartupActivity = ""')
 .replace('if (Date.now() > startupDeadline) throw new Error("OWNED_CLI_STARTUP_TIMEOUT")','const logBytes = await fs.stat(path.join(runtime, "log/dev.log")).then(s => s.size, () => 0)\n      const startupActivity = JSON.stringify({receipt,logBytes})\n      if(startupActivity !== previousStartupActivity){previousStartupActivity=startupActivity;startupActivityAt=Date.now()}\n      if (Date.now() - startupActivityAt > 180_000) throw new Error("OWNED_CLI_STARTUP_INACTIVITY")')
fs.writeFileSync(root+'/serve.ts',serve,{flag:'wx'})
for(const kind of ['launch','shutdown','settle']){
 let body=fs.readFileSync(old+'/'+kind+'.ps1','utf8').replaceAll('markdown-batch-continuity-497',name).replaceAll('18875','18889').replaceAll('18877','18891')
 body=body.replace("param([Parameter(Mandatory=$true)][ValidateSet('before','after')][string]$Stage)","$Stage='before'")
 if(kind==='launch')body=body.replace('$taskBudget=8','$taskBudget=12').replace("$taskOccurrence ([string]$taskDeadline) $taskBun $taskWrapper",'$taskOccurrence ([string]$taskDeadline) $taskBun "'+repo+'/.tmp-product-iteration/'+name+'/serve.ts"')
 if(kind==='settle')body=body.replace('$taskMaximum=8','$taskMaximum=12')
 fs.writeFileSync(root+'/'+kind+'.ps1',body,{flag:'wx'})
}
let preserve=fs.readFileSync(root+'/../goal-deliverable-interface-500/preserve.ts','utf8').replace("['before','after']","['before']")
fs.writeFileSync(root+'/preserve.ts',preserve,{flag:'wx'})
console.log('Prepared one exact12-request native scope,paired authority and full source clone scripts;no credentials copied or model inputs yet')
