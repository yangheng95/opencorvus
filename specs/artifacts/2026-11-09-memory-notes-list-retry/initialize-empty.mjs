import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [root, port] = process.argv.slice(2)
const { directory } = JSON.parse(await readFile(path.join(root, "empty-seed.json"), "utf8"))
const base = "http://127.0.0.1:" + port
const query = "?" + new URLSearchParams({ directory })
const receipt = async (route, init) => {
  const response = await fetch(base + route + (route === "/doc" ? "" : query), init)
  assert.equal(response.status, 200)
  return { status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), body: await response.json() }
}
const original = await receipt("/project/current")
const project = await receipt("/project/current", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Empty Notes Project" }),
})
assert.deepEqual([project.body.id, project.body.worktree, project.body.name], [original.body.id, directory, "Empty Notes Project"])
const doc = (await receipt("/doc")).body
const list = await receipt("/panel/knowledge/memory")
const schema = doc.paths["/panel/knowledge/memory"].get.responses["200"].content["application/json"].schema
const validate = new Ajv2020({ strict: false, validateFormats: false }).compile({ ...schema, components: doc.components })
assert.equal(validate(list.body), true, JSON.stringify(validate.errors))
assert.deepEqual(list.body, [])
await writeFile(path.join(root, "empty-initialized.json"), JSON.stringify({ directory, original, project, list }, null, 2) + "\n")
console.log(JSON.stringify({ projectID: project.body.id, emptyListRequestID: list.requestID }))
