/**
 * The Orchestrator's public Tool surface is assembled by `createOrchestratorTools`,
 * but two separate declarations describe it from the outside:
 *
 *  1. `ORCHESTRATOR_SCHEDULER_PROJECTABLE_TOOL_IDS` tells expert-squad manifest
 *     validation which scheduler `built_in_tool_ids` are legal. When it names a
 *     tool the factory never builds, `projectOrchestratorTools` throws at task
 *     start and every Task on that squad dies within seconds (observed:
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
import { createOrchestratorTools } from "../src/orchestrator/tools"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Database } from "../src/storage/db"
import {
  ToolTurnExecutionConflictError,
  ToolTurnExecutionCoordinator,
  toolDecisionDeclarationOf,
  toolExecutionModeOf,
} from "../src/tool/execution-mode"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

async function orchestratorToolSurface(title: string) {
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
  return { taskID, tools: tools as Record<string, object> }
}

test("builds every scheduler-projectable built-in Tool an expert-squad manifest may declare", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { tools } = await orchestratorToolSurface("Scheduler projectable tool surface")
      const built = new Set(Object.keys(tools))
      const missing = [...new Set(ORCHESTRATOR_SCHEDULER_PROJECTABLE_TOOL_IDS)].filter((id) => !built.has(id))

      // A projectable ID the factory never builds is not a lint nit: manifest
      // validation accepts it and `projectOrchestratorTools` then throws on the
      // first wake, failing the Task before any work starts.
      expect(missing).toEqual([])
    },
  })
})

test("keeps the decision declaration on every Orchestrator decision Tool on the assembled surface", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { tools } = await orchestratorToolSurface("Decision declaration survival")
      const undeclared = ORCHESTRATOR_DECISION_TOOL_NAMES.filter(
        (name) => toolDecisionDeclarationOf(tools[name]) === undefined,
      )

      expect(undeclared).toEqual([])
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
      const { tools } = await orchestratorToolSurface("Mixed decision refusal")
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
