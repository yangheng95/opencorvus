import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { Bus } from "../../src/bus"
import { PermissionAuthority } from "../../src/permission/authority"
import { Identifier } from "../../src/id/id"
import { HostProcessingFaultError } from "../../src/llm/host-fault"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Message } from "../../src/session/message"
import { MessageStore } from "../../src/session/message-store"
import { SessionLoop } from "../../src/session/loop"
import { completedToolExecutionResult } from "../../src/session/tool-outcome-facts"
import { recoverCompletedToolResult } from "../../src/session/tool-result-recovery"
import { Database, sql } from "../../src/storage/db"
import { PartTable } from "../../src/session/session.sql"
import { completedReadResult } from "../fixture/completed-read-result"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

async function readScope(mode: "full_access" | "ask", body: (value: Awaited<ReturnType<typeof completedReadResult>>) => Promise<void>) {
  await using project = await memoryProject()
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw new Error("Isolated test runtime required")
  const external = await createManagedTemporaryDirectory(path.join(root, "fixtures"), "result-source-")
  try {
    const filePath = path.join(external, "result.txt")
    await fs.writeFile(filePath, "actual successful result\nsecond line\n")
    await Instance.provide({ directory: project.path, fn: async () => body(await completedReadResult({ mode, filePath })) })
  } finally { await removeManagedDirectoryTree(external) }
}

async function expectComplete(value: Awaited<ReturnType<typeof completedReadResult>>) {
  const message = await MessageStore.get({ sessionID: value.session.id, messageID: value.assistant.id })
  expect(message.parts.filter((part) => part.type === "tool")).toMatchObject([
    { id: value.part.id, state: { status: "completed", output: value.result.output } },
  ])
  expect(message.parts.filter((part) => part.type === "source-file")).toMatchObject(value.result.sources!)
  expect(value.executeCount()).toBe(1)
  return message
}

for (const mode of ["full_access", "ask"] as const) {
  test(`${mode}: source insert failure keeps the result retryable with its successful receipt`, async () => {
    await readScope(mode, async (value) => {
      Database.use((db) => db.run(sql.raw(`CREATE TEMP TRIGGER result_source_cut BEFORE INSERT ON part
        WHEN json_extract(NEW.data, '$.type') = 'source-file'
        BEGIN SELECT RAISE(ABORT, 'SOURCE_RESULT_COMMIT_CUT'); END`)))
      try {
        await expect(value.processor.completeRecoveredToolPart({
          toolCallID: value.callID, toolInput: value.args, output: value.result,
        })).rejects.toThrow("SOURCE_RESULT_COMMIT_CUT")
      } finally { Database.use((db) => db.run(sql.raw("DROP TRIGGER result_source_cut"))) }
      const interrupted = await MessageStore.parts(value.assistant.id)
      expect(interrupted.find((part) => part.id === value.part.id)).toMatchObject({ state: { status: "running" } })
      expect(Database.use((db) => completedToolExecutionResult(db, value.part))?.value).toEqual(value.result)
      await value.processor.completeRecoveredToolPart({ toolCallID: value.callID, toolInput: value.args, output: value.result })
      await expectComplete(value)
    })
  })

  test(`${mode}: interruption recovery preserves the successful output and source`, async () => {
    await readScope(mode, async (value) => {
      await SessionLoop.terminalizeRecoveredIncompleteAssistant(value.session.id)
      await PermissionAuthority.resumeApprovedContinuations()
      const first = await expectComplete(value)
      await SessionLoop.terminalizeRecoveredIncompleteAssistant(value.session.id)
      expect(await MessageStore.get({ sessionID: value.session.id, messageID: value.assistant.id })).toEqual(first)
    })
  })
}

test("an accepted result settles its Source under an already completed assistant", async () => {
  await readScope("full_access", async (value) => {
    const completed = await Session.updateMessage({ ...value.assistant, finish: "stop", time: { ...value.assistant.time, completed: Date.now() } })
    await recoverCompletedToolResult(value.part)
    const after = await expectComplete(value)
    expect(after.info).toEqual(completed)
  })
})

