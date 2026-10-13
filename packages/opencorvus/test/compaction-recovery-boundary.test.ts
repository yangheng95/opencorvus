import { afterEach, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { SessionCompaction } from "@/session/compaction"
import { SessionControl } from "@/session/control"
import { SessionLoop } from "@/session/loop"
import { Database } from "@/storage/db"
import { CompactionPolicyCase } from "../script/compaction-policy-case"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

for (const overflow of [false, true]) {
  for (const repeated of [false, true]) {
    test(`a recovered ${repeated ? "repeated" : "first"} checkpoint preserves later accepted input (overflow=${overflow})`, async () => {
      const target = { providerID: "compaction-recovery-boundary", modelID: "checkpoint" }
      const requests: any[] = []
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          const body = await request.json()
          requests.push(body)
          const chunk = (delta: unknown, finish: string | null) =>
            `data: ${JSON.stringify({ id: "recovery-summary", object: "chat.completion.chunk", created: 1, model: target.modelID, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
          return new Response(
            chunk(
              {
                role: "assistant",
                content:
                  "Prior work inspected TRACE-RECOVERY-731. Preserve original source identities and continue the latest accepted input.",
              },
              null,
            ) +
              chunk({}, "stop") +
              "data: [DONE]\n\n",
            { headers: { "content-type": "text/event-stream" } },
          )
        },
      })
      try {
        await using project = await memoryProject()
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            await Config.updateProjectPatch({
              model: `${target.providerID}/${target.modelID}`,
              enabled_providers: [target.providerID],
              compaction: { tail_turns: 0 },
              provider: {
                [target.providerID]: {
                  name: "Local recovery boundary transport",
                  npm: "@ai-sdk/openai-compatible",
                  api: `http://127.0.0.1:${server.port}/v1`,
                  models: {
                    [target.modelID]: {
                      name: "Checkpoint",
                      tool_call: true,
                      modalities: { input: ["text"], output: ["text"] },
                      limit: { context: 1_000_000, output: 16_000 },
                    },
                  },
                },
              },
            })
            const session = await Session.create({ kind: "assistant", title: "Recovery input boundary" })
            const history = await CompactionPolicyCase.history({ target, project: project.path })
            const source = await history.user(session.id, "Inspect prior evidence and preserve its trace.")
            await history.assistant(session.id, source.id, "TRACE-RECOVERY-731 observed prior work. ".repeat(1000))
            // Read after control ownership has been acquired, as the production loop does.
            const runControl = async () => {
              const control = await SessionCompaction.create({
                sessionID: session.id,
                source,
                auto: true,
                overflow,
                model: target,
              })
              await SessionLoop.TestHooks.executeCompactionControl({
                sessionID: session.id,
                control,
                run: async (signal) =>
                  SessionCompaction.process(
                    {
                      sessionID: session.id,
                      parentID: source.id,
                      messages: await Message.filterCompacted(MessageStore.stream(session.id)),
                      abort: signal,
                      auto: true,
                      overflow,
                      model: target,
                    },
                    { prepareProviderTool: SessionLoop.prepareProviderTool },
                  ),
              })
              expect(SessionControl.get(control.id)).toMatchObject({ status: "consumed" })
              return SessionControl.get(control.id)!.payload.result_summary_message_id as string
            }
            if (repeated) {
              await runControl()
              await history.assistant(session.id, source.id, "Additional confirmed prior evidence. ".repeat(1000))
            }
            const partial = await history.assistant(
              session.id,
              source.id,
              "Persisted unfinished compaction evidence.",
              false,
            )
            const helper = await Session.updateMessage({
              ...partial,
              author: "compaction",
              agent: "compaction",
              finish: undefined,
              time: { created: partial.time.created },
            })
            const original = await MessageStore.get({ sessionID: session.id, messageID: helper.id })
            const accepted = await history.user(
              session.id,
              "The current accepted input owns continuation: retain this exact message and correction.",
            )
            const correction = await history.user(session.id, "Later correction: keep both accepted inputs in order.")
            const summaryID = await runControl()
            Database.close()
            const projected = await Message.filterCompacted(MessageStore.stream(session.id))
            const latest = projected.findLast((m) => m.info.role === "user")!
            expect(latest.info.id).toBe(correction.id)
            expect(latest.parts).toEqual(
              (await MessageStore.get({ sessionID: session.id, messageID: correction.id })).parts,
            )
            expect(projected.find((message) => message.info.id === accepted.id)?.parts).toEqual(
              (await MessageStore.get({ sessionID: session.id, messageID: accepted.id })).parts,
            )
            const summary = await MessageStore.get({ sessionID: session.id, messageID: summaryID })
            expect(summary.parts.find((p) => p.type === "compaction")).toMatchObject({ tail_start_id: accepted.id })
            const interrupted = await MessageStore.get({ sessionID: session.id, messageID: helper.id })
            expect(interrupted.info).toMatchObject({
              role: "assistant",
              finish: "error",
              error: { name: "ProcessExecutionInterruptedError" },
              time: { completed: expect.any(Number) },
            })
            expect(interrupted.parts).toEqual(original.parts)
            expect(JSON.stringify(requests.at(-1))).toContain("ProcessExecutionInterruptedError")
            await CompactionPolicyCase.checkCheckpoint(session.id, summaryID)
          },
        })
      } finally {
        await server.stop(true)
      }
    }, 60_000)
  }
}
