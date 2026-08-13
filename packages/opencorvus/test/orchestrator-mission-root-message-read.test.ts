import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import { Bus } from "@/bus"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { authorizedTaskRootMessagesForWake, createOrchestratorInteractionTools } from "@/orchestrator/interaction-tools"
import {
  awaitTaskMessageProtocolBridgeIdle,
  ensureTaskMessageProtocolBridge,
} from "@/orchestrator/protocol/message-bridge"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { EngineRoutes } from "@/server/routes/orchestrator"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { MessageTable, PartTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { deliverTaskRootMessageToOrchestratorSession } from "@/task-api/task-root-message"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.09.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("Mission acceptance wake reads its exact Mission-authored Task-root message", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Mission acceptance root message" })
      const now = Date.now()
      persistTask({
        taskID,
        sessionID: root.id,
        now,
        title: "Mission acceptance root message",
        request: "Repair the exact reviewed acceptance gap",
        productPillar: "work",
        source: "test",
        priority: "normal",
        metadata: {},
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

      const messageID = Identifier.ascending("message")
      await Session.updateMessage({
        id: messageID,
        sessionID: root.id,
        role: "user",
        author: "mission",
        time: { created: now + 1 },
        agent: "orchestrator",
        model: { providerID: "openai", modelID: "gpt-5.6-sol" },
        extra: {
          task_root_message: {
            protocol: "task-root-message",
            taskID,
            kind: "mission",
            source: "mission.acceptance_resume",
          },
        },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: root.id,
        messageID,
        type: "text",
        text: "Update the report snapshot, then run the independent reviewer continuation.",
      })

      const allowedRootMessages = authorizedTaskRootMessagesForWake({
        missionAcceptanceResume: { messageID },
      })
      const readTool = createOrchestratorInteractionTools({
        taskID,
        agentSessionID: root.id,
        allowedRootMessages,
      }).read_task_message
      if (!readTool.execute) throw new Error("read_task_message is missing its executor")
      const output = await readTool.execute(
        {
          message_id: messageID,
          reason: "Bind the current Mission acceptance repair decision to the exact visible root message.",
        },
        {
          toolCallId: "call_mission_root_message",
          messages: [],
          abortSignal: new AbortController().signal,
        },
      )

      expect(output).toContain(`Task-root message ${messageID} (mission) is already recorded.`)
      expect(output).toContain("source=mission.acceptance_resume")
      expect(output).toContain("Update the report snapshot, then run the independent reviewer continuation.")

      const orchestrator = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Task Orchestrator",
      })
      const creatorMessageID = Identifier.ascending("message")
      await Session.updateMessage({
        id: creatorMessageID,
        sessionID: orchestrator.id,
        role: "user",
        author: "mission",
        time: { created: now + 2 },
        agent: "orchestrator",
        model: { providerID: "openai", modelID: "gpt-5.6-sol" },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: orchestrator.id,
        messageID: creatorMessageID,
        type: "text",
        text: "The Task creator request became visible after the scheduler message was originally persisted.",
      })
      await Database.awaitEffectIdle(5_000)
      ensureTaskMessageProtocolBridge()
      const liveSequenceBeforeMove = ProtocolStore.currentTaskLiveSequence(taskID)
      const liveEpochBeforeMove = ProtocolStore.currentTaskLiveEpoch()
      const deliveryEvents: string[] = []
      const unsubscribeMoved = Bus.subscribe(Message.Event.Moved, (event) => {
        if (
          event.properties.sourceSessionID === root.id &&
          event.properties.info.id === messageID &&
          event.properties.info.sessionID === orchestrator.id
        ) {
          deliveryEvents.push("atomic-move")
        }
      })
      const automaticDrain = Bus.TestHooks.suppressAutomaticDurableDrain()
      let durableDeliveryOccurrenceIDs: string[] = []
      try {
        await Promise.all([
          deliverTaskRootMessageToOrchestratorSession({
            task: { id: taskID, session_id: root.id, project_id: Instance.project.id },
            messageID,
            orchestratorSessionID: orchestrator.id,
          }),
          deliverTaskRootMessageToOrchestratorSession({
            task: { id: taskID, session_id: root.id, project_id: Instance.project.id },
            messageID,
            orchestratorSessionID: orchestrator.id,
          }),
        ])
        const durableDeliveryRows = Bus.TestHooks.outbox().filter((row) => {
          if (row.event_type === Message.Event.Moved.type) {
            return (row.properties as { info?: { id?: string } }).info?.id === messageID
          }
          return false
        })
        durableDeliveryOccurrenceIDs = durableDeliveryRows.map((row) => row.occurrence_id)
        expect(durableDeliveryRows).toHaveLength(1)
        expect(durableDeliveryRows[0]).toMatchObject({
          event_type: Message.Event.Moved.type,
          properties: {
            sourceSessionID: root.id,
            info: { id: messageID, sessionID: orchestrator.id },
            parts: [{ messageID, sessionID: orchestrator.id }],
          },
        })
        expect(
          Database.use((db) => ({
            message: db
              .select({ sessionID: MessageTable.session_id })
              .from(MessageTable)
              .where(eq(MessageTable.id, messageID))
              .get(),
            parts: db
              .select({ sessionID: PartTable.session_id })
              .from(PartTable)
              .where(eq(PartTable.message_id, messageID))
              .all(),
          })),
        ).toEqual({ message: { sessionID: orchestrator.id }, parts: [{ sessionID: orchestrator.id }] })
      } finally {
        automaticDrain[Symbol.dispose]()
      }
      try {
        Bus.resumeDurablePublications()
        const deliveryDeadline = Date.now() + 5_000
        while (
          durableDeliveryOccurrenceIDs.some((occurrenceID) =>
            Bus.TestHooks.outbox().some((row) => row.occurrence_id === occurrenceID),
          ) &&
          Date.now() < deliveryDeadline
        ) {
          await Bun.sleep(10)
        }
        await Database.awaitEffectIdle(5_000)
        await awaitTaskMessageProtocolBridgeIdle()
      } finally {
        unsubscribeMoved()
      }
      const liveMoveEvents = ProtocolStore.listTaskLiveEventsAfter(taskID, 0)
      expect(liveMoveEvents).toMatchObject({
        expired: false,
        events: [
          {
            type: "message.moved",
            sessionID: orchestrator.id,
            payload: {
              sourceSessionID: root.id,
              info: { id: messageID, sessionID: orchestrator.id },
              parts: [{ messageID, sessionID: orchestrator.id }],
            },
          },
        ],
      })
      const route = new Hono().route("/", EngineRoutes())
      const deltaQuery = `after_live_sequence=${liveSequenceBeforeMove}&after_live_epoch=${liveEpochBeforeMove}`
      const [sourceDeltaResponse, targetDeltaResponse] = await Promise.all([
        route.request(`/task/${taskID}/conversation/session/${root.id}?${deltaQuery}`),
        route.request(`/task/${taskID}/conversation/session/${orchestrator.id}?${deltaQuery}`),
      ])
      expect([sourceDeltaResponse.status, targetDeltaResponse.status]).toEqual([200, 200])
      const sourceDelta = (await sourceDeltaResponse.json()) as {
        transcriptMode: string
        transcript: Array<{ info?: { id?: string; sessionID?: string } }>
        removedMessageIDs: string[]
      }
      const targetDelta = (await targetDeltaResponse.json()) as typeof sourceDelta
      expect(sourceDelta).toMatchObject({
        transcriptMode: "delta",
        transcript: [],
        removedMessageIDs: [messageID],
      })
      expect(targetDelta).toMatchObject({
        transcriptMode: "delta",
        transcript: [{ info: { id: messageID, sessionID: orchestrator.id } }],
        removedMessageIDs: [messageID],
      })
      const delivered = await MessageStore.get({ sessionID: orchestrator.id, messageID })
      const latestUserMessages: string[] = []
      for await (const current of MessageStore.stream(orchestrator.id)) {
        if (current.info.role === "user") latestUserMessages.push(current.info.id)
      }
      const persistedPartSessions = Database.use((db) =>
        db.select({ sessionID: PartTable.session_id }).from(PartTable).where(eq(PartTable.message_id, messageID)).all(),
      )
      expect({
        delivered,
        messageCount: Database.use(
          (db) => db.select().from(MessageTable).where(eq(MessageTable.id, messageID)).all().length,
        ),
        persistedPartSessions,
      }).toMatchObject({
        delivered: {
          info: { id: messageID, sessionID: orchestrator.id, role: "user", author: "mission" },
          parts: [
            {
              messageID,
              sessionID: orchestrator.id,
              type: "text",
              text: "Update the report snapshot, then run the independent reviewer continuation.",
            },
          ],
        },
        messageCount: 1,
        persistedPartSessions: [{ sessionID: orchestrator.id }],
      })
      expect({
        latestUserMessages,
        deliveredCreated: delivered.info.time.created,
        creatorCreated: now + 2,
        messageOrderKey: delivered.info.orderKey,
        partOrderKey: delivered.parts[0]?.orderKey,
        deliveryEvents,
      }).toEqual({
        latestUserMessages: [messageID, creatorMessageID],
        deliveredCreated: expect.any(Number),
        creatorCreated: now + 2,
        messageOrderKey: expect.stringContaining(`:message:${messageID}`),
        partOrderKey: expect.stringContaining(`:part:`),
        deliveryEvents: ["atomic-move"],
      })
      expect(delivered.info.time.created).toBeGreaterThan(now + 2)

      const deliveredOutput = await readTool.execute(
        {
          message_id: messageID,
          reason: "Consume the same durable Mission Message from the Orchestrator conversation.",
        },
        {
          toolCallId: "call_delivered_mission_root_message",
          messages: [],
          abortSignal: new AbortController().signal,
        },
      )
      expect(deliveredOutput).toContain("Update the report snapshot, then run the independent reviewer continuation.")

      const wrongSourceMessageID = Identifier.ascending("message")
      await Session.updateMessage({
        id: wrongSourceMessageID,
        sessionID: root.id,
        role: "user",
        author: "mission",
        time: { created: now + 2 },
        agent: "orchestrator",
        model: { providerID: "openai", modelID: "gpt-5.6-sol" },
        extra: {
          task_root_message: {
            protocol: "task-root-message",
            taskID,
            kind: "mission",
            source: "mission.followup",
          },
        },
      })
      const wrongSourceTool = createOrchestratorInteractionTools({
        taskID,
        agentSessionID: root.id,
        allowedRootMessages: authorizedTaskRootMessagesForWake({
          missionAcceptanceResume: { messageID: wrongSourceMessageID },
        }),
      }).read_task_message
      if (!wrongSourceTool.execute) throw new Error("read_task_message is missing its executor")
      await expect(
        wrongSourceTool.execute(
          {
            message_id: wrongSourceMessageID,
            reason: "Reject a Mission message that was not produced by acceptance resume.",
          },
          {
            toolCallId: "call_wrong_mission_source",
            messages: [],
            abortSignal: new AbortController().signal,
          },
        ),
      ).rejects.toThrow(
        `Task-root message ${wrongSourceMessageID} provenance source=mission.followup, expected mission.acceptance_resume`,
      )
    },
  })
})

