import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../source-parallel-owner-532')
for(const name of ['prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','http-json.ts']){
 let code=fs.readFileSync(prior+'/'+name,'utf8').replaceAll('source-parallel-owner-532','goal-home-run-533').replaceAll('19037','19041').replaceAll('19039','19043').replaceAll('2026-10-22-source-parallel-owner.md','2026-10-22-goal-home-run.md')
 if(name==='prepare-data.ts'){
  code=code.replace("source='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/dialog-opener-focus-531-after'","source=base+'/'+(stage==='before'?'source-parallel-owner-532-before':'goal-home-run-533-before')")
  const start=code.indexOf('const proof='),end=code.indexOf('const target=')
  assert(start>0&&end>start)
  code=code.slice(0,start)+`const priorRoot=stage==='before'?repo+'/.tmp-product-iteration/source-parallel-owner-532':root
const proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8')),retired=JSON.parse(fs.readFileSync(priorRoot+'/before-authority-retirement.json','utf8'))
for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.maximumRequests,stage==='before'?8:16);assert.equal(proof.requests,6);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.copiedPair.length,2);assert.equal(retired.retired.length,2)
if(stage==='after')assert.equal(JSON.parse(fs.readFileSync(root+'/before-complete-first-goal.json','utf8')).goal.status,'complete')
for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
`+code.slice(end)
 }
 if(name==='launch.ps1')code=code.replace('$taskBudget=8','$taskBudget=16')
 if(name==='settle.ps1'){
  const start=code.indexOf('$taskMaximum=8'),end=code.indexOf('$taskAudit|ConvertTo-Json')
  assert(start>0&&end>start)
  code=code.slice(0,start)+`. "$PSScriptRoot/qualify-provider.ps1"
$taskPlan=Get-Content -Raw -LiteralPath "$PSScriptRoot/plan.json"|ConvertFrom-Json
$taskPreflight=Get-Content -Raw -LiteralPath "$taskEvidence/preflight-ready.json"|ConvertFrom-Json
$taskQualification=Get-GoalScopeProviderQualification $taskAudit $taskPlan $taskPreflight $taskSettled $taskLauncher
$taskMaximum=$taskQualification.maximum
$taskQualificationFailures=@($taskQualification.failures)
`+code.slice(end)
 }
 if(name==='prepare-data.ts')code=code.replaceAll('modelInputBudget:8','modelInputBudget:16').replaceAll('fixed8 actual stream requests','maximum16 actual stream requests')
 if(name==='prepare-authority.mjs')code=code.replaceAll('maximumBatchRequests:16','maximumBatchRequests:32').replaceAll('scopeBudgets:{before:8,after:8}','scopeBudgets:{before:16,after:16}')
 if(name==='retire-authority.mjs')code=code.replace('assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.maximumRequests,8);assert(proof.requests<=8)',"const plan=read(root+'/plan.json')\nassert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.maximumRequests,plan.maximumRequestsPerStartedScope);assert(proof.requests<=plan.maximumRequestsPerStartedScope)")
 fs.writeFileSync(root+'/'+name,code,{flag:'wx'})
}
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope:'goal-home-run-533',source:'Closed532-before;after copies closed533-before with completed first Goal and its actual history',ports:{before:19041,after:19043},maximumRequestsPerStartedScope:16,initiallyStartedScopes:['before'],model:'gpt-6.1-sol',goalBudgets:{before:{initial:2,adjusted:4},after:{initial:1}},flow:'Actual Home composer/form -> new Chat Goal -> running -> pause -> resume/budget -> operator evidence complete;after new Goal and normal human contrast',ui:'Only real native page interactions,screenshots,manual review;backend observer is readonly'},null,2)+'\n',{flag:'wx'})
console.log('Fresh533 helpers prepared;no service or authority staged')
