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
import { ProtocolDeliveryReceiptTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import {
  drainSchedulerMessagesForCurrentProject,
  SchedulerMessageTestHooks,
  sendSchedulerMessage,
} from "@/protocol/scheduler-message"
import { TaskRootMessageProvenance } from "@/protocol/task-root-message-schema"
import { Session } from "@/session"
import { MessageTable } from "@/session/session.sql"
import { and, Database, eq, sql } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("scheduler Task-root Message protocol", () => {
  test("serializes concurrent direct sends through one recipient owner", async () => {
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
        const siblingRoot = await Session.create({ kind: "root", title: "Sibling scheduler delivery target" })
        const taskID = Identifier.ascending("task")
        const siblingTaskID = Identifier.ascending("task")
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
          db.insert(EngineTaskTable)
            .values({
              id: siblingTaskID,
              project_id: Instance.project.id,
              session_id: siblingRoot.id,
              source: "mission",
              product_pillar: "code",
              title: "Sibling scheduler delivery target",
              request: "Remain concurrent with another recipient owner",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({
            db,
            taskID: siblingTaskID,
            sessionID: siblingRoot.id,
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

        const observedWakes: unknown[] = []
        let enteredFirst!: () => void
        let releaseFirst!: () => void
        const firstEntered = new Promise<void>((resolve) => (enteredFirst = resolve))
        const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve))
        let revisionCutEnabled = false
        let enteredRevisionCut!: () => void
        let releaseRevisionCut!: () => void
        const revisionCutEntered = new Promise<void>((resolve) => (enteredRevisionCut = resolve))
        const revisionCutGate = new Promise<void>((resolve) => (releaseRevisionCut = resolve))
        const observedRevisions: number[] = []
        let revisionCutObserved = false
        let revisionAtCut = 0
        using _revisionHook = SchedulerMessageTestHooks.installBeforeRecipientRevisionCheck(async (input) => {
          if (input.actor !== "task" || input.actorID !== taskID) return
          observedRevisions.push(input.observedRevision)
          if (!revisionCutEnabled || revisionCutObserved) return
          revisionCutObserved = true
          revisionAtCut = input.observedRevision
          enteredRevisionCut()
          await revisionCutGate
        })
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ event }) => {
            if (event?.rootMessage) {
              observedWakes.push(event)
              if (observedWakes.length === 1) {
                enteredFirst()
                await firstGate
              }
            }
            return {}
          },
        })
        const invocationID = `scheduler-delivery-${Identifier.uuid4First8()}`
        const endpoint = {
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: taskID,
          root_session_id: root.id,
        }
        const firstSend = sendSchedulerMessage({
          invocationID,
          kind: "notification",
          source: {
            kind: "mission_scheduler",
            project_id: Instance.project.id,
            mission_id: missionID,
            session_id: mission.id,
          },
          target: endpoint,
          subject: "Exact scheduler delivery",
          sourceMessageID: sourceMessage.id,
          sourcePartID: sourcePart.id,
        })
        await firstEntered
        const secondInvocationID = `scheduler-delivery-${Identifier.uuid4First8()}`
        const secondSend = sendSchedulerMessage({
          invocationID: secondInvocationID,
          kind: "notification",
          source: {
            kind: "mission_scheduler",
            project_id: Instance.project.id,
            mission_id: missionID,
            session_id: mission.id,
          },
          target: endpoint,
          subject: "Second exact scheduler delivery",
          sourceMessageID: sourceMessage.id,
          sourcePartID: sourcePart.id,
        })
        const inboxDeadline = Date.now() + 5_000
        while (
          Database.use(
            (db) =>
              db
                .select()
                .from(ProtocolInboxTable)
                .where(and(eq(ProtocolInboxTable.actor, "task"), eq(ProtocolInboxTable.actor_id, taskID)))
                .all().length,
          ) < 2 &&
          Date.now() < inboxDeadline
        )
          await Bun.sleep(10)
        const gatedSnapshot = Database.use((db) => ({
          inboxes: db
            .select()
            .from(ProtocolInboxTable)
            .where(and(eq(ProtocolInboxTable.actor, "task"), eq(ProtocolInboxTable.actor_id, taskID)))
            .all().length,
          terminalReceipts: db
            .select()
            .from(ProtocolDeliveryReceiptTable)
            .innerJoin(ProtocolInboxTable, eq(ProtocolInboxTable.id, ProtocolDeliveryReceiptTable.inbox_id))
            .where(
              and(
                eq(ProtocolInboxTable.actor, "task"),
                eq(ProtocolInboxTable.actor_id, taskID),
                sql`json_extract(${ProtocolDeliveryReceiptTable.receipt}, '$.kind') <> 'retry_wait'`,
              ),
            )
            .all().length,
          runnerOccurrences: observedWakes.length,
        }))
        releaseFirst()
        const [receipt, secondReceipt] = await Promise.all([firstSend, secondSend])
        expect(gatedSnapshot).toEqual({ inboxes: 2, terminalReceipts: 1, runnerOccurrences: 1 })
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
        expect(observedWakes).toHaveLength(1)
        const provenance = TaskRootMessageProvenance.parse(
          (persisted?.data as { extra?: { task_root_message?: unknown } } | undefined)?.extra?.task_root_message,
        )
        const wake = OrchestratorEventSchema.parse(observedWakes[0])

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
        const deliveryOrder = [
          requireSchedulerDelivery(receipt.inboxID).event.sequence,
          requireSchedulerDelivery(secondReceipt.inboxID).event.sequence,
        ]
        expect({ secondReceipt }).toMatchObject({
          secondReceipt: { status: "delivered", messageID: expect.any(String), ingressID: expect.any(String) },
        })
        expect(deliveryOrder[1]).toBe(deliveryOrder[0]! + 1)

        revisionCutEnabled = true
        const thirdSend = sendSchedulerMessage({
          invocationID: `scheduler-delivery-${Identifier.uuid4First8()}`,
          kind: "notification",
          source: {
            kind: "mission_scheduler",
            project_id: Instance.project.id,
            mission_id: missionID,
            session_id: mission.id,
          },
          target: endpoint,
          subject: "Revision cut head",
          sourceMessageID: sourceMessage.id,
          sourcePartID: sourcePart.id,
        })
        await revisionCutEntered
        const fourthSend = sendSchedulerMessage({
          invocationID: `scheduler-delivery-${Identifier.uuid4First8()}`,
          kind: "notification",
          source: {
            kind: "mission_scheduler",
            project_id: Instance.project.id,
            mission_id: missionID,
            session_id: mission.id,
          },
          target: endpoint,
          subject: "Revision cut follower",
          sourceMessageID: sourceMessage.id,
          sourcePartID: sourcePart.id,
        })
        const signalDiscoveryDrain = drainSchedulerMessagesForCurrentProject()
        const recoveryDiscoveryDrain = drainSchedulerMessagesForCurrentProject()
        const siblingSend = sendSchedulerMessage({
          invocationID: `scheduler-delivery-${Identifier.uuid4First8()}`,
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
            task_id: siblingTaskID,
            root_session_id: siblingRoot.id,
          },
          subject: "Sibling recipient remains concurrent",
          sourceMessageID: sourceMessage.id,
          sourcePartID: sourcePart.id,
        })
        const siblingReceipt = await siblingSend
        expect(siblingReceipt).toMatchObject({ status: "delivered", messageID: expect.any(String) })
        releaseRevisionCut()
        const [thirdReceipt, fourthReceipt] = await Promise.all([
          thirdSend,
          fourthSend,
          signalDiscoveryDrain,
          recoveryDiscoveryDrain,
        ])
        expect({ thirdReceipt, fourthReceipt }).toMatchObject({
          thirdReceipt: { status: "delivered", messageID: expect.any(String) },
          fourthReceipt: { status: "delivered", messageID: expect.any(String) },
        })
        expect(observedRevisions.at(-1)).toBeGreaterThanOrEqual(revisionAtCut + 3)
      },
    })
  }, 30_000)
})
