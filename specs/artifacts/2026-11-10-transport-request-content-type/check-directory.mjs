import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"
const [root,port]=process.argv.slice(2)
const seed=JSON.parse(await fs.readFile(path.join(root,"seed.json"),"utf8"))
const browserFacts=JSON.parse(await fs.readFile(path.join(root,"after-post-action-roots.json"),"utf8"))
const base="http://127.0.0.1:"+port
const docResponse=await fetch(base+"/doc")
assert.equal(docResponse.status,200)
const doc=await docResponse.json()
const op=doc.paths["/mission-skill/directory"].post
assert.equal(op.operationId,"missionSkill.directory")
const schema=op.responses["200"].content["application/json"].schema
const validate=new Ajv2020({strict:false,allErrors:true,validateFormats:false}).compile({...schema,components:doc.components})
const url=new URL("/mission-skill/directory",base)
url.searchParams.set("directory",seed.after.directory)
const facts=[]
for(const source of ["project","global"]){
  const expected=browserFacts[source+"Root"]
  assert.ok((await fs.stat(expected)).isDirectory())
  const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({source})})
  assert.equal(response.status,200)
  const body=await response.json()
  assert.ok(validate(body),JSON.stringify(validate.errors))
  assert.equal(body.path,expected)
  facts.push({source,status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),schemaValid:true,path:body.path})
}
await fs.writeFile(path.join(root,"after-directory-contract.json"),JSON.stringify(facts,null,2)+"\n")
console.log(JSON.stringify(facts))