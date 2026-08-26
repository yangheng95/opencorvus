import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import type { Message } from "../../src/session/message"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function userMessage(sessionID: string, text: string): { info: Message.Info; parts: Message.Part[] } {
  const id = Identifier.ascending("message")
  return {
    info: {
      id,
      sessionID,
      role: "user",
      author: "user",
      agent: "chat",
      model: { providerID: "test", modelID: "fork-test" },
      time: { created: Date.now() },
    } as Message.Info,
    parts: [
      {
        type: "text",
        id: Identifier.ascending("part"),
        messageID: id,
        sessionID,
        text,
      } as Message.Part,
    ],
  }
}

function assistantReply(sessionID: string, parentID: string, text: string): { info: Message.Info; parts: Message.Part[] } {
  const id = Identifier.ascending("message")
  return {
    info: {
      id,
      sessionID,
      role: "assistant",
      author: "chat",
      agent: "chat",
      parentID,
      cost: 0,
      path: { cwd: ".", root: "." },
      tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      modelID: "fork-test",
      providerID: "test",
      finish: "stop",
      time: { created: Date.now(), completed: Date.now() },
    } as Message.Info,
    parts: [
      {
        type: "text",
        id: Identifier.ascending("part"),
        messageID: id,
        sessionID,
        text,
      } as Message.Part,
    ],
  }
}

describe("Session fork commits the target and its transcript in one transaction", () => {
  test("a fork's first observable state is the complete bounded transcript with remapped identities", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const source = await Session.create({ kind: "assistant", title: "Fork source" })
        const user1 = userMessage(source.id, "first input")
        await Session.persistMessage(user1)
        const reply1 = assistantReply(source.id, user1.info.id, "first reply")
        await Session.persistMessage(reply1)
        const user2 = userMessage(source.id, "second input")
        await Session.persistMessage(user2)

        const fork = await Session.fork({ sessionID: source.id })

        const forked = await Session.messages({ sessionID: fork.id })
        const sourceAfter = await Session.messages({ sessionID: source.id })
        const forkedUser1 = forked[0]!
        const forkedReply = forked[1]!
        expect({
          parentEdge: fork.parentID,
          kind: fork.kind,
          forkedRoles: forked.map((m) => m.info.role),
          forkedSessionIDs: [...new Set(forked.map((m) => m.info.sessionID))],
          identitiesRemapped: forked.every(
            (m) => !sourceAfter.some((s) => s.info.id === m.info.id),
          ),
          replyParentRemappedToForkedUser:
            forkedReply.info.role === "assistant" && forkedReply.info.parentID === forkedUser1.info.id,
          forkedTexts: forked.map((m) => (m.parts[0] as { text?: string })?.text),
          sourceUntouched: sourceAfter.map((m) => m.info.id),
        }).toEqual({
          parentEdge: source.id,
          kind: "assistant",
          forkedRoles: ["user", "assistant", "user"],
          forkedSessionIDs: [fork.id],
          identitiesRemapped: true,
          replyParentRemappedToForkedUser: true,
          forkedTexts: ["first input", "first reply", "second input"],
          sourceUntouched: [user1.info.id, reply1.info.id, user2.info.id],
        })
      },
    })
  }, 60_000)

  test("a bounded fork stops before the cut message", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const source = await Session.create({ kind: "assistant", title: "Bounded fork source" })
        const user1 = userMessage(source.id, "kept input")
        await Session.persistMessage(user1)
        const reply1 = assistantReply(source.id, user1.info.id, "kept reply")
        await Session.persistMessage(reply1)
        const user2 = userMessage(source.id, "cut input")
        await Session.persistMessage(user2)

        const fork = await Session.fork({ sessionID: source.id, messageID: user2.info.id })
        const forked = await Session.messages({ sessionID: fork.id })
        expect(forked.map((m) => (m.parts[0] as { text?: string })?.text)).toEqual(["kept input", "kept reply"])
      },
    })
  }, 60_000)
})
