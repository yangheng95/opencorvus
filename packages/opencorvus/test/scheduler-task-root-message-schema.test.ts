import { afterEach, describe, expect, spyOn, test } from "bun:test"
import path from "node:path"
import { Config } from "@/config/config"
import { EngineTaskTable } from "@/engine/engine.sql"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import { acceptTaskRootIngressInTransaction, acquireTaskRootIngressLease } from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import {
  closeMissionExecutionOperation,
  currentMissionExecutionClosure,
  missionOperatorWakeReason,
  openMissionExecutionWithWake,
} from "@/mission/execution-closure"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { ProjectTable } from "@/project/project.sql"
import {
  auditSchedulerSessionDeliverySettlement,
  claimNextSchedulerDelivery,
  deadLetterSchedulerDelivery,
  enqueueSchedulerMessageInTransaction,
  listPendingSchedulerRecipientIDs,
  listPendingSchedulerProjectIDs,
  missionSchedulerOccurrenceBindingForEnvelope,
  listUnansweredSchedulerSessionWakes,
  nextSchedulerDeliveryDueAt,
  rescheduleSchedulerDelivery,
  requireSchedulerDelivery,
  schedulerTargetOccurrenceIdentity,
} from "@/protocol/delivery"
import {
  drainSchedulerMessagesForProject,
  SchedulerMessageTestHooks,
  SchedulerMessageDeliveryService,
  sendSchedulerMessage,
} from "@/protocol/scheduler-message"
import { successfulSchedulerWakeReplyExistsInTransaction } from "@/protocol/session-wake-state"
import { ProtocolInboxTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { TaskRootMessageProvenance } from "@/protocol/task-root-message-schema"
import { ExecutionCapacityTestHooks } from "@/runtime/execution-capacity"
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
  using _openLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
  await openMissionExecutionWithWake({
    sessionID: mission.id,
    missionID,
    source: "mission.wake",
    requestID: `scheduler-schema:${missionID}`,
    acceptedInput: {
      text: "Open the exact Mission occurrence for scheduler delivery.",
      model: null,
      attachments: [],
      configPatch: {},
      context: { surface: "test.scheduler-task-root" },
    },
    wake: (admission) =>
      SessionWake.wakeWithReceipt({
        sessionID: mission.id,
        messageID: admission.messageID,
        textPartID: admission.textPartID,
        controlID: admission.controlID,
        prompt: "Open the exact Mission occurrence for scheduler delivery.",
        author: "user",
        agent: "mission",
        surface: "panel",
        userAuthored: true,
        reason: missionOperatorWakeReason(admission, missionID),
        commitBundle: admission.commitBundle,
        preflightBundle: admission.preflightBundle,
        ownerPreflight: admission.ownerPreflight,
        ownerLifecycle: admission.ownerLifecycle,
      }),
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
  test("discovers a large scheduler Project backlog through fixed database cursor pages", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const now = Date.now()
        const projectIDs = Array.from({ length: 65 }, (_, index) => `scheduler-project-${String(index).padStart(3, "0")}`)
        Database.immediateTransaction((db) => {
          for (const [projectIndex, projectID] of projectIDs.entries()) {
            db.insert(ProjectTable)
              .values({
                id: projectID,
                worktree: path.join(project.path, projectID),
                name: `Scheduler Project ${projectIndex}`,
                sandboxes: [],
                time_created: now + projectIndex,
                time_updated: now + projectIndex,
              })
              .run()
            for (let recipientIndex = 0; recipientIndex < 4; recipientIndex += 1) {
              const taskID = Identifier.ascending("task")
              db.insert(EngineTaskTable)
                .values({
                  id: taskID,
                  project_id: projectID,
                  session_id: null,
                  source: "mission",
                  product_pillar: "code",
                  title: `Scheduler discovery recipient ${projectIndex}/${recipientIndex}`,
                  request: "Discover this immutable scheduler recipient head",
                  metadata: {
                    actor: "mission",
                    mission: { id: `mission-${projectIndex}`, session_id: `session-${projectIndex}` },
                  },
                  time_created: now + projectIndex * 10 + recipientIndex,
                })
                .run()
              const event = ProtocolStore.appendEventInTransaction({
                kind: "event",
                type: "scheduler.message",
                aggregate: "task",
                aggregate_id: taskID,
                source: "test.scheduler-project-page",
                emitted_at: now + projectIndex * 10 + recipientIndex,
                payload: {},
              })
              db.insert(ProtocolInboxTable)
                .values({
                  id: Identifier.ascending("protocol_inbox"),
                  envelope_id: event.id,
                  actor: "task",
                  actor_id: taskID,
                  visible_at: now + projectIndex * 10 + recipientIndex,
                  time_created: now + projectIndex * 10 + recipientIndex,
                })
                .run()
            }
          }
        })

        const first = listPendingSchedulerProjectIDs({ limit: 32 })
        const second = listPendingSchedulerProjectIDs({ afterProjectID: first.at(-1), limit: 32 })
        const third = listPendingSchedulerProjectIDs({ afterProjectID: second.at(-1), limit: 32 })
        expect({
          pageSizes: [first.length, second.length, third.length],
          projectIDs: [...first, ...second, ...third],
          sampleDueAt: nextSchedulerDeliveryDueAt(projectIDs[37]!, now),
        }).toEqual({
          pageSizes: [32, 32, 1],
          projectIDs,
          sampleDueAt: now + 370,
        })
      },
    })
  })

  test("settles a Mission delivery against the occurrence open at enqueue after close and reopen", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const { missionID, mission, root, taskID, now } = await establishMissionTask(
          project.path,
          "Scheduler delivery closure binding",
        )
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "Scheduler closure binding source",
        })
        const ingress = Database.immediateTransaction((db) =>
          acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: `scheduler-closure-source-${taskID}`,
            inlinePayload: { purpose: "Scheduler closure binding source" },
            semanticTurnLimit: 1,
            activationLimit: 1,
            now: now + 1,
          }),
        )
        const lease = acquireTaskRootIngressLease({
          ingressID: ingress.id,
          ownerOccurrenceID: `scheduler-closure-owner-${taskID}`,
          now: now + 2,
          leaseMilliseconds: 60_000,
          assertControlOwnerInTransaction: () => undefined,
        })
        if (!lease.acquired) throw new Error("Expected the scheduler closure source ingress to acquire")
        const control = currentOrchestratorControlMessage(
          { taskCreation: { taskID } },
          taskID,
          ingress.id,
          ingress.id,
        )
        if (!control) throw new Error("Expected the scheduler closure source control occurrence")
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
        const sourcePart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: orchestrator.id,
          messageID: sourceMessage.id,
          type: "tool",
          callID: `call-${Identifier.uuid4First8()}`,
          tool: "scheduler_message",
          state: {
            status: "running",
            input: { message: "Keep this delivery in its first Mission occurrence." },
            time: { start: now + 5 },
          },
        })
        using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
        using _materialization = SchedulerMessageTestHooks.installBeforeMissionMaterialization(async () => {
          await closeMissionExecutionOperation({
            missionID,
            sessionID: mission.id,
            source: "mission.abort",
            requestID: "close-scheduler-message-old-occurrence",
            provenance: { kind: "request", surface: "api", reason: "Close the scheduler Message occurrence" },
            signal: AbortSignal.timeout(20_000),
          })
          await openMissionExecutionWithWake({
            sessionID: mission.id,
            missionID,
            source: "mission.wake",
            requestID: "scheduler-message-new-occurrence",
            acceptedInput: {
              text: "Open a new Mission occurrence after the old delivery was accepted.",
              model: null,
              attachments: [],
              configPatch: {},
              context: { surface: "test.scheduler-task-root" },
            },
            wake: (admission) =>
              SessionWake.wakeWithReceipt({
                sessionID: mission.id,
                messageID: admission.messageID,
                textPartID: admission.textPartID,
                controlID: admission.controlID,
                prompt: "Open a new Mission occurrence after the old delivery was accepted.",
                author: "user",
                agent: "mission",
                surface: "panel",
                userAuthored: true,
                reason: missionOperatorWakeReason(admission, missionID),
                commitBundle: admission.commitBundle,
                preflightBundle: admission.preflightBundle,
                ownerPreflight: admission.ownerPreflight,
                ownerLifecycle: admission.ownerLifecycle,
              }),
          })
        })
        const target = {
          kind: "mission_scheduler" as const,
          project_id: Instance.project.id,
          mission_id: missionID,
          session_id: mission.id,
        }
        const receipt = await sendSchedulerMessage({
          invocationID: `scheduler-mission-closure-${Identifier.uuid4First8()}`,
          kind: "notification",
          source: {
            kind: "task_scheduler",
            project_id: Instance.project.id,
            task_id: taskID,
            root_session_id: root.id,
          },
          target,
          subject: "Old Mission occurrence delivery",
          sourceMessageID: sourceMessage.id,
          sourcePartID: sourcePart.id,
        })
        await drainSchedulerMessagesForProject()
        const delivery = requireSchedulerDelivery(receipt.inboxID)
        const ids = schedulerTargetOccurrenceIdentity(receipt.inboxID)
        expect(delivery).toMatchObject({
          status: "delivered",
          deliveryResult: {
            kind: "mission_closed",
            closure_event_id: expect.stringMatching(/^pev_/),
          },
        })
        expect(
          Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.id, ids.messageID)).get()),
        ).toBeUndefined()
      },
    })
  }, 60_000)

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
        const peerRoot = await Session.create({ kind: "root", title: "Scheduler delivery peer target" })
        const peerTaskID = Identifier.ascending("task")
        Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: peerTaskID,
              project_id: Instance.project.id,
              session_id: peerRoot.id,
              source: "mission",
              product_pillar: "code",
              title: "Scheduler delivery peer target",
              request: "Receive the peer direct Scheduler Message",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_created: now + 1,
            })
            .run()
          appendTaskOpenedInTransaction({
            db,
            taskID: peerTaskID,
            sessionID: peerRoot.id,
            now: now + 1,
            source: "test.scheduler-direct-capacity",
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
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ event }) => {
            if (event?.rootMessage) observedWakes.push(event)
            return {}
          },
        })
        using _capacity = ExecutionCapacityTestHooks.install({ scheduler_message: 1 })
        let materializationStarts = 0
        const firstStarted = Promise.withResolvers<void>()
        const releaseFirst = Promise.withResolvers<void>()
        using _materialization = SchedulerMessageTestHooks.installBeforeTaskMaterialization(async () => {
          materializationStarts += 1
          if (materializationStarts === 1) {
            firstStarted.resolve()
            await releaseFirst.promise
          }
        })
        const invocationID = `scheduler-delivery-${Identifier.uuid4First8()}`
        const receiptPending = sendSchedulerMessage({
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
        await firstStarted.promise
        const peerReceiptPending = sendSchedulerMessage({
          invocationID: `scheduler-delivery-peer-${Identifier.uuid4First8()}`,
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
            task_id: peerTaskID,
            root_session_id: peerRoot.id,
          },
          subject: "Peer exact scheduler delivery",
          sourceMessageID: sourceMessage.id,
          sourcePartID: sourcePart.id,
        })
        await Bun.sleep(50)
        expect(materializationStarts).toBe(1)
        releaseFirst.resolve()
        const [receipt, peerReceipt] = await Promise.all([receiptPending, peerReceiptPending])
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
        expect({ materializationStarts, peerStatus: peerReceipt.status, observedWakeCount: observedWakes.length }).toEqual({
          materializationStarts: 2,
          peerStatus: "delivered",
          observedWakeCount: 2,
        })
        const provenance = TaskRootMessageProvenance.parse(
          (persisted?.data as { extra?: { task_root_message?: unknown } } | undefined)?.extra?.task_root_message,
        )
        const wake = observedWakes.map((value) => OrchestratorEventSchema.parse(value)).find(
          (value) => value.rootMessage?.schedulerDelivery?.inboxID === receipt.inboxID,
        )
        if (!wake) throw new Error("Scheduler delivery wake was not observed")

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
  }, 30_000)

  test("pages only due unresolved recipient heads and refills the shared production capacity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
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
        const missionID = `mission-recipient-page-${Identifier.uuid4First8()}`
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const root = await Session.create({ kind: "root", title: "Scheduler recipient page source" })
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
              title: "Scheduler recipient page source",
              request: "Create the scheduler recipient page source",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({
            db,
            taskID,
            sessionID: root.id,
            now,
            source: "test.scheduler-recipient-page",
          })
        })
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "Scheduler recipient page orchestrator",
        })
        const ingress = Database.immediateTransaction((db) =>
          acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: `scheduler-recipient-page-source-${taskID}`,
            inlinePayload: { purpose: "Scheduler recipient page source" },
            semanticTurnLimit: 1,
            activationLimit: 1,
            now: now + 1,
          }),
        )
        const lease = acquireTaskRootIngressLease({
          ingressID: ingress.id,
          ownerOccurrenceID: `scheduler-recipient-page-owner-${taskID}`,
          now: now + 2,
          leaseMilliseconds: 60_000,
          assertControlOwnerInTransaction: () => undefined,
        })
        if (!lease.acquired) throw new Error("Scheduler recipient page source did not acquire")
        const control = currentOrchestratorControlMessage(
          { taskCreation: { taskID } },
          taskID,
          ingress.id,
          ingress.id,
        )
        if (!control) throw new Error("Scheduler recipient page source has no control Message")
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
          sessionID: orchestrator.id,
          role: "assistant",
          author: "orchestrator",
          parentID: control.messageID,
          time: { created: now + 4 },
          agent: "orchestrator",
          modelID: "test",
          providerID: "test",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          activationID: lease.activationID,
        })
        const sourcePart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: orchestrator.id,
          messageID: sourceMessage.id,
          type: "tool",
          callID: `call-${Identifier.uuid4First8()}`,
          tool: "scheduler_message",
          state: {
            status: "running",
            input: { message: "Drain every bounded scheduler recipient page." },
            time: { start: now + 5 },
          },
        })
        const source = {
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: taskID,
          root_session_id: root.id,
        }
        const recipients: Array<{ taskID: string; rootSessionID: string }> = []
        for (let index = 0; index < 66; index += 1) {
          const targetRoot = await Session.create({ kind: "root", title: `Scheduler page target ${index}` })
          const targetTaskID = Identifier.ascending("task")
          Database.immediateTransaction((db) => {
            db.insert(EngineTaskTable)
              .values({
                id: targetTaskID,
                project_id: Instance.project.id,
                session_id: targetRoot.id,
                source: "mission",
                product_pillar: "code",
                title: `Scheduler page target ${index}`,
                request: `Materialize scheduler recipient page target ${index}`,
                metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
                time_created: now + 10 + index,
              })
              .run()
            appendTaskOpenedInTransaction({
              db,
              taskID: targetTaskID,
              sessionID: targetRoot.id,
              now: now + 10 + index,
              source: "test.scheduler-recipient-page",
            })
          })
          recipients.push({ taskID: targetTaskID, rootSessionID: targetRoot.id })
        }

        const enqueue = (targetTaskID: string, targetRootSessionID: string, invocationID: string) =>
          Database.transaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID,
              kind: "notification",
              source,
              target: {
                kind: "task_scheduler",
                project_id: Instance.project.id,
                task_id: targetTaskID,
                root_session_id: targetRootSessionID,
              },
              subject: "Bounded recipient page",
              sourceMessageID: sourceMessage.id,
              sourcePartID: sourcePart.id,
              correlationID: invocationID,
              threadID: invocationID,
            }),
          )

        for (let index = 0; index < 70; index += 1) {
          const historical = enqueue(
            recipients[0]!.taskID,
            recipients[0]!.rootSessionID,
            `scheduler-settled-history-${index}-${Identifier.uuid4First8()}`,
          )
          const ownerID = `scheduler-history-owner-${index}`
          const claimed = claimNextSchedulerDelivery({
            actor: "task",
            actorID: recipients[0]!.taskID,
            ownerID,
            leaseMilliseconds: 60_000,
          })
          expect(claimed?.id).toBe(historical.inboxID)
          deadLetterSchedulerDelivery({
            inboxID: historical.inboxID,
            ownerID,
            error: new Error(`Settled scheduler history ${index}`),
          })
        }

        const futureHead = enqueue(
          recipients[0]!.taskID,
          recipients[0]!.rootSessionID,
          `scheduler-future-head-${Identifier.uuid4First8()}`,
        )
        const futureOwnerID = "scheduler-future-head-owner"
        const futureClaim = claimNextSchedulerDelivery({
          actor: "task",
          actorID: recipients[0]!.taskID,
          ownerID: futureOwnerID,
          leaseMilliseconds: 60_000,
        })
        expect(futureClaim?.id).toBe(futureHead.inboxID)
        const futureAt = Date.now() + 60_000
        rescheduleSchedulerDelivery({
          inboxID: futureHead.inboxID,
          ownerID: futureOwnerID,
          error: new Error("Wait for the current FIFO head"),
          visibleAt: futureAt,
        })
        enqueue(
          recipients[0]!.taskID,
          recipients[0]!.rootSessionID,
          `scheduler-behind-future-head-${Identifier.uuid4First8()}`,
        )

        const activeRecipients = recipients.slice(1)
        const pending = activeRecipients.map((recipient, index) =>
          enqueue(
            recipient.taskID,
            recipient.rootSessionID,
            `scheduler-pending-page-${index}-${Identifier.uuid4First8()}`,
          ),
        )
        const expectedTaskIDs = activeRecipients.map((recipient) => recipient.taskID).toSorted()
        const first = listPendingSchedulerRecipientIDs({
          actor: "task",
          projectID: Instance.project.id,
          limit: 32,
        })
        const second = listPendingSchedulerRecipientIDs({
          actor: "task",
          projectID: Instance.project.id,
          afterActorID: first.at(-1),
          limit: 32,
        })
        const third = listPendingSchedulerRecipientIDs({
          actor: "task",
          projectID: Instance.project.id,
          afterActorID: second.at(-1),
          limit: 32,
        })
        const expectedInitialDueAt = Math.min(
          futureAt,
          ...pending.map((receipt) => requireSchedulerDelivery(receipt.inboxID).visibleAt),
        )
        expect({
          pageSizes: [first.length, second.length, third.length],
          taskIDs: [...first, ...second, ...third],
          projectIDs: listPendingSchedulerProjectIDs({ limit: 32 }),
          dueAt: nextSchedulerDeliveryDueAt(Instance.project.id),
        }).toEqual({
          pageSizes: [32, 32, 1],
          taskIDs: expectedTaskIDs,
          projectIDs: [Instance.project.id],
          dueAt: expectedInitialDueAt,
        })

        let active = 0
        let maximumActive = 0
        let starts = 0
        const releaseFirst = Promise.withResolvers<void>()
        const fifthStarted = Promise.withResolvers<void>()
        using _capacity = SchedulerMessageTestHooks.installBeforeTaskMaterialization(async () => {
          starts += 1
          const start = starts
          active += 1
          maximumActive = Math.max(maximumActive, active)
          if (start === 1) await releaseFirst.promise
          else {
            if (start === 5) fifthStarted.resolve()
            await new Promise<void>((resolve) => setTimeout(resolve, 5))
          }
          active -= 1
        })
        const drain = drainSchedulerMessagesForProject()
        await Promise.race([
          fifthStarted.promise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Scheduler recipient frontier did not refill a settled capacity slot")), 5_000),
          ),
        ])
        releaseFirst.resolve()
        await drain

        const dueHead = listPendingSchedulerRecipientIDs({
          actor: "task",
          projectID: Instance.project.id,
          now: futureAt + 1,
          limit: 64,
        })
        const claimedDueHead = claimNextSchedulerDelivery({
          actor: "task",
          actorID: recipients[0]!.taskID,
          ownerID: "scheduler-future-head-takeover",
          leaseMilliseconds: 60_000,
          now: futureAt + 1,
        })
        const leasedDueAt = nextSchedulerDeliveryDueAt(Instance.project.id, futureAt + 1)

        expect({
          maximumActive,
          starts,
          remaining: listPendingSchedulerRecipientIDs({
            actor: "task",
            projectID: Instance.project.id,
            limit: 64,
          }),
          dueHead,
          claimedDueHead: claimedDueHead?.id,
          leasedDueAt,
          outcomes: pending.map((receipt) => {
            const delivery = requireSchedulerDelivery(receipt.inboxID)
            return { status: delivery.status, attempt: delivery.attempt, lastError: delivery.lastError ?? null }
          }),
        }).toEqual({
          maximumActive: 4,
          starts: 65,
          remaining: [],
          dueHead: [recipients[0]!.taskID],
          claimedDueHead: futureHead.inboxID,
          leasedDueAt: futureAt + 60_001,
          outcomes: Array.from({ length: 65 }, () => ({ status: "delivered", attempt: 1, lastError: null })),
        })
      },
    })
  }, 120_000)

  test("resumes an errored scheduler wake only inside its enqueue-time Mission occurrence", async () => {
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
        const openedEventID = missionSchedulerOccurrenceBindingForEnvelope(mission.id, receipt.eventID)
        expect(listUnansweredSchedulerSessionWakes({ projectID: Instance.project.id, limit: 64 })).toEqual([
          { inboxID: receipt.inboxID, sessionID: mission.id, messageID: ids.messageID, openedEventID },
        ])

        return {
          projectID: Instance.project.id,
          missionID,
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
    let schedulerRecoveryActivations = 0
    using _recoveryLoop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ sessionID, messageID }) => {
      if (messageID !== fixture.ids.messageID) return
      schedulerRecoveryActivations += 1
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
        error: { name: "UnknownError", data: { message: "Retryable scheduler wake failure" } },
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
      ).toBe(false)
      expect(auditSchedulerSessionDeliverySettlement(fixture.missionSessionID)).toMatchObject({
        passed: false,
        unansweredInboxIDs: [fixture.receipt.inboxID],
      })
      expect(requireSchedulerDelivery(fixture.receipt.inboxID).deliveryResult).toEqual({
        kind: "session_wake",
        message_id: fixture.ids.messageID,
      })
      const closed = await Instance.provide({
        directory: project.path,
        init: InstanceBootstrap,
        fn: () =>
          closeMissionExecutionOperation({
            missionID: fixture.missionID,
            sessionID: fixture.missionSessionID,
            source: "mission.abort",
            requestID: "close-after-scheduler-wake-terminal-reply",
            provenance: {
              kind: "request",
              surface: "api",
              reason: "Close after the scheduler wake has one terminal assistant reply",
            },
            signal: AbortSignal.timeout(20_000),
          }),
      })
      expect({
        closure: closed.state,
        deliveryResult: requireSchedulerDelivery(fixture.receipt.inboxID).deliveryResult,
      }).toEqual({
        closure: "closed",
        deliveryResult: { kind: "session_wake", message_id: fixture.ids.messageID },
      })
      const closedAudit = auditSchedulerSessionDeliverySettlement(fixture.missionSessionID)
      if (!closedAudit.passed) {
        throw new Error(
          `closed scheduler audit: ${JSON.stringify({
            ...closedAudit,
            invalid: closedAudit.invalidTerminalInboxIDs.map((inboxID) => requireSchedulerDelivery(inboxID)),
          })}`,
        )
      }
      await Instance.provide({
        directory: project.path,
        init: InstanceBootstrap,
        fn: () =>
          openMissionExecutionWithWake({
            sessionID: fixture.missionSessionID,
            missionID: fixture.missionID,
            source: "mission.wake",
            requestID: "reopen-after-errored-scheduler-wake",
            acceptedInput: {
              text: "Open the next Mission occurrence without replaying the old scheduler wake.",
              model: null,
              attachments: [],
              configPatch: {},
              context: { surface: "test.scheduler-task-root" },
            },
            wake: (admission) =>
              SessionWake.wakeWithReceipt({
                sessionID: fixture.missionSessionID,
                messageID: admission.messageID,
                textPartID: admission.textPartID,
                controlID: admission.controlID,
                prompt: "Open the next Mission occurrence without replaying the old scheduler wake.",
                author: "user",
                agent: "mission",
                surface: "panel",
                userAuthored: true,
                reason: missionOperatorWakeReason(admission, fixture.missionID),
                commitBundle: admission.commitBundle,
                preflightBundle: admission.preflightBundle,
                ownerPreflight: admission.ownerPreflight,
                ownerLifecycle: admission.ownerLifecycle,
              }),
          }),
      })
      await SchedulerMessageDeliveryService.runDueNow()
      expect({
        schedulerRecoveryActivations,
        currentOccurrence: currentMissionExecutionClosure(fixture.missionSessionID)?.state,
        recoverableWakes: listUnansweredSchedulerSessionWakes({ projectID: fixture.projectID, limit: 64 }),
      }).toEqual({
        schedulerRecoveryActivations: 1,
        currentOccurrence: "opened",
        recoverableWakes: [],
      })
    } finally {
      releaseRecovery()
      bootstrapWakeBinding.mockRestore()
    }
  })
})
