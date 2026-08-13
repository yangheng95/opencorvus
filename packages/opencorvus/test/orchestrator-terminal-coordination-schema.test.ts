import { afterAll, expect, test } from "bun:test"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { Identifier } from "../src/id/id"
import { createOrchestratorTools } from "../src/orchestrator/tools"
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
      Database.use((db) =>
        db
          .insert(EngineTaskTable)
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
          .run(),
      )

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
            terminalEventID: Identifier.ascending("event"),
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
    },
  })
})
