import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.url, "http://127.0.0.1:" + port)
assert.equal(startup.occurrenceID, "iteration-b76-" + phase)
const paths = await Promise.all(Object.values(seed).map((project) => fs.realpath(project.directory)))
for (const directory of paths) assert.equal(path.dirname(directory), root)
const document = await fetch(startup.url + "/doc")
assert.equal(document.status, 200)
const doc = await document.json()
const ajv = new Ajv2020({ strict: false, validateFormats: false })
const compiled = new Map()
const read = async (route, query = {}) => {
  const response = await fetch(startup.url + route + "?" + new URLSearchParams(query))
  assert.equal(response.status, 200, route)
  const body = await response.json()
  if (!compiled.has(route)) compiled.set(route, ajv.compile({
    ...doc.paths[route].get.responses["200"].content["application/json"].schema,
    components: doc.components,
  }))
  const validate = compiled.get(route)
  assert.ok(validate(body), JSON.stringify(validate.errors))
  const requestID = response.headers.get("x-opencorvus-request-id")
  assert.ok(requestID)
  return { status: response.status, requestID, body }
}
const [discovery, schedule, ...projects] = await Promise.all([
  read("/global/projects/discover"),
  read("/global/automations"),
  ...paths.map((directory) => read("/project/current", { directory })),
])
assert.deepEqual(schedule.body, [])
assert.deepEqual(discovery.body.projects.map((project) => project.directory).sort(), [...paths].sort())
assert.equal(discovery.body.defaultDirectory, paths[0])
assert.equal(new Set(discovery.body.projects.map((project) => project.id)).size, paths.length)
for (const [index, project] of projects.entries()) {
  const directory = paths[index]
  const discovered = discovery.body.projects.find((item) => item.directory === directory)
  assert.equal(discovered.name, path.basename(directory))
  assert.equal(project.body.worktree, directory)
  assert.ok(project.body.id)
  assert.equal(discovered.id, project.body.id)
}
const evidence = { phase, discovery, schedule, projects }
await fs.writeFile(path.join(root, phase + "-read-check.json"), JSON.stringify(evidence, null, 2) + "\n")
console.log(JSON.stringify({ phase, ids: projects.map((project) => project.body.id), requests: [discovery, schedule, ...projects].map((result) => result.requestID) }))
