import assert from "node:assert/strict"
import fs from "node:fs/promises"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [port, phase] = process.argv.slice(2)
const root = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b100"
const base = "http://127.0.0.1:" + port
const liveDoc = await fetch(base + "/doc")
assert.equal(liveDoc.status, 200)
const doc = await liveDoc.json()
const op = doc.paths["/global/usage"].get
assert.equal(op.operationId, "global.usage")
const validate = new Ajv2020({ strict: false, allErrors: true, validateFormats: false }).compile({
  ...op.responses["200"].content["application/json"].schema,
  components: doc.components,
})
const expected = {
  "openai-organization": "unconfigured",
  "anthropic-organization": "unconfigured",
  "openrouter-account": "unconfigured",
  "aws-bedrock-control-plane": "requires_configuration",
  "azure-openai-control-plane": "requires_configuration",
  "vertex-ai-control-plane": "requires_configuration",
}
const checks = []
for (const [period, buckets] of [["day", 24], ["week", 7], ["month", 30], ["year", 365]]) {
  const response = await fetch(base + "/global/usage?" + new URLSearchParams({ period, timeZone: "Asia/Shanghai" }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(validate(body), JSON.stringify(validate.errors))
  assert.deepEqual([body.period, body.timeZone, body.buckets.length, body.current.summary.calls, body.official.rule],
    [period, "Asia/Shanghai", buckets, 0, "compare_never_sum"])
  const inventory = Object.fromEntries(body.official.sources.map(({ id, status }) => [id, status]))
  assert.deepEqual(inventory, expected)
  const cloudLinks = body.official.sources.filter(source => source.status === "requires_configuration").map(({ id, documentationURL }) => ({ id, documentationURL }))
  assert.deepEqual(Object.fromEntries(cloudLinks.map(({ id, documentationURL }) => [id, new URL(documentationURL).hostname])), {
    "aws-bedrock-control-plane": "docs.aws.amazon.com",
    "azure-openai-control-plane": "learn.microsoft.com",
    "vertex-ai-control-plane": "cloud.google.com",
  })
  checks.push({ period, buckets, inventory, cloudLinks, comparison: body.official.rule, schemaValid: true })
}
await fs.writeFile(root + "/" + phase + "-tcp.json", JSON.stringify({ phase, operation: op.operationId, checks }, null, 2) + "\n")
console.log(JSON.stringify({ phase, responses: checks.length, inventory: checks[0].inventory, comparison: checks[0].comparison }))