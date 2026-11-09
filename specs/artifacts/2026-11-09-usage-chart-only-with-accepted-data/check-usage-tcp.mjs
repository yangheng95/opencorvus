import fs from "node:fs/promises"
import assert from "node:assert/strict"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"
const [phase, port, step] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after")
assert.ok(step === "online" || step === "recovered")
const root = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b98"
const base = "http://127.0.0.1:" + port
const schemaResponse = await fetch(base + "/doc")
assert.equal(schemaResponse.status, 200)
const doc = await schemaResponse.json()
const route = "/global/usage"
const operation = doc.paths[route].get
assert.equal(operation.operationId, "global.usage")
const schema = operation.responses["200"].content["application/json"].schema
const validate = new Ajv2020({ strict: false, allErrors: true, validateFormats: false }).compile({ ...schema, components: doc.components })
const credentialsExcluded = ["openai-organization", "anthropic-organization", "openrouter-account"]
const checks = []
const calendarDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" })
for (const [period, timeZone] of [["year", "Asia/Shanghai"], ["day", "Asia/Shanghai"], ["week", "Asia/Shanghai"], ["month", "Asia/Shanghai"]]) {
  const url = new URL(route, base)
  url.search = new URLSearchParams({ period, timeZone })
  const response = await fetch(url)
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  assert.deepEqual({ period: data.period, timeZone: data.timeZone, calls: data.current.summary.calls, tokens: data.current.summary.tokens.total }, { period, timeZone, calls: 0, tokens: 0 })
  const official = Object.fromEntries(data.official.sources.map(source => [source.id, source.status]))
  for (const id of credentialsExcluded) assert.equal(official[id], "unconfigured")
  assert.equal(data.official.rule, "compare_never_sum")
  assert.ok(data.buckets.length > 0)
  assert.equal(data.buckets[0].start, data.current.start)
  assert.equal(data.buckets.at(-1).end, data.current.end)
  assert.ok(data.buckets.every(bucket => bucket.tokens.total === 0))
  if (period === "day") assert.equal(data.buckets.length, 24)
  if (period === "week") assert.equal(data.buckets.length, 7)
  if (period === "month") assert.equal(data.buckets.length, 30)
  if (period === "year") assert.equal(data.buckets.length, 365)
  checks.push({ status: response.status, period, timeZone, grain: data.grain, start: data.current.start, end: data.current.end, firstLocalDate: calendarDate.format(data.current.start), lastLocalDate: calendarDate.format(data.current.end - 1), summary: data.current.summary, bucketCount: data.buckets.length, first: data.buckets[0], last: data.buckets.at(-1), officialStatuses: official, schemaValid: true })
}
const result = { phase, step, operation: operation.operationId, checks }
await fs.writeFile(root + "/" + phase + "-" + step + "-tcp.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ phase, step, statuses: checks.map(check => check.status), periods: checks.map(check => [check.period, check.bucketCount]), schemaValid: true }))