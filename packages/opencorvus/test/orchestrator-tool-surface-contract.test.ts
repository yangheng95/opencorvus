/**
 * The Orchestrator's public Tool surface is assembled by `createOrchestratorTools`,
 * but two separate declarations describe it from the outside:
 *
 *  1. `ORCHESTRATOR_SCHEDULER_PROJECTABLE_TOOL_IDS` tells expert-squad manifest
 *     validation which scheduler Tool capability refs are legal. When it names a
 *     tool the exact factory never builds, scheduler materialization fails at
 *     task start and every Task on that squad dies within seconds (observed:
 *     research-studio projecting `browser_preview_capture`).
 *  2. The decision declarations bound to each `ORCHESTRATOR_DECISION_TOOL_NAMES`
 *     entry let `ToolTurnExecutionCoordinator` refuse a mixed decision set while
 *     it is still only a call. They live in a WeakMap keyed by the Tool object,
 *     so the assembled surface must expose the exact bound objects — any
 *     re-wrap that copies a Tool drops its bindings silently, and a completed
 *     `dispatch_agent` + `wait` turn then settles as a `host_fault` ingress
 *     whose work is abandoned — before the head-of-line release it wedged the
 *     Task outright until an operator retried it (observed with the
 *     since-deleted terminal-authority wrapper).
 *
 * Both are cross-module invariants that unit tests of the coordinator class and
 * of manifest resolution each pass individually. These assert them against the
 * real assembled surface.
 */
import { afterAll, expect, test } from "bun:test"
import { ORCHESTRATOR_SCHEDULER_PROJECTABLE_TOOL_IDS } from "../src/agent/tool-pool-data"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "../src/engine/task-lifecycle"
import { Identifier } from "../src/id/id"
import { ORCHESTRATOR_DECISION_TOOL_NAMES } from "../src/orchestrator/decision-tool-names"
import { createOrchestratorTools, OrchestratorToolsTestHooks } from "../src/orchestrator/tools"
import { Instance } from "../src/project/instance"
import { sendSchedulerMessage } from "../src/protocol/scheduler-message"
import { Session } from "../src/session"
import { Database } from "../src/storage/db"
import {
  ToolTurnExecutionConflictError,
  ToolTurnExecutionCoordinator,
  toolDecisionDeclarationOf,
  toolExecutionModeOf,
} from "../src/tool/execution-mode"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { ToolRegistry } from "../src/tool/registry"

afterAll(async () => {
  await resetMemoryDatabase()
})

async function orchestratorToolSurface(
  title: string,
  schedulerMessageSender: typeof sendSchedulerMessage,
  exactToolID?: string,
) {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({ kind: "root", title })
  const now = Date.now()
  Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "code",
        title,
        request: "Assemble the public Orchestrator Tool surface.",
        time_started: now,
        time_created: now,
        time_updated: now,
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.tool-surface-contract" })
  })

  const { tools } = createOrchestratorTools({
    taskID,
    agentSessionID: root.id,
    sendSchedulerMessage: schedulerMessageSender,
    exactToolID,
    dispatchAgents: [
      {
        identity: {
          agentID: "base-developer",
          baseRole: "build",
          sessionKind: "build",
          dispatchAdapterID: "build",
          runtimeTemplateABIVersion: 1,
          dispatchAdapterABIVersion: 1,
          projectionHash: "b".repeat(64),
        },
        packageRevision: {
          scope: "built_in",
          projectID: null,
          namespace: "opencorvus",
          id: "base",
          version: "1.0.0",
          packageDigest: "a".repeat(64),
        },
        virtualWorkflows: {},
        capabilityOwner: "platform",
        label: "orchestrator-tool-surface-contract",
        builtInToolIDs: [],
        projectedToolIDs: [],
      } as never,
    ],
  })
  return { taskID, root, tools: tools as Record<string, object> }
}

test("materializes only the exact scheduler Tool leaf selected by its runtime factory", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const materialized: string[] = []
      using observer = OrchestratorToolsTestHooks.replaceToolFactoryObserver((toolID) => {
        materialized.push(toolID)
      })
      const first = await orchestratorToolSurface("Exact read-context scheduler leaf", sendSchedulerMessage, "read_context")
      expect(Object.keys(first.tools)).toEqual(["read_context"])
      expect(materialized).toEqual(["read_context"])

      const second = await orchestratorToolSurface("Exact wait scheduler leaf", sendSchedulerMessage, "wait")
      expect(Object.keys(second.tools)).toEqual(["wait"])
      expect(materialized).toEqual(["read_context", "wait"])
    },
  })
})

