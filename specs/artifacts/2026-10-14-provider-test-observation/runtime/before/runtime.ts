import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
const root=path.resolve(process.argv[2]!),uiDirectory=path.resolve(process.argv[3]!),authSource=process.argv[4]!
const backendPort=Number(process.argv[5]),participantPort=Number(process.argv[6]),started=Date.now()
const {installProcessShims}=await import("../packages/opencorvus/src/runtime/shims");installProcessShims()
const {declareNativeTaskProcessDeployment}=await import("../packages/opencorvus/src/runtime/task-process-deployment");declareNativeTaskProcessDeployment()
const {CredentialRedactor,RealProviderAudit,installProcessProviderAudit}=await import("../packages/opencorvus/script/real-provider-audit")
const redactor=new CredentialRedactor()
let writes=Promise.resolve()
const publish=(name:string,data:unknown)=>{const text=redactor.redact(JSON.stringify(data,null,2));writes=writes.then(()=>fs.writeFile(path.join(root,name),text));return writes}
await fs.mkdir(path.join(root,"runtime/data"),{recursive:true})
const {stageDiagnosticProvider}=await import("../packages/opencorvus/script/evolution-diagnostic-provider")
const authority=await stageDiagnosticProvider({authSource,dataDirectory:path.join(root,"runtime/data"),modelID:"gpt-6.1-sol",redactor})
const catalog=JSON.parse(await fs.readFile(path.join(root,"runtime/data/models.json"),"utf8"))
redactor.collect(catalog)
const sampleKey=randomUUID();redactor.collect({key:sampleKey})
const participantRequests:unknown[]=[]
const participant=Bun.serve({hostname:"127.0.0.1",port:participantPort,async fetch(request){
 const url=new URL(request.url)
 const record={method:request.method,path:url.pathname,at:Date.now(),sampleCredentialMatched:request.headers.get("authorization")===`Bearer ${sampleKey}`}
 participantRequests.push(record);await publish("participant-requests.json",participantRequests)
 if(url.pathname==="/api.json")return Response.json(catalog)
 if(url.pathname.endsWith("/models"))return Response.json({data:[{id:"owned-live-model"}]})
 if(url.pathname.endsWith("/model/info"))return Response.json({data:[model("owned-live-model")]})
 return Response.json({error:{message:"Owned real HTTP failure qualification. "+"Endpoint diagnostics remain complete. ".repeat(24),type:"owned_network_failure",code:"OWNED_HTTP_400"}},{status:400})
}})
function model(id:string){return {id,name:id,release_date:"2026-10-14",attachment:false,reasoning:false,temperature:true,tool_call:true,modalities:{input:["text"],output:["text"]},cost:{input:1,output:2},limit:{context:8192,output:512},options:{}}}
const endpoint=(name:string)=>`http://127.0.0.1:${participantPort}/${name}/v1`
const state=installProcessProviderAudit(()=>{
 let audit!:InstanceType<typeof RealProviderAudit>
 const persist=()=>{void publish("provider-audit.json",{pid:process.pid,model:"gpt-6.1-sol",requests:audit.requests})}
 audit=new RealProviderAudit("gpt-6.1-sol",6,persist,{copiedOAuthExpiresAt:authority.copiedOAuthExpiresAt},undefined,{redactor})
 for(const origin of [`http://127.0.0.1:${backendPort}`,`http://127.0.0.1:${participantPort}`,"http://127.0.0.1:1"])audit.localOrigins.add(origin)
 return {audit,persist}
})
const {Log}=await import("../packages/opencorvus/src/util/log");await Log.init({print:false})
const {Config}=await import("../packages/opencorvus/src/config/config")
const {Auth}=await import("../packages/opencorvus/src/auth")
const {Provider}=await import("../packages/opencorvus/src/provider/provider")
const {Instance}=await import("../packages/opencorvus/src/project/instance")
await Config.updateGlobalPatch({model:"openai/gpt-6.1-sol",small_model:"openai/gpt-6.1-sol",provider:{
 openai:{name:"Owned Sol inherited declaration",models:{},whitelist:["gpt-6.1-sol"]},
 "owned-zero":{name:"Owned zero models with saved key",api:endpoint("zero"),models:{}},
 "owned-failure":{name:"Owned complete HTTP failure",api:endpoint("failure"),models:{"owned-failure-model":model("owned-failure-model")}},
 opencorvus:{name:"Owned live model refresh",api:endpoint("product"),models:{},whitelist:["owned-live-model"]}
},prompt_profile:{active:"base"},experimental:{memory:{enabled:false}}})
for(const id of ["owned-zero","owned-failure","opencorvus"])await Auth.set(id,{type:"api",key:sampleKey})
const directory=path.join(root,"project");await fs.mkdir(directory,{recursive:true})
const git=(args:string[])=>{const r=Bun.spawnSync(["git","-C",directory,...args],{stdout:"pipe",stderr:"pipe"});assert.equal(r.exitCode,0,`Owned project Git ${args[0]}`)}
git(["init"]);git(["config","user.name","Owned Provider Test Qualification"]);git(["config","user.email","owned-test@example.invalid"])
await fs.writeFile(path.join(directory,"README.md"),"# Owned Provider Test project\n");git(["add","README.md"]);git(["commit","-m","Owned Provider Test qualification"])
const credential=await Auth.get("openai"),target=await Provider.getModelGlobal("openai","gpt-6.1-sol",await Config.getGlobal())
assert.equal(credential?.type,"oauth");assert.equal(target.api.id,"gpt-6.1-sol")
await publish("authority-ready.json",{pid:process.pid,credential:"available",target:"openai/gpt-6.1-sol",actualProjectedAPIModel:target.api.id,pairedCompleteCatalog:true,catalogProviderCount:Object.keys(catalog).length,executionStarted:false})
const {freezeOverlayUiDirectory}=await import("../packages/opencorvus/src/server/overlay-ui")
const {listenWithRecoveredServerRuntime,settleRecoveringServerRuntime}=await import("../packages/opencorvus/src/cli/server-runtime")
const {recoverStartedTaskExecutions,assertStartedTaskProjectRecoverySucceeded}=await import("../packages/opencorvus/src/engine/host-recovery")
const runtime=await listenWithRecoveredServerRuntime({options:{hostname:"127.0.0.1",port:backendPort,overlayUiSource:freezeOverlayUiDirectory({directory:uiDirectory})},recover:async()=>{const result=await recoverStartedTaskExecutions({scopeProjectWorktree:directory});assertStartedTaskProjectRecoverySucceeded(result)},disposeInstances:()=>Instance.disposeAll()})
await runtime.recovery
await Instance.provide({directory,fn:()=>Instance.project.id})
const {SessionStatus}=await import("../packages/opencorvus/src/session/status")
const preflight=await state.audit.preflight({serverURL:new URL(`http://127.0.0.1:${backendPort}`),model:"openai/gpt-6.1-sol",inactivityMs:180_000,activity:SessionStatus.getActivity})
await publish("preflight-ready.json",{preflight,requestCount:state.audit.requests.length,boundary:"One actual authorized streaming preflight; later Test UI requests separately observed"})
const read=async(route:string)=>{const response=await state.audit.nativeFetch(`http://127.0.0.1:${backendPort}${route}`);assert.equal(response.status,200);return response.json() as Promise<any>}
const projection=await read("/global/providers")
await publish("projection-ready.json",{status:200,providers:projection.catalog.all.filter((p:any)=>["openai","owned-zero","owned-failure","opencorvus"].includes(p.id)).map((p:any)=>({id:p.id,name:p.name,models:Object.keys(p.models),apiKeyConfigured:p.apiKeyConfigured})),connected:projection.catalog.connected})
await publish("ready.json",{pid:process.pid,started,port:runtime.server.port,participantPort:participant.port,project:directory,occurrence:runtime.occurrence,uiDirectory,preflight})
let stopping=false
const stop=async(reason:string)=>{
 if(stopping)return;stopping=true;clearInterval(poll);clearTimeout(deadline)
 try{
  await participant.stop(true)
  const {Server}=await import("../packages/opencorvus/src/server/server")
  const settled=await settleRecoveringServerRuntime({reason,recovery:runtime.recovery,disposeInstances:()=>Instance.disposeAll()})
  await Server.releaseRuntimeHandoff(settled.releaseHandoff);await runtime.server.stop(true)
  const {Database}=await import("../packages/opencorvus/src/storage/db");await Database.awaitEffectIdle(5000);Database.close()
  await Log.close();state.audit[Symbol.dispose]()
  await publish("provider-audit-final.json",{model:"gpt-6.1-sol",requests:state.audit.requests})
  await publish("terminal.json",{pid:process.pid,reason,elapsed:Date.now()-started,normalRuntimeSettlement:true,copiedPairCleanup:"Parent only after actual exit"})
  process.exit(0)
 }catch(error){await publish("shutdown-failure.json",{message:error instanceof Error?error.message:String(error)});process.exit(1)}
}
const poll=setInterval(()=>{void fs.access(path.join(root,"stop-requested")).then(()=>stop("Own Provider Test page completed")).catch(()=>{})},500)
const deadline=setTimeout(()=>void stop("Owned 75 minute lifetime"),4_500_000)
