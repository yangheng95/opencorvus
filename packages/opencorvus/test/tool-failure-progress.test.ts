import { afterEach, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { ToolPartOutcomeTable, ToolPartProgressTable } from "@/session/session.sql"
import type { ToolFailureCause } from "@/session/tool-failure-cause"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test.each([undefined, { phase: "stopped", exit: 143 }])(
  "failed Tool reads preserve committed progress and explicit terminal metadata %j across reopen",
  async (terminalMetadata) => {
    await using project = await memoryProject()
    const receipt = await Instance.provide({ directory: project.path, fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Original stopped command progress" })
      const user = await Session.updateMessage({
        id: Identifier.ascending("message"), sessionID: session.id, role: "user", author: "user",
        agent: "chat", model: { providerID: "test", modelID: "tool-facts" }, time: { created: Date.now() },
      })
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"), parentID: user.id, sessionID: session.id,
        role: "assistant", author: "chat", agent: "chat", providerID: "test", modelID: "tool-facts",
        time: { created: Date.now() }, path: { cwd: project.path, root: project.path }, cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      const start = Date.now()
      const running = await Session.updatePart({
        id: Identifier.ascending("part"), sessionID: session.id, messageID: assistant.id,
        type: "tool", tool: "bash", callID: "call_stopped_progress",
        state: { status: "running", input: { command: "original-command" }, time: { start } },
      })
      if (running.type !== "tool") throw new Error("Canonical running Tool Part required")
      const metadata = { output: "已观察中文🙂\n", output_bytes: Buffer.byteLength("已观察中文🙂\n"), phase: "running" }
      const progress = await Session.appendToolProgress({ sessionID: session.id, messageID: assistant.id, partID: running.id, metadata })
      expect(progress.part.state).toMatchObject({ status: "running", metadata })
      const failure: ToolFailureCause = { kind: "MessageAbortedError", name: "MessageAbortedError", message: "Operator stopped this command", originSite: "tool-progress-contract", classification: "llm-activity" }
      const stopped = await Session.updatePart({ ...running, state: {
        status: "error", input: running.state.input, failure,
        ...(terminalMetadata ? { metadata: terminalMetadata } : {}), time: { start, end: start + 1 },
      } })
      if (stopped.type !== "tool") throw new Error("Canonical stopped Tool Part required")
      const expectedMetadata = { ...metadata, ...terminalMetadata }
      expect(stopped.state).toMatchObject({ status: "error", failure, metadata: expectedMetadata })
      const facts = Database.use(db => ({
        progress: db.select().from(ToolPartProgressTable).where(eq(ToolPartProgressTable.request_part_id, running.id)).all(),
        outcome: db.select().from(ToolPartOutcomeTable).where(eq(ToolPartOutcomeTable.request_part_id, running.id)).get(),
      }))
      expect(facts.progress.map(row => row.metadata)).toEqual([metadata])
      expect(facts.outcome!.data).toEqual({
        outcome: "failed", failure, ...(terminalMetadata ? { metadata: terminalMetadata } : {}), time: { end: start + 1 },
      })
      return { sessionID: session.id, messageID: assistant.id, partID: running.id, failure, expectedMetadata }
    } })
    await Instance.disposeAll()
    await Instance.provide({ directory: project.path, fn: async () => {
      const restored = await MessageStore.get({ sessionID: receipt.sessionID, messageID: receipt.messageID })
      expect(restored.parts.find(part => part.id === receipt.partID)).toMatchObject({
        type: "tool", state: { status: "error", failure: receipt.failure, metadata: receipt.expectedMetadata },
      })
    } })
  }, 30_000,
)
