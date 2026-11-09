import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, stage] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
assert.ok(["snapshot", "advance"].includes(stage))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.url, "http://127.0.0.1:" + port)
assert.equal(startup.occurrenceID, "iteration-b71-" + phase)
const directory = await fs.realpath(seed.directory)
assert.equal(path.dirname(directory), root)
const docResponse = await fetch(startup.url + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const validators = new Map()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const read = async (route, params = {}) => {
  const response = await fetch(startup.url + route + "?" + new URLSearchParams({ directory, ...params }), { headers: { "x-opencorvus-directory": directory } })
  const body = await response.json()
  const key = route + " " + response.status
  if (!validators.has(key)) {
    const schema = doc.paths[route].get.responses[String(response.status)]?.content?.["application/json"]?.schema
    assert.ok(schema, key)
    validators.set(key, ajv.compile({ ...schema, components: doc.components }))
  }
  const validate = validators.get(key)
  const schemaMatches = validate(body)
  const requestID = response.headers.get("x-opencorvus-request-id")
  assert.ok(requestID, key)
  return { status: response.status, requestID, schemaMatches, body }
}
const route = "/expert-squad/market"
const query = { availability: "all", limit: "1" }
const all = await read(route, { ...query, limit: "20" })
const first = await read(route, query)
assert.equal(typeof first.body.next_cursor, "string")
const next = await read(route, { ...query, cursor: first.body.next_cursor })
const installed = await read(route, { availability: "installed", limit: "20" })
const catalog = await read("/expert-squad/catalog")
for (const observation of [all, first, next, installed, catalog]) {
  assert.equal(observation.status, 200)
  assert.ok(observation.schemaMatches)
}
assert.equal(first.body.total_count, all.body.total_count)
assert.equal(next.body.total_count, all.body.total_count)
assert.deepEqual([...first.body.entries, ...next.body.entries], all.body.entries.slice(0, 2))
assert.equal(catalog.body.active.effective, "dynamic")
assert.deepEqual(installed.body.entries.map(({ id, installation_scopes }) => ({ id, installation_scopes })), stage === "snapshot" ? [] : [{ id: "deep-research", installation_scopes: ["project"] }])
const result = {
  phase, stage, total: all.body.total_count,
  first: { requestID: first.requestID, cursor: first.body.next_cursor, id: first.body.entries[0].id },
  next: { requestID: next.requestID, id: next.body.entries[0].id },
  installed: { requestID: installed.requestID, entries: installed.body.entries.map(({ id, namespace, installation_scopes }) => ({ id, namespace, installation_scopes })) },
  active: { requestID: catalog.requestID, effective: catalog.body.active.effective },
}
if (stage === "snapshot") {
  result.malformed = await read(route, { ...query, cursor: "malformed-market-cursor" })
  result.wrongQuery = await read(route, { ...query, availability: "available", cursor: first.body.next_cursor })
  result.parameterValidation = await read(route, { ...query, limit: "0" })
  for (const failure of [result.malformed, result.wrongQuery]) {
    assert.equal(failure.status, 400)
    assert.equal(failure.body.name, phase === "before" ? "ExpertSquadPackageError" : "ExpertSquadCatalogCursorInvalidError")
    assert.ok(failure.schemaMatches)
  }
  assert.equal(result.parameterValidation.status, 400)
  assert.equal(result.parameterValidation.body.success, false)
  assert.equal(result.parameterValidation.schemaMatches, phase === "after")
} else {
  const original = JSON.parse(await fs.readFile(path.join(root, phase + "-snapshot.json"), "utf8"))
  result.stale = await read(route, { ...query, cursor: original.first.cursor })
  assert.equal(result.stale.status, phase === "before" ? 400 : 409)
  assert.equal(result.stale.body.name, phase === "before" ? "ExpertSquadPackageError" : "ExpertSquadCatalogRevisionConflictError")
  assert.ok(result.stale.schemaMatches)
}
if (phase === "after" && stage === "snapshot") {
  const previous = JSON.parse(await fs.readFile(path.join(root, "before-snapshot.json"), "utf8"))
  const fromPreviousBuild = await read(route, { ...query, cursor: previous.first.cursor })
  assert.equal(fromPreviousBuild.status, 200)
  assert.ok(fromPreviousBuild.schemaMatches)
  assert.deepEqual(fromPreviousBuild.body.entries, next.body.entries)
  result.previousBuildCursor = { status: fromPreviousBuild.status, requestID: fromPreviousBuild.requestID, id: fromPreviousBuild.body.entries[0].id }
}
await fs.writeFile(path.join(root, phase + "-" + stage + ".json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ phase, stage, total: result.total, first: result.first.id, next: result.next.id, installed: result.installed.entries, malformed: result.malformed?.body?.name, wrongQuery: result.wrongQuery?.body?.name, parameterSchema: result.parameterValidation?.schemaMatches, stale: result.stale?.status }))
