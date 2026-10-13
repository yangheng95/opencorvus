import fs from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
const root=path.resolve(process.argv[2]!),uiDirectory=path.resolve(process.argv[3]!)
const backendPort=Number(process.argv[4]),participantPort=Number(process.argv[5]),started=Date.now()
const {installProcessShims}=await import("../packages/opencorvus/src/runtime/shims");installProcessShims()
const {declareNativeTaskProcessDeployment}=await import("../packages/opencorvus/src/runtime/task-process-deployment");declareNativeTaskProcessDeployment()
const {CredentialRedactor}=await import("../packages/opencorvus/script/real-provider-audit")
const redactor=new CredentialRedactor(),sampleKey=randomUUID();redactor.collect({key:sampleKey})
let writes=Promise.resolve()
const publish=(name:string,value:unknown)=>{writes=writes.then(()=>fs.writeFile(path.join(root,name),redactor.redact(JSON.stringify(value,null,2))));return writes}
const {Log}=await import("../packages/opencorvus/src/util/log");await Log.init({print:false})
const requests:Array<{id:number,method:string,path:string,receivedAt:number,model?:string,streaming?:boolean,initialCredentialMatched?:boolean,respondedAt?:number,status?:number}>=[]
const participant=Bun.serve({hostname:"127.0.0.1",port:participantPort,async fetch(request){
 const url=new URL(request.url)
 if(url.pathname==="/api.json")return Response.json(catalog)
 if(request.method!=="POST")return Response.json({error:{message:"Owned lifecycle participant accepts inference POST only"}},{status:400})
 const body=await request.json() as {model:string,stream:boolean}
 const receipt={id:requests.length+1,method:request.method,path:url.pathname,receivedAt:Date.now(),model:body.model,streaming:body.stream,initialCredentialMatched:request.headers.get("authorization")===`Bearer ${sampleKey}`} as typeof requests[number]
 requests.push(receipt);await publish("participant-requests.json",requests)
 // A bounded real HTTP refusal holds the actual production request in flight.
 // It never simulates model success or qualifies a third-party Provider.
 await Bun.sleep(10_000)
 receipt.respondedAt=Date.now();receipt.status=400;await publish("participant-requests.json",requests)
 return Response.json({error:{message:`Owned lifecycle HTTP refusal ${receipt.id}`,type:"owned_lifecycle_refusal",code:"OWNED_HTTP_400"}},{status:400})
}})
const model=(id:string)=>({id,name:id,release_date:"2026-10-14",attachment:false,reasoning:false,temperature:true,tool_call:true,modalities:{input:["text"],output:["text"]},cost:{input:1,output:2},limit:{context:8192,output:512},options:{}})
const {ModelsDev}=await import("../packages/opencorvus/src/provider/models")
const catalog=structuredClone(await ModelsDev.get())
const ids=["owned-lifecycle-a","owned-lifecycle-b"]
const endpoint=(id:string)=>`http://127.0.0.1:${participantPort}/${id}/v1`
for(const id of ids)catalog[id]={id,name:id,env:[],npm:"@ai-sdk/openai-compatible",api:endpoint(id),models:{[id+"-model"]:model(id+"-model")}}
await fs.mkdir(path.join(root,"runtime/data"),{recursive:true})
await fs.writeFile(path.join(root,"runtime/data/models.json"),JSON.stringify(catalog))
ModelsDev.validateExplicitCatalog(catalog);ModelsDev.Data.reset()
const {Config}=await import("../packages/opencorvus/src/config/config")
const {Auth}=await import("../packages/opencorvus/src/auth")
const {Provider}=await import("../packages/opencorvus/src/provider/provider")
const {Instance}=await import("../packages/opencorvus/src/project/instance")
await Config.updateGlobalPatch({enabled_providers:ids,provider:Object.fromEntries(ids.map(id=>[id,{name:id,api:endpoint(id),models:{}}])),prompt_profile:{active:"base"},experimental:{memory:{enabled:false}}})
for(const id of ids)await Auth.set(id,{type:"api",key:sampleKey})
const projects=[]
for(const label of ["A","B"]){
 const directory=path.join(root,"project-"+label);await fs.mkdir(directory,{recursive:true})
 const git=(args:string[])=>{const r=Bun.spawnSync(["git","-C",directory,...args],{stdout:"pipe",stderr:"pipe"});assert.equal(r.exitCode,0,`Own project ${label} Git ${args[0]}`)}
 git(["init"]);git(["config","user.name","Owned lifecycle qualification"]);git(["config","user.email","owned-lifecycle@example.invalid"])
 await fs.writeFile(path.join(directory,"README.md"),`# Owned lifecycle ${label}\n`);git(["add","README.md"]);git(["commit","-m","Own lifecycle input"])
 await Instance.provide({directory,fn:()=>Instance.project.id});projects.push({label,directory})
}
const {freezeOverlayUiDirectory}=await import("../packages/opencorvus/src/server/overlay-ui")
const {listenWithRecoveredServerRuntime,settleRecoveringServerRuntime}=await import("../packages/opencorvus/src/cli/server-runtime")
const {recoverStartedTaskExecutions,assertStartedTaskProjectRecoverySucceeded}=await import("../packages/opencorvus/src/engine/host-recovery")
const runtime=await listenWithRecoveredServerRuntime({options:{hostname:"127.0.0.1",port:backendPort,overlayUiSource:freezeOverlayUiDirectory({directory:uiDirectory})},recover:async()=>{const r=await recoverStartedTaskExecutions({scopeProjectWorktree:projects[0]!.directory});assertStartedTaskProjectRecoverySucceeded(r)},disposeInstances:()=>Instance.disposeAll()})
await runtime.recovery
const sessions=[]
for(const project of projects){
 const response=await fetch(`http://127.0.0.1:${backendPort}/session?directory=${encodeURIComponent(project.directory)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"assistant",title:"Owned lifecycle "+project.label})})
 assert.equal(response.status,200,"Actual public empty session preparation")
 const session=await response.json() as {id:string,projectID:string,directory:string}
 sessions.push({label:project.label,sessionID:session.id,projectID:session.projectID,directory:session.directory})
}
const projection=await fetch(`http://127.0.0.1:${backendPort}/global/providers`);assert.equal(projection.status,200)
const projected=await projection.json() as any
await publish("ready.json",{pid:process.pid,started,port:backendPort,participantPort,occurrence:runtime.occurrence,uiDirectory,projects,sessions,catalogProviderCount:Object.keys(catalog).length,scope:"Own generated fictional Auth only; complete public repository bootstrap catalog plus two owned entries; no real Provider credential copied",providers:projected.catalog.all.filter((p:any)=>ids.includes(p.id)).map((p:any)=>({id:p.id,models:Object.keys(p.models),apiKeyConfigured:p.apiKeyConfigured}))})
let stopping=false
const stop=async(reason:string)=>{
 if(stopping)return;stopping=true;clearInterval(poll);clearTimeout(deadline)
 try{
  await participant.stop(true)
  const {Server}=await import("../packages/opencorvus/src/server/server")
  const settled=await settleRecoveringServerRuntime({reason,recovery:runtime.recovery,disposeInstances:()=>Instance.disposeAll()})
  await Server.releaseRuntimeHandoff(settled.releaseHandoff);await runtime.server.stop(true)
  const {Database}=await import("../packages/opencorvus/src/storage/db");await Database.awaitEffectIdle(5000);Database.close()
  await Log.close();await publish("terminal.json",{pid:process.pid,reason,elapsed:Date.now()-started,normalRuntimeSettlement:true,requests:requests.length,realSolCalls:0,pairCleanup:"Parent only after actual exit"});process.exit(0)
 }catch(error){await publish("shutdown-failure.json",{message:error instanceof Error?error.message:String(error)});process.exit(1)}
}
const poll=setInterval(()=>{void fs.access(path.join(root,"stop-requested")).then(()=>stop("Root own lifecycle qualification complete")).catch(()=>{})},500)
const deadline=setTimeout(()=>void stop("Owned 75 minute lifetime"),4_500_000)
