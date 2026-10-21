import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),prior=path.resolve(root,'../live-member-concurrency-508'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='live-member-refresh-511'
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','scan-final.mjs','snapshot.ts','create-task.ts','preserve.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('live-member-concurrency-508',scope).replaceAll('2026-10-21/live-member-concurrency','2026-10-22/live-member-concurrency').replaceAll('2026-10-21', '2026-10-22').replaceAll('18925','18945').replaceAll('18927','18947')
 code=code.replaceAll('2026-10-22-live-member-concurrency','2026-10-22-live-member-refresh')
 if(file==='create-task.ts')code=code.replaceAll('约2500中文字','约4500中文字').replaceAll('508','511').replace('双成员并发来源与长文 511','双成员正文流中刷新 511')
 if(file==='preserve.ts')code=code.replace(',"formal-before":0','')
 if(file==='settle.ps1'){
  code=code.replace(' -or $taskSettled.terminal.exitCode -ne 0 -or $taskLauncher.originalChildExit -ne 0','')
  const start=code.indexOf('if($taskAudit.requests.Count -gt $taskMaximum'),end=code.indexOf('$taskAudit|ConvertTo-Json',start);assert(start>0&&end>start)
  code=code.slice(0,start)+`$taskQualificationFailures=@()
if($taskAudit.requests.Count -gt $taskMaximum -or $taskAudit.maxRequests -ne $taskMaximum -or $taskAudit.exhausted){$taskQualificationFailures+=@{kind='fixed-budget';actual=$taskAudit.requests.Count;maximum=$taskAudit.maxRequests;exhausted=$taskAudit.exhausted}}
if($taskSettled.terminal.exitCode -ne 0 -or $taskLauncher.originalChildExit -ne 0){$taskQualificationFailures+=@{kind='service-exit';native=$taskSettled.terminal.exitCode;launcher=$taskLauncher.originalChildExit}}
foreach($taskRequest in $taskAudit.requests){if($taskRequest.model -cne 'gpt-6.1-sol' -or !$taskRequest.streaming -or $taskRequest.status -ne 200 -or $taskRequest.response_reader.state -cne 'settled' -or $taskRequest.response_reader.terminal.kind -cne 'eof'){$taskQualificationFailures+=@{kind='source-reader';model=$taskRequest.model;streaming=$taskRequest.streaming;status=$taskRequest.status;reader=$taskRequest.response_reader}}}
`+code.slice(end)
  code=code.replace('retired-after-original-physical-and-source-EOF','retired-after-original-physical-output-request-and-exact-birth-settlement')
  code=code.replace('provider=$taskAudit.requests|ForEach-Object','providerQualificationPassed=($taskQualificationFailures.Count -eq 0);qualificationFailures=$taskQualificationFailures;provider=$taskAudit.requests|ForEach-Object')
  code=code.replace('actual source EOF;complete runtime auth/models retired','actual requests;Provider qualification failures $($taskQualificationFailures.Count);complete runtime auth/models retired')
 }
 if(file==='retire-authority.mjs')code=code.replace("allActualRequests:'gpt-6.1-sol,stream=true,200,original source EOF'","allActualRequests:proof.providerQualificationPassed?'gpt-6.1-sol,stream=true,200,original source EOF':{qualification:'failed',originalFailures:proof.qualificationFailures}")
 fs.writeFileSync(root+'/'+file,code.trimEnd()+'\n',{flag:'wx'})
}
let data=fs.readFileSync(prior+'/prepare-data.ts','utf8')
const start=data.indexOf('const root=import.meta.dir,'),end=data.indexOf('\nconst proof=',start);assert(start>0&&end>start)
data=data.slice(0,start)+`const root=import.meta.dir,repo=path.resolve(root,'../..'),base='${base}',name='${scope}',source=base+(stage==='before'?'/startup-location-discovery-510-after':'/${scope}-before')`+data.slice(end)
data=data.replace("base+'/markdown-batch-continuity-497-before-bundle/bin/bun.exe'","base+'/startup-location-discovery-510-after-bundle/bin/bun.exe'")
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
fs.cpSync(base+'/startup-location-discovery-510-after-bundle/bin/ui',base+'/'+scope+'-before-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
console.log('511 fixed before32/conditional after32;closed510-after source;formal main-B1unUUgO;paired authority prepared independently;physical cleanup independent of Provider qualification')
