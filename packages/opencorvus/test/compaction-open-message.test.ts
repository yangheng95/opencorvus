import { afterEach, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { SessionCompaction } from "@/session/compaction"
import { CompactionCoverage } from "@/session/compaction-coverage"
import { SessionLoop } from "@/session/loop"
import { SessionControl } from "@/session/control"
import { Identifier } from "@/id/id"
import { Database } from "@/storage/db"
import { CompactionPolicyCase } from "../script/compaction-policy-case"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

for (const completed of [false, true]) {
  test(`a ${completed ? "completed" : "still-open"} execution Message retains Parts appended after its compaction`, async () => {
    const target = { providerID: "open-message-local", modelID: "checkpoint" }
    const requests: any[] = []
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const body = (await request.json()) as any
        requests.push(body)
        const event = (delta: unknown, finish: string | null) =>
          `data: ${JSON.stringify({ id: "open-message-summary", object: "chat.completion.chunk", created: 1, model: target.modelID, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
        return new Response(
          event(
            {
              role: "assistant",
              content:
                "The current execution has read the earlier evidence. Continue the same accepted input; validation remains pending.",
            },
            null,
          ) +
            event({}, "stop") +
            "data: [DONE]\n\n",
          { headers: { "content-type": "text/event-stream" } },
        )
      },
    })
    try {
      await using project = await memoryProject(`open-message-${completed}`)
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await Config.updateProjectPatch({
            model: `${target.providerID}/${target.modelID}`,
            small_model: `${target.providerID}/${target.modelID}`,
            enabled_providers: [target.providerID],
            compaction: { tail_turns: 0 },
            provider: {
              [target.providerID]: {
                name: "Open Message transport",
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
          const session = await Session.create({ kind: "assistant", title: "Open execution projection" })
          const history = await CompactionPolicyCase.history({ target, project: project.path })
          const source = await history.user(
            session.id,
            "Continue the same execution; preserve every committed result and its trace.",
          )
          const initial = await history.assistant(
            session.id,
            source.id,
            "Earlier observed evidence. ".repeat(1000),
            false,
          )
          const active = await Session.updateMessage({
            ...initial,
            finish: "tool-calls",
          })
          if (active.role !== "assistant") throw new Error("Expected open assistant")
          const before = await MessageStore.get({ sessionID: session.id, messageID: active.id })
          const pendingID = Identifier.ascending("part")
          const pendingStart = Date.now()
          if (!completed)
            await Session.updatePart({
              id: pendingID,
              sessionID: session.id,
              messageID: active.id,
              type: "tool",
              tool: "read",
              callID: "call_pending_at_checkpoint",
              state: { status: "running", input: { filePath: "pending-evidence.txt" }, time: { start: pendingStart } },
            })
          const compact = async () => {
            const control = await SessionCompaction.create({
              sessionID: session.id,
              source,
              auto: true,
              overflow: true,
              model: target,
            })
            await SessionLoop.TestHooks.executeCompactionControl({
              control,
              sessionID: session.id,
              run: async () =>
                SessionCompaction.process(
                  {
                    sessionID: session.id,
                    parentID: source.id,
                    messages: await Message.filterCompacted(MessageStore.stream(session.id)),
                    abort: new AbortController().signal,
                    auto: true,
                    overflow: true,
                    model: target,
                  },
                  { prepareProviderTool: SessionLoop.prepareProviderTool },
                ),
            })
            expect(SessionControl.get(control.id)).toMatchObject({ status: "consumed" })
            return SessionControl.get(control.id)!.payload.result_summary_message_id as string
          }
          const summaryID = await compact()
          const afterPartID = Identifier.ascending("part")
          const callID = "call_after_checkpoint"
          const output = JSON.stringify({ trace: "TRACE-AFTER-CHECKPOINT-731", next_offset: 17031 })
          await Session.updatePart({
            id: afterPartID,
            sessionID: session.id,
            messageID: active.id,
            type: "tool",
            tool: "read",
            callID,
            state: {
              status: "completed",
              input: { filePath: "later-evidence.txt" },
              output,
              title: "Later committed evidence",
              metadata: { trace: "TRACE-AFTER-CHECKPOINT-731" },
              time: { start: Date.now(), end: Date.now() + 1 },
            },
          })
          if (completed)
            await Session.updateMessage({ ...active, finish: "stop", time: { ...active.time, completed: Date.now() } })
          Database.close()
          const raw = await MessageStore.get({ sessionID: session.id, messageID: active.id })
          expect(raw.parts.find((part) => part.id === afterPartID)).toMatchObject({
            type: "tool",
            callID,
            state: { status: "completed", output },
          })
          const projected = await Message.filterCompacted(MessageStore.stream(session.id))
          const modelInput = await Message.toModelMessages(
            projected,
            await Provider.getModel(target.providerID, target.modelID),
          )
          console.log(
            JSON.stringify({
              scenario: "open-message-compaction",
              completed,
              sessionID: session.id,
              sourceID: source.id,
              openMessageID: active.id,
              summaryID,
              beforePartIDs: before.parts.map((part) => part.id),
              afterPartID,
              rawPartIDs: raw.parts.map((part) => part.id),
              projected: projected.map((message) => ({
                id: message.info.id,
                parts: message.parts.map((part) => part.id),
              })),
              modelInput,
            }),
          )
          expect(projected.map((message) => message.info.id)).toEqual([source.id, summaryID, active.id])
          expect(SessionLoop.hasPostCompactionMaterialForSource(projected, source.id)).toBe(true)
          expect(projected.at(-1)!.parts).toEqual([raw.parts.find((part) => part.id === afterPartID)!])
          expect(modelInput).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                role: "tool",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "tool-result",
                    toolCallId: callID,
                    output: { type: "text", value: output },
                  }),
                ]),
              }),
            ]),
          )
          if (completed) {
            expect(requests).toHaveLength(1)
            return
          }

          await Session.updatePart({
            id: pendingID,
            sessionID: session.id,
            messageID: active.id,
            type: "tool",
            tool: "read",
            callID: "call_pending_at_checkpoint",
            state: {
              status: "completed",
              input: { filePath: "pending-evidence.txt" },
              output: "TRACE-PENDING-COMPLETED-831",
              title: "Settled after checkpoint",
              metadata: {},
              time: { start: pendingStart, end: Date.now() },
            },
          })
          const settledProjection = await Message.filterCompacted(MessageStore.stream(session.id))
          expect(settledProjection.at(-1)!.parts.map((part) => part.id)).toEqual([pendingID, afterPartID])
          expect(
            await Message.toModelMessages(
              settledProjection,
              await Provider.getModel(target.providerID, target.modelID),
            ),
          ).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                role: "tool",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "tool-result",
                    toolCallId: "call_pending_at_checkpoint",
                    output: { type: "text", value: "TRACE-PENDING-COMPLETED-831" },
                  }),
                ]),
              }),
            ]),
          )

          const originalText = before.parts.find((part) => part.type === "text")!
          const changedText = originalText.text + " Late streaming text TRACE-UPDATED-TEXT-812."
          await Session.updatePart({ ...originalText, text: changedText })
          const editedCopy = await Session.fork({ sessionID: session.id })
          const editedProjection = await Message.filterCompacted(MessageStore.stream(editedCopy.id))
          expect(editedProjection.at(-1)!.parts.map((part) => part.type)).toEqual(["text", "tool", "tool"])
          expect(editedProjection.at(-1)!.parts[0]).toMatchObject({ text: changedText })

          const sourcePartID = Identifier.ascending("part")
          await Session.updatePart({
            id: sourcePartID,
            sessionID: session.id,
            messageID: active.id,
            type: "source-url",
            toolPartID: afterPartID,
            sourceId: "late-reference",
            url: "https://example.test/evidence",
            title: "Bound source evidence",
          })
          let latest = summaryID
          for (let round = 2; round <= 3; round++) {
            latest = await compact()
            const checkpoint = await MessageStore.get({ sessionID: session.id, messageID: latest })
            const marker = checkpoint.parts.find((part) => part.type === "compaction")!
            const prefix = await MessageStore.get({ sessionID: session.id, messageID: active.id })
            expect(marker.covered_parts?.[0]?.parts.map((part) => part.partID)).toEqual(
              prefix.parts.map((part) => part.id),
            )
            const suffixID = Identifier.ascending("part")
            await Session.updatePart({
              id: suffixID,
              sessionID: session.id,
              messageID: active.id,
              type: "text",
              text: `Round ${round} exact late evidence TRACE-ROUND-${round}-17031. ` + "Observation. ".repeat(100),
            })
            Database.close()
            const afterRound = await Message.filterCompacted(MessageStore.stream(session.id))
            expect(afterRound.map((message) => message.info.id)).toEqual([source.id, latest, active.id])
            expect(SessionLoop.hasPostCompactionMaterialForSource(afterRound, source.id)).toBe(true)
            expect(afterRound.at(-1)!.parts.map((part) => part.id)).toEqual([suffixID])
            expect(
              (
                await Message.toModelMessages(afterRound, await Provider.getModel(target.providerID, target.modelID))
              ).at(-1),
            ).toMatchObject({
              role: "assistant",
              content: [{ type: "text", text: expect.stringContaining(`TRACE-ROUND-${round}-17031`) }],
            })
          }
          const checker = await CompactionPolicyCase.checkCheckpoint(session.id, latest)
          expect(checker).toMatchObject({ status: "valid_checkpoint", summaryID: latest, processExitCode: 0 })
          await Session.updateMessage({
            ...active,
            finish: "error",
            time: { ...active.time, completed: Date.now() },
            error: {
              name: "APIError",
              data: { message: "Late provider failure TRACE-LATE-FAILURE-921", isRetryable: false },
            },
          })
          const copy = await Session.fork({ sessionID: session.id, purpose: "side-chat" })
          const copyProjection = await Message.filterCompacted(MessageStore.stream(copy.id))
          const copiedActive = copyProjection.at(-1)!
          const copyRaw = await MessageStore.get({ sessionID: copy.id, messageID: copiedActive.info.id })
          const copiedTool = copyRaw.parts.find((part) => part.type === "tool" && part.callID === callID)!
          expect(copyRaw.parts.find((part) => part.type === "source-url")).toMatchObject({ toolPartID: copiedTool.id })
          expect(copiedActive.parts).toEqual([
            expect.objectContaining({ type: "text", text: expect.stringContaining("TRACE-ROUND-3-17031") }),
          ])
          const copiedModelInput = await Message.toModelMessages(
            copyProjection,
            await Provider.getModel(target.providerID, target.modelID),
          )
          expect(JSON.stringify(copiedModelInput)).toContain("TRACE-LATE-FAILURE-921")
          expect(copiedActive.info).toMatchObject({ error: { name: "APIError" }, finish: "error" })
          const completedCheckpoint = await compact()
          const finalProjection = await Message.filterCompacted(MessageStore.stream(session.id))
          const finalModelInput = await Message.toModelMessages(
            finalProjection,
            await Provider.getModel(target.providerID, target.modelID),
          )
          expect(finalModelInput).toEqual([modelInput[0], modelInput[1]])
          expect((await MessageStore.get({ sessionID: session.id, messageID: active.id })).info).toMatchObject({
            error: { name: "APIError", data: { message: "Late provider failure TRACE-LATE-FAILURE-921" } },
          })
          console.log(
            JSON.stringify({
              scenario: "repeated-open-message-compaction",
              rounds: 3,
              sessionID: session.id,
              summaryID: latest,
              copyID: copy.id,
              copiedMessageID: copiedActive.info.id,
              checker,
              copiedModelInput,
              completedCheckpoint,
              finalModelInput,
              requests: requests.length,
            }),
          )
          expect(requests).toHaveLength(4)
        },
      })
    } finally {
      await Instance.disposeAll()
      await server.stop(true)
    }
  })
}

test("missing captured evidence returns its exact integrity error contract", () => {
  const entry = { messageID: "msg_missing", parts: [], diagnostics_sha256: "0".repeat(64) }
  expect(() => CompactionCoverage.suffix(entry, undefined)).toThrow(CompactionCoverage.IntegrityError)
  try {
    CompactionCoverage.suffix(entry, undefined)
  } catch (error) {
    expect((error as InstanceType<typeof CompactionCoverage.IntegrityError>).toObject()).toMatchObject({
      name: "CompactionCoverageIntegrityError",
      data: { messageID: "msg_missing" },
    })
  }
})

test("prune coverage preserves a large late result while replacing the captured result", () => {
  const sessionID = Identifier.ascending("session")
  const userID = Identifier.ascending("message")
  const assistantID = Identifier.ascending("message")
  const summaryID = Identifier.ascending("message")
  const base: Message.Assistant = {
    id: assistantID,
    sessionID,
    role: "assistant",
    author: "chat",
    agent: "chat",
    parentID: userID,
    modelID: "checkpoint",
    providerID: "test",
    path: { cwd: ".", root: "." },
    time: { created: 2 },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  }
  const part = (callID: string, output: string): Message.ToolPart & { state: Message.ToolStateCompleted } => ({
    id: Identifier.ascending("part"),
    sessionID,
    messageID: assistantID,
    type: "tool",
    tool: "read",
    callID,
    state: {
      status: "completed",
      input: { filePath: callID },
      output,
      title: callID,
      metadata: {},
      time: { start: 2, end: 3 },
    },
  })
  const captured = part("captured", "Original evidence. ".repeat(20_000))
  const late = part("late", "TRACE-LARGE-LATE-937 " + "Later evidence. ".repeat(20_000))
  const coverage = CompactionCoverage.snapshot([{ info: base, parts: [captured] }])
  const projected = SessionCompaction.projectPrunedHistory([
    {
      info: {
        id: userID,
        sessionID,
        role: "user",
        author: "user",
        agent: "chat",
        time: { created: 1 },
        model: { providerID: "test", modelID: "checkpoint" },
      },
      parts: [],
    },
    { info: base, parts: [captured, late] },
    {
      info: {
        ...base,
        id: summaryID,
        author: "compaction",
        agent: "compaction",
        summary: true,
        finish: "stop",
        time: { created: 4, completed: 5 },
      },
      parts: [
        {
          id: Identifier.ascending("part"),
          sessionID,
          messageID: summaryID,
          type: "compaction",
          auto: true,
          anchor_id: userID,
          covered_parts: coverage,
        },
      ],
    },
  ])
  expect(projected[1]!.parts).toEqual([
    { ...captured, state: { ...captured.state, time: { ...captured.state.time, compacted: 3 } } },
    late,
  ])
  expect(SessionLoop.hasPostCompactionMaterialForSource([
    projected[0]!, projected[2]!, { info: base, parts: [{ id: Identifier.ascending("part"),
      sessionID, messageID: assistantID, type: "source-url", sourceId: "late-only-source",
      url: "https://example.test/late-only", title: "Late independent source evidence" }] },
  ], userID)).toBe(true)
})
