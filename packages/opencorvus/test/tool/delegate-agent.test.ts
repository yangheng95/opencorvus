import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { CapabilityRules } from "../../src/capability/rules"
import { Instance } from "../../src/project/instance"
import { Identifier } from "../../src/id/id"
import { Session } from "../../src/session"
import type { Message } from "../../src/session/message"
import { MessageStore } from "../../src/session/message-store"
import { ProtocolStore } from "../../src/protocol/store"
import {
  awaitTaskMessageProtocolBridgeIdle,
  ensureTaskMessageProtocolBridge,
} from "../../src/orchestrator/protocol/message-bridge"
import { SessionPrompt } from "../../src/session/prompt"
import { SessionStatus } from "../../src/session/status"
import { DelegateAgentTool } from "../../src/tool/delegate-agent"
import { Tool } from "../../src/tool/tool"
import { WriteTool } from "../../src/tool/write"
import { ReadTool } from "../../src/tool/read"
import { BashTool } from "../../src/tool/bash"
import { resolveSessionExecutionAuthority } from "../../src/engine/task-session-lineage"
import { tmpdir } from "../fixture/fixture"

afterEach(async () => {
  mock.restore()
  await Instance.disposeAll()
})

async function childReply(
  input: Parameters<typeof SessionPrompt.prompt>[0] & { messageID: string },
  text: string,
  options: { error?: Message.Assistant["error"]; finish?: string } = {},
): Promise<Message.WithParts> {
  const messageID = Identifier.ascending("message")
  return Session.persistMessage({
    info: {
      id: messageID,
      sessionID: input.sessionID,
      role: "assistant",
      author: input.agent ?? "coding",
      parentID: input.messageID,
      time: { created: Date.now(), completed: Date.now() },
      agent: input.agent ?? "coding",
      finish: options.finish ?? "stop",
      ...(options.error ? { error: options.error } : {}),
      providerID: input.model?.providerID ?? "test",
      modelID: input.model?.modelID ?? "test-model",
      cost: 0,
      tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      path: { cwd: Instance.directory, root: Instance.worktree },
    },
    parts: text
      ? [
          {
            id: Identifier.ascending("part"),
            sessionID: input.sessionID,
            messageID,
            type: "text",
            text,
          },
        ]
      : [],
  })
}

async function beginChildOccurrence(input: Parameters<typeof SessionPrompt.prompt>[0]) {
  const inputMessage = await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "user",
    sessionID: input.sessionID,
    author: input.author ?? "coding",
    time: { created: Date.now() },
    agent: input.agent ?? "coding",
    model: input.model ?? { providerID: "test", modelID: "test-model" },
  })
  SessionStatus.beginExecutionOccurrence(input.sessionID, inputMessage.id, new AbortController().signal)
  return inputMessage.id
}

function context(input: {
  parentID: string
  agent?: "coding" | "chat" | "work" | "mission"
  abort?: AbortSignal
  callID?: string
}) {
  return {
    sessionID: input.parentID,
    messageID: "msg_parent",
    callID: input.callID ?? "call_delegate",
    agent: input.agent ?? "coding",
    abort: input.abort ?? new AbortController().signal,
    extra: { model: { providerID: "test", id: "exact-parent-model" } },
    messages: [],
    executionAuthority: Object.freeze({
      kind: "conversation" as const,
      sessionID: input.parentID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
    }),
    executionSurface: Tool.executionSurface(["delegate_agent"], []),
    metadata: () => {},
  }
}

