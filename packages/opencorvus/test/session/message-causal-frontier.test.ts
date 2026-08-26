import { afterEach, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { MessageTable, PartTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("allocates one monotonic persisted Message frontier when the caller clock moves backward", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Causal Message frontier" })
      const requestedFrontier = Date.now() + 60_000
      const first = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "user",
        author: "user",
        agent: "build",
        model: { providerID: "test", modelID: "causal-frontier" },
        time: { created: requestedFrontier },
      })
      const second = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "user",
        author: "user",
        agent: "build",
        model: { providerID: "test", modelID: "causal-frontier" },
        time: { created: requestedFrontier - 120_000 },
      })
      const part = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: second.id,
        type: "text",
        text: "Persist after its parent frontier",
      })

      const persisted = Database.use((db) => ({
        messages: db
          .select({ id: MessageTable.id, created: MessageTable.time_created })
          .from(MessageTable)
          .where(eq(MessageTable.session_id, session.id))
          .orderBy(MessageTable.time_created, MessageTable.id)
          .all(),
        part: db
          .select({ created: PartTable.time_created })
          .from(PartTable)
          .where(eq(PartTable.id, part.id))
          .get(),
      }))

      expect({
        firstCreated: first.time.created,
        secondCreated: second.time.created,
        persistedMessages: persisted.messages,
        partAtOrAfterParent: (persisted.part?.created ?? 0) >= second.time.created,
      }).toEqual({
        firstCreated: requestedFrontier,
        secondCreated: requestedFrontier + 1,
        persistedMessages: [
          { id: first.id, created: requestedFrontier },
          { id: second.id, created: requestedFrontier + 1 },
        ],
        partAtOrAfterParent: true,
      })
    },
  })
})

class SequencePreflightError extends Error {}

test("retries an interrupted participant sequence as one complete durable cut", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Atomic participant sequence" })
      const creatorMessageID = Identifier.ascending("message")
      const creatorPartID = Identifier.ascending("part")
      const controlMessageID = Identifier.ascending("message")
      const controlPartID = Identifier.ascending("part")
      let interruptControlPreflight = true
      const entries = () => [
        {
          input: {
            sessionID: session.id,
            messageID: creatorMessageID,
            author: "user",
            agent: "chat",
            model: { providerID: "test", modelID: "atomic-sequence" },
            byteMaterializationProjectID: session.projectID,
            noReply: true as const,
            parts: [{ id: creatorPartID, type: "text" as const, text: "Creator" }],
          },
          hooks: {
            preflightBundle: () => {
              const occupied = Database.use((db) =>
                db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, creatorMessageID)).get(),
              )
              if (occupied) throw new Error(`Creator Message ${creatorMessageID} is occupied`)
            },
          },
        },
        {
          input: {
            sessionID: session.id,
            messageID: controlMessageID,
            author: "orchestrator",
            agent: "chat",
            model: { providerID: "test", modelID: "atomic-sequence" },
            byteMaterializationProjectID: session.projectID,
            noReply: true as const,
            parts: [{ id: controlPartID, type: "text" as const, text: "Control" }],
          },
          hooks: {
            preflightBundle: () => {
              if (interruptControlPreflight) throw new SequencePreflightError("Control preflight interrupted")
            },
          },
        },
      ]

      await expect(SessionPrompt.persistNoReplySequence(entries())).rejects.toBeInstanceOf(SequencePreflightError)
      interruptControlPreflight = false
      const published = await SessionPrompt.persistNoReplySequence(entries())
      const visible = await Session.messages({ sessionID: session.id })

      expect({
        published: published.map((message) => message.info.id),
        visible: visible.map((message) => message.info.id),
        causalOrder: published[0]!.info.time.created < published[1]!.info.time.created,
      }).toEqual({
        published: [creatorMessageID, controlMessageID],
        visible: [creatorMessageID, controlMessageID],
        causalOrder: true,
      })
    },
  })
})
