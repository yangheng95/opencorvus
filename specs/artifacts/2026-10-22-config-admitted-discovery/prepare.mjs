import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),prior=path.resolve(root,'../member-locale-stream-516'),zero=path.resolve(root,'../offline-location-recovery-515'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='config-admitted-discovery-518',source=base+'/source-keyboard-dock-517-before'
let data=fs.readFileSync(zero+'/prepare-data.ts','utf8').replace(/assert\(\[[^\n]+\.includes\(stage\)\)/,"assert(['before','after'].includes(stage))")
const start=data.indexOf('const root=import.meta.dir,'),end=data.indexOf('\nconst proof=',start);assert(start>=0&&end>start)
data=data.slice(0,start)+`const root=import.meta.dir,repo=path.resolve(root,'../..'),base='${base}',name='${scope}',source='${source}'`+data.slice(end)
data=data.replaceAll('modelInputBudget:0','modelInputBudget:4').replace('No credentials or catalog staged; original source native/source/output/launcher closed; zero model requests','Paired authority staged separately;source fully closed;fixed4 requests including preflight/helpers')
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('member-locale-stream-516',scope)
 code=code.replace('$taskPort=if($Stage -eq \'before\'){18975}else{18977}',"$taskPort=if($Stage -eq 'before'){18983}else{18985}")
 code=code.replace('$taskBudget=8','$taskBudget=4').replace('$taskMaximum=8','$taskMaximum=4').replace('proof.maximumRequests,8','proof.maximumRequests,4').replace('proof.requests<=8','proof.requests<=4')
 code=code.replace('maximumBatchRequests:16,scopeBudgets:{before:8,after:8}','maximumBatchRequests:8,scopeBudgets:{before:4,after:4}').replaceAll('maximumBatchRequests:16','maximumBatchRequests:8')
 code=code.replaceAll('2026-10-22-member-locale-stream.md','2026-10-22-config-admitted-discovery.md')
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
let preservation=fs.readFileSync(prior+'/preserve.ts','utf8').replace('modelInputBudget:16','modelInputBudget:8')
preservation="import {parse} from '../../packages/overlay/node_modules/jsonc-parser'\n"+preservation
preservation=preservation.replace("assert.equal(fs.readFileSync(input.target+'/runtime/config/opencorvus.jsonc','utf8'),input.canonical)","const targetCanonical=fs.readFileSync(input.target+'/runtime/config/opencorvus.jsonc','utf8');assert.deepEqual(parse(targetCanonical),parse(input.canonical));const canonicalObservation={allParsedFields:'Restored',rawSourceBytesExact:targetCanonical===input.canonical}")
preservation=preservation.replace("canonical:'Complete source bytes exact'","canonical:canonicalObservation")
fs.writeFileSync(root+'/preserve.ts',preservation,{flag:'wx'})
const old=path.resolve(root,'../config-physical-path-cost-483/mix')
for(const stage of ['before','after'])for(const round of ['cold','repeat']){
 const name=stage+'-'+round,dir=root+'/'+name,run=base+'/'+scope+'-'+stage,port=stage==='before'?18983:18985
 fs.mkdirSync(dir,{recursive:false})
 for(const [from,to]of [['config-write-after.ts','config-write.ts'],['prepare-readers-after.ts','prepare-readers.ts'],['readers-after.mjs','readers.mjs']]){
  let code=fs.readFileSync(old+'/'+from,'utf8')
  code=code.replaceAll('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/config-physical-path-cost-483-mixed-final',run)
  code=code.replaceAll('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/config-physical-path-cost-483-data',run)
  code=code.replaceAll("base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21'","base='"+base+"'")
  code=code.replaceAll("tag='config-physical-path-cost-483-mixed-final'","tag='"+scope+'-'+stage+"'")
  code=code.replaceAll('config-physical-path-cost-483-mixed-final-',scope+'-'+stage+'-')
  code=code.replaceAll('18841',String(port)).replaceAll('qa-physical483-mixed','qa-admitted518-'+name)
  for(const marker of ['checker','reader','write'])code=code.replaceAll('after-'+marker,'run-'+marker)
  code=code.replaceAll('history-after-verified.json','history-run-verified.json')
  code=code.replaceAll('2026-10-21/','2026-10-22/').replaceAll('qa-canonical-after-check.json','qa-canonical-'+name+'.json')
  code=code.replace('if (!accepted || !restored) process.exitCode = 1','if (!accepted || !restored || writeMs > 10_000 || restoreMs > 5_000) process.exitCode = 1')
  if(from==='readers-after.mjs')code+='\nif(results.some(result=>result.ms>20_000))process.exitCode=1\n'
  fs.writeFileSync(dir+'/'+to,code,{flag:'wx'})
 }
}
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope,source,ports:{before:18983,after:18985},scopeBudgets:{before:4,after:4},maximumRequests:8,model:'gpt-6.1-sol',stream:true,thresholdsMs:{save:10000,restore:5000,read:20000},directories:'All165 original registry worktrees plus real preflight additions;no sampling',rounds:['cold','repeat'],transport:'Production Overlay config service/browser HostTransport/real Source CLI HTTP;not UI tests',authority:'Complete paired auth/models;retire all four after original chain'},null,2)+'\n',{flag:'wx'})
console.log('Full165 configuration review helpers prepared;no process or authority staged')