describe("delegate_agent", () => {
  const providerError = {
    name: "UnknownError",
    data: { message: "AI_StreamProviderError: Our servers are currently overloaded. Please try again later." },
  } as const
  const failures: Array<{
    label: string
    text: string
    finish: string
    error?: Message.Assistant["error"]
    errorName: string
    detail: string
    reason: "error" | "aborted"
    cancelParent?: boolean
  }> = [
    {
      label: "Provider error",
      text: "",
      finish: "error",
      error: providerError,
      errorName: "AgentRunError",
      detail: "[assistant] LLM error during work: UnknownError: " + providerError.data.message,
      reason: "error",
    },
    {
      label: "Provider error with partial output",
      text: "I have started reading.",
      finish: "error",
      error: providerError,
      errorName: "AgentRunError",
      detail: "[assistant] LLM error during work: UnknownError: " + providerError.data.message,
      reason: "error",
    },
    {
      label: "output limit",
      text: "Partial review",
      finish: "length",
      errorName: "AgentRunError",
      detail:
        "[assistant] LLM error during work: MessageOutputLengthError: The model response exceeded its output limit.",
      reason: "error",
    },
    {
      label: "cancelled reply",
      text: "Partial review",
      finish: "error",
      error: { name: "MessageAbortedError", data: { message: "The delegated request was cancelled." } },
      errorName: "MessageAbortedError",
      detail: "MessageAbortedError: The delegated request was cancelled.",
      reason: "aborted",
    },
    {
      label: "empty completed reply",
      text: "",
      finish: "stop",
      errorName: "AgentRunError",
      detail: "[assistant] work returned an empty text handoff",
      reason: "error",
    },
    {
      label: "error finish with incomplete diagnostic",
      text: "Partial review",
      finish: "error",
      errorName: "AgentRunError",
      detail: "[assistant] LLM error during work: error finish has no recorded diagnostic",
      reason: "error",
    },
    {
      label: "parent cancellation at reply admission",
      text: "Finished reading.",
      finish: "stop",
      errorName: "Error",
      detail: "Parent stopped this delegated request.",
      reason: "aborted",
      cancelParent: true,
    },
  ]

  for (const failure of failures)
    test(`publishes the exact ${failure.label} before settling its occurrence`, async () => {
      await using tmp = await tmpdir({ git: true })
      let childID = "",
        inputID = "",
        finalID = ""
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          ensureTaskMessageProtocolBridge()
          const parent = await Session.create({ kind: "assistant", title: "Parent Work failure contract" })
          const parentAbort = new AbortController()
          // This boundary returns real durable Message facts; it does not simulate a Provider qualification.
          spyOn(SessionPrompt, "prompt").mockImplementation(async (input, hooks) => {
            await hooks?.beforeLoop?.()
            childID = input.sessionID
            inputID = await beginChildOccurrence(input)
            const result = await childReply({ ...input, messageID: inputID }, failure.text, failure)
            finalID = result.info.id
            if (failure.cancelParent) parentAbort.abort(new Error(failure.detail))
            return result
          })
          const tool = await DelegateAgentTool.init()
          const outcome = await tool
            .execute(
              { instruction: "Read the requested evidence and report the result." },
              context({ parentID: parent.id, agent: "work", abort: parentAbort.signal }),
            )
            .then(
              (result) => ({ kind: "completed", result }),
              (error: Error) => ({ kind: "failed", error }),
            )
          await awaitTaskMessageProtocolBridgeIdle()
          const terminal = ProtocolStore.latestSessionOccurrenceEvent(
            childID,
            "agent.execution.lifecycle",
            inputID,
          )?.payload
          expect({ outcome, terminal }).toMatchObject({
            outcome: { kind: "failed", error: { name: failure.errorName, message: failure.detail } },
            terminal: {
              inputMessageID: inputID,
              agentID: "work",
              status: { type: "terminal", reason: failure.reason, error: failure.detail, final_message_id: finalID },
            },
          })
          const original = await MessageStore.get({ sessionID: childID, messageID: finalID })
          expect(original.info).toMatchObject({
            finish: failure.finish,
            parentID: inputID,
            ...(failure.error ? { error: failure.error } : {}),
          })
          expect(original.parts.filter((part) => part.type === "text").map((part) => part.text)).toEqual(
            failure.text ? [failure.text] : [],
          )
        },
      })
      await Instance.disposeAll()
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          expect(
            ProtocolStore.latestSessionOccurrenceEvent(childID, "agent.execution.lifecycle", inputID)?.payload,
          ).toMatchObject({
            inputMessageID: inputID,
            status: { type: "terminal", reason: failure.reason, error: failure.detail, final_message_id: finalID },
          })
        },
      })
    })

  test("parallel delegated calls retain their own failure and success across Project owners", async () => {
    await using first = await tmpdir({ git: true })
    await using second = await tmpdir({ git: true })
    const parents = await Promise.all(
      [first, second].map((project) =>
        Instance.provide({
          directory: project.path,
          fn: () => Session.create({ kind: "assistant", title: "Parallel Work parent" }),
        }),
      ),
    )
    const cases = [
      { parent: parents[0]!, directory: first.path, callID: "call_failed", failure: true },
      { parent: parents[0]!, directory: first.path, callID: "call_success", failure: false },
      { parent: parents[1]!, directory: second.path, callID: "call_other_project", failure: false },
    ]
    const replies = new Map<string, { childID: string; inputID: string; finalID: string }>()
    spyOn(SessionPrompt, "prompt").mockImplementation(async (input, hooks) => {
      await hooks?.beforeLoop?.()
      const child = await Session.get(input.sessionID)
      const callID = String((child.metadata?.delegation as { parentToolCallID?: string })?.parentToolCallID)
      const scenario = cases.find((item) => item.callID === callID)!
      const inputID = await beginChildOccurrence(input)
      const final = await childReply(
        { ...input, messageID: inputID },
        "Recorded evidence.",
        scenario.failure ? { error: providerError, finish: "error" } : {},
      )
      replies.set(callID, { childID: child.id, inputID, finalID: final.info.id })
      return final
    })
    const results = await Promise.all(
      cases.map((scenario) =>
        Instance.provide({
          directory: scenario.directory,
          fn: async () => {
            ensureTaskMessageProtocolBridge()
            const tool = await DelegateAgentTool.init()
            const outcome = await tool
              .execute(
                { instruction: "Read and report the evidence." },
                context({
                  parentID: scenario.parent.id,
                  agent: "work",
                  callID: scenario.callID,
                }),
              )
              .then(
                () => "completed",
                () => "error",
              )
            await awaitTaskMessageProtocolBridgeIdle()
            const reply = replies.get(scenario.callID)!
            const child = await Session.get(reply.childID)
            const event = ProtocolStore.latestSessionOccurrenceEvent(
              reply.childID,
              "agent.execution.lifecycle",
              reply.inputID,
            )!
            return {
              projectID: child.projectID,
              parentID: child.parentID,
              inputID: event.payload?.inputMessageID,
              finalID: (event.payload?.status as { final_message_id?: string }).final_message_id,
              reason: (event.payload?.status as { reason?: string }).reason,
              outcome,
            }
          },
        }),
      ),
    )
    expect(results).toEqual(
      cases.map((scenario) => ({
        projectID: scenario.parent.projectID,
        parentID: scenario.parent.id,
        inputID: replies.get(scenario.callID)!.inputID,
        finalID: replies.get(scenario.callID)!.finalID,
        reason: scenario.failure ? "error" : "completed",
        outcome: scenario.failure ? "error" : "completed",
      })),
    )
  })

  test("lets a standalone Work child execute conversation-owned file and process evidence", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const parent = await Session.create({ kind: "assistant", title: "parent Work session" })
        spyOn(SessionPrompt, "prompt").mockImplementation(async (input, hooks) => {
          await hooks?.beforeLoop?.()
          const inputMessageID = await beginChildOccurrence(input)
          const executionAuthority = await resolveSessionExecutionAuthority({
            sessionID: input.sessionID,
            projectID: Instance.project.id,
            expected: { kind: "conversation" },
          })
          const toolContext: Tool.Context = {
            sessionID: input.sessionID,
            messageID: "msg_child_execution",
            callID: "call_child_execution",
            agent: "work",
            abort: new AbortController().signal,
            messages: [],
            executionAuthority,
            executionSurface: Tool.executionSurface(["write", "read", "bash"], []),
            metadata() {},
          }
          const evidencePath = path.join(tmp.path, "delegated-work-evidence.txt")
          await WriteTool.init().then((current) =>
            current.execute({ filePath: evidencePath, content: "delegated-conversation-evidence\n" }, toolContext),
          )
          const read = await ReadTool.init().then((current) => current.execute({ filePath: evidencePath }, toolContext))
          const bash = await BashTool.init().then((current) =>
            current.execute(
              {
                command: `${JSON.stringify(process.execPath)} --version`,
                description: "Report delegated runtime version",
              },
              toolContext,
            ),
          )
          return childReply(
            { ...input, messageID: inputMessageID },
            JSON.stringify({
              persisted: read.output.includes("delegated-conversation-evidence"),
              exit: bash.metadata.exit,
            }),
          )
        })

        const tool = await DelegateAgentTool.init()
        const result = await tool.execute(
          { instruction: "Independently validate the presentation and report visual findings." },
          context({ parentID: parent.id, agent: "work" }),
        )

        const child = (await Session.children(parent.id))[0]!
        expect({
          child: { kind: child.kind, parentID: child.parentID },
          evidence: await fs.readFile(path.join(tmp.path, "delegated-work-evidence.txt"), "utf8"),
          status: SessionStatus.get(child.id),
        }).toEqual({
          child: { kind: "assistant", parentID: parent.id },
          evidence: "delegated-conversation-evidence\n",
          status: {
            type: "terminal",
            reason: "completed",
            final_message_id: JSON.parse(result.output).final_message_id,
          },
        })
      },
    })
  })

  test("creates one visible standalone child using the exact parent identity and model", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const parent = await Session.create({
          kind: "assistant",
          title: "parent coding session",
          permission: [{ permission: "bash", pattern: "*", action: "allow" }],
        })
        let captured: Parameters<typeof SessionPrompt.prompt>[0] | undefined
        spyOn(SessionPrompt, "prompt").mockImplementation(async (input, hooks) => {
          captured = input
          await hooks?.beforeLoop?.()
          const inputMessageID = await beginChildOccurrence(input)
          return childReply(
            { ...input, messageID: inputMessageID },
            "Confirmed the boundary and reviewed the relevant files.",
          )
        })

        const tool = await DelegateAgentTool.init()
        const result = await tool.execute(
          { instruction: "Inspect the local delegation boundary and return evidence." },
          context({ parentID: parent.id }),
        )

        const children = await Session.children(parent.id)
        expect(children).toHaveLength(1)
        const child = children[0]!
        expect(child).toMatchObject({
          kind: "assistant",
          parentID: parent.id,
          directory: parent.directory,
          metadata: {
            delegation: {
              kind: "session-local",
              parentAgent: "coding",
              parentMessageID: "msg_parent",
              parentToolCallID: "call_delegate",
            },
          },
        })
        expect(captured).toMatchObject({
          sessionID: child.id,
          agent: "coding",
          author: "coding",
          model: { providerID: "test", modelID: "exact-parent-model" },
        })
        expect(captured!.parts[0]).toMatchObject({ type: "text" })
        expect((captured!.parts[0] as { text: string }).text).toContain("This is not an engine task")

        const persistedChild = await Session.get(child.id)
        expect(CapabilityRules.evaluate("bash", "*", persistedChild.permission).action).toBe("allow")
        const final = (await Session.messages({ sessionID: child.id })).find(
          (message) => message.info.role === "assistant",
        )!
        expect(SessionStatus.get(child.id)).toEqual({
          type: "terminal",
          reason: "completed",
          final_message_id: final.info.id,
        })
        expect(JSON.parse(result.output)).toEqual({
          kind: "terminal_success",
          session_id: child.id,
          final_message_id: final.info.id,
          handoff: "Confirmed the boundary and reviewed the relevant files.",
        })
      },
    })
  })
})
