import { Database as BunDatabase } from "bun:sqlite"
import { describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import { Identifier } from "@/id/id"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { createDispatchLineageOrigin, recordDispatchLineage } from "@/engine/dispatch-lineage"
import {
  findDispatchSettlementByDispatchID,
  recordDispatchSettlement,
  settleDispatchOrReturnExisting,
} from "@/engine/dispatch-settlement"
import { persistArchitectGoalProjection, persistArchitectUnprojectableGoalGraphCandidate } from "@/engine/persist"
import { deriveEngineArtifactCatalogMetadata, serializeEngineArtifactPayload } from "@/engine/artifact-catalog-metadata"
import { expertSquadPackageRevisionBinding } from "@/engine/expert-squad-package-revision-binding"
import { listGoalWorkloadArtifacts } from "@/engine/store"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { describeTask } from "@/engine/describe"
import {
  configureTaskIngressRunner,
  reconcileTerminalAgentLifecycleDelivery,
} from "@/engine/task-root-ingress-delivery"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { GoalWorkloadAnalystAgent } from "@/goal-workload-analyst/agent"
import { createGoalWorkloadOutputTools } from "@/goal-workload-analyst/output-tools"
import {
  GoalWorkloadArtifactSchema,
  WorkloadBriefSchema,
  deriveGoalWorkloadCoverage,
  type WorkloadBrief,
} from "@/goal-workload-analyst/types"
import {
  GoalWorkloadPublicationConflictError,
  publishGoalWorkload,
} from "@/goal-workload-analyst/publication"
import { goalWorkloadPublicationArtifactID } from "@/goal-workload-analyst/relational-integrity"
import { Instance } from "@/project/instance"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { createDispatchAgentTool, type DispatchAdapterExecutors } from "@/orchestrator/dispatch-agent-tool"
import { createWorkloadAnalysisTool } from "@/orchestrator/workload-analysis-tool"
import { Session } from "@/session"
import { executionLifecycleOrderKey } from "@/session/status"
import { ProtocolStore } from "@/protocol/store"
import { Bus } from "@/bus"
import { Database, DatabaseUnavailableError } from "@/storage/db"
import type { EngineArtifactLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import z from "zod"
import { memoryProject } from "./fixture/memory"
import { persistEstablishedTask } from "./fixture/engine-task"

const goalA = Identifier.ascending("goal")
const goalB = Identifier.ascending("goal")

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "goal-workload-coverage-test",
  version: "2026.08.13.1",
  packageDigest: "a".repeat(64),
}

const workloadIdentity = {
  agentID: "goal-workload-analyst",
  baseRole: "goal-workload-analyst" as const,
  sessionKind: "goal-workload-analyst" as const,
  dispatchAdapterID: "workload_analysis" as const,
  runtimeTemplateABIVersion: 1 as const,
  dispatchAdapterABIVersion: 1 as const,
  projectionHash: "b".repeat(64),
}

function brief(goalID: string): WorkloadBrief {
  return WorkloadBriefSchema.parse({
    goal_id: goalID,
    why_not_smaller: ["One coherent delivery contract"],
    underestimation_traps: [],
    execution_inventory: { surfaces: 1, states: 1, data_contracts: 1, verification_points: 1 },
    verification_inventory: ["Observe the exact durable result"],
    references: {
      contract_ids: [],
      reference_coverage_ids: [],
      acceptance_spec_ids: [],
      visual_spec_ids: [],
      design_sections: [],
    },
  })
}

function artifact(input: { selected: string[]; briefs: WorkloadBrief[]; current: string[]; hasGraph?: boolean }) {
  const hasGraph = input.hasGraph ?? true
  return {
    schema_version: 2 as const,
    producer: {
      session_id: Identifier.ascending("session"),
      final_message_id: Identifier.ascending("message"),
    },
    dispatch: {
      task_id: Identifier.ascending("task"),
      dispatch_id: Identifier.ascending("artifact"),
      dispatch_lineage_artifact_id: Identifier.ascending("artifact"),
      workflow_occurrence_id: Identifier.ascending("artifact"),
    },
    selected_subjects: input.selected.map((id) => ({
      delivery_slice_id: id,
      delivery_slice_revision_id: id,
      revision: 1,
    })),
    briefs: input.briefs,
    coverage_receipt: {
      ...deriveGoalWorkloadCoverage({
        selectedRevisionIDs: input.selected,
        submittedRevisionIDs: input.briefs.map((candidate) => candidate.goal_id),
        currentRevisionIDs: input.current,
        currentGoalGraphAvailable: hasGraph,
      }),
      current_goal_graph_projection_artifact_locator: hasGraph
        ? {
            source: "engine_artifact" as const,
            artifact_id: Identifier.ascending("artifact"),
            catalog_revision: 1,
            expected_sha256: "a".repeat(64),
          }
        : null,
    },
    observed_artifact_locators: [],
    source_artifact_locators: [],
  }
}

async function createTaskFixture(title: string) {
  const taskID = Identifier.ascending("task")
  const request = `Verify ${title}`
  const now = Date.now()
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title,
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title,
    request,
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
  return { taskID, request, now, root }
}

function persistGoalGraph(input: { taskID: string; goalIDs: string[]; prior?: EngineArtifactLocator; now: number }) {
  return Database.transaction((db) =>
    persistArchitectGoalProjection(db, {
      taskID: input.taskID,
      producer: {
        kind: "architect_turn",
        session_id: Identifier.ascending("session"),
        final_message_id: Identifier.ascending("message"),
      },
      priorGoalGraphProjectionArtifactLocator: input.prior,
      observedArtifactLocators: [],
      sourceArtifactLocators: [],
      architectGoals: input.goalIDs.map((id, index) => ({
        goalID: id,
        llmID: id,
        title: `Goal ${index + 1}`,
        objective: `Deliver Goal ${index + 1}`,
        acceptance_specs: [],
        owned_paths: [],
        priority: "blocking" as const,
        kind: "feature",
      })),
      removals: [],
      graph: { contracts: [] },
      fidelity: { sourceCoverage: [], referenceCoverage: [], assemblyOwners: [] },
      now: input.now,
    }),
  )
}

async function createWorkloadTurn(input: {
  task: Awaited<ReturnType<typeof createTaskFixture>>
  selectedGoalIDs: string[]
  continuationOfDispatchID?: string
  workflowOccurrenceID?: string
  existingChild?: { id: string }
  workflowNodeID?: string
  workflowBinding?: SelectedWorkflowBinding
}) {
  const dispatchID = Identifier.ascending("artifact")
  const child =
    input.existingChild ??
    (await Session.create({
      kind: "goal-workload-analyst",
      parentID: input.task.root.id,
      title: "Workload Analyst",
    }))
  const parent = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "user",
    author: "orchestrator",
    time: { created: input.task.now + 10 },
    agent: workloadIdentity.agentID,
    model: { providerID: "test", modelID: "test-model" },
  })
  const control = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: child.id,
    messageID: parent.id,
    type: "text",
    text: "Analyze the selected Workload subjects",
  })
  const workflowBinding = input.workflowBinding ?? {
    kind: "virtual_workflow" as const,
    workflow_id: "goal-workload-coverage",
    package_revision: expertSquadPackageRevisionBinding(packageRevision),
    nodes: ["workload-0", "workload-1", "workload-2", "workload-3"].map((nodeID) => ({
      node_id: nodeID,
      agent_id: workloadIdentity.agentID,
      depends_on: [],
    })),
  }
  const workflowNodeID = input.workflowNodeID ?? "workload-0"
  const occurrenceID = input.workflowOccurrenceID ?? dispatchID
  const lineage = recordDispatchLineage({
    origin: createDispatchLineageOrigin({
      dispatchID,
      taskID: input.task.taskID,
      orchestratorSessionID: input.task.root.id,
      orchestratorMessageID: Identifier.ascending("message"),
      toolPartID: Identifier.ascending("part"),
      toolCallID: Identifier.ascending("call"),
      targetAgentID: workloadIdentity.agentID,
      projectedWorkerIdentity: workloadIdentity,
      workScope: { kind: "task" },
      deliverySliceRevisionIDs: input.selectedGoalIDs,
      workflowBinding,
      workflowNodeID,
      workflowOccurrenceID: occurrenceID,
      continuationOfDispatchID: input.continuationOfDispatchID,
      adapterInput: { goal_ids: input.selectedGoalIDs },
    }),
    childSessionID: child.id,
    now: input.task.now + 11,
  })
  const descriptor = WorkerTurnDescriptor.create({
    sessionID: child.id,
    payload: {
      identity: workloadIdentity,
      expertSquadID: packageRevision.id,
      packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test-model" },
      prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
      tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID: input.task.taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: parent.id,
        control_text_parts: [{ part_id: control.id, text_sha256: taskRequestSHA256(control.text) }],
      },
      dispatchTurn: input.continuationOfDispatchID
        ? {
            kind: "continuation",
            source_dispatch_id: input.continuationOfDispatchID,
            child_session_id: child.id,
            current_dispatch_id: dispatchID,
            workflow_binding: workflowBinding,
            workflow_node_id: workflowNodeID,
            workflow_occurrence_id: occurrenceID,
            delivery_slice_revision_ids: input.selectedGoalIDs,
            evidence_locators: [],
            task_authority: {
              task_id: input.task.taskID,
              root_session_id: input.task.root.id,
              request_sha256: taskRequestSHA256(input.task.request),
              initial_control_text_parts: [],
            },
          }
        : {
            kind: "initial",
            current_dispatch_id: dispatchID,
            workflow_binding: workflowBinding,
            workflow_node_id: workflowNodeID,
            workflow_occurrence_id: occurrenceID,
            delivery_slice_revision_ids: input.selectedGoalIDs,
            evidence_locators: [],
            task_authority: {
              task_id: input.task.taskID,
              root_session_id: input.task.root.id,
              request_sha256: taskRequestSHA256(input.task.request),
              initial_control_text_parts: [],
            },
          },
    },
  })
  const final = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "assistant",
    author: workloadIdentity.agentID,
    parentID: parent.id,
    time: { created: input.task.now + 12, completed: input.task.now + 13 },
    agent: workloadIdentity.agentID,
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  return { dispatchID, occurrenceID, child, final, lineage, descriptor }
}