test("builds every scheduler-projectable built-in Tool an expert-squad manifest may declare", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { tools } = await orchestratorToolSurface("Scheduler projectable tool surface", sendSchedulerMessage)
      const built = new Set(Object.keys(tools))
      const factoryOwned = [...new Set(ORCHESTRATOR_SCHEDULER_PROJECTABLE_TOOL_IDS)].filter(
        (id) => id !== "capability_search",
      )
      expect(factoryOwned.map((id) => built.has(id))).toEqual(factoryOwned.map(() => true))
      expect(await ToolRegistry.ids()).toContain("capability_search")
    },
  })
})

test("keeps the decision declaration on every Orchestrator decision Tool on the assembled surface", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { tools } = await orchestratorToolSurface("Decision declaration survival", sendSchedulerMessage)
      expect(ORCHESTRATOR_DECISION_TOOL_NAMES.map((name) => toolDecisionDeclarationOf(tools[name])?.command)).toEqual([
        ...ORCHESTRATOR_DECISION_TOOL_NAMES,
      ])
      // The assembled surface carries execution mode; `wait` parks the turn.
      expect(toolExecutionModeOf(tools.wait)).toBe("turn_control_exclusive")
    },
  })
})

test("refuses a wait decision that joins a dispatch_agent turn on the assembled surface", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { tools } = await orchestratorToolSurface("Mixed decision refusal", sendSchedulerMessage)
      const coordinator = new ToolTurnExecutionCoordinator()
      const admit = (name: (typeof ORCHESTRATOR_DECISION_TOOL_NAMES)[number], args: unknown) => {
        const declaration = toolDecisionDeclarationOf(tools[name])
        if (!declaration) throw new Error(`${name} lost its decision declaration`)
        return coordinator.run(toolExecutionModeOf(tools[name]), async () => name, {
          command: declaration.command,
          commits: declaration.commits(args),
        })
      }

      expect(await admit("dispatch_agent", { target_agent_id: "base-developer" })).toBe("dispatch_agent")
      // A second dispatch_agent is a legal fan-out; `wait` is the mixed set the
      // durable reduction would have to call an integrity conflict.
      expect(await admit("dispatch_agent", { target_agent_id: "base-developer" })).toBe("dispatch_agent")
      await expect(admit("wait", { duration_ms: 1_000, reason: "poll" })).rejects.toBeInstanceOf(
        ToolTurnExecutionConflictError,
      )
    },
  })
})

test("routes the scheduler_message Tool through the exact injected sender port", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      let observed: Parameters<typeof sendSchedulerMessage>[0] | undefined
      const expectedReceipt = { marker: "injected-scheduler-message-receipt" } as unknown as Awaited<
        ReturnType<typeof sendSchedulerMessage>
      >
      const observingSender: typeof sendSchedulerMessage = async (input) => {
        observed = input
        return expectedReceipt
      }
      const { taskID, root, tools } = await orchestratorToolSurface(
        "Injected scheduler Message sender",
        observingSender,
      )
      const now = Date.now()
      const user = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: root.id,
        role: "user",
        author: "user",
        time: { created: now },
        agent: "orchestrator",
        model: { providerID: "test", modelID: "test" },
      })
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        parentID: user.id,
        sessionID: root.id,
        role: "assistant",
        author: "orchestrator",
        agent: "orchestrator",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        modelID: "test",
        providerID: "test",
        time: { created: now + 1 },
      })
      const toolCallID = "call_injected_scheduler_message"
      const toolPart = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: root.id,
        messageID: assistant.id,
        type: "tool",
        callID: toolCallID,
        tool: "scheduler_message",
        state: {
          status: "running",
          input: {
            kind: "notification",
            target: { kind: "task", task_id: taskID },
            subject: "Injected sender authority",
            message: "Use the exact production composition port.",
          },
          time: { start: now + 2 },
        },
      })
      const result = await (tools.scheduler_message as any).execute(
        {
          kind: "notification",
          target: { kind: "task", task_id: taskID },
          subject: "Injected sender authority",
          message: "Use the exact production composition port.",
        },
        {
          toolCallId: toolCallID,
          messages: [],
          abortSignal: new AbortController().signal,
          opencorvus: {
            sessionID: root.id,
            messageID: assistant.id,
            toolCallID,
            toolPartID: toolPart.id,
            visibleToolName: "scheduler_message",
          },
        },
      )

      expect(result).toBe(expectedReceipt)
      expect(observed).toEqual({
        invocationID: `scheduler-message:${root.id}:${assistant.id}:${toolCallID}`,
        kind: "notification",
        source: {
          kind: "task_scheduler",
          project_id: Instance.project.id,
          task_id: taskID,
          root_session_id: root.id,
        },
        target: {
          kind: "task_scheduler",
          project_id: Instance.project.id,
          task_id: taskID,
          root_session_id: root.id,
        },
        replyTo: undefined,
        subject: "Injected sender authority",
        sourceMessageID: assistant.id,
        sourcePartID: toolPart.id,
      })
    },
  })
})
