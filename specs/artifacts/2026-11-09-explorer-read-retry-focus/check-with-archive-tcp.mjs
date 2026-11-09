import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"
const [root, phase, port, state] = process.argv.slice(2)
const base = "http://127.0.0.1:" + port
const directory = path.join(root, "project-" + phase)
const described = await fetch(base + "/doc")
assert.equal(described.status, 200)
const doc = await described.json()
const operation = doc.paths["/file"].get
assert.equal(operation.operationId, "file.list")
const schema = operation.responses["200"].content["application/json"].schema
const validate = new Ajv2020({ strict: false, validateFormats: false }).compile({ ...schema, components: doc.components })
const expected = [
  ["plans", [["drafts","directory"],["reference","directory"]]],
  ["plans/drafts", state === "created" ? [["draft-note.txt","file"]] : []],
  ["plans/reference", [["note.txt","file"]]],
  ["archive", [["archived.txt","file"]]],
]
const checks = []
for (const [relative, children] of expected) {
  const response = await fetch(base + "/file?" + new URLSearchParams({ path: relative, directory }))
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  assert.deepEqual(data.map(({name,type}) => [name,type]), children)
  checks.push({ relative, status: response.status, children: data, schemaValid: true })
}
const result = { phase, state, operation: operation.operationId, checks }
await fs.writeFile(path.join(root, phase + "-" + state + "-tcp.json"), JSON.stringify(result,null,2) + "\n")
console.log(JSON.stringify({phase,state,reads:checks.map(({relative,children}) => [relative,children.map(x=>x.name)])}))