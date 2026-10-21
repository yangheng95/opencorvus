import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../offline-location-recovery-515'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',name='source-keyboard-dock-517',source=base+'/offline-location-recovery-515-after-ui'
let data=fs.readFileSync(prior+'/prepare-data.ts','utf8').replace(/assert\(\[[^\n]+\.includes\(stage\)\)/,"assert(['before','after'].includes(stage))")
const start=data.indexOf('const root=import.meta.dir,'),end=data.indexOf('\nconst proof=',start);assert(start>=0&&end>start)
data=data.slice(0,start)+`const root=import.meta.dir,repo=path.resolve(root,'../..'),base='${base}',name='${name}',source='${source}'`+data.slice(end)
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','serve.ts','preserve.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('offline-location-recovery-515',name)
 code=code.replace(/\[ValidateSet\([^\n]+?\)\]/,"[ValidateSet('before','after')]")
 code=code.replace(/\$taskPort=@\{[^\n]+\}\[\$Stage\]/,'$taskPort=@{before=18979;after=18981}[$Stage]')
 code=code.replace(/const ports=\{[^\n]+\} as Record<string,number>/,'const ports={before:18979,after:18981} as Record<string,number>')
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
fs.writeFileSync(root+'/plan.json',JSON.stringify({name,source,ports:{before:18979,after:18981},maximumRequests:0,authority:'No auth/models copied',surface:'Same formal main-DhV28lza;Source CLI real keyboard/manual screenshots;no UI automation',after:'Only after proven production fix'},null,2)+'\n',{flag:'wx'})
console.log('Fresh zero-model keyboard review helpers;no process started')
