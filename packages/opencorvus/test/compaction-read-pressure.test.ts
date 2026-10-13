import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { Message } from "@/session/message"
import { SessionCompaction } from "@/session/compaction"
import { SessionLoop } from "@/session/loop"
import { SessionControl } from "@/session/control"
import { Database } from "@/storage/db"
import { CompactionPolicyCase } from "../script/compaction-policy-case"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

for (const scenario of [
  "crowded-first-page",
  "multi-page",
  "dense-page",
  "failed-note-resume",
  "aborted-note-resume",
] as const) {
  test(`compactor preserves exact evidence through ${scenario} request pressure`, async () => {
    const target = { providerID: "pressure-local", modelID: "gpt-pressure" }
    const output =
      scenario === "dense-page"
        ? "原始证据😀授权需要批准；".repeat(4000)
        : "Original evidence row, verification pending. ".repeat(scenario === "multi-page" ? 2600 : 750)
    let toolPartID = ""
    const pages: Array<{ offset: number; end: number; nextOffset: number | null; content: string; partID: string }> = []
    const requests: any[] = []
    let interrupted = false
    let rememberedNote = ""
    let abortRead: (() => void) | undefined
    const resumeNotes = scenario === "failed-note-resume" || scenario === "aborted-note-resume"
    const finalText =
      "Evidence was read completely. Authorization requires approval; verification remains pending. Original trace PRESSURE-731 remains authoritative."
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const body = (await request.json()) as any
        requests.push(body)
        expect(body).toMatchObject({ model: target.modelID, stream: true })
        if (resumeNotes && requests.length === 3) {
          interrupted = true
          if (scenario === "aborted-note-resume") abortRead!()
          return Response.json(
            { error: { message: "Pressure interruption after saved notes", type: "invalid_request_error" } },
            { status: 400 },
          )
        }
        if (resumeNotes && requests.length === 4) {
          expect(
            body.messages
              .map((message: any) =>
                typeof message.content === "string" ? message.content : JSON.stringify(message.content),
              )
              .join("\n"),
          ).toContain(rememberedNote)
        }
        const results = body.messages.filter((message: any) => message.role === "tool")
        const result = results.length ? JSON.parse(results.at(-1).content) : undefined
        const page = result?.field === "output" ? result : undefined
        if (page && !pages.some((seen) => seen.offset === page.offset)) pages.push(page)
        const cursor = pages.at(-1)?.nextOffset ?? 0
        if (page && page.nextOffset !== null)
          rememberedNote = `Original file Part ${toolPartID} read completely through UTF-16 offset ${cursor}; continue reading at that exact offset. Evidence says verification pending, approval required. Original trace PRESSURE-731. Preserve these facts and source identity in the final checkpoint.`
        const emit = (delta: unknown, finish: string | null) =>
          `data: ${JSON.stringify({ id: `pressure-${requests.length}`, object: "chat.completion.chunk", created: 1, model: target.modelID, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
        const response =
          page?.nextOffset === null
            ? emit({ role: "assistant", content: finalText }, null) + emit({}, "stop")
            : page
              ? emit(
                  {
                    role: "assistant",
                    tool_calls: [
                      {
                        index: 0,
                        id: `call_notes_${requests.length}`,
                        type: "function",
                        function: {
                          name: "SaveCompactionNotes",
                          arguments: JSON.stringify({
                            notes: rememberedNote,
                          }),
                        },
                      },
                    ],
                  },
                  null,
                ) + emit({}, "tool_calls")
              : emit(
                  {
                    role: "assistant",
                    tool_calls: [
                      {
                        index: 0,
                        id: `call_page_${requests.length}`,
                        type: "function",
                        function: {
                          name: "ReadCompactionEvidence",
                          arguments: JSON.stringify({
                            part_id: toolPartID,
                            field: "output",
                            offset: cursor,
                            limit: 30_000,
                          }),
                        },
                      },
                    ],
                  },
                  null,
                ) + emit({}, "tool_calls")
        return new Response(response + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } })
      },
    })
    try {
      await using project = await memoryProject(`compaction-pressure-${scenario}`)
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await Config.updateProjectPatch({
            model: `${target.providerID}/${target.modelID}`,
            compaction: { tail_turns: 0, max_context_tokens: 19_000 },
            provider: {
              [target.providerID]: {
                name: "Read-window stress",
                npm: "@ai-sdk/openai-compatible",
                api: `http://127.0.0.1:${server.port}/v1`,
                models: {
                  [target.modelID]: {
                    name: "Pressure",
                    tool_call: true,
                    modalities: { input: ["text"], output: ["text"] },
                    limit: { context: 256_000, output: 4_000 },
                  },
                },
              },
            },
          })
          const session = await Session.create({ kind: "assistant", title: scenario })
          const authored = await CompactionPolicyCase.history({ target, project: project.path })
          const anchor = await authored.user(
            session.id,
            "Preserve exact evidence and current authorization. Approval remains required.",
          )
          const assistant = await authored.assistant(
            session.id,
            anchor.id,
            "Initial evidence observations. ".repeat(200),
            false,
          )
          if (scenario === "crowded-first-page") {
            for (let index = 0; index < 64; index++)
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: session.id,
                messageID: assistant.id,
                type: "text",
                text: `Observation ${index}: ${"detail ".repeat(280)}`,
              })
          }
          const outputPath = path.join(project.path, "full-pressure-output.txt")
          await fs.writeFile(outputPath, output)
          toolPartID = Identifier.ascending("part")
          await Session.updatePart({
            id: toolPartID,
            sessionID: session.id,
            messageID: assistant.id,
            type: "tool",
            tool: "read",
            callID: "call_original_pressure",
            state: {
              status: "completed",
              input: { filePath: outputPath },
              output: "Stored display preview. Full evidence needs exact reading.",
              title: "Original evidence",
              metadata: { truncated: true, outputPath, traceID: "PRESSURE-731" },
              time: { start: Date.now(), end: Date.now() + 1 },
            },
          })
          await Session.updateMessage({ ...assistant, time: { ...assistant.time, completed: Date.now() } })
          const source = await authored.user(
            session.id,
            "Read the complete original file and retain its current authorization, verification status and trace.",
          )
          const original = await Session.messages({ sessionID: session.id })
          let control = await SessionCompaction.create({ sessionID: session.id, source, auto: true })
          let external = new AbortController()
          abortRead = () => external.abort(new DOMException("Pressure read cancellation", "AbortError"))
          const execute = () =>
            SessionLoop.TestHooks.executeCompactionControl({
              control,
              sessionID: session.id,
              run: async (abort) =>
                SessionCompaction.process(
                  {
                    sessionID: session.id,
                    parentID: source.id,
                    messages: await Session.messages({ sessionID: session.id }),
                    abort: AbortSignal.any([abort, external.signal]),
                    auto: true,
                    model: target,
                  },
                  { prepareProviderTool: SessionLoop.prepareProviderTool },
                ),
            })
          let outcome: unknown, failed: Message.WithParts | undefined
          try {
            outcome = await execute()
          } catch (error) {
            outcome = Message.fromError(error, { providerID: target.providerID })
          }
          if (resumeNotes) {
            expect(interrupted).toBe(true)
            expect(outcome).toMatchObject({
              name: scenario === "aborted-note-resume" ? "MessageAbortedError" : "APIError",
              data: { message: expect.any(String) },
            })
            expect(SessionControl.get(control.id)?.status).toBe("failed")
            failed = (await Session.messages({ sessionID: session.id })).at(-1)!
            expect(
              failed.parts
                .filter((part) => part.type === "tool" && part.tool === "SaveCompactionNotes")
                .map((part) => (part.type === "tool" ? part.state.status : undefined)),
            ).toEqual(["completed"])
            Database.close()
            external = new AbortController()
            control = await SessionCompaction.create({ sessionID: session.id, source, auto: true })
            outcome = await execute()
          }
          Database.close()
          const reopened = await Session.messages({ sessionID: session.id })
          const observed = {
            scenario,
            requests: requests.length,
            sourceCharacters: output.length,
            pages: pages.map(({ offset, end, nextOffset }) => ({ offset, end, nextOffset })),
            outcome,
            control: SessionControl.get(control.id)?.status,
          }
          console.log(JSON.stringify(observed))
          expect(reopened.filter((message) => original.some((item) => item.info.id === message.info.id))).toEqual(
            original,
          )
          expect(await fs.readFile(outputPath, "utf8")).toBe(output)
          expect(outcome).toBe("continue")
          if (failed) expect(reopened.find((message) => message.info.id === failed!.info.id)).toEqual(failed)
          expect(pages.map((page) => page.content).join("")).toBe(output)
          expect(pages.at(-1)?.nextOffset).toBe(null)
          expect(pages.every((page) => page.partID === toolPartID)).toBe(true)
          expect(SessionControl.get(control.id)?.status).toBe("consumed")
          const summary = reopened.findLast((message) => message.info.role === "assistant" && message.info.summary)!
          const compactorParts = reopened
            .filter((message) => message.info.author === "compaction")
            .flatMap((message) => message.parts)
          const reads = compactorParts.filter(
            (part): part is Message.ToolPart & { state: Message.ToolStateCompleted } =>
              part.type === "tool" && part.tool === "ReadCompactionEvidence" && part.state.status === "completed",
          )
          expect(reads.map((part) => JSON.parse(part.state.output).content).join("")).toBe(output)
          const notes = compactorParts.filter(
            (part): part is Message.ToolPart => part.type === "tool" && part.tool === "SaveCompactionNotes",
          )
          expect(notes.length).toBe(pages.length - 1)
          for (const note of notes) {
            expect(note.state.status).toBe("completed")
            if (note.state.status === "completed")
              expect(JSON.parse(note.state.output)).toMatchObject({
                status: "saved",
                notes_call_id: note.callID,
                source_reads: [
                  expect.objectContaining({
                    partID: toolPartID,
                    field: "output",
                    offsetUnit: "utf16_code_units",
                    ranges: expect.any(Array),
                    readerCalls: expect.any(Array),
                  }),
                ],
              })
          }
          expect(await CompactionPolicyCase.checkCheckpoint(session.id, summary.info.id)).toMatchObject({
            status: "valid_checkpoint",
            processExitCode: 0,
          })
        },
      })
    } finally {
      await server.stop(true)
    }
  }, 90_000)
}
