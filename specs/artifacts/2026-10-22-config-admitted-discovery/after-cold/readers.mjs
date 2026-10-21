import fs from 'node:fs'
import assert from 'node:assert/strict'
const root=import.meta.dirname
const evidence='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-admitted-discovery-518-after/evidence/'
const ready=JSON.parse(fs.readFileSync(evidence+'native-host-ready.json','utf8'))
const preflight=JSON.parse(fs.readFileSync(evidence+'preflight-ready.json','utf8'))
assert.equal(preflight.occurrence,ready.occurrence)
assert.deepEqual({model:preflight.preflight.actualModel,streaming:preflight.preflight.streaming},{model:'gpt-6.1-sol',streaming:true})
const session=preflight.preflight.sessionID,base='http://127.0.0.1:18985'
async function readJSON(url){
 const controller=new AbortController();let timer
 const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(new Error('HTTP inactivity 45000ms')),45000)}
 touch()
 try{
  const response=await fetch(url,{signal:controller.signal}),chunks=[]
  for await(const chunk of response.body){touch();chunks.push(chunk)}
  return{status:response.status,envelope:JSON.parse(Buffer.concat(chunks).toString('utf8'))}
 }finally{clearTimeout(timer)}
}
const selected=JSON.parse(fs.readFileSync(root+'/run-reader-selection.json','utf8'))
assert.equal(selected.id,session)
const directory=selected.directory
assert.equal(typeof directory,'string')
const response=await fetch(base+'/session/'+session+'?directory='+encodeURIComponent(directory))
assert.equal(response.status,200)
const actual=await response.json()
assert.equal(actual.id,session)
assert.equal(actual.directory,directory)
const logPath='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-admitted-discovery-518-after/runtime/log/dev.log'
let offset=fs.statSync(logPath).size,carry=''
fs.writeFileSync(root+'/run-reader-ready.json',JSON.stringify({occurrence:ready.occurrence,sessionID:session,directory}),{flag:'wx'})
while(!fs.existsSync(root+'/run-write-start.json'))await new Promise(resolve=>setTimeout(resolve,20))
const gate=JSON.parse(fs.readFileSync(root+'/run-write-start.json','utf8'))
assert.equal(gate.occurrence,ready.occurrence)
const gateAt=fs.statSync(root+'/run-write-start.json').mtimeMs,deadline=Date.now()+20000
let admission
while(Date.now()<deadline){
 const size=fs.statSync(logPath).size
 if(size>offset){
  const bytes=Buffer.alloc(Math.min(size-offset,1024*1024)),fd=fs.openSync(logPath,'r')
  let count;try{count=fs.readSync(fd,bytes,0,bytes.length,offset)}finally{fs.closeSync(fd)}
  offset+=count;const lines=(carry+bytes.subarray(0,count).toString('utf8')).split('\n');carry=lines.pop()??''
  for(const line of lines){
   let row;try{row=JSON.parse(line)}catch{continue}
   if(row.service==='skill-read-diagnostics'&&row.data?.phase==='config.global.before'&&row.data?.status==='started'&&Date.parse(row.time)>=gateAt){
    admission={occurrence:ready.occurrence,time:row.time,phase:row.data.phase,requestID:row.data.http.requestID};break
   }
  }
 }
 if(admission)break
 await new Promise(resolve=>setTimeout(resolve,200))
}
assert(admission,'Actual candidate phase must precede concurrent readers')
fs.writeFileSync(root+'/run-reader-admission.json',JSON.stringify({time:admission.time,phase:admission.phase,requestID:admission.requestID,occurrence:ready.occurrence},null,2),{flag:'wx'})
const requests=[{path:'/config',project:true},{path:'/provider',project:true},{path:'/global/providers',project:false},{path:'/session/'+session,project:true}]
const outcomes=await Promise.allSettled(requests.map(async input=>{
 const startedAt=new Date().toISOString(),start=performance.now()
 const url=new URL(input.path,base)
 if(input.project)url.searchParams.set('directory',directory)
 const value=await readJSON(url)
 const envelope=value.envelope
 const body=input.path==='/global/providers'?envelope.catalog:envelope
 assert.equal(value.status,200)
 const result={path:input.path,startedAt,endedAt:new Date().toISOString(),ms:performance.now()-start,status:value.status}
 if(input.path==='/config'){assert.equal(body.permission_mode,'ask');return {...result,permissionMode:body.permission_mode}}
 if(input.path==='/provider'||input.path==='/global/providers'){
   assert(Array.isArray(body.all));assert(Array.isArray(body.connected))
   const openai=body.all.find(p=>p.id==='openai')
   assert(openai?.models['gpt-6.1-sol'])
   return {...result,providers:body.all.length,models:body.all.reduce((n,p)=>n+Object.keys(p.models).length,0),selectedModel:openai.models['gpt-6.1-sol'].id}
 }
 assert.equal(body.id,session)
 return {...result,sessionID:body.id}
}))
const failures=outcomes.flatMap(item=>item.status==='rejected'?[item.reason]:[]);if(failures.length)throw new AggregateError(failures,'Original readers drained with errors');const results=outcomes.map(item=>item.value);
fs.writeFileSync(root+'/run-reader-results.json',JSON.stringify({occurrence:ready.occurrence,kind:'Public HTTP positive contracts concurrent with original canonical save; this is not browser or visual acceptance',results},null,2),{flag:'wx'})
console.log(JSON.stringify(results))





if(results.some(result=>result.ms>20_000))process.exitCode=1
