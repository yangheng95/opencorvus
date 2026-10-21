import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../home-goal-entry-496'),name='markdown-batch-continuity-497'
for(const file of ['prepare-authority.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','preserve.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('home-goal-entry-496',name).replaceAll('18871','18875').replaceAll('18873','18877')
 if(file==='prepare-authority.mjs')code=code.replaceAll('maximumBatchRequests:12','maximumBatchRequests:16').replaceAll('scopeBudgets:{before:2,after:10}','scopeBudgets:{before:8,after:8}')
 if(file==='preserve.ts')code=code.replaceAll('maximumRequests:12','maximumRequests:16')
 if(file==='launch.ps1'){
  const old='$taskBun=if($Stage -eq \'before\'){"$taskBase/dependency-redirect-hardening-488-after-bundle/bin/bun.exe"}else{"$taskBase/'+name+'-after-bundle/bin/bun.exe"}'
  assert(code.includes(old));code=code.replace(old,'$taskBun="$taskBase/'+name+'-$Stage-bundle/bin/bun.exe"').replace("if($Stage -eq 'before'){2}else{10}",'8')
 }
 if(file==='settle.ps1')code=code.replace("if($Stage -eq 'before'){2}else{10}",'8')
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
const base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21'
for(const stage of ['before','after']){
 const dir=base+'/'+name+'-'+stage+'-bundle/bin';assert.equal(fs.existsSync(dir),false);fs.mkdirSync(dir,{recursive:true})
 fs.copyFileSync(base+'/dependency-redirect-hardening-488-after-bundle/bin/bun.exe',dir+'/bun.exe',fs.constants.COPYFILE_EXCL)
}
console.log('Fresh exact8+8 preparations and private Bun bundles;no credential copy or model input yet')
