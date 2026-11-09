import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"

const [root, phase, port, state, expectedName] = process.argv.slice(2)
const require = createRequire(path.resolve("packages/opencorvus/package.json"))
const Ajv = require("ajv/dist/2020")
const endpoint = "http://127.0.0.1:" + port
const fixtures = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const description = await fetch(endpoint + "/doc")
assert.equal(description.status, 200)
const doc = await description.json()
const reads = []
const validate = route => {
  const { schema } = doc.paths[route].get.responses["200"].content["application/json"]
  return new Ajv({ strict: false, validateFormats: false }).compile({ ...schema, components: doc.components })
}
const routes = Object.fromEntries(["/project/current", "/work-ledger", "/file/content"].map(route => [route, validate(route)]))
async function read(route, query) {
  const response = await fetch(endpoint + route + "?" + new URLSearchParams(query))
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(routes[route](data), JSON.stringify(routes[route].errors))
  reads.push({ route, query, status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), data })
  return data
}
const pins = state === "pinned"
const ledger = await read("/work-ledger", { limit: "80" })
assert.equal(ledger.nextCursor, null)
assert.deepEqual(ledger.rows.map(row => [row.kind, path.normalize(row.directory)].join(":")).sort(),
  Object.values(fixtures).map(({ directory }) => "project:" + path.normalize(directory)).sort())
for (const [name, { directory }] of Object.entries(fixtures)) {
  const named = name === "planning-folder-" + phase
  const row = ledger.rows.find(row => path.normalize(row.directory) === path.normalize(directory))
  const project = await read("/project/current", { directory })
  assert.deepEqual([project.id, path.normalize(project.worktree), project.name ?? null], [row.id, path.normalize(directory), named ? expectedName : null])
  assert.equal(row.title, named ? expectedName : "")
  assert.equal(row.pinned, named && pins)
  const file = await read("/file/content", { directory, path: "note.txt" })
  assert.equal(file.content, "Owned project summary " + name + "\n")
}
await fs.writeFile(path.join(root, phase + "-" + state + "-tcp.json"), JSON.stringify({ phase, state, reads }, null, 2) + "\n")
console.log(JSON.stringify(reads.map(({ route, requestID }) => [route, requestID])))
