import { afterEach, describe, expect, test } from "bun:test"
import { EngineArtifactTable, EngineArtifactVersionTable, EngineTaskTable } from "@/engine/engine.sql"
import { missionChildResultWake } from "@/conversation/turn-artifacts"
import { insertEngineArtifact } from "@/engine/artifact"
import { patchEngineArtifact } from "@/engine/artifact"
import { Identifier } from "@/id/id"
import { Instance, InstanceProcessAdmissionClosedError } from "@/project/instance"
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
import { Database, DatabaseEffectAdmissionClosedError, asc, eq } from "@/storage/db"
import { RuntimeExecutionAdmissionClosedError } from "@/runtime/execution-settlement"
import { writeTaskUpdateInTransaction } from "@/engine/state"
import {
  installSchedulerMessageDrainSignal,
  observeSchedulerMessageDrainSignal,
} from "@/protocol/scheduler-drain-signal"
import {
  QueueOrderingTestHooks,
  TestHooks as QueueTestHooks,
  configureTaskLoopRunner,
  persistQueuedRootMessageWakeInTransaction,
  waitForQueueCompletionHooksForTest,
} from "@/engine/queue"
import { QueuedTaskIngressSchema } from "@/engine/queued-task-ingress"
import { MessageStore } from "@/session/message-store"
import { Message } from "@/session/message"
import { EngineService } from "@/task-api"
import {
  SchedulerMessageDeliveryService,
  SchedulerMessageTestHooks,
  drainSchedulerMessagesForProject,
  drainSchedulerMessagesForCurrentProject,
  sendSchedulerMessage,
} from "@/protocol/scheduler-message"
import { SessionWake } from "@/session/wake"
import { Scheduler } from "@/scheduler"
import { persistQueuedTask } from "@/engine/pipeline"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import {
  closeMissionExecutionOperation,
  currentMissionExecutionClosure,
  MissionExecutionClosingError,
  openMissionExecution,
} from "@/mission/execution-closure"

afterEach(resetMemoryDatabase)

