import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root] = process.argv.slice(2)
const read = async file => JSON.parse(await fs.readFile(path.join(root,file),"utf8"))
const seed = await read("seed.json")
const launch = await read("after-startup.json")
assert.equal(launch.occurrenceID,"iteration-b152-after")
const {url}=launch
const facts={}
for(const [phase,key] of [["after","long"],["empty","new"]]){
  const {directory,environment}=seed[phase]
  const headers={"x-opencorvus-directory":directory}
  const config=await fetch(url+"/config",{headers})
  assert.equal(config.status,200)
  const result=await config.json()
  const expected=phase==="after" ? {...environment,variables:{...environment.variables,OPENCORVUS_REVIEW_ROW_12:"desktop-edited-12"}} : {name:"New desktop environment"}
  assert.deepEqual(result.local_environment,expected)
  assert.equal(result.locale,"en-US")
  const file=await read(path.join("project-"+phase,".opencorvus","opencorvus.jsonc"))
  assert.deepEqual(file.local_environment,expected)
  assert.equal(file.locale,"en-US")
  const chat=await read(phase+"-chat.json")
  assert.equal(chat.directory,directory)
  const history=await fetch(url+"/session/"+chat.id+"/message",{headers})
  assert.equal(history.status,200)
  assert.deepEqual(await history.json(),[])
  facts[key]={config:{status:config.status,requestID:config.headers.get("x-opencorvus-request-id"),local_environment:result.local_environment,locale:result.locale},file:{local_environment:file.local_environment,locale:file.locale},conversation:{status:history.status,messages:0}}
}
await fs.writeFile(path.join(root,"after-config-check.json"),JSON.stringify(facts,null,2)+"\n")
console.log(JSON.stringify(facts))
