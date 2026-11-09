import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [root, phase, port, seedName] = process.argv.slice(2)
const endpoint = "http://127.0.0.1:" + port
const directory = path.join(root, "extra-" + phase)
const seedDirectory = path.join(root, seedName)
const description = await fetch(endpoint + "/doc")
assert.equal(description.status, 200)
const spec = await description.json()
const compile = (route) => {
  const { schema } = spec.paths[route].get.responses["200"].content["application/json"]
  return new Ajv2020({ strict: false, validateFormats: false }).compile({ ...schema, components: spec.components })
}
const validateLedger = compile("/work-ledger")
const validatePath = compile("/path")
async function readLedger(expected) {
  const response = await fetch(endpoint + "/work-ledger?limit=80")
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validateLedger(data), JSON.stringify(validateLedger.errors))
  assert.deepEqual(data.rows.map(row => [row.kind, row.directory]).sort((a,b)=>a[1].localeCompare(b[1])),
    expected.map(directory => ["project", directory]).sort((a,b)=>a[1].localeCompare(b[1])))
  return { at: new Date().toISOString(), requestID: response.headers.get("x-opencorvus-request-id"), data }
}
const before = await readLedger([seedDirectory])
const response = await fetch(endpoint + "/path?" + new URLSearchParams({ directory }))
assert.equal(response.status, 200)
const admitted = await response.json()
assert.ok(validatePath(admitted), JSON.stringify(validatePath.errors))
assert.equal(admitted.directory, directory)
const registration = { at: new Date().toISOString(), requestID: response.headers.get("x-opencorvus-request-id"), directory: admitted.directory }
const after = await readLedger([seedDirectory, directory])
const evidence = { phase, before, registration, after }
await fs.writeFile(path.join(root, phase + "-ledger-project-registration.json"), JSON.stringify(evidence, null, 2) + "\n")
console.log(JSON.stringify({ phase, before: before.data.rows.map(row=>row.directory), registration, after: after.data.rows.map(row=>row.directory) }))
