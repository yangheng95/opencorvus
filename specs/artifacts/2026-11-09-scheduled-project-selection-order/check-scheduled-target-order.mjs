import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, step, observation] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
assert.ok(["seed", "read"].includes(step))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.url, "http://127.0.0.1:" + port)
assert.equal(startup.occurrenceID, "iteration-b77-" + phase)
const docResponse = await fetch(startup.url + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict: false, validateFormats: false })
const compiled = new Map()
const request = async (route, options = {}) => {
  const { method = "GET", query = {}, input, status = 200, spec = route } = options
  const response = await fetch(startup.url + route + "?" + new URLSearchParams(query), {
    method, ...(input ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : {}),
  })
  const raw = await response.text()
  assert.equal(response.status, status, route + ": " + raw)
  const body = JSON.parse(raw)
  const key = method + " " + spec + " " + status
  if (!compiled.has(key)) compiled.set(key, ajv.compile({
    ...doc.paths[spec][method.toLowerCase()].responses[status].content["application/json"].schema,
    components: doc.components,
  }))
  const validate = compiled.get(key)
  assert.ok(validate(body), JSON.stringify(validate.errors))
  const requestID = response.headers.get("x-opencorvus-request-id")
  assert.ok(requestID)
  return { status: response.status, requestID, body }
}
const schedule = "/global/automations"
const read = async (name) => JSON.parse(await fs.readFile(path.join(root, name), "utf8"))
const write = async (name, value) => fs.writeFile(path.join(root, name), JSON.stringify(value, null, 2) + "\n")
const recurrence = "DTSTART;TZID=Asia/Shanghai:20990105T090000\nRRULE:FREQ=DAILY"
const future = Date.parse("2099-01-05T01:00:00Z")
if (step === "seed") {
  assert.deepEqual((await request(schedule)).body, [])
  const projects = {}
  for (const [name, original] of Object.entries(seed)) {
    const directory = await fs.realpath(original.directory)
    assert.equal(path.dirname(directory), root)
    const response = await request("/project/current", { query: { directory } })
    assert.equal(response.body.worktree, directory)
    assert.ok(response.body.id)
    projects[name] = { directory, id: response.body.id, requestID: response.requestID }
  }
  const ids = Object.values(projects).map((project) => project.id)
  assert.equal(new Set(ids).size, 3)
  const discovery = await request("/global/projects/discover")
  assert.deepEqual(discovery.body.projects.map((project) => project.id).sort(), [...ids].sort())
  const created = await request(schedule, { method: "POST", status: 201, input: {
    name: "Isolated target order " + phase + " 77",
    target: { scope: "project", projectIds: ids.slice(0, 2) },
    recurrence, executionMode: "local",
    prompt: "Fixture for checking authored order only. This paused plan is never run.",
  } })
  assert.equal(created.body.nextRun, future)
  const id = created.body.id
  const paused = await request(schedule + "/" + id, {
    method: "PATCH", spec: schedule + "/{id}", input: { expectedRevisionId: created.body.revisionId, status: "paused" },
  })
  assert.equal(paused.body.status, "paused")
  assert.equal(paused.body.lastRun, null)
  assert.equal(paused.body.recurrence, recurrence)
  assert.deepEqual(paused.body.target.projectIds, ids.slice(0, 2))
  const result = { phase, projects, discovery: discovery.requestID, created, paused }
  await write(phase + "-paused-plan.json", result)
  console.log(JSON.stringify({ phase, ids, plan: paused.body, requests: [created.requestID, paused.requestID] }))
} else {
  const baseline = await read(phase + "-paused-plan.json")
  const ids = Object.values(baseline.projects).map((project) => project.id)
  const response = await request(schedule)
  assert.equal(response.body.length, 1)
  const [plan] = response.body
  assert.equal(plan.id, baseline.paused.body.id)
  assert.notEqual(plan.revisionId, baseline.paused.body.revisionId)
  assert.equal(plan.status, "paused")
  assert.equal(plan.recurrence, recurrence)
  assert.equal(plan.lastRun, null)
  assert.equal(plan.prompt, baseline.paused.body.prompt)
  const order = plan.target.projectIds
  assert.deepEqual(order, phase === "after" ? ids : [ids[1], ids[0], ids[2]])
  const runs = await request(schedule + "/" + plan.id + "/runs", { spec: schedule + "/{id}/runs" })
  assert.deepEqual(runs.body, [])
  const result = { phase, response, runs, order, expected: ids }
  await write(phase + "-edited-plan" + (observation === "post-cancel" ? "-post-cancel" : "") + ".json", result)
  console.log(JSON.stringify({ phase, order, expected: ids, requestID: response.requestID, revision: plan.revisionId }))
}
