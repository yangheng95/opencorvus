import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))
const project = seed[phase].directory
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
  const response = await fetch(new URL(route + query, base), { headers: { "x-opencorvus-directory": project } })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  checks.push({ route, operationId, status: response.status, schemaValid: true })
  return data
}
const current = await read("/project/current", "project.current")
assert.equal(current.worktree, project)
const list = await read("/project", "project.list")
assert.deepEqual(list.find((value) => value.id === current.id), current)
const query = "?" + new URLSearchParams({ directory: project })
const active = await read("/expert-squad/catalog", "expertSquad.catalog", query)
assert.equal(active.active.effective, "dynamic")
assert.equal(active.active.project, "dynamic")
const entries = await read("/expert-squad/search", "expertSquad.search", query)
const expected = [
  ["advanced", "Advanced"], ["base", "Base"], ["dynamic", "Dynamic"],
  ["research-studio", "Research Studio"], ["squad-sdk", "Generate Expert Squads"],
]
assert.deepEqual(entries.entries.map(({ id, name, source }) => [id, name, source.kind]), expected.map(([id, name]) => [id, name, "built_in"]))
const details = []
for (const id of ["research-studio", "dynamic"]) {
  const detailQuery = "?" + new URLSearchParams({ directory: project, id, installationScope: "built_in" })
  const surface = await read("/expert-squad/settings/detail", "expertSquad.settingsDetail", detailQuery)
  const { selected, selection } = surface
  assert.equal(selected.id, id)
  assert.equal(selected.name, expected.find(([key]) => key === id)[1])
  assert.equal(selected.source.kind, "built_in")
  assert.ok(selected.version)
  details.push({ id, name: selected.name, version: selected.version, source: selected.source, effectiveIdentity: selection.effective_identity })
}
const result = { phase, checks, project: { id: current.id, worktree: current.worktree }, active: { effective: active.active.effective, project: active.active.project, scope: active.scope }, entries: entries.entries.map(({ id, name, source }) => ({ id, name, source })), details }
await fs.writeFile(path.join(root, phase + "-tcp.json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ phase, checks: checks.length, active: result.active, entries: expected, details }))
