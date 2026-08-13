import { afterAll, describe, expect, test } from "bun:test"
import z from "zod"
import { createDispatchLineageOrigin, recordDispatchLineage } from "@/engine/dispatch-lineage"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { describeTask } from "@/engine/describe"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { persistQueuedTask } from "@/engine/pipeline"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { requireTask } from "@/engine/store"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import type { AgentCoordinationHandoffResult } from "@/agent/runner"
import type { FactCheckAgent } from "@/fact-check"
import type { FactCheckReview } from "@/fact-check/schema"
import { createFactCheckOutputTools } from "@/fact-check/tools"
import { Identifier } from "@/id/id"
import { createFactCheckTool } from "@/orchestrator/fact-check-tool"
import type { DispatchAdapterExecutionContext } from "@/orchestrator/dispatch-adapter-execution-context"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { Database, and, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "research-studio",
  version: "2026.08.13.1",
  packageDigest: "f".repeat(64),
}

const workflowBinding: SelectedWorkflowBinding = {
  kind: "virtual_workflow",
  workflow_id: "evidence-synthesis",
  package_revision: {
    scope: "built_in",
    project_id: null,
    namespace: packageRevision.namespace,
    id: packageRevision.id,
    version: packageRevision.version,
    package_digest: packageRevision.packageDigest,
  },
  nodes: [
    { node_id: "research-studio-fact-checker", agent_id: "research-studio-fact-checker", depends_on: [] },
    {
      node_id: "research-studio-writer",
      agent_id: "research-studio-writer",
      depends_on: ["research-studio-fact-checker"],
    },
  ],
}

const projectedFactChecker = {
  identity: {
    agentID: "research-studio-fact-checker",
    baseRole: "fact-check" as const,
    sessionKind: "fact-check" as const,
    dispatchAdapterID: "fact_check" as const,
    runtimeTemplateABIVersion: 1 as const,
    dispatchAdapterABIVersion: 1 as const,
    projectionHash: "a".repeat(64),
  },
  packageRevision,
  virtualWorkflows: {},
  capabilityOwner: "package" as const,
  label: "Research Studio Fact Checker",
  builtInToolIDs: [],
  projectedToolIDs: [],
}

afterAll(async () => {
  await resetMemoryDatabase()
})

async function createFixture(title: string) {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const root = await Session.create({
    kind: "root",
    title,
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  persistQueuedTask({
    taskID,
    sessionID: root.id,
    now,
    title,
    request: "Publish an exact FactCheckReview before the report writer starts",
    productPillar: "work",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
    queue: true,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })

  const target = await Session.create({ kind: "assistant", parentID: root.id, title: "Analysis worker" })
  const targetUser = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: target.id,
    role: "user",
    author: "orchestrator",
    time: { created: now + 1 },
    agent: "research-studio-analyst",
    model: { providerID: "test", modelID: "test-model" },
  })
  const targetMessage = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: target.id,
    role: "assistant",
    author: "research-studio-analyst",
    parentID: targetUser.id,
    time: { created: now + 2, completed: now + 3 },
    agent: "research-studio-analyst",
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: target.id,
    messageID: targetMessage.id,
    type: "text",
    text: "The bounded fixture has zero registered factual claims.",
  })

  const worker = await Session.create({ kind: "fact-check", parentID: root.id, title: "Fact Check worker" })
  const workerUser = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: worker.id,
    role: "user",
    author: "orchestrator",
    time: { created: now + 4 },
    agent: projectedFactChecker.identity.agentID,
    model: { providerID: "test", modelID: "test-model" },
  })
  const workerControl = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: worker.id,
    messageID: workerUser.id,
    type: "text",
    text: "Verify the exact selected analysis and publish the typed review",
  })
  const workerFinal = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: worker.id,
    role: "assistant",
    author: projectedFactChecker.identity.agentID,
    parentID: workerUser.id,
    time: { created: now + 5, completed: now + 6 },
    agent: projectedFactChecker.identity.agentID,
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: worker.id,
    messageID: workerFinal.id,
    type: "text",
    text: "Fact Check streamed Turn finished with the visible result above.",
  })
  WorkerTurnDescriptor.create({
    sessionID: worker.id,
    payload: {
      identity: projectedFactChecker.identity,
      expertSquadID: packageRevision.id,
      packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test-model" },
      prompt: { systemMode: "complete", systemSha256: "b".repeat(64) },
      tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: workerUser.id,
        control_text_parts: [
          { part_id: workerControl.id, text_sha256: taskRequestSHA256(workerControl.text) },
        ],
      },
    },
  })

  return { taskID, root, target, targetMessage, worker, workerFinal }
}