test("successor runtime replays one atomic Task-root Message move after registering its durable bridge", async () => {
  await using project = await memoryProject()
  let taskID = ""
  let rootSessionID = ""
  let orchestratorSessionID = ""
  let messageID = ""
  let moveOccurrenceID = ""

  await Instance.provide({
    directory: project.path,
    fn: async () => {
      taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Recover atomic Task-root Message move" })
      rootSessionID = root.id
      const now = Date.now()
      persistTask({
        taskID,
        sessionID: root.id,
        now,
        title: "Recover atomic Task-root Message move",
        request: "Resume the one durable moved-message occurrence",
        productPillar: "work",
        source: "test",
        priority: "normal",
        metadata: {},
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
      const orchestrator = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Recovered Task Orchestrator",
      })
      orchestratorSessionID = orchestrator.id
      messageID = Identifier.ascending("message")
      await Session.updateMessage({
        id: messageID,
        sessionID: root.id,
        role: "user",
        author: "mission",
        time: { created: now + 1 },
        agent: "orchestrator",
        model: { providerID: "openai", modelID: "gpt-5.6-sol" },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: root.id,
        messageID,
        type: "text",
        text: "Recover this exact participant message after runtime restart.",
      })
      await Database.awaitEffectIdle(5_000)
      const automaticDrain = Bus.TestHooks.suppressAutomaticDurableDrain()
      try {
        await deliverTaskRootMessageToOrchestratorSession({
          task: { id: taskID, session_id: root.id, project_id: Instance.project.id },
          messageID,
          orchestratorSessionID: orchestrator.id,
        })
        const move = Bus.TestHooks.outbox().find(
          (row) =>
            row.event_type === Message.Event.Moved.type &&
            (row.properties as { info?: { id?: string } }).info?.id === messageID,
        )
        expect(move).toMatchObject({
          event_type: Message.Event.Moved.type,
          properties: {
            sourceSessionID: root.id,
            info: { id: messageID, sessionID: orchestrator.id },
            parts: [{ messageID, sessionID: orchestrator.id }],
          },
        })
        moveOccurrenceID = move!.occurrence_id
      } finally {
        automaticDrain[Symbol.dispose]()
      }
      await Database.awaitEffectIdle(5_000)
    },
  })

  await Instance.disposeAll()
  await Instance.provide({
    directory: project.path,
    init: InstanceBootstrap,
    fn: async () => {
      const deadline = Date.now() + 5_000
      while (Bus.TestHooks.outbox().some((row) => row.occurrence_id === moveOccurrenceID) && Date.now() < deadline) {
        await Bun.sleep(10)
      }
      await Database.awaitEffectIdle(5_000)
      await awaitTaskMessageProtocolBridgeIdle()
      expect(Bus.TestHooks.outbox().find((row) => row.occurrence_id === moveOccurrenceID)).toBeUndefined()
      expect(ProtocolStore.listTaskLiveEventsAfter(taskID, 0)).toMatchObject({
        expired: false,
        events: [
          {
            type: "message.moved",
            sessionID: orchestratorSessionID,
            payload: {
              sourceSessionID: rootSessionID,
              info: { id: messageID, sessionID: orchestratorSessionID },
              parts: [{ messageID, sessionID: orchestratorSessionID }],
            },
          },
        ],
      })
      await expect(MessageStore.get({ sessionID: orchestratorSessionID, messageID })).resolves.toMatchObject({
        info: { id: messageID, sessionID: orchestratorSessionID },
        parts: [{ messageID, sessionID: orchestratorSessionID }],
      })
    },
  })
})

