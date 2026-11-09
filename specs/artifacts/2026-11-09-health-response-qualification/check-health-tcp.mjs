import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const [evidenceDir, phase, directPort, proxyPort] = process.argv.slice(2)
const seed = JSON.parse(await fs.readFile(resolve(evidenceDir, "seed.json"), "utf8"))[phase]
assert.ok(seed)
const direct = "http://127.0.0.1:" + directPort
const proxy = "http://127.0.0.1:" + proxyPort
const require = createRequire(resolve("packages/opencorvus/package.json"))
const Ajv2020 = require("ajv/dist/2020.js").default
const docResponse = await fetch(direct + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const checks = []
function validator(route, operationId) {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  return ajv.compile({ ...op.responses["200"].content["application/json"].schema, components: doc.components })
}
async function read(base, route, headers = {}) {
  const response = await fetch(base + route, { headers })
  assert.equal(response.status, 200)
  const requestID = response.headers.get("x-opencorvus-request-id")
  assert.ok(requestID)
  const contentType = response.headers.get("content-type")
  checks.push({ base, route, status: response.status, requestID, contentType })
  return response
}

const healthSchema = validator("/global/health", "global.health")
const directHealth = await (await read(direct, "/global/health")).json()
assert.ok(healthSchema(directHealth), JSON.stringify(healthSchema.errors))
assert.equal(directHealth.healthy, true)
assert.equal(directHealth.version, "local")
assert.equal(directHealth.paths.home, resolve(evidenceDir, "profile-" + phase, "home"))
checks.at(-1).facts = { healthy: directHealth.healthy, version: directHealth.version, healthSchema: "valid" }

const automationsSchema = validator("/global/automations", "global.automations.list")
const directOther = await (await read(direct, "/global/automations")).json()
assert.ok(automationsSchema(directOther), JSON.stringify(automationsSchema.errors))
assert.deepEqual(directOther, [])
checks.at(-1).facts = { automationSchema: "valid", records: directOther }

const misrouted = await (await read(proxy, "/global/health")).json()
assert.deepEqual(misrouted, directOther)
healthSchema(misrouted)
const validationErrors = healthSchema.errors.map(({ keyword, instancePath, params }) => ({ keyword, instancePath, params }))
assert.deepEqual(validationErrors, [{ keyword: "type", instancePath: "", params: { type: "object" } }])
checks.at(-1).facts = { actualBody: misrouted, validationErrors }

const project = await (await read(direct, "/project/current", { "x-opencorvus-directory": seed.directory })).json()
const projectSchema = validator("/project/current", "project.current")
assert.ok(projectSchema(project), JSON.stringify(projectSchema.errors))
assert.equal(project.worktree, seed.directory)
checks.at(-1).facts = { id: project.id, worktree: project.worktree, projectSchema: "valid" }

const document = await read(direct, "/ui/global/health")
assert.match(document.headers.get("content-type"), /^text\/html\b/)
checks.at(-1).facts = { documentBytes: (await document.arrayBuffer()).byteLength }

await fs.writeFile(resolve(evidenceDir, phase + "-tcp.json"), JSON.stringify({ phase, checks }, null, 2) + "\n")
console.log(JSON.stringify({ phase, statuses: checks.map(check => check.status), badPayload: misrouted, validationErrors, healthy: directHealth.healthy }))
