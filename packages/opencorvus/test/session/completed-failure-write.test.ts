import { afterEach, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

for (const entry of ["import", "persist"] as const) {
  test(`${entry} atomically retains completed assistant failure evidence and authored text`, async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Failure history" })
      const parentID = Identifier.ascending("message")
      const id = Identifier.ascending("message")
      const now = Date.now()
      const user: Message.User = { id: parentID, sessionID: session.id, role: "user", author: "user", agent: "chat", model: { providerID: "test", modelID: "test" }, time: { created: now } }
      await Session.saveMessage(user)
      const error = { name: "APIError" as const, data: { message: "Provider unavailable", isRetryable: false } }
      const anchor = { session_id: session.id, assistant_message_id: id, error_name: error.name }
      const info: Message.Assistant = {
        id, sessionID: session.id, role: "assistant", author: "chat", agent: "chat", parentID,
        time: { created: now + 1, completed: now + 2 }, finish: "error", error, failureOccurrence: anchor,
        convergenceFailure: { failure_occurrence: anchor, unconverged_part_ids: [], write_errors: [], inspection_error: "Diagnostic inspection failed" },
        observationFailures: [{ phase: "snapshot_patch", message: "Snapshot observation failed" }],
        modelID: "test", providerID: "test", cost: 0, path: { cwd: project.path, root: project.path },
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      }
      const part: Message.TextPart = { id: Identifier.ascending("part"), messageID: id, sessionID: session.id, type: "text", text: "Partial answer preserved" }
      if (entry === "import") await Session.importSnapshot({ info: session, messages: [{ info, parts: [part] }] })
      else await Session.persistMessage({ info, parts: [part] })
      const stored = (await Session.messages({ sessionID: session.id })).find((message) => message.info.id === id)!
      expect(stored.info).toMatchObject(info)
      expect(stored.parts).toMatchObject([part])
    } })
  })
}
