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
assert.ok(phase === "before" || phase === "after" || phase === "empty")
const root = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b91"
const seed = JSON.parse(await fs.readFile(root + "/seed.json", "utf8"))[phase]
try {
  await Instance.provide({ directory: seed.directory, fn: async () => {
    const project = await Project.update({ projectID: Instance.project.id, name: "Archive Restore Review" })
    const sessions = []
    for (let n = 1; n <= (phase === "empty" ? 102 : 202); n++) {
      const title = "Restore review " + String(n).padStart(3, "0")
      const created = await createRightSidebarConversationSession("chat", { title })
      const archived = await Session.setArchived({ sessionID: created.id, time: Date.now() })
      sessions.push({ id: created.id, title, directory: created.directory, projectID: created.projectID, created: created.time.created, archived: archived.time.archived })
    }
    const pages = []
    let cursor
    for (const count of phase === "empty" ? [100, 2] : [100, 100, 2]) {
      const page = await listArchivedWorkLedger({
        limit: 100,
        ...(cursor ? { cursorPinned: cursor.pinned, cursorUpdated: cursor.updated, cursorRowKey: cursor.rowKey } : {}),
      })
      assert.equal(page.rows.length, count)
      cursor = page.nextCursor
      pages.push({ rows: page.rows.map(row => ({ id: row.id, title: row.title, directory: row.directory, archived: row.archived })), nextCursor: cursor })
    }
    assert.equal(cursor, null)
    assert.deepEqual(new Set(pages.flatMap(page => page.rows.map(row => row.id))), new Set(sessions.map(row => row.id)))
    await fs.writeFile(root + "/" + phase + "-archive.json", JSON.stringify({ phase, project: { id: project.id, title: project.name, directory: seed.directory }, sessions, pages }, null, 2) + "\n")
    console.log(JSON.stringify({ phase, projectID: project.id, pages: pages.map(page => page.rows.length), pageFirstTitles: pages.map(page => page.rows[0].title) }))
  } })
} finally {
  await Instance.disposeAll()
}