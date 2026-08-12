import { afterAll, describe, expect, test } from "bun:test"
import { createDispatchLineageOrigin, recordDispatchLineage } from "@/engine/dispatch-lineage"
import { recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { describeTask } from "@/engine/describe"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { persistQueuedTask } from "@/engine/pipeline"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { requireTask } from "@/engine/store"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { Identifier } from "@/id/id"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { createDeepResearchStageDispatcher } from "@/orchestrator/deep-research-stage"
import { createFrontendResearchStageDispatcher } from "@/orchestrator/frontend-research-stage"
import { persistResearchArtifactBestEffort } from "@/orchestrator/research-persistence"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { buildResearchBriefFromDraft } from "@/research/output-tools"
import { Session } from "@/session"
import { Database, and, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "research-settlement-test",
  version: "2026.08.12.1",
  packageDigest: "c".repeat(64),
}

type Mode = "deep" | "frontend"

function agentID(mode: Mode) {
  return mode === "deep" ? "deep-researcher" : "frontend-researcher"
}

function workflow(mode: Mode): SelectedWorkflowBinding {
  return {
    kind: "virtual_workflow",
    workflow_id: `${mode}-research-delivery`,
    package_revision: {
      scope: "built_in",
      project_id: null,
      namespace: packageRevision.namespace,
      id: packageRevision.id,
      version: packageRevision.version,
      package_digest: packageRevision.packageDigest,
    },
    nodes: [
      { node_id: "research", agent_id: agentID(mode), depends_on: [] },
      { node_id: "consumer", agent_id: "research-consumer", depends_on: ["research"] },
    ],
  }
}

function projectedIdentity(mode: Mode) {
  return {
    agentID: agentID(mode),
    baseRole: (mode === "deep" ? "deep-research" : "frontend-research") as
      | "deep-research"
      | "frontend-research",
    sessionKind: (mode === "deep" ? "deep-research" : "frontend-research") as
      | "deep-research"
      | "frontend-research",
    dispatchAdapterID: (mode === "deep" ? "deep_research" : "frontend_research") as
      | "deep_research"
      | "frontend_research",
    runtimeTemplateABIVersion: 1 as const,
    dispatchAdapterABIVersion: 1 as const,
    projectionHash: (mode === "deep" ? "d" : "e").repeat(64),
  }
}

afterAll(async () => {
  await resetMemoryDatabase()
})

async function createTask(mode: Mode) {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const root = await Session.create({
    kind: "root",
    title: `${mode} Research settlement`,
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  persistQueuedTask({
    taskID,
    sessionID: root.id,
    now,
    title: `${mode} Research settlement`,
    request: "Publish complete research evidence before the consumer starts",
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
  const child = await Session.create({
    kind: mode === "deep" ? "deep-research" : "frontend-research",
    parentID: root.id,
    title: `${mode} Research worker`,
  })
  const parent = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "user",
    author: "orchestrator",
    time: { created: now + 1 },
    agent: agentID(mode),
    model: { providerID: "test", modelID: "test-model" },
  })
  const controlPart = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: child.id,
    messageID: parent.id,
    type: "text",
    text: "Produce the exact Research delivery Artifact",
  })
  const final = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "assistant",
    author: agentID(mode),
    parentID: parent.id,
    time: { created: now + 2, completed: now + 3 },
    agent: agentID(mode),
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  const dispatchID = Identifier.ascending("artifact")
  const binding = workflow(mode)
  WorkerTurnDescriptor.create({
    sessionID: child.id,
    payload: {
      identity: projectedIdentity(mode),
      expertSquadID: packageRevision.id,
      packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test-model" },
      prompt: { systemMode: "complete", systemSha256: "f".repeat(64) },
      tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: parent.id,
        control_text_parts: [{ part_id: controlPart.id, text_sha256: taskRequestSHA256(controlPart.text) }],
      },
      dispatchTurn: {
        kind: "initial",
        current_dispatch_id: dispatchID,
        workflow_binding: binding,
        workflow_node_id: "research",
        workflow_occurrence_id: dispatchID,
        delivery_slice_revision_ids: [],
        evidence_locators: [],
        task_authority: {
          task_id: taskID,
          root_session_id: root.id,
          request_sha256: taskRequestSHA256(requireTask(taskID).request),
          initial_control_text_parts: [],
        },
      },
    },
  })
  recordDispatchLineage({
    origin: createDispatchLineageOrigin({
      dispatchID,
      taskID,
      orchestratorSessionID: root.id,
      orchestratorMessageID: Identifier.ascending("message"),
      toolPartID: Identifier.ascending("part"),
      toolCallID: Identifier.ascending("call"),
      targetAgentID: agentID(mode),
      projectedWorkerIdentity: projectedIdentity(mode),
      workScope: { kind: "task" },
      workflowBinding: binding,
      workflowNodeID: "research",
      adapterInput: { reason: "Produce research evidence" },
    }),
    childSessionID: child.id,
  })
  return { taskID, root, child, final, dispatchID, binding }
}

