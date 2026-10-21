import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createInterface} from 'node:readline'
import {randomUUID} from 'node:crypto'
import {Filesystem} from '../../packages/opencorvus/src/util/filesystem'
import {whichAsync} from '../../packages/opencorvus/src/util/which'
import {currentRuntimeProcessOccurrence,observedProcessOccurrence,observeRuntimeProcessOccurrence} from '../../packages/opencorvus/src/runtime/process-occurrence'

type StreamName='stdout'|'stderr'
type StreamState={chunks:Buffer[],bytes:number,sequence:number,ended:boolean}
type QueryOptions={ceiling?:string,inactivity?:number,maximum?:number,onData?:(stream:StreamName,bytes:Buffer,query:any)=>void}
type Pending={resolve:(value:any)=>void,reject:(error:unknown)=>void,request:any,root:string,streams:Record<StreamName,StreamState>,options:QueryOptions,frames:any[]}

export class StreamQueryScope {
 readonly owner=currentRuntimeProcessOccurrence()
 readonly child=spawn(path.join(import.meta.dir,'native-target/release/opencorvus-process-supervisor.exe'),['--query-scope'],{stdio:['pipe','pipe','pipe'],windowsHide:true,detached:true,env:process.env})
 readonly pending=new Map<string,Pending>()
 readonly records:any[]=[]
 readonly errors:string[]=[]
 readonly closeFact:Promise<{code:number|null,signal:string|null}>
 readonly ready:Promise<NonNullable<ReturnType<typeof observedProcessOccurrence>>>
 readonly stderr:Promise<Buffer>
 readonly lines:Promise<void>
 private closing=false
 private submitted=0
 private closePromise?:Promise<any>

