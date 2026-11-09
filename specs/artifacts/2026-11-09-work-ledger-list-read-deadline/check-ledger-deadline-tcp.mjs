import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
const [root, phase, port] = process.argv.slice(2)
const require = createRequire(path.resolve("packages/opencorvus/package.json"))
const Ajv = require("ajv/dist/2020")
const endpoint = "http://127.0.0.1:" + port
const owned = JSON.parse(await fs.readFile(path.join(root, phase + "-archive.json"), "utf8"))
const spec = await fetch(endpoint + "/doc")
assert.equal(spec.status, 200)
const doc = await spec.json()
const ajv = new Ajv({ strict: false, validateFormats: false })
const reads = []
async function read(route, operation, query, requestPath = route) {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operation)
  const response = await fetch(endpoint + requestPath + "?" + new URLSearchParams(query))
  assert.equal(response.status, 200)
  const body = await response.json()
  const validate = ajv.compile({ ...op.responses["200"].content["application/json"].schema, components: doc.components })
  assert.ok(validate(body), JSON.stringify(validate.errors))
  reads.push({ route: requestPath, query, status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), body })
  return body
}
const current = await read("/work-ledger", "workLedger.list", { search: "Ledger deadline", limit: "12" })
assert.deepEqual(current.rows.map(({ kind, id, title, directory }) => ({ kind, id, title, directory })),
  [{ kind: "project", ...owned.project }])
const archive = await read("/work-ledger/archive", "workLedger.listArchived", { search: "Ledger deadline", limit: "100" })
const projection = ({ id, title, directory, archived }) => ({ id, title, directory, archived })
assert.deepEqual(archive.rows.map(projection), owned.pages[0].rows.map(projection))
const item = archive.rows[0]
const selected = await read("/work-ledger/selection/{kind}/{id}", "workLedger.selection", { directory: item.directory },
  "/work-ledger/selection/session/" + encodeURIComponent(item.id))
assert.deepEqual(projection(selected), projection(item))
const file = await read("/file/content", "file.read", { directory: owned.project.directory, path: "note.txt" })
assert.equal(file.content, "Owned ledger read deadline " + phase + "\n")
await fs.writeFile(path.join(root, phase + "-ledger-tcp.json"), JSON.stringify({ phase, reads }, null, 2) + "\n")
console.log(JSON.stringify(reads.map(({ route, requestID }) => [route, requestID])))
