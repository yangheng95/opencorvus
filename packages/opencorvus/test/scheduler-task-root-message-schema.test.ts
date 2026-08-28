import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { EngineTaskTable } from "@/engine/engine.sql"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { Instance } from "@/project/instance"
import { requireSchedulerDelivery } from "@/protocol/delivery"
import { sendSchedulerMessage } from "@/protocol/scheduler-message"
import { TaskRootMessageProvenance } from "@/protocol/task-root-message-schema"
import { Session } from "@/session"
import { MessageTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("scheduler Task-root Message protocol", () => {
  test("materializes one delivery reference into the persisted Message and Orchestrator wake", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          model: "scheduler-schema-test/scheduler-schema-model",
          provider: {
            "scheduler-schema-test": {
              name: "Scheduler schema test",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:9/scheduler-schema-model",
              models: {
                "scheduler-schema-model": {
                  name: "Scheduler schema model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4_096 },
                },
              },
            },
          },
        })
        const missionID = `mission-${Identifier.uuid4First8()}`
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const root = await Session.create({ kind: "root", title: "Scheduler delivery target" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "mission",
              product_pillar: "code",
              title: "Scheduler delivery target",
              request: "Materialize the exact scheduler delivery reference",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({
            db,
            taskID,
            sessionID: root.id,
            now,
            source: "test.scheduler-delivery",
          })
        })

        const sourceUser = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "user",
          time: { created: now + 1 },
          agent: "mission",
          model: { providerID: "test", modelID: "test" },
        })
        const sourceMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: sourceUser.id,
          time: { created: now + 2 },
          agent: "mission",
          modelID: "test",
          providerID: "test",
          mode: "mission",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        })
        const sourceText = "Use the exact Mission scheduler delivery occurrence."
        const sourcePart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: sourceMessage.id,
          type: "tool",
          callID: `call-${Identifier.uuid4First8()}`,
          tool: "scheduler_message",
          state: {
            status: "running",
            input: { message: sourceText },
            time: { start: now + 3 },
          },
        })

        let observedWake: unknown
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ event }) => {
            if (event?.rootMessage) observedWake = event
            return {}
          },
        })
        const invocationID = `scheduler-delivery-${Identifier.uuid4First8()}`
        const receipt = await sendSchedulerMessage({
          invocationID,
          kind: "notification",
          source: {
            kind: "mission_scheduler",
            project_id: Instance.project.id,
            mission_id: missionID,
            session_id: mission.id,
          },
          target: {
            kind: "task_scheduler",
            project_id: Instance.project.id,
            task_id: taskID,
            root_session_id: root.id,
          },
          subject: "Exact scheduler delivery",
          sourceMessageID: sourceMessage.id,
          sourcePartID: sourcePart.id,
        })
        const delivery = requireSchedulerDelivery(receipt.inboxID)
        if (delivery.status !== "delivered") {
          throw new Error(`Scheduler delivery did not settle: ${JSON.stringify(delivery)}`)
        }
        const expectedReference = {
          eventID: receipt.eventID,
          inboxID: receipt.inboxID,
          sequence: delivery.event.sequence,
          threadID: invocationID,
          targetTaskExecutionEpoch: 1,
        }
        const persisted = Database.use((db) =>
          db
            .select({ data: MessageTable.data })
            .from(MessageTable)
            .where(eq(MessageTable.id, receipt.messageID!))
            .get(),
        )
        expect(receipt).toMatchObject({
          status: "delivered",
          messageID: expect.any(String),
          ingressID: expect.any(String),
        })
        expect(persisted).toBeDefined()
        expect(observedWake).toBeDefined()
        const provenance = TaskRootMessageProvenance.parse(
          (persisted?.data as { extra?: { task_root_message?: unknown } } | undefined)?.extra?.task_root_message,
        )
        const wake = OrchestratorEventSchema.parse(observedWake)

        expect(provenance).toEqual({
          protocol: "task-root-message",
          taskID,
          kind: "mission",
          source: `scheduler.message:${receipt.eventID}`,
          schedulerDelivery: expectedReference,
        })
        expect(wake.rootMessage).toEqual({
          messageID: receipt.messageID,
          kind: "mission",
          schedulerDelivery: expectedReference,
        })
      },
    })
  })
})
