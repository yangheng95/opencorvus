import fs from "node:fs/promises"
import path from "node:path"
const run="C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/active-return-302-live-02"
const out="D:/myhexin-local/opencorvus/.tmp-product-iteration/active-return-302/live-02"
const phase=process.argv[2]
if(!phase || !/^[a-z0-9-]+$/.test(phase))throw Error("Exact observation phase required")
const owner=JSON.parse(await fs.readFile(path.join(run,"launch-owner.json"),"utf8"))
const selected=JSON.parse(await fs.readFile(path.join(run,"task-selection.json"),"utf8"))
if(owner.occurrence!==selected.occurrence)throw Error("Actual Task ownership required")
const controller=new AbortController()
const timeout=setTimeout(()=>controller.abort(new Error("Backend snapshot observation deadline")),15000)
const startedAt=new Date().toISOString()
const base=`http://127.0.0.1:${owner.port}/task/${encodeURIComponent(selected.taskID)}`
let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
try {
 const query=new URLSearchParams({directory:selected.directory,tail_limit:"120"})
 const response=await fetch(`${base}/conversation?${query}`,{signal:controller.signal})
 if(!response.ok)throw Error(`Actual hydration HTTP ${response.status}`)
 const snapshot:any=await response.json()
 const replayQuery=new URLSearchParams({directory:selected.directory,after:String(snapshot.lastSequence),after_live:"0"})
 const stream=await fetch(`${base}/events?${replayQuery}`,{signal:controller.signal})
 if(!stream.ok || !stream.body)throw Error(`Actual stream HTTP ${stream.status}`)
 reader=stream.body.getReader()
 const decoder=new TextDecoder()
 let buffered=""
 const events:any[]=[]
 outer: for(;;){
  const {done,value}=await reader.read()
  if(done)throw Error("Actual stream ended before task.connected")
  buffered=(buffered+decoder.decode(value,{stream:true})).replace(/\r\n/g,"\n")
  for(;;){
   const split=buffered.indexOf("\n\n")
   if(split<0)break
   const frame=buffered.slice(0,split);buffered=buffered.slice(split+2)
   const data=frame.split("\n").filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trimStart()).join("\n")
   if(!data)continue
   const event=JSON.parse(data);events.push(event)
   if(event.type==="task.connected")break outer
  }
 }
 const parts=snapshot.transcript.flatMap((message:any)=>message.parts.filter((part:any)=>part.type==="text").map((part:any)=>({
  messageID:message.info.id,role:message.info.role,completedAt:message.info.time?.completed,part,
 })))
 const textFrames=events.filter(event=>event.type==="message.part.updated").flatMap(event=>{
  const part=(event.properties??event.payload)?.part
  if(part?.type!=="text")return[]
  const baseline=parts.find((entry:any)=>entry.part.id===part.id&&entry.part.sessionID===part.sessionID)
  return[{sequence:event.live_sequence,epoch:event.live_epoch,partID:part.id,messageID:part.messageID,text:part.text,
   baseline:baseline?{role:baseline.role,completedAt:baseline.completedAt,text:baseline.part.text}:undefined}]
 })
 const result={startedAt,observedAt:new Date().toISOString(),occurrence:owner.occurrence,selected,request:{snapshotQuery:query.toString(),streamQuery:replayQuery.toString()},snapshot,events,textFrames,
  boundary:"Actual normal backend HTTP snapshot followed by the same after/after_live=0 stream contract used by first UI selection. No messages/model calls or browser automation; Root separately observes the real page."}
 await fs.writeFile(path.join(out,`${phase}-bootstrap.json`),JSON.stringify(result,null,2)+"\n",{flag:"wx"})
 console.log(JSON.stringify({phase,events:events.length,textFrames:textFrames.map(frame=>({sequence:frame.sequence,partID:frame.partID,chars:frame.text.length,baselineChars:frame.baseline?.text.length,completedAt:frame.baseline?.completedAt,sameText:frame.baseline?frame.text===frame.baseline.text:undefined}))}))
} finally {clearTimeout(timeout);await reader?.cancel().catch(()=>undefined);controller.abort()}
