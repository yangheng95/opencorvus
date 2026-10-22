import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../goal-home-run-533')
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope:'source-reconnect-history-535',ports:{before:19049,after:19049},maximumRequestsPerStartedScope:8,model:'gpt-6.1-sol',source:'Closed534-after;after copies fully settled535-before',targetParent:'ses_-zUS0X33CzzWEKMgCk98',targetMember:'ses_-zUS0WzzQzzDOGrIbYwN',flow:'Same original page;owned before shutdown then fresh after same URL;one bounded after input to existing member;no new delegation',ui:'Real manual page/screenshot review;passive warning diagnostics;no UI tests'},null,2)+'\n',{flag:'wx'})
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','http-json.ts','qualify-provider.ps1']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('goal-home-run-533','source-reconnect-history-535').replaceAll('19041','19049').replaceAll('19043','19049').replaceAll('2026-10-22-goal-home-run.md','2026-10-22-source-reconnect-history.md')
 if(file==='launch.ps1')code=code.replace('$taskBudget=16','$taskBudget=[int](Get-Content -Raw -LiteralPath "$PSScriptRoot/plan.json"|ConvertFrom-Json).maximumRequestsPerStartedScope')
 if(file==='prepare-authority.mjs'){
  code=code.replace("const source='C:/Users/hengu/.codex/auth.json'","const plan=JSON.parse(fs.readFileSync(root+'/plan.json','utf8'))\nconst source='C:/Users/hengu/.codex/auth.json'")
  code=code.replaceAll('maximumBatchRequests:32','maximumBatchRequests:plan.maximumRequestsPerStartedScope*2').replace('scopeBudgets:{before:16,after:16}','scopeBudgets:{before:plan.maximumRequestsPerStartedScope,after:plan.maximumRequestsPerStartedScope}')
 }
 if(file==='preserve.ts')code=code.replace("const root=import.meta.dir,result:any={at:new Date().toISOString(),schema:3,scopes:[],modelInputBudget:16}","const root=import.meta.dir,plan=JSON.parse(fs.readFileSync(root+'/plan.json','utf8')),result:any={at:new Date().toISOString(),schema:3,scopes:[],maximumRequestsPerStartedScope:plan.maximumRequestsPerStartedScope,maximumBatchRequests:plan.maximumRequestsPerStartedScope*2}")
 if(file==='qualify-provider.ps1')code=code.replace('$taskRequest.model -cne $Plan.model -or','$taskRequest.model -cne $Plan.model -or $taskRequest.response_reader.requestContext.streamRequest.apiModelID -cne $Plan.model -or')
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
let data=fs.readFileSync(path.resolve(root,'../source-cold-history-534/prepare-data.ts'),'utf8').replaceAll('source-cold-history-534','source-reconnect-history-535').replace("base+'/goal-home-run-533-after'","base+'/source-cold-history-534-after'")
const start=data.indexOf("if(stage==='before'){"),end=data.indexOf('const target=')
assert(start>0&&end>start)
data=data.slice(0,start)+`if(stage==='before'){
 const proof=JSON.parse(fs.readFileSync(source+'-service/evidence/physical-terminal.json','utf8'))
 for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
 assert.equal(proof.launcher.childExitCode,0);assert.equal(proof.originalExit,0);assert.equal(proof.shutdown.statusCode,200);assert.equal(proof.provider.maximum,0);assert.equal(proof.provider.actual,0);assert.equal(proof.provider.exhausted,false)
 for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
}else{
 const plan=JSON.parse(fs.readFileSync(root+'/plan.json','utf8')),proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8')),retired=JSON.parse(fs.readFileSync(root+'/before-authority-retirement.json','utf8'))
 for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
 assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.copiedPair.length,2);assert.equal(retired.retired.length,2);assert.equal(proof.maximumRequests,plan.maximumRequestsPerStartedScope)
 for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
 for(const request of proof.provider){assert.equal(request.model,plan.model);assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.sourceReader.state,'settled');assert.equal(request.sourceReader.terminal.kind,'eof')}
}
`+data.slice(end)
data=data.replace("const target=base", "const plan=JSON.parse(fs.readFileSync(root+'/plan.json','utf8'))\nconst target=base").replaceAll('modelInputBudget:0','modelInputBudget:plan.maximumRequestsPerStartedScope').replace('Target zero model requests;no credentials/catalog staged;source physical and authority settlement verified','Authorized complete paired Sol scope;original source physical/EOF/authority settlement verified')
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
let diagnostic=fs.readFileSync(path.resolve(root,'../source-cold-history-534/build-diagnostic.mjs'),'utf8').replaceAll('534','535').replaceAll('source-cold-history','source-reconnect-history')
const anchor="  if(file.endsWith('/services/markdown-render.ts')){"
assert.equal(diagnostic.split(anchor).length,2)
diagnostic=diagnostic.replace(anchor,`  if(file.endsWith('/components/SubagentConversationPanel.tsx')){
   source='import { appStore as traceApp535 } from "../store/app"\\n'+source
   return replace(source,'  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())',\
\`  let tracePanel535=""
  createEffect(() => {
    const current=displayedConversation(),signature=JSON.stringify([traceApp535.connectionStatus,targetKey(),requestKey(),conversation.state,conversation.loading,current?.messages.length??0,props.active()])
    if(signature!==tracePanel535){
      if(props.sessionID()==="ses_-zUS0WzzQzzDOGrIbYwN") untrack(() => console.warn("MT535",JSON.stringify({kind:"panel-state",previous:tracePanel535,current:signature,at:performance.now()})))
      tracePanel535=signature
    }
  })
  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())\`)
  }

`+anchor)
fs.writeFileSync(root+'/build-diagnostic.mjs',diagnostic,{flag:'wx'})
let send=fs.readFileSync(path.resolve(root,'../source-parallel-owner-532/send.ts'),'utf8').replaceAll('source-parallel-owner-532','source-reconnect-history-535').replaceAll('19037','19049').replaceAll('19039','19049')
send=send.replace("const preflight=JSON.parse", "assert.equal(stage,'after','One explicit after input only')\nconst plan=JSON.parse(fs.readFileSync(root+'/plan.json','utf8'))\nconst preflight=JSON.parse").replace('assert.equal(preflight.maxRequests,8)','assert.equal(preflight.maxRequests,plan.maximumRequestsPerStartedScope)')
const textStart=send.indexOf("const text='"),textEnd=send.indexOf('\nconst sessionID=',textStart);assert(textStart>0&&textEnd>textStart)
send=send.slice(0,textStart)+"const text=fs.readFileSync(root+'/objective.txt','utf8').trim()"+send.slice(textEnd)
send=send.replace('maximumScopeRequests:8','maximumScopeRequests:plan.maximumRequestsPerStartedScope')
fs.writeFileSync(root+'/send.ts',send,{flag:'wx'})
console.log('535 fresh helpers prepared;all live budgets read the declared plan;no service or credentials staged')
