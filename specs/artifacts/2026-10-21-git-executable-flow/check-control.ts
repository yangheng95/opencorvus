import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
import {isDeepStrictEqual} from 'node:util'
import {parse} from '../../packages/overlay/node_modules/jsonc-parser'
import {configure} from '../../packages/overlay/src/services/api'
import {patchGlobalConfig} from '../../packages/overlay/src/services/config'
import {loadConfigInfo} from '../../packages/overlay/src/services/config-load'
import {getHostTransport} from '../../packages/overlay/src/services/host-transport-runtime'
import {appStore,setAppStore} from '../../packages/overlay/src/store/app'
import {setSettingsStore} from '../../packages/overlay/src/store/settings'
import {setBoardStore} from '../../packages/overlay/src/store/board'
const root=import.meta.dir,stage=process.argv[2]
assert(['control-before','control-after'].includes(stage))
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/git-executable-flow-492-'+stage,port=stage==='control-before'?18867:18869,base='http://127.0.0.1:'+port
const read=(name:string)=>JSON.parse(fs.readFileSync(name,'utf8'))
const native=read(run+'/evidence/native-host-ready.json'),api=read(run+'/evidence/api-ready.json'),original=read(root+'/original-canonical-private.json'),canonical=run+'/runtime/config/opencorvus.jsonc'
assert.equal(api.occurrence,native.occurrence);assert.equal(api.owner.pid,native.target.pid);assert.equal(api.maxRequests,0);assert.equal(api.projectedModel,'gpt-6.1-sol')
const selectedSessionID=api.sessionID
assert(isDeepStrictEqual(parse(fs.readFileSync(canonical,'utf8')),original));assert.equal(Object.keys(original).length,5);assert.equal(original.permission_mode,'ask')
configure({serverUrl:base,directory:''});setSettingsStore('directory','');setBoardStore({board:null,selectedSource:null});setAppStore('connected',true);assert.equal(getHostTransport().kind,'browser')
async function request(url:string){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>
 const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(new Error('HTTP_INACTIVITY_90000MS')),90000)};touch()
 try{const response=await fetch(url,{signal:controller.signal}),chunks:Buffer[]=[];for await(const chunk of response.body!) {touch();chunks.push(Buffer.from(chunk))}return{status:response.status,body:JSON.parse(Buffer.concat(chunks).toString())}}finally{clearTimeout(timer!)}
}
const selectionDB=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
let selected:any
try{selected=selectionDB.query('SELECT id,directory,project_id FROM session WHERE id=?').get(selectedSessionID);assert(selected)}finally{selectionDB.close(true)}
const sessionResponse=await request(base+'/session/'+selectedSessionID+'?directory='+encodeURIComponent(selected.directory))
assert.equal(sessionResponse.status,200)
const session=sessionResponse.body
assert.equal(session.id,selectedSessionID);assert.equal(typeof session.directory,'string')
const log=run+'/runtime/log/dev.log';let offset=fs.statSync(log).size,carry=''
const at=new Date().toISOString(),gateAt=Date.now()
const reads=(async()=>{
 let admission:any;const start=Date.now()
 while(Date.now()-start<90000){
  const size=fs.statSync(log).size
  if(size>offset){const fd=fs.openSync(log,'r'),bytes=Buffer.alloc(Math.min(size-offset,1024*1024));let count:number
   try{count=fs.readSync(fd,bytes,0,bytes.length,offset)}finally{fs.closeSync(fd)}
   offset+=count;const lines=(carry+bytes.subarray(0,count).toString()).split('\n');carry=lines.pop()??''
   for(const line of lines){let row:any;try{row=JSON.parse(line)}catch{continue}if(row.service==='skill-read-diagnostics'&&row.data?.phase==='config.global.before'&&row.data.status==='started'&&Date.parse(row.time)>=gateAt){admission={time:row.time,requestID:row.data.http.requestID,phase:row.data.phase};break}}
  }
  if(admission)break
  await Bun.sleep(200)
 }
 assert(admission,'Actual original candidate admission must precede all four reads')
 const endpoints=['/config','/provider','/global/providers','/session/'+session.id]
 const outcomes=await Promise.allSettled(endpoints.map(async endpoint=>{
  const url=new URL(endpoint,base);if(endpoint!=='/global/providers')url.searchParams.set('directory',session.directory)
  const startedAt=new Date().toISOString(),started=performance.now(),response=await request(url.href),ms=performance.now()-started
  assert.equal(response.status,200);let summary:any={}
  if(endpoint==='/config'){assert.equal(response.body.permission_mode,'ask');summary={permissionMode:response.body.permission_mode}}
  else if(endpoint==='/provider'||endpoint==='/global/providers'){
   const body=endpoint==='/global/providers'?response.body.catalog:response.body
   assert(Array.isArray(body.all));assert(Array.isArray(body.connected));assert(body.all.find((p:any)=>p.id==='openai')?.models['gpt-6.1-sol'])
   const shape=body.all.map((p:any)=>({id:p.id,models:Object.keys(p.models).sort()})).sort((a:any,b:any)=>a.id.localeCompare(b.id))
   const name=endpoint==='/provider'?'project':'global',shapeFile=root+'/before-'+name+'-catalog-private.json'
   if(stage==='before')fs.writeFileSync(shapeFile,JSON.stringify(shape),{flag:'wx'});else assert.deepEqual(shape,read(shapeFile),'Complete current catalog projection equals baseline')
   summary={providers:body.all.length,models:body.all.reduce((n:number,p:any)=>n+Object.keys(p.models).length,0),targetModel:'gpt-6.1-sol',projection:'Complete all provider/model identity sets retained'}
  }else{assert.equal(response.body.id,session.id);assert.equal(response.body.directory,session.directory);summary={sessionID:session.id}}
  return{endpoint,startedAt,endedAt:new Date().toISOString(),ms,status:200,...summary}
 }))
 const failures=outcomes.flatMap(row=>row.status==='rejected'?[{name:row.reason?.name,message:row.reason?.message}]:[])
 const result={occurrence:native.occurrence,admission,results:outcomes.filter(row=>row.status==='fulfilled').map(row=>row.value),failures}
 fs.writeFileSync(root+'/'+stage+'-readers.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 assert.deepEqual(failures,[]);return result
})();void reads.catch(()=>{})
let accepted=false,restored=false,writeMs=0,restoreMs=0;const failures:any[]=[]
try{
 const started=performance.now(),saved=await patchGlobalConfig({username:'qa-git-executable-492-'+stage});writeMs=performance.now()-started
 assert.equal(saved.username,'qa-git-executable-492-'+stage);assert.equal(saved.permission_mode,'ask')
 await loadConfigInfo();assert.equal(appStore.config?.username,'qa-git-executable-492-'+stage);accepted=true
}catch(error:any){failures.push({phase:'save',name:error.name,message:error.message})}
finally{
 const restorePatch={...original,username:Object.hasOwn(original,'username')?original.username:null}
 const started=performance.now()
 try{const saved=await patchGlobalConfig(restorePatch);restoreMs=performance.now()-started;assert.equal(saved.permission_mode,'ask');assert(isDeepStrictEqual(parse(fs.readFileSync(canonical,'utf8')),original),'Whole parsed original canonical source restored');restored=true}
 catch(error:any){failures.push({phase:'full-restore',name:error.name,message:error.message})}
}
const readResult=await reads.catch((error:any)=>{failures.push({phase:'readers',name:error.name,message:error.message});return{results:[]}})
const result={at,endedAt:new Date().toISOString(),stage,port,occurrence:native.occurrence,transport:getHostTransport().kind,accepted,restored,writeMs,restoreMs,failures,permissionMode:'ask',saveField:'username',restoreWireKeys:Object.keys({...original,username:null}),restore:'Entire original source object plus explicit deletion of the added field;complete parsed canonical equals original',criteria:{saveMaxMs:10000,savePass:accepted&&writeMs<=10000,restoreMaxMs:5000,restorePass:restored&&restoreMs<=5000,readMaxMs:20000,readPass:readResult.results.length===4&&readResult.results.every((r:any)=>r.status===200&&r.ms<=20000)},boundary:'Production config service->browser HostTransport->real public HTTP on all149 original directories/full source. Non-UI integration;not browser/visual acceptance.'}
fs.writeFileSync(root+'/'+stage+'-config.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(result));if(!accepted||!restored||failures.length)process.exitCode=1
