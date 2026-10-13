import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
const root = path.resolve(process.argv[2]!)
const uiDirectory = process.argv[3]!
const started = Date.now()
const sampleKey = randomUUID()
const { installProcessShims } = await import("../packages/opencorvus/src/runtime/shims")
installProcessShims()
const { Log } = await import("../packages/opencorvus/src/util/log")
await Log.init({ print: false })
const requests: unknown[] = []
const model = (id: string) => ({ id, name: id, release_date: "2026-10-13", attachment: false, reasoning: false, temperature: true, tool_call: true, modalities: { input: ["text"], output: ["text"] }, cost: { input: 1, output: 2 }, limit: { context: 10000, output: 1000 }, options: {} })
const participant = Bun.serve({hostname:"127.0.0.1",port:18603,fetch(request){
  const url=new URL(request.url)
  if(url.pathname==='/api.json'){requests.push({method:request.method,path:url.pathname,status:200,boundary:'Owned registry participant'});fs.writeFileSync(path.join(root,'participant-requests.json'),JSON.stringify(requests,null,2));return Response.json(catalog)}
  const prefix=url.pathname.split('/')[1]!
  const matches=request.headers.get('authorization')===`Bearer ${sampleKey}`
  const ids=prefix==='project' ? ['project-discovered-a','project-discovered-b'] : prefix==='product-project' ? ['project-live-a'] : prefix==='product-global' ? ['global-live-a','global-live-b'] : prefix==='ready' ? ['ready-known'] : ['global-discovered-a','global-discovered-b']
  const status=matches?200:401
  requests.push({method:request.method,path:url.pathname,status,sampleCredentialMatched:matches})
  fs.writeFileSync(path.join(root,'participant-requests.json'),JSON.stringify(requests,null,2))
  if(!matches)return Response.json({error:'Owned sample credential required'}, {status})
  return Response.json({data:url.pathname.endsWith('/model/info')?ids.map(model):ids.map(id=>({id}))})
}})
const endpoint=(prefix:string)=>new URL(`${prefix}/v1`,participant.url).href.replace(/\/$/,'')
const catalog={openai:{id:'openai',name:'OpenAI OAuth only',env:['OPENAI_API_KEY'],npm:'@ai-sdk/openai',api:endpoint('openai'),models:{}},opencorvus:{id:'opencorvus',name:'OpenCorvus',env:[],npm:'@ai-sdk/openai-compatible',api:endpoint('product-global'),models:{}},kilo:{id:'kilo',name:'Kilo Gateway',env:[],npm:'@ai-sdk/openai-compatible',api:endpoint('kilo'),models:{}},'owned-inherited':{id:'owned-inherited',name:'Inherited catalog',env:[],npm:'@ai-sdk/openai-compatible',api:endpoint('inherited'),models:{'catalog-one':model('catalog-one'),'catalog-two':model('catalog-two')}}}
fs.mkdirSync(path.join(root,'runtime','data'),{recursive:true})
fs.writeFileSync(path.join(root,'runtime','data','models.json'),JSON.stringify(catalog,null,2))
const { ModelsDev }=await import('../packages/opencorvus/src/provider/models')
ModelsDev.validateExplicitCatalog(catalog)
const { Config }=await import('../packages/opencorvus/src/config/config')
const { Auth }=await import('../packages/opencorvus/src/auth')
await Config.updateGlobalPatch({provider:{
'owned-bootstrap':{name:'Saved key before models',api:endpoint('global'),models:{}},
'owned-empty':{name:'No API key configured',api:endpoint('empty'),models:{}},
'owned-configzero':{name:'Config key without models',api:endpoint('config'),options:{apiKey:sampleKey},models:{}},
'owned-ready':{name:'Known model provider',api:endpoint('ready'),models:{'ready-known':model('ready-known')}},
'owned-env':{name:'Single environment key',api:endpoint('env'),env:['OWNED_PROVIDER_API_KEY'],models:{}},
'owned-absent':{name:'API-only declaration',api:endpoint('absent'),env:['OWNED_ABSENT_KEY'],options:{timeout:42000}},
'owned-models-only':{name:'Models-only declaration',models:{}},
'owned-inherited':{name:'Inherited declaration',api:endpoint('inherited'),models:{}},
'owned-clear':{name:'Clear custom declaration',api:endpoint('clear'),models:{'custom-one':{...model('custom-one'),name:'Custom metadata',tool_call:false}}},
'owned-referenced':{name:'Referenced declaration',api:endpoint('ref'),models:{'reference-one':model('reference-one')}},
'owned-overlap':{name:'Global overlay base',api:endpoint('overlap'),models:{'shared-one':{...model('shared-one'),name:'Global shared metadata'}}}
},prompt_profile:{active:'base'},experimental:{memory:{enabled:false}}})
for(const id of ['owned-bootstrap','owned-ready','opencorvus','owned-inherited','owned-clear','owned-referenced','owned-overlap'])await Auth.set(id,{type:'api',key:sampleKey})
await Auth.set('openai',{type:'oauth',access:randomUUID(),refresh:randomUUID(),expires:Date.now()+3_600_000})
const directory=path.join(root,'project')
fs.mkdirSync(directory,{recursive:true})
const git=(args:string[])=>{const r=Bun.spawnSync(['git','-C',directory,...args],{stdout:'pipe',stderr:'pipe'});if(r.exitCode!==0)throw Error(`Owned project Git ${args[0]} exit ${r.exitCode}`)}
git(['init']);git(['config','user.name','Owned discovery qualification']);git(['config','user.email','owned-discovery@example.invalid'])
fs.writeFileSync(path.join(directory,'README.md'),'# Owned discovery project\n');git(['add','README.md']);git(['commit','-m','Owned discovery qualification'])
fs.mkdirSync(path.join(directory,'.opencorvus'),{recursive:true})
fs.writeFileSync(path.join(directory,'.opencorvus','opencorvus.jsonc'),JSON.stringify({provider:{'owned-bootstrap':{api:endpoint('project')},'owned-project-absent':{name:'Project API-only',api:endpoint('project'),env:['OWNED_PROJECT_KEY'],options:{timeout:41000}},'owned-project-models-only':{name:'Project models-only',models:{}},'owned-project-clear':{name:'Project clear',api:endpoint('project'),models:{'project-custom-one':{...model('project-custom-one'),name:'Project metadata',tool_call:false}}},'owned-overlap':{models:{'shared-one':{name:'Project shared override'}}},opencorvus:{api:endpoint('product-project'),whitelist:['owned-filtered-model']}}},null,2))
const { Instance }=await import('../packages/opencorvus/src/project/instance')
const { freezeOverlayUiDirectory }=await import('../packages/opencorvus/src/server/overlay-ui')
const { listenWithRecoveredServerRuntime }=await import('../packages/opencorvus/src/cli/server-runtime')
const { recoverStartedTaskExecutions,assertStartedTaskProjectRecoverySucceeded }=await import('../packages/opencorvus/src/engine/host-recovery')
const runtime=await listenWithRecoveredServerRuntime({options:{hostname:'127.0.0.1',port:18602,overlayUiSource:freezeOverlayUiDirectory({directory:uiDirectory})},recover:async()=>{const r=await recoverStartedTaskExecutions({scopeProjectWorktree:directory});assertStartedTaskProjectRecoverySucceeded(r)},disposeInstances:()=>Instance.disposeAll()})
await runtime.recovery
await Instance.provide({directory,fn:()=>Instance.project.id})
const read=async(route:string,body?:unknown)=>{const r=await fetch(`http://127.0.0.1:18602${route}`,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}}
const projectSuffix=`?directory=${encodeURIComponent(directory)}`
const summarize=(catalog:any)=>({connected:catalog.connected,issues:catalog.issues,providers:catalog.all.map((p:any)=>({id:p.id,models:Object.keys(p.models),apiKeyConfigured:typeof p.apiKeyConfigured==='boolean'?p.apiKeyConfigured:'unknown',rawKeyPresent:typeof p.key==='string'&&p.key.trim().length>0}))})
const globalProjection=await read('/global/providers')
const projectProjection=await read('/provider'+projectSuffix)
const outcomes={globalCatalog:{status:globalProjection.status,body:summarize(globalProjection.body.catalog)},projectCatalog:{status:projectProjection.status,body:summarize(projectProjection.body)},globalSavedZero:await read('/global/providers/discover-models',{api:endpoint('global'),providerID:'owned-bootstrap'}),projectSavedZero:await read('/provider/discover-models'+projectSuffix,{api:endpoint('project'),providerID:'owned-bootstrap'})}
fs.writeFileSync(path.join(root,'outcomes.json'),JSON.stringify({boundary:'Production HTTP with isolated generated sample Auth and own registry/model participant; key bytes excluded; no online inference',outcomes},null,2))
fs.writeFileSync(path.join(root,'ready.json'),JSON.stringify({pid:process.pid,started,port:runtime.server.port,participantPort:participant.port,project:directory,endpoints:{global:endpoint('global'),project:endpoint('project')},occurrence:runtime.occurrence},null,2))
let stopping=false
let poll:ReturnType<typeof setInterval>
let deadline:ReturnType<typeof setTimeout>
const stop=async(reason:string)=>{if(stopping)return;stopping=true;clearInterval(poll);clearTimeout(deadline);try{await participant.stop(true);const { Server }=await import('../packages/opencorvus/src/server/server');const { settleRecoveringServerRuntime }=await import('../packages/opencorvus/src/cli/server-runtime');const settled=await settleRecoveringServerRuntime({reason,recovery:runtime.recovery,disposeInstances:()=>Instance.disposeAll()});await Server.releaseRuntimeHandoff(settled.releaseHandoff);await runtime.server.stop(true);fs.writeFileSync(path.join(root,'terminal.json'),JSON.stringify({pid:process.pid,reason,elapsed:Date.now()-started,productionStop:'settled'},null,2));await Log.close();process.exit(0)}catch(e){console.error(e);process.exit(1)}}
poll=setInterval(()=>{if(fs.existsSync(path.join(root,'stop-requested')))void stop('Own discovery page completed')},500)
deadline=setTimeout(()=>void stop('Owned 90min lifetime'),5400000)
