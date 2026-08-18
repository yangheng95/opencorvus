import { afterAll, expect, test } from "bun:test"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "../src/engine/task-lifecycle"
import { Identifier } from "../src/id/id"
import { createOrchestratorTools, projectTerminalConversationTools } from "../src/orchestrator/tools"
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

      // Authority by projection: what a conversation-only Turn must not do is
      // simply not on its table. There is no wrapped refusal to loop on.
      expect(tools.dispatch_agent).toBeUndefined()
      expect(tools.manage_task).toBeUndefined()
      expect(tools.wait).toBeUndefined()
      expect(tools.no_action).toBeUndefined()
    },
  })
})

test("projects the decision Tool for the exact terminal ingress kind", () => {
  const table = {
    no_action: "no_action",
    respond_agent_coordination: "respond",
    dispatch_agent: "dispatch",
    manage_task: "manage",
    wait: "wait",
    read: "read",
    read_task_message: "read_task_message",
    artifact_read: "artifact_read",
  }

  const operator = projectTerminalConversationTools(table, { ingressKind: "operator_message" })
  expect(Object.keys(operator).sort()).toEqual(["artifact_read", "no_action", "read", "read_task_message"])

  const coordination = projectTerminalConversationTools(table, { ingressKind: "coordination_request" })
  expect(Object.keys(coordination).sort()).toEqual([
    "artifact_read",
    "read",
    "read_task_message",
    "respond_agent_coordination",
  ])
})
