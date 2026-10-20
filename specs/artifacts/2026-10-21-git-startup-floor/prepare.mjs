import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,previous=path.resolve(root,'../project-identity-component-cost-491')
for(const name of ['input-private.json','expected-git-private.json'])fs.copyFileSync(path.join(previous,name),path.join(root,name),fs.constants.COPYFILE_EXCL)
let launch=fs.readFileSync(previous+'/launch.ps1','utf8')
for(const [from,to]of [
 ["[ValidateSet('components')]","[ValidateSet('measure')]"],
 ["[ValidateSet('files','git','stat','real')]","[ValidateSet('query','version','cmd')]"],
 ['project-identity-component-cost-491','git-startup-floor-493'],
 ['member-reading-lifecycle-487-before-bundle','dependency-redirect-hardening-488-after-bundle'],
]){assert(launch.includes(from),from);launch=launch.replaceAll(from,to)}
fs.writeFileSync(root+'/launch.ps1',launch,{flag:'wx'})
let preserve=fs.readFileSync(path.resolve(root,'../native-query-scope-490/verify-source.ts'),'utf8')
fs.writeFileSync(root+'/verify-source.ts',preserve,{flag:'wx'})
console.log('Fresh149 input,original bytes,zero-model isolated owned-host launcher prepared')
