import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { enrichMessageEventProperties, projectPersistedSessionMessage } from "@/orchestrator/protocol/message-bridge"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { ToolPartOutcomeTable, ToolPartProgressTable, ToolPartRequestTable } from "@/session/session.sql"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Tool effect fact storage", () => {
  test("projects one immutable request and one immutable outcome as a completed visible ToolPart", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Tool fact storage" })
        const now = Date.now()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "assistant",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const userText = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: "Build a Sokoban game",
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          author: "assistant",
          time: { created: now + 1 },
          agent: "assistant",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const partID = Identifier.ascending("part")
        const running = await Session.updatePart({
          id: partID,
          sessionID: session.id,
          messageID: assistant.id,
          type: "tool",
          callID: "call_fact_storage",
          tool: "read",
          state: { status: "running", input: { filePath: "README.md" }, time: { start: now + 2 } },
        })
        expect(running).toMatchObject({ type: "tool", state: { status: "running" } })
        const progress = await Session.appendToolProgress({
          sessionID: session.id,
          messageID: assistant.id,
          partID,
          title: "Reading README",
          metadata: { bytes: 128 },
        })
        expect(progress).toMatchObject({
          persisted: true,
          part: {
            type: "tool",
            state: { status: "running", title: "Reading README", metadata: { bytes: 128 } },
          },
        })
        const text = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: assistant.id,
          type: "text",
          text: "Reading",
        })
        const streamedText = await Session.updatePart({ ...text, text: "Reading complete" })
        expect(streamedText).toMatchObject({ text: "Reading complete" })
        const finishedAssistant = await Session.updateMessage({
          ...assistant,
          time: { ...assistant.time, completed: now + 4 },
          finish: "tool-calls",
        })
        expect(finishedAssistant).toMatchObject({ finish: "tool-calls", time: { completed: now + 4 } })
        const completed = await Session.updatePart({
          ...running,
          state: {
            status: "completed",
            input: { filePath: "README.md" },
            output: "contents",
            title: "Read README",
            metadata: { truncated: false },
            time: { start: now + 2, end: now + 3 },
          },
        })
        expect(completed).toMatchObject({ type: "tool", state: { status: "completed", output: "contents" } })
        await expect(Session.updatePart({ ...streamedText, text: "mutated" })).rejects.toThrow(
          `Part ${streamedText.id} is immutable after assistant completion`,
        )
        await expect(
          Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: assistant.id,
            type: "text",
            text: "late",
          }),
        ).rejects.toThrow("is immutable after assistant completion")

        const facts = Database.use((db) => ({
          requests: db.select().from(ToolPartRequestTable).all(),
          progress: db.select().from(ToolPartProgressTable).all(),
          outcomes: db.select().from(ToolPartOutcomeTable).all(),
        }))
        expect(facts.requests).toEqual([
          {
            id: partID,
            message_id: assistant.id,
            data: {
              type: "tool-request",
              callID: "call_fact_storage",
              tool: "read",
              input: { filePath: "README.md" },
              time: { start: now + 2 },
            },
            time_created: expect.any(Number),
          },
        ])
        expect(facts.progress).toEqual([
          {
            id: expect.any(String),
            request_part_id: partID,
            title: "Reading README",
            metadata: { bytes: 128 },
            time_created: expect.any(Number),
          },
        ])
        expect(facts.outcomes).toEqual([
          {
            id: expect.any(String),
            request_part_id: partID,
            data: {
              outcome: "completed",
              output: "contents",
              title: "Read README",
              metadata: { truncated: false },
              time: { end: now + 3 },
            },
            time_created: expect.any(Number),
          },
        ])
        const persisted = await MessageStore.parts(assistant.id)
        expect(persisted).toEqual([
          expect.objectContaining({
            id: partID,
            type: "tool",
            state: expect.objectContaining({ status: "completed", output: "contents" }),
          }),
          expect.objectContaining({ id: streamedText.id, type: "text", text: "Reading complete" }),
        ])
        const history = await Session.messages({ sessionID: session.id })
        expect(history).toEqual([
          expect.objectContaining({
            info: expect.objectContaining({ id: user.id, role: "user" }),
            parts: [expect.objectContaining({ id: userText.id, type: "text", text: "Build a Sokoban game" })],
          }),
          expect.objectContaining({
            info: expect.objectContaining({ id: assistant.id, role: "assistant" }),
            parts: expect.arrayContaining([expect.objectContaining({ id: partID, type: "tool" })]),
          }),
        ])

        const projectedUser = projectPersistedSessionMessage({
          info: user,
          parts: await MessageStore.parts(user.id),
        })
        const projectedAssistant = projectPersistedSessionMessage({ info: finishedAssistant, parts: persisted })
        expect(projectedUser.parts).toEqual([
          expect.objectContaining({
            id: userText.id,
            type: "text",
            text: "Build a Sokoban game",
            orderKey: expect.any(String),
          }),
        ])
        expect(projectedAssistant.parts).toEqual([
          expect.objectContaining({ id: partID, type: "tool", orderKey: expect.any(String) }),
          expect.objectContaining({ id: streamedText.id, type: "text", orderKey: expect.any(String) }),
        ])

        const liveToolEvent = enrichMessageEventProperties(
          Message.Event.PartUpdated.type,
          { part: completed },
          session.id,
        )
        expect(liveToolEvent).toMatchObject({
          orderKey: projectedAssistant.info.orderKey,
          part: { id: partID, orderKey: projectedAssistant.parts[0]?.orderKey },
        })
      },
    })
  })
})
