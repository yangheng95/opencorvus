import { afterEach, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("reads one exact persisted Tool Part by canonical Session, Message and Part identity", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Exact Tool Part read" })
      const message = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "assistant",
        author: "test-agent",
        time: { created: 1 },
        parentID: Identifier.ascending("message"),
        modelID: "test-model",
        providerID: "test-provider",
        mode: "test",
        agent: "test-agent",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { total: 3, input: 1, output: 1, reasoning: 1, cache: { read: 0, write: 0 } },
      })
      const output = "exact persisted output\n".repeat(400)
      const target = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: message.id,
        type: "tool",
        callID: Identifier.ascending("tool"),
        tool: "artifact_read",
        state: {
          status: "completed",
          input: { locator: "artifact://deliverable/report.md" },
          output,
          title: "Read report",
          metadata: { source: "test" },
          time: { start: 1, end: 2 },
        },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: message.id,
        type: "text",
        text: "Sibling answer",
      })

      const response = await Server.App().request(
        `/session/${session.id}/message/${message.id}/part/${target.id}`,
        { headers: { "x-opencorvus-directory": project.path } },
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        ...target,
        state: {
          status: "completed",
          input: { locator: "artifact://deliverable/report.md" },
          output,
          title: "Read report",
          metadata: { source: "test" },
          time: { start: 1, end: 2 },
        },
      })
    },
  })
}, 30_000)
