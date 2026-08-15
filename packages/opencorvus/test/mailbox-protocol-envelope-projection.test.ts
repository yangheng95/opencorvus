import { afterEach, describe, expect, test } from "bun:test"
import {
  acknowledgeMailboxItem,
  deleteMailboxItems,
  listMailbox,
  listRecentTaskMailboxMessages,
  recordMailboxMessage,
} from "@/engine/mailbox"
import { EngineTaskTable } from "@/engine/engine.sql"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { protocolTaskEvent, taskListProtocolEvent } from "@/server/routes/orchestrator"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("mailbox protocol envelope projection", () => {
  test("rehydrates one durable mailbox event for replay, scheduler reads, notification and acknowledgement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Mailbox root" })
        const architect = await Session.create({ kind: "architect", parentID: root.id, title: "Mailbox architect" })
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Mailbox projection",
              request: "Read the durable mailbox body through its envelope identity",
              time_created: Date.now(),
            })
            .run(),
        )
        const input = {
          taskID,
          sessionID: architect.id,
          agentID: "solution-architect",
          expertSquadID: "advanced",
          category: "notification" as const,
          subject: "Architecture status",
          body: "Architecture evidence is ready for scheduler inspection.",
          attention: true,
          evidenceLocators: [],
          summary: "Architecture status published",
          correlationID: "mailbox-projection-call",
        }

        const first = recordMailboxMessage(input)
        const replay = recordMailboxMessage(input)
        const raw = Database.use((db) =>
          db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.id, first.id)).get(),
        )!
        const event = ProtocolStore.listTaskEvents(taskID).find((candidate) => candidate.id === first.id)!
        const recent = listRecentTaskMailboxMessages(taskID)

        expect({
          creation: [first.createdNow, replay.createdNow, first.id === replay.id],
          envelope: {
            aggregate: [raw.aggregate_type, raw.aggregate_id],
            sessionID: raw.session_id,
          },
          durablePayload: raw.payload,
          projectedPayload: event.payload,
          recent,
          taskEventNotify: protocolTaskEvent(event).notify,
          taskListNotify: taskListProtocolEvent(event).notify,
        }).toEqual({
          creation: [true, false, true],
          envelope: { aggregate: ["task", taskID], sessionID: architect.id },
          durablePayload: {
            agentID: input.agentID,
            expertSquadID: input.expertSquadID,
            category: input.category,
            subject: input.subject,
            body: input.body,
            attention: input.attention,
            evidenceLocators: [],
            summary: input.summary,
          },
          projectedPayload: {
            taskID,
            sessionID: architect.id,
            agentID: input.agentID,
            expertSquadID: input.expertSquadID,
            category: input.category,
            subject: input.subject,
            body: input.body,
            attention: input.attention,
            evidenceLocators: [],
            summary: input.summary,
          },
          recent: [
            {
              id: first.id,
              taskID,
              createdAt: raw.emitted_at,
              sourceAgentID: input.agentID,
              expertSquadID: input.expertSquadID,
              sessionID: architect.id,
              category: input.category,
              attention: true,
              subject: input.subject,
              body: input.body,
              evidenceLocators: [],
            },
          ],
          taskEventNotify: { tier: 2 },
          taskListNotify: { tier: 2 },
        })

        const acknowledgement = acknowledgeMailboxItem({ messageID: first.id, action: "read" })
        const rawAcknowledgement = Database.use((db) =>
          db
            .select()
            .from(ProtocolEventTable)
            .where(eq(ProtocolEventTable.id, "eventID" in acknowledgement ? acknowledgement.eventID : ""))
            .get(),
        )!
        const projectedAcknowledgement = ProtocolStore.listTaskEvents(taskID).find(
          (candidate) => candidate.id === rawAcknowledgement.id,
        )!
        expect({
          rawPayload: rawAcknowledgement.payload,
          projectedPayload: projectedAcknowledgement.payload,
          mailbox: listMailbox({ view: "active" }).items.map((item) => ({ id: item.id, readAt: item.readAt })),
        }).toEqual({
          rawPayload: {
            messageID: first.id,
            action: "read",
            summary: "Mailbox item read",
          },
          projectedPayload: {
            taskID,
            messageID: first.id,
            action: "read",
            summary: "Mailbox item read",
          },
          mailbox: [{ id: first.id, readAt: rawAcknowledgement.emitted_at }],
        })

        expect({
          deletion: deleteMailboxItems({ messageIDs: [first.id] }),
          mailbox: listMailbox({ view: "active" }).items,
        }).toEqual({
          deletion: { changedCount: 1 },
          mailbox: [],
        })
      },
    })
  })
})
