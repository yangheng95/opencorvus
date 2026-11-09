import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const [evidenceDir, phase, port, step] = process.argv.slice(2)
const expected = { "before:settled": 31302, "after:first": 31301, "after:older": 31302, "after:newer": 31303 }[phase + ":" + step]
assert.ok(expected)
const project = JSON.parse(await fs.readFile(resolve(evidenceDir, "seed.json"), "utf8"))[phase]
const base = "http://127.0.0.1:" + port
const require = createRequire(resolve("packages/opencorvus/package.json"))
const Ajv2020 = require("ajv/dist/2020.js").default
const docResponse = await fetch(base + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const checks = []
async function read(path, operationId, directory) {
  const op = doc.paths[path].get
  assert.equal(op.operationId, operationId)
  const schema = op.responses["200"].content["application/json"].schema
  const validate = ajv.compile({ ...schema, components: doc.components })
  const url = new URL(path, base)
  if (directory) url.search = new URLSearchParams({ directory })
  const result = await fetch(url)
  assert.equal(result.status, 200)
  const body = await result.json()
  assert.ok(validate(body), JSON.stringify(validate.errors))
  checks.push({ path, operationId, directory, status: result.status, schemaValid: true, requestID: result.headers.get("x-opencorvus-request-id") })
  return body
}
const configured = await read("/config", "config.get", project.directory)
const proxy = { url: "http://127.0.0.1:" + expected, llmProvider: false, webResearch: false }
assert.deepEqual(configured.network?.proxy, proxy)
checks.at(-1).proxy = proxy
const global = await read("/global/config", "global.config.get")
assert.equal(global.network?.proxy ?? null, null)
checks.at(-1).proxy = null
await fs.writeFile(resolve(evidenceDir, phase + "-" + step + "-tcp.json"), JSON.stringify({ phase, step, checks }, null, 2) + "\n")
console.log(JSON.stringify({ phase, step, statuses: checks.map(item => item.status), persisted: proxy, global: null }))
