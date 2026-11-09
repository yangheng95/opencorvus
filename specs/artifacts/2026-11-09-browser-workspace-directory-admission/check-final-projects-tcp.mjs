import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [root, port] = process.argv.slice(2)
const endpoint = "http://127.0.0.1:" + port
const docResponse = await fetch(endpoint + "/doc")
assert.equal(docResponse.status,200)
const doc = await docResponse.json()
const fact = JSON.parse(await fs.readFile(path.join(root,"anonymous-seed.json"),"utf8"))
const destination = path.join(fact.parent,"named-workspace-109")
const receipts=[]
async function read(route, query) {
  const response = await fetch(endpoint + route + "?" + new URLSearchParams(query))
  assert.equal(response.status,200)
  const schema = doc.paths[route].get.responses["200"].content["application/json"].schema
  const validate = new Ajv2020({strict:false,validateFormats:false}).compile({...schema,components:doc.components})
  const data = await response.json()
  assert.ok(validate(data),JSON.stringify(validate.errors))
  receipts.push({route, query, status:response.status, requestID:response.headers.get("x-opencorvus-request-id"), data})
  return data
}
const ledger=await read("/work-ledger",{limit:"80"})
assert.deepEqual(ledger.rows.map(row=>row.directory).sort(),[path.join(root,"project-after"),path.join(root,"target-after"),destination].sort())
const row = ledger.rows.find(item=>item.directory===destination)
assert.deepEqual({id:row.id,title:row.title,kind:row.kind},{id:fact.response.project.id,title:"named-workspace-109",kind:"project"})
const promoted=await read("/file/content",{directory:destination,path:"promotion-note.txt"})
assert.equal(promoted.content,fact.content)
assert.equal(await fs.readFile(path.join(destination,"promotion-note.txt"),"utf8"),fact.content)
for (const name of ["project-after","target-after"]) {
 const file=await read("/file/content",{directory:path.join(root,name),path:"note.txt"})
 assert.equal(file.content,"Owned folder-choice target "+name+"\n")
}
await fs.writeFile(path.join(root,"after-final-projects-tcp.json"),JSON.stringify({destination,receipts},null,2)+"\n")
console.log(JSON.stringify({destination,projectID:row.id,reads:receipts.map(({route,status,requestID})=>[route,status,requestID])}))
