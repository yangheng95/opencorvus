import fs from "node:fs/promises"
import path from "node:path"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { createDispatchLineageOrigin, findDispatchLineageByDispatchID, recordDispatchLineage } from "@/engine/dispatch-lineage"
import { findDispatchSettlementByDispatchID, settleDispatchOrReturnExisting } from "@/engine/dispatch-settlement"
import { describeTask } from "@/engine/describe"
import { persistArchitectGoalProjection } from "@/engine/persist"
import { reconcileTerminalAgentLifecycleDelivery, TestHooks as IngressTestHooks } from "@/engine/task-root-ingress-delivery"
import { listGoalWorkloadArtifacts } from "@/engine/store"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { expertSquadPackageRevisionBinding } from "@/engine/expert-squad-package-revision-binding"
import { GoalWorkloadAnalystAgent } from "@/goal-workload-analyst/agent"
import { publishGoalWorkload } from "@/goal-workload-analyst/publication"
import { WorkloadBriefSchema, type WorkloadBrief } from "@/goal-workload-analyst/types"
import { Identifier } from "@/id/id"
import { createDispatchAgentTool, type DispatchAdapterExecutors } from "@/orchestrator/dispatch-agent-tool"
import { orchestratorControlOccurrenceIdentity } from "@/orchestrator/control-message-identity"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { createWorkloadAnalysisTool } from "@/orchestrator/workload-analysis-tool"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { ProtocolStore } from "@/protocol/store"
import { Session, type Message } from "@/session"
import { executionLifecycleOrderKey } from "@/session/status"
import { Database, count, eq } from "@/storage/db"
import { EngineArtifactTable, EngineTaskTable } from "@/engine/engine.sql"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { RuntimeServerOwnership } from "@/server/runtime-server-ownership"
import { persistEstablishedTask } from "./engine-task"
import { installDefaultTaskWakeRuntime } from "@/scheduler/task-wake-composition"

type Fixture = Awaited<ReturnType<typeof createFixture>>

const [mode, projectDirectory, barrierDirectory, fixturePath, workerLabel, releaseName] = process.argv.slice(2)
if (!mode || !projectDirectory || !barrierDirectory || !fixturePath) {
  throw new Error("Goal Workload process worker requires mode, project, barrier, and fixture path")
}

declareNativeTaskProcessDeployment()
installDefaultTaskWakeRuntime()

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "goal-workload-process-test",
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

