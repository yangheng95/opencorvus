import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import { pathToFileURL } from 'node:url'
import { parse } from '../../packages/overlay/node_modules/jsonc-parser'
const root=import.meta.dir
const scope='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-20/candidate-plugin-failure-456-final'
const directory='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project'
const canonical=directory+'/.opencorvus/opencorvus.jsonc'
const originalText=await fs.readFile(canonical,'utf8'),original=parse(originalText)
assert(original.$schema)
await fs.writeFile(scope+'/project-source-before-private.json',JSON.stringify(original),{flag:'wx',mode:0o600})
const preflight=JSON.parse(await fs.readFile(scope+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.preflight.streaming,true)
assert(preflight.occurrence.startsWith('candidate-plugin-failure-456-final-'))
const requests:Array<{method:string;route:string;status:number;ms:number;bytes:number}>=[]
async function request(route:string,method='GET',patch?:unknown,expected=200,project=true){
 const controller=new AbortController()
 let timer:ReturnType<typeof setTimeout>
 const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(new Error('HTTP inactivity 90000ms')),90000)}
 const at=performance.now();touch()
 try{
  const response=await fetch('http://127.0.0.1:18721/'+route+(project?'?directory='+encodeURIComponent(directory):''),{method,headers:patch===undefined?undefined:{'Content-Type':'application/json'},body:patch===undefined?undefined:JSON.stringify(patch),signal:controller.signal})
  const chunks:Uint8Array[]=[];let bytes=0
  for await(const chunk of response.body!){touch();chunks.push(chunk);bytes+=chunk.byteLength}
  requests.push({method,route,status:response.status,ms:performance.now()-at,bytes})
  assert.equal(response.status,expected,`Actual HTTP ${method} ${route}`)
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
const globalFile='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/runtime/config/opencorvus.jsonc'
const originalGlobal=parse(await fs.readFile(globalFile,'utf8'))
let failure:unknown,restored=false
try{
 const badFile=scope+'/bad-candidate.ts',specifier=pathToFileURL(badFile).href
 await fs.writeFile(badFile,'export default async()=>{throw new Error("Owned candidate factory failure")}\n',{flag:'wx'})
 for(const [route,project,rootLabel]of [['config',true,'config'],['global/config',false,'global config']]as const){
  const body=await request(route,'PATCH',{plugin:[specifier]},400,project)
  const message=`${rootLabel}.plugin: Plugin module load failed for ${specifier}: Owned candidate factory failure`
  assert.deepEqual(body,{data:{message},error:[{message}],success:false})
  assert(isDeepStrictEqual(parse(await fs.readFile(canonical,'utf8')),original),'Current project canonical retained after rejection')
  assert(isDeepStrictEqual(parse(await fs.readFile(globalFile,'utf8')),originalGlobal),'Current global canonical retained after rejection')
  stages.push({stage:project?'project-rejected':'global-rejected',status:400,message,selected:await selected('gpt-6.1-sol')})
 }
 await fs.writeFile(badFile,`export default async()=>({provider:{id:'openai',models(provider){const base=provider.models['gpt-6.1-sol'];return {...provider.models,['gpt-6.1-sol']:{...base,name:'HTTP repaired candidate'}};}}})`)
 await request('config','PATCH',{plugin:[specifier]})
 const repaired=await selected('gpt-6.1-sol')
 assert.equal(repaired.name,'HTTP repaired candidate')
 stages.push({stage:'repaired-same-selection',selected:repaired})
 const globalRepaired=await request('global/config','PATCH',{plugin:[specifier]},200,false)
 assert.deepEqual(globalRepaired.plugin,[specifier])
 stages.push({stage:'global-repaired-same-selection',status:200,selected:await selected('gpt-6.1-sol')})
 await request('global/config','PATCH',{plugin:Object.hasOwn(originalGlobal,'plugin')?originalGlobal.plugin:null},200,false)
 assert(isDeepStrictEqual(parse(await fs.readFile(globalFile,'utf8')),originalGlobal),'Full global source restored after repaired candidate')
 for(const [suffix,name]of [['old','HTTP current old'],['next','HTTP candidate next']]as const){
  const file=scope+'/plugin-'+suffix+'.ts',id='candidate-456-'+suffix
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
  if(!isDeepStrictEqual(parse(await fs.readFile(globalFile,'utf8')),originalGlobal))await request('global/config','PATCH',{plugin:Object.hasOwn(originalGlobal,'plugin')?originalGlobal.plugin:null},200,false)
  await request('config','PATCH',patch)
  assert(isDeepStrictEqual(parse(await fs.readFile(canonical,'utf8')),original),'Complete project canonical source restored')
  const saved=await request('config')
  const model=await selected('gpt-6.1-sol')
  assert.equal(saved.permission_mode,'ask')
  stages.push({stage:'restored',configModel:saved.model,selected:model})
  restored=true
 }catch(error){failure=failure?new AggregateError([failure,error],'Contract and restoration failures'):error}
 const result={occurrence:preflight.occurrence,boundary:'Actual public HTTP against original native development service and real file-plugin loader; no UI automation',preflight:preflight.preflight,stages,requests,restored,failure:failure instanceof Error?{name:failure.name,message:failure.message}:undefined}
 await fs.writeFile(root+'/http-contract-final.json',JSON.stringify(result,null,2),{flag:'wx'})
 console.log(JSON.stringify({stages:stages.map(stage=>stage.stage),restored,requests:requests.length,failure:result.failure}))
}
if(failure)throw failure
