import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [root, phase, port] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after")
const project = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const base = "http://127.0.0.1:" + port
const schema = await fetch(base + "/doc")
assert.equal(schema.status, 200)
const doc = await schema.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const read = async (route, operationId) => {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  const validate = ajv.compile({ ...op.responses["200"].content["application/json"].schema, components: doc.components })
  const response = await fetch(base + route, { headers: { "x-opencorvus-directory": project.directory } })
  assert.equal(response.status, 200)
  const value = await response.json()
  assert.ok(validate(value), JSON.stringify(validate.errors))
  return { value, status: response.status, operationId, requestID: response.headers.get("x-opencorvus-request-id") }
}
const current = await read("/project/current", "project.current")
const projects = await read("/project", "project.list")
assert.equal(current.value.worktree, project.directory)
assert.deepEqual(projects.value, [current.value])
assert.equal(doc.paths["/attachment/{projectID}/{name}"].get.operationId, "attachment.get")
const files = []
const folder = path.join(project.directory, ".opencorvus/.r/project/attachments")
const names = phase === "after" ? ["owned-readable-text.txt", "owned-second-text.txt"] : ["owned-readable-text.txt"]
for (const entry of await fs.readdir(folder, { recursive: true })) {
  if (!entry.endsWith(".metadata.json")) continue
  const meta = JSON.parse(await fs.readFile(path.join(folder, entry), "utf8"))
  assert.ok(names.includes(meta.filename))
  assert.ok(meta.url.startsWith("/attachment/" + current.value.id + "/"))
  const source = await fs.readFile(path.join(root, "inputs", meta.filename))
  assert.equal(meta.size, source.length)
  assert.deepEqual(await fs.readFile(path.join(folder, entry.slice(0, -".metadata.json".length))), source)
  const response = await fetch(base + meta.url)
  assert.equal(response.status, 200)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), source)
  files.push({ name: meta.filename, url: meta.url, bytes: source.length, status: response.status, requestID: response.headers.get("x-opencorvus-request-id") })
}
assert.deepEqual(files.map(x => x.name).sort(), names)
const result = { phase, project: current.value.id, checks: [current, projects].map(({value, ...fact}) => fact), files }
await fs.writeFile(path.join(root, phase + "-project-and-originals.json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result))