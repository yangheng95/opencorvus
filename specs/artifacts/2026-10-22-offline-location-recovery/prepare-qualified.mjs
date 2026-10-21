import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../native-stream-reconnect-512'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='offline-location-recovery-515'
const sources={'qualified-ui':base+'/'+scope+'-after-ui','qualified-api':base+'/'+scope+'-after-api-supersede'}
let data=fs.readFileSync(root+'/prepare-data.ts','utf8')
data=data.replace(/assert\(\[[^\n]+\.includes\(stage\)\)/,"assert(['qualified-ui','qualified-api'].includes(stage))")
const begin=data.indexOf('const root=import.meta.dir,'),end=data.indexOf('\nconst proof=',begin)
assert(begin>=0&&end>begin)
data=data.slice(0,begin)+`const root=import.meta.dir,repo=path.resolve(root,'../..'),base='${base}',name='${scope}',source=(${JSON.stringify(sources)} as Record<string,string>)[stage]`+data.slice(end)
data=data.replaceAll('modelInputBudget:0',"modelInputBudget:stage==='qualified-api'?8:0")
fs.writeFileSync(root+'/qualified-prepare-data.ts',data,{flag:'wx'})
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1']){
 let code=fs.readFileSync(root+'/'+file,'utf8').replace(/\[ValidateSet\([^\n]+?\)\]/,"[ValidateSet('qualified-ui')]")
 code=code.replace(/\$taskPort=@\{[^\n]+\}\[\$Stage\]/,'$taskPort=18971')
 if(file==='launch.ps1')code=code.replace('/offline-location-recovery-515/serve.ts','/offline-location-recovery-515/qualified-ui-serve.ts')
 fs.writeFileSync(root+'/qualified-ui-'+file,code,{flag:'wx'})
}
let serve=fs.readFileSync(root+'/serve.ts','utf8').replace(/const ports=\{[^\n]+\} as Record<string,number>/,'const ports={"qualified-ui":18971} as Record<string,number>')
fs.writeFileSync(root+'/qualified-ui-serve.ts',serve,{flag:'wx'})
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs']){
 let code=fs.readFileSync(prior+'/live-'+file,'utf8').replaceAll('native-stream-reconnect-512',scope)
 code=code.replaceAll("[ValidateSet('live','review')]","[ValidateSet('qualified-api')]").replaceAll("stage==='live'||stage==='review'","stage==='qualified-api'")
 code=code.replace('$taskBudget=32','$taskBudget=8').replace('$taskMaximum=32','$taskMaximum=8').replaceAll('proof.maximumRequests,32','proof.maximumRequests,8').replaceAll('proof.requests<=32','proof.requests<=8')
 code=code.replaceAll('maximumBatchRequests:64,scopeBudgets:{live:32,review:32}',"maximumBatchRequests:8,scopeBudgets:{'qualified-api':8}").replaceAll('maximumBatchRequests:64','maximumBatchRequests:8')
 code=code.replace(/\$taskPort=if\([^\n]+/,'$taskPort=18973').replaceAll('$taskPort=@{live=18951;review=18953}[$Stage]','$taskPort=18973')
 code=code.replace('/offline-location-recovery-515/live-serve.ts','/task-member-stream-504/serve.ts')
 code=code.replace('Task member qualification source/runtime pairs physically retired','Configured workspace review source/runtime pairs physically retired')
 fs.writeFileSync(root+'/qualified-api-'+file,code,{flag:'wx'})
}
const preservation=fs.readFileSync(root+'/preserve.ts','utf8').replace('modelInputBudget:0','modelInputBudget:8').replaceAll('data-preservation-observation.json','qualified-data-preservation-observation.json')
fs.writeFileSync(root+'/qualified-preserve.ts',preservation,{flag:'wx'})
for(const stage of Object.keys(sources))fs.cpSync(base+'/'+scope+'-after-ui-bundle/bin/ui',base+'/'+scope+'-'+stage+'-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
fs.writeFileSync(root+'/qualified-plan.json',JSON.stringify({scope,sources,ports:{'qualified-ui':18971,'qualified-api':18973},maximumRequests:8,uiRequests:0,model:'gpt-6.1-sol',stream:true,scopeOfBudget:'One NativeService process,preflight and every auxiliary request;no business Task or product member planned',surface:'Same formal main-DhV28lza;no network observer or fake response',authority:'Paired private source and runtime auth/models;source unchanged;retire four copies after original physical chain even on qualification failure'},null,2)+'\n',{flag:'wx'})
console.log('Qualified independent UI18971/max0 and API18973/max8 prepared;authority not yet staged')
