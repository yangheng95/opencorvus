import { afterEach, expect, test } from "bun:test"
import { Bus } from "@/bus"
import { createRightSidebarConversationSession, RIGHT_SIDEBAR_CONVERSATION_SOURCE } from "@/chat/session"
import {
  SessionConnectedEvent,
  SessionConversationConnectionSnapshot,
  SessionProtocolEvent,
  SessionStreamEvent,
} from "@/engine/model"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { SchedulerMessagePayload } from "@/protocol/schema"
import { ProtocolStore } from "@/protocol/store"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { SessionEventStreamTestHooks } from "@/server/routes/session"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  SessionEventStreamTestHooks.afterConversationSnapshotRead = undefined
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function sessionEventReader(response: Response) {
  if (!response.body) throw new Error("Session event stream response has no body")
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffered = ""
  const queued: any[] = []
  return {
    async next(type: string): Promise<any> {
      const deadline = Date.now() + 5_000
      while (Date.now() < deadline) {
        const queuedIndex = queued.findIndex((event) => event.type === type)
        if (queuedIndex >= 0) return queued.splice(queuedIndex, 1)[0]
        const frames = buffered.split("\n\n")
        buffered = frames.pop() ?? ""
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
          if (!data) continue
          queued.push(JSON.parse(data))
        }
        const frameIndex = queued.findIndex((event) => event.type === type)
        if (frameIndex >= 0) return queued.splice(frameIndex, 1)[0]
        const remaining = deadline - Date.now()
        const result = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), remaining),
          ),
        ])
        if (result.done) break
        buffered += decoder.decode(result.value, { stream: true })
      }
      throw new Error(`Session event stream closed before ${type}`)
    },
    cancel: () => reader.cancel(),
  }
}

test("Session stream schema classifies connection snapshots and ordinary protocol events by type", () => {
  const envelope = {
    event_id: "event-1",
    session_id: "session-1",
    orderKey: "session:0000000000001:event-1",
    emittedAt: 1,
    timestamp: 1,
    sequence: 0,
    summary: "schema classification",
  }
  const connected = SessionStreamEvent.parse({
    ...envelope,
    type: "session.connected",
    payload: {
      sessionID: "session-1",
      conversationSnapshot: {
        transcript: [],
        view: { topLevelSessionIDs: [], sessions: [], messages: [] },
        history: {
          oldestTimestamp: null,
          oldestOrderKey: null,
          oldestMessageID: null,
          hasMore: false,
          limit: 80,
        },
      },
    },
  })
  const heartbeat = SessionStreamEvent.parse({
    ...envelope,
    event_id: "event-2",
    type: "session.heartbeat",
    payload: { sessionID: "session-1" },
  })

  expect({
    connectedType: connected.type,
    connectedTranscriptLength:
      connected.type === "session.connected" ? connected.payload.conversationSnapshot.transcript.length : undefined,
    protocolType: heartbeat.type,
    protocolSchema: SessionProtocolEvent.safeParse(heartbeat).success,
  }).toEqual({
    connectedType: "session.connected",
    connectedTranscriptLength: 0,
    protocolType: "session.heartbeat",
    protocolSchema: true,
  })
})

test("Session stream schema reports malformed connection frames as a Zod contract error", () => {
  const parsed = SessionStreamEvent.safeParse({
    event_id: "event-malformed",
    session_id: "session-1",
    orderKey: "session:0000000000001:event-malformed",
    emittedAt: 1,
    timestamp: 1,
    sequence: 0,
    summary: "missing connection snapshot",
    type: "session.connected",
    payload: { sessionID: "session-1" },
  })

  expect(
    parsed.success
      ? { result: "parsed" }
      : {
          result: "contract-error",
          errorName: parsed.error.name,
          issuePath: parsed.error.issues[0]?.path.join("."),
        },
  ).toEqual({
    result: "contract-error",
    errorName: "ZodError",
    issuePath: "payload.conversationSnapshot",
  })
})

test("Session stream projects a non-message Session diff through Bus and ProtocolStore", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const work = await createRightSidebarConversationSession("work")
      const abort = new AbortController()
      const response = await Server.App().request(`/session/${work.id}/events`, {
        headers: { "x-opencorvus-directory": project.path },
        signal: abort.signal,
      })
      expect(response.status).toBe(200)
      const events = sessionEventReader(response)
      await events.next("session.connected")

      const schedulerPayload = SchedulerMessagePayload.parse({
        protocol: "scheduler-message-v3",
        invocation_id: "session-stream-public-vocabulary",
        message_kind: "notification",
        thread_id: "session-stream-contract",
        source_terminal_event_id: Identifier.ascending("protocol_event"),
        source_task_execution_epoch: null,
        target_task_execution_epoch: null,
        source_body_sha256: "0".repeat(64),
        subject: "Internal scheduler control",
      })
      const internalControl = await ProtocolStore.appendEvent({
        kind: "event",
        type: "scheduler.message",
        aggregate: "session",
        aggregate_id: work.id,
        session_id: null,
        source: "scheduler.message",
        payload: schedulerPayload,
      })
      expect(internalControl).toMatchObject({
        kind: "event",
        type: "scheduler.message",
        aggregate: "session",
        aggregateID: work.id,
        sessionID: work.id,
        source: "scheduler.message",
        payload: schedulerPayload,
      })
      await Database.awaitEffectIdle(5_000)

      await Bus.publish(Session.Event.Diff, {
        sessionID: work.id,
        diff: [],
      })
      const diff = await events.next("session.diff")
      await events.cancel()
      abort.abort()

      expect(SessionProtocolEvent.parse(diff)).toMatchObject({
        session_id: work.id,
        type: "session.diff",
        summary: "Session diff updated",
        payload: {
          sessionID: work.id,
          diff: [],
          channel: "assistant",
          orderKey: expect.any(String),
        },
      })
    },
  })
}, 30_000)

