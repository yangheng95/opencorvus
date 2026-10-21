import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,prior=path.resolve(root,'../agent-rail-identity-509'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='startup-location-discovery-510'
for(const file of ['launch.ps1','serve.ts','shutdown.ps1','settle.ps1','preserve.ts','build.mjs']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('agent-rail-identity-509',scope).replaceAll('18933','18941').replaceAll('18935','18943')
 code=code.replaceAll("'before','after','review','final'","'before','after'").replaceAll(';review=18937;final=18939','').replaceAll(", 'review','final'",'')
 code=code.replace(",'18937':'review','18939':'final'",'')
 if(file==='launch.ps1')code=code.replace("'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/live-member-concurrency-508-after/runtime/data/projects/2026/10/22/822ac82d-f576-423d-a6b2-c13899cd883e'",'"$taskRoot/launch-project-removed"')
 code=code.replaceAll('Read-only original long transcript mount review','Startup location and directory discovery review').replaceAll('Markdown and row mount causality','Startup link restoration')
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
let data=fs.readFileSync(prior+'/prepare-data.ts','utf8')
data=data.replace("['before','after','review','final']","['before','after']")
const begin=data.indexOf("const root=import.meta.dir,"),end=data.indexOf('\nconst proof=',begin)
data=data.slice(0,begin)+`const root=import.meta.dir,repo=path.resolve(root,'../..'),base='${base}',name='${scope}',source=stage==='before'?base+'/agent-rail-identity-509-final':base+'/'+name+'-before'`+data.slice(end)
const proofStart=data.indexOf('const proof='),proofEnd=data.indexOf('\nconst target=',proofStart)
data=data.slice(0,proofStart)+`const proof=JSON.parse(fs.readFileSync(source+'-service/evidence/physical-terminal.json','utf8'))
for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
assert.equal(proof.launcher.childExitCode,0);assert.equal(proof.originalExit,0);assert.equal(proof.shutdown.statusCode,200);assert.equal(proof.provider.maximum,0);assert.equal(proof.provider.actual,0);assert.equal(proof.provider.exhausted,false)`+data.slice(proofEnd)
data=data.replace('Private diagnostic UI is built separately through the formal Vite configuration','Formal production UI is prepared separately; source CLI serves /ui')
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
fs.cpSync(base+'/agent-rail-identity-509-final-bundle/bin/ui',base+'/'+scope+'-before-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
console.log('Fresh510 before18941/after18943;zero model budgets;closed509-final source;missing owned launch path')
