import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {randomUUID} from 'node:crypto'
import {Filesystem} from '../../packages/opencorvus/src/util/filesystem'
import {whichAsync} from '../../packages/opencorvus/src/util/which'
import {currentRuntimeProcessOccurrence,observedProcessOccurrence,observeRuntimeProcessOccurrence} from '../../packages/opencorvus/src/runtime/process-occurrence'
export class QueryScope {
 readonly owner=currentRuntimeProcessOccurrence()
 readonly child=spawn(path.resolve(import.meta.dir,'../native-query-scope-490/native-target/release/opencorvus-process-supervisor.exe'),['--query-scope'],{stdio:['pipe','pipe','pipe'],windowsHide:true,detached:true,env:process.env})
 readonly pending=new Map<string,{resolve:(value:any)=>void,reject:(error:unknown)=>void,request:any,root:string}>()
 readonly records:any[]=[]
 readonly helper=observedProcessOccurrence(this.child.pid!)!
 readonly closeFact:Promise<{code:number|null,signal:string|null}>
 readonly lines:Promise<void>
 readonly errors:string[]=[]
 readonly stderr:Promise<Buffer>
 constructor(readonly root:string){
  assert(this.helper,'Exact new helper identity')
  this.closeFact=new Promise((resolve,reject)=>{this.child.once('close',(code,signal)=>resolve({code,signal}));this.child.once('error',reject)})
  this.stderr=(async()=>{const chunks:Buffer[]=[];for await(const chunk of this.child.stderr!)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks)})()
  this.lines=(async()=>{try{
   for await(const line of createInterface({input:this.child.stdout!})){
    const value=JSON.parse(line),item=this.pending.get(value.request_id);assert(item,'Response belongs to exact outstanding query')
    try{
     const request=item.request,marker=JSON.parse(await fs.readFile(path.join(item.root,'helper.json'),'utf8'))
     assert.deepEqual({id:marker.request_id,helper:marker.helper_pid,birth:marker.helper_process_instance_id,owner:marker.runtime_occurrence_id},{id:request.request_id,helper:this.helper.pid,birth:this.helper.processInstanceID,owner:this.owner.occurrenceID})
     const physicalFile=value.code===null?'launch-failed.json':'settled.json'
     const physical=JSON.parse(await fs.readFile(path.join(item.root,physicalFile),'utf8'))
     assert.equal(physical.request_id,request.request_id);assert.equal(physical.helper_pid,this.helper.pid);assert.equal(physical.runtime_occurrence_id,this.owner.occurrenceID);assert.equal(physical.active_processes,0)
     let ready
     if(value.code===null)assert.equal(physical.stage,'target_not_created')
     else{ready=JSON.parse(await fs.readFile(request.ready_file,'utf8'));assert.equal(ready.protocol,3);assert.equal(ready.request_id,request.request_id);assert.equal(ready.helper_pid,this.helper.pid);assert.equal(ready.target_pid,physical.target_pid);assert.equal(ready.runtime_occurrence_id,this.owner.occurrenceID);assert.equal(value.physical_joined,true);assert.equal(value.output_joined,true);assert.equal(observeRuntimeProcessOccurrence({pid:ready.target_pid,processInstanceID:ready.target_process_instance_id,occurrenceID:request.request_id}),'dead_or_reused')}
     const receivedAt=performance.now()
     await fs.rm(item.root,{recursive:true})
     this.records.push({request,helper:marker,ready,physical,result:value,receivedAt,requestCleanupComplete:true})
     item.resolve({...value,stdout:Buffer.from(value.stdout??[]),stderr:Buffer.from(value.stderr??[]),receivedAt,request})
    }catch(error){item.reject(error)}finally{this.pending.delete(value.request_id)}
   }
   assert.equal(this.pending.size,0,'Every original query produced a response before scope EOF')
  }catch(error){this.errors.push(String(error));for(const item of this.pending.values())item.reject(error);throw error}})()
  void this.lines.catch(()=>{});void this.closeFact.catch(()=>{})
 }
 async submit(executable:string,args:string[],cwd:string,options:{ceiling?:string,inactivity?:number,maximum?:number}={}){
  if(!path.isAbsolute(executable)&&!executable.includes('/')&&!executable.includes('\\')){const resolved=await whichAsync(executable,process.env);if(!resolved)throw new Error(`Windows command executable "${executable}" was not found in PATH`);executable=resolved}
  const id=randomUUID(),root=path.join(this.root,id)
  await fs.mkdir(root,{recursive:true})
  const request={kind:'command',executable,args,cwd,detached:false,terminate_children_on_root_exit:true,cancel_file:path.join(root,'cancel'),ready_file:path.join(root,'ready.json'),launch_failed_file:path.join(root,'launch-failed.json'),settled_file:path.join(root,'settled.json'),request_id:id,owner_pid:this.owner.pid,owner_process_instance_id:this.owner.processInstanceID,runtime_occurrence_id:this.owner.occurrenceID}
  await Filesystem.writeDurableAtomicIfAbsent(path.join(root,'request.json'),JSON.stringify(request))
  let resolve!:(v:any)=>void,reject!:(e:unknown)=>void
  const result=new Promise<any>((r,j)=>{resolve=r;reject=j});void result.catch(()=>{})
  this.pending.set(id,{resolve,reject,request,root})
  const query={request,ceiling:options.ceiling??path.dirname(cwd),inactivity_timeout_ms:options.inactivity??90000,max_output_bytes:options.maximum??8*1024*1024}
  this.child.stdin!.write(JSON.stringify(query)+'\n',error=>{if(error)reject(error)})
  return {result,request,cancel:()=>fs.writeFile(request.cancel_file,id)}
 }
 async run(executable:string,args:string[],cwd:string,options?:{ceiling?:string,inactivity?:number,maximum?:number}){return (await this.submit(executable,args,cwd,options)).result}
 async close(){this.child.stdin!.end();const outcomes=await Promise.allSettled([this.closeFact,this.lines,this.stderr]);for(const result of outcomes)if(result.status==='rejected')throw result.reason;const terminal=(outcomes[0] as PromiseFulfilledResult<{code:number|null,signal:string|null}>).value;assert.equal(terminal.code,0);const stderr=(outcomes[2] as PromiseFulfilledResult<Buffer>).value;assert.equal(stderr.length,0);assert.equal(this.pending.size,0);const state=observeRuntimeProcessOccurrence(this.helper);assert.equal(state,'dead_or_reused');return {owner:this.owner,helper:this.helper,terminal,helperState:state,outputComplete:true,queryRecords:this.records.length}}
}
