import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const root=process.argv[2], url="http://127.0.0.1:39356"
const seed=JSON.parse(await fs.readFile(path.join(root,"seed.json"),"utf8"))
const launch=JSON.parse(await fs.readFile(path.join(root,"after-startup.json"),"utf8"))
assert.equal(launch.url,url)
const before=JSON.parse(await fs.readFile(path.join(root,"before-draft-replays.json"),"utf8"))
const [remove,stop]=before.serial.map(r=>r.data)
const req=async (route,method,record)=>{
  assert.equal(record.directory,seed.directory)
  const dest=new URL("/mission/"+record.missionID+route,url)
  dest.searchParams.set("directory",seed.directory)
  const response=await fetch(dest,{method,headers:{"content-type":"application/json"},body:JSON.stringify({surface:"api",reason:"Check a disposable version 11 draft after version 12 migration"})})
  return {status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),body:await response.json(),missionID:record.missionID,sessionID:record.sessionID}
}
const [oldDelete,oldAbort]=await Promise.all([req("","DELETE",remove),req("/abort","POST",stop)])
await fs.writeFile(path.join(root,"retention-initial-failures.json"),JSON.stringify({oldDelete,oldAbort},null,2)+"\n")
console.log(JSON.stringify({oldDelete,oldAbort}))
