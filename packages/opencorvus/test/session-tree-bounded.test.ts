import { afterAll, describe, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { Database, eq, sql } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

describe("bounded Session tree traversal", () => {
  test("pages a high-fan-out tree and bounds owner checks and deletion batches", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        const rootID = "ses_tree_root"
        const directChildren = Array.from({ length: 140 }, (_, index) => `ses_tree_child_${index.toString().padStart(3, "0")}`)
        const grandchildren = Array.from({ length: 70 }, (_, index) => `ses_tree_grandchild_${index.toString().padStart(3, "0")}`)
        const row = (id: string, parentID: string | null, timeCreated: number) => ({
          id,
          project_id: projectID,
          parent_id: parentID,
          slug: id,
          directory: project.path,
          title: id,
          version: "test",
          kind: parentID ? ("assistant" as const) : ("root" as const),
          time_created: timeCreated,
          time_updated: timeCreated,
        })
        Database.transaction((db) => {
          db.insert(SessionTable).values(row(rootID, null, 1)).run()
          for (const childID of directChildren) db.insert(SessionTable).values(row(childID, rootID, 2)).run()
          for (const [index, childID] of grandchildren.entries()) {
            db.insert(SessionTable).values(row(childID, directChildren[index % 2]!, 3)).run()
          }
        })

        const traversalPages: Array<{ stage: "children" | "task_owner" | "delete"; inputCount: number; rowCount: number }> = []
        const ids = Database.use((db) =>
          Session.treeInProjectInTransaction(db, {
            sessionID: rootID,
            projectID,
            observePage: (page) => traversalPages.push(page),
          }),
        )
        expect(new Set(ids)).toEqual(new Set([rootID, ...directChildren, ...grandchildren]))
        expect({
          highFanOutPages: traversalPages.filter((page) => page.stage === "children" && page.rowCount > 0).map((page) => page.rowCount),
          maxParents: Math.max(...traversalPages.map((page) => page.inputCount)),
          maxRows: Math.max(...traversalPages.map((page) => page.rowCount)),
        }).toEqual({ highFanOutPages: [64, 64, 12, 64, 6], maxParents: 64, maxRows: 64 })

        const plan = Database.Client().all<{ detail: string }>(sql`
          EXPLAIN QUERY PLAN
          SELECT id,time_created FROM session
          WHERE project_id=${projectID} AND parent_id IN (${rootID})
            AND (time_created>${0} OR (time_created=${0} AND id>${""}))
          ORDER BY time_created,id LIMIT 64
        `)
        expect(plan.some((entry) => entry.detail.includes("session_parent_idx"))).toBe(true)

        const deletionPages: typeof traversalPages = []
        const deleted = Database.transaction((db) =>
          Session.deleteExactTreeInProject(db, {
            sessionID: rootID,
            projectID,
            expectedSessionIDs: ids,
            observePage: (page) => deletionPages.push(page),
          }),
        )
        expect({
          deleted,
          maxOwnerInputs: Math.max(...deletionPages.filter((page) => page.stage === "task_owner").map((page) => page.inputCount)),
          maxDeleteInputs: Math.max(...deletionPages.filter((page) => page.stage === "delete").map((page) => page.inputCount)),
          remaining: Database.use((db) => db.select({ id: SessionTable.id }).from(SessionTable).where(eq(SessionTable.project_id, projectID)).all()),
        }).toEqual({ deleted: 211, maxOwnerInputs: 64, maxDeleteInputs: 64, remaining: [] })
      },
    })
  })
})