test("session.connected converges the persisted first Work prompt at the stream cutover", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const work = await createRightSidebarConversationSession("work")
      const created = Date.now()
      const user = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: work.id,
        role: "user",
        author: "user",
        time: { created },
        agent: "work",
        model: { providerID: "test", modelID: "test" },
        extra: {
          surface: "right-sidebar",
          source: RIGHT_SIDEBAR_CONVERSATION_SOURCE,
          experience: "work",
        },
      })
      const part = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: work.id,
        messageID: user.id,
        type: "text",
        text: "The first Work prompt must remain visible.",
      })

      const abort = new AbortController()
      const response = await Server.App().request(`/session/${work.id}/events`, {
        headers: { "x-opencorvus-directory": project.path },
        signal: abort.signal,
      })
      expect(response.status).toBe(200)
      const events = sessionEventReader(response)
      const connected = await events.next("session.connected")
      await events.cancel()
      abort.abort()
      const snapshot = connected.payload.conversationSnapshot
      expect(SessionConnectedEvent.safeParse(connected).success).toBe(true)
      expect(SessionConversationConnectionSnapshot.safeParse(snapshot).success).toBe(true)

      expect({
        sessionID: connected.payload.sessionID,
        transcript: snapshot.transcript.map((message) => ({
          id: message.info.id,
          role: message.info.role,
          author: message.info.author,
          agentID: message.info.agentID,
          sessionAgentID: message.info.sessionAgentID,
          channel: message.info.channel,
          source: message.info.originSource,
          parts: message.parts.map((item) => ({
            id: item.id,
            type: item.type,
            text: "text" in item ? item.text : undefined,
          })),
        })),
        view: snapshot.view.messages.map((message) => ({
          messageID: message.messageID,
          stage: message.stage,
          agentID: message.agentID,
          sessionAgentID: message.sessionAgentID,
        })),
        history: snapshot.history,
      }).toEqual({
        sessionID: work.id,
        transcript: [
          {
            id: user.id,
            role: "user",
            author: "user",
            agentID: "work",
            sessionAgentID: "work",
            channel: "assistant",
            source: RIGHT_SIDEBAR_CONVERSATION_SOURCE,
            parts: [{ id: part.id, type: "text", text: "The first Work prompt must remain visible." }],
          },
        ],
        view: [{ messageID: user.id, stage: "user", agentID: "work", sessionAgentID: "work" }],
        history: expect.objectContaining({
          oldestMessageID: user.id,
          hasMore: false,
          limit: 80,
        }),
      })
    },
  })
}, 30_000)

test("session.connected publishes a pageable canonical tail after a long disconnect", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const chat = await createRightSidebarConversationSession("chat")
      const messageIDs: string[] = []
      const started = Date.now() - 100_000
      for (let index = 0; index < 82; index += 1) {
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: chat.id,
          role: "user",
          author: "user",
          time: { created: started + index },
          agent: "chat",
          model: { providerID: "test", modelID: "test" },
          extra: {
            surface: "right-sidebar",
            source: RIGHT_SIDEBAR_CONVERSATION_SOURCE,
            experience: "chat",
          },
        })
        messageIDs.push(message.id)
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: chat.id,
          messageID: message.id,
          type: "text",
          text: `Disconnected prompt ${index}`,
        })
      }

      const abort = new AbortController()
      const response = await Server.App().request(`/session/${chat.id}/events`, {
        headers: { "x-opencorvus-directory": project.path },
        signal: abort.signal,
      })
      const events = sessionEventReader(response)
      const connected = await events.next("session.connected")
      await events.cancel()
      abort.abort()
      const snapshot = connected.payload.conversationSnapshot

      expect({
        messageIDs: snapshot.transcript.map((message: any) => message.info.id),
        history: snapshot.history,
      }).toEqual({
        messageIDs: messageIDs.slice(-80),
        history: expect.objectContaining({
          oldestMessageID: messageIDs[2],
          hasMore: true,
          limit: 80,
        }),
      })
    },
  })
}, 30_000)

