import { Database } from "bun:sqlite"
import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"

const taskID = "tsk_g00VXJJVS500QnIDtJVs"
const sessionID = "ses_-zUSggUQgzzprQcl946c"
const databasePath = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/live-sol-publication-50/runtime/data/opencorvus.db"
const apiFacts = JSON.parse(await readFile(new URL("after-75-native-reads.json", import.meta.url), "utf8"))
const api = apiFacts.find((row: { path: string }) => row.path === `/expert-squad/catalog?sessionID=${sessionID}`)
assert(api, "Root's exact public catalog response is required")
assert.equal(api.status, 200)
const taskSQL = "SELECT id, project_id, session_id FROM engine_task WHERE id = ?"
const bindingSQL = "SELECT id, task_id, kind, json_extract(payload, '$.protocol') AS protocol, json_extract(payload, '$.package_revision') AS package_revision FROM engine_artifact WHERE task_id = ? AND kind = 'task_package_revision_binding'"
const db = new Database(databasePath, { readonly: true })
let result: unknown
try {
  db.exec("BEGIN")
  const tasks = db.query(taskSQL).all(taskID) as { id: string; project_id: string; session_id: string }[]
  const bindings = db.query(bindingSQL).all(taskID) as { id: string; task_id: string; kind: string; protocol: string; package_revision: string }[]
  assert.equal(tasks.length, 1)
  assert.equal(bindings.length, 1)
  assert.equal(tasks[0].session_id, sessionID)
  assert.equal(bindings[0].protocol, "task-package-revision-binding-v1")
  const revision = JSON.parse(bindings[0].package_revision)
  assert.equal(revision.project_id, tasks[0].project_id)
  assert.deepEqual(revision, api.body.active.package_revision)
  result = {
    observedAtUtc: new Date().toISOString(), databasePath, openMode: "bun:sqlite readonly:true", transaction: "BEGIN/ROLLBACK",
    queries: [{ sql: taskSQL, parameters: [taskID] }, { sql: bindingSQL, parameters: [taskID] }],
    task: tasks[0], binding: { id: bindings[0].id, taskID: bindings[0].task_id, kind: bindings[0].kind, protocol: bindings[0].protocol, package_revision: revision },
    publicAPI: { observedAtUtc: api.observedAtUtc, method: api.method, path: api.path, status: api.status, requestID: api.requestID, active: { effective: api.body.active.effective, project: api.body.active.project, session_override: api.body.active.session_override, package_revision: api.body.active.package_revision } },
    qualification: "Exact original Task root Session and one immutable binding match Root's current public active.package_revision; no revision replacement, concurrency or other Project matrix is claimed",
  }
} finally {
  if (db.inTransaction) db.exec("ROLLBACK")
  db.close()
}
await writeFile(new URL("after-75-fixed-package-receipt.json", import.meta.url), JSON.stringify(result, null, 2), { flag: "wx" })
console.log(JSON.stringify(result, null, 2))
