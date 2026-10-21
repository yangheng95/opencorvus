import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../config-admitted-discovery-518'),scope='config-source-order-520'
let data=fs.readFileSync(prior+'/prepare-data.ts','utf8').replaceAll('config-admitted-discovery-518',scope).replace("source-keyboard-dock-517-before'","config-admitted-discovery-518-after'")
const proofStart=data.indexOf('const proof='),proofEnd=data.indexOf('\nconst target=',proofStart);assert(proofStart>=0&&proofEnd>proofStart)
data=data.slice(0,proofStart)+`const proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.native.terminal.exitCode,0);assert.equal(proof.pairedCleanupComplete,true)
assert(proof.chain.every((row:any)=>row.state==='dead_or_reused'))`+data.slice(proofEnd)
data=data.replace('2026-10-21/markdown-batch-continuity-497-before-bundle','2026-10-22/config-admitted-discovery-518-after-bundle')
data+=`\nfs.mkdirSync(target+'/project');fs.mkdirSync(target+'/managed');fs.writeFileSync(target+'/custom.jsonc',JSON.stringify({username:'QA custom source 520',permission_mode:'full_access'})+'\\n',{flag:'wx'});console.log('Fresh owned initial project and custom file ready before Flag import')\n`
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','copy-ui.mjs','preserve.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('config-admitted-discovery-518',scope)
 code=code.replaceAll('18983','18987').replaceAll('18985','18989')
 code=code.replaceAll('2026-10-22-config-admitted-discovery.md','2026-10-22-config-source-order.md')
 if(file==='launch.ps1'){
  const home="$taskEnvironment.OPENCORVUS_HOME=\"$taskRun/runtime\"";assert(code.includes(home))
  code=code.replace(home,home+'\n$taskEnvironment.OPENCORVUS_CONFIG="$taskRun/custom.jsonc"\n$taskEnvironment.OPENCORVUS_TEST_MANAGED_CONFIG_DIR="$taskRun/managed"')
  const old="'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project'";assert(code.includes(old))
  code=code.replace(old,'"$taskRun/project"')
 }
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope,source:'Closed config-admitted-discovery-518-after,complete90tables157001rows166projects',ports:{before:18987,after:18989},budgets:{before:4,after:4},maximumRequests:8,model:'gpt-6.1-sol',stream:true,custom:{username:'QA custom source 520',permission_mode:'full_access'},managed:'Empty owned directory fixed before Flag import',project:'Fresh ordinary owned initial project,all original registry retained',transport:'Source CLI dev/ui and formal main-DhV28lza,real config HTTP and manual browser screenshots',boundary:'Source byte/row preservation and all original native/provider/launcher settlement before paired retirement;no business model input'},null,2)+'\n',{flag:'wx'})
console.log('Source-order helpers ready;no process,model request or authority staged')
