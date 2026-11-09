import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root] = process.argv.slice(2)
const seed = JSON.parse(await fs.readFile(path.join(root,"seed.json"),"utf8"))
const url = new URL("/mission-skill/directory","http://127.0.0.1:39325")
url.searchParams.set("directory",seed.after.directory)
const facts=[]
for (const [label, headers, expected] of [
  ["merged-duplicate", {"Content-Type":"application/json","content-type":"application/json"}, 400],
  ["single-json", {"Content-Type":"application/json"}, 200]
]) {
  const normalized = new Headers(headers)
  const response=await fetch(url,{method:"POST",headers,body:JSON.stringify({source:"project"})})
  const body=await response.json()
  assert.equal(response.status,expected)
  if(expected===200) assert.equal(body.path,path.join(seed.after.directory,".opencorvus","mission-skills"))
  else assert.deepEqual(body.error[0].path,["source"])
  facts.push({label,contentType:normalized.get("content-type"),status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),body})
}
await fs.writeFile(path.join(root,"directory-content-type-probe.json"),JSON.stringify(facts,null,2)+"\n")
console.log(JSON.stringify(facts))