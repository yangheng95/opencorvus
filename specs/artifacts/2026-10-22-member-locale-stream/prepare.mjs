import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../offline-location-recovery-515'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='member-locale-stream-516',source=base+'/offline-location-recovery-515-after-ui'
let data=fs.readFileSync(prior+'/prepare-data.ts','utf8')
data=data.replace(/assert\(\[[^\n]+\.includes\(stage\)\)/,"assert(['before','after'].includes(stage))")
const start=data.indexOf('const root=import.meta.dir,'),end=data.indexOf('\nconst proof=',start);assert(start>=0&&end>start)
data=data.slice(0,start)+`const root=import.meta.dir,repo=path.resolve(root,'../..'),base='${base}',name='${scope}',source='${source}'`+data.slice(end)
data=data.replaceAll('modelInputBudget:0','modelInputBudget:8').replace('No credentials or catalog staged; original source native/source/output/launcher closed; zero model requests','Paired authority staged separately;original source fully closed;fixed8 actual stream requests')
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs']){
 let code=fs.readFileSync(prior+'/qualified-api-'+file,'utf8').replaceAll('offline-location-recovery-515',scope)
 code=code.replaceAll("[ValidateSet('qualified-api')]","[ValidateSet('before','after')]").replaceAll("stage==='qualified-api'","stage==='before'||stage==='after'")
 code=code.replace('$taskPort=18973',"$taskPort=if($Stage -eq 'before'){18975}else{18977}")
 code=code.replaceAll("maximumBatchRequests:8,scopeBudgets:{'qualified-api':8}","maximumBatchRequests:16,scopeBudgets:{before:8,after:8}").replaceAll('maximumBatchRequests:8','maximumBatchRequests:16')
 code=code.replaceAll('2026-10-22-native-stream-reconnect.md','2026-10-22-member-locale-stream.md')
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
const preserve=fs.readFileSync(prior+'/qualified-preserve.ts','utf8').replaceAll('modelInputBudget:8','modelInputBudget:16').replaceAll('qualified-data-preservation-observation.json','data-preservation-observation.json')
fs.writeFileSync(root+'/preserve.ts',preserve,{flag:'wx'})
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope,source,ports:{before:18975,after:18977},maximumRequests:16,scopeBudgets:{before:8,after:8},model:'gpt-6.1-sol',stream:true,after:'Only after proven production fix;otherwise unused quota retired',sourceUI:base+'/offline-location-recovery-515-after-ui-bundle/bin/ui',publication:'main-DhV28lza',member:'ses_-zUS0WzzQzzDOGrIbYwN',parent:'ses_-zUS0X33CzzWEKMgCk98',surface:'Source CLI real manual UI;one existing member prompt;no new delegation'},null,2)+'\n',{flag:'wx'})
console.log('Fresh before/conditional-after helpers prepared;no authority staged or process started')
