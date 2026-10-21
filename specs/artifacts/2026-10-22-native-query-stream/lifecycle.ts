import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
const {installProcessShims}=await import('../../packages/opencorvus/src/runtime/shims');installProcessShims()
const {observedProcessOccurrence,observeRuntimeProcessOccurrence,currentRuntimeProcessOccurrence}=await import('../../packages/opencorvus/src/runtime/process-occurrence')
const root=import.meta.dir,runtime=process.env.OPENCORVUS_HOME!,output=path.join(runtime,'owner-ready.json')
const child=spawn(process.execPath,[root+'/owner-fixture.ts',output],{stdio:['ignore','pipe','pipe'],windowsHide:true,env:process.env})
const closeFact=new Promise<{code:number|null,signal:string|null}>((resolve,reject)=>{child.once('close',(code,signal)=>resolve({code,signal}));child.once('error',reject)})
void closeFact.catch(()=>{})
const drain=async(stream:NodeJS.ReadableStream)=>{const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks)}
const stdout=drain(child.stdout!),stderr=drain(child.stderr!)
const deadline=Date.now()+30000
let admission:any
for(;;){
 admission=await fs.readFile(output,'utf8').then(text=>JSON.parse(text)).catch(error=>{if(error.code==='ENOENT')return undefined;throw error})
 if(admission)break
 if(Date.now()>deadline)throw Error('Owned lifecycle admission did not arrive')
 await Bun.sleep(25)
}
const original=observedProcessOccurrence(child.pid!);assert(original)
assert.equal(admission.owner.pid,original.pid);assert.equal(admission.owner.processInstanceID,original.processInstanceID)
assert.equal(observeRuntimeProcessOccurrence(admission.owner),'exact_live');assert.equal(admission.actualStreams.length,2)
// Intentional root-only fault of this exact test child; the outer owned Job stays live.
assert.equal(child.kill('SIGTERM'),true)
const ownerTerminal=await closeFact,ownerOutput=await Promise.all([stdout,stderr])
const identities=[admission.owner,admission.helper,...admission.targets.map((ready:any)=>({pid:ready.target_pid,processInstanceID:ready.target_process_instance_id,occurrenceID:ready.request_id})),admission.grandchild]
let states:any[],physical:any[]
const settledDeadline=Date.now()+30000
for(;;){
 states=identities.map(identity=>({identity,state:observeRuntimeProcessOccurrence(identity)}))
 physical=await Promise.all(admission.requests.map(async(request:any)=>fs.readFile(request.settled_file,'utf8').then(text=>JSON.parse(text)).catch(error=>{if(error.code==='ENOENT')return undefined;throw error})))
 if(states.every(item=>item.state==='dead_or_reused')&&physical.every(Boolean))break
 if(Date.now()>settledDeadline)throw Error('Original owned lifecycle has not physically settled')
 await Bun.sleep(25)
}
const retired=[]
for(let index=0;index<admission.requests.length;index++){
 const request=admission.requests[index],marker=physical[index],ready=admission.targets[index]
 const helper=JSON.parse(await fs.readFile(path.join(path.dirname(request.ready_file),'helper.json'),'utf8'))
 assert.equal(marker.request_id,request.request_id);assert.equal(marker.helper_pid,admission.helper.pid);assert.equal(marker.target_pid,ready.target_pid);assert.equal(marker.runtime_occurrence_id,admission.owner.occurrenceID);assert.equal(marker.active_processes,0)
 assert.equal(helper.helper_process_instance_id,admission.helper.processInstanceID)
 const queryRoot=path.resolve(path.dirname(request.ready_file));assert.equal(path.dirname(queryRoot),path.resolve(runtime,'owner-queries'));assert.equal(path.basename(queryRoot),request.request_id)
 const info=await fs.lstat(queryRoot);assert(info.isDirectory());assert.equal(info.isSymbolicLink(),false)
 await fs.rm(queryRoot,{recursive:true});retired.push({requestID:request.request_id,outcome:'Fixture query directory retired after actual Job-zero,dead helper/target/grandchild and copied marker evidence',helper,ready,physical:marker})
}
const result={at:new Date().toISOString(),controller:currentRuntimeProcessOccurrence(),admission,ownerTerminal,ownerOutput:{stdout:ownerOutput[0].toString(),stderr:ownerOutput[1].toString()},states,retired,scopeQueries:2,modelRequests:0,positiveContracts:1,outputRecipient:'Original owner died;normal per-query JavaScript response delivery unavailable,not claimed complete',boundary:'Exact owned root-only owner fault;original jobs and descendant physical state observed;fixture cleanup only,not general public orphan recovery or isolated attribution to one watcher'}
await fs.writeFile(root+'/lifecycle-a-result.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({positiveContracts:1,scopeQueries:2,modelRequests:0,physicalStates:states.map(item=>item.state),ownerTerminal,fixtureRequestsRetired:retired.length,outputRecipient:result.outputRecipient}))
