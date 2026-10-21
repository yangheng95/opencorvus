import fs from 'node:fs'
import assert from 'node:assert/strict'
const root=import.meta.dirname,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21'
const terminal=JSON.parse(fs.readFileSync(base+'/real-deliverable-review-501-before/evidence/physical-terminal-and-pair-cleanup.json'))
assert.equal(terminal.pairedCleanupComplete,true)
assert.equal(terminal.native.physicalCompletion,true);assert.equal(terminal.launcher.originalChildExit,0)
let data=fs.readFileSync(root+'/prepare-data.ts','utf8')
data=data.replace("source=base+'/goal-deliverable-interface-500-after-data'","source=base+'/real-deliverable-review-501-before'")
const start=data.indexOf('const proof='),end=data.indexOf('const target=',start)
assert(start>0&&end>start);data=data.slice(0,start)+data.slice(end)
data=data.replace("base+'/'+name+'-'+stage,bundle=base+'/'+name+'-'+stage+'-bundle',diag=base+'/'+name+'-'+stage", "base+'/'+name+'-recovery-data',bundle=base+'/'+name+'-recovery-bundle',diag=base+'/'+name+'-recovery'")
data=data.replaceAll("root+'/'+stage+'-original-private.json'","root+'/recovery-original-private.json'")
 .replaceAll("root+'/'+stage+'-data-preparation.json'","root+'/recovery-data-preparation.json'")
 .replace('modelInputBudget:12','modelInputBudget:0').replace('source500 native/reader/launcher settled','source501 native/reader/launcher settled')
fs.writeFileSync(root+'/prepare-recovery-data.ts',data,{flag:'wx'})
for(const kind of ['launch','serve','shutdown','settle']){
 let body=fs.readFileSync(root+'/../goal-deliverable-interface-500/'+kind+'-after.'+(kind==='serve'?'ts':'ps1'),'utf8')
 body=body.replaceAll('goal-deliverable-interface-500-after','real-deliverable-review-501-recovery').replaceAll('18887','18893')
 body=body.replaceAll('goal-deliverable-interface-500/serve-after.ts','real-deliverable-review-501/serve-recovery.ts')
 fs.writeFileSync(root+'/'+kind+'-recovery.'+(kind==='serve'?'ts':'ps1'),body,{flag:'wx'})
}
console.log('Prepared independent recovery clone and native zero-credential UI scope18893;not launched')
