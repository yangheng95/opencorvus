import { afterEach, describe, expect, test } from "bun:test"
import { EngineArtifactTable, EngineTaskTable } from "@/engine/engine.sql"
import {
  persistQueuedRootMessageWakeInTransaction,
  QueueOrderingTestHooks,
  TestHooks as QueueTestHooks,
} from "@/engine/queue"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { persistEstablishedTask } from "./fixture/engine-task"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.13.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function persistOperatorMessage(input: { taskID: string; rootSessionID: string; text: string }) {
  const messageID = Identifier.ascending("message")
  const now = Date.now()
  await Session.persistMessage({
    info: {
      id: messageID,
      sessionID: input.rootSessionID,
      role: "user",
      author: "user",
      time: { created: now },
      agent: "orchestrator",
      model: { providerID: "openai", modelID: "gpt-5.6-terra" },
      extra: {
        task_root_message: {
          protocol: "task-root-message",
          taskID: input.taskID,
          kind: "operator",
          source: "operator.test",
        },
      },
    },
    parts: [
      {
        id: Identifier.ascending("part"),
        sessionID: input.rootSessionID,
        messageID,
        type: "text",
        text: input.text,
        kind: "user_content",
        source: "user",
      } satisfies Message.TextPart,
    ],
  })
  return { messageID, now }
}

describe("Task root Session durable ingress FIFO", () => {
  test("keeps a later operator ingress pending behind the exact running head", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({
          kind: "root",
          title: "Root ingress FIFO",
          metadata: { configOverlay: { model: "openai/gpt-5.6-terra" } },
        })
        const now = Date.now()
        persistEstablishedTask({
          taskID,
          sessionID: root.id,
          now,
          title: "Root ingress FIFO",
          request: "Preserve exact operator message order",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const firstMessage = await persistOperatorMessage({
          taskID,
          rootSessionID: root.id,
          text: "First exact operator message",
        })
        const firstIngressID = Database.transaction((db) =>
          persistQueuedRootMessageWakeInTransaction(db, {
            task: db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()!,
            messageID: firstMessage.messageID,
            kind: "operator",
            now: firstMessage.now,
          }),
        )
        expect(QueueTestHooks.startQueuedWake(firstIngressID)).toBe(true)

        const secondMessage = await persistOperatorMessage({
          taskID,
          rootSessionID: root.id,
          text: "Second exact operator message",
        })
        const secondIngressID = Database.transaction((db) =>
          persistQueuedRootMessageWakeInTransaction(db, {
            task: db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()!,
            messageID: secondMessage.messageID,
            kind: "operator",
            now: secondMessage.now,
          }),
        )
        const secondLabel = Database.use(
          (db) =>
            db
              .select({ label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, secondIngressID))
              .get()?.label,
        )
        const head = QueueOrderingTestHooks.head(taskID)
        expect(head?.id).toBe(firstIngressID)
        expect(head?.label).toBe("running")
        expect(secondLabel).toBe("pending")
      },
    })
  })
})
