import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const [evidenceDir, phase, port] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after")
const seed = JSON.parse(await fs.readFile(resolve(evidenceDir, "seed.json"), "utf8"))
const base = "http://127.0.0.1:" + port
const require = createRequire(resolve("packages/opencorvus/package.json"))
const Ajv2020 = require("ajv/dist/2020.js").default
const docResponse = await fetch(base + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const checks = []
const validators = new Map()
async function read(path, operationId, directory) {
  const op = doc.paths[path].get
  assert.equal(op.operationId, operationId)
  if (!validators.has(path)) {
    validators.set(path, ajv.compile({ ...op.responses["200"].content["application/json"].schema, components: doc.components }))
  }
  const url = new URL(path, base)
  if (directory) url.search = new URLSearchParams({ directory })
  const response = await fetch(url)
  assert.equal(response.status, 200)
  const data = await response.json()
  const validate = validators.get(path)
  assert.ok(validate(data), JSON.stringify(validate.errors))
  checks.push({ path, operationId, directory, status: response.status, schemaValid: true, requestID: response.headers.get("x-opencorvus-request-id") })
  return data
}
const proxy = url => url ? { llmProvider: false, webResearch: false, url } : null
for (const [scope, expected] of [
  ["project", proxy("http://127.0.0.1:" + (phase === "before" ? "31294" : "31296"))],
  ["sibling", phase === "before" ? null : proxy("http://127.0.0.1:31297")],
]) {
  const directory = seed[scope + "-" + phase].directory
  const item = await read("/project/current", "project.current", directory)
  assert.equal(item.worktree, directory)
  checks.at(-1).facts = { id: item.id, worktree: item.worktree }
  const config = await read("/config", "config.get", directory)
  const actual = config.network?.proxy ?? null
  assert.deepEqual(actual, expected)
  checks.at(-1).facts = { proxy: actual, scope }
}
const globalConfig = await read("/global/config", "global.config.get")
const globalProxy = globalConfig.network?.proxy ?? null
assert.equal(globalProxy, null)
checks.at(-1).facts = { proxy: globalProxy, scope: "global" }

await fs.writeFile(resolve(evidenceDir, phase + "-tcp.json"), JSON.stringify({ phase, checks }, null, 2) + "\n")
console.log(JSON.stringify({ phase, statuses: checks.map(check => check.status), scopedProxy: checks.filter(check => check.facts.scope).map(check => check.facts) }))
