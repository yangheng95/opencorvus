import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
const [b,phase]=process.argv.slice(2)
assert.ok(["initial","restart"].includes(phase))
const read=async name=>JSON.parse(await fs.readFile(path.join(b,name),"utf8"))
const launch=await read("after-startup.json")
assert.equal(launch.occurrenceID,"iteration-b158-after")
assert.equal(launch.url,"http://127.0.0.1:39370")
const main=(await read("project-mission-wake-seed.json")).directory
const sibling=(await read("project-wake-sibling-seed.json")).directory
const model="b158-loopback/offline"
const call=async(route,method="GET",body,directory=main,status=200)=>{
  const url=new URL(route,launch.url)
  url.searchParams.set("directory",directory)
  const r=await fetch(url,{method,...(body===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(body)})})
  const data=await r.json(),requestID=r.headers.get("x-opencorvus-request-id")
  assert.equal(r.status,status,JSON.stringify({route,status:r.status,requestID,data}))
  return {status:r.status,requestID,data}
}
const body={text:"Scoped first Mission launch acceptance",productPillar:"work",expertSquadIDs:["dynamic"],model,requestID:"one-b158-first-launch"}
const parallelBody={...body,text:"Parallel first Mission launch acceptance",requestID:"one-b158-parallel-launch"}
const deliberate={...body,text:"A separate first Mission launch intent",requestID:"another-b158-first-launch"}
const wake=(input=body,directory=main,status=200)=>call("/mission/wake","POST",input,directory,status)
const readMessage=async(receipt,directory=main)=>{
  const history=await call("/session/"+receipt.data.sessionID+"/message","GET",undefined,directory)
  const input=history.data.filter(m=>m.info.role==="user")
  assert.equal(input.length,1)
  assert.deepEqual(input[0].info.model,{providerID:"b158-loopback",modelID:"offline"})
  assert.equal(input[0].info.extra.wake_reason.source,"mission.operator")
  return {requestID:history.requestID,user:input[0]}
}
const origin={surface:"api",reason:"Retire only this isolated launch acceptance sample."}
let proof={}
if(phase==="initial"){
  const config=await call("/config","PATCH",{model,provider:{"b158-loopback":{
    name:"Isolated closed loopback",npm:"@ai-sdk/openai-compatible",api:"http://127.0.0.1:1/v1",
    models:{offline:{name:"Offline review",tool_call:true,modalities:{input:["text"],output:["text"]},limit:{context:32000,output:4096}}},
  }}},sibling)
  const current=await call("/config")
  assert.equal(current.data.model,model)
  assert.equal(config.data.model,model)
  const first=await wake()
  const replay=await wake()
  const parallel=await Promise.all([wake(parallelBody),wake(parallelBody)])
  assert.deepEqual(replay.data,first.data)
  assert.deepEqual(parallel[0].data,parallel[1].data)
  assert.equal(first.data.created,true)
  const other=await wake(body,sibling)
  assert.equal(new Set([first,parallel[0],other].map(x=>x.data.sessionID)).size,3)
  assert.equal(new Set([first,parallel[0],other].map(x=>x.data.missionID)).size,3)
  const explicit=await wake({...body,missionID:first.data.missionID})
  assert.deepEqual(explicit.data,{...first.data,created:false})
  const conflict=await wake({...body,text:"This changed input cannot consume the accepted key."},main,409)
  assert.equal(conflict.data.name,"MissionExecutionWakeInputConflictError")
  assert.equal(conflict.data.data.sessionID,first.data.sessionID)
  const messages=await Promise.all([readMessage(first),readMessage(parallel[0]),readMessage(other,sibling)])
  assert.deepEqual(messages.map(x=>x.user.parts.find(p=>p.type==="text").text),[body.text,parallelBody.text,body.text])
  const close=await call("/mission/"+first.data.missionID+"/abort","POST",origin)
  assert.equal(close.data,true)
  const closed=await wake(body,main,409)
  assert.equal(closed.data.name,"MissionExecutionWakeClosedError")
  assert.equal(closed.data.data.sessionID,first.data.sessionID)
  const separate=await wake(deliberate)
  assert.ok(separate.data.created)
  assert.equal(new Set([first,parallel[0],other,separate].map(x=>x.data.sessionID)).size,4)
  const deleted=await call("/mission/"+separate.data.missionID,"DELETE",origin)
  assert.equal(deleted.data,true)
  const gone=await wake(deliberate,main,404)
  assert.equal(gone.data.name,"NotFoundError")
  Object.assign(proof,{first,replay,parallel,other,explicit,conflict,messages,close,closed,separate,deleted,gone,
    selectedModels:{main:current.data.model,sibling:config.data.model}})
}else{
  const last=await read("after-initial.json")
  const [active,other,closed,gone]=await Promise.all([wake(parallelBody),wake(body,sibling),wake(body,main,409),wake(deliberate,main,404)])
  assert.deepEqual(active.data,last.parallel[0].data)
  assert.deepEqual(other.data,last.other.data)
  assert.equal(closed.data.data.closureEventID,last.closed.data.data.closureEventID)
  assert.equal(gone.data.name,last.gone.data.name)
  const messages=await Promise.all([readMessage(active),readMessage(other,sibling)])
  assert.equal(messages[0].user.info.id,last.messages[1].user.info.id)
  assert.equal(messages[1].user.info.id,last.messages[2].user.info.id)
  Object.assign(proof,{active,other,closed,gone,messages})
}
await fs.writeFile(path.join(b,"after-"+phase+".json"),JSON.stringify(proof,null,2)+"\n")
console.log(JSON.stringify({phase,active:proof.first?.data??proof.active.data,parallel:proof.parallel?.map(x=>x.data.sessionID),closed:proof.closed.status,gone:proof.gone.status}))
