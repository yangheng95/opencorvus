import fs from 'node:fs'
import assert from 'node:assert/strict'
const root=import.meta.dirname
const evidence='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-20/candidate-provider-plugins-455/evidence/'
const ready=JSON.parse(fs.readFileSync(evidence+'native-host-ready.json','utf8'))
const preflight=JSON.parse(fs.readFileSync(evidence+'preflight-ready.json','utf8'))
assert.equal(preflight.occurrence,ready.occurrence)
assert.deepEqual({model:preflight.preflight.actualModel,streaming:preflight.preflight.streaming},{model:'gpt-6.1-sol',streaming:true})
const session=preflight.preflight.sessionID,base='http://127.0.0.1:18717'
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
const selected=JSON.parse(fs.readFileSync(root+'/candidate-reader-selection.json','utf8'))
assert.equal(selected.id,session)
const directory=selected.directory
assert.equal(typeof directory,'string')
const response=await fetch(base+'/session/'+session+'?directory='+encodeURIComponent(directory))
assert.equal(response.status,200)
const actual=await response.json()
assert.equal(actual.id,session)
assert.equal(actual.directory,directory)
fs.writeFileSync(root+'/candidate-reader-ready.json',JSON.stringify({occurrence:ready.occurrence,sessionID:session,directory}),{flag:'wx'})
while(!fs.existsSync(root+'/candidate-write-start.json'))await new Promise(resolve=>setTimeout(resolve,20))
const gate=JSON.parse(fs.readFileSync(root+'/candidate-write-start.json','utf8'))
assert.equal(gate.occurrence,ready.occurrence)
const logPath='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/runtime/log/dev.log'
const gateAt=fs.statSync(root+'/candidate-write-start.json').mtimeMs
const deadline=Date.now()+20000
let admission
while(Date.now()<deadline){
 const rows=fs.readFileSync(logPath,'utf8').split('\n').flatMap(line=>{try{return[JSON.parse(line)]}catch{return[]}})
 admission=rows.find(r=>Date.parse(r.time)>=gateAt&&r.service==='skill-read-diagnostics'&&r.data?.phase==='config.global.before'&&r.data.status==='started')
 if(admission)break
 await new Promise(resolve=>setTimeout(resolve,100))
}
assert(admission,'Original candidate phase must start under the admitted writer before concurrent readers')
fs.writeFileSync(root+'/candidate-reader-admission.json',JSON.stringify({time:admission.time,phase:admission.data.phase,requestID:admission.data.http?.requestID,occurrence:ready.occurrence},null,2),{flag:'wx'})
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
fs.writeFileSync(root+'/candidate-reader-results.json',JSON.stringify({occurrence:ready.occurrence,kind:'Public HTTP positive contracts concurrent with original canonical save; this is not browser or visual acceptance',results},null,2),{flag:'wx'})
console.log(JSON.stringify(results))
