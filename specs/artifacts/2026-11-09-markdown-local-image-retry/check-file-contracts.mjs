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
const checks = []
const read = async (route, operationId, query = {}) => {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  const validate = ajv.compile({ ...op.responses["200"].content["application/json"].schema, components: doc.components })
  const url = new URL(route, base)
  url.search = new URLSearchParams(query)
  const response = await fetch(url, { headers: { "x-opencorvus-directory": project.directory } })
  assert.equal(response.status, 200)
  const value = await response.json()
  assert.ok(validate(value), JSON.stringify(validate.errors))
  checks.push({ status: response.status, operationId, query, requestID: response.headers.get("x-opencorvus-request-id") })
  return value
}
const current = await read("/project/current", "project.current")
assert.equal(current.worktree, project.directory)
assert.deepEqual(await read("/project", "project.list"), [current])
const facts = []
for (const file of ["guide.md", "other.md", "media/retry-diagram.svg", "media/sibling.svg"]) {
  const abs = path.join(project.directory, file)
  const expected = await fs.readFile(abs)
  const isImage = file.endsWith(".svg")
  for (const [route, operationId, requested] of [["/file/content", "file.read", file], ["/file/source-content", "file.readSource", abs]]) {
    const value = await read(route, operationId, { path: requested, directory: project.directory })
    assert.equal(value.type, "text")
    if (isImage) {
      assert.equal(value.encoding, "base64")
      assert.equal(value.mimeType, "image/svg+xml")
    }
    assert.deepEqual(Buffer.from(value.content, isImage ? "base64" : "utf8"), expected)
    facts.push({ file, operationId, bytes: expected.length, mime: value.mimeType })
  }
}
const result = { phase, project: current.id, checks, facts }
await fs.writeFile(path.join(root, phase + "-file-contracts.json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ phase, project: current.id, checks: checks.length, facts }))