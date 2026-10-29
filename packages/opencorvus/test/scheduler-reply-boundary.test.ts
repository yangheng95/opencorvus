import { afterEach, expect, test } from "bun:test"
import { Session } from "@/session"
import { Instance } from "@/project/instance"
import { Identifier } from "@/id/id"
import { Database } from "@/storage/db"
import { MessageStore } from "@/session/message-store"
import { isCompletedReplyToUserMessage, isSettledReplyToUserMessage } from "@/session/completed-reply"
import {
  completedSchedulerWakeReplyExistsInTransaction,
  settledSchedulerWakeReplyExistsInTransaction,
} from "@/protocol/session-wake-state"
import { withHandoffDrainToolResultControl, withImmediateParkToolResultControl } from "@/session/tool-result-control"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("persisted Scheduler reply boundaries share the Session completed-step, typed-control and accepted-batch contract", async () => {
  await using fixture = await memoryProject()
  await Instance.provide({
    directory: fixture.path,
    fn: async () => {
      const cases = [
        { name: "ordinary-tool-step", finish: "tool-calls", tool: true, expected: "needs_reply" },
        {
          name: "typed-park",
          finish: "tool-calls",
          control: withImmediateParkToolResultControl({}),
          tool: true,
          expected: "succeeded",
        },
        {
          name: "typed-handoff",
          finish: "tool-calls",
          control: withHandoffDrainToolResultControl({}, { requestID: "request", dispatchLineageID: "lineage" }),
          tool: true,
          expected: "succeeded",
        },
        { name: "summary", finish: "stop", summary: true, expected: "needs_reply" },
        { name: "missing-finish", expected: "needs_reply" },
        { name: "normal-stop", finish: "stop", expected: "succeeded" },
        { name: "error-finish", finish: "error", expected: "settled_failure" },
        { name: "provider-error", finish: "error", error: { name: "UnknownError", data: { message: "Provider failed" } }, expected: "settled_failure" },
        { name: "interrupted-process", finish: "error", error: { name: "ProcessExecutionInterruptedError", data: { message: "Original process ended" } }, expected: "settled_failure", recovery: "needs_recovery" },
        { name: "unfinished-reply", finish: "stop", incomplete: true, expected: "needs_reply" },
        { name: "accepted-batch", finish: "stop", batch: true, expected: "succeeded" },
        { name: "accepted-error-batch", finish: "error", batch: true, error: { name: "UnknownError", data: { message: "Batch failed" } }, expected: "settled_failure" },
      ]
      for (const item of cases) {
        const session = await Session.create({ kind: "assistant", title: item.name })
        const inputID = Identifier.ascending("message"),
          secondID = Identifier.ascending("message"),
          assistantID = Identifier.ascending("message")
        const now = Date.now()
        for (const id of item.batch ? [inputID, secondID] : [inputID])
          await Session.persistMessage({
            info: {
              id,
              sessionID: session.id,
              role: "user",
              author: "user",
              agent: "chat",
              time: { created: now },
              model: { providerID: "local", modelID: "boundary" },
            },
            parts: [
              {
                id: Identifier.ascending("part"),
                messageID: id,
                sessionID: session.id,
                type: "text",
                text: `Original ${item.name} input`,
              },
            ],
          })
        await Session.persistMessage({
          info: {
            id: assistantID,
            sessionID: session.id,
            parentID: item.batch ? secondID : inputID,
            role: "assistant",
            author: "agent",
            agent: "chat",
            time: { created: now + 1, ...(item.incomplete ? {} : { completed: now + 3 }) },
            providerID: "local",
            modelID: "boundary",
            path: { cwd: fixture.path, root: fixture.path },
            cost: 0,
            tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            ...(item.finish ? { finish: item.finish } : {}),
            ...(item.summary ? { summary: true } : {}),
            ...(item.error ? { error: item.error } : {}),
            ...(item.batch ? { acceptedInputMessageIDs: [inputID, secondID] } : {}),
          },
          parts: item.tool
            ? [
                {
                  id: Identifier.ascending("part"),
                  messageID: assistantID,
                  sessionID: session.id,
                  type: "tool",
                  callID: `call-${item.name}`,
                  tool: "read",
                  state: {
                    status: "completed",
                    input: {},
                    output: "Actual persisted Tool output",
                    title: item.name,
                    metadata: item.control ?? {},
                    time: { start: now + 1, end: now + 2 },
                  },
                },
              ]
            : [
                {
                  id: Identifier.ascending("part"),
                  messageID: assistantID,
                  sessionID: session.id,
                  type: "text",
                  text: item.name,
                },
              ],
        })
        const message = await MessageStore.get({ sessionID: session.id, messageID: assistantID })
        const state = (completed: boolean, settled: boolean) =>
          completed ? "succeeded" : settled ? "settled_failure" : "needs_reply"
        for (const id of item.batch ? [inputID, secondID] : [inputID]) {
          const actual = Database.use((db) => ({
            terminal: completedSchedulerWakeReplyExistsInTransaction(db, { sessionID: session.id, messageID: id }) ? "terminal" : "incomplete",
            recovery: settledSchedulerWakeReplyExistsInTransaction(db, { sessionID: session.id, messageID: id }) ? "settled" : "needs_recovery",
          }))
          expect({
            case: item.name,
            persisted: actual,
            session: state(isCompletedReplyToUserMessage(message, id), isSettledReplyToUserMessage(message, id)),
          }).toEqual({
            case: item.name,
            persisted: {
              terminal: item.expected === "needs_reply" ? "incomplete" : "terminal",
              recovery: item.recovery ?? (item.expected === "needs_reply" ? "needs_recovery" : "settled"),
            },
            session: item.expected,
          })
        }
      }
    },
  })
}, 60_000)