function dispatchTurn(task: Awaited<ReturnType<typeof createTask>>) {
  return {
    kind: "initial" as const,
    current_dispatch_id: task.dispatchID,
    workflow_binding: task.binding,
    workflow_node_id: "research",
    workflow_occurrence_id: task.dispatchID,
    delivery_slice_revision_ids: [],
    evidence_locators: [],
    task_authority: {
      task_id: task.taskID,
      root_session_id: task.root.id,
      request_sha256: taskRequestSHA256(requireTask(task.taskID).request),
      initial_control_text_parts: [],
    },
  }
}

function stageDispatch(task: Awaited<ReturnType<typeof createTask>>, mode: Mode) {
  return {
    task: requireTask(task.taskID),
    reason: "Produce research evidence",
    ...(mode === "frontend" ? { deliverySliceRevisionIDs: [] } : {}),
    agentID: agentID(mode),
    packageRevision,
    workScope: { kind: "task" as const },
    dispatchTurn: dispatchTurn(task),
  }
}

function incompleteResult(task: Awaited<ReturnType<typeof createTask>>) {
  return {
    outcome: "incomplete" as const,
    sessionID: task.child.id,
    finalMessageID: task.final.id,
    missing: ["summary", "evidence_index"],
    partialDraft: { summary: "Research started but required evidence is still missing" },
  }
}

function completeResult(task: Awaited<ReturnType<typeof createTask>>) {
  const paths = ProjectRuntimePaths.deepResearchPaths(Instance.directory, task.taskID, task.child.id)
  const brief = buildResearchBriefFromDraft({
    draft: {
      scope: {
        user_goal: "Produce complete research evidence",
        deliverable_type: "research_report",
        audience: "Implementation consumer",
        explicit_non_goals: [],
        assumed_non_goals: [],
      },
      summary: "The bounded research fixture has one source-backed fact.",
      evidence_index: [
        {
          id: "evidence-1",
          kind: "user",
          pointer: "task-request",
          title: "Task request",
          retrieved_at: "2026-08-12T00:00:00.000Z",
          reliability: "primary",
          excerpt: "Complete research evidence is required before implementation.",
          volatile: false,
        },
      ],
      facts: [{ id: "fact-1", statement: "Research is a workflow prerequisite.", evidence_ids: ["evidence-1"] }],
      inferences: [],
      problem_statements: [],
      user_needs: [],
      constraints: [],
      document_outline: [],
      subpage_research_tasks: [],
      open_questions: [],
      bundle: {
        full_markdown_sections: [
          { title: "Evidence", evidence_ids: ["evidence-1"], points: ["Research is a prerequisite."] },
        ],
        evidence_notes: [{ evidence_id: "evidence-1", observations: ["The request requires research."], artifact_refs: [] }],
        citation_map: [
          { claim_id: "fact-1", evidence_ids: ["evidence-1"], pointer: "task-request", usage: "Supports the prerequisite." },
        ],
      },
    },
    metadata: {
      research_session_id: task.child.id,
      created_for_message_id: task.final.id,
      request_hash: "request-hash",
      created_at: "2026-08-12T00:00:00.000Z",
    },
    bundlePaths: {
      full_markdown_path: `${paths.relativeDir}/research-bundle.md`,
      evidence_json_path: `${paths.relativeDir}/evidence.json`,
      citation_map_path: `${paths.relativeDir}/citation-map.json`,
    },
  })
  return {
    outcome: "complete" as const,
    brief,
    bundle: { full_markdown: "research", evidence_json: "{}", citation_map_json: "{}" },
    factCheckItems: [],
    sessionID: task.child.id,
  }
}

