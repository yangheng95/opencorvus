import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, stage] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
assert.ok(["empty", "saved"].includes(stage))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.url, "http://127.0.0.1:" + port)
assert.equal(startup.occurrenceID, "iteration-b75-" + phase)
const directory = await fs.realpath(seed.directory)
assert.equal(path.dirname(directory), root)
const document = await fetch(startup.url + "/doc")
assert.equal(document.status, 200)
const doc = await document.json()
const ajv = new Ajv2020({ strict: false, validateFormats: false })
const read = async (route, query = {}) => {
  const response = await fetch(startup.url + route + "?" + new URLSearchParams(query), { headers: { "x-opencorvus-directory": directory } })
  assert.equal(response.status, 200, route)
  const body = await response.json()
  const validate = ajv.compile({ ...doc.paths[route].get.responses["200"].content["application/json"].schema, components: doc.components })
  assert.ok(validate(body), JSON.stringify(validate.errors))
  const requestID = response.headers.get("x-opencorvus-request-id")
  assert.ok(requestID)
  return { status: response.status, requestID, body }
}
const [missions, automations] = await Promise.all([read("/mission", { directory }), read("/global/automations")])
assert.deepEqual(automations.body, [])
if (stage === "empty") {
  assert.deepEqual(missions.body, [])
} else {
  const expected = JSON.parse(await fs.readFile(path.join(root, "expected-draft.json"), "utf8"))
  assert.equal(missions.body.length, 1)
  const [mission] = missions.body
  assert.equal(mission.title, expected.title)
  assert.equal(mission.pendingPrompt.text, expected.request)
  assert.equal(mission.directory, directory)
  assert.equal(mission.productPillar, "work")
  assert.equal(mission.boardLane, "backlog")
  assert.deepEqual(mission.taskStats, { total: 0, running: 0, inactive: 0 })
  assert.ok(mission.missionID && mission.sessionID)
}
const evidence = { phase, stage, missions, automations }
await fs.writeFile(path.join(root, phase + "-" + stage + ".json"), JSON.stringify(evidence, null, 2) + "\n")
console.log(JSON.stringify(evidence))
