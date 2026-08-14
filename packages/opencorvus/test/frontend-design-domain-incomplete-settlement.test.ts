import { afterAll, describe, expect, test } from "bun:test"
import z from "zod"
import { createDispatchLineageOrigin, recordDispatchLineage } from "@/engine/dispatch-lineage"
import { recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { describeTask } from "@/engine/describe"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { requireTask } from "@/engine/store"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { listFrontendDesignArtifacts } from "@/frontend-design/artifact"
import { recordPartialFrontendDesignFacts } from "@/frontend-design/partial-artifact"
import type { FrontendDesignAgent } from "@/frontend-design/agent"
import { FrontendDesignPayloadSchema } from "@/frontend-design/schema"
import { Identifier } from "@/id/id"
import { createFrontendDesignTool } from "@/orchestrator/frontend-design-tool"
import type { DispatchAdapterExecutionContext } from "@/orchestrator/dispatch-adapter-execution-context"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "frontend-design-settlement-test",
  version: "2026.08.12.1",
  packageDigest: "f".repeat(64),
}

const workflowBinding: SelectedWorkflowBinding = {
  kind: "virtual_workflow",
  workflow_id: "frontend-delivery",
  package_revision: {
    scope: "built_in",
    project_id: null,
    namespace: packageRevision.namespace,
    id: packageRevision.id,
    version: packageRevision.version,
    package_digest: packageRevision.packageDigest,
  },
  nodes: [
    { node_id: "design", agent_id: "frontend-designer", depends_on: [] },
    { node_id: "implementation", agent_id: "implementation-engineer", depends_on: ["design"] },
  ],
}

const projectedFrontendDesigner = {
  identity: {
    agentID: "frontend-designer",
    baseRole: "frontend-design" as const,
    sessionKind: "frontend-design" as const,
    dispatchAdapterID: "frontend_design" as const,
    runtimeTemplateABIVersion: 1 as const,
    dispatchAdapterABIVersion: 1 as const,
    projectionHash: "e".repeat(64),
  },
  packageRevision,
  virtualWorkflows: {},
  capabilityOwner: "package" as const,
  label: "Frontend designer",
  builtInToolIDs: [],
  projectedToolIDs: [],
}

afterAll(async () => {
  await resetMemoryDatabase()
})

async function createTask(input: { title: string }) {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const root = await Session.create({
    kind: "root",
    title: input.title,
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  persistTask({
    taskID,
    sessionID: root.id,
    now,
    title: input.title,
    request: "Produce complete frontend design evidence before implementation",
    productPillar: "code",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
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
  return { taskID, root }
}

async function workerTurn(input: { rootSessionID: string; taskID: string; outcome: "partial" | "complete" }) {
  const session = await Session.create({
    kind: "frontend-design",
    parentID: input.rootSessionID,
    title: "Frontend Design worker",
  })
  const parent = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "user",
    author: "orchestrator",
    time: { created: Date.now() },
    agent: projectedFrontendDesigner.identity.agentID,
    model: { providerID: "test", modelID: "test-model" },
  })
  const final = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "assistant",
    author: projectedFrontendDesigner.identity.agentID,
    parentID: parent.id,
    time: { created: Date.now() + 1, completed: Date.now() + 2 },
    agent: projectedFrontendDesigner.identity.agentID,
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  const messagePart = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: session.id,
    messageID: parent.id,
    type: "text",
    text: "Produce the exact Frontend Design delivery Artifact",
  })
  WorkerTurnDescriptor.create({
    sessionID: session.id,
    payload: {
      identity: projectedFrontendDesigner.identity,
      expertSquadID: packageRevision.id,
      packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test-model" },
      prompt: { systemMode: "complete", systemSha256: "a".repeat(64) },
      tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID: input.taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: parent.id,
        control_text_parts: [{ part_id: messagePart.id, text_sha256: taskRequestSHA256(messagePart.text) }],
      },
    },
  })
  if (input.outcome === "partial") {
    return {
      outcome: "partial" as const,
      sessionID: session.id,
      finalMessageID: final.id,
      specs: [],
      factSnapshot: { mode: "greenfield_original" as const, specs: [], draft: {} },
      missing: ["update_frontend_basics", "update_frontend_project"],
      completenessFindings: ["Required structured completion snapshot was not published"],
    }
  }
  const artifact = FrontendDesignPayloadSchema.parse({
    design_system: "Test design system",
    tech_stack: ["TypeScript"],
    final_acceptance_mode: "visual_baseline_allowed",
    component_reuse_plan: [
      {
        family_id: "surface",
        name: "Delivery surface",
        observed_surface: "Primary task surface",
        implementation_strategy: "existing_project_component",
        reuse_source: "src/components/Surface.tsx",
        props_states: "Default state",
        replacement_boundary: "Primary surface only",
        parity_guard: "Preserve the observed layout",
      },
    ],
    material_inventory_items: [{ title: "Tokens", detail: "Task-scoped design tokens" }],
    template_iteration_notes: ["Reviewed the complete delivery surface and retained the current source boundary."],
    completeness_review: "The bounded delivery fixture has complete structured evidence.",
  })
  return {
    outcome: "complete" as const,
    sessionID: session.id,
    finalMessageID: final.id,
    specs: [],
    designSystem: "",
    techStack: [],
    frontendTemplate: "",
    finalAcceptanceMode: artifact.final_acceptance_mode,
    fillableModules: "",
    componentInventory: "",
    componentReusePlan: artifact.component_reuse_plan,
    baselineReplacementPlan: artifact.baseline_replacement_plan,
    implementationPhaseOutcomes: artifact.implementation_phase_outcomes,
    qualityProjectContract: "",
    materialInventory: "",
    frontendProject: artifact.frontend_project,
    visualValidationEvidence: artifact.visual_validation_evidence,
    visualConsistencyContract: "",
    visualRegionBindings: artifact.visual_region_bindings,
    uiDataContract: "",
    templateIterationNotes: [],
    completenessReview: "",
    referenceArtifacts: [],
    openQuestions: [],
    designDirections: artifact.design_directions,
    selectedDesignDirectionID: artifact.selected_design_direction_id,
    antiSlopReview: artifact.anti_slop_review,
    competitorReferenceEvidence: artifact.competitor_reference_evidence,
    completenessFindings: [],
    artifact,
  }
}

