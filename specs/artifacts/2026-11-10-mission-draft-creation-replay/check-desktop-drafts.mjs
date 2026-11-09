import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const root=process.argv[2]
const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),"utf8"))
const clean=await read("clean-startup.json"), migrated=await read("after-startup.json")
assert.equal(clean.occurrenceID,"iteration-b156-clean")
assert.equal(clean.url,"http://127.0.0.1:39360")
assert.equal(migrated.occurrenceID,"iteration-b156-after")
assert.equal(migrated.url,"http://127.0.0.1:39356")
const desktop=(await fs.readFile(path.join(root,"clean-browser-proxy.jsonl"),"utf8")).trim().split("\n").map(line=>JSON.parse(line)).filter(row=>row.route==="/mission/draft")
assert.equal(desktop.length,2)
assert.equal(desktop[0].browserResponse,"truncated after 16 bytes")
assert.equal(desktop[1].browserResponse,"complete")
assert.deepEqual(desktop[0].sent,desktop[1].sent)
assert.deepEqual(desktop[0].accepted,desktop[1].accepted)
assert.equal(desktop[0].upstreamStatus,200)
assert.equal(desktop[1].upstreamStatus,200)
assert.equal(new Set(desktop.map(row=>row.upstreamRequestID)).size,2)
assert.ok(desktop[0].sent.requestID)
const call=async(base,route)=>{
  const response=await fetch(base+route)
  return {status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),body:await response.json()}
}
const [list,ledger]=await Promise.all([call(clean.url,"/mission?limit=50"),call(clean.url,"/work-ledger?limit=80")])
assert.equal(list.status,200)
assert.equal(list.body.length,1)
assert.equal(list.body[0].missionID,desktop[0].accepted.missionID)
assert.equal(list.body[0].sessionID,desktop[0].accepted.sessionID)
assert.equal(list.body[0].pendingPrompt.text,desktop[0].sent.request)
assert.equal(list.body[0].boardLane,"backlog")
assert.equal(ledger.status,200)
const row=ledger.body.rows.find(x=>x.kind==="mission")
assert.equal(row.sessionID,desktop[0].accepted.sessionID)
const [globalList,globalLedger,archive]=await Promise.all([
  call(migrated.url,"/mission?limit=50"),call(migrated.url,"/work-ledger?limit=80"),call(migrated.url,"/work-ledger/archive?limit=80"),
])
assert.equal(globalList.status,404)
assert.equal(globalLedger.status,404)
assert.match(globalList.body.data.message,/Session not found:/)
assert.equal(globalList.body.data.message,globalLedger.body.data.message)
await fs.writeFile(path.join(root,"clean-desktop-draft-acceptance.json"),JSON.stringify({desktop,list,ledger},null,2)+"\n")
await fs.writeFile(path.join(root,"retention-reader-receipts.json"),JSON.stringify({globalList,globalLedger,archive},null,2)+"\n")
console.log(JSON.stringify({desktop:desktop[0].accepted,list:list.status,ledger:ledger.status,retainedDelete:{missionList:globalList.status,workLedger:globalLedger.status,archive:archive.status}}))
