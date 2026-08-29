import { afterEach, describe, expect, test } from "bun:test"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { MessageStore } from "@/session/message-store"
import { DispatchAgentsToolTestHooks } from "@/orchestrator/dispatch-agents-tool"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import z from "zod"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function allErrorMessages(error: unknown): string[] {
  if (error instanceof AggregateError) return [error.message, ...error.errors.flatMap(allErrorMessages)]
  return [error instanceof Error ? error.message : String(error)]
}

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
    dispatches: targets.map((target) => ({ dispatch: { target } })),
  }
}

describe("dispatch_agents durable child settlement", () => {
  test("reuses a completed child and resumes the remaining persisted frontier occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "orchestrator", title: "Partial frontier replay" })
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
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        const outerPartID = Identifier.ascending("part")
        const input = frontierInput(["a", "b"])
        const completed = DispatchOutcome.accepted({
          sessionID: Identifier.descending("session"),
          dispatchLineageID: Identifier.ascending("artifact"),
        })
        const startedAt = Date.now()
        const originalRunningStart = startedAt - 60_000
        await Session.updatePart({
          id: Identifier.deterministic("part", `dispatch-agents\0${outerPartID}\0${0}`),
          sessionID: session.id,
          messageID,
          type: "tool",
          callID: Identifier.deterministic("call", `dispatch-agents\0${outerPartID}\0${0}`),
          tool: "dispatch_agent",
          state: {
            status: "completed",
            input: input.dispatches[0],
            output: JSON.stringify(completed),
            title: "Dispatched a",
            metadata: {},
            time: { start: startedAt, end: startedAt + 1 },
          },
        })
        await Session.updatePart({
          id: Identifier.deterministic("part", `dispatch-agents\0${outerPartID}\0${1}`),
          sessionID: session.id,
          messageID,
          type: "tool",
          callID: Identifier.deterministic("call", `dispatch-agents\0${outerPartID}\0${1}`),
          tool: "dispatch_agent",
          state: { status: "running", input: input.dispatches[1], time: { start: originalRunningStart } },
        })
        const executedTargets: string[] = []
        const resumed = DispatchOutcome.accepted({
          sessionID: Identifier.descending("session"),
          dispatchLineageID: Identifier.ascending("artifact"),
        })
        const frontier = DispatchAgentsToolTestHooks.create({
          inputSchema: z.object({ dispatch: z.object({ target: z.string() }).strict() }).strict(),
          execute: async (request: { dispatch: { target: string } }) => {
            executedTargets.push(request.dispatch.target)
            return resumed
          },
        }, {})
        if (!frontier.execute) throw new Error("dispatch_agents has no executor")
        const result = await frontier.execute(input as never, {
          toolCallId: outerPartID,
          opencorvus: {
            sessionID: session.id,
            messageID,
            toolCallID: outerPartID,
            toolPartID: outerPartID,
            visibleToolName: "dispatch_agents",
          },
        } as never)
        expect(executedTargets).toEqual(["b"])
        expect((result as { metadata: { dispatches: unknown[]; member_names: string[] } }).metadata).toMatchObject({
          dispatches: [completed, resumed],
          member_names: ["member-1", "member-2"],
        })
        const settledChildren = (await MessageStore.parts(messageID)).filter(
          (part): part is import("@/session/message").Message.ToolPart =>
            part.type === "tool" && part.tool === "dispatch_agent",
        )
        expect(settledChildren.map((part) => part.state.status)).toEqual(["completed", "completed"])
        expect(settledChildren[1]?.state.time.start).toBe(originalRunningStart)
      },
    })
  })

  test("settles the exact outer and child Parts when deterministic recovery preflight fails", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "orchestrator", title: "Frontier recovery preflight" })
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
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        const outerPartID = Identifier.ascending("part")
        const input = frontierInput(["a"])
        await Session.updatePart({
          id: outerPartID,
          sessionID: session.id,
          messageID,
          type: "tool",
          callID: outerPartID,
          tool: "dispatch_agents",
          state: { status: "running", input, time: { start: Date.now() - 2_000 } },
        })
        const childPartID = Identifier.deterministic("part", `dispatch-agents\0${outerPartID}\0${0}`)
        await Session.updatePart({
          id: childPartID,
          sessionID: session.id,
          messageID,
          type: "tool",
          callID: Identifier.deterministic("call", `dispatch-agents\0${outerPartID}\0${0}`),
          tool: "dispatch_agent",
          state: { status: "running", input: input.dispatches[0], time: { start: Date.now() - 1_000 } },
        })
        expect(await SessionLoop.terminalizeRecoveredIncompleteAssistant(session.id)).toBe(true)
        const settled = await MessageStore.parts(messageID)
        expect(
          settled
            .filter((part) => part.type === "tool" && (part.id === outerPartID || part.id === childPartID))
            .map((part) => ({ id: part.id, status: part.state.status })),
        ).toEqual([
          { id: outerPartID, status: "error" },
          { id: childPartID, status: "error" },
        ])
      },
    })
  })

  test("preserves the exact caller abort and leaves frontier occurrences recoverable", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "orchestrator", title: "Frontier caller abort" })
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
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        const outerPartID = Identifier.ascending("part")
        const input = frontierInput(["a"])
        await Session.updatePart({
          id: outerPartID,
          sessionID: session.id,
          messageID,
          type: "tool",
          callID: outerPartID,
          tool: "dispatch_agents",
          state: { status: "running", input, time: { start: Date.now() } },
        })
        const controller = new AbortController()
        const abortReason = new DOMException("caller stopped frontier recovery", "AbortError")
        const frontier = DispatchAgentsToolTestHooks.create({
          inputSchema: z.object({ dispatch: z.object({ target: z.string() }).strict() }).strict(),
          execute: async () => {
            controller.abort(abortReason)
            controller.signal.throwIfAborted()
          },
        }, {})
        if (!frontier.execute) throw new Error("dispatch_agents has no executor")
        let failure: unknown
        try {
          await frontier.execute(input as never, {
            toolCallId: outerPartID,
            abortSignal: controller.signal,
            opencorvus: {
              sessionID: session.id,
              messageID,
              toolCallID: outerPartID,
              toolPartID: outerPartID,
              visibleToolName: "dispatch_agents",
            },
          } as never)
        } catch (error) {
          failure = error
        }
        expect(failure).toBe(abortReason)
        expect(
          (await MessageStore.parts(messageID))
            .filter((part) => part.type === "tool")
            .map((part) => ({ tool: part.tool, status: part.state.status })),
        ).toEqual([
          { tool: "dispatch_agents", status: "running" },
          { tool: "dispatch_agent", status: "running" },
        ])
      },
    })
  })

  test("settles every prepared child when a later preparation write fails", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "orchestrator", title: "Frontier preparation failure" })
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
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        const outerPartID = Identifier.ascending("part")
        const input = frontierInput(["a", "b", "c"])
        await Session.updatePart({
          id: outerPartID,
          sessionID: session.id,
          messageID,
          type: "tool",
          callID: outerPartID,
          tool: "dispatch_agents",
          state: { status: "running", input, time: { start: Date.now() } },
        })
        let runningWrites = 0
        const frontier = DispatchAgentsToolTestHooks.create(
          {
            inputSchema: z.object({ dispatch: z.object({ target: z.string() }).strict() }).strict(),
            execute: async () => DispatchOutcome.accepted({
              sessionID: Identifier.descending("session"),
              dispatchLineageID: Identifier.ascending("artifact"),
            }),
          },
          {
            updatePart: async (part) => {
              if (part.type === "tool" && part.tool === "dispatch_agent" && part.state.status === "running") {
                runningWrites += 1
                if (runningWrites === 3) throw new Error("injected preparation write failure")
              }
              return await Session.updatePart(part)
            },
          },
        )
        if (!frontier.execute) throw new Error("dispatch_agents has no executor")
        let failure: unknown
        try {
          await frontier.execute(input as never, {
            toolCallId: outerPartID,
            opencorvus: {
              sessionID: session.id,
              messageID,
              toolCallID: outerPartID,
              toolPartID: outerPartID,
              visibleToolName: "dispatch_agents",
            },
          } as never)
        } catch (error) {
          failure = error
        }
        expect(allErrorMessages(failure)).toContain("injected preparation write failure")
        expect(
          (await MessageStore.parts(messageID))
            .filter((part) => part.type === "tool" && part.tool === "dispatch_agent")
            .map((part) => part.state.status),
        ).toEqual(["error", "error"])
      },
    })
  })

  test("preserves dispatch failures while attempting every child terminal write", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "orchestrator", title: "Frontier settlement failure" })
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
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        const outerPartID = Identifier.ascending("part")
        const input = frontierInput(["a", "b", "c"])
        await Session.updatePart({
          id: outerPartID,
          sessionID: session.id,
          messageID,
          type: "tool",
          callID: outerPartID,
          tool: "dispatch_agents",
          state: { status: "running", input, time: { start: Date.now() } },
        })
        const terminalAttempts: string[] = []
        const frontier = DispatchAgentsToolTestHooks.create(
          {
            inputSchema: z.object({ dispatch: z.object({ target: z.string() }).strict() }).strict(),
            execute: async (request: { dispatch: { target: string } }) => {
              throw new Error(`dispatch primary ${request.dispatch.target}`)
            },
          },
          {
            updatePart: async (part) => {
              if (part.type === "tool" && part.tool === "dispatch_agent" && part.state.status === "error") {
                const target = String((part.state.input as { dispatch?: { target?: unknown } }).dispatch?.target)
                terminalAttempts.push(target)
                if (target === "b") throw new Error("injected terminal write failure b")
              }
              return await Session.updatePart(part)
            },
          },
        )
        if (!frontier.execute) throw new Error("dispatch_agents has no executor")
        let failure: unknown
        try {
          await frontier.execute(input as never, {
            toolCallId: outerPartID,
            opencorvus: {
              sessionID: session.id,
              messageID,
              toolCallID: outerPartID,
              toolPartID: outerPartID,
              visibleToolName: "dispatch_agents",
            },
          } as never)
        } catch (error) {
          failure = error
        }
        expect(terminalAttempts.toSorted()).toEqual(["a", "b", "c"])
        expect(allErrorMessages(failure)).toEqual(
          expect.arrayContaining([
            expect.stringContaining("dispatch primary a"),
            expect.stringContaining("dispatch primary b"),
            expect.stringContaining("dispatch primary c"),
            "injected terminal write failure b",
          ]),
        )
      },
    })
  })
})