const workloadWorkflowID = "goal-workload-production-chain"
const workloadNodeID = "workload-reviewer"
const integrityNodeID = "system-integrity-reviewer"
const virtualWorkflows = {
  [workloadWorkflowID]: {
    label: "Workload then integrity",
    description: "Verify that only complete Workload coverage opens Integrity.",
    nodes: {
      [workloadNodeID]: {
        agent_id: workloadIdentity.agentID,
        description: "Publish exact Workload coverage.",
        depends_on: [],
      },
      [integrityNodeID]: {
        agent_id: "system-integrity-reviewer",
        description: "Consume complete Workload evidence.",
        depends_on: [workloadNodeID],
      },
    },
  },
}

const projectedWorkloadAgent = {
  identity: workloadIdentity,
  packageRevision,
  virtualWorkflows,
  capabilityOwner: "package" as const,
  label: "Workload reviewer",
  builtInToolIDs: [],
  projectedToolIDs: [],
}

const projectedIntegrityAgent = {
  identity: {
    agentID: "system-integrity-reviewer",
    baseRole: "integrity" as const,
    sessionKind: "integrity" as const,
    dispatchAdapterID: "integrity" as const,
    runtimeTemplateABIVersion: 1 as const,
    dispatchAdapterABIVersion: 1 as const,
    projectionHash: "d".repeat(64),
  },
  packageRevision,
  virtualWorkflows,
  capabilityOwner: "package" as const,
  label: "System integrity reviewer",
  builtInToolIDs: [],
  projectedToolIDs: [],
}

async function createCompletedWorkloadAgentTurn(input: {
  task: Awaited<ReturnType<typeof createTaskFixture>>
  dispatchTurn: NonNullable<Parameters<typeof GoalWorkloadAnalystAgent.analyze>[0]["dispatchTurn"]>
  briefs: WorkloadBrief[]
  onSessionCreated?: (sessionID: string) => void | Promise<void>
  onDispatchAuthorityCommit?: Parameters<typeof GoalWorkloadAnalystAgent.analyze>[0]["onDispatchAuthorityCommit"]
}) {
  const child = await Session.create({
    kind: "goal-workload-analyst",
    parentID: input.task.root.id,
    title: "Production-chain Workload Analyst",
  })
  await input.onSessionCreated?.(child.id)
  const parent = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "user",
    author: "orchestrator",
    time: { created: input.task.now + 10 },
    agent: workloadIdentity.agentID,
    model: { providerID: "test", modelID: "test-model" },
  })
  const control = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: child.id,
    messageID: parent.id,
    type: "text",
    text: "Analyze exact Workload subjects through the production adapter",
  })
  const descriptor = WorkerTurnDescriptor.create({
    sessionID: child.id,
    payload: {
      identity: workloadIdentity,
      expertSquadID: packageRevision.id,
      packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test-model" },
      prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
      tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID: input.task.taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: parent.id,
        control_text_parts: [{ part_id: control.id, text_sha256: taskRequestSHA256(control.text) }],
      },
      dispatchTurn: input.dispatchTurn,
    },
  })
  await input.onDispatchAuthorityCommit?.(child.id, descriptor)
  const final = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "assistant",
    author: workloadIdentity.agentID,
    parentID: parent.id,
    time: { created: input.task.now + 12, completed: input.task.now + 13 },
    agent: workloadIdentity.agentID,
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  return { briefs: input.briefs, sessionID: child.id, finalMessageID: final.id }
}

