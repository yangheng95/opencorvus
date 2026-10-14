import { afterEach, describe, expect, test } from "bun:test"
import { SessionCompaction } from "@/session/compaction"
import { CompactionEvidenceReader } from "@/session/compaction-evidence-reader"
import { Message } from "@/session/message"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import fs from "node:fs/promises"
import path from "node:path"

afterEach(resetMemoryDatabase)

function history() {
  const info = {
    id: "msg_evidence",
    sessionID: "ses_evidence",
    role: "user",
    author: "user",
    agent: "chat",
    model: { providerID: "local", modelID: "evidence" },
    time: { created: 1 },
  } as Message.User
  const text = "prefix ".repeat(5000) + "CURRENT_CONSTRAINT=keep-中文-😀" + " suffix".repeat(5000)
  const input = { command: "prefix".repeat(500) + "EXACT_INPUT=42" + "suffix".repeat(500) }
  const parts: Message.Part[] = [
    { id: "prt_text", messageID: info.id, sessionID: info.sessionID, type: "text", text },
    {
      id: "prt_tool",
      messageID: info.id,
      sessionID: info.sessionID,
      type: "tool",
      tool: "read",
      callID: "call_exact",
      state: {
        status: "completed",
        input,
        output: "Evidence verified at line 17",
        title: "Evidence",
        metadata: { traceID: "trace_exact" },
        time: { start: 1, end: 2 },
      },
    },
    {
      id: "prt_error",
      messageID: info.id,
      sessionID: info.sessionID,
      type: "tool",
      tool: "read",
      callID: "call_failure",
      state: {
        status: "error",
        input: { path: "report" },
        failure: {
          message: "read failed",
          name: "EvidenceFailure",
          kind: "EvidenceFailure",
          originSite: "read",
          classification: "tool-execution",
        },
        metadata: { traceID: "trace_failure" },
        time: { start: 3, end: 4 },
      },
    },
  ]
  return { messages: [{ info, parts }], text, input }
}

async function read(reader: ReturnType<typeof CompactionEvidenceReader.create>, input: Record<string, unknown>) {
  const result = (await reader.execute!(input, {
    toolCallId: "call_reader",
    context: {},
    messages: [],
    abortSignal: new AbortController().signal,
  })) as { output: string }
  return JSON.parse(result.output)
}

