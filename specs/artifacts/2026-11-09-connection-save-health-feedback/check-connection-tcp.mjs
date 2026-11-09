import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const [evidenceDir, phase, port] = process.argv.slice(2)
const seed = JSON.parse(await fs.readFile(resolve(evidenceDir, "seed.json"), "utf8"))[phase]
assert.ok(seed)
const base = "http://127.0.0.1:" + port
const require = createRequire(resolve("packages/opencorvus/package.json"))
const Ajv2020 = require("ajv/dist/2020.js").default
const docResponse = await fetch(base + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const checks = []
async function read(route, operationId, headers = {}) {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  const response = await fetch(base + route, { headers })
  assert.equal(response.status, 200)
  const schema = op.responses["200"].content["application/json"].schema
  const validate = ajv.compile({ ...schema, components: doc.components })
  const body = await response.json()
  assert.ok(validate(body), JSON.stringify(validate.errors))
  checks.push({ route, operationId, status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), schemaValid: true })
  return body
}
const health = await read("/global/health", "global.health")
assert.equal(health.healthy, true)
assert.equal(health.version, "local")
assert.equal(health.paths.home, resolve(evidenceDir, "profile-" + phase, "home"))
checks.at(-1).health = { healthy: health.healthy, version: health.version }
const project = await read("/project/current", "project.current", { "x-opencorvus-directory": seed.directory })
assert.equal(project.worktree, seed.directory)
checks.at(-1).project = { id: project.id, worktree: project.worktree }

if (phase !== "recovery") {
  const wrongPath = "/missing-prefix/global/health"
  const wrong = await fetch(base + wrongPath)
  assert.equal(wrong.status, 400)
  const body = await wrong.json()
  assert.deepEqual(body, { name: "DirectoryRequiredError", data: { message: "Project-scoped route " + wrongPath + " requires ?directory= query parameter or x-opencorvus-directory header" } })
  const requestID = wrong.headers.get("x-opencorvus-request-id")
  assert.ok(requestID)
  checks.push({ route: wrongPath, status: wrong.status, requestID, body })
}
await fs.writeFile(resolve(evidenceDir, phase + "-tcp.json"), JSON.stringify({ phase, checks }, null, 2) + "\n")
console.log(JSON.stringify({ phase, checks }))