function reviewFor(fixture: Awaited<ReturnType<typeof createFixture>>): FactCheckReview {
  return {
    scope: {
      target_session_id: fixture.target.id,
      target_agent: "research-studio-analyst",
      target_message_id: fixture.targetMessage.id,
      target_message_content_hash: "c".repeat(64),
      items_total: 0,
      items_inspected: 0,
    },
    verified: [],
    corrected: [],
    unresolved: [],
    overall_verdict: "clean",
  }
}

function executionContext(taskID: string, dispatchID: string): DispatchAdapterExecutionContext {
  return {
    agentID: projectedFactChecker.identity.agentID,
    projectedAgent: projectedFactChecker as never,
    workScope: { kind: "task" },
    dispatch: {
      dispatchID,
      deliverySliceRevisionIDs: [],
      adapterInput: {},
      turn: {
        kind: "initial",
        current_dispatch_id: dispatchID,
        workflow_binding: workflowBinding,
        workflow_node_id: "research-studio-fact-checker",
        workflow_occurrence_id: dispatchID,
        delivery_slice_revision_ids: [],
        evidence_locators: [],
        task_authority: {
          task_id: taskID,
          root_session_id: requireTask(taskID).session_id!,
          request_sha256: taskRequestSHA256(requireTask(taskID).request),
          initial_control_text_parts: [],
        },
      },
      observeSession() {},
      commitSession() {
        return { artifactID: Identifier.ascending("artifact") }
      },
    },
    toolOptions: {},
  }
}

function recordLineage(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const dispatchID = Identifier.ascending("artifact")
  const lineage = recordDispatchLineage({
    origin: createDispatchLineageOrigin({
      dispatchID,
      taskID: fixture.taskID,
      orchestratorSessionID: fixture.root.id,
      orchestratorMessageID: Identifier.ascending("message"),
      toolPartID: Identifier.ascending("part"),
      toolCallID: Identifier.ascending("call"),
      targetAgentID: projectedFactChecker.identity.agentID,
      projectedWorkerIdentity: projectedFactChecker.identity,
      workScope: { kind: "task" },
      workflowBinding,
      workflowNodeID: "research-studio-fact-checker",
      adapterInput: { reason: "Verify the selected analysis" },
    }),
    childSessionID: fixture.worker.id,
  })
  return { dispatchID, lineage }
}

async function executeAdapter(input: {
  fixture: Awaited<ReturnType<typeof createFixture>>
  run: typeof FactCheckAgent.run
}) {
  const { fixture } = input
  const { dispatchID, lineage } = recordLineage(fixture)
  const adapter = createFactCheckTool({
    inputSchema: z.object({
      target_session_id: z.string(),
      target_message_id: z.string(),
      target_agent: z.string().optional(),
      reason: z.string(),
    }),
    stageInputSchema: z.object({
      target_session_id: z.string(),
      target_agent: z.string(),
      reason: z.string(),
      target_message_id: z.string(),
      target_message_content_hash: z.string(),
    }),
    taskID: fixture.taskID,
    orchestratorSessionID: fixture.root.id,
    requireTask: () => requireTask(fixture.taskID),
    resolveTargetScope: async () => ({
      targetAgent: "research-studio-analyst",
      targetMessageID: fixture.targetMessage.id,
      targetMessageContentHash: "c".repeat(64),
    }),
    runFactCheck: input.run,
  })
  if (!adapter.execute) throw new Error("fact_check is missing its production executor")
  const outcome = await adapter.execute(
    {
      target_session_id: fixture.target.id,
      target_message_id: fixture.targetMessage.id,
      target_agent: "research-studio-analyst",
      reason: "Verify the selected analysis",
    },
    executionContext(fixture.taskID, dispatchID),
  )
  recordDispatchSettlement({ taskID: fixture.taskID, dispatchID, outcome: outcome as never })
  return { outcome, lineage, workflow: (await describeTask(fixture.taskID)).workflow_execution }
}

