import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-task-source-epoch',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const groups=[
 {name:'task-source-epoch-536',target:out,stages:['before','after'],handles:[62728,60952],pages:[141],kind:'Initial observer;post-reconnect lifecycle qualification invalidated'},
 {name:'task-source-cleanup-536c',target:out+'/diagnosis',stages:['before'],handles:[44229],pages:[142],kind:'Actual private cleanup reentry diagnosis'},
 {name:'task-source-clean-536d',target:out+'/corrected',stages:['before','after'],handles:[74480,80218],pages:[143,144,145],kind:'Corrected passive observer and formal final UI'}
]
let compressed=0,shots=0
const pack=(bytes,file)=>{bytes=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);const z=gzipSync(bytes);assert(gunzipSync(z).equals(bytes));fs.writeFileSync(file+'.gz',z,{flag:'wx'});compressed++}
const scopes=[]
for(const g of groups){
 const folder=path.resolve(root,'../'+g.name),plan=read(folder+'/plan.json'),preservation=read(folder+'/data-preservation-observation.json')
 fs.mkdirSync(g.target,{recursive:true})
 const names=['plan.json','build-diagnostic.mjs','prepare-data.ts','read-task.ts']
 if(g.name.endsWith('536d'))names.push('build-formal.mjs','formal-browser-errors.json','recovery-browser-errors.json','before-browser-observation.json','after-natural-browser-observation.json','after-final-browser-observation.json')
 for(const stage of g.stages){
  for(const suffix of ['data-preparation.json','authority-preparation.json','authority-retirement.json'])names.push(stage+'-'+suffix)
  if(fs.existsSync(folder+'/'+stage+'-task-read.json'))names.push(stage+'-task-read.json')
  const run=base+g.name+'-'+stage,proof=read(run+'/evidence/physical-terminal-and-pair-cleanup.json'),retired=read(folder+'/'+stage+'-authority-retirement.json')
  assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.maximumRequests,plan.maximumRequestsPerStartedScope)
  for(const k of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[k],true)
  for(const c of proof.chain)assert.equal(c.state,'dead_or_reused')
  const provider=proof.provider.map(p=>{
   const r=p.sourceReader,c=r.requestContext.streamRequest
   assert.equal(p.model,'gpt-6.1-sol');assert.equal(c.apiModelID,'gpt-6.1-sol');assert.equal(p.streaming,true);assert.equal(p.status,200);assert.equal(r.state,'settled');assert.equal(r.terminal.kind,'eof')
   return{model:p.model,streaming:p.streaming,status:p.status,sourceReader:{state:r.state,terminal:r.terminal,requestContext:{streamRequest:{requestID:c.requestID,agentID:c.agentID,providerID:c.providerID,modelID:c.modelID,apiModelID:c.apiModelID}}}}
  })
  const shutdown=read(run+'/evidence/public-shutdown.json');assert.equal(shutdown.statusCode,200)
  const logs=fs.readFileSync(run+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(s=>JSON.parse(s))
  const data=preservation.scopes.find(p=>p.stage===stage)
  const scope={name:g.name,stage,kind:g.kind,originalHandle:g.handles[g.stages.indexOf(stage)],exit:proof.launcher.originalChildExit,pages:g.pages,pageState:'Closed',shutdown:shutdown.statusCode,native:proof.native,chain:proof.chain,requests:proof.requests,maximum:proof.maximumRequests,provider,authorityRetired:proof.copiedPair.length+retired.retired.length,runtimeErrors:logs.filter(l=>l.level==='error').map(l=>({at:l.time,service:l.service,message:l.message})),taskHttp:logs.filter(l=>l.service==='server'&&l.data?.status==='completed'&&(l.data.path?.includes('tsk_g00VYhrJxy00qIC54qvM')||l.data.path?.startsWith('/ui/'))).map(l=>({at:l.time,path:l.data.path,method:l.data.method,status:l.data.statusCode})),data:{tables:Object.keys(data.counts).length,originalRows:Object.values(data.counts).reduce((n,v)=>n+v.original,0),source:data.source,schema:data.schema,canonical:data.canonical,originalRowDifferences:data.originalRowDifferences,providerActivities:data.counts.provider_activity_request}}
  scopes.push(scope)
  pack(JSON.stringify({...proof,provider,archiveProjection:'Only actual identity/model/stream/status/source EOF;payload and headers omitted'},null,2)+'\n',g.target+'/'+stage+'-physical-terminal-and-pair-cleanup.json')
  pack(JSON.stringify(shutdown,null,2)+'\n',g.target+'/'+stage+'-public-shutdown.json')
 }
 for(const name of fs.readdirSync(folder)){
  if(/^\d\d-.*\.png$/.test(name)&&name!=='02-corrected-new-chat.png'){names.push(name);shots++}
  if(name.endsWith('-console.json')||name.startsWith('build-')&&name.endsWith('.log')||name==='data-preservation-observation.json')pack(fs.readFileSync(folder+'/'+name),g.target+'/'+name)
 }
 for(const name of names)fs.copyFileSync(folder+'/'+name,g.target+'/'+name,fs.constants.COPYFILE_EXCL)
}
const corrected=path.resolve(root,'../task-source-clean-536d'),phaseNames=['before-baseline','offline','after-natural-recovery','after-final']
const phases=phaseNames.map(n=>({name:n,rows:read(corrected+'/'+n+'-console.json')}))
const prefixChecks=phases.slice(1).map((p,i)=>({from:phases[i].name,to:p.name,originalEvents:phases[i].rows.length,events:p.rows.length,exactPriorPrefix:JSON.stringify(p.rows.slice(0,phases[i].rows.length))===JSON.stringify(phases[i].rows)}))
const observed=phases.at(-1).rows.filter(r=>r.message.startsWith('MT536 ')).map(r=>({timestamp:r.timestamp,...JSON.parse(r.message.slice(6))}))
const initialError=read(path.resolve(root,'../task-source-cleanup-536c/retirement-console.json')).find(r=>r.message.startsWith('MT536C '))
const summary={at:new Date().toISOString(),production:'d6ea978fe83d1a564e09112538b426c3a019b2b6 unchanged;no product render/schema/API/Goal execution change',taskID:read(root+'/plan.json').taskID,screenshots:shots,scopes,requests:scopes.reduce((n,s)=>n+s.requests,0),startedMaximum:scopes.reduce((n,s)=>n+s.maximum,0),declaredConditionalMaximum:24,unstartedScope:'536c-after;4 request allowance retired',retiredAuthorityMembers:scopes.reduce((n,s)=>n+s.authorityRetired,0),diagnosticRoot:{firstReentry:initialError?JSON.parse(initialError.message.slice(7)):null,root:'Private body-dispose read props.streaming while its enclosing Show/Index owners were retiring;untrack still recomputed invalid memo and synchronously reentered disposal',repair:'Cleanup emits only ordinary snapshots/target flags captured during normal observations;Part/Source group/Source cleanup handled together',initialRecoveryQualification:'Invalidated;actual backend HTTP/parser/merge facts retained independently'},corrected:{phases:phases.map(p=>({name:p.name,events:p.rows.length,first:p.rows[0]?.timestamp,last:p.rows.at(-1)?.timestamp})),prefixChecks,eventsByKind:observed.reduce((a,r)=>(a[r.kind]=(a[r.kind]||0)+1,a),{}),reads:observed.filter(r=>r.kind.startsWith('transcript-read')),before:read(corrected+'/before-browser-observation.json'),after:read(corrected+'/after-final-browser-observation.json')},limits:['Quiet completed Task historical member;natural delta is empty,not live nonempty insertion','Natural reconnect kept selected member;actual old-epoch member read occurred on explicit list/detail return,not automatically on the Online badge','Final page144 was created from Home URL but startup restored the saved Task while search was opening;this is not the exact no-saved-preference startup branch of141','Private observers are not production UI;final independent page145 uses uninstrumented formal build and was manually reviewed','No business input,new Tasks,delegation or new Goal;real Sol requests only preflight/memory;Goal creation/help inspected without submitting','Discrete screenshots and manual review;no UI automated tests;no claim every live Rendering combination is resolved']}
fs.writeFileSync(root+'/result-observation.json',JSON.stringify(summary,null,2)+'\n')
pack(JSON.stringify(summary,null,2)+'\n',out+'/result-observation.json')
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:summary.at,screenshots:shots,requests:summary.requests,startedMaximum:summary.startedMaximum,declaredConditionalMaximum:24,unstartedScope:summary.unstartedScope,retiredAuthorityMembers:summary.retiredAuthorityMembers,scopes:scopes.map(({taskHttp,provider,...s})=>({...s,provider,taskHttpRequests:taskHttp.length})),limits:summary.limits},null,2)+'\n',{flag:'wx'})
for(const name of ['archive.mjs','prepare-clean.mjs','prepare-cleanup.mjs'])fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({screenshots:shots,requests:summary.requests,maximum:summary.startedMaximum,retired:summary.retiredAuthorityMembers,compressed,prefixChecks,scopes:scopes.map(s=>({name:s.name,stage:s.stage,exit:s.exit,requests:s.requests,errors:s.runtimeErrors.length,originalRows:s.data.originalRows}))}))
