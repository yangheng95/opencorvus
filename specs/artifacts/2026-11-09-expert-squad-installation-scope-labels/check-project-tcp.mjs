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
const installs = JSON.parse(await fs.readFile(path.join(root, phase + "-installations.json"), "utf8")).installed
const active = await read("/expert-squad/catalog", "expertSquad.catalog", query)
assert.equal(active.active.effective, "dynamic")
assert.equal(active.active.project, "dynamic")
const page = await read("/expert-squad/search", "expertSquad.search", query + "&view=installations")
assert.equal(page.total_count, 7)
const installed = page.entries.filter((entry) => entry.id === "data-analysis")
const source = (scope) => ({ kind: "installed_package", installation_scope: scope, namespace: "builtin" })
const identity = (scope) => ({ id: "data-analysis", source: source(scope) })
assert.deepEqual(installed.map(({ id, name, source }) => ({ id, name, source })), ["global", "project"].map((scope) => ({ ...identity(scope), name: "Data Analysis & Business Insights" })))
const details = []
for (const installation of installs) {
  const { scope, root: installRoot } = installation
  const detailQuery = "?" + new URLSearchParams({ directory: project, id: "data-analysis", installationScope: scope, namespace: "builtin" })
  const surface = await read("/expert-squad/settings/detail", "expertSquad.settingsDetail", detailQuery)
  const { selected, selection } = surface
  assert.equal(selected.id, "data-analysis")
  assert.equal(selected.name, "Data Analysis & Business Insights")
  assert.equal(selected.version, "2026.10.24.3")
  assert.deepEqual({ kind: selected.source.kind, installation_scope: selected.source.installation_scope, namespace: selected.source.namespace }, source(scope))
  assert.equal(selected.source.root, installRoot)
  assert.equal(selected.source.manifest_path, path.join(installRoot, "expert-squad.jsonc"))
  assert.equal(selected.source.readme_path, path.join(installRoot, "README.md"))
  assert.deepEqual(selection.effective_identity, identity("project"))
  details.push({ scope, id: selected.id, name: selected.name, version: selected.version, root: installRoot, manifest: selected.source.manifest_path, readme: selected.source.readme_path, effectiveIdentity: selection.effective_identity })
}
for (const key of ["manifest", "readme"]) assert.deepEqual(await fs.readFile(details[0][key]), await fs.readFile(details[1][key]))
const result = { phase, checks, project: { id: current.id, worktree: current.worktree }, active: { effective: active.active.effective, project: active.active.project, scope: active.scope }, entries: page.entries.map(({ id, name, source }) => ({ id, name, source })), details }
await fs.writeFile(path.join(root, phase + "-tcp.json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ phase, checks: checks.length, active: result.active, entries: page.total_count, scopes: details.map((item) => item.scope), effectiveIdentity: details[0].effectiveIdentity }))
