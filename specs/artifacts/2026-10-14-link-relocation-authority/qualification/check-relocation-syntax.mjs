import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const root=path.resolve('.tmp-codex-directory-target-01a133'),results=[]
for(const name of ['prepare-relocation-input.mjs','relocation-kind-qualifier.mjs','run-dot-native.mjs']){
 const file=path.join(root,name),args=['--check',file]
 const result=spawnSync(process.execPath,args,{windowsHide:true,encoding:null})
 for(const [suffix,bytes] of [['stdout.bin',result.stdout],['stderr.bin',result.stderr]])fs.writeFileSync(path.join(root,'relocation-syntax-'+name+'.'+suffix),bytes,{flag:'wx'})
 const receipt={executable:process.execPath,args,exitCode:result.status,signal:result.signal,atUtc:new Date().toISOString(),qualification:'Syntax-only; no module/Native load, fixture, UI or functional acceptance'}
 fs.writeFileSync(path.join(root,'relocation-syntax-'+name+'.exit.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'})
 results.push(receipt)
 if(result.status!==0){process.exitCode=1;break}
}
console.log(JSON.stringify(results))
