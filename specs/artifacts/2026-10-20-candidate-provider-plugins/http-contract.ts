import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import { pathToFileURL } from 'node:url'
import { parse } from '../../packages/overlay/node_modules/jsonc-parser'
const root=import.meta.dir
const scope='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-20/candidate-provider-plugins-455'
const directory='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project'
const canonical=directory+'/.opencorvus/opencorvus.jsonc'
const originalText=await fs.readFile(canonical,'utf8'),original=parse(originalText)
assert(original.$schema)
await fs.writeFile(scope+'/project-source-before-private.json',JSON.stringify(original),{flag:'wx',mode:0o600})
const preflight=JSON.parse(await fs.readFile(scope+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.preflight.streaming,true)
assert(preflight.occurrence.startsWith('candidate-provider-plugins-455-'))
const requests:Array<{method:string;route:string;status:number;ms:number;bytes:number}>=[]
async function request(route:string,method='GET',patch?:unknown){
 const controller=new AbortController()
 let timer:ReturnType<typeof setTimeout>
 const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(new Error('HTTP inactivity 90000ms')),90000)}
 const at=performance.now();touch()
 try{
  const response=await fetch('http://127.0.0.1:18717/'+route+'?directory='+encodeURIComponent(directory),{method,headers:patch===undefined?undefined:{'Content-Type':'application/json'},body:patch===undefined?undefined:JSON.stringify(patch),signal:controller.signal})
  const chunks:Uint8Array[]=[];let bytes=0
  for await(const chunk of response.body!){touch();chunks.push(chunk);bytes+=chunk.byteLength}
  requests.push({method,route,status:response.status,ms:performance.now()-at,bytes})
  assert.equal(response.status,200,`Actual HTTP ${method} ${route}`)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
 }finally{clearTimeout(timer!)}
}
async function selected(modelID:string){
 const catalog=await request('provider')
 const provider=catalog.all.find((entry:any)=>entry.id==='openai')
 const model=provider.models[modelID]
 assert(model)
 assert.equal(model.api.id,'gpt-6.1-sol')
 return {id:model.id,name:model.name,providerID:model.providerID,apiID:model.api.id}
}
const stages:any[]=[]
let failure:unknown,restored=false
try{
 for(const [suffix,name]of [['old','HTTP current old'],['next','HTTP candidate next']]as const){
  const file=scope+'/plugin-'+suffix+'.ts',id='candidate-455-'+suffix
  await fs.writeFile(file,`export default async()=>({provider:{id:'openai',models(provider){const base=provider.models['gpt-6.1-sol'];if(!base)throw new Error('Expected actual source model');return {...provider.models,['${id}']:{...base,id:'${id}',name:'${name}',api:{...base.api}}};}}})`,{flag:'wx'})
  const specifier=pathToFileURL(file).href
  const saved=await request('config','PATCH',{plugin:[specifier],model:'openai/'+id})
  assert.deepEqual(saved.plugin,[specifier]);assert.equal(saved.model,'openai/'+id)
  const model=await selected(id)
  assert.equal(model.name,name)
  stages.push({stage:suffix,configModel:saved.model,selected:model})
 }
 const removed=await request('config','PATCH',{plugin:[],model:'openai/gpt-6.1-sol'})
 assert.deepEqual(removed.plugin,[]);assert.equal(removed.model,'openai/gpt-6.1-sol')
 stages.push({stage:'standard-selection',selected:await selected('gpt-6.1-sol')})
}catch(error){failure=error}
finally{
 try{
  const patch=Object.fromEntries(['plugin','model'].map(key=>[key,Object.hasOwn(original,key)?original[key]:null]))
  await request('config','PATCH',patch)
  assert(isDeepStrictEqual(parse(await fs.readFile(canonical,'utf8')),original),'Complete project canonical source restored')
  const saved=await request('config')
  const model=await selected('gpt-6.1-sol')
  assert.equal(saved.permission_mode,'ask')
  stages.push({stage:'restored',configModel:saved.model,selected:model})
  restored=true
 }catch(error){failure=failure?new AggregateError([failure,error],'Contract and restoration failures'):error}
 const result={occurrence:preflight.occurrence,boundary:'Actual public HTTP against original native development service and real file-plugin loader; no UI automation',preflight:preflight.preflight,stages,requests,restored,failure:failure instanceof Error?{name:failure.name,message:failure.message}:undefined}
 await fs.writeFile(root+'/http-contract.json',JSON.stringify(result,null,2),{flag:'wx'})
 console.log(JSON.stringify({stages:stages.map(stage=>stage.stage),restored,requests:requests.length,failure:result.failure}))
}
if(failure)throw failure
