import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../startup-location-discovery-510'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='native-stream-reconnect-512'
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','serve.ts','preserve.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('startup-location-discovery-510',scope).replaceAll("'before','after'","'historical'").replaceAll('@{before=18941;after=18943}','@{historical=18949}').replaceAll("{'18941':'before','18943':'after'}","{'18949':'historical'}")
 if(file==='launch.ps1')code=code.replace('"$taskRoot/launch-project-removed"',"'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/live-member-refresh-511-before/runtime/data/projects/2026/10/22/ebb75947-7467-434b-b3ec-aa7eea039f08'")
 if(file==='serve.ts')code=code.replace('await fs.mkdir(evidence,{recursive:true})',`await fs.mkdir(evidence,{recursive:true})
const {installNativeTaskStreamObserver}=await import('./network-observer.ts')
installNativeTaskStreamObserver({evidence,port:Number(portText),occurrence,taskID:'tsk_g00VYhrJxy00qIC54qvM',allowedActions:['calibration','browser'],mode:'native-idle'})`)
 code=code.replaceAll('Startup location and directory discovery review','Native task stream reconnect review').replaceAll('Startup link restoration','Native stream reconnect')
 fs.writeFileSync(root+'/'+file,code.trimEnd()+'\n',{flag:'wx'})
}
let data=fs.readFileSync(prior+'/prepare-data.ts','utf8').replace("['before','after']","['historical']")
const start=data.indexOf('const root=import.meta.dir,'),end=data.indexOf('\nconst target=',start);assert(start>0&&end>start)
data=data.slice(0,start)+`const root=import.meta.dir,repo=path.resolve(root,'../..'),base='${base}',name='${scope}',source=base+'/live-member-refresh-511-before'
const proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.requests,15)`+data.slice(end)
data=data.replace("'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/markdown-batch-continuity-497-before-bundle/bin/bun.exe'","base+'/startup-location-discovery-510-after-bundle/bin/bun.exe'")
fs.writeFileSync(root+'/prepare-data.ts',data.trimEnd()+'\n',{flag:'wx'})
fs.cpSync(base+'/startup-location-discovery-510-after-bundle/bin/ui',base+'/'+scope+'-historical-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
console.log('Fresh historical18949;zero model budget;closed511 source;formal main-B1unUUgO;two finite native stream timeout actions')