const workflowID = "goal-workload-process-chain"
const workloadNodeID = "workload-reviewer"
const integrityNodeID = "system-integrity-reviewer"
const virtualWorkflows = {
  [workflowID]: {
    label: "Workload then integrity",
    description: "Cross-process Workload settlement contract.",
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

async function settleQueuedLifecycleWake(input: { taskID: string; wakeID?: string }) {
  if (!input.wakeID) throw new Error(`Task ${input.taskID} lifecycle delivery has no durable ingress identity`)
  const task = Database.use((db) =>
    db
      .select({ rootSessionID: EngineTaskTable.session_id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, input.taskID))
      .get(),
  )
  if (!task) throw new Error(`Task ${input.taskID} disappeared before lifecycle delivery`)
  const orchestrator = await Session.create({
    kind: "orchestrator",
    parentID: task.rootSessionID,
    title: "Goal Workload lifecycle recovery",
  })
  const now = Date.now()
  const controlMessageID = orchestratorControlOccurrenceIdentity(input.wakeID).messageID
  await Session.persistMessage({
    info: {
      id: controlMessageID,
      sessionID: orchestrator.id,
      role: "user",
      author: "orchestrator",
      time: { created: now },
      agent: "orchestrator",
      model: { providerID: "test", modelID: "goal-workload-process-worker" },
    },
    parts: [
      {
        id: Identifier.ascending("part"),
        sessionID: orchestrator.id,
        messageID: controlMessageID,
        type: "text",
        text: "Recover the exact terminal Workload dispatch.",
      },
    ],
  })
  const finalMessageID = Identifier.ascending("message")
  const assistant: Message.Assistant = {
    id: finalMessageID,
    sessionID: orchestrator.id,
    parentID: controlMessageID,
    role: "assistant",
    author: "orchestrator",
    time: { created: now, completed: now + 1 },
    agent: "orchestrator",
    providerID: "test",
    modelID: "goal-workload-process-worker",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
    taskIngress: { id: input.wakeID, kind: "agent_lifecycle_delivery" },
  }
  await Session.persistMessage({
    info: assistant,
    parts: [
      {
        id: Identifier.ascending("part"),
        sessionID: orchestrator.id,
        messageID: finalMessageID,
        type: "text",
        text: "Recovered terminal Workload delivery.",
        time: { start: now, end: now + 1 },
      },
    ],
  })
  return { finalMessageID }
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

async function createFixture(label: string, publish = false) {
  const now = Date.now()
  const taskID = Identifier.ascending("task")
  const request = `Verify ${label}`
  const root = await Session.create({
    kind: "root",
    title: label,
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  persistEstablishedTask({
    taskID,
    sessionID: root.id,
    now,
    title: label,
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
  const goalID = Identifier.ascending("goal")
  Database.transaction((db) =>
    persistArchitectGoalProjection(db, {
      taskID,
      producer: {
        kind: "architect_turn",
        session_id: Identifier.ascending("session"),
        final_message_id: Identifier.ascending("message"),
      },
      observedArtifactLocators: [],
      sourceArtifactLocators: [],
      architectGoals: [
        {
          goalID,
          llmID: goalID,
          title: "Goal 1",
          objective: "Deliver Goal 1",
          acceptance_specs: [],
          owned_paths: [],
          priority: "blocking",
          kind: "feature",
        },
      ],
      removals: [],
      graph: { contracts: [] },
      fidelity: { sourceCoverage: [], referenceCoverage: [], assemblyOwners: [] },
      now: now + 1,
    }),
  )
  const child = await Session.create({
    kind: "goal-workload-analyst",
    parentID: root.id,
    title: "Workload Analyst",
  })
  const parent = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "user",
    author: "orchestrator",
    time: { created: now + 10 },
    agent: workloadIdentity.agentID,
    model: { providerID: "test", modelID: "test-model" },
  })
  const controlID = Identifier.ascending("part")
  const controlText = "Analyze the selected Workload subject"
  const workflowBinding = {
    kind: "virtual_workflow" as const,
    workflow_id: workflowID,
    package_revision: expertSquadPackageRevisionBinding(packageRevision),
    nodes: [
      { node_id: workloadNodeID, agent_id: workloadIdentity.agentID, depends_on: [] },
      { node_id: integrityNodeID, agent_id: "system-integrity-reviewer", depends_on: [workloadNodeID] },
    ],
  }
  const dispatchID = Identifier.ascending("artifact")
  const origin = createDispatchLineageOrigin({
    dispatchID,
    taskID,
    orchestratorSessionID: root.id,
    orchestratorMessageID: Identifier.ascending("message"),
    toolPartID: Identifier.ascending("part"),
    toolCallID: Identifier.ascending("call"),
    targetAgentID: workloadIdentity.agentID,
    projectedWorkerIdentity: workloadIdentity,
    workScope: { kind: "task" },
    deliverySliceRevisionIDs: [goalID],
    workflowBinding,
    workflowNodeID: workloadNodeID,
    adapterInput: { goal_ids: [goalID], reason: "Verify exact workload coverage" },
  })
  recordDispatchLineage({ origin, childSessionID: child.id, now: now + 11 })
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
      lifecycle: { taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: parent.id,
        control_text_parts: [{ part_id: controlID, text_sha256: taskRequestSHA256(controlText) }],
      },
      dispatchTurn: {
        kind: "initial",
        current_dispatch_id: dispatchID,
        workflow_binding: workflowBinding,
        workflow_node_id: workloadNodeID,
        workflow_occurrence_id: origin.workflowOccurrenceID,
        delivery_slice_revision_ids: [goalID],
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
  await Session.updatePart({
    id: controlID,
    sessionID: child.id,
    messageID: parent.id,
    type: "text",
    text: controlText,
  })
  const final = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "assistant",
    author: workloadIdentity.agentID,
    parentID: parent.id,
    time: { created: now + 12, completed: now + 13 },
    agent: workloadIdentity.agentID,
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  const inputMessageID = descriptor.payload.messageAuthority.user_message_id
  const orderKey = executionLifecycleOrderKey(child.id, inputMessageID)
  await ProtocolStore.appendEvent({
    kind: "event",
    type: "agent.execution.lifecycle",
    aggregate: "session",
    aggregate_id: child.id,
    task_id: taskID,
    session_id: child.id,
    source: "goal-workload-process-worker",
    order_key: orderKey,
    payload: {
      sessionID: child.id,
      inputMessageID,
      taskID,
      orderKey,
      status: { type: "terminal", reason: "completed" },
    },
  })
  await Database.awaitEffectIdle(30_000)
  const fixture = {
    taskID,
    request,
    now,
    rootSessionID: root.id,
    goalID,
    childSessionID: child.id,
    finalMessageID: final.id,
    dispatchID,
    workflowOccurrenceID: origin.workflowOccurrenceID,
  }
  if (publish) {
    publishGoalWorkload({
      taskID,
      dispatchID,
      sessionID: child.id,
      finalMessageID: final.id,
      briefs: [brief(goalID)],
      now: now + 20,
    })
  }
  return fixture
}

async function readFixture(): Promise<Fixture> {
  return JSON.parse(await fs.readFile(fixturePath, "utf8")) as Fixture
}

async function awaitBarrier(label: string, release = releaseName ?? "go") {
  await fs.writeFile(path.join(barrierDirectory, `${label}.ready`), "ready")
  while (!(await fs.stat(path.join(barrierDirectory, release)).catch(() => undefined))) await Bun.sleep(5)
}

async function exactArtifactCount(artifactID: string) {
  return Database.use((db) =>
    db
      .select({ value: count() })
      .from(EngineArtifactTable)
      .where(eq(EngineArtifactTable.id, artifactID))
      .get()!.value,
  )
}

async function runContinuation(fixture: Fixture) {
  const originalAnalyze = GoalWorkloadAnalystAgent.analyze
  GoalWorkloadAnalystAgent.analyze = async (analysisInput) => {
    if (analysisInput.existingSessionID !== fixture.childSessionID || analysisInput.newSessionID) {
      throw new Error("Continuation did not reuse the exact prior Workload Session")
    }
    const child = { id: fixture.childSessionID }
    const parent = await Session.updateMessage({
      id: Identifier.ascending("message"),
      sessionID: child.id,
      role: "user",
      author: "orchestrator",
      time: { created: Date.now() },
      agent: workloadIdentity.agentID,
      model: { providerID: "test", modelID: "test-model" },
    })
    const controlID = Identifier.ascending("part")
    const controlText = "Continue exact Workload coverage"
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
        lifecycle: { taskID: fixture.taskID, workScope: { kind: "task" } },
        messageAuthority: {
          user_message_id: parent.id,
          control_text_parts: [{ part_id: controlID, text_sha256: taskRequestSHA256(controlText) }],
        },
        dispatchTurn: analysisInput.dispatchTurn!,
      },
    })
    await analysisInput.onDispatchAuthorityCommit?.(child.id, descriptor)
    await Session.updatePart({
      id: controlID,
      sessionID: child.id,
      messageID: parent.id,
      type: "text",
      text: controlText,
    })
    const final = await Session.updateMessage({
      id: Identifier.ascending("message"),
      sessionID: child.id,
      role: "assistant",
      author: workloadIdentity.agentID,
      parentID: parent.id,
      time: { created: Date.now(), completed: Date.now() + 1 },
      agent: workloadIdentity.agentID,
      providerID: "test",
      modelID: "test-model",
      path: { cwd: Instance.directory, root: Instance.directory },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      finish: "stop",
    })
    return { briefs: [brief(fixture.goalID)], sessionID: child.id, finalMessageID: final.id }
  }
  try {
    const workloadTool = createWorkloadAnalysisTool({
      inputSchema: DispatchAdapterContractRegistry.inputSchema("workload_analysis"),
      taskID: fixture.taskID,
      agentSessionID: fixture.rootSessionID,
    }).workload_analysis
    const executors = Object.fromEntries(
      DispatchAdapterContractRegistry.ids.map((id) => [
        id,
        id === "workload_analysis"
          ? async (args: unknown, context: Parameters<NonNullable<typeof workloadTool.execute>>[1]) =>
              workloadTool.execute!(args as never, context)
          : async () => {
              throw new Error(`Unexpected ${id} adapter execution`)
            },
      ]),
    ) as Record<AgentDispatchAdapterID, DispatchAdapterExecutors[AgentDispatchAdapterID]>
    let continuationDispatchID = ""
    const dispatchTool = createDispatchAgentTool({
      taskID: fixture.taskID,
      projectedAgents: [projectedWorkloadAgent, projectedIntegrityAgent],
      executors,
      runDetached: async (run) => run(),
      runDetachedRecovery: async (run) => run(),
      runInWorktree: async ({ run }) => run(),
      openLineage(input) {
        if (input.continuationDispatchID !== fixture.dispatchID) {
          throw new Error("dispatch_agent did not resolve the exact prior dispatch continuation authority")
        }
        const source = findDispatchLineageByDispatchID({
          taskID: fixture.taskID,
          dispatchID: input.continuationDispatchID,
        })
        if (!source) throw new Error("Continuation source lineage is missing")
        continuationDispatchID = Identifier.ascending("artifact")
        const origin = createDispatchLineageOrigin({
          dispatchID: continuationDispatchID,
          taskID: fixture.taskID,
          orchestratorSessionID: fixture.rootSessionID,
          orchestratorMessageID: Identifier.ascending("message"),
          toolPartID: Identifier.ascending("part"),
          toolCallID: Identifier.ascending("call"),
          targetAgentID: input.targetAgentID,
          projectedWorkerIdentity: input.projectedAgent.identity,
          workScope: input.workScope,
          deliverySliceRevisionIDs: [...source.payload.delivery_slice_revision_ids],
          workflowBinding: source.payload.workflow_binding,
          workflowNodeID: source.payload.workflow_node_id,
          workflowOccurrenceID: source.payload.workflow_occurrence_id,
          continuationOfDispatchID: source.dispatchID,
          adapterInput: { ...source.payload.adapter_input },
        })
        const turn = {
          kind: "continuation" as const,
          source_dispatch_id: source.dispatchID,
          child_session_id: source.payload.child_session_id,
          current_dispatch_id: continuationDispatchID,
          workflow_binding: source.payload.workflow_binding,
          workflow_node_id: source.payload.workflow_node_id,
          workflow_occurrence_id: source.payload.workflow_occurrence_id,
          delivery_slice_revision_ids: [...source.payload.delivery_slice_revision_ids],
          evidence_locators: [],
          task_authority: {
            task_id: fixture.taskID,
            root_session_id: fixture.rootSessionID,
            request_sha256: taskRequestSHA256(fixture.request),
            initial_control_text_parts: [],
          },
        }
        return {
          dispatchID: continuationDispatchID,
          deliverySliceRevisionIDs: [...source.payload.delivery_slice_revision_ids],
          existingSessionID: source.payload.child_session_id,
          turn,
          adapterInput: { ...source.payload.adapter_input },
          continuationGuidance: input.continuationGuidance,
          observeSession(sessionID: string) {
            if (sessionID !== source.payload.child_session_id) throw new Error("Continuation Session identity drift")
          },
          commitSession(sessionID: string) {
            if (sessionID !== source.payload.child_session_id) throw new Error("Continuation Session identity drift")
            const lineage = recordDispatchLineage({ origin, childSessionID: sessionID, now: Date.now() })
            return { artifactID: lineage.artifactID }
          },
        }
      },
    })
    if (!dispatchTool.execute) throw new Error("dispatch_agent has no executor")
    const immediateOutcome = await dispatchTool.execute(
      {
        dispatch: {
          target: workloadIdentity.agentID,
          work_scope: { kind: "task" },
          use_worktree: false,
          turn: {
            kind: "continuation",
            authority: { kind: "prior_dispatch", continuation_dispatch_id: fixture.dispatchID },
            guidance: "Retry the exact Workload coverage publication after startup recovery.",
            evidence_locators: [],
          },
        },
      },
      {} as never,
    )
    let outcome = immediateOutcome
    if (outcome.kind === "accepted") {
      for (let attempt = 0; attempt < 300; attempt += 1) {
        const settlement = findDispatchSettlementByDispatchID({
          taskID: fixture.taskID,
          dispatchID: continuationDispatchID,
        })
        if (settlement) {
          outcome = settlement.payload.outcome
          break
        }
        await Bun.sleep(10)
      }
    }
    const source = findDispatchLineageByDispatchID({ taskID: fixture.taskID, dispatchID: fixture.dispatchID })!
    const continuation = findDispatchLineageByDispatchID({ taskID: fixture.taskID, dispatchID: continuationDispatchID })!
    return {
      outcome,
      continuationDispatchID,
      sameSession: continuation.payload.child_session_id === source.payload.child_session_id,
      sameOccurrence: continuation.payload.workflow_occurrence_id === source.payload.workflow_occurrence_id,
      sourceDispatchID: continuation.payload.continuation_of_dispatch_id,
      artifacts: listGoalWorkloadArtifacts(fixture.taskID).map((row) => ({
        id: row.id,
        dispatchID: row.payload.dispatch.dispatch_id,
        status: row.payload.coverage_receipt.status,
      })),
      settlement: findDispatchSettlementByDispatchID({
        taskID: fixture.taskID,
        dispatchID: continuationDispatchID,
      })?.payload.outcome,
      projection: (await describeTask(fixture.taskID)).workflow_execution,
    }
  } finally {
    GoalWorkloadAnalystAgent.analyze = originalAnalyze
  }
}

async function settleCandidate() {
  Database.Client()
  const fixtures = JSON.parse(await fs.readFile(fixturePath, "utf8")) as Fixture[]
  const [indexText, outcomeKind] = (workerLabel ?? "").split("-")
  const fixture = fixtures[Number(indexText)]!
  if (outcomeKind !== "mapped" && outcomeKind !== "partial") throw new Error("Unknown settlement candidate")
  await awaitBarrier(workerLabel!, releaseName)
  const proposed =
    outcomeKind === "mapped"
      ? DispatchOutcome.terminal({ sessionID: fixture.childSessionID, finalMessageID: fixture.finalMessageID })
      : DispatchOutcome.partial({
          sessionID: fixture.childSessionID,
          finalMessageID: fixture.finalMessageID,
          failedOperation: "recover_dispatch_domain_settlement",
        })
  const winner = settleDispatchOrReturnExisting({
    taskID: fixture.taskID,
    dispatchID: fixture.dispatchID,
    outcome: proposed,
    now: Date.now(),
  })
  return { proposed: outcomeKind, winner: winner.payload.outcome }
}

async function result() {
  // Settlement concurrency owns only the shared SQLite occurrence. Entering
  // Project bootstrap here would race unrelated filesystem/project leases
  // before the deliberate pre-transaction barrier and would not exercise the
  // settlement authority under test.
  if (mode === "settle") return settleCandidate()
  if (mode === "publish") {
    return Instance.provideProjectIdentity({
      directory: projectDirectory,
      fn: async () => {
        Database.Client()
        const fixture = await readFixture()
        await awaitBarrier(workerLabel ?? String(process.pid))
        const publication = publishGoalWorkload({
          taskID: fixture.taskID,
          dispatchID: fixture.dispatchID,
          sessionID: fixture.childSessionID,
          finalMessageID: fixture.finalMessageID,
          briefs: [brief(fixture.goalID)],
          now: fixture.now + 20,
        })
        return {
          publication,
          exactArtifactCount: await exactArtifactCount(publication.locator.artifact_id),
        }
      },
    })
  }
  using _taskLoopRunner = IngressTestHooks.replaceTaskIngressRunner({
    directory: projectDirectory,
    runner: settleQueuedLifecycleWake,
  })
  const runtimeOwnership = RuntimeServerOwnership.acquire({ database: Database.Path() })
  try {
    return await Instance.provide({
      directory: projectDirectory,
      init: mode === "recover" || mode === "continue" ? InstanceBootstrap : async () => {},
      fn: async () => {
      Database.Client()
      if (mode === "init-publication") {
        const fixture = await createFixture("Cross-process publication")
        await fs.writeFile(fixturePath, JSON.stringify(fixture))
        return fixture
      }
      if (mode === "cut") {
        const fixture = await createFixture("Cross-process publication cut")
        await fs.writeFile(fixturePath, JSON.stringify(fixture))
        const publication = publishGoalWorkload({
          taskID: fixture.taskID,
          dispatchID: fixture.dispatchID,
          sessionID: fixture.childSessionID,
          finalMessageID: fixture.finalMessageID,
          briefs: [brief(fixture.goalID)],
          now: fixture.now + 20,
        })
        process.stdout.write(JSON.stringify({ fixture, publication }))
        process.exit(86)
      }
      if (mode === "recover") {
        const fixture = await readFixture()
        const recovered = await reconcileTerminalAgentLifecycleDelivery({
          taskID: fixture.taskID,
          sessionID: fixture.childSessionID,
          dispatchID: fixture.dispatchID,
        })
        return {
          recovered,
          settlement: findDispatchSettlementByDispatchID({
            taskID: fixture.taskID,
            dispatchID: fixture.dispatchID,
          })?.payload.outcome,
          artifacts: listGoalWorkloadArtifacts(fixture.taskID).map((row) => ({ id: row.id, status: row.payload.coverage_receipt.status })),
          projection: (await describeTask(fixture.taskID)).workflow_execution,
        }
      }
      if (mode === "continue") return runContinuation(await readFixture())
      if (mode === "init-settlement") {
        const fixtures = []
        for (const label of ["race", "mapped-first", "partial-first"]) {
          fixtures.push(await createFixture(`Cross-process settlement ${label}`, true))
        }
        await fs.writeFile(fixturePath, JSON.stringify(fixtures))
        return { dispatchIDs: fixtures.map((fixture) => fixture.dispatchID) }
      }
      throw new Error(`Unknown Goal Workload process worker mode: ${mode}`)
      },
    })
  } finally {
    if (runtimeOwnership) await RuntimeServerOwnership.releaseWithRetry(runtimeOwnership)
  }
}

try {
  const output = await result()
  await Instance.disposeAll()
  await Database.awaitEffectIdle(30_000)
  Database.close()
  process.stdout.write(JSON.stringify(output))
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
