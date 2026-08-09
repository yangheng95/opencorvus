import { afterEach, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { mirrorSessionBusEvent } from "@/protocol/session-mirror"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { resetDatabase } from "./fixture/db"
import { tmpdir } from "./fixture/fixture"

afterEach(async () => {
  await Instance.disposeAll()
  await resetDatabase()
})

test("mirrors a Task root Session config change into the owning Task live stream", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Task model authority" })
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
            product_pillar: "work",
            title: "Task model authority",
            request: "Project the persisted Task root model",
            time_started: now,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )

      let resolveEvent!: (event: any) => void
      const delivered = new Promise<any>((resolve) => {
        resolveEvent = resolve
      })
      const unsubscribe = ProtocolStore.subscribeEvents(resolveEvent, { aggregate: "task", taskID })

      try {
        await mirrorSessionBusEvent(
          {
            type: Session.Event.ConfigChanged.type,
            properties: { sessionID: session.id },
          },
          session.id,
        )
        const event = await Promise.race([
          delivered,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Task config event was not delivered")), 2_000),
          ),
        ])

        expect(event).toMatchObject({
          type: "config.changed",
          aggregate: "task",
          aggregateID: taskID,
          taskID,
          sessionID: session.id,
          source: "session.bridge",
          payload: {
            taskID,
            sessionID: session.id,
            channel: "main",
            resolvedRole: "user",
            agentID: "user",
            summary: "Session config changed",
          },
        })
      } finally {
        unsubscribe()
      }
    },
  })
})
