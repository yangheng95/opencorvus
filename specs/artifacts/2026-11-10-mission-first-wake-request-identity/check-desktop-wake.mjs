import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
const b=process.argv[2], read=async file=>JSON.parse(await fs.readFile(path.join(b,file),"utf8"))
const source=await read("after-startup.json"), seed=await read("project-mission-wake-seed.json")
assert.equal(source.url,"http://127.0.0.1:39370")
const raw=(await fs.readFile(path.join(b,"desktop-proxy.jsonl"),"utf8")).trim().split("\n").map(JSON.parse)
const desktop=raw.filter(r=>r.route==="/mission/wake")
assert.equal(desktop.length,2)
assert.equal(desktop[0].browserResponse,"truncated after 16 bytes")
assert.equal(desktop[1].browserResponse,"complete")
assert.equal(desktop[0].upstreamStatus,200)
assert.equal(desktop[1].upstreamStatus,200)
assert.deepEqual(desktop[0].sent,desktop[1].sent)
assert.deepEqual(desktop[0].accepted,desktop[1].accepted)
assert.equal(desktop[0].accepted.created,true)
assert.equal(new Set(desktop.map(r=>r.upstreamRequestID)).size,2)
assert.match(desktop[0].sent.requestID,/^[a-f0-9-]{36}$/)
const identity=desktop[0].accepted
const readPublic=async route=>{
  const url=new URL(route,source.url)
  url.searchParams.set("directory",seed.directory)
  const response=await fetch(url)
  assert.equal(response.status,200,await response.clone().text())
  return {status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),data:await response.json()}
}
const [list,history]=await Promise.all([
  readPublic("/mission?search="+encodeURIComponent(desktop[0].sent.text)),
  readPublic("/session/"+identity.sessionID+"/message"),
])
assert.equal(list.data.length,1)
assert.equal(list.data[0].missionID,identity.missionID)
assert.equal(list.data[0].sessionID,identity.sessionID)
const user=history.data.filter(m=>m.info.role==="user")
assert.equal(user.length,1)
assert.equal(user[0].info.extra.wake_reason.requestID,desktop[0].sent.requestID)
assert.deepEqual(user[0].info.model,{providerID:"b158-loopback",modelID:"offline"})
assert.equal(user[0].parts.find(p=>p.type==="text").text,desktop[0].sent.text)
await fs.writeFile(path.join(b,"desktop-wake-acceptance.json"),JSON.stringify({desktop,list,user:user[0]},null,2)+"\n")
console.log(JSON.stringify({identity,requestID:desktop[0].sent.requestID,userMessage:user[0].info.id}))
