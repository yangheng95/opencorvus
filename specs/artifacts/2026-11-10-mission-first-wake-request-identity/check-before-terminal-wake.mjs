import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const b=process.argv[2], read=async file=>JSON.parse(await fs.readFile(path.join(b,file),"utf8"))
const source=await read("before-startup.json"), seed=await read("project-mission-wake-seed.json"), original=await read("before-wake-replays.json")
assert.equal(source.url,"http://127.0.0.1:39368")
const call=async(route,method,body)=>{
  const url=new URL(route,source.url)
  url.searchParams.set("directory",seed.directory)
  const response=await fetch(url,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)})
  return {status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),data:await response.json()}
}
const withTarget={...original.sent.body,missionID:original.one.data.missionID}
const exact=await call("/mission/wake","POST",withTarget)
assert.equal(exact.status,200)
assert.equal(exact.data.sessionID,original.one.data.sessionID)
assert.equal(exact.data.created,false)
const changed=await call("/mission/wake","POST",{...withTarget,text:"Changed input with the same accepted request key."})
assert.equal(changed.status,409)
assert.equal(changed.data.name,"MissionExecutionWakeInputConflictError")
const closed=await call("/mission/"+withTarget.missionID+"/abort","POST",{surface:"api",reason:"Close the isolated first occurrence for terminal replay review"})
assert.equal(closed.status,200)
const terminal=await call("/mission/wake","POST",withTarget)
assert.equal(terminal.status,409)
assert.equal(terminal.data.name,"MissionExecutionWakeClosedError")
const unbound=await call("/mission/wake","POST",original.sent.body)
assert.equal(unbound.status,200)
assert.equal(unbound.data.created,true)
assert.notEqual(unbound.data.sessionID,original.one.data.sessionID)
await fs.writeFile(path.join(b,"before-wake-explicit-and-terminal.json"),JSON.stringify({exact,changed,closed,terminal,unbound},null,2)+"\n")
console.log(JSON.stringify({explicit:exact.status,conflict:changed.status,closed:closed.status,terminal:terminal.status,unbound:unbound.status}))
