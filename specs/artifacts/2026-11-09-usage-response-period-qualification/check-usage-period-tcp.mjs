import fs from "node:fs/promises"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const [evidenceDir, phase, servicePort, proxyPort, step] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
assert.ok(["misrouted", "recovered"].includes(step))
const service = "http://127.0.0.1:" + servicePort
const proxy = "http://127.0.0.1:" + proxyPort
const require = createRequire(resolve("packages/opencorvus/package.json"))
const Ajv2020 = require("ajv/dist/2020.js").default
const schemaResponse = await fetch(service + "/doc")
assert.equal(schemaResponse.status, 200)
const doc = await schemaResponse.json()
const route = "/global/usage"
const operation = doc.paths[route].get
assert.equal(operation.operationId, "global.usage")
const schema = operation.responses["200"].content["application/json"].schema
const validate = new Ajv2020({ strict: false, allErrors: true, validateFormats: false }).compile({ ...schema, components: doc.components })
const timeZone = "Asia/Shanghai"
const credentialsExcluded = ["openai-organization", "anthropic-organization", "openrouter-account"]
const checks = []
const calendarDate = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
const expectedCounts = { day: 24, week: 7, month: 30, year: 365 }

async function read(base, requestedPeriod, returnedPeriod) {
  const url = new URL(route, base)
  url.search = new URLSearchParams({ period: requestedPeriod, timeZone })
  const response = await fetch(url)
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  assert.deepEqual({ period: data.period, timeZone: data.timeZone, calls: data.current.summary.calls, tokens: data.current.summary.tokens.total }, { period: returnedPeriod, timeZone, calls: 0, tokens: 0 })
  const official = Object.fromEntries(data.official.sources.map(source => [source.id, source.status]))
  for (const id of credentialsExcluded) assert.equal(official[id], "unconfigured")
  assert.equal(data.official.rule, "compare_never_sum")
  assert.equal(data.buckets.length, expectedCounts[returnedPeriod])
  assert.equal(data.buckets[0].start, data.current.start)
  assert.equal(data.buckets.at(-1).end, data.current.end)
  checks.push({
    base, requestedPeriod, returnedPeriod, timeZone, status: response.status, requestID: response.headers.get("x-opencorvus-request-id"),
    grain: data.grain, start: data.current.start, end: data.current.end, bucketCount: data.buckets.length,
    firstLocalDate: calendarDate.format(data.current.start), lastLocalDate: calendarDate.format(data.current.end - 1),
    summary: data.current.summary, officialStatuses: official, schemaValid: true,
  })
}
if (step === "misrouted") {
  for (const period of ["day", "week", "month", "year"]) await read(service, period, period)
}
await read(proxy, "week", step === "misrouted" ? "year" : "week")
await fs.writeFile(resolve(evidenceDir, phase + "-" + step + "-tcp.json"), JSON.stringify({ phase, step, checks }, null, 2) + "\n")
console.log(JSON.stringify({ phase, step, checks: checks.map(({ requestedPeriod, returnedPeriod, status, bucketCount }) => ({ requestedPeriod, returnedPeriod, status, bucketCount })) }))
