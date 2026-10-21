import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {resolveOwnedStreamAction} from './network-action'

export function installNativeTaskStreamObserver(input:{evidence:string;port:number;occurrence:string;taskID:string|(()=>string);allowedActions:string[];mode:'native-idle'|'response-error'}) {
 const target=path.resolve(input.evidence),control=path.join(target,'network-arm.json'),log=path.join(target,'network-events.jsonl')
 assert(path.isAbsolute(input.evidence));assert([18949,18951,18953].includes(input.port))
 const selectedTaskID=()=>typeof input.taskID==='function'?input.taskID():input.taskID
 const original=Bun.serve.bind(Bun),active=new Map<string,{request:Request;server:any;requestID?:string;ready:boolean;taskID:string;closeTransport?:()=>void}>(),consumed=new Set<string>()
 const fact=(kind:string,value:Record<string,unknown>)=>fs.appendFileSync(log,JSON.stringify({at:new Date().toISOString(),pid:process.pid,occurrence:input.occurrence,kind,...value})+'\n')
 const publishActive=()=>fs.writeFileSync(path.join(target,'network-active.json'),JSON.stringify({at:new Date().toISOString(),active:[...active].map(([id,v])=>({id,requestID:v.requestID,ready:v.ready,aborted:v.request.signal.aborted}))},null,2)+'\n')
 Bun.serve=((options:any)=>{
  if(Number(options.port)!==input.port)return original(options)
  const fetch=options.fetch
  return original({...options,async fetch(this:any,...args:any[]){
   const [request,server]=args as [Request,any],url=new URL(request.url)
   const taskID=selectedTaskID()
   if(url.pathname!==`/task/${taskID}/events`)return Reflect.apply(fetch,this,args)
   const id=randomUUID(),record:{request:Request;server:any;ready:boolean;requestID?:string;taskID:string;closeTransport?:()=>void}={request,server,ready:false,requestID:undefined,taskID};active.set(id,record)
   fact('request',{id,path:url.pathname,query:Object.fromEntries(url.searchParams),peer:server.requestIP(request),serverPort:server.port})
   request.signal.addEventListener('abort',()=>{fact('native-request-abort',{id,requestID:record.requestID});active.delete(id);publishActive()},{once:true})
   try{
    const response=await Reflect.apply(fetch,this,args) as Response
    record.requestID=response.headers.get('x-opencorvus-request-id')??undefined
    record.ready=response.status===200&&Boolean(response.headers.get('content-type')?.startsWith('text/event-stream'))
    fact('response',{id,requestID:record.requestID,status:response.status,contentType:response.headers.get('content-type'),contentEncoding:response.headers.get('content-encoding')});publishActive()
    if(input.mode!=='response-error'||!record.ready||!response.body)return response
    const bridge=new TransformStream<Uint8Array,Uint8Array>({start(controller){record.closeTransport=()=>controller.error(new Error('Owned diagnostic HTTP response stream interruption'))}})
    void response.body.pipeTo(bridge.writable).then(()=>{
     fact('original-response-pipe-completed',{id,requestID:record.requestID});active.delete(id);publishActive()
    },error=>{
     fact('original-response-pipe-cancellation-settled',{id,requestID:record.requestID,type:error instanceof Error?error.name:'unknown'});active.delete(id);publishActive()
    })
    return new Response(bridge.readable,response)
   }catch(error){active.delete(id);publishActive();fact('fetch-error',{id,type:error instanceof Error?error.name:'unknown'});throw error}
  }})
 }) as typeof Bun.serve
 const timer=setInterval(()=>{
  if(!fs.existsSync(control))return
  let action:any
  try{
   const info=fs.lstatSync(control);assert(info.isFile()&&!info.isSymbolicLink())
   action=JSON.parse(fs.readFileSync(control,'utf8'))
   const admission=resolveOwnedStreamAction(action,{selectedTaskID:selectedTaskID(),allowedActions:input.allowedActions,consumed,mode:input.mode})
   if(admission.kind==='retired')return
   const pair=[...active].find(([,v])=>v.taskID===action.taskID&&v.ready&&!v.request.signal.aborted)
   if(!pair)return
   consumed.add(action.name)
   const [id,entry]=pair
   if(input.mode==='native-idle'){
    entry.server.timeout(entry.request,1)
    fact('native-idle-timeout-applied',{name:action.name,id,requestID:entry.requestID,seconds:1})
   }else{
    assert(entry.closeTransport)
    fact('response-transport-error-applied',{name:action.name,id,requestID:entry.requestID,taskID:entry.taskID});entry.closeTransport()
   }
   publishActive()
  }catch(error){if(action?.name)consumed.add(action.name);fact('control-error',{name:action?.name,type:error instanceof Error?error.name:'unknown',message:error instanceof Error?error.message:String(error)})}
 },250)
 timer.unref()
 fact('observer-installed',{port:input.port,taskID:selectedTaskID(),actions:input.allowedActions,mode:input.mode,transport:input.mode==='native-idle'?'Original native Request/Response unchanged;actual per-request idle timeout':'Original response bytes pass through identity TransformStream;controlled stream error only on finite declared action'})
}