async function executeProductionWorkloadDispatch(input: {
  task: Awaited<ReturnType<typeof createTaskFixture>>
  selectedGoalIDs: string[]
  briefs: WorkloadBrief[]
}) {
  const analyzeSpy = spyOn(GoalWorkloadAnalystAgent, "analyze").mockImplementation(async (analysisInput) =>
    createCompletedWorkloadAgentTurn({
      task: input.task,
      dispatchTurn: analysisInput.dispatchTurn!,
      briefs: input.briefs,
      onSessionCreated: analysisInput.onSessionCreated,
      onDispatchAuthorityCommit: analysisInput.onDispatchAuthorityCommit,
    }),
  )
  try {
    const workloadTool = createWorkloadAnalysisTool({
      inputSchema: DispatchAdapterContractRegistry.inputSchema("workload_analysis"),
      taskID: input.task.taskID,
      agentSessionID: input.task.root.id,
    }).workload_analysis
    const executors = Object.fromEntries(
      DispatchAdapterContractRegistry.ids.map((id) => [
        id,
        id === "workload_analysis"
          ? async (args: unknown, context: Parameters<NonNullable<typeof workloadTool.execute>>[1]) =>
              workloadTool.execute!(args as never, context)
          : async () => {
              throw new Error(`unexpected ${id} adapter execution`)
            },
      ]),
    ) as Record<AgentDispatchAdapterID, DispatchAdapterExecutors[AgentDispatchAdapterID]>
    const dispatchTool = createDispatchAgentTool({
      taskID: input.task.taskID,
      projectedAgents: [projectedWorkloadAgent, projectedIntegrityAgent],
      executors,
      runDetached: async (run) => run(),
      runDetachedRecovery: async (run) => run(),
      runInWorktree: async ({ run }) => run(),
      openLineage({
        taskID,
        targetAgentID,
        projectedAgent,
        workScope,
        deliverySliceRevisionIDs,
        workflowBinding,
        workflowNodeID,
        adapterInput,
      }) {
        if (!workflowBinding || !workflowNodeID) throw new Error("production-chain dispatch lost workflow authority")
        const dispatchID = Identifier.ascending("artifact")
        const origin = createDispatchLineageOrigin({
          dispatchID,
          taskID,
          orchestratorSessionID: input.task.root.id,
          orchestratorMessageID: Identifier.ascending("message"),
          toolPartID: Identifier.ascending("part"),
          toolCallID: Identifier.ascending("call"),
          targetAgentID,
          projectedWorkerIdentity: projectedAgent.identity,
          workScope,
          deliverySliceRevisionIDs,
          workflowBinding,
          workflowNodeID,
          adapterInput,
        })
        const turn = {
          kind: "initial" as const,
          current_dispatch_id: dispatchID,
          workflow_binding: workflowBinding,
          workflow_node_id: workflowNodeID,
          workflow_occurrence_id: origin.workflowOccurrenceID,
          delivery_slice_revision_ids: deliverySliceRevisionIDs,
          evidence_locators: [],
          task_authority: {
            task_id: taskID,
            root_session_id: input.task.root.id,
            request_sha256: taskRequestSHA256(input.task.request),
            initial_control_text_parts: [],
          },
        }
        return {
          dispatchID,
          deliverySliceRevisionIDs,
          turn,
          adapterInput,
          observeSession() {},
          commitSession(sessionID: string) {
            const lineage = recordDispatchLineage({ origin, childSessionID: sessionID, now: input.task.now + 11 })
            return { artifactID: lineage.artifactID }
          },
        }
      },
    })
    if (!dispatchTool.execute) throw new Error("dispatch_agent has no production executor")
    const firstOutcome = await dispatchTool.execute(
      {
        dispatch: {
          target: workloadIdentity.agentID,
          work_scope: { kind: "task" },
          turn: {
            kind: "initial",
            workflow_subject: {
              kind: "virtual_workflow",
              workflow_id: workloadWorkflowID,
              node_id: workloadNodeID,
            },
            use_worktree: false,
            input: { reason: "Verify exact workload coverage", goal_ids: input.selectedGoalIDs },
          },
        },
      },
      {} as never,
    )
    const dispatchID = listGoalWorkloadArtifacts(input.task.taskID)[0]?.payload.dispatch.dispatch_id
    if (!dispatchID) throw new Error("production-chain dispatch did not publish Workload evidence")
    const outcome =
      firstOutcome.kind === "accepted"
        ? await (async () => {
            for (let attempt = 0; attempt < 200; attempt += 1) {
              const settlement = findDispatchSettlementByDispatchID({ taskID: input.task.taskID, dispatchID })
              if (settlement) return settlement.payload.outcome
              await Bun.sleep(10)
            }
            throw new Error(`production-chain dispatch ${dispatchID} did not settle`)
          })()
        : firstOutcome
    return { outcome, projection: await describeTask(input.task.taskID) }
  } finally {
    analyzeSpy.mockRestore()
  }
}

function replaceArtifactPayloadForStartup(artifactID: string, payload: Record<string, unknown> | "malformed-json") {
  Database.close()
  const sqlite = new BunDatabase(Database.Path())
  try {
    const triggers = sqlite
      .query<
        { name: string; sql: string },
        []
      >("SELECT name, sql FROM sqlite_schema WHERE type = 'trigger' AND tbl_name IN ('engine_artifact', 'engine_artifact_version') ORDER BY name")
      .all()
    if (triggers.length === 0 || triggers.some((trigger) => !trigger.sql)) {
      throw new Error("artifact integrity trigger fixture is incomplete")
    }
    for (const trigger of triggers) sqlite.run(`DROP TRIGGER "${trigger.name}"`)
    const payloadText = payload === "malformed-json" ? "{" : serializeEngineArtifactPayload(payload)
    const metadata =
      payload === "malformed-json"
        ? { payload_sha256: "0".repeat(64), payload_bytes: 1 }
        : deriveEngineArtifactCatalogMetadata({ kind: "goal_workload", payloadText })
    const update = sqlite.prepare(
      "UPDATE engine_artifact SET payload = ?, payload_sha256 = ?, payload_bytes = ? WHERE id = ?",
    )
    try {
      update.run(payloadText, metadata.payload_sha256, metadata.payload_bytes, artifactID)
    } finally {
      update.finalize()
    }
    for (const trigger of triggers) sqlite.run(trigger.sql)
  } finally {
    sqlite.close(true)
  }
}

async function expectStartupResetRequired(artifactID: string) {
  let observed: unknown
  try {
    Database.Client()
  } catch (error) {
    observed = error
  }
  try {
    expect(DatabaseUnavailableError.isInstance(observed) ? observed.data : undefined).toMatchObject({
      code: "DATA_RESET_REQUIRED",
      operation: "Database.Client.dataIntegrity.goalWorkloadCoverage",
      message: expect.stringContaining(artifactID),
    })
  } finally {
    await Database.resetFiles(Database.Path())
    Database.Client()
  }
}

