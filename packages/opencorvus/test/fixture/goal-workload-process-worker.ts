import fs from "node:fs/promises"
import path from "node:path"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { createDispatchLineageOrigin, recordDispatchLineage } from "@/engine/dispatch-lineage"
import { findDispatchSettlementByDispatchID, settleDispatchOrReturnExisting } from "@/engine/dispatch-settlement"
import { persistArchitectGoalProjection } from "@/engine/persist"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { expertSquadPackageRevisionBinding } from "@/engine/expert-squad-package-revision-binding"
import { publishGoalWorkload } from "@/goal-workload-analyst/publication"
import { WorkloadBriefSchema, type WorkloadBrief } from "@/goal-workload-analyst/types"
import { Identifier } from "@/id/id"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { executionLifecycleOrderKey } from "@/session/status"
import { Database, count, eq } from "@/storage/db"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
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
    // The envelope owns task, session, and order identity; the payload carries
    // only what is its own (protocol_event_payload_envelope_shape).
    order_key: orderKey,
    payload: {
      inputMessageID,
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
  return Database.use(
    (db) =>
      db.select({ value: count() }).from(EngineArtifactTable).where(eq(EngineArtifactTable.id, artifactID)).get()!
        .value,
  )
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
  try {
    return await Instance.provide({
      directory: projectDirectory,
      init: async () => {},
      fn: async () => {
        Database.Client()
        if (mode === "init-publication") {
          const fixture = await createFixture("Cross-process publication")
          await fs.writeFile(fixturePath, JSON.stringify(fixture))
          return fixture
        }
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
