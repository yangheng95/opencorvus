import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, mode] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
assert.ok(["snapshot", "advance"].includes(mode))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const project = seed.directory
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.url, "http://127.0.0.1:" + port)
const base = startup.url
const schemaResponse = await fetch(base + "/doc")
assert.equal(schemaResponse.status, 200)
const doc = await schemaResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const request = async (route, params = {}) => {
  const query = new URLSearchParams({ directory: project, ...params })
  const response = await fetch(base + route + "?" + query, { headers: { "x-opencorvus-directory": project } })
  const body = await response.json()
  const schema = doc.paths[route].get.responses[String(response.status)]?.content?.["application/json"]?.schema
  assert.ok(schema, route + " HTTP " + response.status)
  const validate = ajv.compile({ ...schema, components: doc.components })
  assert.ok(validate(body), JSON.stringify(validate.errors))
  return { status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), body }
}
const diagnosticRoute = "/expert-squad/diagnostics"
const first = await request(diagnosticRoute, { limit: "20" })
assert.equal(first.status, 200)
assert.equal(first.body.total_count, 22)
assert.equal(first.body.entries.length, 20)
assert.ok(first.body.next_cursor)
const page = await request("/expert-squad/search", { view: "installations" })
const active = await request("/expert-squad/catalog")
assert.equal(page.status, 200)
assert.equal(active.status, 200)
assert.equal(active.body.active.effective, "dynamic")
const entries = page.body.entries.map(({ id, name, source }) => ({ id, name, source }))
const artifact = path.join(root, phase + "-" + mode + ".json")
const result = { phase, mode, project, first: { status: first.status, requestID: first.requestID, cursor: first.body.next_cursor, count: first.body.total_count, ids: first.body.entries.map((row) => row.issue?.id ?? row.warning.logical_id) }, entries, active: active.body.active.effective }
if (mode === "snapshot") {
  assert.equal(page.body.total_count, 7)
} else {
  const original = JSON.parse(await fs.readFile(path.join(root, phase + "-snapshot.json"), "utf8"))
  const stale = await request(diagnosticRoute, { limit: "20", cursor: original.first.cursor })
  const next = await request(diagnosticRoute, { limit: "20", cursor: first.body.next_cursor })
  assert.equal(page.body.total_count, 8)
  assert.deepEqual(entries.find((item) => item.id === "deep-research")?.source, { kind: "installed_package", installation_scope: "project", namespace: "builtin" })
  assert.equal(next.status, 200)
  assert.equal(next.body.entries.length, 2)
  assert.deepEqual(next.body.entries.map((row) => row.issue?.id ?? row.warning.logical_id), ["incomplete-020", "data-analysis"])
  result.stale = stale
  result.newContinuation = { status: next.status, requestID: next.requestID, lastEntries: next.body.entries }
}
await fs.writeFile(artifact, JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ mode, entries: page.body.total_count, diagnosticCount: first.body.total_count, firstPageSize: first.body.entries.length, staleStatus: result.stale?.status, staleError: result.stale?.body?.name, newContinuationStatus: result.newContinuation?.status }))
