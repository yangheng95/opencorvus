import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createOpenCorvusClient } from '../../packages/sdk/js/dist/client.js'
const root=import.meta.dir,tag='goal-error-contract-458-final'
const scope='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-20/'+tag
const directory='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project'
const base='http://127.0.0.1:18731'
const ready=JSON.parse(await fs.readFile(scope+'/evidence/preflight-ready.json','utf8'))
assert(ready.occurrence.startsWith(tag+'-'))
assert.deepEqual({credential:ready.preflight.credential,catalog:ready.preflight.catalog,model:ready.preflight.actualModel,streaming:ready.preflight.streaming},{credential:'usable',catalog:'projected',model:'gpt-6.1-sol',streaming:true})
const client=createOpenCorvusClient({baseUrl:base,directory})
const rows:Array<{stage:string;status:number;ms:number}>=[]
const documents:Array<{stage:string;operations:number;schemas:number}>=[]
const options=()=>({signal:AbortSignal.timeout(90000)})
async function checked(stage:string,status:number,run:()=>Promise<any>){
 const started=performance.now(),result=await run()
 rows.push({stage,status:result.response.status,ms:performance.now()-started})
 assert.equal(result.response.status,status)
 return status===409?result.error:result.data
}
let goal:any,ownerID:string|undefined,failure:unknown,terminal:any
const states:Array<{stage:string;status:string;revision:string;turnsAccepted:number}>=[]
const record=(stage:string,value:any)=>{states.push({stage,status:value.status,revision:value.revision,turnsAccepted:value.turnsAccepted});goal=value;return value}
const requestID=(stage:string)=>ready.occurrence+':'+stage
try{
 const unavailable=await checked('SDK get unavailable owner',409,()=>client.continuousGoal.get({kind:'chat',ownerID:'missing-owner'},options()))
 assert.equal(unavailable.name,'ContinuousGoalError');assert.equal(unavailable.data.code,'owner_unavailable')
 const createStart=performance.now(),response=await fetch(base+'/coding/work/session?directory='+encodeURIComponent(directory),{...options(),method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
 rows.push({stage:'Canonical home Work Chat creation',status:response.status,ms:performance.now()-createStart});assert.equal(response.status,201)
 const created=await response.json();ownerID=created.session.id;assert.equal(path.resolve(created.session.directory),path.resolve(directory))
 const target={kind:'chat' as const,ownerID:ownerID!}
 const objective='Verify Goal API state and revision handling. Await operator completion of this isolated contract check.'
 const initial=await checked('SDK create',200,()=>client.continuousGoal.create({...target,requestID:requestID('create'),objective,turnBudget:2},options()))
 record('created',initial);assert.equal(initial.status,'active')
 const paused=await checked('SDK pause',200,()=>client.continuousGoal.update({...target,goalID:goal.id,expectedRevision:goal.revision,requestID:requestID('pause'),status:'paused',reason:'Operator verifying the paused Goal contract'},options()))
 record('paused',paused);assert.equal(paused.status,'paused')
 const duplicate=await checked('SDK create unresolved conflict',409,()=>client.continuousGoal.create({...target,requestID:requestID('duplicate'),objective:'Another unresolved goal'},options()))
 assert.equal(duplicate.name,'ContinuousGoalError');assert.equal(duplicate.data.code,'conflict')
 const stale=await checked('SDK stale revision',409,()=>client.continuousGoal.update({...target,goalID:goal.id,expectedRevision:initial.revision,requestID:requestID('stale'),status:'paused',reason:'Stale revision diagnostic'},options()))
 assert.equal(stale.name,'ContinuousGoalError');assert.equal(stale.data.code,'revision_conflict')
 const read=await checked('SDK read paused',200,()=>client.continuousGoal.get(target,options()))
 assert.equal(read.id,initial.id);assert.equal(read.revision,paused.revision);assert.equal(read.status,'paused')
 const resumed=await checked('SDK explicit resume',200,()=>client.continuousGoal.update({...target,goalID:goal.id,expectedRevision:goal.revision,requestID:requestID('resume'),status:'active',reason:'Operator resumed the isolated contract check',turnBudget:3},options()))
 record('resumed',resumed);assert.equal(resumed.status,'active')
 const completed=await checked('SDK explicit complete',200,()=>client.continuousGoal.update({...target,goalID:goal.id,expectedRevision:goal.revision,requestID:requestID('complete'),status:'complete',reason:'Create, read, pause, exact conflict and resume contracts verified by actual public requests'},options()))
 record('complete',completed);assert.equal(completed.status,'complete')
 terminal=await checked('SDK retained completed read',200,()=>client.continuousGoal.get(target,options()))
 assert.equal(terminal.id,initial.id);assert.equal(terminal.objective,objective);assert.equal(terminal.revision,completed.revision);assert.equal(terminal.status,'complete')
 const started=performance.now(),document=await fetch(base+'/doc',options());assert.equal(document.status,200)
 const spec=await document.json();rows.push({stage:'Public OpenAPI',status:document.status,ms:performance.now()-started})
 const canonical=JSON.parse(await fs.readFile(path.resolve(root,'../../packages/sdk/openapi.json'),'utf8'))
 // The existing CLI adds SDK usage samples after Server.openapi(). Those
 // examples are presentation enrichment; compare every wire/schema field.
 const canonicalPaths=Object.fromEntries(Object.entries(canonical.paths).map(([route,item]:[string,any])=>[
  route,Object.fromEntries(Object.entries(item).map(([method,operation]:[string,any])=>{
   if(!operation?.operationId)return[method,operation]
   const {'x-codeSamples':cliExamples,...wire}=operation
   return[method,wire]
  })),
 ]))
 const verifyDocument=(stage:string,value:any)=>{
  assert.deepEqual(value.paths,canonicalPaths);assert.deepEqual(value.components,canonical.components)
  const operations=Object.values(value.paths).flatMap((item:any)=>Object.values(item).filter((entry:any)=>typeof entry?.operationId==='string')).length
  documents.push({stage,operations,schemas:Object.keys(value.components.schemas).length})
 }
 verifyDocument('first runtime document',spec)
 for(const method of ['get','post','patch']){
  const operation=spec.paths['/continuous-goal/{kind}/{ownerID}'][method]
  assert.equal(operation.responses['409'].content['application/json'].schema.properties.name.const,'ContinuousGoalError')
 }
 const parallel=await Promise.allSettled([
  ...['parallel document A','parallel document B'].map(async stage=>{
   const at=performance.now(),response=await fetch(base+'/doc',options());assert.equal(response.status,200)
   const body=await response.json();rows.push({stage,status:response.status,ms:performance.now()-at});verifyDocument(stage,body)
  }),
  (async()=>{const value=await checked('SDK Goal read during document generation',200,()=>client.continuousGoal.get(target,options()));assert.equal(value.id,initial.id);assert.equal(value.status,'complete')})(),
 ])
 for(const outcome of parallel)if(outcome.status==='rejected')throw outcome.reason
}catch(error){failure=error}finally{
 if(ownerID&&goal&&terminal?.status!=='complete'){
  const target={kind:'chat' as const,ownerID}
  const current=await checked('Failure current read',200,()=>client.continuousGoal.get(target,options()))
  if(current?.status==='complete')terminal=current
  else if(current){terminal=await checked('Failure explicit pause',200,()=>client.continuousGoal.update({...target,goalID:current.id,expectedRevision:current.revision,requestID:requestID('safe-pause'),status:'paused',reason:'Isolated checker stopped before qualification; retain evidence and await operator'},options()))}
 }
 const result={scope:tag,occurrence:ready.occurrence,requests:rows,states,documents,terminal:terminal?{goalID:terminal.id,sessionID:terminal.sessionID,status:terminal.status,turnsAccepted:terminal.turnsAccepted,tokensUsed:terminal.tokensUsed}:undefined,qualification:'Actual newly built SDK -> public development HTTP -> original Goal store and retained revisions; all runtime paths/components match canonical wire metadata through repeated/concurrent requests, excluding only existing CLI-owned x-codeSamples enrichment; native preflight proves exact streaming model, not full new Goal execution; no UI automation',outcome:failure?'failed':'passed'}
 await fs.writeFile(root+'/http-contract-final-verified.json',JSON.stringify(result,null,2),{flag:'wx'})
 console.log(JSON.stringify({scope:tag,requests:rows.length,states:states.map(item=>item.status),terminal:terminal?.status,outcome:result.outcome}))
}
if(failure)throw failure
