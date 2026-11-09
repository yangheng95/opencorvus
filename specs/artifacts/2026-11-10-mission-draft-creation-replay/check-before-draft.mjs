import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const root=process.argv[2]
const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),"utf8"))
const launch=await read("before-startup.json")
assert.equal(launch.occurrenceID,"iteration-b156-before")
assert.equal(launch.url,"http://127.0.0.1:39354")
const project=await read("seed.json")
const url=(route)=>launch.url+route+"?"+new URLSearchParams({directory:project.directory})
const text="The saved draft must stay pending for review."
const input={title:"One Mission draft request",request:text,productPillar:"work",expertSquadIDs:["dynamic"]}
async function req(route,body,expected=200){
  const resp=await fetch(url(route),body===undefined?{}:{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
  const data=await resp.json()
  assert.equal(resp.status,expected,JSON.stringify(data))
  return {status:resp.status,requestID:resp.headers.get("x-opencorvus-request-id"),data}
}
const clean=await req("/mission")
assert.deepEqual(clean.data,[])
const serial=[await req("/mission/draft",input),await req("/mission/draft",input)]
const parallelInput={...input,title:"One parallel Mission draft request"}
const parallel=await Promise.all([req("/mission/draft",parallelInput),req("/mission/draft",parallelInput)])
const list=await req("/mission")
assert.equal(list.data.length,4)
assert.equal(new Set([...serial,...parallel].map(x=>x.data.missionID)).size,4)
assert.equal(new Set([...serial,...parallel].map(x=>x.data.sessionID)).size,4)
for (const draft of list.data) {
  assert.equal(draft.directory,project.directory)
  assert.equal(draft.productPillar,"work")
  assert.equal(draft.pendingPrompt.text,text)
}
const evidence={serial,parallel,list}
await fs.writeFile(path.join(root,"before-draft-replays.json"),JSON.stringify(evidence,null,2)+"\n")
console.log(JSON.stringify({serial:serial.map(x=>x.data.missionID),parallel:parallel.map(x=>x.data.missionID),count:list.data.length}))
