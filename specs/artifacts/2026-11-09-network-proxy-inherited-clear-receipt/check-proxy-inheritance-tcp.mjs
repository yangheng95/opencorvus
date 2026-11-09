import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const [evidenceDir, phase, port, step] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
assert.ok(["seed", "inherited", "override"].includes(step))
const project = JSON.parse(await fs.readFile(resolve(evidenceDir, "seed.json"), "utf8"))[phase]
const base = "http://127.0.0.1:" + port
const require = createRequire(resolve("packages/opencorvus/package.json"))
const Ajv2020 = require("ajv/dist/2020.js").default
const docResponse = await fetch(base + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const checks = []

async function check(route, method, operationId, expected, directory, write) {
  const operation = doc.paths[route][method.toLowerCase()]
  assert.equal(operation.operationId, operationId)
  const schema = operation.responses["200"].content["application/json"].schema
  const validator = ajv.compile({ ...schema, components: doc.components })
  const url = new URL(route, base)
  if (directory) url.search = new URLSearchParams({ directory })
  const response = await fetch(url, {
    method,
    ...(write ? { headers: { "content-type": "application/json" }, body: JSON.stringify(write) } : {}),
  })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validator(data), JSON.stringify(validator.errors))
  assert.deepEqual(data.network?.proxy ?? null, expected)
  checks.push({ route, method, directory, operationId, status: response.status, schemaValid: true, requestID: response.headers.get("x-opencorvus-request-id"), proxy: expected })
}

const proxy = n => ({ url: "http://127.0.0.1:" + n, llmProvider: false, webResearch: false })
const inherited = proxy(31298)
const seededOverride = proxy(31299)
if (step === "seed") {
  await check("/global/config", "PATCH", "global.config.update", inherited, undefined, { network: { proxy: inherited } })
  await check("/config", "PATCH", "config.update", seededOverride, project.directory, { network: { proxy: seededOverride } })
}
const selected = step === "seed" ? seededOverride : step === "override" ? proxy(31300) : inherited
await check("/global/config", "GET", "global.config.get", inherited)
await check("/config", "GET", "config.get", selected, project.directory)
await fs.writeFile(resolve(evidenceDir, phase + "-" + step + "-tcp.json"), JSON.stringify({ phase, step, checks }, null, 2) + "\n")
console.log(JSON.stringify({ phase, step, statuses: checks.map(item => item.status), inherited, effective: selected }))
