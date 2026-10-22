import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../source-reconnect-history-535')
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope:'source-reconnect-observation-535',phase:'535b diagnostic requalification',ports:{before:19051,after:19051},maximumRequestsPerStartedScope:4,model:'gpt-6.1-sol',source:'Closed535-after;after copies fully closed535b-before',targetParent:'ses_-zUS0X33CzzWEKMgCk98',targetMember:'ses_-zUS0WzzQzzDOGrIbYwN',flow:'One original page;quiet same-URL disconnect/recovery;no repeated business input',diagnostics:'Lifecycle,zero/decrease/streaming and panel state only;collect immediately at each connection boundary',ui:'Real manual screenshots;no UI automated tests'},null,2)+'\n',{flag:'wx'})
for(const name of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','qualify-provider.ps1']){
 const code=fs.readFileSync(prior+'/'+name,'utf8').replaceAll('source-reconnect-history-535','source-reconnect-observation-535').replaceAll('19049','19051')
 fs.writeFileSync(root+'/'+name,code,{flag:'wx'})
}
let data=fs.readFileSync(prior+'/prepare-data.ts','utf8').replaceAll('source-reconnect-history-535','source-reconnect-observation-535').replace("base+'/source-cold-history-534-after'","base+'/source-reconnect-history-535-after'")
const start=data.indexOf("if(stage==='before'){"),end=data.indexOf("const plan=JSON.parse(fs.readFileSync(root+'/plan.json','utf8'))\nconst target=")
assert(start>0&&end>start)
data=data.slice(0,start)+`const priorRoot=stage==='before'?repo+'/.tmp-product-iteration/source-reconnect-history-535':root
const priorStage=stage==='before'?'after':'before',priorPlan=JSON.parse(fs.readFileSync(priorRoot+'/plan.json','utf8')),proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8')),retired=JSON.parse(fs.readFileSync(priorRoot+'/'+priorStage+'-authority-retirement.json','utf8'))
for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.copiedPair.length,2);assert.equal(retired.retired.length,2);assert.equal(proof.maximumRequests,priorPlan.maximumRequestsPerStartedScope)
for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
for(const request of proof.provider){assert.equal(request.model,priorPlan.model);assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.sourceReader.state,'settled');assert.equal(request.sourceReader.terminal.kind,'eof')}
`+data.slice(end)
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
let diagnostic=fs.readFileSync(prior+'/build-diagnostic.mjs','utf8').replaceAll('535','535b').replaceAll('source-reconnect-history-535b','source-reconnect-observation-535')
const noiseStart=diagnostic.indexOf("  if(file.endsWith('/services/markdown-render.ts')){"),noiseEnd=diagnostic.indexOf("  if(file.endsWith('/components/text-part-model.ts')){",noiseStart)
assert(noiseStart>0&&noiseEnd>noiseStart)
diagnostic=diagnostic.slice(0,noiseStart)+diagnostic.slice(noiseEnd)
diagnostic=diagnostic.replace('{blocks:number,streaming:boolean,pending:boolean}','{blocks:number,streaming:boolean}').replace(',waiting=pending()','').replace('||waiting!==tracePrevious535b.pending','').replace('tracePrevious535b={blocks,streaming,pending:waiting}','tracePrevious535b={blocks,streaming}')
fs.writeFileSync(root+'/build-diagnostic.mjs',diagnostic,{flag:'wx'})
console.log('535b narrow diagnostic helpers ready;no model input sender or credentials staged;new scopes each4')
