import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Config } from "@/config/config"
import { EngineTaskTable } from "@/engine/engine.sql"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import { acceptTaskRootIngressInTransaction, acquireTaskRootIngressLease } from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import {
  auditSchedulerSessionDeliverySettlement,
  listUnansweredSchedulerSessionWakes,
  requireSchedulerDelivery,
  schedulerTargetOccurrenceIdentity,
} from "@/protocol/delivery"
import {
  drainSchedulerMessagesForProject,
  SchedulerMessageDeliveryService,
  sendSchedulerMessage,
} from "@/protocol/scheduler-message"
import { successfulSchedulerWakeReplyExistsInTransaction } from "@/protocol/session-wake-state"
import { TaskRootMessageProvenance } from "@/protocol/task-root-message-schema"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { MessageTable, PartTable, SessionControlRecordTable } from "@/session/session.sql"
import { SessionWake } from "@/session/wake"
import { Database, and, eq, sql } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

async function establishMissionTask(projectPath: string, title: string) {
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
    defaultCwd: projectPath,
    productPillar: "code",
    heldExpertSquadIDs: ["base"],
  })
  const root = await Session.create({ kind: "root", title })
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
        title,
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
  return { missionID, mission, root, taskID, now }
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("scheduler Task-root Message protocol", () => {
  test("materializes one delivery reference into the persisted Message and Orchestrator wake", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const { missionID, mission, root, taskID, now } = await establishMissionTask(
          project.path,
          "Scheduler delivery target",
        )

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
        await drainSchedulerMessagesForProject()
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

  test("materializes a Task notification and resumes its unanswered wake after a fresh bootstrap", async () => {
    await using project = await memoryProject()
    const fixture = await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const { missionID, mission, root, taskID, now } = await establishMissionTask(
          project.path,
          "Mission scheduler delivery source",
        )
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "Mission scheduler notification source",
        })
        const ingress = Database.immediateTransaction((db) =>
          acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: `scheduler-mission-source-${taskID}`,
            inlinePayload: { purpose: "Task scheduler notification source" },
            semanticTurnLimit: 1,
            activationLimit: 1,
            now: now + 1,
          }),
        )
        const lease = acquireTaskRootIngressLease({
          ingressID: ingress.id,
          ownerOccurrenceID: `scheduler-mission-source-owner-${taskID}`,
          now: now + 2,
          leaseMilliseconds: 60_000,
          assertControlOwnerInTransaction: () => undefined,
        })
        if (!lease.acquired) throw new Error("Expected the Task scheduler source ingress to acquire")
        const control = currentOrchestratorControlMessage(
          { taskCreation: { taskID } },
          taskID,
          ingress.id,
          ingress.id,
        )
        if (!control) throw new Error("Expected the Task scheduler source control occurrence")
        await Session.persistMessage({
          info: {
            id: control.messageID,
            sessionID: orchestrator.id,
            role: "user",
            author: "orchestrator",
            time: { created: now + 3 },
            agent: "orchestrator",
            model: { providerID: "test", modelID: "test" },
            extra: control.extra,
          },
          parts: [
            {
              id: control.partID,
              sessionID: orchestrator.id,
              messageID: control.messageID,
              type: "text",
              text: control.text,
              kind: "control",
              source: "system",
            } satisfies Message.TextPart,
          ],
        })
        const sourceMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: control.messageID,
          sessionID: orchestrator.id,
          role: "assistant",
          author: "orchestrator",
          time: { created: now + 4 },
          agent: "orchestrator",
          modelID: "test",
          providerID: "test",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          activationID: lease.activationID,
        })
        const sourceText = "Report the exact Task scheduler notification to the owning Mission."
        const sourcePart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: orchestrator.id,
          messageID: sourceMessage.id,
          type: "tool",
          callID: `call-${Identifier.uuid4First8()}`,
          tool: "scheduler_message",
          state: {
            status: "running",
            input: { message: sourceText },
            time: { start: now + 5 },
          },
        })
        let observedWake: { sessionID: string; messageID: string } | undefined
        using initialLoop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ sessionID, messageID }) => {
          observedWake = { sessionID, messageID }
        })
        const invocationID = `scheduler-mission-delivery-${Identifier.uuid4First8()}`
        const source = {
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: taskID,
          root_session_id: root.id,
        }
        const target = {
          kind: "mission_scheduler" as const,
          project_id: Instance.project.id,
          mission_id: missionID,
          session_id: mission.id,
        }
        const receipt = await sendSchedulerMessage({
          invocationID,
          kind: "notification",
          source,
          target,
          subject: "Task scheduler notification",
          sourceMessageID: sourceMessage.id,
          sourcePartID: sourcePart.id,
        })
        await drainSchedulerMessagesForProject()
        const delivery = requireSchedulerDelivery(receipt.inboxID)
        if (delivery.status !== "delivered") {
          throw new Error(`Mission scheduler delivery did not settle: ${JSON.stringify(delivery)}`)
        }
        const ids = schedulerTargetOccurrenceIdentity(receipt.inboxID)

        expect(delivery.status).toBe("delivered")
        expect(delivery.deliveryResult).toEqual({ kind: "session_wake", message_id: ids.messageID })
        expect(observedWake).toEqual({ sessionID: mission.id, messageID: ids.messageID })
        const persisted = await MessageStore.get({ sessionID: mission.id, messageID: ids.messageID })
        expect(persisted.info).toMatchObject({
          id: ids.messageID,
          sessionID: mission.id,
          role: "user",
          author: "orchestrator",
          extra: {
            wake_reason: {
              source: "scheduler.message",
              eventID: receipt.eventID,
              inboxID: receipt.inboxID,
              threadID: invocationID,
              messageKind: "notification",
              sourceEndpoint: source,
              targetEndpoint: target,
            },
          },
        })
        expect(persisted.parts).toEqual([
          expect.objectContaining({
            id: ids.textPartID,
            sessionID: mission.id,
            messageID: ids.messageID,
            type: "text",
            text: expect.stringContaining(sourceText),
          }),
        ])
        expect(listUnansweredSchedulerSessionWakes(Instance.project.id)).toEqual([
          { inboxID: receipt.inboxID, sessionID: mission.id, messageID: ids.messageID },
        ])

        return {
          projectID: Instance.project.id,
          missionSessionID: mission.id,
          receipt,
          ids,
          persisted,
        }
      },
    })

    await Instance.disposeAll()
    const recoveryOrder: string[] = []
    let markRecoveryActivated!: () => void
    const recoveryActivated = new Promise<void>((resolve) => {
      markRecoveryActivated = resolve
    })
    let releaseRecovery!: () => void
    const recoveryGate = new Promise<void>((resolve) => {
      releaseRecovery = resolve
    })
    using _recoveryLoop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ sessionID, messageID }) => {
      recoveryOrder.push("recovery:activated")
      markRecoveryActivated()
      await recoveryGate
      const completedAt = Date.now()
      await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID,
        parentID: messageID,
        role: "assistant",
        author: "mission",
        time: { created: completedAt, completed: completedAt + 1 },
        agent: "mission",
        providerID: "test",
        modelID: "test",
        mode: "mission",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      })
      recoveryOrder.push("reply:persisted")
    })
    const bootstrapWakeBinding = spyOn(SchedulerMessageDeliveryService, "bindSessionWake")
    try {
      const poller = SchedulerMessageDeliveryService.runDueNow().then(() => {
        recoveryOrder.push("poller:settled")
      })
      await recoveryActivated
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      recoveryOrder.push("recovery:released")
      releaseRecovery()
      await poller

      const recoveredWake = await MessageStore.get({
        sessionID: fixture.missionSessionID,
        messageID: fixture.ids.messageID,
      })
      const occurrenceCounts = Database.use((db) => ({
        messages: db
          .select({ id: MessageTable.id })
          .from(MessageTable)
          .where(
            and(
              eq(MessageTable.session_id, fixture.missionSessionID),
              sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.inboxID') = ${fixture.receipt.inboxID}`,
            ),
          )
          .all().length,
        parts: db
          .select({ id: PartTable.id })
          .from(PartTable)
          .where(eq(PartTable.message_id, fixture.ids.messageID))
          .all().length,
        controls: db
          .select({ id: SessionControlRecordTable.id })
          .from(SessionControlRecordTable)
          .where(
            and(
              eq(SessionControlRecordTable.session_id, fixture.missionSessionID),
              eq(SessionControlRecordTable.kind, "wake_reason"),
              sql`json_extract(${SessionControlRecordTable.payload}, '$.wake_reason.inboxID') = ${fixture.receipt.inboxID}`,
            ),
          )
          .all().length,
      }))

      expect(bootstrapWakeBinding).toHaveBeenCalledTimes(1)
      expect(recoveryOrder).toEqual([
        "recovery:activated",
        "recovery:released",
        "reply:persisted",
        "poller:settled",
      ])
      expect(recoveredWake).toEqual(fixture.persisted)
      expect(occurrenceCounts).toEqual({ messages: 1, parts: 1, controls: 1 })
      expect(
        Database.use((db) =>
          successfulSchedulerWakeReplyExistsInTransaction(db, {
            sessionID: fixture.missionSessionID,
            messageID: fixture.ids.messageID,
          }),
        ),
      ).toBe(true)
      expect(auditSchedulerSessionDeliverySettlement(fixture.missionSessionID)).toMatchObject({ passed: true })
      expect(requireSchedulerDelivery(fixture.receipt.inboxID).deliveryResult).toEqual({
        kind: "session_wake",
        message_id: fixture.ids.messageID,
      })
    } finally {
      releaseRecovery()
      bootstrapWakeBinding.mockRestore()
    }
  })
})
