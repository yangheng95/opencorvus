import { describe, expect, test } from "bun:test"
import z from "zod"
import {
  orchestratorCommittedDecisionInParts,
  orchestratorDecisionToolCompletionEffect,
} from "@/orchestrator/decision-tool-names"
import { SessionLoop } from "@/session/loop"
import {
  bindToolExecutionMode,
  ToolTurnExecutionConflictError,
  ToolTurnExecutionCoordinator,
  toolExecutionModeOf,
} from "@/tool/execution-mode"

const providerModel = {
  id: "tool-execution-mode-model",
  providerID: "tool-execution-mode-provider",
  name: "Tool execution mode",
  limit: { context: 1_000_000, input: 900_000, output: 4_096 },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: {
    toolcall: true,
    attachment: false,
    reasoning: false,
    temperature: true,
    input: { text: true, image: false, audio: false, video: false },
    output: { text: true, image: false, audio: false, video: false },
  },
  api: { id: "tool-execution-mode", npm: "@ai-sdk/anthropic" },
  options: {},
} as any

/**
 * The durable reduction accepts one assistant turn's decision set only when it
 * is a `dispatch_agent` fan-out or a single other decision. Anything mixed is
 * an integrity conflict that costs the turn its effect: the ingress rests in
 * `host_fault`, the reduction returns before any decision can be read, and only
 * a new operator message can redo the abandoned work. A model can emit that
 * combination in ordinary output, so it has to be refused before it becomes a
 * fact — and "a turn" means the persisted assistant Message, which outlives the
 * Provider step that resolves the Tool surface.
 */
