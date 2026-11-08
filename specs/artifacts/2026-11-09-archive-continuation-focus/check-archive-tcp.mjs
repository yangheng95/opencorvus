import fs from "node:fs/promises"
import assert from "node:assert/strict"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, point] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after")
assert.ok(point === "online" || point === "recovered")
const root = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b48"
const expected = JSON.parse(await fs.readFile(root + "/" + phase + "-archive.json", "utf8"))
const base = "http://127.0.0.1:" + port
const schemaReply = await fetch(base + "/doc")
assert.equal(schemaReply.status, 200)
const doc = await schemaReply.json()
const route = "/work-ledger/archive"
const operation = doc.paths[route].get
assert.equal(operation.operationId, "workLedger.listArchived")
const schema = operation.responses["200"].content["application/json"].schema
const validate = new Ajv2020({ strict: false, allErrors: true, validateFormats: false }).compile({ ...schema, components: doc.components })
const checks = []
const read = async (params, rows, cursor) => {
  const url = new URL(route, base)
  url.search = new URLSearchParams(params)
  const response = await fetch(url, { headers: { "x-opencorvus-directory": expected.project.directory } })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(validate(body), JSON.stringify(validate.errors))
  const current = body.rows.map(row => ({ id: row.id, title: row.title, directory: row.directory, archived: row.archived }))
  assert.deepEqual(current, rows)
  assert.deepEqual(body.nextCursor, cursor)
  checks.push({ params, status: response.status, schemaValid: true, rows: current.length, first: current[0], last: current.at(-1), cursor: body.nextCursor })
}
const [first, second, third] = expected.pages
await read({ limit: 100 }, first.rows, first.nextCursor)
await read({ limit: 100, cursorPinned: first.nextCursor.pinned, cursorUpdated: first.nextCursor.updated, cursorRowKey: first.nextCursor.rowKey }, second.rows, second.nextCursor)
await read({ limit: 100, cursorPinned: second.nextCursor.pinned, cursorUpdated: second.nextCursor.updated, cursorRowKey: second.nextCursor.rowKey }, third.rows, third.nextCursor)
await read({ limit: 100, search: third.rows[0].title }, [third.rows[0]], null)
const report = { phase, point, operation: operation.operationId, checks }
await fs.writeFile(root + "/" + phase + "-" + point + "-tcp.json", JSON.stringify(report, null, 2) + "\n")
console.log(JSON.stringify({ phase, point, counts: checks.map(check => check.rows), statuses: checks.map(check => check.status), schemaValid: true }))