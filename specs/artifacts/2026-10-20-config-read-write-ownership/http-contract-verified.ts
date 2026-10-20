import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { parse } from '../../packages/overlay/node_modules/jsonc-parser'
const root=import.meta.dir,tag='config-read-write-ownership-457-verified'
const scope='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-20/'+tag
const directory='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project'
const target=directory+'/.opencorvus/opencorvus.jsonc'
const original=await fs.readFile(target,'utf8'),authored=parse(original)
const preflight=JSON.parse(await fs.readFile(scope+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.preflight.streaming,true)
assert(preflight.occurrence.startsWith(tag+'-'))
const requests:Array<{method:string;route:string;status:number;ms:number}>=[]
async function request(method:string,patch?:unknown,status=200){
 const started=performance.now(),controller=new AbortController();let timer:ReturnType<typeof setTimeout>
 const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(new Error('HTTP inactivity 90000ms')),90000)}
 touch()
 try{
  const response=await fetch('http://127.0.0.1:18727/config?directory='+encodeURIComponent(directory),{method,headers:patch===undefined?undefined:{'Content-Type':'application/json'},body:patch===undefined?undefined:JSON.stringify(patch),signal:controller.signal})
  const chunks:Uint8Array[]=[];for await(const chunk of response.body!){touch();chunks.push(chunk)}
  requests.push({method,route:'/config',status:response.status,ms:performance.now()-started})
  assert.equal(response.status,status);return JSON.parse(Buffer.concat(chunks).toString('utf8'))
 }finally{clearTimeout(timer!)}
}
let restored=false,failure:unknown
const stages:string[]=[]
try{
 const {$schema,...withoutSchema}=authored
 const text='// Actual authored source fidelity\n'+JSON.stringify({...withoutSchema,username:'qa-authored-457'})+'\n'
 await fs.writeFile(target,text)
 assert.equal((await request('GET')).username,'qa-authored-457')
 assert.equal(await fs.readFile(target,'utf8'),text)
 stages.push('schema-less read preserves the entire authored text')
 const bad=scope+'/bad-candidate-verified-verified.ts'
 await fs.writeFile(bad,'export default async()=>{throw new Error("Owned read-owner candidate error")}\n',{flag:'wx'})
 const rejected=await request('PATCH',{plugin:[pathToFileURL(bad).href]},400)
 const message=`config.plugin: Plugin module load failed for ${pathToFileURL(bad).href}: Owned read-owner candidate error`
 assert.deepEqual(rejected,{data:{message},error:[{message}],success:false})
 assert.equal(await fs.readFile(target,'utf8'),text)
 stages.push('typed candidate rejection preserves the complete schema-less source')
 const legacy='// Actual migration owner\n'+JSON.stringify({...withoutSchema,username:'qa-legacy-457',permission_mode:'ask',permission:'allow'})
 await fs.writeFile(target,legacy)
 const read=await request('GET'),audit={version:1,source_fields:['permission'],permission_mode:'ask',reason:'explicit_mode'}
 assert.equal(read.username,'qa-legacy-457');assert.equal(read.permission_mode,'ask');assert.deepEqual(read.permission_migration,audit)
 const migrated=await fs.readFile(target,'utf8')
 assert(migrated.startsWith('// Actual migration owner\n'))
 assert.deepEqual(parse(migrated),{...withoutSchema,username:'qa-legacy-457',permission_mode:'ask',permission_migration:audit})
 const saved=await request('PATCH',{username:'qa-committed-457'})
 assert.equal(saved.username,'qa-committed-457');assert.equal(saved.permission_mode,'ask')
 assert.equal(parse(await fs.readFile(target,'utf8')).$schema,'https://opencorvus.ai/config.json')
 stages.push('current writer saves migrated policy and schema in its canonical commit')
}catch(error){failure=error}finally{
 const now=parse(await fs.readFile(target,'utf8')),patch:Record<string,unknown>={...authored}
 for(const key of Object.keys(now))if(!Object.hasOwn(authored,key))patch[key]=null
 await request('PATCH',patch)
 assert.deepEqual(parse(await fs.readFile(target,'utf8')),authored)
 // Restore the original authored formatting only after the domain writer has
 // committed the exact original source and settled its runtime projection.
 await fs.writeFile(target,original)
 const final=await request('GET');assert.equal(final.prompt_profile.active,authored.prompt_profile.active)
 assert.equal(await fs.readFile(target,'utf8'),original);restored=true
 await fs.writeFile(root+'/http-contract-final-verified.json',JSON.stringify({scope:tag,requests,stages,restored,qualification:'Actual public development HTTP; independent original peer-writer race covered by focused tests; not UI/visual acceptance'},null,2),{flag:'wx'})
 console.log(JSON.stringify({requests:requests.length,stages,restored}))
}
if(failure)throw failure
