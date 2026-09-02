import { afterEach, describe, expect, test } from "bun:test"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { Identifier } from "@/id/id"
import { DispatchAgentsToolTestHooks } from "@/orchestrator/dispatch-agents-tool"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { MessageStore } from "@/session/message-store"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import z from "zod"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function frontierInput(targets: readonly string[]) {
  return {
    team: targets.map((target, index) => ({
      name: `member-${index + 1}`,
      target,
      responsibility: `Own the bounded ${target} responsibility`,
      boundary: `Operate only on the ${target} partition`,
      expected_result: `Return the evidenced ${target} result`,
      depends_on: [],
    })),
    dispatches: targets.map((target) => ({
      dispatch: {
        target,
        work_scope: { kind: "task" as const },
        turn: {
          kind: "initial" as const,
          workflow_subject: { kind: "direct" as const },
          use_worktree: false,
          input: {},
        },
      },
    })),
  }
}

async function persistedOuter(input: ReturnType<typeof frontierInput>) {
  const session = await Session.create({ kind: "orchestrator", title: "Canonical dispatch collection" })
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "user",
    author: "user",
    agent: "orchestrator",
    model: { providerID: "test", modelID: "test" },
    time: { created: Date.now() },
  })
  const messageID = Identifier.ascending("message")
  await Session.updateMessage({
    id: messageID,
    parentID: user.id,
    sessionID: session.id,
    role: "assistant",
    author: "orchestrator",
    agent: "orchestrator",
    providerID: "test",
    modelID: "test",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() },
  })
  const partID = Identifier.ascending("part")
  const callID = Identifier.ascending("call")
  await Session.updatePart({
    id: partID,
    sessionID: session.id,
    messageID,
    type: "tool",
    callID,
    tool: "dispatch_agents",
    state: { status: "running", input, time: { start: Date.now() } },
  })
  return { sessionID: session.id, messageID, partID, callID }
}

function executionOptions(identity: Awaited<ReturnType<typeof persistedOuter>>, signal?: AbortSignal) {
  return {
    toolCallId: identity.callID,
    ...(signal ? { abortSignal: signal } : {}),
    opencorvus: {
      sessionID: identity.sessionID,
      messageID: identity.messageID,
      toolCallID: identity.callID,
      toolPartID: identity.partID,
      visibleToolName: "dispatch_agents",
    },
  }
}