test("idempotent Task-root Message delivery validates every target-owned Part", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Validate delivered Task-root Message" })
      const now = Date.now()
      persistTask({
        taskID,
        sessionID: root.id,
        now,
        title: "Validate delivered Task-root Message",
        request: "Validate every Part in an idempotently delivered Task-root Message",
        productPillar: "work",
        source: "test",
        priority: "normal",
        metadata: {},
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
      const orchestrator = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Validate delivered Task Orchestrator",
      })
      const messageID = Identifier.ascending("message")
      const partID = Identifier.ascending("part")
      await Session.updateMessage({
        id: messageID,
        sessionID: orchestrator.id,
        role: "user",
        author: "mission",
        time: { created: now },
        agent: "orchestrator",
        model: { providerID: "openai", modelID: "gpt-5.6-sol" },
      })
      await Session.updatePart({
        id: partID,
        sessionID: orchestrator.id,
        messageID,
        type: "text",
        text: "Validate the complete target-owned Message tree.",
      })
      await Database.awaitEffectIdle(5_000)
      Database.use((db) => db.update(PartTable).set({ session_id: root.id }).where(eq(PartTable.id, partID)).run())

      await expect(
        deliverTaskRootMessageToOrchestratorSession({
          task: { id: taskID, session_id: root.id, project_id: Instance.project.id },
          messageID,
          orchestratorSessionID: orchestrator.id,
        }),
      ).rejects.toThrow(`Task-root Message ${messageID} is delivered but Part ${partID} remains on Session ${root.id}.`)
    },
  })
})
