import fs from "node:fs/promises"
import assert from "node:assert/strict"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"
const [phase, port, step] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after")
assert.ok(step === "seeded" || (phase === "after" && step === "restored"))
const root = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b49"
const originals = JSON.parse(await fs.readFile(root + "/" + phase + "-archive.json", "utf8"))
const base = "http://127.0.0.1:" + port
const spec = await fetch(base + "/doc")
assert.equal(spec.status, 200)
const doc = await spec.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const checks = []
const read = async (route, operationId, target, params, directory = originals.originals[0].directory) => {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  const validator = ajv.compile({ ...op.responses["200"].content["application/json"].schema, components: doc.components })
  const url = new URL(target, base)
  url.search = new URLSearchParams(params)
  const response = await fetch(url, { headers: { "x-opencorvus-directory": directory } })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.ok(validator(result), JSON.stringify(validator.errors))
  checks.push({ operationId, status: response.status, schemaValid: true, params })
  return result
}
const planned = originals.originals.map(row => ({ ...row, archived: row.key === "south" && step === "restored" ? null : row.archived }))
const identity = row => ({ id: row.sessionID, title: row.title, directory: row.directory, archived: row.archived })
const project = row => ({ id: row.id, title: row.title, directory: row.directory, archived: row.archived ?? null })
const search = { search: originals.title }
const archived = await read("/work-ledger/archive", "workLedger.listArchived", "/work-ledger/archive", search)
assert.deepEqual(archived.rows.map(project).sort((a,b)=>a.id.localeCompare(b.id)), planned.filter(row=>row.archived!==null).map(identity).sort((a,b)=>a.id.localeCompare(b.id)))
assert.equal(archived.nextCursor, null)
checks.at(-1).records = archived.rows.map(project)
for (const row of planned) {
  const path = "/coding/chat/session/{sessionID}"
  const response = await read(path, "coding.chat.session.get", path.replace("{sessionID}", encodeURIComponent(row.sessionID)), { directory: row.directory }, row.directory)
  const actual = response.session
  const projected = { id: actual.id, directory: actual.directory, title: actual.title, projectID: actual.projectID, created: actual.time.created, archived: actual.time.archived ?? null }
  assert.deepEqual(projected, { ...identity(row), projectID: row.projectID, created: row.created })
  checks.at(-1).record = projected
}
if (step === "restored") {
  const path = "/work-ledger"
  const active = await read(path, "workLedger.list", path, search)
  const work = active.rows.filter(row=>row.kind==="chat").map(project)
  assert.deepEqual(work, planned.filter(row=>row.archived===null).map(identity))
  checks.at(-1).records = work
}
const report = { phase, step, checks }
await fs.writeFile(root + "/" + phase + "-" + step + "-tcp.json", JSON.stringify(report, null, 2) + "\n")
console.log(JSON.stringify({ phase, step, statuses: checks.map(check=>check.status), schemaValid: true, archived: archived.rows.map(project) }))