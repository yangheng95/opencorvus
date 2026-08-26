import { afterEach, expect, test } from "bun:test"
import { createRightSidebarConversationSession, RIGHT_SIDEBAR_CONVERSATION_SOURCE } from "@/chat/session"
import { SessionConversationConnectionSnapshot } from "@/engine/model"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { includeSessionTreeEvent } from "@/server/routes/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function sessionEventReader(response: Response) {
  if (!response.body) throw new Error("Session event stream response has no body")
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffered = ""
  return {
    async next(type: string): Promise<any> {
      const deadline = Date.now() + 5_000
      while (Date.now() < deadline) {
        const frames = buffered.split("\n\n")
        buffered = frames.pop() ?? ""
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
          if (!data) continue
          const event = JSON.parse(data)
          if (event.type === type) return event
        }
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

test("a child Session event joins the selected Session tree through its durable parent", () => {
  const tree = new Set(["ses_work_root"])
  const included = includeSessionTreeEvent(tree, {
    sessionID: "ses_work_child",
    payload: { parentSessionID: "ses_work_root" },
  })
  expect({ included, sessionIDs: [...tree] }).toEqual({
    included: true,
    sessionIDs: ["ses_work_root", "ses_work_child"],
  })
})
