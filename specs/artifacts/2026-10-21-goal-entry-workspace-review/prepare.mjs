import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../git-executable-flow-492')
let authority=fs.readFileSync(prior+'/prepare.mjs','utf8').replaceAll('git-executable-flow-492','home-goal-entry-496')
authority=authority.replaceAll('maximumBatchRequests:4','maximumBatchRequests:12').replace('scopeBudgets:{before:2,after:2}','scopeBudgets:{before:2,after:10}')
fs.writeFileSync(root+'/prepare-authority.mjs',authority,{flag:'wx'})
fs.writeFileSync(root+'/prepare-data.ts',fs.readFileSync(prior+'/prepare-data.ts','utf8').replaceAll('git-executable-flow-492','home-goal-entry-496'),{flag:'wx'})
let launch=fs.readFileSync(prior+'/launch.ps1','utf8').replaceAll('git-executable-flow-492','home-goal-entry-496').replaceAll('18863','18871').replaceAll('18865','18873')
const original='$taskBun="$taskBase/dependency-redirect-hardening-488-after-bundle/bin/bun.exe"'
assert(launch.includes(original));launch=launch.replace(original,'$taskBun=if($Stage -eq \'before\'){"$taskBase/dependency-redirect-hardening-488-after-bundle/bin/bun.exe"}else{"$taskBase/home-goal-entry-496-after-bundle/bin/bun.exe"}\n$taskBudget=if($Stage -eq \'before\'){2}else{10}')
assert(launch.includes("'2' 'NativeService'"));launch=launch.replace("'2' 'NativeService'","([string]$taskBudget) 'NativeService'")
fs.writeFileSync(root+'/launch.ps1',launch,{flag:'wx'})
let shutdown=fs.readFileSync(prior+'/shutdown.ps1','utf8').replaceAll('git-executable-flow-492','home-goal-entry-496').replaceAll('18863','18871').replaceAll('18865','18873')
shutdown=shutdown.replace("'before','after','control-before','control-after'","'before','after'").replace(";'control-before'=18867;'control-after'=18869",'')
fs.writeFileSync(root+'/shutdown.ps1',shutdown,{flag:'wx'})
fs.writeFileSync(root+'/preserve.ts',fs.readFileSync(prior+'/preserve.ts','utf8').replaceAll('git-executable-flow-492','home-goal-entry-496').replace("['before','after','control-before','control-after']","['before','after']").replace('clones:4','clones:2'),{flag:'wx'})
console.log('Fresh paired-authority/data preparations and exact2+10 request source-service launchers prepared;no model input')
