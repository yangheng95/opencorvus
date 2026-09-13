import { afterEach, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("freezes every user Part in an accepted multi-Message reply batch", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Accepted batch" })
      const first = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "user",
        author: "user",
        time: { created: Date.now() },
        agent: "work",
        model: { providerID: "test", modelID: "accepted-batch" },
      })
      const firstPartID = Identifier.ascending("part")
      await Session.updatePart({
        id: firstPartID,
        sessionID: session.id,
        messageID: first.id,
        type: "text",
        text: "Original complete task.",
      })
      const second = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "user",
        author: "user",
        time: { created: Date.now() },
        agent: "work",
        model: { providerID: "test", modelID: "accepted-batch" },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: second.id,
        type: "text",
        text: "Proceed as discussed.",
      })
      await Session.beginAssistantReplyWithCommit(
        {
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "assistant",
          author: "work",
          parentID: second.id,
          acceptedInputMessageIDs: [first.id, second.id],
          time: { created: Date.now() + 1 },
          agent: "work",
          providerID: "test",
          modelID: "accepted-batch",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        },
        () => {},
      )

      const error = `Task-root causal Message ${first.id} is immutable`
      await expect(
        Session.updatePartData({ partID: firstPartID, data: { type: "text", text: "Changed task." } }),
      ).rejects.toThrow(error)
      await expect(
        Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: first.id,
          type: "text",
          text: "Late requirement.",
        }),
      ).rejects.toThrow(error)
      await expect(
        Session.removePart({ sessionID: session.id, messageID: first.id, partID: firstPartID }),
      ).rejects.toThrow(error)
    },
  })
})
