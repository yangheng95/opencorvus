import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { acceptTaskRootIngressInTransaction } from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import {
  deliverTaskRootMessageToOrchestratorSession,
  prepareTaskRootMessageDelivery,
} from "@/task-api/task-root-message"
import { requireTask } from "@/engine/store"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Bus } from "@/bus"
import { BusPublicationOutboxTable, BusPublicationPhaseReceiptTable } from "@/bus/bus.sql"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { ProtocolStore } from "@/protocol/store"
import { ensureTaskMessageProtocolBridge } from "@/orchestrator/protocol/message-bridge"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

/**
 * A Task-root Message is frozen in content, not in place.
 *
 * Delivery moves an accepted Message out of the Task-root Session and into the
 * Orchestrator Session. Freezing the whole row made that move impossible, so a
 * Message accepted before it was delivered could never be delivered at all:
 * every wake replayed the same refused relocation until the Task died holding
 * it. Observed 2026-08-18 on a live Mission run, where a scheduler-authored
 * root Message was accepted at 09:36:35 and its delivery was refused at
 * 09:49:02, taking the orchestrator loop down with it.
 */
describe("accepted Task-root Message delivery", () => {
  test("same-time Parts read in canonical binary identity order through both message readers", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Canonical Part order" })
      const messageID = Identifier.ascending("message")
      await Session.persistMessage({
        info: {
          id: messageID, sessionID: session.id, role: "user", author: "user", agent: "chat",
          model: { providerID: "test", modelID: "canonical-order" }, time: { created: Date.now() + 60_000 },
        },
        parts: ["prt_a", "prt_Z"].map(id => ({ id, messageID, sessionID: session.id, type: "text" as const, text: id })),
      })
      const direct = await MessageStore.get({ sessionID: session.id, messageID })
      const messages = await Session.messages({ sessionID: session.id })
      expect(direct.parts.map(part => ({ id: part.id, text: part.type === "text" ? part.text : "" })))
        .toEqual([{ id: "prt_Z", text: "prt_Z" }, { id: "prt_a", text: "prt_a" }])
      expect(messages[0]!.parts.map(part => part.id)).toEqual(["prt_Z", "prt_a"])
    } })
  })

  async function acceptedRootMessage(title: string, author = "mission", reviseDraft = false) {
    const taskID = Identifier.ascending("task")
    const root = await Session.create({ kind: "root", title })
    const now = Date.now()
    Database.immediateTransaction((db) => {
      db.insert(EngineTaskTable)
        .values({
          id: taskID,
          project_id: Instance.project.id,
          session_id: root.id,
          source: "test",
          product_pillar: "code",
          title,
          request: title,
          time_created: now,
        })
        .run()
      appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.operator" })
    })
    const orchestrator = await Session.create({ kind: "orchestrator", title: `Agent: ${title}`, parentID: root.id })
    const messageID = Identifier.ascending("message")
    const textPartID = Identifier.ascending("part")
    await Session.persistMessage({
      info: {
        id: messageID,
        sessionID: root.id,
        role: "user",
        author,
        time: { created: now + 1 },
        agent: "orchestrator",
        model: { providerID: "openai", modelID: "gpt-5.6-terra" },
      },
      parts: [{ id: textPartID, sessionID: root.id, messageID, type: "text", text: title }],
    })
    if (reviseDraft) {
      Database.immediateTransaction((db) => {
        Session.writePartInTransaction(db, {
          id: textPartID,
          sessionID: root.id,
          messageID,
          type: "text",
          text: "Earlier revision before acceptance",
        })
        Session.writePartInTransaction(db, { id: textPartID, sessionID: root.id, messageID, type: "text", text: title })
      })
      const draftPartID = Identifier.ascending("part")
      Database.immediateTransaction((db) =>
        Session.writePartInTransaction(db, {
          id: draftPartID,
          sessionID: root.id,
          messageID,
          type: "text",
          text: "Superseded draft before acceptance",
        }),
      )
      await Session.removePart({ sessionID: root.id, messageID, partID: draftPartID })
      Database.immediateTransaction((db) =>
        Session.writePartInTransaction(db, {
          id: Identifier.ascending("part"),
          sessionID: root.id,
          messageID,
          type: "source-url",
          sourceId: "accepted-reference",
          url: "https://example.test/original-evidence",
          title: "Original user reference",
        }),
      )
      const before = await MessageStore.get({ sessionID: root.id, messageID })
      if (before.info.role !== "user") throw Error("Expected actual input participant")
      await Session.updateMessage({ ...before.info, summary: { title: "Prepared input before acceptance" } })
    }
    Database.immediateTransaction((db) =>
      acceptTaskRootIngressInTransaction(db, {
        taskID,
        executionEpoch: 1,
        source: "message",
        sourceID: messageID,
        semanticTurnLimit: 3,
        activationLimit: 4,
        now: now + 2,
      }),
    )
    return { taskID, root, orchestrator, messageID }
  }

  test.each(["user", "mission", "orchestrator", "goal-controller"])(
    "projects the complete %s transfer while consuming delayed original durable increments",
    async (author) => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          ensureTaskMessageProtocolBridge()
          const suspended = Bus.TestHooks.suppressAutomaticDurableDrain()
          const events: any[] = []
          const stop = ProtocolStore.subscribeEvents((event) => {
            if (event.source === "session.bridge") events.push(event)
          })
          try {
            const accepted = await acceptedRootMessage(`${author} delayed original input`, author, true)
            await deliverTaskRootMessageToOrchestratorSession({
              task: requireTask(accepted.taskID),
              messageID: accepted.messageID,
              orchestratorSessionID: accepted.orchestrator.id,
            })
            const originals = Database.use((db) => db.select().from(BusPublicationOutboxTable).all()).filter(
              (row) =>
                [
                  Message.Event.Updated.type,
                  Message.Event.PartUpdated.type,
                  Message.Event.PartRemoved.type,
                  Message.Event.Moved.type,
                ].includes(row.event_type) && JSON.stringify(row.properties).includes(accepted.messageID),
            )
            suspended[Symbol.dispose]()
            Bus.resumeDurablePublications()
            const deadline = Date.now() + 10000
            let phases: (typeof BusPublicationPhaseReceiptTable.$inferSelect)[] = []
            do {
              phases = Database.use((db) => db.select().from(BusPublicationPhaseReceiptTable).all()).filter((row) =>
                originals.some((original) => original.occurrence_id === row.occurrence_id),
              )
              if (phases.length === originals.length * 3) break
              if (Date.now() > deadline) throw Error("Original durable increments and Move must settle")
              await Bun.sleep(10)
            } while (true)
            await stop.drain()
            const observed = events.filter(
              (event) =>
                (event.payload?.info?.id ?? event.payload?.part?.messageID ?? event.payload?.messageID) ===
                  accepted.messageID || event.type === "session.bridge.persist_failed",
            )
            expect(observed.map((event) => event.type)).toEqual([Message.Event.Moved.type])
            expect(observed[0].payload).toMatchObject({
              sourceSessionID: accepted.root.id,
              info: { id: accepted.messageID, sessionID: accepted.orchestrator.id, author },
              parts: [
                {
                  messageID: accepted.messageID,
                  sessionID: accepted.orchestrator.id,
                  text: `${author} delayed original input`,
                },
                { type: "source-url", sourceId: "accepted-reference", url: "https://example.test/original-evidence" },
              ],
            })
            expect(
              originals.map((row) => ({
                type: row.event_type,
                phases: phases
                  .filter((p) => p.occurrence_id === row.occurrence_id)
                  .map((p) => p.phase)
                  .sort(),
              })),
            ).toEqual(
              expect.arrayContaining([
                { type: Message.Event.Updated.type, phases: ["exact", "global", "wildcard"] },
                { type: Message.Event.PartUpdated.type, phases: ["exact", "global", "wildcard"] },
                { type: Message.Event.PartRemoved.type, phases: ["exact", "global", "wildcard"] },
                { type: Message.Event.Moved.type, phases: ["exact", "global", "wildcard"] },
              ]),
            )
            const actual = await MessageStore.get({
              sessionID: accepted.orchestrator.id,
              messageID: accepted.messageID,
            })
            expect(actual.parts.map((part) => ({ id: part.id, type: part.type }))).toEqual(
              observed[0].payload.parts.map((part: any) => ({ id: part.id, type: part.type })),
            )
            const priorPart = originals.find((row) => row.event_type === Message.Event.PartUpdated.type)!
              .properties as { orderKey: string; part: Message.VisiblePart }
            const priorReference = originals.find(
              (row) =>
                row.event_type === Message.Event.PartUpdated.type &&
                (row.properties as { part?: { type?: string } }).part?.type === "source-url",
            )!.properties as { orderKey: string; part: Message.VisiblePart }
            for (const { properties, error } of [
              {
                properties: { ...priorPart, part: { ...priorPart.part, orderKey: "invalid-original-part-key" } },
                error: "key is not canonical",
              },
              {
                properties: {
                  ...priorReference,
                  part: { ...priorReference.part, url: "https://example.test/changed-immutable-evidence" },
                },
                error: "has no exact durable Move covering",
              },
            ]) {
              const malformed = Bus.publishOwned(Message.Event.PartUpdated, properties)
              await malformed
              const errorDeadline = Date.now() + 10000
              while (
                Database.use((db) => db.select().from(BusPublicationPhaseReceiptTable).all()).filter(
                  (row) => row.occurrence_id === malformed.occurrenceID,
                ).length !== 3
              ) {
                if (Date.now() > errorDeadline)
                  throw Error("The exact malformed occurrence must settle before checking its error contract")
                await Bun.sleep(10)
              }
              await stop.drain()
              expect(events.findLast((event) => event.type === "session.bridge.persist_failed")?.payload).toMatchObject(
                {
                  failed_type: Message.Event.PartUpdated.type,
                  error: expect.stringContaining(error),
                },
              )
            }
          } finally {
            suspended[Symbol.dispose]()
            stop()
          }
        },
      })
    },
  )

  test.each(["user", "mission", "orchestrator", "goal-controller"])(
    "prepares a %s input under its root owner and atomically commits a retry with stable identity",
    async (author) => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const accepted = await acceptedRootMessage(`${author} prepared handoff`, author)
          const original = await MessageStore.get({ sessionID: accepted.root.id, messageID: accepted.messageID })
          const commit = await prepareTaskRootMessageDelivery({
            task: requireTask(accepted.taskID),
            messageID: accepted.messageID,
            orchestratorSessionID: accepted.orchestrator.id,
          })
          expect(await MessageStore.get({ sessionID: accepted.root.id, messageID: accepted.messageID })).toEqual(
            original,
          )
          expect(() =>
            commit(() => {
              throw new Error("Runtime preparation rejected the handoff")
            }),
          ).toThrow("Runtime preparation rejected the handoff")
          expect(await MessageStore.get({ sessionID: accepted.root.id, messageID: accepted.messageID })).toEqual(
            original,
          )
          commit()
          const delivered = await MessageStore.get({
            sessionID: accepted.orchestrator.id,
            messageID: accepted.messageID,
          })
          commit()
          expect(
            await MessageStore.get({ sessionID: accepted.orchestrator.id, messageID: accepted.messageID }),
          ).toEqual(delivered)
          expect({
            info: { id: delivered.info.id, author: delivered.info.role === "user" ? delivered.info.author : undefined },
            parts: delivered.parts.map((part) => ({
              id: part.id,
              type: part.type,
              text: part.type === "text" ? part.text : undefined,
            })),
          }).toEqual({
            info: { id: original.info.id, author },
            parts: original.parts.map((part) => ({
              id: part.id,
              type: part.type,
              text: part.type === "text" ? part.text : undefined,
            })),
          })
        },
      })
    },
  )

  test.each(["user", "mission", "orchestrator", "goal-controller"])(
    "delivers an accepted %s Message with its original identity and author",
    async (author) => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const accepted = await acceptedRootMessage(`${author} input accepted before delivery`, author)
          await deliverTaskRootMessageToOrchestratorSession({
            task: requireTask(accepted.taskID),
            messageID: accepted.messageID,
            orchestratorSessionID: accepted.orchestrator.id,
          })
          const delivered = Database.use((db) =>
            db
              .select({ sessionID: MessageTable.session_id, data: MessageTable.data })
              .from(MessageTable)
              .where(eq(MessageTable.id, accepted.messageID))
              .get(),
          )
          expect({
            sessionID: delivered?.sessionID,
            author: (delivered?.data as { author?: string } | undefined)?.author,
            role: (delivered?.data as { role?: string } | undefined)?.role,
          }).toEqual({
            sessionID: accepted.orchestrator.id,
            // Position moved; what was said did not.
            author,
            role: "user",
          })
        },
      })
    },
  )

  test("commits prepared inputs for two Projects in reverse order under their original Task owners", async () => {
    await using first = await memoryProject()
    await using second = await memoryProject()
    const deliveries = await Promise.all(
      [first, second].map((project, index) =>
        Instance.provide({
          directory: project.path,
          fn: async () => {
            const accepted = await acceptedRootMessage(`Project ${index} original input`)
            return {
              ...accepted,
              directory: project.path,
              commit: await prepareTaskRootMessageDelivery({
                task: requireTask(accepted.taskID),
                messageID: accepted.messageID,
                orchestratorSessionID: accepted.orchestrator.id,
              }),
            }
          },
        }),
      ),
    )
    for (const input of deliveries.toReversed()) {
      await Instance.provide({
        directory: input.directory,
        fn: async () => {
          input.commit()
          const message = await MessageStore.get({ sessionID: input.orchestrator.id, messageID: input.messageID })
          expect({
            taskID: requireTask(input.taskID).id,
            projectID: (await Session.get(message.info.sessionID)).projectID,
            parentID: (await Session.get(message.info.sessionID)).parentID,
            text: message.parts.map((part) => (part.type === "text" ? part.text : undefined)),
          }).toEqual({
            taskID: input.taskID,
            projectID: Instance.project.id,
            parentID: input.root.id,
            text: [`Project ${deliveries.indexOf(input)} original input`],
          })
        },
      })
    }
  })

  test("maps accepted Message fact edits to the SQLite immutable-fact error contract", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const accepted = await acceptedRootMessage("Scheduler input that must stay exact")
        const original = Database.use((db) =>
          db
            .select({ data: MessageTable.data })
            .from(MessageTable)
            .where(eq(MessageTable.id, accepted.messageID))
            .get(),
        )!
        // A relocation that rewrites the author is not a relocation.
        expect(() =>
          Database.use((db) =>
            db
              .update(MessageTable)
              .set({ session_id: accepted.orchestrator.id, data: { ...original.data, author: "user" } })
              .where(eq(MessageTable.id, accepted.messageID))
              .run(),
          ),
        ).toThrow("accepted Task-root causal facts are immutable")
        // Staying put and bumping a timestamp is not a relocation either.
        expect(() =>
          Database.use((db) =>
            db
              .update(MessageTable)
              .set({ time_updated: Date.now() + 9 })
              .where(eq(MessageTable.id, accepted.messageID))
              .run(),
          ),
        ).toThrow("accepted Task-root causal facts are immutable")
        expect(
          Database.use((db) =>
            db
              .select({ sessionID: MessageTable.session_id })
              .from(MessageTable)
              .where(eq(MessageTable.id, accepted.messageID))
              .get(),
          ),
        ).toEqual({ sessionID: accepted.root.id })
      },
    })
  })
})