test("concurrent recovery publishes the same complete canonical result", async () => {
  await readScope("full_access", async (value) => {
    const results = await Promise.all([recoverCompletedToolResult(value.part), recoverCompletedToolResult(value.part)])
    const message = await expectComplete(value)
    expect(results.map((part) => part?.id)).toEqual([value.part.id, value.part.id])
    expect(message.parts.map((part) => part.type)).toEqual(["tool", "source-file"])
  })
})

test("the Tool completion publication observes its complete Source transaction", async () => {
  await readScope("full_access", async (value) => {
    const observations: string[][] = []
    const stop = Bus.subscribe(Message.Event.PartUpdated, async ({ properties }) => {
      if (properties.part.id !== value.part.id || properties.part.type !== "tool" || properties.part.state.status !== "completed") return
      observations.push((await MessageStore.parts(value.assistant.id)).map((part) => part.type))
    })
    try {
      await recoverCompletedToolResult(value.part)
      await Database.awaitEffectIdle(10_000)
      expect(observations).toEqual([["tool", "source-file"]])
    } finally { stop() }
  })
})

test("forked Source bindings point to the copied Tool request", async () => {
  await readScope("full_access", async (value) => {
    await recoverCompletedToolResult(value.part)
    await Session.updateMessage({ ...value.assistant, finish: "stop", time: { ...value.assistant.time, completed: Date.now() } })
    const fork = await Session.fork({ sessionID: value.session.id })
    const messages = await Session.messages({ sessionID: fork.id })
    const assistant = messages.find((message) => message.info.role === "assistant")!
    const tool = assistant.parts.find((part) => part.type === "tool")!
    expect(assistant.parts.find((part) => part.type === "source-file")).toMatchObject({
      sessionID: fork.id, messageID: assistant.info.id, toolPartID: tool.id, path: value.args.filePath,
    })
    expect(new Set([value.part.id, tool.id]).size).toBe(2)
  })
})

test("display ownership errors preserve the accepted request and successful receipt", async () => {
  await readScope("full_access", async (value) => {
    await expect(value.processor.completeRecoveredToolPart({
      toolCallID: value.callID, toolInput: value.args, output: { ...value.result, display: [{
        id: Identifier.ascending("part"), type: "interactive-artifact", artifactID: "ownership-contract",
        sessionID: value.session.id, messageID: Identifier.ascending("message"),
      }] },
    })).rejects.toBeInstanceOf(HostProcessingFaultError)
    expect((await MessageStore.parts(value.assistant.id)).find((part) => part.id === value.part.id))
      .toMatchObject({ state: { status: "running" } })
    await recoverCompletedToolResult(value.part)
    await expectComplete(value)
  })
})

test("a Source binding is validated by both the writer and SQLite", async () => {
  await readScope("full_access", async (value) => {
    await recoverCompletedToolResult(value.part)
    const source = { ...value.result.sources![0], id: Identifier.ascending("part"),
      sessionID: value.session.id, messageID: value.assistant.id, toolPartID: Identifier.ascending("part") }
    await expect(Session.updatePart(source)).rejects.toBeInstanceOf(HostProcessingFaultError)
    const { id, sessionID: _session, messageID, ...data } = source
    expect(() => Database.use((db) => db.insert(PartTable).values({
      id, message_id: messageID, data, time_created: Date.now(),
    }).run())).toThrow("Tool result binding requires its completed invocation")
    await expectComplete(value)
  })
})

test("a durable result resolves only for the stored Tool call identity", async () => {
  await readScope("full_access", async (value) => {
    expect(() => Database.use((db) => completedToolExecutionResult(db, { ...value.part, callID: "different-call" })))
      .toThrow("has no accepted invocation owner")
    expect(Database.use((db) => completedToolExecutionResult(db, value.part))?.value).toEqual(value.result)
  })
})
