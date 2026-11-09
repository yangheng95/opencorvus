import assert from "node:assert/strict"
import fs from "node:fs/promises"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [port, phase = "before"] = process.argv.slice(2)
const base = "http://127.0.0.1:" + port
const temp = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b101"
const documented = await fetch(base + "/doc")
assert.equal(documented.status, 200)
const doc = await documented.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const probes = [
  ["/file", { path: "" }],
  ["/file", { path: "opal-empty" }],
  ["/file", { path: "opal-nested" }],
  ["/file", { path: "opal-occupied" }],
  ["/find/file", { query: "opal-empty", type: "directory", limit: "25" }],
  ["/find/file", { query: "opal-empty-child", type: "directory", limit: "25" }],
  ["/find/file", { query: "opal-occupied", type: "directory", limit: "25" }],
  ["/find/file", { query: "opal-note", type: "file", limit: "25" }],
  ["/find/file", { query: "opal-ignored", type: "directory", limit: "25" }],
  ["/find/file", { query: "", type: "directory", limit: "25" }],
]
const read = []
for (const [route, query] of probes) {
  const url = new URL(route, base)
  url.search = new URLSearchParams({ ...query, directory: temp + "/project-" + phase })
  const response = await fetch(url)
  assert.equal(response.status, 200, route + " " + JSON.stringify(query) + " — " + (response.ok ? "" : await response.text()))
  const body = await response.json()
  const schema = doc.paths[route].get.responses["200"].content["application/json"].schema
  const validate = ajv.compile({ ...schema, components: doc.components })
  assert.ok(validate(body), JSON.stringify(validate.errors))
  read.push({ route, query, status: response.status, body })
}
assert.equal(read[0].body.find(entry => entry.name === "opal-empty")?.type, "directory")
assert.equal(read[2].body.find(entry => entry.name === "opal-empty-child")?.type, "directory")
assert.equal(read[6].body[0], "opal-occupied/")
assert.match(read[7].body[0], /opal-occupied[\\/]opal-note\.txt/)
if (phase === "after") {
  assert.equal(read[4].body[0], "opal-empty/")
  assert.equal(read[5].body[0], "opal-nested\\opal-empty-child/")
  assert.deepEqual(read[9].body.filter(path => path.startsWith("opal-")), ["opal-empty/", "opal-nested/", "opal-nested\\opal-empty-child/", "opal-occupied/"])
  const route = "/find/file"
  const query = { query: "opal-", type: "directory", limit: "25", directory: temp + "/project-sibling" }
  const response = await fetch(base + route + "?" + new URLSearchParams(query))
  assert.equal(response.status, 200)
  const body = await response.json()
  const schema = doc.paths[route].get.responses["200"].content["application/json"].schema
  const validate = ajv.compile({ ...schema, components: doc.components })
  assert.ok(validate(body), JSON.stringify(validate.errors))
  assert.deepEqual(body, ["opal-sibling-empty/"])
  read.push({ route, query, status: response.status, body })
}
await fs.writeFile(temp + "/" + phase + "-file-search.json", JSON.stringify({ base, read }, null, 2) + "\n")
console.log(JSON.stringify(read.map(({ route, query, body }) => ({ route, query, body: route === "/file" ? body.map(({ name, type }) => ({ name, type })) : body }))))