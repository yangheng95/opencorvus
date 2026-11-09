
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root]=process.argv.slice(2)
const get=async(name)=>JSON.parse(await fs.readFile(path.join(root,name),"utf8"))
const launch=await get("after-startup.json")
const {directory}=await get("desktop-config.json")
const observations=(await fs.readFile(path.join(root,"desktop-catalog-proxy.jsonl"),"utf8")).trim().split(/\r?\n/).map(JSON.parse)
const sends=observations.filter(x=>x.receipt)
const catalog=observations.find(x=>x.kind==="catalog-changed-between-attempts")
assert.equal(sends.length,2)
assert.deepEqual(catalog.projection,["b159-current"])
assert.equal(catalog.changeStatus,200)
assert.deepEqual(sends.map(x=>x.upstreamStatus),[200,200])
assert.deepEqual(sends[0].sent,sends[1].sent)
assert.deepEqual(sends[0].accepted,sends[1].accepted)
assert.notEqual(sends[0].upstreamRequestID,sends[1].upstreamRequestID)
assert.equal(sends[0].browserResponse,"truncated after 16 bytes")
assert.equal(sends[1].browserResponse,"complete")
assert.equal(sends[0].sent.model,"b159-retired/offline")
assert.ok(Date.parse(sends[0].time)<=Date.parse(catalog.time) && Date.parse(catalog.time)<=Date.parse(sends[1].time))
const {sessionID,missionID}=sends[0].accepted
const call=async(route,options={})=>{
  const u=new URL(route,launch.url)
  u.searchParams.set("directory",directory)
  const r=await fetch(u,options)
  assert.equal(r.status,200)
  return r.json()
}
const input=sends[0].sent
const replay=await call("/mission/wake",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)})
assert.deepEqual(replay,sends[0].accepted)
const all=await call("/session/"+sessionID+"/message")
const users=all.filter(x=>x.info.role==="user")
const replies=all.filter(x=>x.info.role==="assistant")
assert.equal(users.length,1)
assert.equal(replies.length,1)
assert.deepEqual(users[0].info.model,{providerID:"b159-retired",modelID:"offline"})
assert.equal(users[0].info.extra.wake_reason.requestID,input.requestID)
assert.equal(users[0].info.extra.wake_reason.missionID,missionID)
assert.equal(users[0].parts.find(x=>x.type==="text").text,input.text)
assert.equal(replies[0].info.parentID,users[0].info.id)
assert.ok(replies[0].info.time.completed)
const fresh=await call("/mission/wake",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
    ...input,text:"A new desktop project Mission is accepted with the current model",
    model:"b159-current/offline",requestID:"b159-desktop-current-new"
  })
})
assert.notEqual(fresh.sessionID,sessionID)
const freshUser=(await call("/session/"+fresh.sessionID+"/message")).find(x=>x.info.role==="user")
assert.deepEqual(freshUser.info.model,{providerID:"b159-current",modelID:"offline"})
const result={sends,catalog,replay,user:{id:users[0].info.id,model:users[0].info.model,openedEventID:users[0].info.extra.wake_reason.openedEventID},
  assistant:{id:replies[0].info.id,parentID:replies[0].info.parentID,error:replies[0].info.error?.name},fresh:{...fresh,userMessageID:freshUser.info.id,model:freshUser.info.model}}
await fs.writeFile(path.join(root,"desktop-acceptance.json"),JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify({sessionID,originalUser:result.user.id,originalAssistant:result.assistant.id,currentSession:fresh.sessionID}))
