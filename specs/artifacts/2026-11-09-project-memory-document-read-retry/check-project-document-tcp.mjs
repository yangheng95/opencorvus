import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [root, port] = process.argv.slice(2)
const base = "http://127.0.0.1:" + port
const seed = JSON.parse(await readFile(path.join(root, "seed.json"), "utf8"))
const registration = JSON.parse(await readFile(path.join(root, "after-initialize.json"), "utf8"))
const expected = registration.map(({ slug, after: { data } }) => ({
  slug,
  id: data.id,
  directory: data.worktree,
  name: data.name,
}))
const documentResponse = await fetch(base + "/doc")
assert.equal(documentResponse.status, 200)
const document = await documentResponse.json()
const results = [{ route: "/doc", status: documentResponse.status, requestID: documentResponse.headers.get("x-opencorvus-request-id") }]
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const validators = new Map()
async function scopedGet(route, project) {
  const query = project ? "?" + new URLSearchParams({ directory: project.directory }) : ""
  const response = await fetch(base + route + query)
  assert.equal(response.status, 200)
  const body = await response.json()
  if (!validators.has(route)) {
    const schema = document.paths[route].get.responses["200"].content["application/json"].schema
    validators.set(route, ajv.compile({ ...schema, components: document.components }))
  }
  const validator = validators.get(route)
  assert.equal(validator(body), true, JSON.stringify(validator.errors))
  results.push({ route, project, status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), schemaValid: true, body })
  return body
}
const ledger = await scopedGet("/work-ledger")
assert.equal(ledger.nextCursor, null)
const stable = rows => rows.sort((a, b) => a.id.localeCompare(b.id))
assert.deepEqual(
  stable(ledger.rows.map(({ id, kind, title, directory }) => ({ id, kind, name: title, directory }))),
  stable(expected.map(({ id, name, directory }) => ({ id, kind: "project", name, directory }))),
)
for (const project of expected) {
  const registered = await scopedGet("/project/current", project)
  assert.deepEqual([registered.id, registered.name, registered.worktree], [project.id, project.name, project.directory])
  const memory = await scopedGet("/experimental/project-memory", project)
  assert.deepEqual([memory.revision, memory.tokenCount, memory.content], [0, 0, ""])
  assert.deepEqual(await scopedGet("/panel/knowledge/memory", project), [])
}
const actualDocuments = results.filter(item => item.route === "/experimental/project-memory")
assert.equal(new Set(actualDocuments.map(item => item.body.timeUpdated)).size, 2)
const originalFiles = []
for (const [phase, fixtures] of Object.entries(seed)) {
  for (const [slug, { directory, head }] of Object.entries(fixtures)) {
    const gitHead = execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
    const note = await readFile(path.join(directory, "note.txt"), "utf8")
    assert.equal(gitHead, head)
    assert.equal(note, "Owned protected memory recovery " + slug + "\n")
    originalFiles.push({ phase, slug, directory, gitHead, note })
  }
}
await writeFile(path.join(root, "after-live-check.json"), JSON.stringify({ results, originalFiles }, null, 2) + "\n")
console.log(JSON.stringify({ liveResponses: results.length, originalFiles: originalFiles.length, requestIDs: results.map(r => r.requestID) }))
