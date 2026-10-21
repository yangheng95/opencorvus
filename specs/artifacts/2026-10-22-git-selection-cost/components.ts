import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
const root=import.meta.dir,mode=process.env.OPENCORVUS_DIAGNOSTIC_LAUNCH_MODE!,run=process.env.OPENCORVUS_DIAGNOSTIC_LAUNCH_RUN!
assert(['resolve','ordinary','selected'].includes(mode));assert.match(run,/^(resolve|ordinary|selected)-[ab]$/)
const input=JSON.parse(await fs.readFile(root+'/input-private.json','utf8'))
const items=input.projects as Array<{id:string,worktree:string,physical:string,device:string,inode:string,git:boolean}>
assert.equal(items.length,166)
async function checkDirectories(){for(const item of items){const info=await fs.stat(item.worktree,{bigint:true});assert.equal(String(info.dev),item.device);assert.equal(String(info.ino),item.inode);assert.equal(await fs.realpath(item.worktree),item.physical)}}
await checkDirectories()
const {installProcessShims}=await import('../../packages/opencorvus/src/runtime/shims');installProcessShims()
const {whichAsync}=await import('../../packages/opencorvus/src/util/which')
const {gitProcessArgs}=await import('../../packages/opencorvus/src/util/git')
const {Process}=await import('../../packages/opencorvus/src/util/process')
const {settledWork}=await import('../../packages/opencorvus/src/util/queue')
const {ProcessSupervisor}=await import('../../packages/opencorvus/src/shell/process-supervisor')
const {currentRuntimeProcessOccurrence}=await import('../../packages/opencorvus/src/runtime/process-occurrence')
const owner=currentRuntimeProcessOccurrence(),outputs:any[]=[],requests:any[]=[],timings:any[]=[],ticks:number[]=[]
const restoreObserver=ProcessSupervisor.setWindowsRequestObserverForTest(request=>{requests.push({requestID:request.request_id,executable:request.executable,cwd:request.cwd,ownerPID:request.owner_pid,ownerProcessInstanceID:request.owner_process_instance_id,runtimeOccurrenceID:request.runtime_occurrence_id})})
const started=performance.now(),cpuStart=process.cpuUsage();let previous=started,completed=0,outcomes:any[]=[]
const timer=setInterval(()=>{const now=performance.now();ticks.push(now-previous);previous=now},5)
const progress=setInterval(()=>console.log(JSON.stringify({run,mode,completed,queries:outputs.length,elapsedMs:performance.now()-started})),5000)
try{
 outcomes=await settledWork({items,concurrency:os.availableParallelism(),run:async(item)=>{
  if(!item.git){completed++;return{id:item.id,kind:'ordinary-directory'}}
  const itemStarted=performance.now(),resolveStarted=performance.now()
  const executable=await whichAsync('git');assert(executable&&path.isAbsolute(executable))
  const resolveFinished=performance.now()
  if(mode!=='resolve'){
   const command=gitProcessArgs(['rev-parse','--path-format=absolute','--show-toplevel','--git-common-dir'],mode==='selected'?executable:'git')
   const result=await Process.runHost(command,{cwd:item.worktree,env:{GIT_CEILING_DIRECTORIES:path.dirname(item.worktree)},stdin:'ignore',nothrow:true,inactivityTimeoutMs:90000})
   assert.equal(result.code,0)
   const stdout=result.stdout.toString(),stderr=result.stderr.toString(),paths=stdout.replace(/\r?\n$/,'').split(/\r?\n/)
   assert.equal(paths.length,2);assert.equal(await fs.realpath(paths[0]),item.physical);assert((await fs.stat(paths[1])).isDirectory())
   const request=requests.find(row=>row.cwd===item.worktree);assert(request);assert.equal(path.normalize(request.executable),path.normalize(executable));assert.equal(request.ownerPID,owner.pid);assert.equal(request.ownerProcessInstanceID,owner.processInstanceID)
   outputs.push({id:item.id,stdout,stderr,executable,requestID:request.requestID})
  }
  timings.push({id:item.id,executable,resolveStartedMs:resolveStarted-started,resolveFinishedMs:resolveFinished-started,itemStartedMs:itemStarted-started,itemFinishedMs:performance.now()-started});completed++
  return{id:item.id,kind:mode}
 }})
}finally{clearInterval(timer);clearInterval(progress);restoreObserver()}
const wallMs=performance.now()-started,cpu=process.cpuUsage(cpuStart),metrics=ProcessSupervisor.metricsSnapshot()
const result={at:new Date().toISOString(),run,mode,runtime:Bun.version,owner,projects:items.length,gitProjects:items.filter(i=>i.git).length,concurrency:os.availableParallelism(),completed,queries:outputs.length,wallMs,parentCpuUserMs:cpu.user/1000,parentCpuSystemMs:cpu.system/1000,mainMaxTickMs:Math.max(0,...ticks),outcomes:outcomes.map(o=>o.status==='rejected'?{status:o.status,error:{name:o.reason?.name,message:o.reason?.message}}:o),timings,outputs:outputs.toSorted((a,b)=>a.id.localeCompare(b.id)),requests,metrics,modelRequests:0,boundary:'Component-only exact current Process.runHost/native execution with the formal PATH Git;not full Config/UI acceptance;parent CPU excludes helper/Git children;overlapping durations are not additive'}
await fs.writeFile(root+'/'+run+'-result.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
assert.equal(completed,166);assert(outcomes.every(o=>o.status==='fulfilled'));assert.equal(metrics.live,0);assert.equal(requests.length,mode==='resolve'?0:items.filter(i=>i.git).length)
await checkDirectories()
const {outcomes:_outcomes,timings:_timings,outputs:_outputs,requests:_requests,...summary}=result
console.log(JSON.stringify(summary))
