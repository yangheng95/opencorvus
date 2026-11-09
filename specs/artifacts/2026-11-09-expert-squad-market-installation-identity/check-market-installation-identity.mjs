import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, step] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
assert.ok(["initial", "installed", "blocked"].includes(step))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.url, "http://127.0.0.1:" + port)
assert.equal(startup.occurrenceID, "iteration-b72-" + phase)
const directory = await fs.realpath(step === "blocked" ? seed.blocked.directory : seed.directory)
assert.equal(path.dirname(directory), root)
const docResponse = await fetch(startup.url + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
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
  return { status: response.status, requestID, body }
}
const packageID = "deep-research"
const query = { query: packageID, limit: "20" }
const summary = (entry) => entry && ({ namespace: entry.namespace, id: entry.id, name: entry.name, scopes: entry.installation_scopes })
const pick = (response) => ({ requestID: response.requestID, total: response.body.total_count, entry: summary(response.body.entries.find(({ id }) => id === packageID)) ?? null })
const all = pick(await read("/expert-squad/market", { ...query, availability: "all" }))
const available = pick(await read("/expert-squad/market", { ...query, availability: "available" }))
const installed = pick(await read("/expert-squad/market", { ...query, availability: "installed" }))
const detail = await read("/expert-squad/market/detail", { id: packageID })
const installations = await read("/expert-squad/search", { ...query, view: "installations" })
const catalog = await read("/expert-squad/catalog")
assert.equal(catalog.body.active.effective, "dynamic")
assert.equal(all.entry.namespace, "builtin")
assert.equal(detail.body.namespace, "builtin")
const actualDetailScopes = detail.body.installations.map((entry) => entry.installation_scope)
assert.deepEqual(actualDetailScopes, step === "installed" ? ["project"] : [])
const physical = installations.body.entries.filter(({ id }) => id === packageID).map(({ id, name, source }) => ({ id, name, source }))
const expectedGlobal = { id: packageID, name: "Local Research Notebook", source: { kind: "installed_package", installation_scope: "global", namespace: "local" } }
assert.deepEqual(physical.find(({ source }) => source.installation_scope === "global"), expectedGlobal)
if (step === "blocked") {
  assert.deepEqual(actualDetailScopes, [])
  assert.deepEqual(physical.find(({ source }) => source.installation_scope === "project"), {
    id: packageID, name: "Workshop Research Notebook", source: { kind: "installed_package", installation_scope: "project", namespace: "workshop" },
  })
  assert.equal(physical.length, 2)
  assert.deepEqual(all.entry.scopes, phase === "before" ? ["project", "global"] : [])
  assert.equal(available.entry, null)
  assert.deepEqual(installed.entry?.scopes ?? null, phase === "before" ? ["project", "global"] : null)
  const confirmed = await read("/project/current")
  assert.equal(confirmed.body.worktree, directory)
  const installRoute = "/expert-squad/install-payload"
  const rejected = await fetch(startup.url + installRoute + "?" + new URLSearchParams({ directory }), {
    method: "POST",
    headers: { "x-opencorvus-directory": directory, "content-type": "application/json" },
    body: JSON.stringify({ id: packageID, installationScope: "project" }),
  })
  const rejectedBody = await rejected.json()
  assert.equal(rejected.status, 400)
  const schema = doc.paths[installRoute].post.responses["400"].content["application/json"].schema
  assert.ok(ajv.compile({ ...schema, components: doc.components })(rejectedBody))
  assert.equal(rejectedBody.name, "ExpertSquadPackageError")
  assert.ok(rejectedBody.data.message.includes(path.join(directory, ".opencorvus", "expert-squads", "workshop", packageID)))
  const install = { requestID: rejected.headers.get("x-opencorvus-request-id"), status: rejected.status, body: rejectedBody }
  const result = { phase, step, all, available, installed, detail: { requestID: detail.requestID, scopes: actualDetailScopes }, physical, install }
  await fs.writeFile(path.join(root, phase + "-" + step + ".json"), JSON.stringify(result, null, 2) + "\n")
  console.log(JSON.stringify({ phase, step, listedScopes: all.entry.scopes, available: available.entry, detailScopes: actualDetailScopes, installationStatus: install.status, requestID: install.requestID }))
  process.exit(0)
}

assert.equal(physical.length, step === "initial" ? 1 : 2)
if (step === "installed") {
  assert.deepEqual(physical.find(({ source }) => source.installation_scope === "project")?.source, { kind: "installed_package", installation_scope: "project", namespace: "builtin" })
}
const expectedMarketScopes = step === "installed" ? ["project"] : []
assert.deepEqual(all.entry.scopes, phase === "before" ? [...expectedMarketScopes, "global"] : expectedMarketScopes)
assert.deepEqual(available.entry?.scopes ?? null, phase === "after" && step === "initial" ? [] : null)
assert.deepEqual(installed.entry?.scopes ?? null, phase === "after" && step === "initial" ? null : all.entry.scopes)
const result = {
  phase, step, all, available, installed,
  detail: { requestID: detail.requestID, namespace: detail.body.namespace, id: detail.body.id, scopes: actualDetailScopes },
  physical: { requestID: installations.requestID, entries: physical },
  active: { requestID: catalog.requestID, effective: catalog.body.active.effective },
}
await fs.writeFile(path.join(root, phase + "-" + step + ".json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ phase, step, listedScopes: all.entry.scopes, available: available.entry?.id ?? null, detailScopes: actualDetailScopes, physical: physical.map(({ source }) => source.namespace + ":" + source.installation_scope), active: result.active.effective }))
