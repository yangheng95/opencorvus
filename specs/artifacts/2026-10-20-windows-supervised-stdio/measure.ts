import fs from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
import { AsyncLocalStorage } from "node:async_hooks"
const root=import.meta.dir
assert.equal(path.resolve(process.env.OPENCORVUS_HOME!),path.join(root,'runtime'))
const helper=path.resolve('D:/myhexin-local/opencorvus/.tmp-product-iteration/native-parent-query-446/release-target/release/opencorvus-process-supervisor.exe')
assert.equal(path.resolve(process.env.OPENCORVUS_PROCESS_SUPERVISOR!),helper)
const node=process.argv[2]
assert(node&&path.isAbsolute(node))
const input=JSON.parse(await fs.readFile(root+'/inputs.json','utf8'))
assert(input.included.length>24)
type Row={index:number;kind:string;mode:string;spawnMs:number;childCloses:Array<{code:number|null;signal:string|null}>;totalMs:number;code?:number;stdoutBytes?:number;stderrBytes?:number}
const context=new AsyncLocalStorage<Row>()
const cp=require('node:child_process'),original=cp.spawn
let mode='pipe'
cp.spawn=function(executable:string,args:string[],options:Record<string,any>){
 const own=path.resolve(executable)===helper
 const at=performance.now()
 const actual=own&&mode==='overlapped'?{...options,stdio:options.stdio.map((value:unknown)=>value==='pipe'?'overlapped':value)}:options
 let child
 try{child=Reflect.apply(original,this,[executable,args,actual])}
 finally{const row=context.getStore();if(own&&row)row.spawnMs+=performance.now()-at}
 const row=context.getStore()
 if(own&&row)child.once('close',(code:number|null,signal:string|null)=>row.childCloses.push({code,signal}))
 return child
}
require('node:module').syncBuiltinESMExports()
assert.equal((await import('node:child_process')).spawn,cp.spawn)
const {installProcessShims}=await import('../../packages/opencorvus/src/runtime/shims')
installProcessShims()
const {Process}=await import('../../packages/opencorvus/src/util/process')
const {ProcessSupervisor}=await import('../../packages/opencorvus/src/shell/process-supervisor')
const {gitProcessArgs}=await import('../../packages/opencorvus/src/util/git')
const {settledWork}=await import('../../packages/opencorvus/src/util/queue')
const expected=new Map<string,{stdout:Buffer;stderr:Buffer}>(),groups:any[]=[]
let failure:unknown
try{
 for(const [concurrency,variant] of [[1,'pipe'],[1,'overlapped'],[12,'overlapped'],[12,'pipe'],[12,'pipe'],[12,'overlapped']] as const){
  mode=variant
  const rows:Row[]=[],start=performance.now()
  const outcomes=await settledWork({concurrency,items:input.included.slice(0,24),run:async(item:any,index:number)=>{
   const row:Row={index,kind:'git',mode,spawnMs:0,childCloses:[],totalMs:0}
   rows[index]=row
   return context.run(row,async()=>{
    const at=performance.now()
    const result=await Process.runHost(gitProcessArgs(['rev-parse','--path-format=absolute','--show-toplevel','--git-common-dir']),{cwd:item.worktree,env:{GIT_CEILING_DIRECTORIES:path.dirname(item.worktree)},owner:'supervised-stdio-454',stdin:'ignore',inactivityTimeoutMs:15000})
    row.totalMs=performance.now()-at;row.code=result.code;row.stdoutBytes=result.stdout.length;row.stderrBytes=result.stderr.length
    assert.equal(result.code,0)
    const paths=result.stdout.toString().replace(/\r?\n$/,'').split(/\r?\n/)
    assert.equal(paths.length,2)
    assert.equal(await fs.realpath(paths[0]),await fs.realpath(item.worktree))
    assert((await fs.stat(paths[1])).isDirectory())
    const baseline=expected.get(item.id)
    if(baseline){assert.deepEqual(result.stdout,baseline.stdout);assert.deepEqual(result.stderr,baseline.stderr)}
    else expected.set(item.id,{stdout:result.stdout,stderr:result.stderr})
    assert.deepEqual(row.childCloses,[{code:0,signal:null}])
    return{code:result.code,top:paths[0],common:paths[1]}
   })
  }})
  const group={mode,concurrency,commands:outcomes.length,wallMs:performance.now()-start,syncSpawnMs:rows.reduce((n,row)=>n+row.spawnMs,0),rows,outcomes}
  groups.push(group)
  console.log(JSON.stringify({mode,concurrency,wallMs:group.wallMs,syncSpawnMs:group.syncSpawnMs,fulfilled:outcomes.filter(o=>o.status==='fulfilled').length}))
  const rejected=outcomes.flatMap(o=>o.status==='rejected'?[o.reason]:[])
  if(rejected.length)throw new AggregateError(rejected,'Original settled Git group failed')
 }
 for(const variant of ['pipe','overlapped','overlapped','pipe']){
  mode=variant
  const row:Row={index:groups.length,kind:'payload',mode,spawnMs:0,childCloses:[],totalMs:0}
  const result=await context.run(row,async()=>{
   const at=performance.now()
   async function* bytes(){for(let i=0;i<16;i++)yield Buffer.alloc(65536,73)}
   const value=await Process.runHost([node,root+'/payload.mjs'],{cwd:root,owner:'supervised-stdio-454',stdin:'pipe',input:bytes(),inactivityTimeoutMs:15000,maxOutputBytes:4*1024*1024})
   row.totalMs=performance.now()-at;row.code=value.code;row.stdoutBytes=value.stdout.length;row.stderrBytes=value.stderr.length
   assert.equal(value.code,0);assert.deepEqual(value.stdout,Buffer.alloc(2*1024*1024,79));assert.deepEqual(value.stderr,Buffer.alloc(512*1024,69));assert.deepEqual(row.childCloses,[{code:0,signal:null}])
   return{code:value.code,stdoutBytes:value.stdout.length,stderrBytes:value.stderr.length}
  })
  groups.push({mode,kind:'payload',rows:[row],result})
  console.log(JSON.stringify({mode,kind:'payload',ms:row.totalMs,...result}))
 }
}catch(error){failure=error;process.exitCode=1}
finally{
 cp.spawn=original;require('node:module').syncBuiltinESMExports()
 const failed=failure instanceof AggregateError?{name:failure.name,errors:failure.errors.map(error=>({name:error.name,message:error.message}))}:failure instanceof Error?{name:failure.name,message:failure.message}:undefined
  await fs.writeFile(root+'/measurements.json',JSON.stringify({runtime:Bun.version,inputs:{projects:input.projects,localGit:input.included.length,selected:24},groups,failure:failed,liveHandles:ProcessSupervisor.metricsSnapshot(),boundary:'Scratch-only stdio substitution through original production Process.runHost and native helper, original output and physical/request settlement; no Provider/auth/database initializer or end-to-end performance qualification'},null,2),{flag:'wx'})
 if(failed)console.log(JSON.stringify({failure:failed}))
}
