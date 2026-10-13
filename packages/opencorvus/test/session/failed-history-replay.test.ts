import { afterEach, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { SessionLoop } from "@/session/loop"
import { SessionCompaction } from "@/session/compaction"
import { SessionControl } from "@/session/control"
import { MessageStore } from "@/session/message-store"
import { SessionMemory } from "@/memory/session-memory"
import { SessionPromptState } from "@/session/prompt/state"
import { Database } from "@/storage/db"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

test("real streamed Session replay and compaction retain a failed attempt's evidence in independent projects", async () => {
  const target = { providerID: "failed-history-local", modelID: "replay" }
  const requests: Array<{ key: string; body: any }> = []
  const cases = new Map<
    string,
    {
      failureID: string
      trace: string
      overlap: boolean
      summaryStarted: ReturnType<typeof Promise.withResolvers<void>>
      releaseSummary: ReturnType<typeof Promise.withResolvers<void>>
    }
  >()
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const key = new URL(request.url).pathname.split("/")[1]!
      const state = cases.get(key)
      if (!state) throw new Error("Unexpected isolated project request")
      const body = (await request.json()) as any
      requests.push({ key, body })
      console.log(JSON.stringify({ scenario: "failed-history-wire", key, request: requests.length, model: body.model }))
      if (body.tools?.some((tool: any) => tool.function?.name === "ReadCompactionEvidence")) {
        state.summaryStarted.resolve()
        if (state.overlap) await state.releaseSummary.promise
      }
      const text = `Retained ${state.trace}; failed assistant ${state.failureID} has ProcessExecutionInterruptedError. Its read result is committed; validation remains pending and deployment is denied.`
      const event = (delta: unknown, finish: string | null) =>
        `data: ${JSON.stringify({
          id: `chatcmpl-${key}-${requests.length}`,
          object: "chat.completion.chunk",
          created: 1,
          model: target.modelID,
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`
      return new Response(event({ role: "assistant", content: text }, null) + event({}, "stop") + "data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      })
    },
  })
  installDefaultControlPlaneToolLoaders()
  try {
    for (const key of ["project-one", "project-two"]) {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await Config.updateProjectPatch({
            model: `${target.providerID}/${target.modelID}`,
            small_model: `${target.providerID}/${target.modelID}`,
            enabled_providers: [target.providerID],
            compaction: { tail_turns: 0, max_context_tokens: 256_000 },
            provider: {
              [target.providerID]: {
                name: "Isolated failure replay",
                npm: "@ai-sdk/openai-compatible",
                api: `http://127.0.0.1:${server.port}/${key}/v1`,
                models: {
                  [target.modelID]: {
                    name: "Replay",
                    tool_call: true,
                    modalities: { input: ["text"], output: ["text"] },
                    limit: { context: 1_000_000, output: 16_000 },
                  },
                },
              },
            },
          })
          const session = await Session.create({ kind: "assistant", title: "Failed attempt context replay" })
          const user = async (text: string) => {
            const info = await Session.updateMessage({
              id: Identifier.ascending("message"),
              sessionID: session.id,
              role: "user",
              author: "user",
              agent: "chat",
              model: target,
              time: { created: Date.now() },
            })
            if (info.role !== "user") throw new Error("Expected user input")
            await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: session.id,
              messageID: info.id,
              type: "text",
              text,
            })
            return info
          }
          const anchor = await user("Maintain the evidence record. Deployment is denied; validation remains pending.")
          const failed = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            parentID: anchor.id,
            acceptedInputMessageIDs: [anchor.id],
            role: "assistant",
            author: "chat",
            agent: "chat",
            providerID: target.providerID,
            modelID: target.modelID,
            time: { created: Date.now() },
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          })
          if (failed.role !== "assistant") throw new Error("Expected original assistant")
          const trace = `TRACE-FAILED-${key}`
          const callID = `call_failed_history_${key}`
          const caseState = {
            failureID: failed.id,
            trace,
            overlap: key === "project-two",
            summaryStarted: Promise.withResolvers<void>(),
            releaseSummary: Promise.withResolvers<void>(),
          }
          cases.set(key, caseState)
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: failed.id,
            type: "step-start",
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: failed.id,
            type: "text",
            text: `Source ${trace} was read. Further validation is unfinished. `.repeat(700),
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: failed.id,
            type: "tool",
            tool: "read",
            callID,
            state: {
              status: "completed",
              input: { filePath: "evidence.txt" },
              output: JSON.stringify({ trace, next_offset: 17031, evidence: "committed-read" }),
              title: "Original evidence",
              metadata: { traceID: trace },
              time: { start: 1, end: 2 },
            },
          })
          const error = new Message.ProcessExecutionInterruptedError({
            message: "Original process interrupted after the committed read",
          }).toObject()
          await Session.updateMessage({
            ...failed,
            error,
            finish: "error",
            time: { ...failed.time, completed: Date.now() },
            failureOccurrence: { session_id: session.id, assistant_message_id: failed.id, error_name: error.name },
          })
          const original = await MessageStore.get({ sessionID: session.id, messageID: failed.id })
          const resume = await user("Continue from the established record.")
          Database.close()
          const reply = await SessionLoop.loop({ sessionID: session.id, result_mode: "reply" })
          expect(reply.info).toMatchObject({ role: "assistant", author: "chat", finish: "stop", parentID: resume.id })
          const first = requests.filter((row) => row.key === key)[0]!.body
          expect(first).toMatchObject({ model: target.modelID, stream: true })
          const diagnosticText = first.messages
            .filter((m: any) => m.role === "assistant")
            .map((m: any) => m.content ?? "")
            .join("\n")
          const metadata = diagnosticText.match(/<assistant-diagnostics>([\s\S]*?)<\/assistant-diagnostics>/)?.[1]
          expect(metadata && JSON.parse(metadata)).toMatchObject({
            messageID: failed.id,
            sessionID: session.id,
            author: "chat",
            finish: "error",
            acceptedInputMessageIDs: [anchor.id],
            error,
            failureOccurrence: original.info.role === "assistant" ? original.info.failureOccurrence : undefined,
          })
          expect(first.messages).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                role: "tool",
                tool_call_id: callID,
                content: JSON.stringify({ trace, next_offset: 17031, evidence: "committed-read" }),
              }),
            ]),
          )
          const control = await SessionCompaction.create({
            sessionID: session.id,
            source: resume,
            auto: false,
            model: target,
          })
          const summaryPromise = SessionLoop.loop({
            sessionID: session.id,
            result_mode: "summary",
            summary_source_message_id: resume.id,
            summary_control_id: control.id,
          })
          let next: Message.User | undefined
          let overlappingReply: Promise<Message.WithParts> | undefined
          if (caseState.overlap) {
            await Promise.race([
              caseState.summaryStarted.promise,
              summaryPromise.then(() => {
                throw new Error("Summary settled before the real Provider barrier")
              }),
            ])
            next = await user("Continue the unfinished verification.")
            const attached = Promise.withResolvers<void>()
            overlappingReply = SessionPromptState.withPromptOwnerCapture(
              session.id,
              () => attached.resolve(),
              () => SessionLoop.loop({ sessionID: session.id, result_mode: "reply", reply_to_message_id: next!.id }),
            )
            await Promise.race([
              attached.promise,
              overlappingReply.then(() => {
                throw new Error("Continuation settled before attaching to the blocked summary owner")
              }),
            ])
            caseState.releaseSummary.resolve()
          }
          const summary = await summaryPromise
          expect(summary.info).toMatchObject({ role: "assistant", author: "compaction", summary: true, finish: "stop" })
          expect(SessionControl.get(control.id)).toMatchObject({
            status: "consumed",
            payload: { result_summary_message_id: summary.info.id },
          })
          const summaryText = SessionMemory.continuationText(summary.parts)
          expect(await SessionMemory.read(session.id)).toMatchObject({
            sourceMessageID: summary.info.id,
            content: summaryText,
          })
          expect(summaryText).toContain(trace)
          expect(summaryText).toContain(error.name)
          if (!caseState.overlap) {
            const repeated = await SessionCompaction.create({
              sessionID: session.id,
              source: resume,
              auto: false,
              model: target,
            })
            const reused = await SessionLoop.loop({
              sessionID: session.id,
              result_mode: "summary",
              summary_source_message_id: resume.id,
              summary_control_id: repeated.id,
            })
            expect(reused.info.id).toBe(summary.info.id)
            expect(SessionControl.get(repeated.id)).toMatchObject({
              status: "consumed",
              payload: { result_summary_message_id: summary.info.id },
            })
          }
          next ??= await user("Continue the unfinished verification.")
          let continued: Message.WithParts
          try {
            continued = await (overlappingReply ??
              SessionLoop.loop({ sessionID: session.id, result_mode: "reply", reply_to_message_id: next.id }))
          } catch (failure) {
            console.log(
              JSON.stringify({
                scenario: "failed-history-continuation-failure",
                key,
                error: String(failure),
                control: SessionControl.get(control.id),
                summaryID: summary.info.id,
                nextInputID: next.id,
                requests: requests.filter((row) => row.key === key).length,
                messages: (await Session.messages({ sessionID: session.id })).map((message) => message.info),
              }),
            )
            throw failure
          }
          expect(continued.info).toMatchObject({ parentID: next.id, finish: "stop" })
          const seen = requests.filter((row) => row.key === key)
          expect(seen.map((row) => row.body.stream)).toEqual([true, true, true])
          const compactorText = seen[1]!.body.messages.map((message: any) => message.content ?? "").join("\n")
          const encodedDiagnostics = compactorText.match(
            /<assistant-diagnostics>([\s\S]*?)<\/assistant-diagnostics>/,
          )?.[1]
          const compactorDiagnostics =
            encodedDiagnostics &&
            JSON.parse(
              encodedDiagnostics
                .replaceAll("&quot;", '"')
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("&amp;", "&"),
            )
          expect(compactorDiagnostics).toMatchObject({ messageID: failed.id, sessionID: session.id, error })
          expect(seen[2]!.body.messages).toEqual(
            expect.arrayContaining([expect.objectContaining({ role: "assistant", content: summaryText })]),
          )
          expect(await MessageStore.get({ sessionID: session.id, messageID: failed.id })).toEqual(original)
          console.log(
            JSON.stringify({
              scenario: "failed-history-replayed",
              key,
              sessionID: session.id,
              failedMessageID: failed.id,
              summaryMessageID: summary.info.id,
              requestCount: seen.length,
              trace,
              overlap: caseState.overlap,
              observedDiagnostics: metadata && JSON.parse(metadata),
              compactorDiagnostics,
              observedToolResult: first.messages.find(
                (message: any) => message.role === "tool" && message.tool_call_id === callID,
              ),
              summary: summaryText,
            }),
          )
        },
      })
      await Instance.disposeAll()
    }
  } finally {
    for (const state of cases.values()) state.releaseSummary.resolve()
    await Instance.disposeAll()
    await server.stop(true)
  }
})
