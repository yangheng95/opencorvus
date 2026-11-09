import fs from "node:fs/promises"
import assert from "node:assert/strict"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, version] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after" || phase === "recovered")
const root = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b54"
const project = JSON.parse(await fs.readFile(root + "/seed.json", "utf8"))[phase === "recovered" ? "after" : phase]
const base = "http://127.0.0.1:" + port
const schemaResponse = await fetch(base + "/doc")
assert.equal(schemaResponse.status, 200)
const doc = await schemaResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const checks = []
const read = async (route, operationId) => {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  const schema = op.responses["200"].content["application/json"].schema
  const validate = ajv.compile({ ...schema, components: doc.components })
  const response = await fetch(new URL(route, base), { headers: { "x-opencorvus-directory": project.directory } })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  checks.push({ route, operationId, status: response.status, schemaValid: true })
  return data
}
const current = await read("/project/current", "project.current")
assert.equal(current.worktree, project.directory)
assert.ok(current.id.startsWith("prj_"))
const list = await read("/project", "project.list")
const item = list.find(value => value.id === current.id)
assert.deepEqual(item, current)
const health = await read("/global/health", "global.health")
assert.equal(health.healthy, true)
assert.equal(health.version, version)
assert.equal(health.paths.data, root.replaceAll("/", "\\") + "\\profile-" + (phase === "recovered" ? "after" : phase) + "\\data")
await fs.writeFile(root + "/" + phase + "-health.json", JSON.stringify(health, null, 2) + "\n")
const result = { phase, checks, health: { healthy: health.healthy, version: health.version }, project: { id: current.id, worktree: current.worktree }, listedProjectCount: list.length }
await fs.writeFile(root + "/" + phase + "-tcp.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result))