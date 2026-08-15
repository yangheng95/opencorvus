import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { recordProviderActivityEvent } from "@/session/provider-activity-facts"
import { ProviderActivityOutcomeTable, ProviderActivityRequestTable } from "@/session/session.sql"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Provider activity fact storage", () => {
  test("streams multiple Provider steps into one effect-bound assistant with fixed causal/model identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Provider fact storage" })
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
        const activityID = Identifier.ascending("activity")
        recordProviderActivityEvent(assistant.id, {
          type: "started",
          id: activityID,
          ts: now + 2,
          sessionID: session.id,
          provider: "openai",
          model: "gpt-5.6-terra",
        })
        const secondActivityID = Identifier.ascending("activity")
        recordProviderActivityEvent(assistant.id, {
          type: "started",
          id: secondActivityID,
          ts: now + 3,
          sessionID: session.id,
          provider: "openai",
          model: "gpt-5.6-terra",
        })
        const streamed = await Session.updateMessage({
          ...assistant,
          cost: 0.25,
          tokens: { ...assistant.tokens, input: 4, output: 3, total: 7 },
        })
        expect(streamed).toMatchObject({
          parentID: user.id,
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          cost: 0.25,
          tokens: { input: 4, output: 3, total: 7 },
        })
        await expect(Session.updateMessage({ ...streamed, modelID: "different-model" })).rejects.toThrow(
          `Assistant Message ${assistant.id} effect causal/model identity is immutable`,
        )
        recordProviderActivityEvent(assistant.id, { type: "terminal", id: activityID, ts: now + 4, outcome: "done" })
        recordProviderActivityEvent(assistant.id, {
          type: "terminal",
          id: secondActivityID,
          ts: now + 5,
          outcome: "done",
        })
        const completed = await Session.updateMessage({
          ...streamed,
          finish: "stop",
          time: { ...streamed.time, completed: now + 6 },
        })
        expect(completed.time.completed).toBe(now + 6)

        const facts = Database.use((db) => ({
          requests: db.select().from(ProviderActivityRequestTable).all(),
          outcomes: db.select().from(ProviderActivityOutcomeTable).all(),
        }))
        expect(facts.requests).toEqual([
          { id: activityID, assistant_message_id: assistant.id, time_created: now + 2 },
          { id: secondActivityID, assistant_message_id: assistant.id, time_created: now + 3 },
        ])
        expect(facts.outcomes).toEqual([
          { id: expect.any(String), request_id: activityID, data: { outcome: "done" }, time_created: now + 4 },
          { id: expect.any(String), request_id: secondActivityID, data: { outcome: "done" }, time_created: now + 5 },
        ])
      },
    })
  })
})
