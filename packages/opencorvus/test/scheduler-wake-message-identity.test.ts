import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { schedulerWakeMessageMatchesInTransaction } from "@/protocol/session-wake-state"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageTable } from "@/session/session.sql"
import { SessionWake } from "@/session/wake"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const model = { providerID: "openai", modelID: "gpt-5.6-terra" }

function schedulerWakeReason(eventID: string, inboxID: string): SessionWake.WakeReason {
  return {
    source: "scheduler.message",
    eventID,
    inboxID,
    threadID: "task:tsk_identity:lifecycle",
    messageKind: "notification",
    sourceEndpoint: {
      kind: "task_scheduler",
      project_id: "prj_identity",
      task_id: "tsk_identity",
      root_session_id: "ses_identity_root",
    },
    targetEndpoint: {
      kind: "mission_scheduler",
      project_id: "prj_identity",
      mission_id: "mission-identity",
      session_id: "ses_identity_mission",
    },
  }
}

describe("scheduler wake Message identity", () => {
  test("settlement accepts the persisted wake Message its own delivery owns", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "scheduler wake identity" })
        const eventID = Identifier.ascending("protocol_event")
        const inboxID = Identifier.ascending("protocol_inbox")
        const messageID = Identifier.ascending("message")
        await Session.updateMessage({
          id: messageID,
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          agent: "mission",
          model,
          time: { created: Date.now() },
          extra: SessionWake.reasonExtra(schedulerWakeReason(eventID, inboxID)),
        })

        const matched = Database.use((db) =>
          schedulerWakeMessageMatchesInTransaction(db, {
            sessionID: session.id,
            messageID,
            eventID,
            inboxID,
          }),
        )
        expect(matched).toBe(true)

        const otherDelivery = Database.use((db) =>
          schedulerWakeMessageMatchesInTransaction(db, {
            sessionID: session.id,
            messageID,
            eventID: Identifier.ascending("protocol_event"),
            inboxID,
          }),
        )
        expect(otherDelivery).toBe(false)
      },
    })
  })

  test("a persisted Message decodes only with the identity its row keeps in SQL columns", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "message row identity" })
        const parentID = Identifier.ascending("message")
        const messageID = Identifier.ascending("message")
        await Session.updateMessage({
          id: parentID,
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "orchestrator",
          model,
          time: { created: Date.now() },
        })
        await Session.updateMessage({
          id: messageID,
          sessionID: session.id,
          role: "assistant",
          author: "assistant",
          agent: "orchestrator",
          parentID,
          modelID: model.modelID,
          providerID: model.providerID,
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })

        const row = Database.use((db) =>
          db
            .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
            .from(MessageTable)
            .where(eq(MessageTable.id, messageID))
            .get(),
        )
        expect(row).toBeDefined()

        // The stored JSON is the Message minus the identity the row keeps in its
        // own SQL columns, so decoding the column alone reports exactly the two
        // missing identity fields. Both fixed call sites depend on this shape.
        const columnOnly = Message.Assistant.safeParse(row!.data)
        expect(columnOnly.success).toBe(false)
        expect(columnOnly.success ? [] : columnOnly.error.issues.map((issue) => issue.path)).toEqual([
          ["id"],
          ["sessionID"],
        ])

        const decoded = Message.Assistant.safeParse({ ...row!.data, id: row!.id, sessionID: row!.sessionID })
        expect(decoded.success).toBe(true)
        expect(decoded.success && decoded.data).toMatchObject({
          id: messageID,
          sessionID: session.id,
          parentID,
          providerID: model.providerID,
        })
      },
    })
  })
})
