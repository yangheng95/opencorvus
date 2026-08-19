import { afterAll, expect, test } from "bun:test"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "../src/engine/task-lifecycle"
import { Identifier } from "../src/id/id"
import { createOrchestratorTools } from "../src/orchestrator/tools"
import { TASK_ARTIFACT_SCHEDULER_TOOL_IDS } from "../src/tool/tool-id-catalog"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Database } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

test("projects terminal acknowledgement into the exact host-authorized coordination schema", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Terminal coordination schema" })
      const now = Date.now()
      Database.immediateTransaction((db) => {
        db.insert(EngineTaskTable)
          .values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: root.id,
            source: "test",
            product_pillar: "code",
            title: "Terminal coordination schema",
            request: "Project the host-authorized terminal acknowledgement action.",
            time_started: now,
            time_created: now,
            time_updated: now,
          })
          .run()
        appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.terminal-schema" })
      })

      const requestID = Identifier.ascending("artifact")
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
            label: "terminal-coordination-schema",
            builtInToolIDs: [],
            projectedToolIDs: [],
          } as never,
        ],
        terminalConversationAuthority: {
          taskID,
          ingressID: Identifier.ascending("artifact"),
          ingressKind: "coordination_request",
          coordinationRequestID: requestID,
          terminalLifecycleReference: {
            terminalEventID: Identifier.ascending("protocol_event"),
            terminalStatus: "cancelled",
            timeCompleted: now,
          },
        },
      })
      const schema = (tools.respond_agent_coordination as { inputSchema: { parse(input: unknown): unknown } })
        .inputSchema

      expect(
        schema.parse({
          request_id: requestID,
          decision: "acknowledge_terminal",
          reason: "Acknowledge the exact terminal occurrence authorized by the Host.",
        }),
      ).toEqual({
        request_id: requestID,
        decision: "acknowledge_terminal",
        reason: "Acknowledge the exact terminal occurrence authorized by the Host.",
      })

      // Tool availability follows the real environment, never the Task's
      // terminal color. The authority still decides what it actually governs:
      // the coordination decision set, and the acknowledge_terminal identity
      // and occurrence fence checked when the decision executes.
      expect(tools.dispatch_agent).toBeDefined()
      expect(tools.manage_task).toBeDefined()
      expect(tools.no_action).toBeDefined()
    },
  })
})

// Regression: the scheduler capability declares TASK_ARTIFACT_SCHEDULER_TOOL_IDS
// and publish_interactive_artifact unconditionally, and projectOrchestratorTools
// throws when a declared Tool was not built. A terminal-only crop of the built
// table therefore failed every terminal wake before the model saw anything.
test("builds every declared scheduler Tool on a terminal conversation wake", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Terminal scheduler tool table" })
      const now = Date.now()
      Database.immediateTransaction((db) => {
        db.insert(EngineTaskTable)
          .values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: root.id,
            source: "test",
            product_pillar: "code",
            title: "Terminal scheduler tool table",
            request: "Build the declared scheduler Tool table for a terminal wake.",
            time_started: now,
            time_created: now,
            time_updated: now,
          })
          .run()
        appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.terminal-tool-table" })
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
            label: "terminal-scheduler-tool-table",
            builtInToolIDs: [],
            projectedToolIDs: [],
          } as never,
        ],
        terminalConversationAuthority: {
          taskID,
          ingressID: Identifier.ascending("artifact"),
          ingressKind: "operator_message",
          coordinationRequestID: null,
          terminalLifecycleReference: {
            terminalEventID: Identifier.ascending("protocol_event"),
            terminalStatus: "completed",
            timeCompleted: now,
          },
        },
      })

      for (const toolID of [...TASK_ARTIFACT_SCHEDULER_TOOL_IDS, "publish_interactive_artifact"])
        expect(Object.hasOwn(tools, toolID)).toBe(true)
    },
  })
})
