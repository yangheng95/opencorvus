import fs from "node:fs/promises"
import assert from "node:assert/strict"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const root = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b48"
const seed = JSON.parse(await fs.readFile(root + "/empty-archive.json", "utf8"))
const base = "http://127.0.0.1:" + process.argv[2]
const docResponse = await fetch(base + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const archiveRoute = "/work-ledger/archive"
const restoreRoute = "/coding/chat/session/{sessionID}/archive"
function validator(route, method, operationId) {
  const op = doc.paths[route][method]
  assert.equal(op.operationId, operationId)
  return ajv.compile({ ...op.responses["200"].content["application/json"].schema, components: doc.components })
}
const listContract = validator(archiveRoute, "get", "workLedger.listArchived")
const restoreContract = validator(restoreRoute, "patch", "coding.chat.session.setArchived")
const dir = seed.project.directory
const headers = { "x-opencorvus-directory": dir, "content-type": "application/json" }
const readArchive = async (params) => {
  const url = new URL(archiveRoute, base)
  url.search = new URLSearchParams(params)
  const res = await fetch(url, { headers })
  assert.equal(res.status, 200)
  const payload = await res.json()
  assert.ok(listContract(payload), JSON.stringify(listContract.errors))
  return payload
}
const original = await readArchive({ limit: 100 })
const [first, tail] = seed.pages
assert.deepEqual(original.rows.map(row => row.id), first.rows.map(row => row.id))
assert.deepEqual(original.nextCursor, first.nextCursor)
const restored = []
for (const row of tail.rows) {
  const prior = seed.sessions.find(session => session.id === row.id)
  const url = new URL(restoreRoute.replace("{sessionID}", encodeURIComponent(row.id)), base)
  url.searchParams.set("directory", dir)
  const response = await fetch(url, { method: "PATCH", headers, body: JSON.stringify({ archived: false }) })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.ok(restoreContract(result), JSON.stringify(restoreContract.errors))
  const session = result.session
  assert.deepEqual({ id: session.id, title: session.title, directory: session.directory, projectID: session.projectID, created: session.time.created, archived: session.time.archived ?? null }, { ...prior, archived: null })
  restored.push({ status: response.status, id: session.id, title: session.title, projectID: session.projectID, created: session.time.created, archived: session.time.archived ?? null })
}
const cursor = original.nextCursor
const exhausted = await readArchive({ limit: 100, cursorPinned: cursor.pinned, cursorUpdated: cursor.updated, cursorRowKey: cursor.rowKey })
assert.deepEqual(exhausted, { rows: [], nextCursor: null })
const current = await readArchive({ limit: 100 })
assert.deepEqual(current.rows.map(row => row.id), first.rows.map(row => row.id))
assert.equal(current.nextCursor, null)
const report = { phase: "empty", sourceCursor: cursor, originalCount: original.rows.length, restored, finalCursorRead: { status: 200, ...exhausted }, finalFirstPageCount: current.rows.length, finalFirstPageCursor: current.nextCursor, schemaValid: true }
await fs.writeFile(root + "/empty-tail-runtime.json", JSON.stringify(report, null, 2) + "\n")
console.log(JSON.stringify(report))