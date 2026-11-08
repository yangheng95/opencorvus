import fs from "node:fs/promises"
import assert from "node:assert/strict"
import Ajv2020 from "D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"
import { WorkLedgerEvent } from "D:/myhexin-local/opencorvus/packages/transport-protocol/src/index.ts"
const [phase,port]=process.argv.slice(2)
if(phase!=="before"&&phase!=="after")throw new Error("Expected owned before/after phase")
const root="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b39"
const projects=JSON.parse(await fs.readFile(`${root}/${phase}-projects.json`,"utf8")).projects
const target=projects.find((p:any)=>p.name==="李四")
assert.ok(target)
const base=`http://127.0.0.1:${port}`
const controller=new AbortController()
const timer=setTimeout(()=>controller.abort(new Error("Owned metadata observer deadline reached")),25_000)
let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
let buffer=""
const decoder=new TextDecoder()
const events:any[]=[]
const record:any={phase,date:new Date().toISOString(),target,qualification:"A separate actual SSE checker client; browser interaction is manual. No UI interception, Session, model or credentials."}
try {
 const doc=await(await fetch(`${base}/doc`,{signal:controller.signal})).json() as any
 const schema=doc.paths["/project/{projectID}"].patch.responses["200"].content["application/json"].schema
 const validate=new Ajv2020({strict:false,allErrors:true,validateFormats:false}).compile({...schema,components:doc.components})
 const stream=await fetch(`${base}/work-ledger/events`,{signal:controller.signal,headers:{"x-opencorvus-directory":projects[0].worktree}})
 assert.equal(stream.status,200)
 assert.ok(stream.body)
 reader=stream.body.getReader()
 const readUntil=async(predicate:(event:any)=>boolean)=>{
  while(true){
   let boundary=buffer.indexOf("\n\n")
   if(boundary<0){const next=await reader!.read();if(next.done)throw new Error("Metadata stream ended before target event");buffer=(buffer+decoder.decode(next.value,{stream:true})).replaceAll("\r\n","\n");continue}
   const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2)
   const data=frame.split("\n").filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trimStart()).join("\n")
   if(!data)continue
   const event=WorkLedgerEvent.parse(JSON.parse(data));events.push(event)
   if(predicate(event))return event
  }
 }
 record.connected=await readUntil(event=>event.type==="work-ledger.connected")
 const response=await fetch(`${base}/project/${encodeURIComponent(target.id)}`,{method:"PATCH",signal:controller.signal,headers:{"Content-Type":"application/json","x-opencorvus-directory":target.worktree},body:JSON.stringify({name:"Beta"})})
 const body=await response.json() as any
 record.response={status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),body}
 assert.equal(response.status,200)
 assert.equal(validate(body),true,JSON.stringify(validate.errors))
 assert.equal(body.id,target.id)
 assert.equal(body.name,"Beta")
 assert.equal(body.worktree,target.worktree)
 record.event=await readUntil(event=>event.type==="work-ledger.changed"&&event.sourceType==="project.updated"&&event.projectID===target.id&&event.sequence===body.time.updated)
 assert.equal(record.event.directory,target.worktree)
 record.events=events
 record.schemaValid=true
 record.actualPublishedUpdateMatchesReceipt=true
 await fs.writeFile(`${root}/${phase}-rename-sse-response.json`,JSON.stringify(record,null,2)+"\n")
 console.log(JSON.stringify({phase,status:response.status,requestID:record.response.requestID,projectID:target.id,name:body.name,event:record.event,schemaValid:true}))
} catch(error) {
 record.events=events
 record.failure=error instanceof Error?{name:error.name,message:error.message}:String(error)
 await fs.writeFile(`${root}/${phase}-rename-sse-failed.json`,JSON.stringify(record,null,2)+"\n")
 throw error
} finally {
 clearTimeout(timer)
 await reader?.cancel().catch(()=>{})
 controller.abort()
}