 constructor(readonly root:string,readonly maximumSubmissions=14){
  this.closeFact=new Promise((resolve,reject)=>{this.child.once('close',(code,signal)=>resolve({code,signal}));this.child.once('error',reject)})
  this.ready=once(this.child,'spawn').then(()=>{const helper=observedProcessOccurrence(this.child.pid!);assert(helper,'Exact spawned helper identity');return helper})
  this.stderr=(async()=>{const chunks:Buffer[]=[];for await(const chunk of this.child.stderr!)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks)})()
  this.lines=this.consume()
  void this.lines.catch(()=>{});void this.closeFact.catch(()=>{});void this.ready.catch(()=>{})
 }

 private async consume(){
  try{
   const helper=await this.ready
   for await(const line of createInterface({input:this.child.stdout!})){
    const value=JSON.parse(line),item=this.pending.get(value.request_id);assert(item,'Frame belongs to exact outstanding query')
    const receivedAt=performance.now()
    if(value.kind==='data'||value.kind==='stream_end'){
     assert(value.stream==='stdout'||value.stream==='stderr');const stream=item.streams[value.stream as StreamName]
     assert.equal(value.sequence,stream.sequence);assert.equal(value.offset,stream.bytes);assert.equal(stream.ended,false)
     if(value.kind==='data'){
      assert(Array.isArray(value.bytes)&&value.bytes.length>0&&value.bytes.length<=16384)
      assert(value.bytes.every((n:any)=>Number.isInteger(n)&&n>=0&&n<=255))
      const bytes=Buffer.from(value.bytes);stream.chunks.push(bytes);stream.bytes+=bytes.length;stream.sequence++
      const frame={kind:value.kind,stream:value.stream,sequence:value.sequence,offset:value.offset,bytes:bytes.length,receivedAt}
      item.frames.push(frame);item.options.onData?.(value.stream,bytes,{request:item.request,frame})
     }else{stream.ended=true;item.frames.push({kind:value.kind,stream:value.stream,sequence:value.sequence,offset:value.offset,receivedAt})}
     continue
    }
    assert.equal(value.kind,'terminal')
    try{
     for(const name of ['stdout','stderr'] as const){const stream=item.streams[name];assert.equal(stream.ended,true);assert.deepEqual(value.streams[name],{bytes:stream.bytes,chunks:stream.sequence})}
     assert.equal(value.output_joined,true);assert.equal(value.output_delivery_complete,true)
     const request=item.request,marker=JSON.parse(await fs.readFile(path.join(item.root,'helper.json'),'utf8'))
     assert.deepEqual({id:marker.request_id,helper:marker.helper_pid,birth:marker.helper_process_instance_id,owner:marker.runtime_occurrence_id},{id:request.request_id,helper:helper.pid,birth:helper.processInstanceID,owner:this.owner.occurrenceID})
     const ready=await fs.readFile(request.ready_file,'utf8').then(text=>JSON.parse(text)).catch(error=>{if(error.code==='ENOENT')return undefined;throw error})
     const physical=JSON.parse(await fs.readFile(path.join(item.root,ready?'settled.json':'launch-failed.json'),'utf8'))
     assert.equal(physical.request_id,request.request_id);assert.equal(physical.helper_pid,helper.pid);assert.equal(physical.runtime_occurrence_id,this.owner.occurrenceID);assert.equal(physical.active_processes,0)
     if(ready){
      assert.equal(ready.protocol,3);assert.equal(ready.request_id,request.request_id);assert.equal(ready.helper_pid,helper.pid);assert.equal(ready.target_pid,physical.target_pid);assert.equal(ready.runtime_occurrence_id,this.owner.occurrenceID)
      assert.equal(observeRuntimeProcessOccurrence({pid:ready.target_pid,processInstanceID:ready.target_process_instance_id,occurrenceID:request.request_id}),'dead_or_reused')
     }else assert.equal(physical.stage,'target_not_created')
     const stdout=Buffer.concat(item.streams.stdout.chunks),stderr=Buffer.concat(item.streams.stderr.chunks)
     const resolved=path.resolve(item.root);assert.equal(path.dirname(resolved),path.resolve(this.root));assert.equal(path.basename(resolved),request.request_id)
     const info=await fs.lstat(resolved);assert(info.isDirectory());assert.equal(info.isSymbolicLink(),false)
     await fs.rm(resolved,{recursive:true})
     this.records.push({request,helper:marker,ready,physical,frames:item.frames,result:value,receivedAt,actualBytes:{stdout:stdout.length,stderr:stderr.length},requestCleanupComplete:true})
     item.resolve({...value,stdout,stderr,receivedAt,request,frames:item.frames})
    }catch(error){item.reject(error);throw error}finally{this.pending.delete(value.request_id)}
   }
   assert.equal(this.pending.size,0,'Every accepted query settled before scope EOF')
  }catch(error){
   this.errors.push(String(error));this.closing=true
   this.child.stdout!.resume()
   await Promise.allSettled([...this.pending.values()].map(item=>fs.writeFile(item.request.cancel_file,'stream-transport-failed')))
   this.child.stdin!.end()
   for(const item of this.pending.values())item.reject(error)
   throw error
  }
 }

 async submit(executable:string,args:string[],cwd:string,options:QueryOptions={}){
  if(this.closing)throw Error('Stream query scope admission is closed')
  assert(this.submitted<this.maximumSubmissions,'Original fixed query budget')
  const helper=await this.ready;assert.equal(observeRuntimeProcessOccurrence(helper),'exact_live')
  if(!path.isAbsolute(executable)&&!executable.includes('/')&&!executable.includes('\\')){const resolved=await whichAsync(executable,process.env);if(!resolved)throw Error(`Windows command executable "${executable}" was not found in PATH`);executable=resolved}
  const id=randomUUID(),root=path.join(this.root,id);assert.equal(path.dirname(path.resolve(root)),path.resolve(this.root));await fs.mkdir(root,{recursive:true})
  const request={kind:'command',executable,args,cwd,detached:false,terminate_children_on_root_exit:true,cancel_file:path.join(root,'cancel'),ready_file:path.join(root,'ready.json'),launch_failed_file:path.join(root,'launch-failed.json'),settled_file:path.join(root,'settled.json'),request_id:id,owner_pid:this.owner.pid,owner_process_instance_id:this.owner.processInstanceID,runtime_occurrence_id:this.owner.occurrenceID}
  await Filesystem.writeDurableAtomicIfAbsent(path.join(root,'request.json'),JSON.stringify(request))
  let resolve!:(value:any)=>void,reject!:(error:unknown)=>void
  const result=new Promise<any>((r,j)=>{resolve=r;reject=j});void result.catch(()=>{})
  const state=():StreamState=>({chunks:[],bytes:0,sequence:0,ended:false})
  this.pending.set(id,{resolve,reject,request,root,options,streams:{stdout:state(),stderr:state()},frames:[]});this.submitted++
  const query={request,ceiling:options.ceiling??path.dirname(cwd),inactivity_timeout_ms:options.inactivity??90000,max_output_bytes:options.maximum??8*1024*1024}
  this.child.stdin!.write(JSON.stringify(query)+'\n',error=>{if(error)reject(error)})
  return{result,request,cancel:()=>fs.writeFile(request.cancel_file,id)}
 }
 async run(executable:string,args:string[],cwd:string,options?:QueryOptions){return(await this.submit(executable,args,cwd,options)).result}
 close(){
  return this.closePromise??=(async()=>{
   this.closing=true;this.child.stdin!.end()
   const outcomes=await Promise.allSettled([this.closeFact,this.lines,this.stderr,this.ready])
   for(const result of outcomes)if(result.status==='rejected')throw result.reason
   const terminal=(outcomes[0] as PromiseFulfilledResult<{code:number|null,signal:string|null}>).value
   const helper=(outcomes[3] as PromiseFulfilledResult<NonNullable<ReturnType<typeof observedProcessOccurrence>>>).value
   const stderr=(outcomes[2] as PromiseFulfilledResult<Buffer>).value
   assert.equal(terminal.code,0);assert.equal(stderr.length,0);assert.equal(this.pending.size,0)
   const helperState=observeRuntimeProcessOccurrence(helper);assert.equal(helperState,'dead_or_reused')
   return{owner:this.owner,helper,terminal,helperState,outputComplete:true,acceptedQueries:this.submitted,queryRecords:this.records.length}
  })()
 }
}
