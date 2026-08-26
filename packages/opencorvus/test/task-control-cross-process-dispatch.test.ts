import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "../src/config/config"
import { DispatchOutcome } from "../src/agent/dispatch-outcome"
import { createDispatchLineageOrigin, recordDispatchLineage } from "../src/engine/dispatch-lineage"
import { findDispatchSettlementByDispatchID, settleDispatchOrReturnExisting } from "../src/engine/dispatch-settlement"
import {
  EngineArtifactTable,
  EngineControlActivationLeaseTable,
  EngineTaskRootIngressTable,
} from "../src/engine/engine.sql"
import { PROCESS_LIVENESS_LEASE_MS } from "../src/engine/process-liveness"
import { requireTask } from "../src/engine/store"
import { selectedWorkflowBinding } from "../src/engine/workflow-binding"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { reconcileTaskControlPlane, TestHooks as TaskControlTestHooks } from "../src/engine/task-root-ingress-delivery"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../src/id/id"
import { BrowserMCPBuiltin } from "../src/mcp/browser/builtin"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Database, eq } from "../src/storage/db"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const PEER = "runtime:peer-backend"

/** One Task with one committed dispatch lineage owned by `owner`. */
async function seedPeerOwnedDispatch(projectPath: string, owner: string | null) {
  const config = Config.Info.parse({
    prompt_profile: { active: "base" },
    mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
  })
  const scheduler = await PromptProfileResolver.resolveSchedulerCapability({ projectDirectory: projectPath, config })
  const worker = await PromptProfileResolver.resolveWorkerCapability({
    projectDirectory: projectPath,
    config,
    packageRevision: scheduler.packageRevision,
    agentID: "base-developer",
  })
  const taskID = Identifier.ascending("task")
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Cross-process dispatch",
    metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
  })
  const now = Date.now()
  persistTask({
    taskID,
    rootSession: root,
    now,
    title: "Cross-process dispatch",
    request: "Prove a peer backend's live worker is never settled as abandoned",
    productPillar: "code",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision: scheduler.packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: scheduler.packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  const task = requireTask(taskID)
  const child = await Session.create({ kind: "delegated-worker", parentID: root.id, title: "Peer-owned worker" })
  const dispatchID = Identifier.ascending("artifact")
  recordDispatchLineage({
    origin: createDispatchLineageOrigin({
      dispatchID,
      taskID,
      orchestratorSessionID: task.session_id!,
      orchestratorMessageID: Identifier.ascending("message"),
      toolPartID: Identifier.ascending("part"),
      toolCallID: Identifier.ascending("call"),
      targetAgentID: worker.identity.agentID,
      projectedWorkerIdentity: worker.identity,
      workScope: { kind: "task" },
      workflowBinding: selectedWorkflowBinding({
        projection: { packageRevision: scheduler.packageRevision, virtualWorkflows: scheduler.virtualWorkflows },
        workflowID: null,
      }),
      workflowNodeID: null,
      adapterInput: {},
    }),
    childSessionID: child.id,
    ownerProcessOccurrenceID: owner,
  })
  return { taskID, dispatchID }
}

function claimPeerLiveness(occurrenceID: string, expiresAt: number) {
  Database.immediateTransaction((db) => {
    db.insert(EngineControlActivationLeaseTable)
      .values({
        id: Identifier.ascending("activity"),
        target: "runtime_process",
        target_id: occurrenceID,
        owner_occurrence_id: occurrenceID,
        time_activated: Date.now() - 1_000,
        expires_at: expiresAt,
      })
      .run()
  })
}

function recoveryIngressCount(taskID: string) {
  return Database.use(
    (db) =>
      db
        .select()
        .from(EngineTaskRootIngressTable)
        .where(eq(EngineTaskRootIngressTable.task_id, taskID))
        .all()
        .filter((row) => row.source === "engine_artifact").length,
  )
}

describe("cross-process dispatch abandonment", () => {
  test("leaves a peer backend's dispatch alone while that peer's liveness lease is current", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, dispatchID } = await seedPeerOwnedDispatch(project.path, PEER)
        claimPeerLiveness(PEER, Date.now() + PROCESS_LIVENESS_LEASE_MS)

        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:this-backend")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await reconcileTaskControlPlane(taskID)

        // This process holds no pipeline for the peer's dispatch and never
        // will. Reading its own memory would declare a live worker abandoned
        // on every heartbeat — the cross-process kill loop this fences.
        expect({
          settlement: findDispatchSettlementByDispatchID({ taskID, dispatchID }),
          recoveryIngresses: recoveryIngressCount(taskID),
        }).toEqual({ settlement: undefined, recoveryIngresses: 0 })
      },
    })
  })

  test("settles the same dispatch once the peer's liveness lease has expired", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, dispatchID } = await seedPeerOwnedDispatch(project.path, PEER)
        claimPeerLiveness(PEER, Date.now() - 1)

        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:this-backend")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await reconcileTaskControlPlane(taskID)
        // A second scan must not mint a second outcome or a second wake: the
        // recovery artifact identity is deterministic in the dispatch.
        await reconcileTaskControlPlane(taskID)

        const settlement = findDispatchSettlementByDispatchID({ taskID, dispatchID })
        expect({
          outcome: settlement?.payload.outcome.kind,
          recoveryIngresses: recoveryIngressCount(taskID),
        }).toEqual({ outcome: "infrastructure_failure", recoveryIngresses: 1 })
      },
    })
  })

  test("wakes the Orchestrator for a dispatch that settled but never reached it", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, dispatchID } = await seedPeerOwnedDispatch(project.path, PEER)
        claimPeerLiveness(PEER, Date.now() - 1)
        // The outcome is recorded before it is handed over, so a failure in
        // between leaves a settled dispatch that woke nothing. Abandonment
        // recovery cannot see it: by definition it looks for unsettled work.
        settleDispatchOrReturnExisting({
          taskID,
          dispatchID,
          outcome: DispatchOutcome.partial({
            sessionID: Database.use(
              (db) =>
                db.select().from(EngineArtifactTable).all().find((row) => row.kind === "dispatch_lineage")!
                  .payload as { child_session_id: string },
            ).child_session_id,
            finalMessageID: Identifier.ascending("message"),
            failedOperation: "deliver-terminal-lifecycle",
          }),
        })

        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:this-backend")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await reconcileTaskControlPlane(taskID)
        await reconcileTaskControlPlane(taskID)

        // Exactly one wake: the recovery ingress is keyed to the settlement
        // artifact, so replays collapse through the ingress source index.
        expect(recoveryIngressCount(taskID)).toBe(1)
      },
    })
  })

  test("gives a lineage with no owner claim one lease period of grace", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        // No owner claim at all is how lineages written before the claim
        // existed appear. They cannot be attributed, so a freshly committed
        // one is presumed live for exactly as long as a lease would last.
        const { taskID, dispatchID } = await seedPeerOwnedDispatch(project.path, null)

        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:this-backend")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await reconcileTaskControlPlane(taskID)

        expect(findDispatchSettlementByDispatchID({ taskID, dispatchID })).toBeUndefined()
      },
    })
  })
})