function artifacts(taskID: string) {
  return Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id, kind: EngineArtifactTable.kind, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(eq(EngineArtifactTable.task_id, taskID))
      .all()
      .filter((row) => row.kind === "fact_check_review" || row.kind === "fact_check_incomplete"),
  )
}

describe("Fact Check domain-incomplete settlement", () => {
  test("a natural Turn without review persists exact incomplete evidence and keeps Writer closed", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createFixture("Fact Check missing review")
        const result = await executeAdapter({
          fixture,
          run: async () => ({ sessionID: fixture.worker.id, finalMessageID: fixture.workerFinal.id }),
        })
        const rows = artifacts(fixture.taskID)
        expect({ outcome: result.outcome, rows, workflow: result.workflow }).toMatchObject({
          outcome: {
            kind: "domain_incomplete",
            domain: "fact_check",
            session_id: fixture.worker.id,
            final_message_id: fixture.workerFinal.id,
            domain_artifact: {
              source: "engine_artifact",
              artifact_id: rows[0]?.id,
              expected_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
              catalog_revision: expect.any(Number),
            },
          },
          rows: [
            {
              kind: "fact_check_incomplete",
              payload: {
                fact_check_session_id: fixture.worker.id,
                final_message_id: fixture.workerFinal.id,
                reason: "review_not_published",
              },
            },
          ],
          workflow: {
            nodes: [
              { node_id: "research-studio-fact-checker", terminal_success: false },
              { node_id: "research-studio-writer", terminal_success: false, dispatches: [] },
            ],
            frontier_node_ids: [],
          },
        })
      },
    })
  }, 30_000)

  test("one valid review persists the canonical Artifact and opens Writer", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createFixture("Fact Check valid review")
        const review = reviewFor(fixture)
        const result = await executeAdapter({
          fixture,
          run: async () => ({ sessionID: fixture.worker.id, finalMessageID: fixture.workerFinal.id, review }),
        })
        expect({ outcome: result.outcome, rows: artifacts(fixture.taskID), workflow: result.workflow }).toMatchObject({
          outcome: {
            kind: "terminal_success",
            session_id: fixture.worker.id,
            final_message_id: fixture.workerFinal.id,
          },
          rows: [{ kind: "fact_check_review", payload: { review: { overall_verdict: "clean" } } }],
          workflow: {
            nodes: [
              { node_id: "research-studio-fact-checker", terminal_success: true },
              { node_id: "research-studio-writer", terminal_success: false, dispatches: [] },
            ],
            frontier_node_ids: ["research-studio-writer"],
          },
        })
      },
    })
  }, 30_000)

  test("a review for a different target persists exact mismatch evidence and keeps Writer closed", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createFixture("Fact Check target mismatch")
        const review = reviewFor(fixture)
        review.scope.target_message_id = Identifier.ascending("message")
        const result = await executeAdapter({
          fixture,
          run: async () => ({ sessionID: fixture.worker.id, finalMessageID: fixture.workerFinal.id, review }),
        })
        const rows = artifacts(fixture.taskID)
        expect({ outcome: result.outcome, rows, workflow: result.workflow }).toMatchObject({
          outcome: {
            kind: "domain_incomplete",
            domain: "fact_check",
            session_id: fixture.worker.id,
            final_message_id: fixture.workerFinal.id,
            domain_artifact: {
              source: "engine_artifact",
              artifact_id: rows[0]?.id,
              expected_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
              catalog_revision: expect.any(Number),
            },
          },
          rows: [
            {
              kind: "fact_check_incomplete",
              payload: {
                target_session_id: fixture.target.id,
                target_message_id: fixture.targetMessage.id,
                reason: "review_scope_mismatch",
              },
            },
          ],
          workflow: {
            nodes: [
              { node_id: "research-studio-fact-checker", terminal_success: false },
              { node_id: "research-studio-writer", terminal_success: false, dispatches: [] },
            ],
            frontier_node_ids: [],
          },
        })
      },
    })
  }, 30_000)

  test("semantic validation result remains visible while the same real Turn settles incomplete", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createFixture("Fact Check invalid review")
        const invalidReview = { ...reviewFor(fixture), overall_verdict: "inconclusive" as const }
        const outputTools = createFactCheckOutputTools()
        const record = outputTools.tools.record_fact_check_review
        if (!record.execute) throw new Error("record_fact_check_review is missing its executor")
        const toolResult = await record.execute(invalidReview, {
          toolCallId: "call-invalid-review",
          messages: [],
          abortSignal: new AbortController().signal,
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: fixture.worker.id,
          messageID: fixture.workerFinal.id,
          type: "tool",
          callID: "call-invalid-review",
          tool: "record_fact_check_review",
          state: {
            status: "completed",
            input: invalidReview,
            output: String(toolResult),
            title: "Fact Check Review",
            metadata: {},
            time: { start: Date.now(), end: Date.now() + 1 },
          },
        })
        const result = await executeAdapter({
          fixture,
          run: async () => ({
            sessionID: fixture.worker.id,
            finalMessageID: fixture.workerFinal.id,
            ...outputTools.getCollector(),
          }),
        })
        const persisted = await MessageStore.get({ sessionID: fixture.worker.id, messageID: fixture.workerFinal.id })
        expect({ toolResult, result: result.outcome, toolPart: persisted.parts.find((part) => part.type === "tool") }).toMatchObject({
          toolResult: expect.stringContaining("failed semantic validation"),
          result: { kind: "domain_incomplete", domain: "fact_check" },
          toolPart: {
            type: "tool",
            tool: "record_fact_check_review",
            state: { status: "completed", output: expect.stringContaining("failed semantic validation") },
          },
        })
      },
    })
  }, 30_000)

  test("a coordination handoff keeps its distinct settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createFixture("Fact Check handoff")
        const { dispatchID, lineage } = recordLineage(fixture)
        const handoff: AgentCoordinationHandoffResult = {
          outcome: "coordination_handoff",
          requestID: Identifier.ascending("question"),
          dispatchLineageID: lineage.artifactID,
          sessionID: fixture.worker.id,
        }
        const adapter = createFactCheckTool({
          inputSchema: z.object({ target_session_id: z.string(), target_message_id: z.string(), reason: z.string() }),
          stageInputSchema: z.object({
            target_session_id: z.string(),
            target_agent: z.string(),
            target_message_id: z.string(),
            target_message_content_hash: z.string(),
            reason: z.string(),
          }),
          taskID: fixture.taskID,
          orchestratorSessionID: fixture.root.id,
          requireTask: () => requireTask(fixture.taskID),
          resolveTargetScope: async () => ({
            targetAgent: "research-studio-analyst",
            targetMessageID: fixture.targetMessage.id,
            targetMessageContentHash: "c".repeat(64),
          }),
          runFactCheck: async () => handoff,
        })
        if (!adapter.execute) throw new Error("fact_check is missing its production executor")
        const outcome = await adapter.execute(
          {
            target_session_id: fixture.target.id,
            target_message_id: fixture.targetMessage.id,
            reason: "Need an exact scheduler decision",
          },
          executionContext(fixture.taskID, dispatchID),
        )
        expect(outcome).toEqual({
          kind: "coordination",
          session_id: fixture.worker.id,
          coordination_request: { source: "coordination_request", request_id: handoff.requestID },
          dispatch_lineage_id: lineage.artifactID,
        })
      },
    })
  }, 30_000)
})