function artifactByID(taskID: string, artifactID: string) {
  return Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id, kind: EngineArtifactTable.kind, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.id, artifactID)))
      .get(),
  )
}

describe("Research domain-incomplete settlement", () => {
  for (const mode of ["deep", "frontend"] as const) {
    test(`${mode} production stage persists one partial Artifact and keeps its consumer closed`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const task = await createTask(mode)
          const result = incompleteResult(task)
          const outcome =
            mode === "deep"
              ? await createDeepResearchStageDispatcher({
                  taskID: task.taskID,
                  parentSessionID: task.root.id,
                  runResearch: async () => result,
                })(stageDispatch(task, mode))
              : await createFrontendResearchStageDispatcher({
                  taskID: task.taskID,
                  parentSessionID: task.root.id,
                  runResearch: async () => result,
                })(stageDispatch(task, mode) as never)
          if (outcome.kind !== "domain_incomplete") throw new Error(`Expected domain_incomplete, got ${outcome.kind}`)
          const artifact = artifactByID(task.taskID, outcome.domain_artifact.artifact_id)
          recordDispatchSettlement({ taskID: task.taskID, dispatchID: task.dispatchID, outcome })
          const projection = await describeTask(task.taskID)

          expect({ outcome, artifact, workflow: projection.workflow_execution }).toMatchObject({
            outcome: {
              kind: "domain_incomplete",
              domain: `${mode}_research`,
              session_id: task.child.id,
              final_message_id: task.final.id,
              domain_artifact: {
                source: "engine_artifact",
                artifact_id: artifact?.id,
                expected_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
                catalog_revision: expect.any(Number),
              },
            },
            artifact: {
              kind: mode === "deep" ? "research_brief" : "frontend_research_brief",
              label: "partial",
              payload: {
                status: "partial",
                missing: ["summary", "evidence_index"],
              },
            },
            workflow: {
              nodes: [
                { node_id: "research", terminal_success: false },
                { node_id: "consumer", terminal_success: false, dispatches: [] },
              ],
              frontier_node_ids: [],
            },
          })
        },
      })
    }, 30_000)
  }

  test("a failed post-Turn Research persistence remains the distinct partial outcome", () => {
    const outcome = persistResearchArtifactBestEffort({
      taskID: Identifier.ascending("task"),
      dispatchID: Identifier.ascending("artifact"),
      component: "deep-research",
      operation: "persist-partial-research-brief",
      delivery: "incomplete",
      sessionID: Identifier.ascending("session"),
      finalMessageID: Identifier.ascending("message"),
      persist() {
        throw new Error("research artifact database unavailable")
      },
      recordInfrastructure: () => undefined,
    })

    expect(outcome).toMatchObject({
      kind: "partial",
      failed_operation: "persist-partial-research-brief",
    })
  })

  test("complete Deep Research persists its canonical Artifact and opens the consumer frontier", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await createTask("deep")
        const result = completeResult(task)
        const outcome = await createDeepResearchStageDispatcher({
          taskID: task.taskID,
          parentSessionID: task.root.id,
          runResearch: async () => result,
        })(stageDispatch(task, "deep"))
        recordDispatchSettlement({ taskID: task.taskID, dispatchID: task.dispatchID, outcome })
        const projection = await describeTask(task.taskID)
        const artifacts = Database.use((db) =>
          db
            .select({ kind: EngineArtifactTable.kind, label: EngineArtifactTable.label })
            .from(EngineArtifactTable)
            .where(and(eq(EngineArtifactTable.task_id, task.taskID), eq(EngineArtifactTable.kind, "research_brief")))
            .all(),
        )
        expect({ outcome, artifacts, workflow: projection.workflow_execution }).toMatchObject({
          outcome: { kind: "terminal_success", session_id: task.child.id, final_message_id: task.final.id },
          artifacts: [{ kind: "research_brief", label: "ResearchBrief" }],
          workflow: {
            nodes: [
              { node_id: "research", terminal_success: true },
              { node_id: "consumer", terminal_success: false, dispatches: [] },
            ],
            frontier_node_ids: ["consumer"],
          },
        })
      },
    })
  }, 30_000)
})
