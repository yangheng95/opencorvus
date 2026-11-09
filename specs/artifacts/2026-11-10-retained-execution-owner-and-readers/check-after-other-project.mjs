import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
const b=process.argv[2], read=async file=>JSON.parse(await fs.readFile(file,"utf8"))
const source=await read(path.join(b,"after-startup.json"))
assert.equal(source.url,"http://127.0.0.1:39366")
const seed=await read(path.join(path.dirname(b),"opencorvus-iteration-20261110-b156","seed-other.json"))
const prior=await read(path.join(path.dirname(b),"opencorvus-iteration-20261110-b156","after-initial.json"))
const body={requestID:"b157-after-restart-other-project-delete",title:"Disposable sibling after restart",request:"Isolated receipt proof.",expertSquadIDs:["dynamic"],productPillar:"work"}
async function call(route,method="GET",input){
  const url=new URL(route,source.url)
  url.searchParams.set("directory",seed.directory)
  const r=await fetch(url,{method,...(input?{headers:{"content-type":"application/json"},body:JSON.stringify(input)}:{})})
  return {status:r.status,requestID:r.headers.get("x-opencorvus-request-id"),data:await r.json()}
}
const peer=prior.otherProject.body??prior.otherProject.data
const old=await call("/mission")
assert.equal(old.status,200)
assert.ok(old.data.some(x=>x.sessionID===peer.sessionID))
const target=await call("/mission/draft","POST",body)
assert.equal(target.status,200)
assert.equal(target.data.directory,seed.directory)
const closed=await call("/mission/"+target.data.missionID,"DELETE",{surface:"api",reason:"Retire only this verified sibling test draft"})
assert.equal(closed.status,200)
assert.equal(closed.data,true)
const retained=await call("/mission")
assert.equal(retained.status,200)
assert.ok(retained.data.some(x=>x.sessionID===peer.sessionID))
await fs.writeFile(path.join(b,"after-other-project.json"),JSON.stringify({old,target,closed,retained},null,2)+"\n")
console.log(JSON.stringify({project:seed.directory,initialDelete:closed.status,siblingStillVisible:peer.sessionID}))
