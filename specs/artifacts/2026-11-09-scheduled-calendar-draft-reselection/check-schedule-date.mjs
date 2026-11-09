import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, step, expectedDate = "2099-01-05", expectedTime = "14:37"] = process.argv.slice(2)
assert.ok(["before", "after", "final", "accepted", "delivery"].includes(phase))
assert.ok(["empty", "active", "paused"].includes(step))
const root = path.dirname(fileURLToPath(import.meta.url))
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.url, "http://127.0.0.1:" + port)
assert.equal(startup.occurrenceID, "iteration-b80-" + phase)
const docResponse = await fetch(startup.url + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict: false, validateFormats: false })
const read = async (route, spec = route) => {
  const response = await fetch(startup.url + route)
  assert.equal(response.status, 200)
  const body = await response.json()
  const validate = ajv.compile({ ...doc.paths[spec].get.responses[200].content["application/json"].schema, components: doc.components })
  assert.ok(validate(body), JSON.stringify(validate.errors))
  const requestID = response.headers.get("x-opencorvus-request-id")
  assert.ok(requestID)
  return { status: response.status, requestID, body }
}
const schedule = "/global/automations"
const plans = await read(schedule)
let runs
if (step === "empty") {
  assert.deepEqual(plans.body, [])
} else {
  assert.equal(plans.body.length, 1)
  const [plan] = plans.body
  assert.equal(plan.name, "日期恢复验收 80")
  assert.equal(plan.prompt, "仅验证日历补全日期，不运行。")
  assert.deepEqual(plan.target, { scope: "global" })
  assert.equal(plan.status, step)
  assert.equal(plan.recurrence, "DTSTART;TZID=Asia/Shanghai:" + expectedDate.replaceAll("-", "") + "T" + expectedTime.replace(":", "") + "00\nRRULE:FREQ=DAILY")
  assert.equal(plan.nextRun, Date.parse(expectedDate + "T" + expectedTime + ":00+08:00"))
  assert.equal(plan.lastRun, null)
  runs = await read(schedule + "/" + plan.id + "/runs", schedule + "/{id}/runs")
  assert.deepEqual(runs.body, [])
}
const evidence = { phase, step, plans, runs }
await fs.writeFile(path.join(root, phase + "-" + step + ".json"), JSON.stringify(evidence, null, 2) + "\n")
console.log(JSON.stringify(evidence))
