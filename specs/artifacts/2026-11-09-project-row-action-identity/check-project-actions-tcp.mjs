import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [root, phase, port, state] = process.argv.slice(2)
const endpoint = "http://127.0.0.1:" + port
const fixtures = JSON.parse((await fs.readFile(path.join(root,"seed.json"),"utf8")).replace(/^\uFEFF/,""))[phase]
const docResponse = await fetch(endpoint + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const compile = route => {
  const { schema } = doc.paths[route].get.responses["200"].content["application/json"]
  return new Ajv2020({ strict: false, validateFormats: false }).compile({ ...schema, components: doc.components })
}
const validators = Object.fromEntries(["/path","/work-ledger","/file/content"].map(route=>[route,compile(route)]))
const reads=[]
async function read(route, query) {
  const response = await fetch(endpoint + route + "?" + new URLSearchParams(query))
  assert.equal(response.status,200)
  const data = await response.json()
  assert.ok(validators[route](data), JSON.stringify(validators[route].errors))
  reads.push({ route, query, status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), data })
  return data
}
for (const [name,{directory}] of Object.entries(fixtures)) {
  const scoped = await read("/path", { directory })
  assert.equal(path.normalize(scoped.directory),path.normalize(directory))
  const file = await read("/file/content", { directory, path:"note.txt" })
  assert.equal(file.content, "Owned Work Ledger action target: " + name + "\n")
}
const ledger = await read("/work-ledger", { limit:"80" })
const compare = (a,b)=>a.localeCompare(b)
assert.deepEqual(ledger.rows.map(row=>[row.kind,path.normalize(row.directory)].join(":")).sort(compare),
  Object.values(fixtures).map(row=>"project:"+path.normalize(row.directory)).sort(compare))
assert.equal(ledger.nextCursor,null)
const pinned = ledger.rows.filter(row => row.pinned).map(row => path.normalize(row.directory))
assert.deepEqual(pinned, state === "pinned" ? [path.normalize(fixtures[phase+"-west/Atlas"].directory)] : [])
const output={phase,state,reads}
await fs.writeFile(path.join(root,phase+"-"+state+"-tcp.json"), JSON.stringify(output,null,2)+"\n")
console.log(JSON.stringify({ phase,state,reads:reads.length,projects:ledger.rows.map(({id,directory})=>({id,directory})) }))
