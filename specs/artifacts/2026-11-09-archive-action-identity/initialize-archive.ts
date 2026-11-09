import fs from "node:fs/promises"
import assert from "node:assert/strict"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Project } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/project.ts"
import { Session } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/session/index.ts"
import { createRightSidebarConversationSession } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/chat/session.ts"
import { listArchivedWorkLedger } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/work-ledger/projection.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"

declareNativeTaskProcessDeployment()
const phase = process.argv[2]
assert.ok(phase === "before" || phase === "after")
const root = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b49"
const projects = JSON.parse(await fs.readFile(root + "/seed.json", "utf8"))[phase]
const title = "Shared archive review"
try {
  const originals = []
  for (const input of projects) {
    originals.push(await Instance.provide({ directory: input.directory, fn: async () => {
      const project = await Project.update({ projectID: Instance.project.id, name: input.projectTitle })
      const created = await createRightSidebarConversationSession("chat", { title })
      const archived = await Session.setArchived({ sessionID: created.id, time: Date.now() })
      return { key: input.key, projectTitle: input.projectTitle, projectID: project.id, directory: created.directory, sessionID: created.id, title, created: created.time.created, archived: archived.time.archived }
    } }))
  }
  const actual = await Instance.provide({ directory: projects[0].directory, fn: () => listArchivedWorkLedger({ search: title, limit: 100 }) })
  assert.deepEqual(new Set(actual.rows.map(row => row.id)), new Set(originals.map(row => row.sessionID)))
  assert.equal(actual.nextCursor, null)
  await fs.writeFile(root + "/" + phase + "-archive.json", JSON.stringify({ phase, title, originals }, null, 2) + "\n")
  console.log(JSON.stringify({ phase, projects: originals.map(row => row.projectTitle), sessions: originals.length, title }))
} finally {
  await Instance.disposeAll()
}