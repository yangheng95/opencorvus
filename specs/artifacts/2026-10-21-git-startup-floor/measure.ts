import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
const root=import.meta.dir,mode=process.env.OPENCORVUS_DIAGNOSTIC_LAUNCH_MODE!,run=process.env.OPENCORVUS_DIAGNOSTIC_LAUNCH_RUN!
assert(['query','version','cmd'].includes(mode));assert.match(run,/^[a-z0-9-]+$/)
const input=JSON.parse(await fs.readFile(root+'/input-private.json','utf8')),items=input.projects as Array<{id:string,worktree:string}>
const expected=JSON.parse(await fs.readFile(root+'/expected-git-private.json','utf8')),byID=new Map(expected.filter((r:any)=>r.observation===0).map((r:any)=>[r.id,r]))
assert.equal(items.length,149);assert.equal(os.availableParallelism(),12)
const baseline=await Promise.all(items.map(async item=>{
 const info=await fs.stat(item.worktree,{bigint:true}),physical=await fs.realpath(item.worktree)
 let git=true;try{await fs.access(path.join(item.worktree,'.git'))}catch(error:any){if(error.code!=='ENOENT')throw error;git=false}
 if(git){const row:any=byID.get(item.id);assert(row);assert.equal(await fs.realpath(row.stdout.replace(/\r?\n$/,'').split(/\r?\n/)[0]),physical)}
 return{git,physical,device:info.dev,inode:info.ino}
}))
assert.equal(baseline.filter(r=>r.git).length,148)
const cp=require('node:child_process'),native=path.resolve(process.env.OPENCORVUS_PROCESS_SUPERVISOR!),originalSpawn=cp.spawn,originalRead=fs.readFile,spawns:any[]=[],requests:any[]=[],markers=new Map<string,{request:any,ready?:any,settled?:any}>(),outputs:any[]=[],ticks:number[]=[]
cp.spawn=function(executable:string,...args:any[]){
 const at=performance.now(),child=Reflect.apply(originalSpawn,this,[executable,...args])
 if(path.resolve(executable)===native){const row:any={pid:child.pid,at,returnedAt:performance.now(),executable,args:args[0]};spawns.push(row);child.once('close',(code:number,signal:string)=>Object.assign(row,{closedAt:performance.now(),code,signal}))}
 return child
}
;(fs as any).readFile=async function(file:any,...args:any[]){
 const result=await Reflect.apply(originalRead,fs,[file,...args]),key=typeof file==='string'?path.resolve(file):undefined,record=key?markers.get(key):undefined
 if(record){try{const value=JSON.parse(result.toString());if(value.request_id===record.request.request_id){if(key===path.resolve(record.request.ready_file))record.ready=value;if(key===path.resolve(record.request.settled_file))record.settled=value}}catch{}}
 return result
}
require('node:module').syncBuiltinESMExports()
const {installProcessShims}=await import('../../packages/opencorvus/src/runtime/shims');installProcessShims()
const {Process}=await import('../../packages/opencorvus/src/util/process')
const {ProcessSupervisor}=await import('../../packages/opencorvus/src/shell/process-supervisor')
const {currentRuntimeProcessOccurrence}=await import('../../packages/opencorvus/src/runtime/process-occurrence')
const {settledWork}=await import('../../packages/opencorvus/src/util/queue')
const owner=currentRuntimeProcessOccurrence(),restore=ProcessSupervisor.setWindowsRequestObserverForTest(request=>{
 assert.equal(request.owner_pid,owner.pid);assert.equal(request.owner_process_instance_id,owner.processInstanceID);assert.equal(request.runtime_occurrence_id,owner.occurrenceID)
 const row={request};requests.push(row);markers.set(path.resolve(String(request.ready_file)),row);markers.set(path.resolve(String(request.settled_file)),row)
})
const systemCommand=path.resolve(process.env.ComSpec||path.join(process.env.SystemRoot!,'System32/cmd.exe'))
let completed=0,outcomes:any[]=[],previous=performance.now()
const started=previous,cpuStart=process.cpuUsage(),timer=setInterval(()=>{const now=performance.now();ticks.push(now-previous);previous=now},5)
const progress=setInterval(()=>console.log(JSON.stringify({run,mode,completed,requests:requests.length,elapsedMs:performance.now()-started})),5000)
try{
 outcomes=await settledWork({items,concurrency:os.availableParallelism(),run:async(item,index)=>{
  if(baseline[index].git)for(let observation=0;observation<2;observation++){
   const args=mode==='query'?['git','-c','core.longPaths=true','rev-parse','--path-format=absolute','--show-toplevel','--git-common-dir']:mode==='version'?['git','-c','core.longPaths=true','--version']:[systemCommand,'/d','/s','/c','echo OPENCORVUS_STARTUP_FLOOR_493']
   const at=performance.now(),result=await Process.runHost(args,{cwd:item.worktree,env:{GIT_CEILING_DIRECTORIES:path.dirname(item.worktree)},stdin:'ignore',inactivityTimeoutMs:15000,maxOutputBytes:8*1024*1024,owner:'qa:startup-floor-493'})
   assert.equal(result.code,0)
   const stdout=result.stdout.toString(),stderr=result.stderr.toString()
   if(mode==='query'){const original:any=expected.find((r:any)=>r.id===item.id&&r.observation===observation);assert.deepEqual({stdout,stderr},{stdout:original.stdout,stderr:original.stderr})}
   if(mode==='version')assert.deepEqual({stdout,stderr},{stdout:'git version 2.45.1.windows.1\n',stderr:''})
   if(mode==='cmd')assert.deepEqual({stdout,stderr},{stdout:'OPENCORVUS_STARTUP_FLOOR_493\r\n',stderr:''})
   outputs.push({id:item.id,observation,code:result.code,stdout,stderr,at,endedAt:performance.now()})
  }
  completed++;return{id:item.id,observations:baseline[index].git?2:0}
 }})
}finally{
 clearInterval(timer);clearInterval(progress);ticks.push(performance.now()-previous);restore();cp.spawn=originalSpawn;(fs as any).readFile=originalRead;require('node:module').syncBuiltinESMExports()
 await fs.writeFile(root+'/'+run+'-raw.json',JSON.stringify({run,mode,owner,outcomes:outcomes.map(r=>r.status==='rejected'?{status:r.status,error:{name:r.reason?.name,message:r.reason?.message}}:r),requests,spawns,outputs},null,2)+'\n',{flag:'wx'})
}
const wallMs=performance.now()-started,cpu=process.cpuUsage(cpuStart),failures=outcomes.flatMap(r=>r.status==='rejected'?[{name:r.reason?.name,message:r.reason?.message}]:[])
assert.deepEqual(failures,[]);assert.equal(completed,149);assert.equal(outputs.length,296);assert.equal(requests.length,296);assert.equal(spawns.length,296)
const helperByID=new Map(spawns.map(r=>[r.pid,r]))
for(const row of requests){assert(row.ready);assert(row.settled);assert.equal(row.ready.request_id,row.request.request_id);assert.equal(row.settled.request_id,row.request.request_id);assert.equal(row.ready.runtime_occurrence_id,owner.occurrenceID);assert.equal(row.settled.runtime_occurrence_id,owner.occurrenceID);assert.equal(row.ready.helper_pid,row.settled.helper_pid);assert.equal(row.ready.target_pid,row.settled.target_pid);assert.equal(row.settled.active_processes,0);const helper=helperByID.get(row.ready.helper_pid);assert(helper);assert.deepEqual({code:helper.code,signal:helper.signal},{code:0,signal:null})}
for(let index=0;index<items.length;index++){const info=await fs.stat(items[index].worktree,{bigint:true});assert.equal(info.dev,baseline[index].device);assert.equal(info.ino,baseline[index].inode);assert.equal(await fs.realpath(items[index].worktree),baseline[index].physical)}
const live=ProcessSupervisor.metricsSnapshot();assert.equal(live.live,0)
const result={observedAt:new Date().toISOString(),runtime:Bun.version,run,mode,owner,projects:149,gitProjects:148,nonGitProjects:1,concurrency:12,wallMs,queries:296,helperProcesses:spawns.length,mainMaxTickMs:Math.max(...ticks),spawnMs:spawns.reduce((sum,r)=>sum+r.returnedAt-r.at,0),parentCpuUserMs:cpu.user/1000,parentCpuSystemMs:cpu.system/1000,physicalRequests:requests.length,live,modelRequests:0,boundary:'Actual original Process.runHost/native component control across all original149 directory inputs;two sequential observations per Git directory. Version/cmd are startup counterfactuals,not Git identity or full Config acceptance. Native durable markers tapped from actual unchanged reads;no mock/stub. Parent CPU excludes children.'}
await fs.writeFile(root+'/'+run+'-result.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(result))
