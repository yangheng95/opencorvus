import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { insertEngineTask } from "@/engine/task"
import { prepareTaskProcessBinding, insertTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { insertTaskPackageRevisionBinding } from "@/engine/task-package-revision-binding"
import { terminalTask } from "@/engine/state"
import { requireTask } from "@/engine/store"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"

const [phase, directory, receipt] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase) && path.basename(directory) === "project-" + phase)
const loaded = await ExpertSquadRegistry.loadPackage("D:/myhexin-local/opencorvus/packages/opencorvus/src/expert-squad/builtin/base")
const packageRevision = {
  scope: "built_in" as const, projectID: null, namespace: "builtin", id: "base",
  version: loaded.manifest.version, packageDigest: loaded.packageDigest,
}
const result = await Instance.provide({ directory, async fn() {
  const title = "Browser preview target review"
  const session = await Session.create({ kind: "root", title, metadata: { configOverlay: { prompt_profile: { active: "base" } } } })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const binding = await prepareTaskProcessBinding({
    mode: "native", taskID, projectID: Instance.project.id, rootDirectory: directory,
    packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now,
  })
  Database.transaction(db => {
    insertEngineTask(db, {
      taskID, projectID: Instance.project.id, sessionID: session.id, source: "test",
      productPillar: "code", title, request: title, priority: "normal", metadata: { actor: "user" }, timeCreated: now,
    })
    appendTaskOpenedInTransaction({ db, taskID, sessionID: session.id, now, source: "test.browser-preview-target-review" })
    insertTaskPackageRevisionBinding({ db, taskID, packageRevision, timeCreated: now })
    insertTaskProcessBinding({ db, payload: binding })
  })
  await terminalTask(requireTask(taskID), { status: "completed" }, "Isolated browser preview review fixture initialized", { projectDir: directory })
  const saved = requireTask(taskID)
  assert.equal(saved.lifecycle_status, "completed")
  return { phase, directory, title, taskID, sessionID: session.id, projectID: Instance.project.id, lifecycle: saved.lifecycle_status }
}})
await Instance.disposeAll()
Database.close()
await fs.writeFile(receipt, JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result))