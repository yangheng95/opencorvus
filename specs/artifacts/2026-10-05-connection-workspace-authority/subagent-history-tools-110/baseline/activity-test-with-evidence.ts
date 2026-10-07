import { afterEach, expect, test } from "bun:test"
import { Bus } from "@/bus"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import fs from "node:fs/promises"
import path from "node:path"

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
      const firstInputMessageID = (
        await createOccurrence({
          sessionID: reused.id,
          texts: Array.from({ length: 30 }, (_, index) => (index < 25 ? `first-${index}` : "")),
        })
      ).inputMessageID
      const secondInputMessageID = (
        await createOccurrence({
          sessionID: reused.id,
          texts: ["second-0", "second-1"],
        })
      ).inputMessageID
      const parallelInputMessageID = (
        await createOccurrence({
          sessionID: parallel.id,
          texts: ["parallel-0"],
        })
      ).inputMessageID

      const activity = await MessageStore.latestConversationAgentActivityByExecution({
        executions: [
          { sessionID: reused.id, inputMessageID: firstInputMessageID },
          { sessionID: reused.id, inputMessageID: secondInputMessageID },
          { sessionID: parallel.id, inputMessageID: parallelInputMessageID },
        ],
      })

      expect(activity.get(firstInputMessageID)?.map((item) => (item.type === "text" ? item.text : item.type))).toEqual(
        Array.from({ length: 24 }, (_, index) => `first-${index + 1}`),
      )
      expect(activity.get(secondInputMessageID)?.map((item) => (item.type === "text" ? item.text : item.type))).toEqual(
        ["second-0", "second-1"],
      )
      expect(
        activity.get(parallelInputMessageID)?.map((item) => (item.type === "text" ? item.text : item.type)),
      ).toEqual(["parallel-0"])

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

test("compact activity retains canonical Tool completion, failure and progress across assistant steps and executions", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const reused = await Session.create({ kind: "assistant", title: "Canonical Tool activity" })
      const parallel = await Session.create({ kind: "assistant", title: "Parallel canonical Tool activity" })
      const first = await createOccurrence({ sessionID: reused.id, texts: [] })
      const nextAssistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        parentID: first.inputMessageID,
        sessionID: reused.id,
        role: "assistant",
        author: "researcher",
        agent: "researcher",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        modelID: "activity",
        providerID: "test",
        time: { created: Date.now() },
      })
      const second = await createOccurrence({ sessionID: reused.id, texts: [] })
      const other = await createOccurrence({ sessionID: parallel.id, texts: [] })
      const targets = [
        {
          sessionID: reused.id,
          messageID: first.assistantMessageID,
          inputMessageID: first.inputMessageID,
          value: "first-step",
        },
        {
          sessionID: reused.id,
          messageID: nextAssistant.id,
          inputMessageID: first.inputMessageID,
          value: "second-step",
        },
        {
          sessionID: reused.id,
          messageID: second.assistantMessageID,
          inputMessageID: second.inputMessageID,
          value: "reused-input",
        },
        {
          sessionID: parallel.id,
          messageID: other.assistantMessageID,
          inputMessageID: other.inputMessageID,
          value: "parallel-input",
        },
      ]
      const writes = []
      for (const target of targets) {
        const start = Date.now()
        const base = {
          id: Identifier.ascending("part"),
          sessionID: target.sessionID,
          messageID: target.messageID,
          type: "tool" as const,
          tool: "read_agent_message",
          callID: `owned-${target.value}`,
        }
        await Session.updatePart({
          ...base,
          state: {
            status: "pending",
            input: { value: target.value },
            raw: JSON.stringify({ value: target.value }),
            time: { start },
          },
        })
        const running = await Session.updatePart({
          ...base,
          state: {
            status: "running",
            input: { value: target.value },
            title: `Reading ${target.value}`,
            metadata: { progress: target.value },
            time: { start },
          },
        })
        const terminal =
          target.value === "parallel-input"
            ? running
            : await Session.updatePart({
                ...base,
                state:
                  target.value === "second-step"
                    ? {
                        status: "error",
                        input: { value: target.value },
                        failure: {
                          kind: "tool",
                          name: "OwnedReadFailure",
                          message: "Actual owned read failure",
                          originSite: "message-store-conversation-activity fixture",
                          classification: "tool-execution",
                        },
                        time: { start, end: start + 1 },
                      }
                    : {
                        status: "completed",
                        input: { value: target.value },
                        title: `Read ${target.value}`,
                        output: `Actual ${target.value}`,
                        metadata: { accepted: target.value },
                        time: { start, end: start + 1 },
                      },
              })
        writes.push({ running, terminal })
      }
      const executions = [first, second, other].map((entry, index) => ({
        sessionID: index === 2 ? parallel.id : reused.id,
        inputMessageID: entry.inputMessageID,
      }))
      const compact = await MessageStore.latestConversationAgentActivityByExecution({ executions })
      const full = await Promise.all(targets.map((target) => MessageStore.parts(target.messageID)))
      const expected = new Map<string, unknown[]>()
      for (let index = 0; index < targets.length; index++) {
        const target = targets[index]!
        const tool = full[index]!.find((part) => part.type === "tool")
        if (!tool || tool.type !== "tool") throw new Error("Canonical full reader did not return the persisted Tool")
        const group = expected.get(target.inputMessageID) ?? []
        group.push({
          id: tool.id,
          messageID: tool.messageID,
          orderKey: tool.orderKey,
          type: "tool",
          tool: tool.tool,
          callID: tool.callID,
          state: tool.state,
        })
        expected.set(target.inputMessageID, group)
      }
      const facts = { targets, writes, full, compact: [...compact], expected: [...expected] }
      const evidence = path.resolve(
        import.meta.dir,
        "../../../../specs/artifacts/2026-10-05-connection-workspace-authority/subagent-history-tools-110/baseline",
      )
      await fs.writeFile(path.join(evidence, `tools-${crypto.randomUUID()}.json`), JSON.stringify(facts, null, 2), {
        flag: "wx",
      })
      console.log(JSON.stringify(facts))
      expect(
        full.map((parts) =>
          parts
            .filter((part) => part.type === "tool")
            .map((part) => ({ id: part.id, type: part.type, orderKey: part.orderKey })),
        ),
      ).toEqual(writes.map(({ terminal }) => [{ id: terminal.id, type: "tool", orderKey: expect.any(String) }]))
      for (const execution of executions)
        expect(compact.get(execution.inputMessageID)).toEqual(expected.get(execution.inputMessageID))
    },
  })
}, 60_000)