const childSchema = z
  .object({
    dispatch: z
      .object({
        target: z.string(),
        work_scope: z.object({ kind: z.literal("task") }).strict(),
        turn: z
          .object({
            kind: z.literal("initial"),
            workflow_subject: z.object({ kind: z.literal("direct") }).strict(),
            use_worktree: z.boolean(),
            input: z.record(z.string(), z.unknown()),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()

describe("dispatch_agents canonical collection occurrence", () => {
  test("binds every member to the one persisted model-authored Tool occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const input = frontierInput(["a", "b"])
        const identity = await persistedOuter(input)
        const invocations: unknown[] = []
        const frontier = DispatchAgentsToolTestHooks.create(
          {
            inputSchema: childSchema,
            execute: async (_request: unknown, options: unknown) => {
              invocations.push(options)
              return DispatchOutcome.accepted({
                sessionID: Identifier.descending("session"),
                dispatchLineageID: Identifier.ascending("artifact"),
              })
            },
          },
          {},
          childSchema,
        )
        if (!frontier.execute) throw new Error("dispatch_agents has no executor")
        const result = (await frontier.execute(input as never, executionOptions(identity) as never)) as {
          output: string
          metadata: { completed_count: number; member_names: string[] }
        }
        expect(invocations.map((options) => (options as any).opencorvus)).toEqual([
          {
            sessionID: identity.sessionID,
            messageID: identity.messageID,
            toolCallID: identity.callID,
            toolPartID: identity.partID,
            visibleToolName: "dispatch_agents",
            collectionMember: { index: 0, count: 2 },
          },
          {
            sessionID: identity.sessionID,
            messageID: identity.messageID,
            toolCallID: identity.callID,
            toolPartID: identity.partID,
            visibleToolName: "dispatch_agents",
            collectionMember: { index: 1, count: 2 },
          },
        ])
        expect(result.metadata).toMatchObject({ completed_count: 2, member_names: ["member-1", "member-2"] })
        expect(JSON.parse(result.output).members.map((member: any) => member.member_index)).toEqual([0, 1])
        expect(
          (await MessageStore.parts(identity.messageID)).map((part) => ({
            id: part.id,
            tool: part.type === "tool" ? part.tool : part.type,
            status: part.type === "tool" ? part.state.status : undefined,
          })),
        ).toEqual([{ id: identity.partID, tool: "dispatch_agents", status: "running" }])
      },
    })
  })

  test("replays settled member checkpoints from the exact outer input", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const input = frontierInput(["a", "b", "c"])
        const identity = await persistedOuter(input)
        const observed: string[] = []
        const frontier = DispatchAgentsToolTestHooks.create(
          {
            inputSchema: childSchema,
            execute: async (request: { dispatch: { target: string } }, options: any) => {
              observed.push(`${request.dispatch.target}:${options.opencorvus.collectionMember.index}`)
              return DispatchOutcome.accepted({
                sessionID: Identifier.descending("session"),
                dispatchLineageID: Identifier.ascending("artifact"),
              })
            },
          },
          {},
          childSchema,
        )
        if (!frontier.execute) throw new Error("dispatch_agents has no executor")
        const first = await frontier.execute(input as never, executionOptions(identity) as never)
        const replay = await frontier.execute(input as never, executionOptions(identity) as never)
        expect({ observed, first, replay }).toEqual({
          observed: ["a:0", "b:1", "c:2"],
          first,
          replay: first,
        })
      },
    })
  })

  test("returns the exact collection-identity error for replay input drift", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const persisted = frontierInput(["a"])
        const identity = await persistedOuter(persisted)
        const frontier = DispatchAgentsToolTestHooks.create(
          {
            inputSchema: childSchema,
            execute: async () =>
              DispatchOutcome.accepted({
                sessionID: Identifier.descending("session"),
                dispatchLineageID: Identifier.ascending("artifact"),
              }),
          },
          {},
          childSchema,
        )
        if (!frontier.execute) throw new Error("dispatch_agents has no executor")
        await expect(
          frontier.execute(frontierInput(["b"]) as never, executionOptions(identity) as never),
        ).rejects.toThrow(
          `dispatch_agents persisted occurrence ${identity.partID}/${identity.callID} does not match its exact collection input`,
        )
      },
    })
  })

  test("completes one collection result with exact typed member failures", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const input = frontierInput(["a", "b"])
        const identity = await persistedOuter(input)
        const frontier = DispatchAgentsToolTestHooks.create(
          {
            inputSchema: childSchema,
            execute: async (request: { dispatch: { target: string } }) => {
              if (request.dispatch.target === "b") throw new Error("member b admission failed")
              return DispatchOutcome.accepted({
                sessionID: Identifier.descending("session"),
                dispatchLineageID: Identifier.ascending("artifact"),
              })
            },
          },
          {},
          childSchema,
        )
        if (!frontier.execute) throw new Error("dispatch_agents has no executor")
        const result = (await frontier.execute(input as never, executionOptions(identity) as never)) as {
          output: string
          metadata: { completed_count: number }
        }
        const members = JSON.parse(result.output).members
        expect(result.metadata.completed_count).toBe(1)
        expect(members.map((member: any) => ({ index: member.member_index, status: member.status }))).toEqual([
          { index: 0, status: "completed" },
          { index: 1, status: "failed" },
        ])
        expect(members[1].failure.message).toContain("member b admission failed")
      },
    })
  })

  test("preserves caller cancellation for recovery of the same outer occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const input = frontierInput(["a"])
        const identity = await persistedOuter(input)
        const controller = new AbortController()
        const reason = new DOMException("caller stopped collection", "AbortError")
        const frontier = DispatchAgentsToolTestHooks.create(
          {
            inputSchema: childSchema,
            execute: async () => {
              controller.abort(reason)
              controller.signal.throwIfAborted()
            },
          },
          {},
          childSchema,
        )
        if (!frontier.execute) throw new Error("dispatch_agents has no executor")
        let failure: unknown
        try {
          await frontier.execute(input as never, executionOptions(identity, controller.signal) as never)
        } catch (error) {
          failure = error
        }
        expect(failure).toBe(reason)
        expect((await MessageStore.parts(identity.messageID))[0]).toMatchObject({
          id: identity.partID,
          tool: "dispatch_agents",
          state: { status: "running" },
        })
      },
    })
  })

  test("settles the real outer occurrence when recovery has no Task authority", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const input = frontierInput(["a"])
        const identity = await persistedOuter(input)
        expect(await SessionLoop.terminalizeRecoveredIncompleteAssistant(identity.sessionID)).toBe(true)
        expect((await MessageStore.parts(identity.messageID))[0]).toMatchObject({
          id: identity.partID,
          tool: "dispatch_agents",
          state: { status: "error" },
        })
      },
    })
  })
})
