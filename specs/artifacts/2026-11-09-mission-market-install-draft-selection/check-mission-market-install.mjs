import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, step, id = "deep-research"] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
assert.ok(["available", "installed"].includes(step))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.url, "http://127.0.0.1:" + port)
assert.equal(startup.occurrenceID, "iteration-b74-" + phase)
const directory = await fs.realpath(seed.directory)
assert.equal(path.dirname(directory), root)
const document = await fetch(startup.url + "/doc")
assert.equal(document.status, 200)
const doc = await document.json()
const ajv = new Ajv2020({ strict: false, validateFormats: false })
const validators = new Map()
const read = async (route, params = {}) => {
  const response = await fetch(startup.url + route + "?" + new URLSearchParams({ directory, ...params }), { headers: { "x-opencorvus-directory": directory } })
  assert.equal(response.status, 200, route)
  const body = await response.json()
  if (!validators.has(route)) validators.set(route, ajv.compile({ ...doc.paths[route].get.responses["200"].content["application/json"].schema, components: doc.components }))
  const validate = validators.get(route)
  assert.ok(validate(body), JSON.stringify(validate.errors))
  const requestID = response.headers.get("x-opencorvus-request-id")
  assert.ok(requestID)
  return { requestID, body }
}
assert.ok(["deep-research", "academic-paper-review"].includes(id))
const query = { query: id.replaceAll("-", " "), productPillar: "work" }
const available = await read("/expert-squad/market", { ...query, availability: "available", limit: "3" })
const detail = await read("/expert-squad/market/detail", { id })
const catalog = await read("/expert-squad/catalog")
assert.equal(catalog.body.active.effective, "dynamic")
assert.equal(detail.body.namespace, "builtin")
assert.equal(detail.body.id, id)
const result = { phase, step, available: { requestID: available.requestID, ids: available.body.entries.map((entry) => entry.id) }, marketDetail: { requestID: detail.requestID, installations: detail.body.installations.map((entry) => ({ scope: entry.installation_scope, version: entry.installed_version })) }, active: { requestID: catalog.requestID, effective: catalog.body.active.effective } }
if (step === "available") {
  assert.deepEqual({ id: available.body.entries[0].id, scopes: available.body.entries[0].installation_scopes }, { id, scopes: [] })
} else {
  assert.deepEqual(result.marketDetail.installations, [{ scope: "project", version: "2026.10.14.1" }])
  const installed = await read("/expert-squad/market", { ...query, availability: "installed", limit: "3" })
  assert.deepEqual(installed.body.entries.filter((entry) => entry.id === id).map(({ namespace, id, installation_scopes }) => ({ namespace, id, installation_scopes })), [{ namespace: "builtin", id, installation_scopes: ["project"] }])
  const options = await read("/expert-squad/search", { ...query, view: "effective", limit: "20" })
  const option = options.body.entries.find((entry) => entry.id === id)
  assert.deepEqual(option?.source, { kind: "installed_package", installation_scope: "project", namespace: "builtin" })
  result.installed = { requestID: installed.requestID, ids: installed.body.entries.map((entry) => entry.id) }
  result.reference = { requestID: options.requestID, id: option.id, name: option.name, source: option.source }
  if (phase === "after") {
    const inspection = await read("/expert-squad/inspect", { id, namespace: "builtin", installationScope: "project" })
    assert.deepEqual(inspection.body.source, option.source)
    assert.equal(inspection.body.id, id)
    assert.equal(inspection.body.version, "2026.10.14.1")
    result.exactInspection = { requestID: inspection.requestID, id, source: inspection.body.source, version: inspection.body.version }
  }
}
await fs.writeFile(path.join(root, phase + "-" + (id === "deep-research" ? "" : id + "-") + step + ".json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result))
