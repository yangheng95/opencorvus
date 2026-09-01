import { afterEach, describe, expect, test } from "bun:test"
import {
  findRecentBrowserPreviewTargets,
  persistBrowserPreviewTarget,
  promoteBrowserPreviewTarget,
} from "../../src/browser-preview/persist"
import { EngineTaskTable } from "../../src/engine/engine.sql"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Database, sql } from "../../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

describe("Browser Preview target persistence", () => {
  test("atomically updates one Task and canonical URL identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Browser target identity" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: session.id,
              source: "test",
              product_pillar: "code",
              title: "Browser target identity",
              request: "Browser target identity",
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const desktop = [{ id: "desktop" as const, labelKey: "desktop", width: 1280, height: 720 }]
        const wide = [{ id: "desktop" as const, labelKey: "desktop-wide", width: 1440, height: 900 }]
        const [created, updated] = await Promise.all([
          persistBrowserPreviewTarget({ taskID, url: "HTTP://LOCALHOST:3000/App?Mode=Dev#Top", viewports: desktop }),
          persistBrowserPreviewTarget({ taskID, url: "http://localhost:3000/App?Mode=Dev#Top", viewports: wide }),
        ])

        expect({ createdID: created.id, updatedID: updated.id }).toEqual({
          createdID: created.id,
          updatedID: created.id,
        })
        expect(findRecentBrowserPreviewTargets(taskID)).toEqual([updated])
      },
    })
  })

  test("rolls back the exact target mutation when canonical task.updated publication is rejected", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Browser target publication" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: session.id,
              source: "test",
              product_pillar: "code",
              title: "Browser target publication",
              request: "Browser target publication",
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const viewports = [{ id: "desktop" as const, labelKey: "desktop", width: 1280, height: 720 }]
        const installFailure = () =>
          Database.use((db) =>
            db.run(
              sql.raw(`
                CREATE TEMP TRIGGER arc019_fail_browser_target_task_updated
                BEFORE INSERT ON protocol_event
                WHEN NEW.type = 'task.updated' AND NEW.source = 'browser-preview.target'
                BEGIN SELECT RAISE(ABORT, 'injected Browser Preview task.updated commit failure'); END
              `),
            ),
          )
        const removeFailure = () =>
          Database.use((db) => db.run(sql.raw("DROP TRIGGER arc019_fail_browser_target_task_updated")))

        installFailure()
        const rejectedCreate = await Promise.resolve()
          .then(() =>
            persistBrowserPreviewTarget({
              taskID,
              url: "http://localhost:3000/create",
              viewports,
              now: now + 1,
            }),
          )
          .catch((error) => error)
        removeFailure()
        expect({
          error: rejectedCreate instanceof Error ? rejectedCreate.message : "not-an-error",
          current: findRecentBrowserPreviewTargets(taskID),
        }).toEqual({
          error: expect.stringContaining("injected Browser Preview task.updated commit failure"),
          current: [],
        })

        const created = await persistBrowserPreviewTarget({
          taskID,
          url: "http://localhost:3000/promote",
          viewports,
          now: now + 2,
        })
        installFailure()
        const rejectedPromotion = await Promise.resolve()
          .then(() =>
            promoteBrowserPreviewTarget({
              taskID,
              targetID: created.id,
              now: now + 3,
            }),
          )
          .catch((error) => error)
        removeFailure()
        expect({
          error: rejectedPromotion instanceof Error ? rejectedPromotion.message : "not-an-error",
          current: findRecentBrowserPreviewTargets(taskID),
        }).toEqual({
          error: expect.stringContaining("injected Browser Preview task.updated commit failure"),
          current: [created],
        })
      },
    })
  })
})
