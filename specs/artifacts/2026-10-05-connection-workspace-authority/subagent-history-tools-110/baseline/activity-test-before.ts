import { afterEach, expect, test } from "bun:test"
import { Bus } from "@/bus"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function createOccurrence(input: {
  sessionID: string
  texts: string[]
}): Promise<{ inputMessageID: string; assistantMessageID: string }> {
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: input.sessionID,
    role: "user",
    author: "orchestrator",
    agent: "researcher",
    model: { providerID: "test", modelID: "activity" },
    time: { created: Date.now() },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    parentID: user.id,
    sessionID: input.sessionID,
    role: "assistant",
    author: "researcher",
    agent: "researcher",
    path: { cwd: "C:\\activity", root: "C:\\activity" },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: "activity",
    providerID: "test",
    time: { created: Date.now() },
  })
  for (let index = 0; index < input.texts.length; index += 1) {
    const partID = Identifier.ascending("part")
    await Session.updatePart({
      id: partID,
      sessionID: input.sessionID,
      messageID: assistant.id,
      type: "text",
      text: input.texts[index]!,
    })
  }
  return { inputMessageID: user.id, assistantMessageID: assistant.id }
}

test("hydrates bounded activity for parallel Sessions and repeated execution occurrences", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const reused = await Session.create({ kind: "assistant", title: "Reused worker" })
      const parallel = await Session.create({ kind: "assistant", title: "Parallel worker" })
      const firstInputMessageID = (await createOccurrence({
        sessionID: reused.id,
        texts: Array.from({ length: 30 }, (_, index) => (index < 25 ? `first-${index}` : "")),
      })).inputMessageID
      const secondInputMessageID = (await createOccurrence({
        sessionID: reused.id,
        texts: ["second-0", "second-1"],
      })).inputMessageID
      const parallelInputMessageID = (await createOccurrence({
        sessionID: parallel.id,
        texts: ["parallel-0"],
      })).inputMessageID

      const activity = await MessageStore.latestConversationAgentActivityByExecution({
        executions: [
          { sessionID: reused.id, inputMessageID: firstInputMessageID },
          { sessionID: reused.id, inputMessageID: secondInputMessageID },
          { sessionID: parallel.id, inputMessageID: parallelInputMessageID },
        ],
      })

      expect(activity.get(firstInputMessageID)?.map((item) => item.type === "text" ? item.text : item.type)).toEqual(
        Array.from({ length: 24 }, (_, index) => `first-${index + 1}`),
      )
      expect(activity.get(secondInputMessageID)?.map((item) => item.type === "text" ? item.text : item.type)).toEqual([
        "second-0",
        "second-1",
      ])
      expect(activity.get(parallelInputMessageID)?.map((item) => item.type === "text" ? item.text : item.type)).toEqual([
        "parallel-0",
      ])

      const chunkedExecutions: Array<{ sessionID: string; inputMessageID: string }> = []
      const chunkedOccurrences: Array<Awaited<ReturnType<typeof createOccurrence>>> = []
      for (let index = 0; index < 65; index += 1) {
        const occurrence = await createOccurrence({ sessionID: reused.id, texts: [`chunk-${index}`] })
        chunkedOccurrences.push(occurrence)
        chunkedExecutions.push({
          sessionID: reused.id,
          inputMessageID: occurrence.inputMessageID,
        })
      }
      const chunkedActivity = await MessageStore.latestConversationAgentActivityByExecution({
        executions: chunkedExecutions,
      })
      expect(chunkedActivity.size).toBe(65)
      expect(chunkedActivity.get(chunkedExecutions[0]!.inputMessageID)).toMatchObject([{ text: "chunk-0" }])
      expect(chunkedActivity.get(chunkedExecutions[64]!.inputMessageID)).toMatchObject([{ text: "chunk-64" }])

      const removable = chunkedOccurrences[0]!
      let unsubscribe = () => undefined
      const removedEvent = new Promise<unknown>((resolve) => {
        unsubscribe = Bus.subscribe(Message.Event.Removed, (event) => {
          if (event.properties.messageID !== removable.assistantMessageID) return
          resolve(event.properties)
        })
      })
      try {
        await Session.removeMessage({ sessionID: reused.id, messageID: removable.assistantMessageID })
        await expect(removedEvent).resolves.toMatchObject({
          sessionID: reused.id,
          messageID: removable.assistantMessageID,
          info: { id: removable.assistantMessageID, sessionID: reused.id, role: "assistant" },
        })
      } finally {
        unsubscribe()
      }
    },
  })
}, 60_000)
