import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../live-member-refresh-511'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='native-stream-reconnect-512'
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','scan-final.mjs','snapshot.ts','create-task.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('live-member-refresh-511',scope).replaceAll("'before','after'","'live','review'").replaceAll("stage==='before'","stage==='live'").replaceAll("stage==='after'","stage==='review'").replaceAll("$Stage -eq 'before'","$Stage -eq 'live'").replaceAll('@{before=18945;after=18947}','@{live=18951;review=18953}').replaceAll('18945','18951').replaceAll('18947','18953').replaceAll('2026-10-22-live-member-refresh','2026-10-22-native-stream-reconnect')
 if(file==='launch.ps1')code=code.replace('task-member-stream-504/serve.ts','native-stream-reconnect-512/live-serve.ts')
 if(file==='create-task.ts'){
  code=code.replaceAll('LIVE511','LIVE512').replaceAll('live511','live512').replaceAll('511','512').replace('双成员正文流中刷新 512','双成员同文档断流 512')
  code=code.replace("console.log(JSON.stringify({status:response.status",`fs.writeFileSync(root+'/'+stage+'-network-target.json',JSON.stringify({taskID:result.task_id,source:'Actual global.tasks 202 response',requestID})+'\\n')
console.log(JSON.stringify({status:response.status`)
 }
 if(file==='prepare-authority.mjs')code=code.replace('scopeBudgets:{before:32,after:32}','scopeBudgets:{live:32,review:32}')
 if(file==='scan-final.mjs')code=code.replace("root+'/before-authority-preparation.json'","root+'/live-authority-preparation.json'")
 fs.writeFileSync(root+'/live-'+file,code.trimEnd()+'\n',{flag:'wx'})
}
let data=fs.readFileSync(prior+'/prepare-data.ts','utf8').replace("stage==='before'||stage==='after'","stage==='live'||stage==='review'")
const start=data.indexOf('const root=import.meta.dir,'),end=data.indexOf('\nconst target=',start);assert(start>0&&end>start)
data=data.slice(0,start)+`const root=import.meta.dir,repo=path.resolve(root,'../..'),base='${base}',name='${scope}',source=base+(stage==='live'?'/native-stream-reconnect-512-historical':'/native-stream-reconnect-512-live')
const proof=JSON.parse(fs.readFileSync(source+(stage==='live'?'-service/evidence/physical-terminal.json':'/evidence/physical-terminal-and-pair-cleanup.json'),'utf8'))
for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
if(stage==='live'){assert.equal(proof.originalExit,0);assert.equal(proof.provider.actual,0);assert.equal(proof.provider.maximum,0)}else{assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true)}`+data.slice(end)
fs.writeFileSync(root+'/live-prepare-data.ts',data.trimEnd()+'\n',{flag:'wx'})
for(const stage of ['live','review'])fs.writeFileSync(root+'/'+stage+'-network-target.json',JSON.stringify({taskID:'tsk_g00VYhrJxy00qIC54qvM',source:'Original historical Task from closed511;calibration target only'})+'\n',{flag:'wx'})
fs.cpSync(base+'/startup-location-discovery-510-after-bundle/bin/ui',base+'/'+scope+'-live-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
console.log('512 live32/conditional review32;historical fully closed;formal UI;paired preflight and transport calibration precede business Task')
