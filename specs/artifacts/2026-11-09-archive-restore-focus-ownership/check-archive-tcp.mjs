import fs from "node:fs/promises"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const [evidenceDir, phase, port] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after")
const require = createRequire(resolve("packages/opencorvus/package.json"))
const Ajv2020 = require("ajv/dist/2020.js").default
const original = JSON.parse(await fs.readFile(resolve(evidenceDir, phase + "-archive.json"), "utf8"))
const base = "http://127.0.0.1:" + port
const docResponse = await fetch(base + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const validators = new Map()
const checks = []

async function read(route, operationId, params = {}, target = route) {
  const operation = doc.paths[route].get
  assert.equal(operation.operationId, operationId)
  if (!validators.has(route)) {
    const schema = operation.responses["200"].content["application/json"].schema
    validators.set(route, ajv.compile({ ...schema, components: doc.components }))
  }
  const url = new URL(target, base)
  url.search = new URLSearchParams(params)
  const result = await fetch(url, { headers: { "x-opencorvus-directory": original.project.directory } })
  assert.equal(result.status, 200)
  const body = await result.json()
  const valid = validators.get(route)
  assert.ok(valid(body), JSON.stringify(valid.errors))
  checks.push({ operationId, status: result.status, schemaValid: true, params })
  return body
}

const restoredTitles = ["Restore review 202", "Restore review 201", ...(phase === "after" ? ["Restore review 001"] : [])]
const current = original.sessions.map(row => restoredTitles.includes(row.title) ? { ...row, archived: null } : row)
const rowIdentity = ({ id, title, directory, archived }) => ({ id, title, directory, archived: archived ?? null })
const retained = original.pages.flatMap(page => page.rows).filter(row => !restoredTitles.includes(row.title))
const archiveRoute = "/work-ledger/archive"
const archiveOperation = "workLedger.listArchived"
let cursor = null
let total = 0
do {
  const params = { limit: 100 }
  if (cursor) Object.assign(params, { cursorPinned: cursor.pinned, cursorUpdated: cursor.updated, cursorRowKey: cursor.rowKey })
  const page = await read(archiveRoute, archiveOperation, params)
  const rows = page.rows.map(rowIdentity)
  assert.deepEqual(rows, retained.slice(total, total + 100).map(rowIdentity))
  total += rows.length
  cursor = page.nextCursor
  Object.assign(checks.at(-1), { rows: rows.length, first: rows[0]?.title, last: rows.at(-1)?.title, cursor })
} while (cursor && total < retained.length)
assert.equal(total, retained.length)
assert.equal(cursor, null)

const stillArchivedTitle = "Restore review 002"
const filtered = await read(archiveRoute, archiveOperation, { search: stillArchivedTitle })
assert.deepEqual(filtered.rows.map(rowIdentity), retained.filter(row => row.title === stillArchivedTitle).map(rowIdentity))
assert.equal(filtered.nextCursor, null)
checks.at(-1).records = filtered.rows.map(rowIdentity)
if (phase === "after") {
  const emptied = await read(archiveRoute, archiveOperation, { search: "Restore review 001" })
  assert.deepEqual({ rows: emptied.rows, nextCursor: emptied.nextCursor }, { rows: [], nextCursor: null })
  checks.at(-1).result = { rows: 0, cursor: null }
}

const active = await read("/work-ledger", "workLedger.list", { search: "Restore review" })
const activeRows = active.rows.filter(row => row.kind === "chat").map(rowIdentity).sort((a, b) => a.title.localeCompare(b.title))
assert.deepEqual(activeRows, current.filter(row => row.archived === null).map(rowIdentity).sort((a, b) => a.title.localeCompare(b.title)))
checks.at(-1).records = activeRows
for (const row of current.filter(row => restoredTitles.includes(row.title) || row.title === stillArchivedTitle)) {
  const route = "/coding/chat/session/{sessionID}"
  const result = await read(route, "coding.chat.session.get", { directory: row.directory }, route.replace("{sessionID}", encodeURIComponent(row.id)))
  const session = result.session
  const identity = { id: session.id, title: session.title, directory: session.directory, projectID: session.projectID, created: session.time.created, archived: session.time.archived ?? null }
  assert.deepEqual(identity, row)
  checks.at(-1).record = identity
}
await fs.writeFile(resolve(evidenceDir, phase + "-tcp.json"), JSON.stringify({ phase, total, restoredTitles, checks }, null, 2) + "\n")
console.log(JSON.stringify({ phase, total, restoredTitles, statuses: checks.map(check => check.status), schemaValid: true }))
