import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
const b=process.argv[2]
const read=async f=>JSON.parse(await fs.readFile(path.join(b,f),"utf8"))
const launch=await read("after-startup.json"),project=await read("project-wake-sibling-seed.json")
assert.equal(launch.url,"http://127.0.0.1:39370")
const body={text:"Unkeyed independent launch check",productPillar:"work",expertSquadIDs:["dynamic"],model:"b158-loopback/offline"}
const url=new URL("/mission/wake",launch.url)
url.searchParams.set("directory",project.directory)
async function wake(){
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
  assert.equal(r.status,200,await r.clone().text())
  return {status:r.status,requestID:r.headers.get("x-opencorvus-request-id"),data:await r.json()}
}
const launches=await Promise.all([wake(),wake()])
assert.equal(new Set(launches.map(x=>x.data.missionID)).size,2)
assert.equal(new Set(launches.map(x=>x.data.sessionID)).size,2)
await fs.writeFile(path.join(b,"after-unkeyed.json"),JSON.stringify({launches,project:project.directory},null,2)+"\n")
console.log(launches.map(x=>x.data.missionID).join(" "))
