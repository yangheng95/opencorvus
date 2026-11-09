import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [root, phase, port] = process.argv.slice(2)
const endpoint = "http://127.0.0.1:" + port
const directory = path.join(root, "project-" + phase)
const description = await fetch(endpoint + "/doc")
assert.equal(description.status, 200)
const spec = await description.json()
const operation = spec.paths["/find/file"].get
assert.equal(operation.operationId, "find.files")
const checks = []
for (const [type, expectedStatus] of [["file", 200], ["owned-invalid-kind", 400]]) {
  const params = new URLSearchParams({ query: "note", type, limit: "121", directory })
  const response = await fetch(endpoint + "/find/file?" + params)
  assert.equal(response.status, expectedStatus)
  const schema = operation.responses[expectedStatus].content["application/json"].schema
  const validate = new Ajv2020({ strict: false, validateFormats: false }).compile({ ...schema, components: spec.components })
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  if (expectedStatus === 200) assert.deepEqual(data.map(value => value.replaceAll("\\", "/")), ["plans/reference/note.txt"])
  else {
    assert.equal(data.data.message, "Request validation failed")
    assert.deepEqual(data.error.map(issue => issue.path), [["type"]])
  }
  checks.push({ type, status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), data })
}
const evidence = { phase, operation: operation.operationId, checks }
await fs.writeFile(path.join(root, phase + "-search-contract.json"), JSON.stringify(evidence, null, 2) + "\n")
console.log(JSON.stringify(evidence))