describe("assistant-turn decision coordination", () => {
  async function attempt(coordinator: ToolTurnExecutionCoordinator, command: string, commits = true) {
    try {
      await coordinator.run("ordinary", async () => `${command}:ok`, { command, commits })
      return "committed"
    } catch (error) {
      return error instanceof ToolTurnExecutionConflictError ? "refused" : `unexpected:${String(error)}`
    }
  }

  test("admits a dispatch_agent fan-out", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    const outcomes = [
      await attempt(coordinator, "dispatch_agent"),
      await attempt(coordinator, "dispatch_agent"),
      await attempt(coordinator, "dispatch_agent"),
    ]
    expect(outcomes).toEqual(["committed", "committed", "committed"])
  })

  test("refuses a second, different decision in the same turn", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    expect([
      await attempt(coordinator, "dispatch_agent"),
      await attempt(coordinator, "wait"),
      await attempt(coordinator, "no_action"),
    ]).toEqual(["committed", "refused", "refused"])
  })

  test("refuses a dispatch that follows a settling decision", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    expect([await attempt(coordinator, "manage_task"), await attempt(coordinator, "dispatch_agent")]).toEqual([
      "committed",
      "refused",
    ])
  })

  test("never conflicts on Tools whose completion is not itself a decision", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    expect([
      // `question` and a coordination redispatch return an operator fact and
      // still owe the next decision, so they claim nothing.
      await attempt(coordinator, "question", false),
      await attempt(coordinator, "respond_agent_coordination", false),
      await attempt(coordinator, "wait"),
    ]).toEqual(["committed", "committed", "committed"])
  })

  test("continues from a Delivery Slice mutation into the scheduling decision", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    const mutationEffect = orchestratorDecisionToolCompletionEffect({
      tool: "manage_task",
      // Durable Tool projection carries the action-specific add_goal fields.
      stateInput: { goal: { title: "Deliver the accepted outcome" }, reason: "Current contract evidence" },
    })

    expect({
      mutationEffect,
      mutation: await attempt(coordinator, "manage_task", mutationEffect === "satisfies_current_epoch"),
      dispatch: await attempt(coordinator, "dispatch_agent"),
    }).toEqual({
      mutationEffect: "requires_followup_decision",
      mutation: "committed",
      dispatch: "committed",
    })
  })

  const completedToolPart = (tool: string, input: unknown = {}) => ({
    type: "tool",
    tool,
    state: { status: "completed", input },
  })

  test("carries the turn's decision across the Provider step that resolves a new surface", async () => {
    // The shipped fault, as the Host recorded it 43 times in one Base batch: a
    // Task-root assistant Message is retained across Provider steps, but a
    // coordinator is built per resolved Tool surface, so step two started with
    // no memory of step one's dispatch and `no_action` became a durable fact
    // beside it. The reduction then rejected the pair and the turn executed
    // nothing.
    const stepOne = new ToolTurnExecutionCoordinator()
    expect(await attempt(stepOne, "dispatch_agent")).toBe("committed")

    const persistedParts = [completedToolPart("dispatch_agent", { agent: "base-developer" })]
    const stepTwo = new ToolTurnExecutionCoordinator({
      committedDecision: orchestratorCommittedDecisionInParts(persistedParts),
    })
    expect(await attempt(stepTwo, "no_action")).toBe("refused")
    // A fan-out is still one decision, so it survives the step boundary too.
    expect(await attempt(stepTwo, "dispatch_agent")).toBe("committed")
  })

  test("seeds the claim from the Message's receipts, not from the step that wrote them", async () => {
    const settled = new ToolTurnExecutionCoordinator({
      committedDecision: orchestratorCommittedDecisionInParts([
        completedToolPart("manage_task", { action: "complete_task" }),
      ]),
    })
    expect([await attempt(settled, "dispatch_agent"), await attempt(settled, "no_action")]).toEqual([
      "refused",
      "refused",
    ])
  })

  test("reads a committed decision out of recorded Tool parts the way the reduction does", () => {
    expect(orchestratorCommittedDecisionInParts([])).toBeUndefined()
    expect(orchestratorCommittedDecisionInParts([{ type: "text" } as any])).toBeUndefined()
    // Still running, so nothing is committed yet.
    expect(
      orchestratorCommittedDecisionInParts([{ type: "tool", tool: "dispatch_agent", state: { status: "running" } }]),
    ).toBeUndefined()
    // Owes the next decision, so it claims nothing.
    expect(orchestratorCommittedDecisionInParts([completedToolPart("question", { question: "?" })])).toBeUndefined()
    expect(
      orchestratorCommittedDecisionInParts([completedToolPart("manage_task", { action: "add_goal" })]),
    ).toBeUndefined()
    // Unclassifiable recorded input is a call that failed on its own terms.
    expect(orchestratorCommittedDecisionInParts([completedToolPart("respond_agent_coordination", {})])).toBeUndefined()
    expect(orchestratorCommittedDecisionInParts([completedToolPart("no_action")])).toBe("no_action")
    expect(
      orchestratorCommittedDecisionInParts([
        completedToolPart("artifact_read", {}),
        completedToolPart("dispatch_agent", { agent: "base-tester" }),
      ]),
    ).toBe("dispatch_agent")
    expect(
      orchestratorCommittedDecisionInParts([
        completedToolPart("dispatch_agents", {
          team: [{ name: "a" }, { name: "b" }],
          dispatches: [{ dispatch: { target: "a" } }, { dispatch: { target: "b" } }],
        }),
      ]),
    ).toBe("dispatch_agents")
  })

  test("classifies every manage_task action by its durable scheduling effect", () => {
    const effect = (stateInput: Record<string, unknown>) =>
      orchestratorDecisionToolCompletionEffect({ tool: "manage_task", stateInput })

    expect({
      add: effect({ action: "add_goal", goal: {}, reason: "new scope" }),
      modify: effect({ action: "modify_goal", goalID: "gol_1", updates: {}, reason: "new evidence" }),
      remove: effect({ action: "delete_goal", goalID: "gol_1", reason: "obsolete" }),
      persistedAdd: effect({ goal: {}, reason: "new scope" }),
      persistedModify: effect({ goalID: "gol_1", updates: {}, reason: "new evidence" }),
      complete: effect({ action: "complete_task", summary: "accepted" }),
      fail: effect({ action: "fail_task", error: "terminal failure" }),
      cancel: effect({ action: "cancel_task", reason: "operator request" }),
    }).toEqual({
      add: "requires_followup_decision",
      modify: "requires_followup_decision",
      remove: "requires_followup_decision",
      persistedAdd: "requires_followup_decision",
      persistedModify: "requires_followup_decision",
      complete: "satisfies_current_epoch",
      fail: "satisfies_current_epoch",
      cancel: "satisfies_current_epoch",
    })
  })

  test("releases the claim when the first decision fails so the turn can still decide", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    const failed = await coordinator
      .run(
        "ordinary",
        async () => {
          throw new Error("dispatch adapter unavailable")
        },
        { command: "dispatch_agent", commits: true },
      )
      .then(() => "committed")
      .catch((error) => (error as Error).message)
    // A failed call leaves no completed receipt, so it is not in the durable
    // decision set and must not fence the turn's fallback decision.
    expect({ failed, fallback: await attempt(coordinator, "no_action") }).toEqual({
      failed: "dispatch adapter unavailable",
      fallback: "committed",
    })
  })

  test("preserves input-resolved execution modes through provider preparation and coordination", async () => {
    const actionAware = bindToolExecutionMode(
      {
        inputSchema: z.object({ action: z.enum(["query", "mutation"]) }),
        async execute(args: { action: "query" | "mutation" }) {
          return { title: args.action, output: args.action, metadata: {} }
        },
      } as any,
      (args) => ((args as { action: string }).action === "query" ? "ordinary" : "turn_control_exclusive"),
    )
    const prepared = SessionLoop.prepareProviderTool({
      name: "action_aware",
      source: "extra",
      model: providerModel,
      tool: actionAware,
    })
    const queryInput = { action: "query" }
    const mutationInput = { action: "mutation" }
    const coordinator = new ToolTurnExecutionCoordinator()
    const order: string[] = []
    let releaseQuery!: () => void
    let markQueryStarted!: () => void
    const queryGate = new Promise<void>((resolve) => (releaseQuery = resolve))
    const queryStarted = new Promise<void>((resolve) => (markQueryStarted = resolve))
    const query = coordinator.run(toolExecutionModeOf(prepared as object, queryInput), async () => {
      order.push("query:start")
      markQueryStarted()
      await queryGate
      order.push("query:end")
      return prepared.execute!(queryInput, {
        toolCallId: "call_action_query",
        messages: [],
        abortSignal: new AbortController().signal,
      })
    })
    await queryStarted
    const mutation = coordinator.run(toolExecutionModeOf(prepared as object, mutationInput), async () => {
      order.push("mutation:start")
      const result = await prepared.execute!(mutationInput, {
        toolCallId: "call_action_mutation",
        messages: [],
        abortSignal: new AbortController().signal,
      })
      order.push("mutation:end")
      return result
    })
    await Promise.resolve()
    releaseQuery()
    const [queryResult, mutationResult] = await Promise.all([query, mutation])

    expect({
      modes: {
        query: toolExecutionModeOf(prepared as object, queryInput),
        mutation: toolExecutionModeOf(prepared as object, mutationInput),
      },
      order,
      outputs: [queryResult.output, mutationResult.output],
    }).toEqual({
      modes: { query: "ordinary", mutation: "turn_control_exclusive" },
      order: ["query:start", "query:end", "mutation:start", "mutation:end"],
      outputs: ["query", "mutation"],
    })
  })
})
