import { afterEach, describe, expect, test } from "bun:test"
import { sql } from "drizzle-orm"
import { BusPublicationOutboxTable } from "../src/bus/bus.sql"
import { EngineTaskRootIngressTable, EngineTaskTable } from "../src/engine/engine.sql"
import { rewindTask, taskRewindCursor } from "../src/engine/rewind"
import { taskLifecycleProjection } from "../src/engine/task-lifecycle"
import { taskRootIngressDispositionInTransaction } from "../src/engine/task-root-ingress-disposition"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Config } from "../src/config/config"
import { ProtocolEventTable } from "../src/protocol/protocol.sql"
import { ProtocolStore } from "../src/protocol/store"
import { Session } from "../src/session"
import { Database, and, eq } from "../src/storage/db"
import { EngineService } from "../src/task-api"
import { TestHooks as TaskControlTestHooks } from "../src/engine/task-root-ingress-delivery"
import { InstanceBootstrap } from "../src/project/bootstrap"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Task operator message acceptance is one transaction", () => {
  test("a failed acceptance leaves no overlay or message, and the retry commits every fact together", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        // The orchestrator loop is out of scope: acceptance atomicity is the
        // contract under test, so ingress wakes run a no-op runner.
        using _ingressRunner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await Config.updateProjectPatch({
          provider: {
            "overlay-test-provider": {
              name: "Overlay test provider",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:9/overlay-test-model",
              models: {
                "overlay-test-model": {
                  name: "Overlay test model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4_096 },
                },
              },
            },
          },
        })
        const taskID = await EngineService.createTask(
          {
            requestID: `arc011-${Identifier.ascending("artifact")}`,
            request: "Accept operator messages atomically",
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: "base",
          },
          { actor: "user" },
        )
        const task = await EngineService.getTask(taskID)
        const overlayModel = async () => {
          const rootSession = await Session.get(task.sessionID!)
          const overlay = (rootSession.metadata as Record<string, any> | undefined)?.configOverlay
          return typeof overlay?.model === "string" ? overlay.model : undefined
        }
        const userMessageCount = async () =>
          (await Session.messages({ sessionID: task.sessionID! })).filter((m) => m.info.role === "user").length
        const baselineMessages = await userMessageCount()
        expect(await overlayModel()).toBe("firmware/gpt-5")

        const rewindAt = Date.now() + 10
        await rewindTask({ taskID, anchor: { kind: "cursorTime", cursorTime: rewindAt } })
        Database.transaction(() => {
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: taskID,
            task_id: null,
            session_id: task.sessionID!,
            source: "test.task-message-atomic-acceptance",
            emitted_at: Date.now(),
            payload: { execution_epoch: 1 },
          })
        })
        await Database.awaitEffectIdle(5_000)
        const initialIngresses = Database.use((db) =>
          db
            .select({ id: EngineTaskRootIngressTable.id })
            .from(EngineTaskRootIngressTable)
            .where(eq(EngineTaskRootIngressTable.task_id, taskID))
            .all(),
        )
        const initialIngressDeadline = Date.now() + 5_000
        while (
          !Database.use((db) =>
            initialIngresses.every((ingress) =>
              Boolean(taskRootIngressDispositionInTransaction(db, { taskID, ingressID: ingress.id })),
            ),
          )
        ) {
          if (Date.now() >= initialIngressDeadline) {
            throw new Error(`Timed out waiting for Task ${taskID} initial ingress disposition`)
          }
          await Bun.sleep(5)
        }

        const footprint = async () => {
          const currentTask = Database.use((db) =>
            db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get(),
          )!
          return {
            overlay: await overlayModel(),
            attachments: currentTask.attachments ?? [],
            userMessages: await userMessageCount(),
            ingress: Database.use((db) =>
              db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.task_id, taskID)).all(),
            ),
            taskEvents: Database.use((db) =>
              db
                .select()
                .from(ProtocolEventTable)
                .where(and(eq(ProtocolEventTable.aggregate_type, "task"), eq(ProtocolEventTable.aggregate_id, taskID)))
                .all(),
            ),
            lifecycle: taskLifecycleProjection(taskID),
            rewindCursor: taskRewindCursor(taskID),
            outbox: Database.use((db) => db.select().from(BusPublicationOutboxTable).all()),
          }
        }
        const before = await footprint()

        // The trigger fires at the last durable acceptance fact. By then the
        // Message/Parts, model overlay, attachment reference, reopened epoch,
        // rewind-clear fact, TaskMessageRecorded event and ingress policy are
        // all inside the transaction and publication effects are queued.
        Database.use((db) =>
          db.run(
            sql.raw(`
            CREATE TEMP TRIGGER arc011_fail_after_message_ingress
            AFTER INSERT ON engine_task_root_ingress
            WHEN NEW.source = 'message' AND NEW.task_id = '${taskID}'
            BEGIN
              SELECT RAISE(ABORT, 'injected acceptance commit failure');
            END
          `),
          ),
        )
        const attachment = {
          data: Buffer.from("atomic operator attachment", "utf8").toString("base64"),
          mime: "text/plain",
          filename: "atomic.txt",
        }
        try {
          await expect(
            EngineService.handleTaskMessage(taskID, {
              source: "api",
              text: "switch models and continue",
              model: "overlay-test-provider/overlay-test-model",
              attachments: [attachment],
            }),
          ).rejects.toThrow("injected acceptance commit failure")
        } finally {
          Database.use((db) => db.run(sql.raw("DROP TRIGGER arc011_fail_after_message_ingress")))
        }
        await Database.awaitEffectIdle(5_000)
        expect(await footprint()).toEqual(before)

        // The retried message commits the Message, its ingress and the
        // overlay together.
        const note = await EngineService.handleTaskMessage(taskID, {
          source: "api",
          text: "switch models and continue",
          model: "overlay-test-provider/overlay-test-model",
          attachments: [attachment],
        })
        await Database.awaitEffectIdle(5_000)
        const committed = await footprint()
        const committedMessageID = note.user_message.info.id
        const committedIngress = committed.ingress.find(
          (row) => row.source === "message" && row.source_id === committedMessageID,
        )
        expect({
          overlay: committed.overlay,
          userMessages: committed.userMessages,
          hasIngress: typeof (note as { ingress_id?: string }).ingress_id === "string",
          messageRole: note.user_message.info.role,
          attachment: committed.attachments[0] && {
            filename: committed.attachments[0].filename,
            intent: committed.attachments[0].intent,
            source: committed.attachments[0].source,
          },
          lifecycle: { epoch: committed.lifecycle.epoch, status: committed.lifecycle.status },
          rewindCursor: committed.rewindCursor,
          ingressEpoch: committedIngress?.execution_epoch,
        }).toEqual({
          overlay: "overlay-test-provider/overlay-test-model",
          userMessages: baselineMessages + 1,
          hasIngress: true,
          messageRole: "user",
          attachment: { filename: "atomic.txt", intent: "task_input", source: "user-upload" },
          lifecycle: { epoch: 2, status: "active" },
          rewindCursor: null,
          ingressEpoch: 2,
        })
      },
    })
  }, 120_000)
})
