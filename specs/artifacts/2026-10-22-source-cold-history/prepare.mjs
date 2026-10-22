import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../dialog-opener-focus-531')
for(const file of ['prepare-data.ts','serve.ts','launch.ps1','shutdown.ps1','settle.ps1','preserve.ts','build.mjs']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('dialog-opener-focus-531','source-cold-history-534').replaceAll('19033','19045').replaceAll('19035','19047').replaceAll('Dialog opener focus','Source cold history')
 if(file==='prepare-data.ts'){
  code=code.replace("base+'/permission-focus-dismissal-530-after'","base+'/goal-home-run-533-after'")
  const start=code.indexOf("if(stage==='before'){"),end=code.indexOf('}else{',start)
  assert(start>=0&&end>start)
  code=code.slice(0,start)+`if(stage==='before'){
 const proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
 for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
 assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.copiedPair.length,2)
 assert.equal(proof.maximumRequests,16);assert.equal(proof.requests,5)
 for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
 for(const request of proof.provider){assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.sourceReader.state,'settled');assert.equal(request.sourceReader.terminal.kind,'eof')}
 const retired=JSON.parse(fs.readFileSync(repo+'/.tmp-product-iteration/goal-home-run-533/after-authority-retirement.json','utf8'));assert.equal(retired.retired.length,2)
 const recheck=JSON.parse(fs.readFileSync(repo+'/.tmp-product-iteration/goal-home-run-533/after-recheck.json','utf8'));assert.equal(recheck.passed,true)
`+code.slice(end)
 }
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
let diagnostic=fs.readFileSync(path.resolve(root,'../source-parallel-owner-532/build-diagnostic.mjs'),'utf8').replaceAll('532','534').replaceAll('source-parallel-owner','source-cold-history')
diagnostic=diagnostic.replace('let tracePrevious534: {blocks:number,streaming:boolean} | undefined','let tracePrevious534: {blocks:number,streaming:boolean,pending:boolean} | undefined').replace('const blocks=frozenHtml().length,streaming=props.streaming===true','const blocks=frozenHtml().length,streaming=props.streaming===true,waiting=pending()').replace('streaming!==tracePrevious534.streaming)traceBinding534','streaming!==tracePrevious534.streaming||waiting!==tracePrevious534.pending)traceBinding534').replace('tracePrevious534={blocks,streaming}','tracePrevious534={blocks,streaming,pending:waiting}')
const anchor="  if(file.endsWith('/components/text-part-model.ts')){"
assert.equal(diagnostic.split(anchor).length,2)
diagnostic=diagnostic.replace(anchor,`  if(file.endsWith('/services/markdown-render.ts')){
   source=replace(source,'    resultHtml = []','    console.debug("MT534",JSON.stringify({kind:"renderer-send",owner,revision:request.revision,textLength:request.text.length,streaming:request.streaming,at:performance.now()}))\\n    resultHtml = []')
   source=replace(source,'    receive(reply, inFlight)','    console.debug("MT534",JSON.stringify({kind:"renderer-reply",owner,revision:reply.revision,start:reply.start,blocks:reply.html.length,done:reply.done,error:reply.error,at:performance.now()}))\\n    receive(reply, inFlight)')
   source=replace(source,'        if (result) {','        if (result) {\\n          console.debug("MT534",JSON.stringify({kind:"renderer-cache-hit",owner,revision,textLength:text.length,blocks:result.artifact.html.length,at:performance.now()}))')
   return source
  }

`+anchor)
fs.writeFileSync(root+'/build-diagnostic.mjs',diagnostic.replaceAll('console.debug','console.warn'),{flag:'wx'})
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope:'source-cold-history-534',ports:{before:19045,after:19047},maximumRequests:0,authority:'No auth/catalog copies or Provider preflight',source:'Closed533-after complete90 tables/schema3/canonical;after uses closed534-before',targetMember:'ses_-zUS0WzzQzzDOGrIbYwN',targetParent:'ses_-zUS0X33CzzWEKMgCk98',qualification:'Early passive owner/renderer chronology;real manual cold-history/Sources/navigation review;no UI tests or new business messages'},null,2)+'\n',{flag:'wx'})
console.log('534 zero-model helpers prepared;no service or authority staged')
