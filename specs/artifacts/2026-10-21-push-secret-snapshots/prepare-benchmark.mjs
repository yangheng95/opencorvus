import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,previous=path.resolve(root,'../git-startup-floor-493')
let launch=fs.readFileSync(previous+'/launch.ps1','utf8')
for(const [from,to]of [["[ValidateSet('measure')]","[ValidateSet('benchmark')]"],["[ValidateSet('query','version','cmd')]","[ValidateSet('before','after')]"],['git-startup-floor-493','push-secret-snapshots-494']]){assert(launch.includes(from));launch=launch.replaceAll(from,to)}
fs.writeFileSync(root+'/launch.ps1',launch,{flag:'wx'})
for(const name of ['input-private.json','verify-source.ts'])fs.copyFileSync(previous+'/'+name,root+'/'+name,fs.constants.COPYFILE_EXCL)
const index=path.resolve(root,'../../.git/index');fs.copyFileSync(index,root+'/index-before-private.bin',fs.constants.COPYFILE_EXCL)
console.log('Matched immutable696cc6478 tip/current exact index and zero-model native launcher prepared')