describe("compaction evidence fidelity", () => {
  test("recovers a persisted megabyte file result across database reopen with isolated project sources", async () => {
    await using projectA = await memoryProject("compaction-evidence-a")
    await using projectB = await memoryProject("compaction-evidence-b")
    const ids: string[] = []
    for (const [index, project] of [projectA, projectB].entries()) {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.create({ kind: "assistant", title: "Persisted evidence pressure" })
          const fixture = history()
          const source = await Session.updateMessage({
            ...fixture.messages[0]!.info,
            id: Identifier.ascending("message"),
            sessionID: session.id,
          })
          const assistant = Message.Assistant.parse(
            await Session.updateMessage({
              id: Identifier.ascending("message"),
              sessionID: session.id,
              parentID: source.id,
              role: "assistant",
              author: "chat",
              agent: "chat",
              time: { created: Date.now() },
              path: { cwd: project.path, root: project.path },
              modelID: "evidence",
              providerID: "local",
              cost: 0,
              tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            }),
          )
          const full = `project-${index}:中文😀\n`.repeat(60_000)
          const outputPath = path.join(project.path, "exact-result.txt")
          await fs.writeFile(outputPath, full)
          const partID = Identifier.ascending("part")
          ids.push(partID)
          await Session.updatePart({
            id: partID,
            sessionID: session.id,
            messageID: assistant.id,
            type: "tool",
            tool: "read",
            callID: `call_${index}`,
            state: {
              status: "completed",
              input: { path: outputPath },
              output: "Stored preview only",
              title: "Large evidence",
              metadata: { outputPath, truncated: true, traceID: `trace_${index}` },
              time: { start: 1, end: 2 },
            },
          })
          await Session.updateMessage({
            ...assistant,
            finish: "stop",
            time: { ...assistant.time, completed: Date.now() },
          })
          Database.close()
          const stored = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
          await CompactionEvidenceReader.assertSources([stored])
          const reader = CompactionEvidenceReader.create([stored])
          let offset = 0
          let restored = ""
          let pages = 0
          while (true) {
            const page = await read(reader, { part_id: partID, field: "output", offset, limit: 30_000 })
            expect(page).toMatchObject({
              source: "truncation-file",
              callID: `call_${index}`,
              originalRole: "assistant",
              totalChars: full.length,
            })
            restored += page.content
            pages++
            if (page.nextOffset === null) break
            offset = page.nextOffset
          }
          expect(restored).toBe(full)
          expect(pages).toBe(Math.ceil(full.length / 30_000))
          if (index === 1)
            await expect(
              read(reader, { part_id: ids[0], field: "output", offset: 0, limit: 100 }),
            ).rejects.toMatchObject({ code: "COMPACTION_EVIDENCE_INVALID" })
        },
      })
    }
  })
  test("exposes exact text, input and trace locators in the bounded transcript", () => {
    const { messages } = history()
    const transcript = JSON.stringify(
      SessionCompaction.TestHooks.createCompactionTranscript(messages, {
        id: "msg_compactor_evidence",
        sessionID: messages[0]!.info.sessionID,
      }).render({
        system: [],
        tools: {},
        promptText: "Summarize the evidence.",
        maxTokens: 2_000,
      }),
    )
    for (const value of [
      "prt_text",
      "prt_tool",
      "call_exact",
      "prt_error",
      "call_failure",
      "trace_exact",
      "trace_failure",
    ])
      expect(transcript).toContain(value)
  })

  test("recovers omitted middle text and tool input by exact Part and field", async () => {
    const { messages, text, input } = history()
    const reader = CompactionEvidenceReader.create(messages)
    const recovered = await read(reader, { part_id: "prt_text", field: "text", offset: 34_900, limit: 300 })
    expect(recovered).toMatchObject({
      partID: "prt_text",
      messageID: "msg_evidence",
      field: "text",
      offset: 34_900,
      content: text.slice(34_900, 35_200),
      nextOffset: 35_200,
    })
    const request = await read(reader, { part_id: "prt_tool", field: "input", offset: 0, limit: 30_000 })
    expect(request.content).toBe(JSON.stringify(input))
    const metadata = await read(reader, { part_id: "prt_tool", field: "metadata", offset: 0, limit: 30_000 })
    expect(JSON.parse(metadata.content)).toEqual({ part: {}, state: { traceID: "trace_exact" } })
  })

  test("returns exact output, typed failure and precise pagination endpoints", async () => {
    const { messages } = history()
    const reader = CompactionEvidenceReader.create(messages)
    const output = await read(reader, { part_id: "prt_tool", field: "output", offset: 0, limit: 30_000 })
    expect(output).toMatchObject({ callID: "call_exact", content: "Evidence verified at line 17", nextOffset: null })
    const failure = await read(reader, { part_id: "prt_error", field: "failure", offset: 0, limit: 30_000 })
    expect(JSON.parse(failure.content)).toEqual({
      message: "read failed",
      name: "EvidenceFailure",
      kind: "EvidenceFailure",
      originSite: "read",
      classification: "tool-execution",
    })
  })

  test("pages Unicode evidence with exact code-unit cursors and original provenance", async () => {
    const { messages } = history()
    const text = "中😀文🦉 end"
    messages[0]!.parts[0] = { ...(messages[0]!.parts[0] as Message.TextPart), text }
    const reader = CompactionEvidenceReader.create(messages)
    let offset = 0
    let restored = ""
    const cursors: Array<number | null> = []
    while (true) {
      const page = await read(reader, { part_id: "prt_text", field: "text", offset, limit: 2 })
      expect(page).toMatchObject({ originalRole: "user", originalAuthor: "user", offset })
      expect(page.content.isWellFormed()).toBe(true)
      restored += page.content
      cursors.push(page.nextOffset)
      if (page.nextOffset === null) break
      offset = page.nextOffset
    }
    expect(restored).toBe(text)
    expect(cursors).toEqual([3, 6, 8, null])
  })

  test.each([
    { part_id: "prt_other_session", field: "output", offset: 0 },
    { part_id: "prt_text", field: "output", offset: 0 },
    { part_id: "prt_tool", field: "failure", offset: 0 },
    { part_id: "prt_tool", field: "output", offset: 1000 },
    { part_id: "prt_text", field: "text", offset: history().text.indexOf("😀") + 1 },
  ])("returns the explicit evidence error contract for $part_id/$field/$offset", async (input) => {
    const reader = CompactionEvidenceReader.create(history().messages)
    await expect(read(reader, { ...input, limit: 100 })).rejects.toMatchObject({
      name: "CompactionEvidenceReadError",
      code: "COMPACTION_EVIDENCE_INVALID",
    })
  })
})
