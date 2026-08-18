import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { acceptTaskRootIngressInTransaction } from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { deliverTaskRootMessageToOrchestratorSession } from "@/task-api/task-root-message"
import { requireTask } from "@/engine/store"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

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
  async function acceptedRootMessage(title: string) {
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
    await Session.persistMessage({
      info: {
        id: messageID,
        sessionID: root.id,
        role: "user",
        author: "mission",
        time: { created: now + 1 },
        agent: "orchestrator",
        model: { providerID: "openai", modelID: "gpt-5.6-terra" },
      },
      parts: [{ id: Identifier.ascending("part"), sessionID: root.id, messageID, type: "text", text: title }],
    })
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

  test("delivers a Message that was accepted before it was delivered", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const accepted = await acceptedRootMessage("Scheduler input accepted before delivery")
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
          author: "mission",
          role: "user",
        })
      },
    })
  })

  test("still refuses to rewrite what an accepted Message said, or to touch it in place", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const accepted = await acceptedRootMessage("Scheduler input that must stay exact")
        const original = Database.use((db) =>
          db.select({ data: MessageTable.data }).from(MessageTable).where(eq(MessageTable.id, accepted.messageID)).get(),
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
