import fs from "node:fs/promises"
import assert from "node:assert/strict"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [root, phase, port] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after")
const project = JSON.parse(await fs.readFile(root + "/seed.json", "utf8"))[phase]
const base = "http://127.0.0.1:" + port
const schemaResponse = await fetch(base + "/doc")
assert.equal(schemaResponse.status, 200)
const doc = await schemaResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const checks = []
const read = async (route, operationId, query = "") => {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  const schema = op.responses["200"].content["application/json"].schema
  const validate = ajv.compile({ ...schema, components: doc.components })
  const response = await fetch(new URL(route + query, base), { headers: { "x-opencorvus-directory": project.directory } })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  checks.push({ route, operationId, status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), schemaValid: true })
  return data
}
const current = await read("/project/current", "project.current")
assert.equal(current.worktree, project.directory)
assert.ok(current.id.startsWith("prj_"))
const list = await read("/project", "project.list")
const item = list.find(value => value.id === current.id)
assert.deepEqual(item, current)
const automations = await read("/global/automations", "global.automations.list")
assert.deepEqual(automations, [])
const result = { phase, checks, automations, project: { id: current.id, worktree: current.worktree }, listedProjectCount: list.length }
await fs.writeFile(root + "/" + phase + "-tcp.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result))
