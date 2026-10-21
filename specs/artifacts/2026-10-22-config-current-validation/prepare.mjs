import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../config-admitted-discovery-518'),scope='config-current-validation-521'
let data=fs.readFileSync(prior+'/prepare-data.ts','utf8').replaceAll('config-admitted-discovery-518',scope).replace("source-keyboard-dock-517-before'","config-source-order-520-final-read'")
data=data.replace("assert(['before','after'].includes(stage))","assert(stage==='before')")
const start=data.indexOf('const proof='),end=data.indexOf('\nconst target=',start);assert(start>=0&&end>start)
data=data.slice(0,start)+`const proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal.json','utf8'))
for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.native.terminal.exitCode,0);assert.equal(proof.shutdown.statusCode,200)
assert.equal(proof.provider.maximum,0);assert.equal(proof.provider.actual,0);assert.equal(proof.provider.exhausted,false)
assert(proof.chain.every((row:any)=>row.state==='dead_or_reused'))
fs.writeFileSync(root+'/source-database-private.bin',fs.readFileSync(source+'/runtime/data/opencorvus.db'),{flag:'wx'})
fs.writeFileSync(root+'/source-canonical-private.bin',fs.readFileSync(source+'/runtime/config/opencorvus.jsonc'),{flag:'wx'})`+data.slice(end)
data=data.replace('2026-10-21/markdown-batch-continuity-497-before-bundle','2026-10-22/config-admitted-discovery-518-after-bundle')
data+=`\nconst physical=[];for(const item of original.project){const info=fs.statSync(item.worktree,{bigint:true});assert(info.isDirectory());physical.push({id:item.id,path:item.worktree,device:String(info.dev),inode:String(info.ino),realpath:fs.realpathSync(item.worktree)})};fs.writeFileSync(root+'/source-directories-private.json',JSON.stringify(physical)+'\\n',{flag:'wx'});console.log(JSON.stringify({allPhysicalOriginalDirectories:physical.length,scopeBudget:4}))\n`
// The rows variable is scoped inside the transaction; read the frozen complete snapshot.
data=data.replace('for(const item of original.project)','for(const item of JSON.parse(fs.readFileSync(root+\'/before-original-private.json\',\'utf8\')).original.project)')
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','copy-ui.mjs','preserve.ts','start-round.mjs','inspect.mjs']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('config-admitted-discovery-518',scope).replaceAll('18983','18993').replaceAll('18985','18995')
 code=code.replaceAll("[ValidateSet('before','after')]","[ValidateSet('before')]").replace("stage==='before'||stage==='after'","stage==='before'")
 code=code.replaceAll('maximumBatchRequests:8','maximumBatchRequests:4').replaceAll('scopeBudgets:{before:4,after:4}','scopeBudgets:{before:4}').replaceAll('modelInputBudget:8','modelInputBudget:4')
 code=code.replaceAll("['before-cold','before-repeat','after-cold','after-repeat']","['before-cold','before-repeat']").replaceAll('2026-10-22-config-admitted-discovery.md','2026-10-22-config-current-validation.md')
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
for(const round of ['cold','repeat']){
 const dir=root+'/before-'+round;fs.mkdirSync(dir)
 for(const name of ['config-write.ts','prepare-readers.ts','readers.mjs']){
  let code=fs.readFileSync(prior+'/before-'+round+'/'+name,'utf8').replaceAll('config-admitted-discovery-518',scope).replaceAll('18983','18993').replaceAll('qa-admitted518-','qa-current521-')
  fs.writeFileSync(dir+'/'+name,code,{flag:'wx'})
 }
}
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope,source:'Closed config-source-order-520-final-read,complete current90tables and all original directories',port:18993,scopeBudgets:{before:4},maximumBatchRequests:4,model:'gpt-6.1-sol',stream:true,thresholdsMs:{save:10000,restore:5000,read:20000},rounds:['cold','repeat'],directories:'All current registered directories plus genuine preflight addition;no sampling',transport:'Original production Overlay config service/browser HostTransport/real Source CLI public HTTP,plus manual IAB',ui:'Unchanged formal main-DhV28lza',authority:'Complete paired private/runtime auth/models;separate credential/catalog/actual-model checks;retire after original full chain',scopeLabel:'before is existing tool stage name for current baseline;no after allocation'},null,2)+'\n',{flag:'wx'})
console.log('Current full validation helpers prepared;single4-request scope;no process or authority staged')