function executionContext(
  taskID: string,
  dispatchID = Identifier.ascending("artifact"),
): DispatchAdapterExecutionContext {
  return {
    agentID: projectedFrontendDesigner.identity.agentID,
    projectedAgent: projectedFrontendDesigner as never,
    workScope: { kind: "task" },
    dispatch: {
      dispatchID,
      deliverySliceRevisionIDs: [],
      adapterInput: {},
      turn: {
        kind: "initial",
        current_dispatch_id: dispatchID,
        workflow_binding: workflowBinding,
        workflow_node_id: "design",
        workflow_occurrence_id: Identifier.ascending("artifact"),
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

function frontendDesignTool(input: {
  taskID: string
  rootSessionID: string
  analyze: typeof FrontendDesignAgent.analyze
  recordPartial?: typeof recordPartialFrontendDesignFacts
  context?: DispatchAdapterExecutionContext
}) {
  return createFrontendDesignTool({
    inputSchema: z.object({
      goal_ids: z.array(z.string()),
      mode: z.enum(["greenfield_original", "reference_parity"]),
      reason: z.string(),
      attachment_bindings: z.array(z.object({ attachment_url: z.string(), intent: z.any() })).optional(),
      materials: z.array(z.object({ path: z.string(), intent: z.any() })).optional(),
    }),
    taskID: input.taskID,
    parentSessionID: input.rootSessionID,
    requireCurrentTaskAndAgentSessionLineage: async () => requireTask(input.taskID) as never,
    analyzeFrontendDesign: input.analyze,
    recordPartialFrontendDesign: input.recordPartial,
  }).frontend_design
}

async function executeFrontendDesign(input: {
  taskID: string
  rootSessionID: string
  analyze: typeof FrontendDesignAgent.analyze
  recordPartial?: typeof recordPartialFrontendDesignFacts
}) {
  const adapter = frontendDesignTool(input)
  if (!adapter.execute) throw new Error("frontend_design is missing its production executor")
  return adapter.execute(
    { goal_ids: [], mode: "greenfield_original", reason: "Create the delivery design" },
    input.context ?? executionContext(input.taskID),
  )
}

describe("Frontend Design domain-incomplete settlement", () => {
  test("real adapter execute persists one partial Artifact and returns its exact non-success locator", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await createTask({ title: "Partial Frontend Design" })
        const analysis = await workerTurn({ rootSessionID: task.root.id, taskID: task.taskID, outcome: "partial" })
        const context = executionContext(task.taskID)
        recordDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID: context.dispatch.dispatchID,
            taskID: task.taskID,
            orchestratorSessionID: task.root.id,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: projectedFrontendDesigner.identity.agentID,
            projectedWorkerIdentity: projectedFrontendDesigner.identity,
            workScope: { kind: "task" },
            workflowBinding,
            workflowNodeID: "design",
            adapterInput: { mode: "greenfield_original", reason: "Create the delivery design" },
          }),
          childSessionID: analysis.sessionID,
        })
        const outcome = await executeFrontendDesign({
          ...task,
          analyze: async () => analysis,
          context,
        })
        const artifacts = listFrontendDesignArtifacts(task.taskID)
        const domainArtifact = (outcome as { domain_artifact: { artifact_id: string } }).domain_artifact
        expect({ artifacts, outcome }).toMatchObject({
          artifacts: [
            {
              id: domainArtifact.artifact_id,
              payload: {
                status: "partial",
                missing: ["update_frontend_basics", "update_frontend_project"],
                completeness_findings: ["Required structured completion snapshot was not published"],
              },
            },
          ],
          outcome: {
            kind: "domain_incomplete",
            domain: "frontend_design",
            session_id: analysis.sessionID,
            final_message_id: analysis.finalMessageID,
            domain_artifact: {
              source: "engine_artifact",
              artifact_id: artifacts[0]?.id,
            },
          },
        })
        expect(domainArtifact).toEqual(
          expect.objectContaining({
            source: "engine_artifact",
            artifact_id: artifacts[0]?.id,
            expected_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            catalog_revision: expect.any(Number),
          }),
        )

        const settlement = recordDispatchSettlement({
          taskID: task.taskID,
          dispatchID: context.dispatch.dispatchID,
          outcome: outcome as never,
        })
        expect({ settlement: settlement.payload.outcome }).toMatchObject({
          settlement: { kind: "domain_incomplete" },
        })
        const projection = await describeTask(task.taskID)
        expect(projection.workflow_execution).toMatchObject({
          nodes: [
            { node_id: "design", terminal_success: false },
            { node_id: "implementation", terminal_success: false, dispatches: [] },
          ],
          frontier_node_ids: [],
        })
      },
    })
  }, 30_000)

  test("real adapter catch maps partial Artifact persistence failure to post-Turn partial", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await createTask({ title: "Frontend Design persistence failure" })
        const analysis = await workerTurn({ rootSessionID: task.root.id, taskID: task.taskID, outcome: "partial" })
        const outcome = await executeFrontendDesign({
          ...task,
          analyze: async () => analysis,
          recordPartial: () => {
            throw new Error("artifact database unavailable")
          },
        })
        expect({ outcome, artifacts: listFrontendDesignArtifacts(task.taskID) }).toMatchObject({
          outcome: {
            kind: "partial",
            session_id: analysis.sessionID,
            final_message_id: analysis.finalMessageID,
            failed_operation: "persist-domain-artifact",
          },
          artifacts: [],
        })
      },
    })
  }, 30_000)

  test("real complete adapter branch persists its Artifact and opens the dependent frontier", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await createTask({ title: "Complete Frontend Design" })
        const analysis = await workerTurn({ rootSessionID: task.root.id, taskID: task.taskID, outcome: "complete" })
        const context = executionContext(task.taskID)
        recordDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID: context.dispatch.dispatchID,
            taskID: task.taskID,
            orchestratorSessionID: task.root.id,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: projectedFrontendDesigner.identity.agentID,
            projectedWorkerIdentity: projectedFrontendDesigner.identity,
            workScope: { kind: "task" },
            workflowBinding,
            workflowNodeID: "design",
            adapterInput: { mode: "greenfield_original", reason: "Create the delivery design" },
          }),
          childSessionID: analysis.sessionID,
        })
        const outcome = await executeFrontendDesign({ ...task, analyze: async () => analysis, context })
        recordDispatchSettlement({
          taskID: task.taskID,
          dispatchID: context.dispatch.dispatchID,
          outcome: outcome as never,
        })
        const projection = await describeTask(task.taskID)
        expect({
          outcome,
          artifacts: listFrontendDesignArtifacts(task.taskID),
          workflow: projection.workflow_execution,
        }).toMatchObject({
          outcome: {
            kind: "terminal_success",
            session_id: analysis.sessionID,
            final_message_id: analysis.finalMessageID,
          },
          artifacts: [{ payload: { status: "complete" } }],
          workflow: {
            nodes: [
              { node_id: "design", terminal_success: true },
              { node_id: "implementation", terminal_success: false, dispatches: [] },
            ],
            frontier_node_ids: ["implementation"],
          },
        })
      },
    })
  }, 30_000)
})