function persistSourceOccurrence(sessionID: string, messageID: string, partID: string, text: string) {
  const newestMessageTime = Database.use(
    (db) =>
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
  const newestMessageTime = Database.use(
    (db) =>
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
  test("classifies typed shutdown admission errors and reports a colliding application failure", () => {
    const reported: unknown[] = []
    using _reported = SchedulerMessageTestHooks.installSignalDrainFailureReport((error) => reported.push(error))
    const applicationFailure = new Error("application admission is closed while validating a real delivery")

    const dispositions = [
      SchedulerMessageTestHooks.handleSignalDrainFailure(new InstanceProcessAdmissionClosedError()),
      SchedulerMessageTestHooks.handleSignalDrainFailure(new DatabaseEffectAdmissionClosedError("scheduler drain")),
      SchedulerMessageTestHooks.handleSignalDrainFailure(
        new RuntimeExecutionAdmissionClosedError("protocol_publication"),
      ),
      SchedulerMessageTestHooks.handleSignalDrainFailure(applicationFailure),
    ]

    expect({ dispositions, reported }).toEqual({
      dispositions: ["lifecycle_closed", "lifecycle_closed", "lifecycle_closed", "reported"],
      reported: [applicationFailure],
    })
  })

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
        using _drainSignal = installSchedulerMessageDrainSignal(() => undefined)
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
          Database.use((db) =>
            db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.id, terminalEventID)).get(),
          ),
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

  test("signals a Mission scheduler notification through the persisted send path", async () => {
    await using project = await memoryProject()
    const signals: string[] = []
    using _signalObserver = observeSchedulerMessageDrainSignal(() => signals.push("scheduler-message-drain"))
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-signaled-delivery"
        const mission = await Session.create({
          kind: "mission",
          title: "Signaled delivery Mission",
          metadata: { mission: { id: missionID } },
        })
        const taskRoot = await Session.create({ kind: "orchestrator", title: "Signaled delivery source Task" })
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
              title: "Signal a Mission delivery",
              request: "Deliver through the persisted scheduler signal",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const sourceMessageID = "msg_signaled_mission_delivery"
        const sourcePartID = "prt_signaled_mission_delivery"
        persistSourceOccurrence(taskRoot.id, sourceMessageID, sourcePartID, "Deliver this Mission notification")

        const receipt = await sendSchedulerMessage({
          invocationID: "signaled-mission-delivery",
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
          subject: "Signaled Mission delivery",
          sourceMessageID,
          sourcePartID,
        })
        expect({ signals, receipt }).toMatchObject({
          signals: ["scheduler-message-drain"],
          receipt: { status: "pending" },
        })
      },
    })
  })

  test("coalesces host recovery, global polling, and low-latency signaling behind one Project drain owner", async () => {
    await using project = await memoryProject()
    let projectID = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        projectID = Instance.project.id
        const missionID = "mission-single-drain-owner"
        const mission = await Session.create({
          kind: "mission",
          title: "Single drain owner Mission",
          metadata: { mission: { id: missionID } },
        })
        const taskRoot = await Session.create({ kind: "orchestrator", title: "Single owner source Task" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: projectID,
              session_id: taskRoot.id,
              source: "mission",
              product_pillar: "code",
              title: "Single owner source Task",
              request: "Recover one exact Mission wake",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const sourceMessageID = "msg_single_drain_owner"
        const sourcePartID = "prt_single_drain_owner"
        persistSourceOccurrence(taskRoot.id, sourceMessageID, sourcePartID, "Recover this wake once")
        const receipt = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "single-drain-owner",
            kind: "notification",
            source: {
              kind: "task_scheduler",
              project_id: projectID,
              task_id: taskID,
              root_session_id: taskRoot.id,
            },
            target: {
              kind: "mission_scheduler",
              project_id: projectID,
              mission_id: missionID,
              session_id: mission.id,
            },
            subject: "Single drain owner",
            sourceMessageID,
            sourcePartID,
          }),
        )
        const ownerID = "single-drain-owner-lease"
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
              time_created: now + 1,
              time_updated: now + 1,
            })
            .run()
          settleSchedulerDeliveryInTransaction(db, {
            inboxID: receipt.inboxID,
            ownerID,
            result: { kind: "session_wake", message_id: occurrence.messageID },
          })
        })
      },
    })

    let release!: () => void
    const blocked = new Promise<void>((resolve) => (release = resolve))
    let markEntered!: () => void
    const entered = new Promise<void>((resolve) => (markEntered = resolve))
    let executions = 0
    using _wakeLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => {
      executions += 1
      markEntered()
      await blocked
    })
    const signaled = SchedulerMessageTestHooks.requestProjectDrain(projectID, project.path)
    await entered
    const recovered = Instance.provide({ directory: project.path, fn: () => drainSchedulerMessagesForProject() })
    const polled = SchedulerMessageDeliveryService.runDueNow()
    await Bun.sleep(25)
    expect(executions).toBe(1)
    release()
    await Promise.all([signaled, recovered, polled])
    expect(executions).toBe(1)
  })

  test("drains an independent Project while another Project wake is blocked", async () => {
    await using first = await memoryProject()
    await using second = await memoryProject()
    const seed = async (directory: string, suffix: string) => {
      let sessionID = ""
      await Instance.provide({
        directory,
        fn: async () => {
          const projectID = Instance.project.id
          const missionID = `mission-concurrent-poll-${suffix}`
          const mission = await Session.create({
            kind: "mission",
            title: `Concurrent poll Mission ${suffix}`,
            metadata: {
              mission: { id: missionID },
              configOverlay: { model: "openai/gpt-5.6-sol" },
            },
          })
          sessionID = mission.id
          const taskRoot = await Session.create({ kind: "orchestrator", title: `Poll source Task ${suffix}` })
          const taskID = Identifier.ascending("task")
          const now = Date.now()
          Database.use((db) =>
            db
              .insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: projectID,
                session_id: taskRoot.id,
                source: "mission",
                product_pillar: "code",
                title: `Poll source Task ${suffix}`,
                request: `Recover Project ${suffix}`,
                metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
                time_started: now,
                time_created: now,
                time_updated: now,
              })
              .run(),
          )
          const sourceMessageID = `msg_concurrent_poll_${suffix}`
          const sourcePartID = `prt_concurrent_poll_${suffix}`
          persistSourceOccurrence(taskRoot.id, sourceMessageID, sourcePartID, `Concurrent poll ${suffix}`)
          Database.transaction((db) =>
            enqueueSchedulerMessageInTransaction(db, {
              invocationID: `concurrent-poll-${suffix}`,
              kind: "notification",
              source: {
                kind: "task_scheduler",
                project_id: projectID,
                task_id: taskID,
                root_session_id: taskRoot.id,
              },
              target: {
                kind: "mission_scheduler",
                project_id: projectID,
                mission_id: missionID,
                session_id: mission.id,
              },
              subject: `Concurrent poll ${suffix}`,
              sourceMessageID,
              sourcePartID,
            }),
          )
        },
      })
      return sessionID
    }
    const blockedSessionID = await seed(first.path, "blocked")
    const independentSessionID = await seed(second.path, "independent")
    let release!: () => void
    const blocked = new Promise<void>((resolve) => (release = resolve))
    let markBlockedEntered!: () => void
    const blockedEntered = new Promise<void>((resolve) => (markBlockedEntered = resolve))
    let markIndependentCompleted!: () => void
    const independentCompleted = new Promise<void>((resolve) => (markIndependentCompleted = resolve))
    const executions: string[] = []
    using _wakeLoop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ sessionID }) => {
      executions.push(sessionID)
      if (sessionID === blockedSessionID) {
        markBlockedEntered()
        await blocked
        return
      }
      if (sessionID === independentSessionID) markIndependentCompleted()
    })
    const controller = new AbortController()
    const polling = SchedulerMessageTestHooks.poll(controller.signal)
    await blockedEntered
    await independentCompleted
    expect(executions).toEqual(expect.arrayContaining([blockedSessionID, independentSessionID]))
    const stopped = new Error("stop concurrent Project polling")
    controller.abort(stopped)
    release()
    await expect(polling).rejects.toBe(stopped)
  })

  test("globally recovers an expired scheduler lease without a process-local timer", async () => {
    await using project = await memoryProject()
    let inboxID = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-global-delivery-recovery"
        const mission = await Session.create({
          kind: "mission",
          title: "Global delivery recovery Mission",
          metadata: {
            mission: { id: missionID },
            configOverlay: { model: "openai/gpt-5.6-sol" },
          },
        })
        const taskRoot = await Session.create({ kind: "orchestrator", title: "Expired delivery source Task" })
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
              title: "Expired delivery source Task",
              request: "Recover one expired scheduler delivery",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const sourceMessageID = "msg_global_delivery_recovery"
        const sourcePartID = "prt_global_delivery_recovery"
        persistSourceOccurrence(taskRoot.id, sourceMessageID, sourcePartID, "Recover this durable delivery")
        const receipt = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "global-delivery-recovery",
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
            subject: "Expired delivery recovery",
            sourceMessageID,
            sourcePartID,
          }),
        )
        inboxID = receipt.inboxID
        Database.use((db) =>
          db
            .update(ProtocolInboxTable)
            .set({
              status: "leased",
              lease_owner: "dead-runtime-owner",
              lease_until: now - 1,
              attempt: 1,
              visible_at: now - 1,
              time_updated: now,
            })
            .where(eq(ProtocolInboxTable.id, inboxID))
            .run(),
        )
      },
    })

    using _wakeLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
    await SchedulerMessageDeliveryService.runDueNow()
    expect(requireSchedulerDelivery(inboxID)).toMatchObject({
      status: "delivered",
      attempt: 2,
      deliveryResult: { kind: "session_wake" },
    })
  })

  test("global polling delivers future pending and live-lease rows and retries a busy terminal Mission wake", async () => {
    await using project = await memoryProject()
    const inboxIDs: string[] = []
    const missionSessionIDs: string[] = []
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        const now = Date.now()
        for (const suffix of ["future", "leased"] as const) {
          const missionID = `mission-poll-${suffix}`
          const mission = await Session.create({
            kind: "mission",
            title: `Polling ${suffix} Mission`,
            metadata: {
              mission: { id: missionID },
              configOverlay: { model: "openai/gpt-5.6-sol" },
            },
          })
          missionSessionIDs.push(mission.id)
          const taskRoot = await Session.create({ kind: "orchestrator", title: `Polling ${suffix} Task` })
          const taskID = Identifier.ascending("task")
          Database.use((db) =>
            db
              .insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: projectID,
                session_id: taskRoot.id,
                source: "mission",
                product_pillar: "code",
                title: `Polling ${suffix} Task`,
                request: `Recover ${suffix} delivery`,
                metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
                time_started: now,
                time_created: now,
                time_updated: now,
              })
              .run(),
          )
          let inboxID = ""
          if (suffix === "future") {
            const sourceMessageID = `msg_poll_${suffix}`
            const sourcePartID = `prt_poll_${suffix}`
            persistSourceOccurrence(taskRoot.id, sourceMessageID, sourcePartID, `Poll ${suffix}`)
            inboxID = Database.transaction((db) =>
              enqueueSchedulerMessageInTransaction(db, {
                invocationID: `poll-${suffix}`,
                kind: "notification",
                source: {
                  kind: "task_scheduler",
                  project_id: projectID,
                  task_id: taskID,
                  root_session_id: taskRoot.id,
                },
                target: {
                  kind: "mission_scheduler",
                  project_id: projectID,
                  mission_id: missionID,
                  session_id: mission.id,
                },
                subject: `Poll ${suffix}`,
                sourceMessageID,
                sourcePartID,
              }),
            ).inboxID
          } else {
            inboxID = Database.transaction((db) => {
              writeTaskUpdateInTransaction({
                db,
                taskID,
                values: { status: "failed", error: "restart terminal notification" },
                summary: "Terminal notification retained across restart",
                now: now + 1,
              })
              return db
                .select({ id: ProtocolInboxTable.id })
                .from(ProtocolInboxTable)
                .where(eq(ProtocolInboxTable.actor_id, mission.id))
                .get()!.id
            })
          }
          inboxIDs.push(inboxID)
          if (suffix === "future") {
            Database.use((db) =>
              db
                .update(ProtocolInboxTable)
                .set({ visible_at: now + 150, time_updated: now })
                .where(eq(ProtocolInboxTable.id, inboxID))
                .run(),
            )
          } else {
            const leased = claimNextSchedulerDelivery({
              actor: "session",
              actorID: mission.id,
              ownerID: "restarted-runtime",
              leaseMilliseconds: 250,
              now: Date.now() + 10,
            })
            expect(leased).toMatchObject({ id: inboxID, status: "leased", attempt: 1 })
          }
        }
      },
    })

    const attempts = new Map<string, number>()
    using _wakeLoop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ sessionID, messageID }) => {
      const attempt = (attempts.get(sessionID) ?? 0) + 1
      attempts.set(sessionID, attempt)
      if (attempt === 1) throw new Error("Mission is busy during recovered scheduler wake")
      const now = Date.now()
      Database.use((db) =>
        db
          .insert(MessageTable)
          .values({
            id: Identifier.ascending("message"),
            session_id: sessionID,
            data: {
              role: "assistant",
              parentID: messageID,
              providerID: "test",
              modelID: "test",
              time: { completed: now },
            } as never,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )
    })
    SchedulerMessageDeliveryService.initGlobal()
    try {
      const deadline = Date.now() + 6_000
      while (Date.now() < deadline && !inboxIDs.every((id) => requireSchedulerDelivery(id).status === "delivered"))
        await Bun.sleep(25)
      while (Date.now() < deadline && !missionSessionIDs.every((id) => (attempts.get(id) ?? 0) >= 2)) {
        await Bun.sleep(25)
      }
      expect({
        deliveries: inboxIDs
          .map((id) => requireSchedulerDelivery(id))
          .map((delivery) => ({
            status: delivery.status,
            attempt: delivery.attempt,
          })),
        wakeAttempts: missionSessionIDs.map((id) => attempts.get(id)),
      }).toEqual({
        deliveries: [
          { status: "delivered", attempt: 1 },
          { status: "delivered", attempt: 2 },
        ],
        wakeAttempts: [2, 2],
      })
    } finally {
      await Scheduler.disposeGlobal()
    }
  }, 15_000)

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

  test("settles a claimed Mission delivery against its durable execution closure", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-closed-recipient"
        const mission = await Session.create({
          kind: "mission",
          title: "Closed recipient Mission",
          metadata: { mission: { id: missionID } },
        })
        const taskRoot = await Session.create({ kind: "orchestrator", title: "Closing source Task" })
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
              product_pillar: "work",
              title: "Close the recipient before materialization",
              request: "Publish one lifecycle notification",
              metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const sourceMessageID = "msg_closed_recipient_source"
        const sourcePartID = "prt_closed_recipient_source"
        persistSourceOccurrence(taskRoot.id, sourceMessageID, sourcePartID, "Terminal evidence is ready")
        const queued = Database.transaction((db) =>
          enqueueSchedulerMessageInTransaction(db, {
            invocationID: "closed-recipient",
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
            subject: "Terminal evidence",
            sourceMessageID,
            sourcePartID,
          }),
        )
        using _closeAtAdmission = SchedulerMessageTestHooks.installBeforeMissionMaterialization(() =>
          closeMissionExecutionOperation({
            missionID,
            sessionID: mission.id,
            source: "mission.abort",
            requestID: "request-close-recipient",
            close: async () => undefined,
          }),
        )
        await drainSchedulerMessagesForCurrentProject()
        const closure = currentMissionExecutionClosure(mission.id)!
        expect(closure).toMatchObject({ missionID, sessionID: mission.id, state: "closed" })
        expect(requireSchedulerDelivery(queued.inboxID)).toMatchObject({
          status: "delivered",
          deliveryResult: { kind: "mission_closed", closure_event_id: closure.eventID },
          timeCompleted: expect.any(Number),
        })
        expect(listPendingSchedulerProjectIDs()).toEqual([])
      },
    })
  })

  test("joins concurrent Mission close callers on one durable operation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-concurrent-close"
        const mission = await Session.create({
          kind: "mission",
          title: "Concurrent close Mission",
          metadata: { mission: { id: missionID } },
        })
        let releaseClose!: () => void
        let markStarted!: () => void
        const started = new Promise<void>((resolve) => {
          markStarted = resolve
        })
        const closeGate = new Promise<void>((resolve) => {
          releaseClose = resolve
        })
        const first = closeMissionExecutionOperation({
          missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "request-concurrent-close-a",
          close: async () => {
            markStarted()
            await closeGate
          },
        })
        await started
        const second = closeMissionExecutionOperation({
          missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "request-concurrent-close-b",
          close: async () => undefined,
        })
        const reopened = openMissionExecution({
          missionID,
          sessionID: mission.id,
          source: "mission.wake",
          requestID: "request-reopen-after-close",
        })
        releaseClose()
        const [left, right, opened] = await Promise.all([first, second, reopened])
        expect({ left, right }).toEqual({
          left: expect.objectContaining({ missionID, sessionID: mission.id, state: "closed" }),
          right: left,
        })
        expect({ opened, current: currentMissionExecutionClosure(mission.id) }).toEqual({
          opened: expect.objectContaining({ missionID, sessionID: mission.id, state: "opened" }),
          current: opened,
        })
      },
    })
  })

  test("requires a failed durable Mission close to resume before the Mission can reopen", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-resume-durable-close"
        const mission = await Session.create({
          kind: "mission",
          title: "Resume durable close Mission",
          metadata: { mission: { id: missionID } },
        })
        await expect(
          closeMissionExecutionOperation({
            missionID,
            sessionID: mission.id,
            source: "mission.abort",
            requestID: "request-failed-close",
            close: async () => {
              throw new Error("injected physical settlement interruption")
            },
          }),
        ).rejects.toThrow("injected physical settlement interruption")
        const closing = currentMissionExecutionClosure(mission.id)!
        expect(closing).toMatchObject({ missionID, sessionID: mission.id, state: "closing" })

        await expect(
          openMissionExecution({
            missionID,
            sessionID: mission.id,
            source: "mission.wake",
            requestID: "request-reopen-during-persisted-close",
          }),
        ).rejects.toMatchObject({
          name: MissionExecutionClosingError.name,
          data: expect.objectContaining({
            missionID,
            sessionID: mission.id,
            operationID: closing.operationID,
            closureEventID: closing.eventID,
          }),
        })

        const resumed = await closeMissionExecutionOperation({
          missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "request-resume-close",
          close: async () => undefined,
        })
        const reopened = await openMissionExecution({
          missionID,
          sessionID: mission.id,
          source: "mission.wake",
          requestID: "request-reopen-after-resumed-close",
        })
        expect({ resumed, reopened, current: currentMissionExecutionClosure(mission.id) }).toEqual({
          resumed: expect.objectContaining({
            missionID,
            sessionID: mission.id,
            operationID: closing.operationID,
            state: "closed",
          }),
          reopened: expect.objectContaining({ missionID, sessionID: mission.id, state: "opened" }),
          current: reopened,
        })
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
        expect(
          Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.id, sourceMessageID)).get()),
        ).toBeUndefined()
      },
    })
  })

  test("materializes Mission identity as one real Task root Message and exact queued ingress", async () => {
    await using project = await memoryProject()
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    let rootSessionID = ""
    const observedEvents: unknown[] = []
    const observedWakeIDs: string[] = []
    const taskLoopRunner = async ({
      event,
      wakeID,
    }: Parameters<Parameters<typeof QueueTestHooks.replaceTaskLoopRunner>[0]["runner"]>[0]) => {
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
      return { finalMessageID: await persistRunnerReply({ rootSessionID, wakeID, ingressKind }) }
    }
    using _taskLoopRunner = QueueTestHooks.replaceTaskLoopRunner({ directory: project.path, runner: taskLoopRunner })
    try {
      const materialized = await Instance.provide({
        directory: project.path,
        fn: async () => {
          configureTaskLoopRunner(taskLoopRunner)
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
          rootSessionID = root.id
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
            const parsedIngress = QueuedTaskIngressSchema.parse(ingress?.payload)
            const visibleRootMessage = visible.info.extra?.task_root_message as {
              protocol: string
              taskID: string
              kind: string
              source: string
              schedulerDelivery: { eventID: string; inboxID: string; sequence: number; threadID: string }
            }
            const visibleText = visible.parts.find((part) => part.type === "text")
            const ingressRootMessage = parsedIngress.event.rootMessage!
            expect(receipt.status).toBe("delivered")
            expect(receipt.replayed).toBe(false)
            expect(receipt.wakeStatus).toBe("started")
            expect(visible.info.role).toBe("user")
            expect(visible.info.author).toBe("mission")
            expect(visibleRootMessage.protocol).toBe("task-root-message")
            expect(visibleRootMessage.taskID).toBe(taskID)
            expect(visibleRootMessage.kind).toBe("mission")
            expect(visibleRootMessage.source).toBe(`scheduler.message:${receipt.eventID}`)
            expect(visibleRootMessage.schedulerDelivery.eventID).toBe(receipt.eventID)
            expect(visibleRootMessage.schedulerDelivery.inboxID).toBe(receipt.inboxID)
            expect(visibleRootMessage.schedulerDelivery.sequence).toBe(deliverySequence)
            expect(visibleRootMessage.schedulerDelivery.threadID).toBe(receipt.threadID)
            expect(visibleText?.type === "text" ? visibleText.text : undefined).toBe(
              [
                `Scheduler request from Mission scheduler ${missionID}.`,
                `event_id: ${receipt.eventID}`,
                "thread_id: materialize-mission-request",
                "subject: Materialize identity",
                "message:",
                "Materialize nonce M-1",
                `Reply through scheduler_message with kind=reply and reply_to=${receipt.eventID}.`,
              ].join("\n"),
            )
            expect(parsedIngress.source_kind).toBe("mission_message")
            expect(parsedIngress.message_id).toBe(receipt.messageID)
            expect(ingressRootMessage.messageID).toBe(receipt.messageID)
            expect(ingressRootMessage.kind).toBe("mission")
            expect(ingressRootMessage.schedulerDelivery?.eventID).toBe(receipt.eventID)
            expect(ingressRootMessage.schedulerDelivery?.inboxID).toBe(receipt.inboxID)
            expect(ingressRootMessage.schedulerDelivery?.sequence).toBe(deliverySequence)
            expect(ingressRootMessage.schedulerDelivery?.threadID).toBe(receipt.threadID)
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
            return {
              missionID,
              missionSessionID: mission.id,
              rootSessionID: root.id,
              taskID,
              sourceMessageID,
              sourcePartID,
              receipt,
              operator,
              second,
              deliverySequence,
            }
          } catch (error) {
            release()
            throw error
          }
        },
      })

      await waitForQueueCompletionHooksForTest()
      expect(observedWakeIDs).toEqual([
        materialized.receipt.ingressID,
        materialized.operator.ingress_id,
        materialized.second.ingressID,
      ])
      const observedRootMessages = observedEvents.map(
        (event) =>
          (
            event as {
              rootMessage?: {
                messageID?: string
                kind?: string
                schedulerDelivery?: { eventID?: string; inboxID?: string; sequence?: number; threadID?: string }
              }
            }
          ).rootMessage,
      )
      expect(observedRootMessages[0]?.messageID).toBe(materialized.receipt.messageID)
      expect(observedRootMessages[0]?.kind).toBe("mission")
      expect(observedRootMessages[0]?.schedulerDelivery?.eventID).toBe(materialized.receipt.eventID)
      expect(observedRootMessages[0]?.schedulerDelivery?.inboxID).toBe(materialized.receipt.inboxID)
      expect(observedRootMessages[0]?.schedulerDelivery?.sequence).toBe(materialized.deliverySequence)
      expect(observedRootMessages[0]?.schedulerDelivery?.threadID).toBe(materialized.receipt.threadID)
      expect(observedRootMessages.map((rootMessage) => rootMessage?.kind)).toEqual(["mission", "operator", "mission"])
      expect(observedRootMessages.map((rootMessage) => rootMessage?.schedulerDelivery?.eventID)).toEqual([
        materialized.receipt.eventID,
        undefined,
        materialized.second.eventID,
      ])

      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await expect(
            sendSchedulerMessage({
              invocationID: "materialize-mission-request",
              kind: "request",
              source: {
                kind: "mission_scheduler",
                project_id: Instance.project.id,
                mission_id: materialized.missionID,
                session_id: materialized.missionSessionID,
              },
              target: {
                kind: "task_scheduler",
                project_id: Instance.project.id,
                task_id: materialized.taskID,
                root_session_id: materialized.rootSessionID,
              },
              subject: "Conflicting replay",
              sourceMessageID: materialized.sourceMessageID,
              sourcePartID: materialized.sourcePartID,
            }),
          ).rejects.toBeInstanceOf(SchedulerMessageConflictError)

          Database.transaction((db) => {
            db.update(EngineTaskTable)
              .set({ time_completed: Date.now(), time_updated: Date.now() })
              .where(eq(EngineTaskTable.id, materialized.taskID))
              .run()
          })
          const terminalReplay = await sendSchedulerMessage({
            invocationID: "materialize-mission-request",
            kind: "request",
            source: {
              kind: "mission_scheduler",
              project_id: Instance.project.id,
              mission_id: materialized.missionID,
              session_id: materialized.missionSessionID,
            },
            target: {
              kind: "task_scheduler",
              project_id: Instance.project.id,
              task_id: materialized.taskID,
              root_session_id: materialized.rootSessionID,
            },
            subject: "Materialize identity",
            sourceMessageID: materialized.sourceMessageID,
            sourcePartID: materialized.sourcePartID,
          })
          expect(terminalReplay.eventID).toBe(materialized.receipt.eventID)
          expect(terminalReplay.inboxID).toBe(materialized.receipt.inboxID)
          expect(terminalReplay.status).toBe("delivered")
          expect(terminalReplay.replayed).toBe(true)
        },
      })
    } finally {
      release()
      await waitForQueueCompletionHooksForTest()
    }
  }, 30_000)
})
