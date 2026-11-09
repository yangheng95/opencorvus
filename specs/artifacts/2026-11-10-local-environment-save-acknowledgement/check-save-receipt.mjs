import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root] = process.argv.slice(2)
const read = async name => JSON.parse(await fs.readFile(path.join(root,name),"utf8"))
const seed = await read("seed.json")
const after = seed.after
const launch = await read("after-startup.json")
const chat = await read("after-chat.json")
assert.equal(chat.directory,after.directory)
const headers={"x-opencorvus-directory":after.directory}
const config=await fetch(launch.url+"/config",{headers})
assert.equal(config.status,200)
const saved=await config.json()
const file=await read(path.join("project-after",".opencorvus","opencorvus.jsonc"))
const expected={
  name: "Save acknowledgement review",
  variables: {
    OPENCORVUS_REVIEW_RECEIPT: "newer-writer-wins",
    OPENCORVUS_REVIEW_UNTOUCHED: "externally-updated-final",
    OPENCORVUS_REVIEW_EXTERNAL: "added-outside",
    OPENCORVUS_REVIEW_EXTERNAL_FINAL: "added-outside-final",
  },
}
assert.deepEqual(saved.local_environment,expected)
assert.deepEqual(file.local_environment,expected)
assert.equal(saved.locale,"en-US")
assert.equal(file.locale,"en-US")
const traces={}
for(const [phase,value] of [["match","final-candidate-saved-receipt"],["different","candidate-draft-diverges"]]){
  const lines=(await fs.readFile(path.join(root,"after-"+phase+"-proxy.jsonl"),"utf8")).trim().split("\n").map(line=>JSON.parse(line))
  const writes=lines.filter(line=>line.method==="PATCH")
  assert.equal(writes.length,1)
  assert.deepEqual([writes[0].upstreamStatus,writes[0].sentReviewValue,writes[0].acceptedReviewValue],[200,value,value])
  const last=lines.slice(lines.indexOf(writes[0])+1).find(line=>line.method==="GET")
  assert.equal(last.status,200)
  const competing=await read("after-"+phase+"-concurrent-config.json")
  assert.equal(competing.status,200)
  assert.equal(competing.receiptBefore,value)
  traces[phase]={browserWrite:writes[0],browserRead:last,competingWrite:competing}
}
const history=await fetch(launch.url+"/session/"+chat.id+"/message",{headers})
assert.equal(history.status,200)
assert.deepEqual(await history.json(),[])
const facts={config:{status:config.status,requestID:config.headers.get("x-opencorvus-request-id"),local_environment:saved.local_environment,locale:saved.locale},file:{local_environment:file.local_environment,locale:file.locale},traces,conversation:{status:history.status,messages:0}}
await fs.writeFile(path.join(root,"after-final-config.json"),JSON.stringify(facts,null,2)+"\n")
console.log(JSON.stringify(facts))