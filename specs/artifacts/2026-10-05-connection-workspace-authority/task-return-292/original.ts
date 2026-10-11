import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
const repo = "D:/myhexin-local/opencorvus"
const scratch = path.join(repo, ".tmp-product-iteration/task-return-292/original-read")
process.env.OPENCORVUS_HOME = path.join(scratch, "runtime")
process.env.OPENCORVUS_TEST_HOME = path.join(scratch, "home")
process.env.OPENCORVUS_TEST_PROCESS_ROOT = scratch
process.env.OPENCORVUS_DISABLE_AUTOUPDATE = "1"
process.env.OPENCORVUS_DISABLE_EXTERNAL_SKILLS = "1"
const require = createRequire(path.join(repo, "packages/opencorvus/package.json"))
const { drizzle } = await import(pathToFileURL(require.resolve("drizzle-orm/bun-sqlite")).href)
const { findSchemaDrift } = await import(pathToFileURL(path.join(repo, "packages/opencorvus/src/storage/schema-contract.ts")).href)
const { taskLifecycleProjectionInTransaction } = await import(pathToFileURL(path.join(repo, "packages/opencorvus/src/engine/task-lifecycle.ts")).href)
const file = "C:/Users/hengu/AppData/Local/opencorvus/data/opencorvus.db"
const taskID = "tsk_g00VXMejke00KwIb9xRv"
const sqlite = new Database(file, {readonly:true})
sqlite.exec("BEGIN")
try {
  const task = sqlite.query("SELECT id,project_id,session_id,request_id,time_created FROM engine_task WHERE id=?").get(taskID) as any
  const projection = task ? taskLifecycleProjectionInTransaction(drizzle({client:sqlite}), taskID) : undefined
  const sessions = task ? sqlite.query(`WITH RECURSIVE tree(id) AS (
    SELECT session_id FROM engine_task WHERE id=? UNION ALL
    SELECT s.id FROM session s JOIN tree ON s.parent_id=tree.id
  ) SELECT s.id,s.kind,s.parent_id,
    (SELECT COUNT(*) FROM message m WHERE m.session_id=s.id) AS message_count,
    (SELECT COUNT(*) FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=s.id AND json_extract(p.data,'$.type')='source-url') AS url_sources
    FROM session s JOIN tree ON tree.id=s.id ORDER BY s.id`).all(taskID) : []
  const result = {
    observedAtUtc:new Date().toISOString(),sourceFile:file,
    access:"Original production readonly BEGIN/ROLLBACK; explicit canonical lifecycle client; no bootstrap, mutation or process/window action",
    schemaDrift:findSchemaDrift(sqlite)??null,task,
    lifecycle:projection?{status:projection.status,epoch:projection.epoch,openedEventID:projection.openedEventID,terminalEventID:projection.terminalEventID}:null,
    sessions,boundary:"Current identity/schema facts only. Schema drift forbids current runtime qualification; no compatibility index deletion or copied-row pruning. User runtime activity and full recovery frontiers are not inferred from one Task terminal."
  }
  fs.writeFileSync(path.join(repo,"specs/artifacts/2026-10-05-connection-workspace-authority/task-return-292/original-current.json"),JSON.stringify(result,null,2)+"\n",{flag:"wx"})
  console.log(JSON.stringify(result,null,2))
} finally {sqlite.exec("ROLLBACK");sqlite.close()}
