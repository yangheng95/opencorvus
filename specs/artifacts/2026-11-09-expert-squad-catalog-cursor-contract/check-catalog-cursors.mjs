import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, step] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
assert.ok(["snapshot", "advance"].includes(step))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.url, "http://127.0.0.1:" + port)
assert.equal(startup.occurrenceID, "iteration-b70-" + phase)
const directory = await fs.realpath(seed.directory)
assert.equal(path.dirname(directory), root)
const docResponse = await fetch(startup.url + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const validators = new Map()
const read = async (route, query = {}) => {
  const global = route.startsWith("/global/")
  const response = await fetch(startup.url + route + "?" + new URLSearchParams({ ...(global ? {} : { directory }), ...query }), { headers: global ? {} : { "x-opencorvus-directory": directory } })
  const body = await response.json()
  const key = route + " " + response.status
  if (!validators.has(key)) {
    const schema = doc.paths[route].get.responses[String(response.status)]?.content?.["application/json"]?.schema
    assert.ok(schema, key)
    validators.set(key, ajv.compile({ ...schema, components: doc.components }))
  }
  const validate = validators.get(key)
  assert.ok(validate(body), key + " " + JSON.stringify(validate.errors))
  const requestID = response.headers.get("x-opencorvus-request-id")
  assert.ok(requestID, key)
  return { status: response.status, requestID, body }
}
const inspect = { id: "cursor-inspection", installationScope: "project", namespace: "scale" }
const cases = {
  projectSearch: ["/expert-squad/search", { view: "installations", limit: "1" }, "cursor", "next_cursor"],
  globalSearch: ["/global/composer-expert-squads", { view: "installations", limit: "1" }, "cursor", "next_cursor"],
  diagnostics: ["/expert-squad/diagnostics", { limit: "20" }, "cursor", "next_cursor"],
  workflow: ["/expert-squad/inspect", inspect, "workflowCursor", "next_workflow_cursor"],
  agent: ["/expert-squad/inspect", inspect, "agentCursor", "next_agent_cursor"],
}
const checkpointFile = path.join(root, phase + "-snapshot.json")
const original = step === "advance" ? JSON.parse(await fs.readFile(checkpointFile, "utf8")) : undefined
const result = { phase, step, cases: {} }
const firstPages = {}
for (const [key, [route, query]] of Object.entries(cases)) {
  const response = await read(route, query)
  assert.equal(response.status, 200, key)
  firstPages[key] = response
}
const ids = (key, body) =>
  key === "workflow" ? body.workflows.map((item) => item.id)
    : key === "agent" ? body.agents.map((item) => item.agent_id)
      : key === "diagnostics" ? body.entries.map((row) => row.issue?.id ?? row.warning.logical_id)
        : body.entries.map((row) => row.id)
const expectedFirst = {
  projectSearch: ["advanced"], globalSearch: ["advanced"],
  diagnostics: Array.from({ length: 20 }, (_, index) => "incomplete-" + String(index).padStart(3, "0")),
  workflow: Array.from({ length: 20 }, (_, index) => "flow-" + String(index).padStart(2, "0")),
  agent: Array.from({ length: 10 }, (_, index) => "worker-" + String(index).padStart(2, "0")),
}
const expectedNext = {
  projectSearch: ["base"], globalSearch: ["base"], diagnostics: ["incomplete-020", "data-analysis"],
  workflow: ["flow-20", "flow-21"], agent: ["worker-10", "worker-11"],
}
const expectFailure = (response, cause) => {
  if (phase === "before") {
    assert.equal(response.status, 500, cause)
    assert.equal(response.body.name, "UnknownError", cause)
  } else if (cause === "stale") {
    assert.equal(response.status, 409, cause)
    assert.equal(response.body.name, "ExpertSquadCatalogRevisionConflictError", cause)
  } else {
    assert.equal(response.status, 400, cause)
    assert.equal(response.body.name, "ExpertSquadCatalogCursorInvalidError", cause)
  }
  assert.ok(response.body.data.message, cause)
}
for (const [key, [route, query, param, nextKey]] of Object.entries(cases)) {
  const first = firstPages[key]
  const cursor = first.body[nextKey]
  assert.equal(typeof cursor, "string", key)
  assert.deepEqual(ids(key, first.body), expectedFirst[key], key)
  const next = await read(route, { ...query, [param]: cursor })
  assert.equal(next.status, 200, key)
  assert.deepEqual(ids(key, next.body), expectedNext[key], key)
  const entry = {
    route,
    first: { status: first.status, requestID: first.requestID, cursor, ids: ids(key, first.body) },
    next: { status: next.status, requestID: next.requestID, ids: ids(key, next.body) },
  }
  if (step === "snapshot") {
    const wrongCursor = key === "diagnostics" ? firstPages.projectSearch.body.next_cursor
      : key === "agent" ? firstPages.workflow.body.next_workflow_cursor
        : key === "workflow" ? firstPages.agent.body.next_agent_cursor
          : cursor
    const wrongParams = key.endsWith("Search") ? { ...query, query: "advanced", [param]: wrongCursor } : { ...query, [param]: wrongCursor }
    entry.invalid = await read(route, { ...query, [param]: "not-a-catalog-cursor" })
    entry.wrongQuery = await read(route, wrongParams)
    expectFailure(entry.invalid, "invalid")
    expectFailure(entry.wrongQuery, "wrongQuery")
  } else {
    entry.stale = await read(route, { ...query, [param]: original.cases[key].first.cursor })
    expectFailure(entry.stale, "stale")
  }
  result.cases[key] = entry
}
if (step === "advance") {
  const newPackage = { id: "deep-research", source: { kind: "installed_package", installation_scope: "global", namespace: "builtin" } }
  for (const key of ["projectSearch", "globalSearch"]) {
    const [route, query] = cases[key]
    const found = await read(route, { ...query, limit: "20", query: "deep research" })
    assert.equal(found.status, 200)
    const selected = found.body.entries.find((entry) => entry.id === newPackage.id)
    assert.deepEqual({ id: selected?.id, source: selected?.source }, newPackage)
    result.cases[key].newInstallation = { status: found.status, requestID: found.requestID, ...newPackage }
  }
}
const catalog = await read("/expert-squad/catalog")
assert.equal(catalog.status, 200)
assert.equal(catalog.body.active.effective, "dynamic")
result.active = { requestID: catalog.requestID, effective: catalog.body.active.effective }
await fs.writeFile(path.join(root, phase + "-" + step + ".json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ phase, step, cases: Object.fromEntries(Object.entries(result.cases).map(([key, value]) => [key, { next: value.next.ids, invalid: value.invalid?.status, wrongQuery: value.wrongQuery?.status, stale: value.stale?.status }])), active: result.active.effective }))
