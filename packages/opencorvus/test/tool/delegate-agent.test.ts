import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { PermissionNext } from "../../src/permission/next"
import { Instance } from "../../src/project/instance"
import { Identifier } from "../../src/id/id"
import { Session } from "../../src/session"
import type { Message } from "../../src/session/message"
import { SessionPrompt } from "../../src/session/prompt"
import { SessionStatus } from "../../src/session/status"
import { DelegateAgentTool } from "../../src/tool/delegate-agent"
import { tmpdir } from "../fixture/fixture"

afterEach(async () => {
  mock.restore()
  await Instance.disposeAll()
})

function childReply(input: Parameters<typeof SessionPrompt.prompt>[0], text: string): Message.WithParts {
  const messageID = `msg_delegate_reply_${input.sessionID}`
  return {
    info: {
      id: messageID,
      sessionID: input.sessionID,
      role: "assistant",
      parentID: input.messageID ?? `msg_delegate_user_${input.sessionID}`,
      time: { created: Date.now(), completed: Date.now() },
      agent: input.agent ?? "coding",
      providerID: input.model?.providerID ?? "test",
      modelID: input.model?.modelID ?? "test-model",
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      path: { cwd: "", root: "" },
    },
    parts: [
      {
        id: `prt_delegate_reply_${input.sessionID}`,
        sessionID: input.sessionID,
        messageID,
        type: "text",
        text,
      },
    ],
  } as Message.WithParts
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
}

function context(input: {
  parentID: string
  agent?: "coding" | "chat" | "work" | "mission"
  taskID?: string
  abort?: AbortSignal
}) {
  return {
    sessionID: input.parentID,
    messageID: "msg_parent",
    callID: "call_delegate",
    agent: input.agent ?? "coding",
    abort: input.abort ?? new AbortController().signal,
    extra: { model: { providerID: "test", id: "exact-parent-model" }, taskID: input.taskID },
    messages: [],
    metadata: () => {},
    ask: async () => {},
  }
}

describe("delegate_agent", () => {
  test("lets a Task-bound Work child review the same Task while reserving final delivery for the parent", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const parent = await Session.create({ kind: "assistant", title: "parent Work session" })
        let captured: Parameters<typeof SessionPrompt.prompt>[0] | undefined
        spyOn(SessionPrompt, "prompt").mockImplementation(async (input, hooks) => {
          captured = input
          await hooks?.beforeLoop?.()
          await beginChildOccurrence(input)
          return childReply(input, "The rendered slides pass the independent review.")
        })

        const tool = await DelegateAgentTool.init()
        await tool.execute(
          { instruction: "Independently validate the presentation and report visual findings." },
          context({ parentID: parent.id, agent: "work", taskID: "task_report_review" }),
        )

        expect(captured?.agent).toBe("work")
        expect(captured?.tools).toMatchObject({
          office_artifact_deliver: false,
        })
        expect(captured?.extra).toEqual({ taskID: "task_report_review" })
        expect((captured?.parts[0] as { text: string }).text).toContain("may inspect and validate office artifacts")
        const child = (await Session.children(parent.id))[0]!
        expect(PermissionNext.evaluate("office_artifact_deliver", "*", child.permission).action).toBe("deny")
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
          await beginChildOccurrence(input)
          return childReply(input, "Confirmed the boundary and reviewed the relevant files.")
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
          tools: {
            delegate_agent: false,
            batch: false,
            panel: false,
            schedule: false,
            mission_state: false,
            question: false,
            memory: false,
          },
        })
        expect(captured!.parts[0]).toMatchObject({ type: "text" })
        expect((captured!.parts[0] as { text: string }).text).toContain("This is not an engine task")

        const persistedChild = await Session.get(child.id)
        expect(PermissionNext.evaluate("bash", "*", persistedChild.permission).action).toBe("allow")
        expect(PermissionNext.evaluate("delegate_agent", "*", persistedChild.permission).action).toBe("deny")
        expect(PermissionNext.evaluate("batch", "*", persistedChild.permission).action).toBe("deny")
        expect(SessionStatus.get(child.id)).toEqual({ type: "terminal", reason: "completed" })
        expect(JSON.parse(result.output)).toEqual({
          kind: "terminal_success",
          session_id: child.id,
          final_message_id: `msg_delegate_reply_${child.id}`,
          handoff: "Confirmed the boundary and reviewed the relevant files.",
        })
      },
    })
  })
})
