import { afterEach, describe, expect, test } from "bun:test"
import { EngineArtifactTable, EngineArtifactVersionTable, EngineTaskTable } from "@/engine/engine.sql"
import { missionChildResultWake } from "@/conversation/turn-artifacts"
import { insertEngineArtifact } from "@/engine/artifact"
import { patchEngineArtifact } from "@/engine/artifact"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import {
  SchedulerMessageAuthorityError,
  SchedulerMessageConflictError,
  claimNextSchedulerDelivery,
  deadLetterSchedulerTaskDeliveriesInTransaction,
  deadLetterSchedulerSessionDeliveriesInTransaction,
  listUnansweredSchedulerSessionWakes,
  enqueueSchedulerMessageInTransaction,
  listPendingSchedulerProjectIDs,
  nextSchedulerDeliveryDueAt,
  requireSchedulerDelivery,
  schedulerDeliveryIdentity,
  schedulerTargetOccurrenceIdentity,
  settleSchedulerDeliveryInTransaction,
} from "@/protocol/delivery"
import { ProtocolEventTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import { SchedulerMessagePayload } from "@/protocol/schema"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { MessageTable, PartTable } from "@/session/session.sql"
import { Database, asc, eq } from "@/storage/db"
import { writeTaskUpdateInTransaction } from "@/engine/state"
import { installSchedulerMessageDrainSignal } from "@/protocol/scheduler-drain-signal"
import {
  QueueOrderingTestHooks,
  configureTaskLoopRunner,
  persistQueuedRootMessageWakeInTransaction,
  waitForQueueCompletionHooksForTest,
} from "@/engine/queue"
import { QueuedTaskIngressSchema } from "@/engine/queued-task-ingress"
import { MessageStore } from "@/session/message-store"
import { Message } from "@/session/message"
import { EngineService } from "@/task-api"
import {
  SchedulerMessageTestHooks,
  drainSchedulerMessagesForCurrentProject,
  sendSchedulerMessage,
} from "@/protocol/scheduler-message"
import { SessionWake } from "@/session/wake"
import { persistQueuedTask } from "@/engine/pipeline"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

function persistSourceOccurrence(sessionID: string, messageID: string, partID: string, text: string) {
  const newestMessageTime = Database.use((db) =>
    db
      .select({ value: MessageTable.time_created })
      .from(MessageTable)
      .orderBy(asc(MessageTable.time_created))
      .all()
      .at(-1)?.value,
  )
  const now = Math.max(Date.now(), (newestMessageTime ?? 0) + 1)
  Database.transaction((db) => {
    db.insert(MessageTable)
      .values({
        id: messageID,
        session_id: sessionID,
        data: { role: "assistant", parentID: "msg_parent", providerID: "test", modelID: "test" } as never,
        time_created: now,
        time_updated: now,
      })
      .run()
    db.insert(PartTable)
      .values({
        id: partID,
        message_id: messageID,
        session_id: sessionID,
        data: {
          type: "tool",
          tool: "scheduler_message",
          callID: `call_${partID}`,
          state: { status: "completed", input: { message: text }, output: {} },
        } as never,
        time_created: now,
        time_updated: now,
      })
      .run()
  })
}

async function persistRunnerReply(input: {
  rootSessionID: string
  wakeID: string
  ingressKind: "operator_message" | "mission_message" | "orchestrator_message"
}) {
  const session = await Session.create({
    kind: "orchestrator",
    parentID: input.rootSessionID,
    title: "Scheduler FIFO runner",
  })
  const newestMessageTime = Database.use((db) =>
    db
      .select({ value: MessageTable.time_created })
      .from(MessageTable)
      .orderBy(asc(MessageTable.time_created))
      .all()
      .at(-1)?.value,
  )
  const now = Math.max(Date.now(), (newestMessageTime ?? 0) + 1)
  const messageID = Identifier.ascending("message")
  await Session.persistMessage({
    info: {
      id: messageID,
      sessionID: session.id,
      parentID: Identifier.ascending("message"),
      role: "assistant",
      author: "orchestrator",
      time: { created: now, completed: now + 1 },
      agent: "orchestrator",
      providerID: "test",
      modelID: "scheduler-fifo-runner",
      path: { cwd: Instance.directory, root: Instance.directory },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      finish: "stop",
      taskIngress: { id: input.wakeID, kind: input.ingressKind },
    } satisfies Message.Assistant,
    parts: [
      {
        id: Identifier.ascending("part"),
        messageID,
        sessionID: session.id,
        type: "text",
        text: "Processed exact FIFO ingress.",
      } satisfies Message.TextPart,
    ],
  })
  return messageID
}

describe("durable scheduler.message delivery", () => {
  test("parses exactly one canonical source occurrence", () => {
    const base = {
      protocol: "scheduler-message-v1" as const,
      message_kind: "request" as const,
      thread_id: "thread-source-contract",
      source_body_sha256: "a".repeat(64),
      subject: "Source contract",
    }
    expect(
      SchedulerMessagePayload.parse({
        ...base,
        source_message_id: "msg_source_contract",
        source_part_id: "prt_source_contract",
      }),
    ).toMatchObject({ source_message_id: "msg_source_contract", source_part_id: "prt_source_contract" })
    expect(
      SchedulerMessagePayload.parse({
        ...base,
        source_terminal_event_id: "pev_source_contract",
      }),
    ).toMatchObject({ source_terminal_event_id: "pev_source_contract" })
    for (const invalid of [
      base,
      { ...base, source_message_id: "msg_source_contract" },
      { ...base, source_part_id: "prt_source_contract" },
      {
        ...base,
        source_message_id: "msg_source_contract",
        source_part_id: "prt_source_contract",
        source_terminal_event_id: "pev_source_contract",
      },
    ]) {
      expect(SchedulerMessagePayload.safeParse(invalid).success).toBe(false)
    }
  })

  test("orders mixed root ingress by immutable enqueue ordinal across state patches", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const now = Date.now()
        const makeTask = async (title: string) => {
          const root = await Session.create({ kind: "root", title })
          const taskID = Identifier.ascending("task")
          Database.use((db) =>
            db
              .insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: Instance.project.id,
                session_id: root.id,
                source: "test",
                product_pillar: "code",
                title,
                request: "Verify immutable mixed ingress ordering",
                time_started: now,
                time_created: now,
                time_updated: now,
              })
              .run(),
          )
          return Database.use((db) => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()!)
        }
        const persistPair = (task: typeof EngineTaskTable.$inferSelect, first: "scheduler" | "operator") =>
          Database.transaction((db) => {
            const insert = (kind: "scheduler" | "operator", index: number) =>
              persistQueuedRootMessageWakeInTransaction(db, {
                task,
                messageID: `msg_mixed_${task.id}_${index}`,
                kind: kind === "scheduler" ? "mission" : "operator",
                ...(kind === "scheduler"
                  ? {
                      schedulerDelivery: {
                        eventID: `pev_mixed_${task.id}_${index}`,
                        inboxID: `pib_mixed_${task.id}_${index}`,
                        sequence: index,
                        threadID: `mixed-${task.id}`,
                      },
                    }
                  : {}),
                now,
              })
            return [insert(first, 1), insert(first === "scheduler" ? "operator" : "scheduler", 2)] as const
          })

        const schedulerFirstTask = await makeTask("Scheduler first")
        const [schedulerFirst, operatorSecond] = persistPair(schedulerFirstTask, "scheduler")
        expect(QueueOrderingTestHooks.head(schedulerFirstTask.id)).toEqual({ id: schedulerFirst, label: "pending" })
        Database.transaction((db) => patchEngineArtifact(db, { id: schedulerFirst, label: "running" }))
        expect(QueueOrderingTestHooks.head(schedulerFirstTask.id)).toEqual({ id: schedulerFirst, label: "running" })
        Database.transaction((db) => patchEngineArtifact(db, { id: schedulerFirst, label: "delivery_failed" }))
        expect(QueueOrderingTestHooks.head(schedulerFirstTask.id)).toEqual({
          id: schedulerFirst,
          label: "delivery_failed",
        })
        expect(operatorSecond).not.toBe(schedulerFirst)

        const operatorFirstTask = await makeTask("Operator first")
        const [operatorFirst, schedulerSecond] = persistPair(operatorFirstTask, "operator")
        expect(QueueOrderingTestHooks.head(operatorFirstTask.id)).toEqual({ id: operatorFirst, label: "pending" })
        expect(schedulerSecond).not.toBe(operatorFirst)
      },
    })
  })

  test("persists one FIFO request/reply thread with exact authority, lease, receipt, and replay", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-scheduler-duplex"
        const mission = await Session.create({
          kind: "mission",
          title: "Scheduler Mission",
          metadata: { mission: { id: missionID } },
        })
        const taskSession = await Session.create({ kind: "orchestrator", title: "Scheduler Task" })
        const workerSession = await Session.create({
          kind: "build",
          title: "Projected worker",
          parentID: taskSession.id,
        })
        const siblingSession = await Session.create({ kind: "orchestrator", title: "Scheduler Sibling" })
        const foreignMission = await Session.create({
          kind: "mission",
          title: "Foreign Mission",
          metadata: { mission: { id: "mission-foreign" } },
        })
        const taskID = Identifier.ascending("task")
        const siblingTaskID = Identifier.ascending("task")
        const foreignTaskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values([
              {
                id: taskID,
                project_id: Instance.project.id,
                session_id: taskSession.id,
                source: "mission",
                product_pillar: "code",
                title: "Scheduler Task",
                request: "Handle scheduler request",
                metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
                time_started: now,
                time_created: now,
                time_updated: now,
              },
              {
                id: siblingTaskID,
                project_id: Instance.project.id,
                session_id: siblingSession.id,
                source: "mission",
                product_pillar: "code",
                title: "Sibling Task",
                request: "Handle peer request",
                metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
                time_started: now,
                time_created: now,
                time_updated: now,
              },
              {
                id: foreignTaskID,
                project_id: Instance.project.id,
                session_id: foreignMission.id,
                source: "mission",
                product_pillar: "code",
                title: "Foreign Task",
                request: "Reject foreign scheduler",
                metadata: {
                  actor: "mission",
                  mission: { id: "mission-foreign", session_id: foreignMission.id },
                },
                time_started: now,
                time_created: now,
                time_updated: now,
              },
            ])
            .run(),
        )

        const missionSourceMessageID = "msg_scheduler_mission_source"
        const missionSourcePartID = "prt_scheduler_mission_source"
        persistSourceOccurrence(mission.id, missionSourceMessageID, missionSourcePartID, "Inspect exact nonce 1.")
        const missionEndpoint = {
          kind: "mission_scheduler" as const,
          project_id: Instance.project.id,
          mission_id: missionID,
          session_id: mission.id,
        }
        const taskEndpoint = {
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: taskID,
          root_session_id: taskSession.id,
        }
        let resolveLiveTaskEvent!: (event: ReturnType<typeof ProtocolStore.listTaskEvents>[number]) => void
        const liveTaskEvent = new Promise<ReturnType<typeof ProtocolStore.listTaskEvents>[number]>((resolve) => {
          resolveLiveTaskEvent = resolve
        })
        const unsubscribeTaskEvents = ProtocolStore.subscribeEvents(resolveLiveTaskEvent, {
          aggregate: "task",
          taskID,
          types: ["scheduler.message"],
        })
        const request = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "mission-request-1",
            kind: "request",
            source: missionEndpoint,
            target: taskEndpoint,
            subject: "Exact nonce",
            sourceMessageID: missionSourceMessageID,
            sourcePartID: missionSourcePartID,
          }),
        )
        expect(await liveTaskEvent).toMatchObject({
          id: request.eventID,
          aggregate: "task",
          aggregateID: taskID,
          taskID,
        })
        unsubscribeTaskEvents()
        const replay = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "mission-request-1",
            kind: "request",
            source: missionEndpoint,
            target: taskEndpoint,
            subject: "Exact nonce",
            sourceMessageID: missionSourceMessageID,
            sourcePartID: missionSourcePartID,
          }),
        )
        expect(replay).toEqual({ ...request, replayed: true })
        expect(requireSchedulerDelivery(request.inboxID)).toMatchObject({
          status: "pending",
          event: { id: request.eventID, sequence: 1 },
          message: { message_kind: "request", thread_id: "mission-request-1" },
          source: missionEndpoint,
          target: taskEndpoint,
        })

        const queuedBehind = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "mission-notification-behind-request",
            kind: "notification",
            source: missionEndpoint,
            target: taskEndpoint,
            subject: "Queued behind request",
            sourceMessageID: missionSourceMessageID,
            sourcePartID: missionSourcePartID,
          }),
        )
        const futureVisibleAt = Date.now() + 60_000
        Database.transaction((db) => {
          db.update(ProtocolInboxTable)
            .set({ visible_at: futureVisibleAt, time_updated: Date.now() })
            .where(eq(ProtocolInboxTable.id, request.inboxID))
            .run()
        })
        expect(listPendingSchedulerProjectIDs()).toContain(Instance.project.id)
        expect(nextSchedulerDeliveryDueAt(Instance.project.id)).toBe(futureVisibleAt)
        expect(
          claimNextSchedulerDelivery({
            actor: "task",
            actorID: taskID,
            ownerID: "runtime-before-visible",
            leaseMilliseconds: 10,
            now: futureVisibleAt - 1,
          }),
        ).toBeUndefined()
        const claimed = claimNextSchedulerDelivery({
          actor: "task",
          actorID: taskID,
          ownerID: "runtime-task-a",
          leaseMilliseconds: 60_000,
          now: futureVisibleAt,
        })!
        expect(claimed).toMatchObject({ id: request.inboxID, status: "leased", attempt: 1 })
        expect(
          claimNextSchedulerDelivery({
            actor: "task",
            actorID: taskID,
            ownerID: "runtime-task-b",
            leaseMilliseconds: 10,
            now: futureVisibleAt + 1,
          }),
        ).toBeUndefined()
        const targetMessageID = "msg_scheduler_task_target"
        const ingressID = Database.transaction((db) => {
          db.insert(MessageTable)
            .values({
              id: targetMessageID,
              session_id: taskSession.id,
              data: {
                role: "user",
                author: "mission",
                extra: {
                  task_root_message: {
                    taskID,
                    kind: "mission",
                    schedulerDelivery: { eventID: request.eventID, inboxID: request.inboxID },
                  },
                },
              } as never,
              time_created: now + 1,
              time_updated: now + 1,
            })
            .run()
          const artifactID = insertEngineArtifact(db, {
            taskID,
            kind: "queued_operator_wake",
            label: "pending",
            payload: {
              message_id: targetMessageID,
              source_kind: "mission_message",
              event: {
                rootMessage: {
                  messageID: targetMessageID,
                  kind: "mission",
                  schedulerDelivery: { eventID: request.eventID, inboxID: request.inboxID },
                },
              },
            },
            timeCreated: now + 1,
          })
          settleSchedulerDeliveryInTransaction(db, {
            inboxID: request.inboxID,
            ownerID: "runtime-task-a",
            result: { kind: "task_ingress", message_id: targetMessageID, ingress_id: artifactID },
          })
          return artifactID
        })
        expect(requireSchedulerDelivery(request.inboxID)).toMatchObject({
          status: "delivered",
          deliveryResult: { kind: "task_ingress", message_id: targetMessageID, ingress_id: ingressID },
        })
        const behindLease = claimNextSchedulerDelivery({
          actor: "task",
          actorID: taskID,
          ownerID: "runtime-task-b",
          leaseMilliseconds: 10,
          now: futureVisibleAt + 2,
        })!
        expect(behindLease).toMatchObject({ id: queuedBehind.inboxID, status: "leased", attempt: 1 })
        expect(
          claimNextSchedulerDelivery({
            actor: "task",
            actorID: taskID,
            ownerID: "runtime-task-c",
            leaseMilliseconds: 10,
            now: futureVisibleAt + 5,
          }),
        ).toBeUndefined()
        const recoveredBehindLease = claimNextSchedulerDelivery({
          actor: "task",
          actorID: taskID,
          ownerID: "runtime-task-c",
          leaseMilliseconds: 10,
          now: futureVisibleAt + 20,
        })!
        expect(recoveredBehindLease).toMatchObject({ id: queuedBehind.inboxID, status: "leased", attempt: 2 })
        Database.transaction((db) =>
          settleSchedulerDeliveryInTransaction(db, {
            inboxID: queuedBehind.inboxID,
            ownerID: "runtime-task-c",
            result: { kind: "dead_letter", error_name: "TestDisposition", message: "Test queue head settled" },
            now: futureVisibleAt + 21,
          }),
        )

        const taskReplyMessageID = "msg_scheduler_task_reply"
        const taskReplyPartID = "prt_scheduler_task_reply"
        persistSourceOccurrence(taskSession.id, taskReplyMessageID, taskReplyPartID, "Nonce 1 confirmed.")
        const reply = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "task-reply-1",
            kind: "reply",
            source: taskEndpoint,
            target: missionEndpoint,
            subject: "Exact nonce result",
            sourceMessageID: taskReplyMessageID,
            sourcePartID: taskReplyPartID,
            correlationID: request.threadID,
            threadID: request.threadID,
            replyTo: request.eventID,
          }),
        )
        expect(requireSchedulerDelivery(reply.inboxID)).toMatchObject({
          status: "pending",
          event: { replyTo: request.eventID, correlationID: request.threadID, sequence: 1 },
          message: { message_kind: "reply", thread_id: request.threadID },
        })
        expect(
          Database.transaction((db) =>
            deadLetterSchedulerSessionDeliveriesInTransaction(db, {
              sessionIDs: [mission.id],
              errorName: "SchedulerRecipientDeletedError",
              message: "Recipient Mission was deleted.",
            }),
          ),
        ).toBe(1)
        expect(requireSchedulerDelivery(reply.inboxID)).toMatchObject({
          status: "dead_letter",
          deliveryResult: {
            kind: "dead_letter",
            error_name: "SchedulerRecipientDeletedError",
            message: "Recipient Mission was deleted.",
          },
        })
        expect(
          Database.transaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: "task-reply-1",
              kind: "reply",
              source: taskEndpoint,
              target: missionEndpoint,
              subject: "Exact nonce result",
              sourceMessageID: taskReplyMessageID,
              sourcePartID: taskReplyPartID,
              correlationID: request.threadID,
              threadID: request.threadID,
              replyTo: request.eventID,
            }),
          ),
        ).toEqual({ ...reply, status: "dead_letter", replayed: true })

        expect(() =>
          Database.transaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: "task-reply-duplicate",
              kind: "reply",
              source: taskEndpoint,
              target: missionEndpoint,
              subject: "Duplicate",
              sourceMessageID: taskReplyMessageID,
              sourcePartID: taskReplyPartID,
              correlationID: request.threadID,
              threadID: request.threadID,
              replyTo: request.eventID,
            }),
          ),
        ).toThrow(SchedulerMessageConflictError)

        const siblingEndpoint = {
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: siblingTaskID,
          root_session_id: siblingSession.id,
        }
        const peerRequest = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "task-peer-request-1",
            kind: "request",
            source: taskEndpoint,
            target: siblingEndpoint,
            subject: "Peer decision",
            sourceMessageID: taskReplyMessageID,
            sourcePartID: taskReplyPartID,
          }),
        )
        expect(() =>
          Database.transaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: "task-self-request",
              kind: "request",
              source: taskEndpoint,
              target: taskEndpoint,
              subject: "Reject self target",
              sourceMessageID: taskReplyMessageID,
              sourcePartID: taskReplyPartID,
            }),
          ),
        ).toThrow(SchedulerMessageAuthorityError)
        const workerMessageID = "msg_scheduler_worker_source"
        const workerPartID = "prt_scheduler_worker_source"
        persistSourceOccurrence(workerSession.id, workerMessageID, workerPartID, "Worker cannot impersonate scheduler")
        expect(() =>
          Database.transaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: "worker-impersonation",
              kind: "request",
              source: taskEndpoint,
              target: siblingEndpoint,
              subject: "Reject worker source",
              sourceMessageID: workerMessageID,
              sourcePartID: workerPartID,
            }),
          ),
        ).toThrow(SchedulerMessageAuthorityError)
        const siblingReplyMessageID = "msg_scheduler_sibling_reply"
        const siblingReplyPartID = "prt_scheduler_sibling_reply"
        persistSourceOccurrence(siblingSession.id, siblingReplyMessageID, siblingReplyPartID, "Peer decision accepted.")
        expect(() =>
          Database.transaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: "task-peer-reply-wrong-thread",
              kind: "reply",
              source: siblingEndpoint,
              target: taskEndpoint,
              subject: "Wrong peer thread",
              sourceMessageID: siblingReplyMessageID,
              sourcePartID: siblingReplyPartID,
              correlationID: peerRequest.threadID,
              threadID: "wrong-peer-thread",
              replyTo: peerRequest.eventID,
            }),
          ),
        ).toThrow(SchedulerMessageConflictError)
        const peerReply = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "task-peer-reply-1",
            kind: "reply",
            source: siblingEndpoint,
            target: taskEndpoint,
            subject: "Peer decision result",
            sourceMessageID: siblingReplyMessageID,
            sourcePartID: siblingReplyPartID,
            correlationID: peerRequest.threadID,
            threadID: peerRequest.threadID,
            replyTo: peerRequest.eventID,
          }),
        )
        expect({
          request: requireSchedulerDelivery(peerRequest.inboxID),
          reply: requireSchedulerDelivery(peerReply.inboxID),
        }).toMatchObject({
          request: {
            source: taskEndpoint,
            target: siblingEndpoint,
            event: { correlationID: peerRequest.threadID, sequence: 1 },
          },
          reply: {
            source: siblingEndpoint,
            target: taskEndpoint,
            event: {
              replyTo: peerRequest.eventID,
              correlationID: peerRequest.threadID,
            },
          },
        })
        expect(requireSchedulerDelivery(peerReply.inboxID).event.sequence).toBeGreaterThan(
          requireSchedulerDelivery(request.inboxID).event.sequence,
        )
        expect(ProtocolStore.listTaskEvents(taskID).map((event) => event.id)).toContain(request.eventID)
        expect(ProtocolStore.latestTaskSequence(taskID)).toBeGreaterThanOrEqual(
          requireSchedulerDelivery(request.inboxID).event.sequence,
        )

        const eventCount = Database.use((db) => db.select().from(ProtocolEventTable).all().length)
        expect(() =>
          Database.transaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: "foreign-request",
              kind: "request",
              source: taskEndpoint,
              target: {
                kind: "task_scheduler",
                project_id: Instance.project.id,
                task_id: foreignTaskID,
                root_session_id: foreignMission.id,
              },
              subject: "Unauthorized",
              sourceMessageID: taskReplyMessageID,
              sourcePartID: taskReplyPartID,
            }),
          ),
        ).toThrow(SchedulerMessageAuthorityError)
        expect(Database.use((db) => db.select().from(ProtocolEventTable).all().length)).toBe(eventCount)

        Database.transaction((db) => {
          expect(
            deadLetterSchedulerTaskDeliveriesInTransaction(db, {
              taskIDs: [siblingTaskID],
              errorName: "SchedulerRecipientDeletedError",
              message: `Recipient Task ${siblingTaskID} was deleted.`,
            }),
          ).toBe(1)
          db.delete(EngineTaskTable).where(eq(EngineTaskTable.id, siblingTaskID)).run()
        })
        expect(requireSchedulerDelivery(peerRequest.inboxID)).toMatchObject({
          status: "dead_letter",
          deliveryResult: {
            kind: "dead_letter",
            error_name: "SchedulerRecipientDeletedError",
          },
          event: { id: peerRequest.eventID },
        })

        const inboxRows = Database.use((db) =>
          db.select().from(ProtocolInboxTable).orderBy(asc(ProtocolInboxTable.time_created)).all(),
        )
        expect(inboxRows.map((row) => row.id)).toEqual([
          request.inboxID,
          queuedBehind.inboxID,
          reply.inboxID,
          peerRequest.inboxID,
          peerReply.inboxID,
        ])
        expect(
          Database.use((db) =>
            db
              .select({ taskID: EngineArtifactTable.task_id })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, ingressID))
              .get(),
          ),
        ).toEqual({ taskID })
      },
    })
  })

  test("commits terminal Task fact and Mission notification inbox in one transaction", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        installSchedulerMessageDrainSignal(() => undefined)
        const mission = await Session.create({
          kind: "mission",
          title: "Terminal Mission",
          metadata: {
            mission: { id: "mission-terminal" },
            configOverlay: { model: "openai/gpt-5.6-sol" },
          },
        })
        const root = await Session.create({ kind: "root", title: "Terminal child" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "mission",
              product_pillar: "code",
              title: "Terminal child",
              request: "Persist terminal notification atomically",
              metadata: {
                actor: "mission",
                mission: { id: "mission-terminal", session_id: mission.id },
              },
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )

        let terminalEventID = ""
        let terminalInboxID = ""
        Database.transaction((db) => {
          writeTaskUpdateInTransaction({
            db,
            taskID,
            values: { status: "failed", error: "expected terminal failure" },
            summary: "Terminal failure persisted",
            now: now + 1,
          })
          const terminal = db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.type, "task.failed")).get()
          const delivery = db
            .select({ inbox: ProtocolInboxTable, event: ProtocolEventTable })
            .from(ProtocolInboxTable)
            .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
            .where(eq(ProtocolEventTable.type, "scheduler.message"))
            .get()
          terminalEventID = terminal!.id
          terminalInboxID = delivery!.inbox.id
          expect({ terminal, delivery }).toMatchObject({
            terminal: { task_id: taskID },
            delivery: {
              inbox: { actor: "session", actor_id: mission.id, status: "pending" },
              event: {
                kind: "event",
                task_id: null,
                causation_id: terminal!.id,
                payload: {
                  protocol: "scheduler-message-v1",
                  message_kind: "notification",
                  source_terminal_event_id: terminal!.id,
                },
              },
            },
          })
        })
        const terminalWakeMessage = {
          info: {
            role: "user",
            extra: {
              wake_reason: {
                source: "scheduler.message",
                messageKind: "notification",
                eventID: requireSchedulerDelivery(terminalInboxID).event.id,
              },
            },
          },
        }
        Database.use((db) =>
          db
            .update(EngineTaskTable)
            .set({ time_completed: null, error: null, time_updated: now + 2 })
            .where(eq(EngineTaskTable.id, taskID))
            .run(),
        )
        expect(missionChildResultWake(terminalWakeMessage)).toMatchObject({
          taskID,
          taskTitle: "Terminal child",
          taskStatus: "failed",
          terminalLifecycleReference: { terminalEventID, terminalStatus: "failed" },
        })
        Database.use((db) =>
          db
            .update(EngineTaskTable)
            .set({ time_completed: now + 1, error: "expected terminal failure", time_updated: now + 3 })
            .where(eq(EngineTaskTable.id, taskID))
            .run(),
        )
        expect(await EngineService.deleteTask(taskID)).toBe(true)
        expect(
          Database.use((db) => db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.id, terminalEventID)).get()),
        ).toMatchObject({ aggregate_type: "task", aggregate_id: taskID, task_id: null })
        expect(missionChildResultWake(terminalWakeMessage)).toMatchObject({
          taskID,
          taskTitle: `Task ${taskID}`,
          taskStatus: "failed",
          terminalLifecycleReference: { terminalEventID, terminalStatus: "failed" },
        })
        using _wakeLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
        await drainSchedulerMessagesForCurrentProject()
        expect(requireSchedulerDelivery(terminalInboxID)).toMatchObject({
          status: "delivered",
          deliveryResult: { kind: "session_wake" },
        })
      },
    })
  })

  test("recovers unanswered Mission wakes in protocol sequence order", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-recovery-order"
        const mission = await Session.create({
          kind: "mission",
          title: "Recovery order Mission",
          metadata: { mission: { id: missionID } },
        })
        const taskRoot = await Session.create({ kind: "orchestrator", title: "Recovery source Task" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: taskRoot.id,
              source: "mission",
              product_pillar: "code",
              title: "Recovery source Task",
              request: "Verify Mission wake recovery order",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const source = {
          kind: "task_scheduler" as const,
          project_id: Instance.project.id,
          task_id: taskID,
          root_session_id: taskRoot.id,
        }
        const target = {
          kind: "mission_scheduler" as const,
          project_id: Instance.project.id,
          mission_id: missionID,
          session_id: mission.id,
        }
        const deliveries: Array<{ eventID: string; inboxID: string; threadID: string; messageID: string }> = []
        for (const index of [1, 2]) {
          const sourceMessageID = `msg_recovery_source_${index}`
          const sourcePartID = `prt_recovery_source_${index}`
          persistSourceOccurrence(taskRoot.id, sourceMessageID, sourcePartID, `Recovery message ${index}`)
          const receipt = Database.transaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: `recovery-message-${index}`,
              kind: "notification",
              source,
              target,
              subject: `Recovery ${index}`,
              sourceMessageID,
              sourcePartID,
            }),
          )
          const ownerID = `recovery-owner-${index}`
          claimNextSchedulerDelivery({
            actor: "session",
            actorID: mission.id,
            ownerID,
            leaseMilliseconds: 60_000,
          })
          const occurrence = schedulerTargetOccurrenceIdentity(receipt.inboxID)
          Database.transaction((db) => {
            db.insert(MessageTable)
              .values({
                id: occurrence.messageID,
                session_id: mission.id,
                data: {
                  role: "user",
                  author: "orchestrator",
                  extra: {
                    wake_reason: {
                      source: "scheduler.message",
                      eventID: receipt.eventID,
                      inboxID: receipt.inboxID,
                    },
                  },
                } as never,
                time_created: now + (3 - index),
                time_updated: now + (3 - index),
              })
              .run()
            settleSchedulerDeliveryInTransaction(db, {
              inboxID: receipt.inboxID,
              ownerID,
              result: { kind: "session_wake", message_id: occurrence.messageID },
            })
          })
          deliveries.push({ ...receipt, messageID: occurrence.messageID })
        }
        expect(listUnansweredSchedulerSessionWakes(Instance.project.id)).toEqual(
          deliveries.map((delivery) => ({ sessionID: mission.id, messageID: delivery.messageID })),
        )
        const resumed: string[] = []
        using _wakeLoop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ messageID }) => {
          resumed.push(messageID)
        })
        await drainSchedulerMessagesForCurrentProject()
        expect(resumed).toEqual(deliveries.map((delivery) => delivery.messageID))
      },
    })
  })

  test("rolls back a Mission occurrence when its canonical source changes before commit", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-source-race"
        const mission = await Session.create({
          kind: "mission",
          title: "Source race Mission",
          metadata: {
            mission: { id: missionID },
            configOverlay: { model: "openai/gpt-5.6-sol" },
          },
        })
        const taskRoot = await Session.create({ kind: "orchestrator", title: "Source race Task" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: taskRoot.id,
              source: "mission",
              product_pillar: "code",
              title: "Source race Task",
              request: "Verify source commit fencing",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const sourceMessageID = "msg_source_race"
        const sourcePartID = "prt_source_race"
        persistSourceOccurrence(taskRoot.id, sourceMessageID, sourcePartID, "Original source body")
        const queued = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "source-race",
            kind: "notification",
            source: {
              kind: "task_scheduler",
              project_id: Instance.project.id,
              task_id: taskID,
              root_session_id: taskRoot.id,
            },
            target: {
              kind: "mission_scheduler",
              project_id: Instance.project.id,
              mission_id: missionID,
              session_id: mission.id,
            },
            subject: "Source race",
            sourceMessageID,
            sourcePartID,
          }),
        )
        Database.use((db) =>
          db.update(ProtocolInboxTable).set({ attempt: 4 }).where(eq(ProtocolInboxTable.id, queued.inboxID)).run(),
        )
        using _sourceRace = SchedulerMessageTestHooks.installBeforeMissionMaterialization(() => {
          Database.use((db) => db.delete(PartTable).where(eq(PartTable.id, sourcePartID)).run())
        })
        using _wakeLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
        await drainSchedulerMessagesForCurrentProject()
        const target = schedulerTargetOccurrenceIdentity(queued.inboxID)
        expect(requireSchedulerDelivery(queued.inboxID)).toMatchObject({
          status: "dead_letter",
          deliveryResult: {
            kind: "dead_letter",
            error_name: "SchedulerMessageAuthorityError",
            message: expect.stringContaining("source Part"),
          },
        })
        expect(
          Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.id, target.messageID)).get()),
        ).toBeUndefined()
      },
    })
  })

  test("dead-letters an outgoing delivery atomically when its real source Session is deleted", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-source-delete"
        const mission = await Session.create({
          kind: "mission",
          title: "Deleted source Mission",
          metadata: { mission: { id: missionID } },
        })
        const taskRoot = await Session.create({ kind: "orchestrator", title: "Surviving recipient Task" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: taskRoot.id,
              source: "mission",
              product_pillar: "code",
              title: "Surviving recipient Task",
              request: "Retain typed source deletion disposition",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const sourceMessageID = "msg_deleted_mission_source"
        const sourcePartID = "prt_deleted_mission_source"
        persistSourceOccurrence(mission.id, sourceMessageID, sourcePartID, "Do not lose this pending source")
        const queued = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "deleted-mission-source",
            kind: "request",
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
              root_session_id: taskRoot.id,
            },
            subject: "Deleted source",
            sourceMessageID,
            sourcePartID,
          }),
        )
        expect(await EngineService.deleteSession(mission.id)).toBe(true)
        expect(requireSchedulerDelivery(queued.inboxID)).toMatchObject({
          status: "dead_letter",
          deliveryResult: {
            kind: "dead_letter",
            error_name: "SchedulerSourceDeletedError",
          },
          event: { id: queued.eventID },
        })
        expect(Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.id, sourceMessageID)).get())).toBeUndefined()
      },
    })
  })

  test("materializes Mission identity as one real Task root Message and exact queued ingress", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-materialized"
        const mission = await Session.create({
          kind: "mission",
          title: "Materialization Mission",
          metadata: { mission: { id: missionID } },
        })
        const root = await Session.create({
          kind: "root",
          title: "Materialization Task",
          metadata: { configOverlay: { model: "openai/gpt-5.6-sol" } },
        })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        const packageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "base",
          version: "2026.08.12.1",
          packageDigest: "a".repeat(64),
        }
        persistQueuedTask({
          taskID,
          sessionID: root.id,
          now,
          title: "Materialization Task",
          request: "Read a real Mission-authored root Message",
          productPillar: "code",
          source: "mission",
          priority: "normal",
          metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
          projectID: Instance.project.id,
          queue: false,
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
        const sourceMessageID = "msg_scheduler_materialize_source"
        const sourcePartID = "prt_scheduler_materialize_source"
        persistSourceOccurrence(mission.id, sourceMessageID, sourcePartID, "Materialize nonce M-1")
        let release!: () => void
        const released = new Promise<void>((resolve) => (release = resolve))
        const observedEvents: unknown[] = []
        const observedWakeIDs: string[] = []
        configureTaskLoopRunner(async ({ event, wakeID }) => {
          observedEvents.push(event)
          if (wakeID) observedWakeIDs.push(wakeID)
          await released
          if (!wakeID || !event?.rootMessage) throw new Error("FIFO runner requires an exact root ingress")
          const ingressKind =
            event.rootMessage.kind === "operator"
              ? "operator_message"
              : event.rootMessage.kind === "mission"
                ? "mission_message"
                : "orchestrator_message"
          return {
            finalMessageID: await persistRunnerReply({ rootSessionID: root.id, wakeID, ingressKind }),
          }
        })
        try {
          const receipt = await sendSchedulerMessage({
            invocationID: "materialize-mission-request",
            kind: "request",
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
            subject: "Materialize identity",
            sourceMessageID,
            sourcePartID,
            correlationID: "materialize-mission-request",
            threadID: "materialize-mission-request",
          })
          const deliverySequence = requireSchedulerDelivery(receipt.inboxID).event.sequence
          const visible = await MessageStore.get({ sessionID: root.id, messageID: receipt.messageID })
          const ingress = Database.use((db) =>
            db
              .select({ payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, receipt.ingressID))
              .get(),
          )
          expect({
            receipt,
            visible,
            ingress: QueuedTaskIngressSchema.parse(ingress?.payload),
            observedEvent: observedEvents[0],
          }).toMatchObject({
            receipt: { status: "delivered", replayed: false, wakeStatus: "started" },
            visible: {
              info: {
                role: "user",
                author: "mission",
                extra: {
                  task_root_message: {
                    kind: "mission",
                    source: `scheduler.message:${receipt.eventID}`,
                    schedulerDelivery: {
                      eventID: receipt.eventID,
                      inboxID: receipt.inboxID,
                      sequence: deliverySequence,
                      threadID: receipt.threadID,
                    },
                  },
                },
              },
              parts: [
                {
                  type: "text",
                  text: [
                    `Scheduler request from Mission scheduler ${missionID}.`,
                    `event_id: ${receipt.eventID}`,
                    "thread_id: materialize-mission-request",
                    "subject: Materialize identity",
                    "message:",
                    "Materialize nonce M-1",
                    `Reply through scheduler_message with kind=reply and reply_to=${receipt.eventID}.`,
                  ].join("\n"),
                },
              ],
            },
            ingress: {
              source_kind: "mission_message",
              message_id: receipt.messageID,
              event: {
                rootMessage: {
                  messageID: receipt.messageID,
                  kind: "mission",
                  schedulerDelivery: {
                    eventID: receipt.eventID,
                    inboxID: receipt.inboxID,
                    sequence: deliverySequence,
                  },
                },
              },
            },
            observedEvent: {
              rootMessage: { messageID: receipt.messageID, kind: "mission" },
            },
          })
          const operator = await EngineService.handleTaskMessage(taskID, {
            text: "Operator message between scheduler deliveries",
            source: "test.operator",
          })
          const secondSourceMessageID = "msg_scheduler_materialize_source_2"
          const secondSourcePartID = "prt_scheduler_materialize_source_2"
          persistSourceOccurrence(mission.id, secondSourceMessageID, secondSourcePartID, "Materialize nonce M-2")
          const secondInvocationID = Array.from({ length: 10_000 }, (_, index) => `materialize-fifo-${index}`).find(
            (invocationID) =>
              schedulerDeliveryIdentity({
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
              }).eventID.localeCompare(receipt.eventID) < 0,
          )!
          const second = await sendSchedulerMessage({
            invocationID: secondInvocationID,
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
            subject: "Materialize FIFO 2",
            sourceMessageID: secondSourceMessageID,
            sourcePartID: secondSourcePartID,
          })
          const ingressIDs = [receipt.ingressID!, operator.ingress_id!, second.ingressID!]
          const ingressOrdinals = Database.use((db) =>
            ingressIDs.map((id) => {
              const current = db
                .select({ ordinal: EngineArtifactTable.catalog_revision })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.id, id))
                .get()!
              const first = db
                .select({ ordinal: EngineArtifactVersionTable.catalog_revision })
                .from(EngineArtifactVersionTable)
                .where(eq(EngineArtifactVersionTable.artifact_id, id))
                .orderBy(asc(EngineArtifactVersionTable.catalog_revision))
                .get()
              return { id, ordinal: first?.ordinal ?? current.ordinal }
            }),
          )
          expect(second).toMatchObject({ status: "delivered", wakeStatus: "queued" })
          expect(second.eventID.localeCompare(receipt.eventID)).toBeLessThan(0)
          expect(operator).toMatchObject({ wake_status: "queued" })
          expect(
            ingressOrdinals
              .slice()
              .sort((left, right) => left.ordinal - right.ordinal)
              .map((row) => row.id),
          ).toEqual([receipt.ingressID, operator.ingress_id, second.ingressID])
          release()
          await waitForQueueCompletionHooksForTest()
          expect(observedWakeIDs).toEqual([receipt.ingressID, operator.ingress_id, second.ingressID])
          expect(
            observedEvents.map((event) => {
              const rootMessage = (event as {
                rootMessage?: { kind?: string; schedulerDelivery?: { eventID?: string } }
              }).rootMessage
              return { kind: rootMessage?.kind, eventID: rootMessage?.schedulerDelivery?.eventID }
            }),
          ).toEqual([
            { kind: "mission", eventID: receipt.eventID },
            { kind: "operator", eventID: undefined },
            { kind: "mission", eventID: second.eventID },
          ])

          await expect(
            sendSchedulerMessage({
              invocationID: "materialize-mission-request",
              kind: "request",
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
              subject: "Conflicting replay",
              sourceMessageID,
              sourcePartID,
            }),
          ).rejects.toBeInstanceOf(SchedulerMessageConflictError)

          Database.transaction((db) => {
            db.update(EngineTaskTable)
              .set({ time_completed: Date.now(), time_updated: Date.now() })
              .where(eq(EngineTaskTable.id, taskID))
              .run()
          })
          const terminalReplay = await sendSchedulerMessage({
            invocationID: "materialize-mission-request",
            kind: "request",
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
            subject: "Materialize identity",
            sourceMessageID,
            sourcePartID,
          })
          expect(terminalReplay).toMatchObject({
            eventID: receipt.eventID,
            inboxID: receipt.inboxID,
            status: "delivered",
            replayed: true,
          })
        } finally {
          release()
          await waitForQueueCompletionHooksForTest()
        }
      },
    })
  })
})
