import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Config } from "@/config/config"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { closeMissionExecutionOperation, openMissionExecution } from "@/mission/execution-closure"
import { Instance } from "@/project/instance"
import {
  auditSchedulerSessionDeliverySettlement,
  claimNextSchedulerDelivery,
  deadLetterSchedulerDelivery,
  enqueueSchedulerMessageInTransaction,
  listUnansweredSchedulerSessionWakes,
  listPendingSchedulerProjectIDs,
  requireSchedulerDelivery,
  schedulerSessionWakeNeedsRecovery,
} from "@/protocol/delivery"
import { ProtocolDeliveryReceiptTable, ProtocolEventTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import {
  MISSION_SCHEDULER_WAKE_EXACT_AUTHORITY_TYPE,
  MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE,
  MissionSchedulerWakeExactAuthority,
  MissionSchedulerWakeUnavailableAuthority,
} from "@/protocol/mission-scheduler-wake-authority"
import { drainSchedulerMessagesForCurrentProject, sendSchedulerMessage } from "@/protocol/scheduler-message"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { MessageTable } from "@/session/session.sql"
import { SessionWake } from "@/session/wake"
import { Database, eq } from "@/storage/db"
import { timelineOrderKey } from "@/timeline/order"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Protocol immutable lifecycle delivery fact", () => {
  test("derives the public timeline key and typed identities from one durable lifecycle envelope", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Protocol lifecycle" })
      const inputMessageID = Identifier.ascending("message")
      const created = Date.now()
      await Session.updateMessage({
        id: inputMessageID, sessionID: root.id, role: "user", author: "user", time: { created },
        agent: "orchestrator", model: { providerID: "openai", modelID: "gpt-5.6-terra" },
      })
      Database.use((db) => db.insert(EngineTaskTable).values({
        id: taskID, project_id: Instance.project.id, session_id: root.id, source: "test", product_pillar: "code",
        title: "Protocol lifecycle", request: "Persist exact lifecycle", time_created: created,
      }).run())
      const orderKey = timelineOrderKey({ domain: "session", time: created, id: inputMessageID })
      const event = await ProtocolStore.appendEvent({
        kind: "event", type: "agent.execution.lifecycle", aggregate: "task", aggregate_id: taskID,
        task_id: null, session_id: root.id, source: "session.bridge", emitted_at: created + 1,
        order_key: orderKey, payload: { inputMessageID, status: "completed" },
      })
      expect(event).toMatchObject({ taskID, sessionID: root.id, orderKey, payload: { inputMessageID, status: "completed" } })
      const raw = Database.use((db) => db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.id, event.id)).get())
      expect(raw).toMatchObject({ aggregate_type: "task", aggregate_id: taskID, task_id: null, session_id: root.id, payload: { inputMessageID, status: "completed" } })
      expect(() => Database.use((db) => db.update(ProtocolEventTable).set({ emitted_at: created + 2 }).where(eq(ProtocolEventTable.id, event.id)).run()))
        .toThrow("immutable domain fact")
      expect(Database.use((db) => db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, inputMessageID)).get()))
        .toEqual({ id: inputMessageID })
    } })
  })

  test("reduces an ordered historical wake authority through its exact legacy closure", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = `mission-${Identifier.uuid4First8()}`
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const opened = await openMissionExecution({
          missionID,
          sessionID: mission.id,
          source: "mission.dispatch",
          requestID: "historical-closure-open",
        })
        const messageTime = Date.now() + 10
        const schedulerEvent = await ProtocolStore.appendEvent({
          kind: "event",
          type: "scheduler.message",
          aggregate: "stream",
          aggregate_id: `stream:${Identifier.uuid4First8()}`,
          source: "test.historical-wake",
          emitted_at: messageTime - 1,
          payload: {},
        })
        const inboxID = Identifier.ascending("protocol_inbox")
        const messageID = Identifier.ascending("message")
        const sourceEndpoint = {
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: Identifier.ascending("task"),
          root_session_id: Identifier.ascending("session"),
        }
        const targetEndpoint = {
          kind: "mission_scheduler" as const,
          project_id: Instance.project.id,
          mission_id: missionID,
          session_id: mission.id,
        }
        await Session.updateMessage({
          id: messageID,
          sessionID: mission.id,
          role: "user",
          author: "orchestrator",
          time: { created: messageTime },
          agent: "mission",
          model: { providerID: "test", modelID: "test" },
          extra: {
            wake_reason: {
              source: "scheduler.message",
              eventID: schedulerEvent.id,
              inboxID,
              threadID: `historical-thread-${Identifier.uuid4First8()}`,
              messageKind: "notification",
              sourceEndpoint,
              targetEndpoint,
            },
          },
        })
        Database.immediateTransaction((db) => {
          db.insert(ProtocolInboxTable)
            .values({
              id: inboxID,
              envelope_id: schedulerEvent.id,
              actor: "session",
              actor_id: mission.id,
              visible_at: messageTime,
              time_created: messageTime,
            })
            .run()
          db.insert(ProtocolDeliveryReceiptTable)
            .values({
              id: Identifier.ascending("protocol_inbox"),
              inbox_id: inboxID,
              receipt: { kind: "session_wake", message_id: messageID },
              time_created: messageTime + 1,
            })
            .run()
        })
        const legacyClosed = await ProtocolStore.appendEvent({
          kind: "event",
          type: "mission.execution.closed",
          aggregate: "session",
          aggregate_id: mission.id,
          source: "mission.abort",
          correlation_id: crypto.randomUUID(),
          emitted_at: messageTime + 2,
          payload: { missionID, requestID: "historical-closure-close" },
        })
        await ProtocolStore.appendEvent({
          kind: "event",
          type: MISSION_SCHEDULER_WAKE_EXACT_AUTHORITY_TYPE,
          aggregate: "session",
          aggregate_id: mission.id,
          source: "storage.mission-scheduler-wake-migration",
          causation_id: schedulerEvent.id,
          correlation_id: inboxID,
          payload: MissionSchedulerWakeExactAuthority.parse({
            version: 1,
            inboxID,
            messageID,
            schedulerEventID: schedulerEvent.id,
            openedEventID: opened.eventID,
            openedOperationID: opened.operationID,
            historicalClosureEventID: legacyClosed.id,
          }),
        })
        await ProtocolStore.appendEvent({
          kind: "event",
          type: "mission.execution.opened",
          aggregate: "session",
          aggregate_id: mission.id,
          source: "mission.wake",
          correlation_id: crypto.randomUUID(),
          emitted_at: messageTime + 3,
          payload: { missionID, requestID: "historical-closure-reopen" },
        })
        expect({
          recovery: schedulerSessionWakeNeedsRecovery({ inboxID, sessionID: mission.id, messageID }),
          unanswered: listUnansweredSchedulerSessionWakes(Instance.project.id),
          audit: auditSchedulerSessionDeliverySettlement(mission.id),
        }).toEqual({
          recovery: false,
          unanswered: [],
          audit: {
            passed: true,
            evidenceComplete: true,
            pendingInboxIDs: [],
            leasedInboxIDs: [],
            unansweredInboxIDs: [],
            integrityBoundaryInboxIDs: [],
            deadLetterInboxIDs: [],
            invalidTerminalInboxIDs: [],
          },
        })
      },
    })
  })

  test("reduces one materialized Mission wake through its exact closure without replacing its terminal receipt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          model: "scheduler-closure-test/scheduler-closure-model",
          provider: {
            "scheduler-closure-test": {
              name: "Scheduler closure test",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:9/scheduler-closure-model",
              models: {
                "scheduler-closure-model": {
                  name: "Scheduler closure model",
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
        const openedA = await openMissionExecution({
          missionID,
          sessionID: mission.id,
          source: "mission.dispatch",
          requestID: "scheduler-closure-open",
        })
        const sourceRoot = await Session.create({ kind: "root", title: "Scheduler closure source" })
        const sourceTaskID = Identifier.ascending("task")
        const now = Date.now()
        Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: sourceTaskID,
              project_id: Instance.project.id,
              session_id: sourceRoot.id,
              source: "mission",
              product_pillar: "code",
              title: "Scheduler closure source",
              request: "Close after materialization",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({
            db,
            taskID: sourceTaskID,
            sessionID: sourceRoot.id,
            now,
            source: "test.scheduler-closure",
          })
        })
        const terminal = await ProtocolStore.appendEvent({
          kind: "event",
          type: "task.completed",
          aggregate: "task",
          aggregate_id: sourceTaskID,
          task_id: null,
          session_id: sourceRoot.id,
          source: "test.scheduler-closure",
          payload: { execution_epoch: 1 },
        })
        const sourceEndpoint = {
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: sourceTaskID,
          root_session_id: sourceRoot.id,
        }
        const targetEndpoint = {
          kind: "mission_scheduler" as const,
          project_id: Instance.project.id,
          mission_id: missionID,
          session_id: mission.id,
        }
        using _wakeLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
        const prompt = spyOn(SessionPrompt.prompt, "force").mockImplementation(async (input: any, hooks: any) => {
          const info = {
            id: input.messageID,
            role: "user" as const,
            author: input.author,
            sessionID: input.sessionID,
            time: { created: Date.now() },
            agent: input.agent,
            model: input.model ?? { providerID: "scheduler-closure-test", modelID: "scheduler-closure-model" },
            extra: input.extra,
          }
          const parts = input.parts.map((part: any) => ({
            ...part,
            sessionID: input.sessionID,
            messageID: input.messageID,
          }))
          return Session.persistMessageWithCommit(
            { info, parts, controls: hooks?.controls?.(info) },
            () => hooks?.commitBundle?.(info, parts),
            hooks?.beforeVisibilityEffects ? () => hooks.beforeVisibilityEffects(info, parts) : undefined,
            hooks?.preflightBundle ? () => hooks.preflightBundle(info, parts) : undefined,
          )
        })
        try {
          const receipt = await sendSchedulerMessage({
            invocationID: `scheduler-close-${Identifier.uuid4First8()}`,
            kind: "notification",
            source: sourceEndpoint,
            target: targetEndpoint,
            subject: "Materialize before close",
            sourceTerminalEventID: terminal.id,
          })
          expect(requireSchedulerDelivery(receipt.inboxID)).toMatchObject({
            status: "delivered",
            deliveryResult: { kind: "session_wake" },
          })
          const historicalBoundReceipt = Database.immediateTransaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: `scheduler-bound-${Identifier.uuid4First8()}`,
              kind: "notification",
              source: sourceEndpoint,
              target: targetEndpoint,
              subject: "Historical wake with exact append-only authority",
              sourceTerminalEventID: terminal.id,
            }),
          )
          const historicalBoundMessageID = Identifier.ascending("message")
          await Session.updateMessage({
            id: historicalBoundMessageID,
            sessionID: mission.id,
            role: "user",
            author: "orchestrator",
            time: { created: Date.now() },
            agent: "mission",
            model: { providerID: "scheduler-closure-test", modelID: "scheduler-closure-model" },
            extra: {
              wake_reason: {
                source: "scheduler.message",
                eventID: historicalBoundReceipt.eventID,
                inboxID: historicalBoundReceipt.inboxID,
                threadID: `bound-thread-${Identifier.uuid4First8()}`,
                messageKind: "notification",
                sourceEndpoint,
                targetEndpoint,
              },
            },
          })
          Database.immediateTransaction((db) => {
            db.insert(ProtocolDeliveryReceiptTable)
              .values({
                id: Identifier.ascending("protocol_inbox"),
                inbox_id: historicalBoundReceipt.inboxID,
                receipt: { kind: "session_wake", message_id: historicalBoundMessageID },
                time_created: Date.now(),
              })
              .run()
            ProtocolStore.appendEventInTransaction({
              kind: "event",
              type: MISSION_SCHEDULER_WAKE_EXACT_AUTHORITY_TYPE,
              aggregate: "session",
              aggregate_id: mission.id,
              source: "storage.mission-scheduler-wake-migration",
              causation_id: historicalBoundReceipt.eventID,
              correlation_id: historicalBoundReceipt.inboxID,
              payload: MissionSchedulerWakeExactAuthority.parse({
                version: 1,
                inboxID: historicalBoundReceipt.inboxID,
                messageID: historicalBoundMessageID,
                schedulerEventID: historicalBoundReceipt.eventID,
                openedEventID: openedA.eventID,
                openedOperationID: openedA.operationID,
              }),
            })
          })
          expect(
            schedulerSessionWakeNeedsRecovery({
              inboxID: historicalBoundReceipt.inboxID,
              sessionID: mission.id,
              messageID: historicalBoundMessageID,
            }),
          ).toBe(true)
          const closed = await closeMissionExecutionOperation({
            missionID,
            sessionID: mission.id,
            source: "mission.abort",
            requestID: "scheduler-closure-close",
            provenance: { surface: "api", reason: "Close a materialized unanswered wake" },
            close: async () => undefined,
          })
          const terminalReceipts = Database.use((db) =>
            db
              .select()
              .from(ProtocolDeliveryReceiptTable)
              .where(eq(ProtocolDeliveryReceiptTable.inbox_id, receipt.inboxID))
              .all()
              .filter((row) => row.receipt.kind !== "retry_wait"),
          )
          expect({
            closed,
            terminalReceipts,
            unanswered: listUnansweredSchedulerSessionWakes(Instance.project.id),
            audit: auditSchedulerSessionDeliverySettlement(mission.id),
            historicalBoundDelivery: requireSchedulerDelivery(historicalBoundReceipt.inboxID),
          }).toMatchObject({
            closed: { state: "closed" },
            terminalReceipts: [{ receipt: { kind: "session_wake" } }],
            unanswered: [],
            audit: { passed: true, unansweredInboxIDs: [], invalidTerminalInboxIDs: [] },
            historicalBoundDelivery: {
              status: "delivered",
              deliveryResult: { kind: "session_wake", message_id: historicalBoundMessageID },
            },
          })

          const reopened = await openMissionExecution({
            missionID,
            sessionID: mission.id,
            source: "mission.wake",
            requestID: "scheduler-closure-reopen",
          })
          const reopenedReceipt = Database.immediateTransaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: `scheduler-reopened-${Identifier.uuid4First8()}`,
              kind: "notification",
              source: sourceEndpoint,
              target: targetEndpoint,
              subject: "Materialize in reopened occurrence",
              sourceTerminalEventID: terminal.id,
            }),
          )
          await drainSchedulerMessagesForCurrentProject()
          const unansweredAfterReopen = listUnansweredSchedulerSessionWakes(Instance.project.id)
          const oldDelivery = requireSchedulerDelivery(receipt.inboxID)
          const newDelivery = requireSchedulerDelivery(reopenedReceipt.inboxID)
          if (
            oldDelivery.deliveryResult?.kind !== "session_wake" ||
            newDelivery.deliveryResult?.kind !== "session_wake"
          ) {
            throw new Error("Reopened Mission wake fixtures did not materialize exact scheduler Messages")
          }
          expect({
            reopened,
            oldNeedsRecovery: schedulerSessionWakeNeedsRecovery({
              inboxID: receipt.inboxID,
              sessionID: mission.id,
              messageID: oldDelivery.deliveryResult.message_id,
            }),
            newNeedsRecovery: schedulerSessionWakeNeedsRecovery({
              inboxID: reopenedReceipt.inboxID,
              sessionID: mission.id,
              messageID: newDelivery.deliveryResult.message_id,
            }),
            unansweredAfterReopen,
          }).toMatchObject({
            reopened: { state: "opened" },
            oldNeedsRecovery: false,
            newNeedsRecovery: true,
            unansweredAfterReopen: [{ inboxID: reopenedReceipt.inboxID, sessionID: mission.id }],
          })

          const legacyReceipt = Database.immediateTransaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: `scheduler-legacy-${Identifier.uuid4First8()}`,
              kind: "notification",
              source: sourceEndpoint,
              target: targetEndpoint,
              subject: "Historical wake without occurrence authority",
              sourceTerminalEventID: terminal.id,
            }),
          )
          const legacyMessageID = Identifier.ascending("message")
          await Session.updateMessage({
            id: legacyMessageID,
            sessionID: mission.id,
            role: "user",
            author: "orchestrator",
            time: { created: Date.now() },
            agent: "mission",
            model: { providerID: "scheduler-closure-test", modelID: "scheduler-closure-model" },
            extra: {
              wake_reason: {
                source: "scheduler.message",
                eventID: legacyReceipt.eventID,
                inboxID: legacyReceipt.inboxID,
                threadID: `legacy-thread-${Identifier.uuid4First8()}`,
                messageKind: "notification",
                sourceEndpoint,
                targetEndpoint,
              },
            },
          })
          Database.immediateTransaction((db) => {
            db.insert(ProtocolDeliveryReceiptTable)
              .values({
                id: Identifier.ascending("protocol_inbox"),
                inbox_id: legacyReceipt.inboxID,
                receipt: { kind: "session_wake", message_id: legacyMessageID },
                time_created: Date.now(),
              })
              .run()
            ProtocolStore.appendEventInTransaction({
              kind: "event",
              type: MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE,
              aggregate: "session",
              aggregate_id: mission.id,
              source: "storage.mission-scheduler-wake-migration",
              causation_id: legacyReceipt.eventID,
              correlation_id: legacyReceipt.inboxID,
              payload: MissionSchedulerWakeUnavailableAuthority.parse({
                version: 1,
                inboxID: legacyReceipt.inboxID,
                messageID: legacyMessageID,
                schedulerEventID: legacyReceipt.eventID,
                reason: "multiple_opened_occurrences",
              }),
            })
          })
          expect(listPendingSchedulerProjectIDs()).toContain(Instance.project.id)
          expect(
            schedulerSessionWakeNeedsRecovery({
              inboxID: legacyReceipt.inboxID,
              sessionID: mission.id,
              messageID: legacyMessageID,
            }),
          ).toBe(false)
          const reclosed = await closeMissionExecutionOperation({
            missionID,
            sessionID: mission.id,
            source: "mission.abort",
            requestID: "scheduler-closure-reclose",
            provenance: { surface: "api", reason: "Close reopened occurrence with a historical boundary" },
            close: async () => undefined,
          })
          const legacyTerminalReceipts = Database.use((db) =>
            db
              .select()
              .from(ProtocolDeliveryReceiptTable)
              .where(eq(ProtocolDeliveryReceiptTable.inbox_id, legacyReceipt.inboxID))
              .all()
              .filter((row) => row.receipt.kind !== "retry_wait"),
          )
          expect({
            reclosed,
            pendingProjects: listPendingSchedulerProjectIDs(),
            audit: auditSchedulerSessionDeliverySettlement(mission.id),
            legacyTerminalReceipts,
          }).toMatchObject({
            reclosed: { state: "closed" },
            pendingProjects: [],
            audit: {
              passed: true,
              evidenceComplete: false,
              unansweredInboxIDs: [],
              integrityBoundaryInboxIDs: [legacyReceipt.inboxID],
            },
            legacyTerminalReceipts: [{ receipt: { kind: "session_wake", message_id: legacyMessageID } }],
          })
          await openMissionExecution({
            missionID,
            sessionID: mission.id,
            source: "mission.wake",
            requestID: "scheduler-closure-open-after-boundary",
          })
          const afterBoundary = await sendSchedulerMessage({
            invocationID: `scheduler-after-boundary-${Identifier.uuid4First8()}`,
            kind: "notification",
            source: sourceEndpoint,
            target: targetEndpoint,
            subject: "Direct Mission send after recipient-local boundary",
            sourceTerminalEventID: terminal.id,
          })
          const afterBoundaryDelivery = requireSchedulerDelivery(afterBoundary.inboxID)
          expect({
            afterBoundary,
            afterBoundaryDelivery,
            unanswered: listUnansweredSchedulerSessionWakes(Instance.project.id),
          }).toMatchObject({
            afterBoundary: { status: "delivered", messageID: expect.any(String) },
            afterBoundaryDelivery: {
              status: "delivered",
              deliveryResult: { kind: "session_wake", message_id: afterBoundary.messageID },
            },
            unanswered: [{ inboxID: afterBoundary.inboxID, sessionID: mission.id, messageID: afterBoundary.messageID }],
          })
        } finally {
          prompt.mockRestore()
        }
      },
    })
  }, 30_000)

  test("claims only the durable FIFO head for one recipient across competing owners", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = `mission-${Identifier.uuid4First8()}`
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const sourceRoot = await Session.create({ kind: "root", title: "FIFO source" })
        const targetRoot = await Session.create({ kind: "root", title: "FIFO target" })
        const sourceTaskID = Identifier.ascending("task")
        const targetTaskID = Identifier.ascending("task")
        const now = Date.now()
        Database.immediateTransaction((db) => {
          for (const [taskID, sessionID, title] of [
            [sourceTaskID, sourceRoot.id, "FIFO source"],
            [targetTaskID, targetRoot.id, "FIFO target"],
          ] as const) {
            db.insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: Instance.project.id,
                session_id: sessionID,
                source: "api",
                product_pillar: "code",
                title,
                request: title,
                metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
                time_created: now,
              })
              .run()
            appendTaskOpenedInTransaction({ db, taskID, sessionID, now, source: "test.scheduler-fifo" })
          }
        })
        const sourceTerminal = await ProtocolStore.appendEvent({
          kind: "event",
          type: "task.completed",
          aggregate: "task",
          aggregate_id: sourceTaskID,
          task_id: null,
          session_id: sourceRoot.id,
          source: "test.scheduler-fifo",
          payload: { execution_epoch: 1 },
        })
        const source = {
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: sourceTaskID,
          root_session_id: sourceRoot.id,
        }
        const target = {
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: targetTaskID,
          root_session_id: targetRoot.id,
        }
        const receipts = Database.immediateTransaction((db) => [
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: `fifo-first-${Identifier.uuid4First8()}`,
            kind: "notification",
            source,
            target,
            subject: "FIFO first",
            sourceTerminalEventID: sourceTerminal.id,
          }),
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: `fifo-second-${Identifier.uuid4First8()}`,
            kind: "notification",
            source,
            target,
            subject: "FIFO second",
            sourceTerminalEventID: sourceTerminal.id,
          }),
        ])
        const first = claimNextSchedulerDelivery({
          actor: "task",
          actorID: targetTaskID,
          ownerID: "fifo-owner-first",
          leaseMilliseconds: 120_000,
        })
        claimNextSchedulerDelivery({
          actor: "task",
          actorID: targetTaskID,
          ownerID: "fifo-owner-competing",
          leaseMilliseconds: 120_000,
        })
        const fencedState = receipts.map((receipt) => requireSchedulerDelivery(receipt.inboxID).status)
        deadLetterSchedulerDelivery({
          inboxID: first!.id,
          ownerID: "fifo-owner-first",
          error: new Error("Classified first delivery for FIFO handoff"),
        })
        const second = claimNextSchedulerDelivery({
          actor: "task",
          actorID: targetTaskID,
          ownerID: "fifo-owner-second",
          leaseMilliseconds: 120_000,
        })
        expect({ first: first?.id, fencedState, second: second?.id }).toEqual({
          first: receipts[0]!.inboxID,
          fencedState: ["leased", "pending"],
          second: receipts[1]!.inboxID,
        })
      },
    })
  })

  test("drains different recipients in one Project while preserving FIFO inside a long Mission recipient", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          model: "scheduler-fairness-test/scheduler-fairness-model",
          provider: {
            "scheduler-fairness-test": {
              name: "Scheduler fairness test",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:9/scheduler-fairness-model",
              models: {
                "scheduler-fairness-model": {
                  name: "Scheduler fairness model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4_096 },
                },
              },
            },
          },
        })

        const missionAID = `mission-${Identifier.uuid4First8()}`
        const missionBID = `mission-${Identifier.uuid4First8()}`
        const missionA = await ensureMissionSession({
          missionID: missionAID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const missionB = await ensureMissionSession({
          missionID: missionBID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        await openMissionExecution({
          missionID: missionAID,
          sessionID: missionA.id,
          source: "mission.dispatch",
          requestID: "test.scheduler-recipient-fairness.mission-a",
        })
        await openMissionExecution({
          missionID: missionBID,
          sessionID: missionB.id,
          source: "mission.dispatch",
          requestID: "test.scheduler-recipient-fairness.mission-b",
        })
        const createTask = async (missionID: string, missionSessionID: string, title: string) => {
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
                request: title,
                metadata: { actor: "mission", mission: { id: missionID, session_id: missionSessionID } },
                time_created: now,
              })
              .run()
            appendTaskOpenedInTransaction({
              db,
              taskID,
              sessionID: root.id,
              now,
              source: "test.scheduler-recipient-fairness",
            })
          })
          return { id: taskID, rootSessionID: root.id }
        }
        const taskA = await createTask(missionAID, missionA.id, "Mission A source Task")
        const taskB = await createTask(missionBID, missionB.id, "Mission B source Task")
        const taskC = await createTask(missionAID, missionA.id, "Mission A target Task")
        const sourceTerminal = async (task: { id: string; rootSessionID: string }, label: string) =>
          ProtocolStore.appendEvent({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: task.id,
            task_id: null,
            session_id: task.rootSessionID,
            source: "test.scheduler-recipient-fairness",
            emitted_at: Date.now(),
            payload: { execution_epoch: 1, label },
          })
        const terminalA = await sourceTerminal(taskA, "Mission A terminal source")
        const terminalB = await sourceTerminal(taskB, "Mission B terminal source")

        const sourceUser = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: missionA.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "mission",
          model: { providerID: "test", modelID: "test" },
        })
        const sourceMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: missionA.id,
          role: "assistant",
          author: "mission",
          parentID: sourceUser.id,
          time: { created: Date.now() },
          agent: "mission",
          modelID: "test",
          providerID: "test",
          mode: "mission",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        })
        const sourcePart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: missionA.id,
          messageID: sourceMessage.id,
          type: "tool",
          callID: `call-${Identifier.uuid4First8()}`,
          tool: "scheduler_message",
          state: {
            status: "running",
            input: { message: "Deliver to Task C while Mission A is still running." },
            time: { start: Date.now() },
          },
        })

        const missionAEndpoint = {
          kind: "mission_scheduler" as const,
          project_id: Instance.project.id,
          mission_id: missionAID,
          session_id: missionA.id,
        }
        const missionBEndpoint = {
          kind: "mission_scheduler" as const,
          project_id: Instance.project.id,
          mission_id: missionBID,
          session_id: missionB.id,
        }
        const taskEndpoint = (task: { id: string; rootSessionID: string }) => ({
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: task.id,
          root_session_id: task.rootSessionID,
        })
        let releaseMissionA!: () => void
        const missionAGate = new Promise<void>((resolve) => {
          releaseMissionA = resolve
        })
        let missionAStarted!: () => void
        const firstMissionAStarted = new Promise<void>((resolve) => {
          missionAStarted = resolve
        })
        const startedSessions: string[] = []
        using _wakeLoop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ sessionID, messageID }) => {
          startedSessions.push(sessionID)
          if (sessionID === missionA.id && startedSessions.filter((id) => id === missionA.id).length === 1) {
            missionAStarted()
            await missionAGate
          }
          await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID,
            role: "assistant",
            author: "mission",
            parentID: messageID,
            time: { created: Date.now(), completed: Date.now() + 1 },
            agent: "mission",
            providerID: "scheduler-fairness-test",
            modelID: "scheduler-fairness-model",
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            finish: "stop",
          })
        })
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const prompt = spyOn(SessionPrompt.prompt, "force").mockImplementation(async (input: any, hooks: any) => {
          const info = {
            id: input.messageID,
            role: "user" as const,
            author: input.author,
            sessionID: input.sessionID,
            time: { created: Date.now() },
            agent: input.agent,
            model: input.model ?? {
              providerID: "scheduler-fairness-test",
              modelID: "scheduler-fairness-model",
            },
            extra: input.extra,
          }
          const parts = input.parts.map((part: any) => ({
            ...part,
            sessionID: input.sessionID,
            messageID: input.messageID,
          }))
          return Session.persistMessageWithCommit(
            { info, parts, controls: hooks?.controls?.(info) },
            () => hooks?.commitBundle?.(info, parts),
            hooks?.beforeVisibilityEffects ? () => hooks.beforeVisibilityEffects(info, parts) : undefined,
            hooks?.preflightBundle ? () => hooks.preflightBundle(info, parts) : undefined,
          )
        })

        const receipts = Database.immediateTransaction((db) => ({
          missionAFirst: enqueueSchedulerMessageInTransaction(db, {
            invocationID: `fair-a-1-${Identifier.uuid4First8()}`,
            kind: "notification",
            source: taskEndpoint(taskA),
            target: missionAEndpoint,
            subject: "Mission A first",
            sourceTerminalEventID: terminalA.id,
          }),
          missionASecond: enqueueSchedulerMessageInTransaction(db, {
            invocationID: `fair-a-2-${Identifier.uuid4First8()}`,
            kind: "notification",
            source: taskEndpoint(taskA),
            target: missionAEndpoint,
            subject: "Mission A second",
            sourceTerminalEventID: terminalA.id,
          }),
          missionB: enqueueSchedulerMessageInTransaction(db, {
            invocationID: `fair-b-${Identifier.uuid4First8()}`,
            kind: "notification",
            source: taskEndpoint(taskB),
            target: missionBEndpoint,
            subject: "Mission B",
            sourceTerminalEventID: terminalB.id,
          }),
          taskC: enqueueSchedulerMessageInTransaction(db, {
            invocationID: `fair-c-${Identifier.uuid4First8()}`,
            kind: "notification",
            source: missionAEndpoint,
            target: taskEndpoint(taskC),
            subject: "Task C",
            sourceMessageID: sourceMessage.id,
            sourcePartID: sourcePart.id,
          }),
        }))

        const drain = drainSchedulerMessagesForCurrentProject()
        try {
          const missionAWasStarted = await Promise.race([
            firstMissionAStarted.then(() => true),
            Bun.sleep(5_000).then(() => false),
          ])
          if (!missionAWasStarted) {
            throw new Error(
              `Mission A drain did not start: ${JSON.stringify({
                first: requireSchedulerDelivery(receipts.missionAFirst.inboxID),
                second: requireSchedulerDelivery(receipts.missionASecond.inboxID),
                missionB: requireSchedulerDelivery(receipts.missionB.inboxID),
                taskC: requireSchedulerDelivery(receipts.taskC.inboxID),
                startedSessions,
              })}`,
            )
          }
          const siblingDeadline = Date.now() + 5_000
          while (
            (requireSchedulerDelivery(receipts.missionB.inboxID).status !== "delivered" ||
              requireSchedulerDelivery(receipts.taskC.inboxID).status !== "delivered") &&
            Date.now() < siblingDeadline
          ) {
            await Bun.sleep(10)
          }
          expect({
            missionB: requireSchedulerDelivery(receipts.missionB.inboxID).status,
            taskC: requireSchedulerDelivery(receipts.taskC.inboxID).status,
            missionASecond: requireSchedulerDelivery(receipts.missionASecond.inboxID).status,
            missionAStarts: startedSessions.filter((id) => id === missionA.id).length,
          }).toEqual({
            missionB: "delivered",
            taskC: "delivered",
            missionASecond: "pending",
            missionAStarts: 1,
          })
        } finally {
          releaseMissionA()
          await drain
          prompt.mockRestore()
        }

        expect({
          missionAFirst: requireSchedulerDelivery(receipts.missionAFirst.inboxID).status,
          missionASecond: requireSchedulerDelivery(receipts.missionASecond.inboxID).status,
          missionB: requireSchedulerDelivery(receipts.missionB.inboxID).status,
          taskC: requireSchedulerDelivery(receipts.taskC.inboxID).status,
          missionAStarts: startedSessions.filter((id) => id === missionA.id).length,
          missionBStarts: startedSessions.filter((id) => id === missionB.id).length,
        }).toEqual({
          missionAFirst: "delivered",
          missionASecond: "delivered",
          missionB: "delivered",
          taskC: "delivered",
          missionAStarts: 2,
          missionBStarts: 1,
        })
      },
    })
  }, 90_000)
})
