
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"
const root = path.dirname(fileURLToPath(import.meta.url))
const [phase, port, mode] = process.argv.slice(2)
const advanced = mode === "advanced"
assert.ok(["before", "after"].includes(phase))
const fixture = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const base = "http://127.0.0.1:" + port
const declaration = await fetch(base + "/doc")
assert.equal(declaration.status, 200)
const doc = await declaration.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const checks = []
async function read(route, operationId, query) {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  const validate = ajv.compile({ ...op.responses["200"].content["application/json"].schema, components: doc.components })
  const response = await fetch(new URL(route + (query ? "?" + query : ""), base), { headers: { "x-opencorvus-directory": fixture.directory } })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  checks.push({ route, operationId, status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), schemaValid: true })
  return data
}
const current = await read("/project/current", "project.current")
assert.equal(current.worktree, fixture.directory)
const catalog = await read("/expert-squad/catalog", "expertSquad.catalog", new URLSearchParams({ directory: fixture.directory }))
assert.equal(catalog.active.project, "dynamic")
assert.equal(catalog.active.effective, "dynamic")
const search = new URLSearchParams({ directory: fixture.directory, view: "installations", limit: "20" })
const first = await read("/expert-squad/search", "expertSquad.search", search)
assert.equal(first.total_count, fixture.packages.length + 5 + Number(advanced))
assert.equal(first.entries.length, 20)
assert.ok(first.next_cursor)
search.set("cursor", first.next_cursor)
const second = await read("/expert-squad/search", "expertSquad.search", search)
assert.equal(second.total_count, first.total_count)
assert.equal(second.entries.length, first.total_count - first.entries.length)
assert.equal(second.next_cursor, null)
const project = [...first.entries, ...second.entries].filter(value => value.source.kind === "installed_package")
assert.deepEqual(project.map(({ id }) => id).sort(), advanced ? ["deep-research", ...fixture.packages] : fixture.packages)
assert.ok(project.every(({source}) => source.installation_scope === "project" && ["local-review", ...(advanced ? ["builtin"] : [])].includes(source.namespace)))
const projectRecord = current.id
const facts = { checks, projectRecord, active: {project:catalog.active.project,effective:catalog.active.effective}, total: first.total_count, first: first.entries.map(e => e.id), second: second.entries.map(e => e.id) }
await fs.writeFile(path.join(root, phase + (advanced ? "-advanced" : "") + "-tcp.json"), JSON.stringify(facts, null, 2) + "\n")
console.log(JSON.stringify(facts))
