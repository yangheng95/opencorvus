import { afterEach, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { CompactionCoverage } from "@/session/compaction-coverage"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { withImmediateParkToolResultControl } from "@/session/tool-result-control"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

for (const kind of ["assistant", "mission"] as const) {
  for (const helper of ["checkpoint", "failed-compaction", "title"] as const) {
    for (const priorReply of [false, true]) {
      test(`${kind} side history uses ${priorReply ? "the prior completed reply" : "an empty completed prefix"} with a later ${helper} and active execution`, async () => {
        await using project = await memoryProject()
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            const session =
              kind === "mission"
                ? await ensureMissionSession({
                    missionID: `side-${helper}-${priorReply}`,
                    defaultCwd: project.path,
                    productPillar: "work",
                    heldExpertSquadIDs: ["base"],
                  })
                : await Session.create({ kind, title: "Completed reference boundary" })
            const agent = kind === "mission" ? "mission" : "chat"
            const persist = async (info: Message.Info, text: string) => {
              await Session.persistMessage({
                info,
                parts: [
                  { id: Identifier.ascending("part"), sessionID: session.id, messageID: info.id, type: "text", text },
                ],
              })
              return MessageStore.get({ sessionID: session.id, messageID: info.id })
            }
            const user = (text: string) =>
              persist(
                {
                  id: Identifier.ascending("message"),
                  sessionID: session.id,
                  role: "user",
                  author: "user",
                  agent,
                  model: { providerID: "local", modelID: "copy-boundary" },
                  time: { created: Date.now() },
                },
                text,
              )
            const assistant = (parentID: string, text: string, extra: Partial<Message.Assistant> = {}) =>
              persist(
                {
                  id: Identifier.ascending("message"),
                  sessionID: session.id,
                  role: "assistant",
                  author: agent,
                  agent,
                  parentID,
                  providerID: "local",
                  modelID: "copy-boundary",
                  path: { cwd: project.path, root: project.path },
                  cost: 0,
                  tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
                  time: { created: Date.now() },
                  ...extra,
                },
                text,
              )
            const completed: Message.WithParts[] = []
            if (priorReply) {
              const initial = await user("Completed original input")
              const reply = await assistant(initial.info.id, "Completed original reply", {
                finish: "stop",
                time: { created: Date.now(), completed: Date.now() },
              })
              completed.push(initial, reply)
            }
            const current = await user("Current input still executing")
            const open = await assistant(current.info.id, "Current execution prefix", { finish: "tool-calls" })
            const helperID = helper === "title" ? "title" : "compaction"
            const summary = await assistant(current.info.id, "Actual maintenance result", {
              author: helperID,
              agent: helperID,
              summary: helper === "checkpoint",
              finish: helper === "failed-compaction" ? "error" : "stop",
              ...(helper === "failed-compaction"
                ? {
                    error: {
                      name: "APIError",
                      data: { message: "Controlled maintenance failure", isRetryable: false },
                    } as Message.Assistant["error"],
                  }
                : {}),
              time: { created: Date.now(), completed: Date.now() },
            })
            if (helper === "checkpoint") {
              await Session.publishCompactionCheckpoint({
                info: summary.info as Message.Assistant,
                part: {
                  id: Identifier.ascending("part"),
                  sessionID: session.id,
                  messageID: summary.info.id,
                  type: "compaction",
                  auto: true,
                  anchor_id: current.info.id,
                  covered_parts: CompactionCoverage.snapshot([open]),
                },
              })
            }
            await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: session.id,
              messageID: open.info.id,
              type: "tool",
              tool: "read",
              callID: "current_pending_read",
              state: { status: "running", input: { filePath: "still-reading.txt" }, time: { start: Date.now() } },
            })
            await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: session.id,
              messageID: open.info.id,
              type: "text",
              text: "Actual late execution observation",
            })
            const original = await MessageStore.get({ sessionID: session.id, messageID: open.info.id })
            const side = await Session.fork({ sessionID: session.id, purpose: "side-chat" })
            const copied = await Session.messages({ sessionID: side.id })
            expect(
              copied.map((message) => ({
                role: message.info.role,
                author: message.info.author,
                parts: message.parts.map((part) => ({
                  type: part.type,
                  ...(part.type === "text" ? { text: part.text } : {}),
                })),
              })),
            ).toEqual(
              completed.map((message) => ({
                role: message.info.role,
                author: message.info.author,
                parts: message.parts.map((part) => ({
                  type: part.type,
                  ...(part.type === "text" ? { text: part.text } : {}),
                })),
              })),
            )
            expect(side).toMatchObject({
              kind: "assistant",
              metadata: {
                sideChat: {
                  sourceSessionID: session.id,
                  inheritedMessageIDs: copied.map((message) => message.info.id),
                },
              },
            })
            expect(await MessageStore.get({ sessionID: session.id, messageID: open.info.id })).toEqual(original)
          },
        })
      })
    }
  }
  test(`${kind} side history includes a completed typed Tool decision`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session =
          kind === "mission"
            ? await ensureMissionSession({
                missionID: "side-typed-decision",
                defaultCwd: project.path,
                productPillar: "work",
                heldExpertSquadIDs: ["base"],
              })
            : await Session.create({ kind, title: "Settled Tool decision" })
        const agent = kind === "mission" ? "mission" : "chat"
        const source = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent,
          model: { providerID: "local", modelID: "copy-boundary" },
          time: { created: Date.now() },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: source.id,
          type: "text",
          text: "Wait for the actual external event",
        })
        const reply = (await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "assistant",
          author: agent,
          agent,
          parentID: source.id,
          providerID: "local",
          modelID: "copy-boundary",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })) as Message.Assistant
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: reply.id,
          type: "tool",
          tool: "wait",
          callID: "real_turn_control",
          state: {
            status: "completed",
            input: { duration_ms: 1000 },
            output: "A durable wake has been scheduled",
            title: "Wait for external event",
            metadata: withImmediateParkToolResultControl({}),
            time: { start: Date.now(), end: Date.now() + 1 },
          },
        })
        await Session.updateMessage({ ...reply, finish: "tool-calls", time: { ...reply.time, completed: Date.now() } })
        const side = await Session.fork({ sessionID: session.id, purpose: "side-chat" })
        const copied = await Session.messages({ sessionID: side.id })
        expect(copied.map((message) => message.info.role)).toEqual(["user", "assistant"])
        expect(copied[1]!.parts).toEqual([
          expect.objectContaining({
            type: "tool",
            callID: "real_turn_control",
            state: expect.objectContaining({ status: "completed", metadata: withImmediateParkToolResultControl({}) }),
          }),
        ])
      },
    })
  })
}