describe("Goal Workload coverage contract", () => {
  test("independent processes publish one immutable per-dispatch Workload fact", async () => {
    await using project = await memoryProject()
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Goal Workload process tests require the repository test runtime")
    const runtime = await createManagedTemporaryDirectory(processRoot, "goal-workload-publication-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "goal-workload-publication-barrier-")
    const fixturePath = path.join(barrier, "fixture.json")
    const worker = path.join(import.meta.dir, "fixture", "goal-workload-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime, OPENCORVUS_TEST_PROCESS_ROOT: processRoot }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: string, label = "worker", release = "go") => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          fixturePath,
          label,
          release,
        ],
        { cwd: path.join(import.meta.dir, ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>, expectedExit = 0) => {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect(exitCode, stderr).toBe(expectedExit)
      return JSON.parse(stdout.trim()) as Record<string, any>
    }
    const waitForReady = async (workers: Array<{ label: string; child: ReturnType<typeof spawn> }>) => {
      const deadline = Date.now() + 120_000
      while (true) {
        const entries = await fs.readdir(barrier)
        if (workers.every(({ label }) => entries.includes(`${label}.ready`))) return
        const exited = workers.find(({ child }) => child.exitCode !== null)
        if (exited) {
          const stderr = await new Response(exited.child.stderr).text()
          throw new Error(`Goal Workload worker ${exited.label} exited before barrier: ${stderr}`)
        }
        if (Date.now() >= deadline) {
          throw new Error(
            `Goal Workload workers did not reach barrier: ${workers.map(({ label }) => label).join(", ")}`,
          )
        }
        await Bun.sleep(5)
      }
    }
    try {
      await read(spawn("init-publication"))
      const first = spawn("publish", "publication-a")
      const second = spawn("publish", "publication-b")
      await waitForReady([
        { label: "publication-a", child: first },
        { label: "publication-b", child: second },
      ])
      await fs.writeFile(path.join(barrier, "go"), "go")
      const receipts = await Promise.all([read(first), read(second)])
      expect(receipts.map((receipt) => receipt.publication)).toEqual([
        expect.objectContaining({ deliveryStatus: "complete" }),
        expect.objectContaining({ deliveryStatus: "complete" }),
      ])
      expect(receipts[0]!.publication.locator).toEqual(receipts[1]!.publication.locator)
      expect(receipts.map((receipt) => receipt.exactArtifactCount)).toEqual([1, 1])
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill()
      await Promise.all(children.map((child) => child.exited.catch(() => -1)))
      await removeManagedDirectoryTree(runtime)
      await removeManagedDirectoryTree(barrier)
    }
  }, 180_000)

  test("independent settlement callers return the same durable first winner in both controlled orders", async () => {
    await using project = await memoryProject()
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Goal Workload process tests require the repository test runtime")
    const runtime = await createManagedTemporaryDirectory(processRoot, "goal-workload-settlement-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "goal-workload-settlement-barrier-")
    const fixturePath = path.join(barrier, "fixture.json")
    const worker = path.join(import.meta.dir, "fixture", "goal-workload-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime, OPENCORVUS_TEST_PROCESS_ROOT: processRoot }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: string, label = "worker", release = "go") => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          fixturePath,
          label,
          release,
        ],
        { cwd: path.join(import.meta.dir, ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as Record<string, any>
    }
    const waitForReady = async (workers: Array<{ label: string; child: ReturnType<typeof spawn> }>) => {
      const deadline = Date.now() + 120_000
      while (true) {
        const entries = await fs.readdir(barrier)
        if (workers.every(({ label }) => entries.includes(`${label}.ready`))) return
        for (const { label, child } of workers) {
          if (child.exitCode === null) continue
          const [stdout, stderr] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
          ])
          throw new Error(
            `Settlement worker ${label} exited before its barrier (exit=${child.exitCode}): ${stderr || stdout}`,
          )
        }
        if (Date.now() >= deadline) {
          throw new Error(`Settlement workers did not reach barrier: ${workers.map(({ label }) => label).join(", ")}`)
        }
        await Bun.sleep(5)
      }
    }
    try {
      await read(spawn("init-settlement"))
      for (const candidate of [
        { index: 0, first: "mapped", second: "partial", expected: undefined },
        { index: 1, first: "mapped", second: "partial", expected: "terminal_success" },
        { index: 2, first: "partial", second: "mapped", expected: "partial" },
      ] as const) {
        const firstLabel = `${candidate.index}-${candidate.first}`
        const secondLabel = `${candidate.index}-${candidate.second}`
        const simultaneousRelease = `release-${candidate.index}`
        const first = spawn(
          "settle",
          firstLabel,
          candidate.expected === undefined ? simultaneousRelease : `release-${candidate.index}-first`,
        )
        const second = spawn(
          "settle",
          secondLabel,
          candidate.expected === undefined ? simultaneousRelease : `release-${candidate.index}-second`,
        )
        await waitForReady([
          { label: firstLabel, child: first },
          { label: secondLabel, child: second },
        ])
        if (candidate.expected === undefined) {
          await fs.writeFile(path.join(barrier, simultaneousRelease), "go")
          const [firstReceipt, secondReceipt] = await Promise.all([read(first), read(second)])
          expect([firstReceipt.winner.kind, secondReceipt.winner.kind]).toSatisfy(
            (kinds: string[]) => kinds[0] === kinds[1] && (kinds[0] === "terminal_success" || kinds[0] === "partial"),
          )
        } else {
          await fs.writeFile(path.join(barrier, `release-${candidate.index}-first`), "go")
          const firstReceipt = await read(first)
          await fs.writeFile(path.join(barrier, `release-${candidate.index}-second`), "go")
          const secondReceipt = await read(second)
          expect([firstReceipt.winner.kind, secondReceipt.winner.kind]).toEqual([
            candidate.expected,
            candidate.expected,
          ])
        }
      }
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill()
      await Promise.all(children.map((child) => child.exited.catch(() => -1)))
      await removeManagedDirectoryTree(runtime)
      await removeManagedDirectoryTree(barrier)
    }
  }, 240_000)

  for (const candidate of [
    { label: "incomplete", submitted: 1, expectedKind: "domain_incomplete", expectedFrontier: [] },
    {
      label: "complete",
      submitted: 2,
      expectedKind: "terminal_success",
      expectedFrontier: [integrityNodeID],
    },
  ] as const) {
    test(`production dispatch and adapter chain projects the ${candidate.label} Workload frontier`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const task = await createTaskFixture(`Production ${candidate.label} Workload frontier`)
          const goalIDs = [Identifier.ascending("goal"), Identifier.ascending("goal")].sort()
          persistGoalGraph({ taskID: task.taskID, goalIDs, now: task.now + 1 })
          const result = await executeProductionWorkloadDispatch({
            task,
            selectedGoalIDs: goalIDs,
            briefs: goalIDs.slice(0, candidate.submitted).map(brief),
          })
          const workload = listGoalWorkloadArtifacts(task.taskID)[0]!
          expect({
            outcome: result.outcome,
            receipt: workload.payload.coverage_receipt,
            workflow: result.projection.workflow_execution,
          }).toMatchObject({
            outcome: {
              kind: candidate.expectedKind,
              ...(candidate.expectedKind === "domain_incomplete"
                ? {
                    domain: "workload_analysis",
                    domain_artifact: {
                      source: "engine_artifact",
                      artifact_id: workload.id,
                      catalog_revision: expect.any(Number),
                    },
                  }
                : {}),
            },
            receipt: {
              status: candidate.label,
              missing_selected_revision_ids: candidate.label === "incomplete" ? [goalIDs[1]!] : [],
            },
            workflow: {
              nodes: [
                { node_id: integrityNodeID, terminal_success: false, dispatches: [] },
                {
                  node_id: workloadNodeID,
                  terminal_success: candidate.expectedKind === "terminal_success",
                  dispatches: [{ settlement: { outcome_kind: candidate.expectedKind } }],
                },
              ],
              frontier_node_ids: candidate.expectedFrontier,
            },
          })
        },
      })
    }, 45_000)
  }

  test("derives canonical incomplete, conflict, and complete receipts", () => {
    expect([
      deriveGoalWorkloadCoverage({
        selectedRevisionIDs: [goalA, goalB],
        submittedRevisionIDs: [],
        currentRevisionIDs: [goalA, goalB],
        currentGoalGraphAvailable: true,
      }),
      deriveGoalWorkloadCoverage({
        selectedRevisionIDs: [goalA],
        submittedRevisionIDs: [goalA, goalA, goalB],
        currentRevisionIDs: [goalB],
        currentGoalGraphAvailable: true,
      }),
      deriveGoalWorkloadCoverage({
        selectedRevisionIDs: [goalA, goalB],
        submittedRevisionIDs: [goalB, goalA],
        currentRevisionIDs: [goalA, goalB],
        currentGoalGraphAvailable: true,
      }),
      deriveGoalWorkloadCoverage({
        selectedRevisionIDs: [],
        submittedRevisionIDs: [],
        currentRevisionIDs: [],
        currentGoalGraphAvailable: false,
      }),
    ]).toEqual([
      expect.objectContaining({
        status: "incomplete",
        missing_selected_revision_ids: [goalA, goalB].sort(),
        issues: ["selected_revision_missing"],
      }),
      expect.objectContaining({
        status: "conflict",
        extra_unselected_revision_ids: [goalB],
        duplicate_revision_ids: [goalA],
        stale_selected_revision_ids: [goalA],
        issues: ["unselected_revision_submitted", "revision_submitted_more_than_once", "selected_revision_not_current"],
      }),
      expect.objectContaining({ status: "complete", issues: [] }),
      expect.objectContaining({
        status: "incomplete",
        issues: ["selected_revision_set_empty", "current_goal_graph_unavailable"],
      }),
    ])
  })

  test("retains unselected and repeated collector submissions as exact evidence", async () => {
    const output = createGoalWorkloadOutputTools({ knownGoalIDs: [goalA] })
    const first = await output.tools.register_workload_brief.execute?.(brief(goalA), {} as never)
    const duplicate = await output.tools.register_workload_brief.execute?.(brief(goalA), {} as never)
    const extra = await output.tools.register_workload_brief.execute?.(brief(goalB), {} as never)
    expect({ first, duplicate, extra, collector: output.getCollector() }).toEqual({
      first: `OK: workload brief for "${goalA}" registered (1 total).`,
      duplicate: `Error: goal_id "${goalA}" was submitted more than once. Submission retained as duplicate coverage evidence.`,
      extra:
        `Error: goal_id "${goalB}" is not a registered plan goal. Known goals: ${goalA}. ` +
        "Submission retained as invalid coverage evidence.",
      collector: { briefs: [brief(goalA), brief(goalA), brief(goalB)] },
    })
  })

  test("strict version 2 rejects a receipt that disagrees with raw coverage facts", () => {
    const valid = artifact({ selected: [goalA], briefs: [brief(goalA)], current: [goalA] })
    expect(GoalWorkloadArtifactSchema.parse(valid).coverage_receipt.status).toBe("complete")
    expect(() =>
      GoalWorkloadArtifactSchema.parse({
        ...valid,
        briefs: [brief(goalA), brief(goalA)],
      }),
    ).toThrow("duplicate_revision_ids is not canonical")
  })

  test("publication identity is stable and domain-separated", () => {
    const taskID = Identifier.ascending("task")
    const dispatchID = Identifier.ascending("artifact")
    const first = goalWorkloadPublicationArtifactID({ taskID, dispatchID })
    const second = goalWorkloadPublicationArtifactID({ taskID, dispatchID })
    expect({ first, second, valid: /^art_goal_workload_[a-f0-9]{64}$/.test(first) }).toEqual({
      first,
      second: first,
      valid: true,
    })
  })

  test("publishes from a production-shaped nested Orchestrator and reuses its exact occurrence identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const dispatchID = Identifier.ascending("artifact")
        const request = "Persist exact empty Workload coverage"
        const now = Date.now()
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Empty Workload coverage",
          metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
        })
        persistEstablishedTask({
          taskID,
          rootSession: root,
          now,
          title: "Empty Workload coverage",
          request,
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
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "Task Orchestrator",
        })
        const child = await Session.create({
          kind: "goal-workload-analyst",
          parentID: orchestrator.id,
          title: "Workload Analyst",
        })
        const parent = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: child.id,
          role: "user",
          author: "orchestrator",
          time: { created: now + 1 },
          agent: "goal-workload-analyst",
          model: { providerID: "test", modelID: "test-model" },
        })
        const control = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: child.id,
          messageID: parent.id,
          type: "text",
          text: "Analyze the selected Workload subjects",
        })
        const identity = {
          agentID: "goal-workload-analyst",
          baseRole: "goal-workload-analyst" as const,
          sessionKind: "goal-workload-analyst" as const,
          dispatchAdapterID: "workload_analysis" as const,
          runtimeTemplateABIVersion: 1 as const,
          dispatchAdapterABIVersion: 1 as const,
          projectionHash: "b".repeat(64),
        }
        const workflowBinding = {
          kind: "direct" as const,
          package_revision: expertSquadPackageRevisionBinding(packageRevision),
        }
        const lineage = recordDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID,
            taskID,
            orchestratorSessionID: orchestrator.id,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: identity.agentID,
            projectedWorkerIdentity: identity,
            workScope: { kind: "task" },
            workflowBinding,
            workflowNodeID: null,
            adapterInput: { goal_ids: [] },
          }),
          childSessionID: child.id,
          now: now + 2,
        })
        WorkerTurnDescriptor.create({
          sessionID: child.id,
          payload: {
            identity,
            expertSquadID: packageRevision.id,
            packageRevision,
            model: { selection: "explicit", providerID: "test", modelID: "test-model" },
            prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
            tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
            output: { format: "text", resultMode: "reply" },
            lifecycle: { taskID, workScope: { kind: "task" } },
            messageAuthority: {
              user_message_id: parent.id,
              control_text_parts: [{ part_id: control.id, text_sha256: taskRequestSHA256(control.text) }],
            },
            dispatchTurn: {
              kind: "initial",
              current_dispatch_id: dispatchID,
              workflow_binding: workflowBinding,
              workflow_node_id: null,
              workflow_occurrence_id: dispatchID,
              delivery_slice_revision_ids: [],
              evidence_locators: [],
              task_authority: {
                task_id: taskID,
                root_session_id: root.id,
                request_sha256: taskRequestSHA256(request),
                initial_control_text_parts: [],
              },
            },
          },
        })
        const final = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: child.id,
          role: "assistant",
          author: identity.agentID,
          parentID: parent.id,
          time: { created: now + 3, completed: now + 4 },
          agent: identity.agentID,
          providerID: "test",
          modelID: "test-model",
          path: { cwd: Instance.directory, root: Instance.directory },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const published = publishGoalWorkload({
          taskID,
          dispatchID,
          sessionID: child.id,
          finalMessageID: final.id,
          briefs: [],
          now: now + 5,
        })
        const replay = publishGoalWorkload({
          taskID,
          dispatchID,
          sessionID: child.id,
          finalMessageID: final.id,
          briefs: [],
          now: now + 6,
        })
        const rows = listGoalWorkloadArtifacts(taskID)
        expect({
          published,
          replay,
          lineageID: rows[0]?.payload.dispatch.dispatch_lineage_artifact_id,
          rows,
        }).toMatchObject({
          published: { deliveryStatus: "incomplete" },
          replay: published,
          lineageID: lineage.artifactID,
          rows: [
            {
              id: published.locator.artifact_id,
              payload: {
                schema_version: 2,
                selected_subjects: [],
                briefs: [],
                coverage_receipt: {
                  status: "incomplete",
                  current_goal_graph_projection_artifact_locator: null,
                  current_revision_ids: [],
                  issues: ["selected_revision_set_empty", "current_goal_graph_unavailable"],
                },
              },
            },
          ],
        })
        let conflict: unknown
        try {
          publishGoalWorkload({
            taskID,
            dispatchID,
            sessionID: child.id,
            finalMessageID: final.id,
            briefs: [brief(goalA)],
            now: now + 7,
          })
        } catch (cause) {
          conflict = cause
        }
        expect(conflict).toBeInstanceOf(GoalWorkloadPublicationConflictError)
        expect(conflict).toMatchObject({ code: "publication_payload_mismatch", mismatchedFields: ["briefs"] })
      },
    })
  }, 30_000)

  test("publishes complete, missing, extra, and duplicate receipts against the real GoalGraph tip", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await createTaskFixture("GoalGraph coverage matrix")
        const goalIDs = [Identifier.ascending("goal"), Identifier.ascending("goal")].sort()
        const projection = persistGoalGraph({ taskID: task.taskID, goalIDs, now: task.now + 1 })
        const cases = [
          {
            briefs: goalIDs.map(brief),
            status: "complete",
            issues: [],
            missing: [],
            extra: [],
            duplicate: [],
          },
          {
            briefs: [brief(goalIDs[0]!)],
            status: "incomplete",
            issues: ["selected_revision_missing"],
            missing: [goalIDs[1]!],
            extra: [],
            duplicate: [],
          },
          {
            selected: [goalIDs[0]!],
            briefs: [brief(goalIDs[0]!), brief(goalIDs[1]!)],
            status: "conflict",
            issues: ["unselected_revision_submitted"],
            missing: [],
            extra: [goalIDs[1]!],
            duplicate: [],
          },
          {
            selected: [goalIDs[0]!],
            briefs: [brief(goalIDs[0]!), brief(goalIDs[0]!)],
            status: "conflict",
            issues: ["revision_submitted_more_than_once"],
            missing: [],
            extra: [],
            duplicate: [goalIDs[0]!],
          },
        ] as const
        for (const [index, candidate] of cases.entries()) {
          const selected = [...(candidate.selected ?? goalIDs)]
          const turn = await createWorkloadTurn({
            task,
            selectedGoalIDs: selected,
            workflowNodeID: `workload-${index}`,
          })
          const published = publishGoalWorkload({
            taskID: task.taskID,
            dispatchID: turn.dispatchID,
            sessionID: turn.child.id,
            finalMessageID: turn.final.id,
            briefs: candidate.briefs,
            now: task.now + 20 + index,
          })
          const row = listGoalWorkloadArtifacts(task.taskID).find((item) => item.id === published.locator.artifact_id)!
          expect({ published, receipt: row.payload.coverage_receipt }).toMatchObject({
            published: { deliveryStatus: candidate.status },
            receipt: {
              status: candidate.status,
              issues: candidate.issues,
              missing_selected_revision_ids: candidate.missing,
              extra_unselected_revision_ids: candidate.extra,
              duplicate_revision_ids: candidate.duplicate,
              current_goal_graph_projection_artifact_locator: projection.goalGraphProjectionArtifactLocator,
              current_revision_ids: goalIDs,
            },
          })
        }
      },
    })
  }, 45_000)

  test("records stale selected revisions while binding the newer successful GoalGraph tip", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await createTaskFixture("Stale Workload subject")
        const oldGoal = Identifier.ascending("goal")
        const first = persistGoalGraph({ taskID: task.taskID, goalIDs: [oldGoal], now: task.now + 1 })
        const turn = await createWorkloadTurn({ task, selectedGoalIDs: [oldGoal] })
        const newGoal = Identifier.ascending("goal")
        const second = Database.transaction((db) =>
          persistArchitectGoalProjection(db, {
            taskID: task.taskID,
            producer: {
              kind: "architect_turn",
              session_id: Identifier.ascending("session"),
              final_message_id: Identifier.ascending("message"),
            },
            priorGoalGraphProjectionArtifactLocator: first.goalGraphProjectionArtifactLocator,
            observedArtifactLocators: [],
            sourceArtifactLocators: [],
            architectGoals: [
              {
                goalID: newGoal,
                llmID: newGoal,
                title: "Replacement Goal",
                objective: "Replace the prior revision",
                acceptance_specs: [],
                owned_paths: [],
                priority: "blocking",
                kind: "feature",
              },
            ],
            removals: [{ goal_id: oldGoal, reason: "Superseded by a new revision" }],
            graph: { contracts: [] },
            fidelity: { sourceCoverage: [], referenceCoverage: [], assemblyOwners: [] },
            now: task.now + 2,
          }),
        )
        const published = publishGoalWorkload({
          taskID: task.taskID,
          dispatchID: turn.dispatchID,
          sessionID: turn.child.id,
          finalMessageID: turn.final.id,
          briefs: [brief(oldGoal)],
          now: task.now + 3,
        })
        const receipt = listGoalWorkloadArtifacts(task.taskID)[0]!.payload.coverage_receipt
        expect({ published, receipt }).toMatchObject({
          published: { deliveryStatus: "conflict" },
          receipt: {
            stale_selected_revision_ids: [oldGoal],
            current_revision_ids: [newGoal],
            current_goal_graph_projection_artifact_locator: second.goalGraphProjectionArtifactLocator,
            issues: ["selected_revision_not_current"],
          },
        })
      },
    })
  }, 30_000)

  test("ignores a later projection-null candidate and keeps the successful GoalGraph tip", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await createTaskFixture("Projection candidate high-water")
        const goalID = Identifier.ascending("goal")
        const success = persistGoalGraph({ taskID: task.taskID, goalIDs: [goalID], now: task.now + 1 })
        Database.transaction((db) =>
          persistArchitectUnprojectableGoalGraphCandidate(db, {
            taskID: task.taskID,
            producer: {
              kind: "architect_turn",
              session_id: Identifier.ascending("session"),
              final_message_id: Identifier.ascending("message"),
            },
            priorGoalGraphProjectionArtifactLocator: success.goalGraphProjectionArtifactLocator,
            observedArtifactLocators: [],
            sourceArtifactLocators: [],
            architectGoals: [],
            removals: [],
            graph: { contracts: [] },
            fidelity: { sourceCoverage: [], referenceCoverage: [], assemblyOwners: [] },
            conflicts: [{ code: "unprojectable_contract_graph", message: "Injected typed candidate conflict" }],
            now: task.now + 2,
          }),
        )
        const turn = await createWorkloadTurn({ task, selectedGoalIDs: [goalID] })
        const published = publishGoalWorkload({
          taskID: task.taskID,
          dispatchID: turn.dispatchID,
          sessionID: turn.child.id,
          finalMessageID: turn.final.id,
          briefs: [brief(goalID)],
          now: task.now + 3,
        })
        const receipt = listGoalWorkloadArtifacts(task.taskID)[0]!.payload.coverage_receipt
        expect({ published, receipt }).toMatchObject({
          published: { deliveryStatus: "complete" },
          receipt: {
            current_goal_graph_projection_artifact_locator: success.goalGraphProjectionArtifactLocator,
            current_revision_ids: [goalID],
            issues: [],
          },
        })
        await Database.awaitEffectIdle(30_000)
        Database.close()
        Database.Client()
        expect(
          listGoalWorkloadArtifacts(task.taskID)[0]?.payload.coverage_receipt
            .current_goal_graph_projection_artifact_locator,
        ).toEqual(success.goalGraphProjectionArtifactLocator)
      },
    })
  }, 30_000)

  test("reopens a valid strict version-2 Workload database", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await createTaskFixture("Valid Workload startup")
        const turn = await createWorkloadTurn({ task, selectedGoalIDs: [] })
        publishGoalWorkload({
          taskID: task.taskID,
          dispatchID: turn.dispatchID,
          sessionID: turn.child.id,
          finalMessageID: turn.final.id,
          briefs: [],
          now: task.now + 20,
        })
        await Database.awaitEffectIdle(30_000)
        Database.close()
        expect(() => Database.Client()).not.toThrow()
        expect(listGoalWorkloadArtifacts(task.taskID)[0]?.payload.schema_version).toBe(2)
      },
    })
  }, 30_000)

  for (const mutation of [
    "legacy-v1",
    "malformed-json",
    "wrong-kind-locator",
    "revision-drift",
    "dispatch-lineage-drift",
    "workflow-occurrence-drift",
    "producer-session-drift",
    "producer-message-drift",
    "selected-subject-drift",
    "turn-provenance-drift",
  ] as const) {
    test(`startup rejects ${mutation} Goal Workload coverage`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const task = await createTaskFixture(`Invalid Workload startup ${mutation}`)
          const goalID = Identifier.ascending("goal")
          persistGoalGraph({ taskID: task.taskID, goalIDs: [goalID], now: task.now + 1 })
          const turn = await createWorkloadTurn({ task, selectedGoalIDs: [goalID] })
          const published = publishGoalWorkload({
            taskID: task.taskID,
            dispatchID: turn.dispatchID,
            sessionID: turn.child.id,
            finalMessageID: turn.final.id,
            briefs: [brief(goalID)],
            now: task.now + 20,
          })
          const original = structuredClone(listGoalWorkloadArtifacts(task.taskID)[0]!.payload) as Record<
            string,
            unknown
          >
          let mutated: Record<string, unknown> | "malformed-json" = original
          if (mutation === "legacy-v1") mutated = { ...original, schema_version: 1 }
          if (mutation === "malformed-json") mutated = "malformed-json"
          if (mutation === "wrong-kind-locator") {
            const receipt = structuredClone(original.coverage_receipt) as Record<string, unknown>
            receipt.current_goal_graph_projection_artifact_locator = published.locator
            mutated = { ...original, coverage_receipt: receipt }
          }
          if (mutation === "revision-drift") {
            const receipt = structuredClone(original.coverage_receipt) as Record<string, unknown>
            Object.assign(
              receipt,
              deriveGoalWorkloadCoverage({
                selectedRevisionIDs: [goalID],
                submittedRevisionIDs: [goalID],
                currentRevisionIDs: [],
                currentGoalGraphAvailable: true,
              }),
            )
            mutated = { ...original, coverage_receipt: receipt }
          }
          if (mutation === "dispatch-lineage-drift") {
            mutated = {
              ...original,
              dispatch: {
                ...(original.dispatch as Record<string, unknown>),
                dispatch_lineage_artifact_id: Identifier.ascending("artifact"),
              },
            }
          }
          if (mutation === "workflow-occurrence-drift") {
            mutated = {
              ...original,
              dispatch: {
                ...(original.dispatch as Record<string, unknown>),
                workflow_occurrence_id: Identifier.ascending("artifact"),
              },
            }
          }
          if (mutation === "producer-session-drift") {
            mutated = {
              ...original,
              producer: {
                ...(original.producer as Record<string, unknown>),
                session_id: Identifier.ascending("session"),
              },
            }
          }
          if (mutation === "producer-message-drift") {
            mutated = {
              ...original,
              producer: {
                ...(original.producer as Record<string, unknown>),
                final_message_id: Identifier.ascending("message"),
              },
            }
          }
          if (mutation === "selected-subject-drift") {
            const driftGoalID = Identifier.ascending("goal")
            const receipt = {
              ...deriveGoalWorkloadCoverage({
                selectedRevisionIDs: [driftGoalID],
                submittedRevisionIDs: [driftGoalID],
                currentRevisionIDs: [goalID],
                currentGoalGraphAvailable: true,
              }),
              current_goal_graph_projection_artifact_locator: (original.coverage_receipt as Record<string, unknown>)
                .current_goal_graph_projection_artifact_locator,
            }
            mutated = {
              ...original,
              selected_subjects: [
                { delivery_slice_id: driftGoalID, delivery_slice_revision_id: driftGoalID, revision: 1 },
              ],
              briefs: [brief(driftGoalID)],
              coverage_receipt: receipt,
            }
          }
          if (mutation === "turn-provenance-drift") {
            mutated = { ...original, observed_artifact_locators: [published.locator] }
          }
          await Database.awaitEffectIdle(30_000)
          replaceArtifactPayloadForStartup(published.locator.artifact_id, mutated)
          await expectStartupResetRequired(published.locator.artifact_id)
        },
      })
    }, 30_000)
  }

  test("a recovered partial remains immutable while a new continuation dispatch succeeds", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await createTaskFixture("Workload crash continuation")
        const goalID = Identifier.ascending("goal")
        persistGoalGraph({ taskID: task.taskID, goalIDs: [goalID], now: task.now + 1 })
        const initial = await createWorkloadTurn({ task, selectedGoalIDs: [goalID] })
        const initialPublication = publishGoalWorkload({
          taskID: task.taskID,
          dispatchID: initial.dispatchID,
          sessionID: initial.child.id,
          finalMessageID: initial.final.id,
          briefs: [brief(goalID)],
          now: task.now + 20,
        })
        const recoveredPartial = DispatchOutcome.partial({
          sessionID: initial.child.id,
          finalMessageID: initial.final.id,
          failedOperation: "recover_dispatch_domain_settlement",
        })
        settleDispatchOrReturnExisting({
          taskID: task.taskID,
          dispatchID: initial.dispatchID,
          outcome: recoveredPartial,
          now: task.now + 21,
        })
        const continuation = await createWorkloadTurn({
          task,
          selectedGoalIDs: [goalID],
          continuationOfDispatchID: initial.dispatchID,
          workflowOccurrenceID: initial.occurrenceID,
          existingChild: initial.child,
        })
        const continuationPublication = publishGoalWorkload({
          taskID: task.taskID,
          dispatchID: continuation.dispatchID,
          sessionID: continuation.child.id,
          finalMessageID: continuation.final.id,
          briefs: [brief(goalID)],
          now: task.now + 30,
        })
        const continuationSuccess = DispatchOutcome.terminal({
          sessionID: continuation.child.id,
          finalMessageID: continuation.final.id,
        })
        settleDispatchOrReturnExisting({
          taskID: task.taskID,
          dispatchID: continuation.dispatchID,
          outcome: continuationSuccess,
          now: task.now + 31,
        })
        expect({
          initialPublication,
          continuationPublication,
          initialSettlement: findDispatchSettlementByDispatchID({
            taskID: task.taskID,
            dispatchID: initial.dispatchID,
          })?.payload.outcome,
          continuationSettlement: findDispatchSettlementByDispatchID({
            taskID: task.taskID,
            dispatchID: continuation.dispatchID,
          })?.payload.outcome,
          artifactIDs: listGoalWorkloadArtifacts(task.taskID).map((row) => row.id),
        }).toEqual({
          initialPublication: expect.objectContaining({ deliveryStatus: "complete" }),
          continuationPublication: expect.objectContaining({ deliveryStatus: "complete" }),
          initialSettlement: recoveredPartial,
          continuationSettlement: continuationSuccess,
          artifactIDs: [initialPublication.locator.artifact_id, continuationPublication.locator.artifact_id],
        })
      },
    })
  }, 30_000)

  test("startup lifecycle reconciliation freezes the crashed dispatch before a continuation succeeds", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => {})
        const task = await createTaskFixture("Production startup Workload recovery")
        const goalID = Identifier.ascending("goal")
        persistGoalGraph({ taskID: task.taskID, goalIDs: [goalID], now: task.now + 1 })
        const initial = await createWorkloadTurn({ task, selectedGoalIDs: [goalID] })
        const initialPublication = publishGoalWorkload({
          taskID: task.taskID,
          dispatchID: initial.dispatchID,
          sessionID: initial.child.id,
          finalMessageID: initial.final.id,
          briefs: [brief(goalID)],
          now: task.now + 20,
        })
        const inputMessageID = initial.descriptor.payload.messageAuthority.user_message_id
        await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: initial.child.id,
          role: "assistant",
          author: workloadIdentity.agentID,
          parentID: inputMessageID,
          time: { created: task.now + 14, completed: task.now + 15 },
          agent: workloadIdentity.agentID,
          providerID: "test",
          modelID: "test-model",
          path: { cwd: Instance.directory, root: Instance.directory },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "tool-calls",
        })
        const orderKey = executionLifecycleOrderKey(initial.child.id, inputMessageID)
        await ProtocolStore.appendEvent({
          kind: "event",
          type: "agent.execution.lifecycle",
          // Same envelope the production session bridge emits: the Task is the
          // aggregate and the Session is a reference, which is what task-root
          // ingress accepts as a causal source.
          aggregate: "task",
          aggregate_id: task.taskID,
          task_id: null,
          session_id: initial.child.id,
          source: "goal-workload-coverage-contract-test",
          // The envelope owns task, session, and order identity; the payload
          // carries only what is its own
          // (protocol_event_payload_envelope_shape).
          order_key: orderKey,
          payload: {
            inputMessageID,
            status: {
              type: "terminal",
              reason: "completed",
              final_message_id: initial.final.id,
            },
          },
        })
        await Database.awaitEffectIdle(30_000)
        Database.close()
        Database.Client()
        const recovered = await reconcileTerminalAgentLifecycleDelivery({
          taskID: task.taskID,
          sessionID: initial.child.id,
          dispatchID: initial.dispatchID,
        })
        const continuation = await createWorkloadTurn({
          task,
          selectedGoalIDs: [goalID],
          continuationOfDispatchID: initial.dispatchID,
          workflowOccurrenceID: initial.occurrenceID,
          existingChild: initial.child,
        })
        const continuationPublication = publishGoalWorkload({
          taskID: task.taskID,
          dispatchID: continuation.dispatchID,
          sessionID: continuation.child.id,
          finalMessageID: continuation.final.id,
          briefs: [brief(goalID)],
          now: task.now + 30,
        })
        const continuationOutcome = DispatchOutcome.terminal({
          sessionID: continuation.child.id,
          finalMessageID: continuation.final.id,
        })
        settleDispatchOrReturnExisting({
          taskID: task.taskID,
          dispatchID: continuation.dispatchID,
          outcome: continuationOutcome,
          now: task.now + 31,
        })
        expect({
          recovered,
          initialArtifact: listGoalWorkloadArtifacts(task.taskID).find(
            (row) => row.id === initialPublication.locator.artifact_id,
          )?.payload.coverage_receipt.status,
          initialSettlement: findDispatchSettlementByDispatchID({
            taskID: task.taskID,
            dispatchID: initial.dispatchID,
          })?.payload.outcome,
          continuationArtifact: listGoalWorkloadArtifacts(task.taskID).find(
            (row) => row.id === continuationPublication.locator.artifact_id,
          )?.payload.coverage_receipt.status,
          continuationSettlement: findDispatchSettlementByDispatchID({
            taskID: task.taskID,
            dispatchID: continuation.dispatchID,
          })?.payload.outcome,
        }).toEqual({
          recovered: "delivered",
          initialArtifact: "complete",
          initialSettlement: DispatchOutcome.partial({
            sessionID: initial.child.id,
            finalMessageID: initial.final.id,
            failedOperation: "recover_dispatch_domain_settlement",
          }),
          continuationArtifact: "complete",
          continuationSettlement: continuationOutcome,
        })
      },
    })
  }, 45_000)

  test("settle-or-return-existing preserves the first committed dispatch outcome", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Settlement winner",
          metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
        })
        persistEstablishedTask({
          taskID,
          rootSession: root,
          now,
          title: "Settlement winner",
          request: "Preserve the first durable outcome",
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
        const child = await Session.create({ kind: "goal-workload-analyst", parentID: root.id, title: "Workload" })
        const dispatchID = Identifier.ascending("artifact")
        recordDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID,
            taskID,
            orchestratorSessionID: root.id,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: "goal-workload-analyst",
            projectedWorkerIdentity: {
              agentID: "goal-workload-analyst",
              baseRole: "goal-workload-analyst",
              sessionKind: "goal-workload-analyst",
              dispatchAdapterID: "workload_analysis",
              runtimeTemplateABIVersion: 1,
              dispatchAdapterABIVersion: 1,
              projectionHash: "b".repeat(64),
            },
            workScope: { kind: "task" },
            workflowBinding: {
              kind: "direct",
              package_revision: expertSquadPackageRevisionBinding(packageRevision),
            },
            workflowNodeID: null,
            adapterInput: { goal_ids: [] },
          }),
          childSessionID: child.id,
          now: now + 1,
        })
        const partial = DispatchOutcome.partial({
          sessionID: child.id,
          finalMessageID: Identifier.ascending("message"),
          failedOperation: "recover_dispatch_domain_settlement",
        })
        const success = DispatchOutcome.terminal({
          sessionID: child.id,
          finalMessageID: Identifier.ascending("message"),
        })
        const winner = settleDispatchOrReturnExisting({ taskID, dispatchID, outcome: partial, now: now + 2 })
        const loserView = settleDispatchOrReturnExisting({ taskID, dispatchID, outcome: success, now: now + 3 })
        expect({
          winner: winner.payload.outcome,
          loserView: loserView.payload.outcome,
          persisted: findDispatchSettlementByDispatchID({ taskID, dispatchID })?.payload.outcome,
        }).toEqual({
          winner: partial,
          loserView: partial,
          persisted: partial,
        })
        expect(() => recordDispatchSettlement({ taskID, dispatchID, outcome: success, now: now + 4 })).toThrow(
          "durable settlement outcome drift",
        )
      },
    })
    await Database.awaitEffectIdle(30_000)
    await Bus.TestHooks.disposeOwnedState()
  }, 30_000)

  test("settle-or-return-existing also preserves a mapped outcome that commits before recovery", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await createTaskFixture("Mapped settlement winner")
        const turn = await createWorkloadTurn({ task, selectedGoalIDs: [] })
        const success = DispatchOutcome.terminal({
          sessionID: turn.child.id,
          finalMessageID: turn.final.id,
        })
        const partial = DispatchOutcome.partial({
          sessionID: turn.child.id,
          finalMessageID: turn.final.id,
          failedOperation: "recover_dispatch_domain_settlement",
        })
        const winner = settleDispatchOrReturnExisting({
          taskID: task.taskID,
          dispatchID: turn.dispatchID,
          outcome: success,
          now: task.now + 20,
        })
        const recoveryView = settleDispatchOrReturnExisting({
          taskID: task.taskID,
          dispatchID: turn.dispatchID,
          outcome: partial,
          now: task.now + 21,
        })
        expect({ winner: winner.payload.outcome, recoveryView: recoveryView.payload.outcome }).toEqual({
          winner: success,
          recoveryView: success,
        })
      },
    })
  }, 30_000)
})