test("session.connected precedes a newer live Part update captured after snapshot read", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const work = await createRightSidebarConversationSession("work")
      const message = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: work.id,
        role: "user",
        author: "user",
        time: { created: Date.now() },
        agent: "work",
        model: { providerID: "test", modelID: "test" },
        extra: {
          surface: "right-sidebar",
          source: RIGHT_SIDEBAR_CONVERSATION_SOURCE,
          experience: "work",
        },
      })
      const partID = Identifier.ascending("part")
      await Session.updatePart({
        id: partID,
        sessionID: work.id,
        messageID: message.id,
        type: "text",
        text: "snapshot content",
      })
      SessionEventStreamTestHooks.afterConversationSnapshotRead = async ({ sessionID }) => {
        if (sessionID !== work.id) return
        SessionEventStreamTestHooks.afterConversationSnapshotRead = undefined
        await Instance.provide({
          directory: project.path,
          fn: () =>
            Session.updatePart({
              id: partID,
              sessionID: work.id,
              messageID: message.id,
              type: "text",
              text: "newer live content",
            }),
        })
      }

      const abort = new AbortController()
      const response = await Server.App().request(`/session/${work.id}/events`, {
        headers: { "x-opencorvus-directory": project.path },
        signal: abort.signal,
      })
      const events = sessionEventReader(response)
      const connected = await events.next("session.connected")
      const livePart = await events.next("message.part.updated")
      await events.cancel()
      abort.abort()

      expect({
        snapshotText: connected.payload.conversationSnapshot.transcript[0]?.parts[0]?.text,
        liveSessionID: livePart.session_id,
        livePartID: livePart.payload.part.id,
        liveText: livePart.payload.part.text,
      }).toEqual({
        snapshotText: "snapshot content",
        liveSessionID: work.id,
        livePartID: partID,
        liveText: "newer live content",
      })
    },
  })
}, 30_000)

test("two project streams receive their own non-Task child Message and Part events", async () => {
  await using projectA = await memoryProject()
  await using projectB = await memoryProject()

  const ownerA = await Instance.provide({
    directory: projectA.path,
    fn: async () => ({
      root: await createRightSidebarConversationSession("work"),
      projectID: Instance.project.id,
    }),
  })
  const ownerB = await Instance.provide({
    directory: projectB.path,
    fn: async () => ({
      root: await createRightSidebarConversationSession("work"),
      projectID: Instance.project.id,
    }),
  })
  const abortA = new AbortController()
  const abortB = new AbortController()
  const responseA = await Server.App().request(`/session/${ownerA.root.id}/events`, {
    headers: { "x-opencorvus-directory": projectA.path },
    signal: abortA.signal,
  })
  const responseB = await Server.App().request(`/session/${ownerB.root.id}/events`, {
    headers: { "x-opencorvus-directory": projectB.path },
    signal: abortB.signal,
  })
  const eventsA = sessionEventReader(responseA)
  const eventsB = sessionEventReader(responseB)
  await Promise.all([eventsA.next("session.connected"), eventsB.next("session.connected")])

  const writeChildMessage = (input: { directory: string; rootID: string; text: string }) =>
    Instance.provide({
      directory: input.directory,
      fn: async () => {
        const child = await Session.create({
          kind: "orchestrator",
          parentID: input.rootID,
          title: input.text,
        })
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: child.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "test" },
        })
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: child.id,
          messageID: message.id,
          type: "text",
          text: input.text,
        })
        return { child, message, part }
      },
    })

  const writtenA = await writeChildMessage({
    directory: projectA.path,
    rootID: ownerA.root.id,
    text: "project A child",
  })
  const writtenB = await writeChildMessage({
    directory: projectB.path,
    rootID: ownerB.root.id,
    text: "project B child",
  })
  const [messageA, partA, messageB, partB] = await Promise.all([
    eventsA.next("message.updated"),
    eventsA.next("message.part.updated"),
    eventsB.next("message.updated"),
    eventsB.next("message.part.updated"),
  ])
  await Promise.all([eventsA.cancel(), eventsB.cancel()])
  abortA.abort()
  abortB.abort()

  expect([
    {
      sessionID: messageA.session_id,
      messageID: messageA.payload.info.id,
      projectID: messageA.payload.projectID,
      rootSessionID: messageA.payload.rootSessionID,
      lineage: messageA.payload.sessionLineage,
      partID: partA.payload.part.id,
      text: partA.payload.part.text,
    },
    {
      sessionID: messageB.session_id,
      messageID: messageB.payload.info.id,
      projectID: messageB.payload.projectID,
      rootSessionID: messageB.payload.rootSessionID,
      lineage: messageB.payload.sessionLineage,
      partID: partB.payload.part.id,
      text: partB.payload.part.text,
    },
  ]).toEqual([
    {
      sessionID: writtenA.child.id,
      messageID: writtenA.message.id,
      projectID: ownerA.projectID,
      rootSessionID: ownerA.root.id,
      lineage: [writtenA.child.id, ownerA.root.id],
      partID: writtenA.part.id,
      text: "project A child",
    },
    {
      sessionID: writtenB.child.id,
      messageID: writtenB.message.id,
      projectID: ownerB.projectID,
      rootSessionID: ownerB.root.id,
      lineage: [writtenB.child.id, ownerB.root.id],
      partID: writtenB.part.id,
      text: "project B child",
    },
  ])
}, 30_000)
