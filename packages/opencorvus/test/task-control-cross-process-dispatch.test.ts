import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "../src/config/config"
import { DispatchOutcome } from "../src/agent/dispatch-outcome"
import { WorkerTurnDescriptor } from "../src/agent/worker-turn-descriptor"
import { createDispatchLineageOrigin, recordDispatchLineage } from "../src/engine/dispatch-lineage"
import { findDispatchSettlementByDispatchID, settleDispatchOrReturnExisting } from "../src/engine/dispatch-settlement"
import { insertEngineArtifact } from "../src/engine/artifact"
import {
  EngineArtifactTable,
  EngineControlActivationLeaseTable,
  EngineTaskRootIngressTable,
} from "../src/engine/engine.sql"
import {
  PROCESS_LIVENESS_LEASE_MS,
  ProcessLivenessOwnerUnavailableError,
  joinProcessLivenessLease,
} from "../src/engine/process-liveness"
import { requireTask } from "../src/engine/store"
import { selectedWorkflowBinding } from "../src/engine/workflow-binding"
import { taskRequestSHA256 } from "../src/orchestrator/dispatch-turn-projection"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { reconcileTaskControlPlane, TestHooks as TaskControlTestHooks } from "../src/engine/task-root-ingress-delivery"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../src/id/id"
import { BrowserMCPBuiltin } from "../src/mcp/browser/builtin"
import { Instance } from "../src/project/instance"
import { ProtocolStore } from "../src/protocol/store"
import { currentRuntimeOccurrenceID } from "../src/runtime/process-occurrence"
import { Session } from "../src/session"
import { executionLifecycleOrderKey } from "../src/session/status"
import { Database, eq, sql } from "../src/storage/db"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const PEER = currentRuntimeOccurrenceID()

/** One Task with one committed dispatch lineage owned by this fixture's exact
 * process-liveness occurrence. */
async function seedPeerOwnedDispatch(projectPath: string, claimOwner = true) {
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
  const child = await Session.create({
    kind: worker.identity.sessionKind,
    parentID: root.id,
    title: "Peer-owned worker",
  })
  const dispatchID = Identifier.ascending("artifact")
  const workflowBinding = selectedWorkflowBinding({
    projection: { packageRevision: scheduler.packageRevision, virtualWorkflows: scheduler.virtualWorkflows },
    workflowID: null,
  })
  const liveness = claimOwner ? joinProcessLivenessLease(currentRuntimeOccurrenceID()) : undefined
  let lineage: ReturnType<typeof recordDispatchLineage>
  try {
    lineage = recordDispatchLineage({
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
        workflowBinding,
        workflowNodeID: null,
        adapterInput: {},
      }),
      childSessionID: child.id,
    })
  } finally {
    liveness?.release()
  }
  const inputMessage = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "user",
    author: "orchestrator",
    agent: worker.identity.agentID,
    model: { providerID: "test", modelID: "test-model" },
    time: { created: now + 1 },
  })
  const controlText = `Execute dispatch ${dispatchID}`
  const controlPart = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: child.id,
    messageID: inputMessage.id,
    type: "text",
    text: controlText,
  })
  const descriptor = WorkerTurnDescriptor.create({
    sessionID: child.id,
    payload: {
      identity: worker.identity,
      expertSquadID: scheduler.packageRevision.id,
      packageRevision: scheduler.packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test-model" },
      prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
      tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: inputMessage.id,
        control_text_parts: [{ part_id: controlPart.id, text_sha256: taskRequestSHA256(controlText) }],
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
          request_sha256: taskRequestSHA256(task.request),
          initial_control_text_parts: [],
        },
      },
    },
  })
  return { taskID, dispatchID, child, descriptor, lineage }
}

function claimPeerLiveness(occurrenceID: string, expiresAt: number) {
  const timeActivated = Math.min(Date.now(), expiresAt - 1)
  Database.immediateTransaction((db) => {
    db.insert(EngineControlActivationLeaseTable)
      .values({
        id: Identifier.ascending("activity"),
        target: "runtime_process",
        target_id: occurrenceID,
        owner_occurrence_id: occurrenceID,
        time_activated: timeActivated,
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

function replaceLineageDeliveryOwnerForTest(
  lineageArtifactID: string,
  deliveryOwner:
    | { kind: "historical_reconciliation"; source: { kind: "dispatch_settlement"; artifact_id: string } }
    | { kind: "historical_reconciliation"; source: { kind: "agent_execution_lifecycle"; event_id: string } },
) {
  Database.immediateTransaction((db) => {
    const triggers = db.all<{ name: string; sql: string }>(
      sql`SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name='engine_artifact' ORDER BY name`,
    )
    if (triggers.length === 0 || triggers.some((trigger) => !trigger.sql)) {
      throw new Error("engine Artifact triggers are unavailable")
    }
    for (const trigger of triggers) {
      db.run(sql.raw(`DROP TRIGGER "${trigger.name.replaceAll('"', '""')}"`))
    }
    try {
      const lineage = db
        .select()
        .from(EngineArtifactTable)
        .where(eq(EngineArtifactTable.id, lineageArtifactID))
        .get()
      if (!lineage) throw new Error(`Dispatch lineage ${lineageArtifactID} does not exist`)
      db.update(EngineArtifactTable)
        .set({ payload: { ...lineage.payload, delivery_owner: deliveryOwner } })
        .where(eq(EngineArtifactTable.id, lineageArtifactID))
        .run()
    } finally {
      for (const trigger of triggers) db.run(sql.raw(trigger.sql))
    }
  })
}

describe("cross-process dispatch abandonment", () => {
  test("leaves a peer backend's dispatch alone while that peer's liveness lease is current", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, dispatchID, lineage } = await seedPeerOwnedDispatch(project.path)
        claimPeerLiveness(PEER, Date.now() + PROCESS_LIVENESS_LEASE_MS)

        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:this-backend")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await reconcileTaskControlPlane(taskID)

        // This process holds no pipeline for the peer's dispatch and never
        // will. Reading its own memory would declare a live worker abandoned
        // on every heartbeat — the cross-process kill loop this fences.
        expect({
          deliveryOwner: lineage.payload.delivery_owner,
          settlement: findDispatchSettlementByDispatchID({ taskID, dispatchID }),
          recoveryIngresses: recoveryIngressCount(taskID),
        }).toEqual({
          deliveryOwner: { kind: "runtime_process", process_occurrence_id: PEER },
          settlement: undefined,
          recoveryIngresses: 0,
        })
      },
    })
  })

  test("settles the same dispatch once the peer's liveness lease has expired", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, dispatchID } = await seedPeerOwnedDispatch(project.path)
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

  test("recovers exact error and aborted terminal occurrences that ended before a final Message", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixtures = []
        for (const reason of ["error", "aborted"] as const) {
          const fixture = await seedPeerOwnedDispatch(project.path)
          fixtures.push({ reason, fixture })
        }
        claimPeerLiveness(PEER, Date.now() - 1)
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:this-backend")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })

        for (const { reason, fixture } of fixtures) {
          const error = reason === "error" ? "provider stream failed" : "caller cancelled worker"
          await ProtocolStore.appendEvent({
            kind: "event",
            type: "agent.execution.lifecycle",
            aggregate: "task",
            aggregate_id: fixture.taskID,
            task_id: null,
            session_id: fixture.child.id,
            source: "task-control-cross-process-dispatch-test",
            order_key: executionLifecycleOrderKey(
              fixture.child.id,
              fixture.descriptor.payload.messageAuthority.user_message_id,
            ),
            payload: {
              inputMessageID: fixture.descriptor.payload.messageAuthority.user_message_id,
              status: { type: "terminal", reason, error },
            },
          })
          await Database.awaitEffectIdle(30_000)

          await reconcileTaskControlPlane(fixture.taskID)
          await reconcileTaskControlPlane(fixture.taskID)

          const settlement = findDispatchSettlementByDispatchID({
            taskID: fixture.taskID,
            dispatchID: fixture.dispatchID,
          })
          const recoveryIngresses = Database.use((db) =>
            db
              .select({ sourceID: EngineTaskRootIngressTable.source_id })
              .from(EngineTaskRootIngressTable)
              .where(eq(EngineTaskRootIngressTable.task_id, fixture.taskID))
              .all()
              .filter((row) => row.sourceID === settlement?.payload.outcome.infrastructure_error?.artifact_id),
          )
          expect({
            reason,
            outcome: settlement?.payload.outcome,
            settlementSessionID: settlement?.payload.session_id,
            settlementLineageID: settlement?.payload.dispatch_lineage_id,
            recoveryIngresses,
          }).toMatchObject({
            reason,
            outcome: {
              kind: "infrastructure_failure",
              operation: "recover-terminal-agent-lifecycle",
              message: error,
              session_id: fixture.child.id,
              recovery_authority: {
                occurrence_status: "occurrence_committed",
                dispatch_lineage_id: fixture.lineage.artifactID,
                dispatch_id: fixture.dispatchID,
              },
              worker_turn: {
                descriptor_id: fixture.descriptor.id,
                descriptor_hash: fixture.descriptor.hash,
                input_message_id: fixture.descriptor.payload.messageAuthority.user_message_id,
                current_dispatch_id: fixture.dispatchID,
              },
              failure_issues: [{ code: reason, path: ["agent_execution_lifecycle", "status"], message: error }],
            },
            settlementSessionID: fixture.child.id,
            settlementLineageID: fixture.lineage.artifactID,
            recoveryIngresses: [{ sourceID: expect.any(String) }],
          })
        }
      },
    })
  }, 30_000)

  test("replays the exact historical lifecycle source even after a later terminal event", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await seedPeerOwnedDispatch(project.path)
        const inputMessageID = fixture.descriptor.payload.messageAuthority.user_message_id
        const bound = await ProtocolStore.appendEvent({
          id: "pev_historical_bound",
          kind: "event",
          type: "agent.execution.lifecycle",
          aggregate: "task",
          aggregate_id: fixture.taskID,
          task_id: null,
          session_id: fixture.child.id,
          source: "task-control-cross-process-dispatch-test",
          order_key: executionLifecycleOrderKey(fixture.child.id, inputMessageID),
          payload: {
            inputMessageID,
            status: { type: "terminal", reason: "error", error: "bound historical failure" },
          },
        })
        await ProtocolStore.appendEvent({
          id: "pev_historical_later",
          kind: "event",
          type: "agent.execution.lifecycle",
          aggregate: "task",
          aggregate_id: fixture.taskID,
          task_id: null,
          session_id: fixture.child.id,
          source: "task-control-cross-process-dispatch-test",
          order_key: executionLifecycleOrderKey(fixture.child.id, inputMessageID),
          emitted_at: bound.time.emitted + 1,
          payload: {
            inputMessageID,
            status: { type: "terminal", reason: "error", error: "later sibling failure" },
          },
        })
        replaceLineageDeliveryOwnerForTest(fixture.lineage.artifactID, {
          kind: "historical_reconciliation",
          source: { kind: "agent_execution_lifecycle", event_id: bound.id },
        })

        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:this-backend")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await reconcileTaskControlPlane(fixture.taskID)

        expect(
          findDispatchSettlementByDispatchID({ taskID: fixture.taskID, dispatchID: fixture.dispatchID })?.payload
            .outcome,
        ).toMatchObject({ kind: "infrastructure_failure", message: "bound historical failure" })
      },
    })
  })

  test("preserves an exact failed lifecycle final Message instead of a later adjacent reply", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await seedPeerOwnedDispatch(project.path)
        claimPeerLiveness(PEER, Date.now() - 1)
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:this-backend")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const inputMessageID = fixture.descriptor.payload.messageAuthority.user_message_id
        const now = Date.now()
        const exactFinal = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: fixture.child.id,
          parentID: inputMessageID,
          role: "assistant",
          author: fixture.descriptor.payload.identity.agentID,
          agent: fixture.descriptor.payload.identity.agentID,
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: now, completed: now + 1 },
          finish: "stop",
        })
        await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: fixture.child.id,
          parentID: inputMessageID,
          role: "assistant",
          author: fixture.descriptor.payload.identity.agentID,
          agent: fixture.descriptor.payload.identity.agentID,
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: now + 2, completed: now + 3 },
          finish: "stop",
        })
        await ProtocolStore.appendEvent({
          kind: "event",
          type: "agent.execution.lifecycle",
          aggregate: "task",
          aggregate_id: fixture.taskID,
          task_id: null,
          session_id: fixture.child.id,
          source: "task-control-cross-process-dispatch-test",
          order_key: executionLifecycleOrderKey(fixture.child.id, inputMessageID),
          payload: {
            inputMessageID,
            status: {
              type: "terminal",
              reason: "error",
              error: "post-turn settlement failed",
              final_message_id: exactFinal.id,
            },
          },
        })
        await Database.awaitEffectIdle(30_000)

        await reconcileTaskControlPlane(fixture.taskID)
        await reconcileTaskControlPlane(fixture.taskID)

        const settlement = findDispatchSettlementByDispatchID({
          taskID: fixture.taskID,
          dispatchID: fixture.dispatchID,
        })
        const infrastructureArtifactID =
          settlement?.payload.outcome.kind === "infrastructure_failure"
            ? settlement.payload.outcome.infrastructure_error?.artifact_id
            : undefined
        const ingressSourceIDs = Database.use((db) =>
          db
            .select({ sourceID: EngineTaskRootIngressTable.source_id })
            .from(EngineTaskRootIngressTable)
            .where(eq(EngineTaskRootIngressTable.task_id, fixture.taskID))
            .all()
            .filter((row) => row.sourceID === infrastructureArtifactID),
        )
        expect({ outcome: settlement?.payload.outcome, ingressSourceIDs }).toMatchObject({
          outcome: {
            kind: "infrastructure_failure",
            final_message_id: exactFinal.id,
            worker_turn: {
              descriptor_id: fixture.descriptor.id,
              input_message_id: inputMessageID,
              current_dispatch_id: fixture.dispatchID,
            },
          },
          ingressSourceIDs: [{ sourceID: infrastructureArtifactID }],
        })
      },
    })
  }, 30_000)

  test("wakes the Orchestrator for a dispatch that settled but never reached it", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, dispatchID, descriptor, child, lineage } = await seedPeerOwnedDispatch(project.path)
        // The outcome is recorded before it is handed over, so a failure in
        // between leaves a settled dispatch that woke nothing. Abandonment
        // recovery cannot see it: by definition it looks for unsettled work.
        const settlement = settleDispatchOrReturnExisting({
          taskID,
          dispatchID,
          outcome: DispatchOutcome.partial({
            sessionID: Database.use(
              (db) =>
                db
                  .select()
                  .from(EngineArtifactTable)
                  .all()
                  .find((row) => row.kind === "dispatch_lineage")!.payload as { child_session_id: string },
            ).child_session_id,
            finalMessageID: Identifier.ascending("message"),
            failedOperation: "deliver-terminal-lifecycle",
          }),
        })
        await ProtocolStore.appendEvent({
          kind: "event",
          type: "agent.execution.lifecycle",
          aggregate: "task",
          aggregate_id: taskID,
          task_id: null,
          session_id: child.id,
          source: "task-control-cross-process-dispatch-test",
          order_key: executionLifecycleOrderKey(child.id, descriptor.payload.messageAuthority.user_message_id),
          payload: {
            inputMessageID: descriptor.payload.messageAuthority.user_message_id,
            status: { type: "terminal", reason: "completed" },
          },
        })
        replaceLineageDeliveryOwnerForTest(lineage.artifactID, {
          kind: "historical_reconciliation",
          source: { kind: "dispatch_settlement", artifact_id: settlement.artifactID },
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

  test("returns a typed admission error when no current process liveness owner exists", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await expect(seedPeerOwnedDispatch(project.path, false)).rejects.toMatchObject({
          name: ProcessLivenessOwnerUnavailableError.name,
          code: "PROCESS_LIVENESS_OWNER_UNAVAILABLE",
        })
      },
    })
  })

  test("returns the exact SQLite contract error for malformed lineage Tool and owner shapes", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await seedPeerOwnedDispatch(project.path)
        const invalidOwners = [
          { kind: "runtime_process", process_occurrence_id: "" },
          { kind: "runtime_process", process_occurrence_id: "runtime", source: {} },
          {
            kind: "historical_reconciliation",
            source: { kind: "dispatch_settlement", artifact_id: "settlement", extra: true },
          },
        ]
        for (const [index, deliveryOwner] of invalidOwners.entries()) {
          expect(() =>
            Database.immediateTransaction((db) => {
              insertEngineArtifact(db, {
                id: `art_invalid_delivery_owner_${index}`,
                taskID: fixture.taskID,
                kind: "dispatch_lineage",
                label: "dispatch-agent",
                payload: {
                  tool_name: "dispatch_agent",
                  tool_part_id: `part-invalid-owner-${index}`,
                  tool_call_id: `call-invalid-owner-${index}`,
                  adapter_input: {},
                  delivery_owner: deliveryOwner,
                },
                timeCreated: Date.now(),
              })
            }),
          ).toThrow("engine_artifact: dispatch_lineage requires exact Tool occurrence, adapter_input and delivery_owner objects")
        }
        const validOwner = { kind: "runtime_process", process_occurrence_id: "runtime" }
        const invalidToolOccurrences = [
          {},
          { tool_name: "dispatch_agent", collection_member_index: 0, collection_member_count: 1 },
          { tool_name: "dispatch_agents", collection_member_index: 0 },
          { tool_name: "dispatch_agents", collection_member_index: 2, collection_member_count: 2 },
        ]
        for (const [index, toolOccurrence] of invalidToolOccurrences.entries()) {
          expect(() =>
            Database.immediateTransaction((db) => {
              insertEngineArtifact(db, {
                id: `art_invalid_dispatch_tool_${index}`,
                taskID: fixture.taskID,
                kind: "dispatch_lineage",
                label: "dispatch-agent",
                payload: {
                  tool_part_id: `part-invalid-tool-${index}`,
                  tool_call_id: `call-invalid-tool-${index}`,
                  ...toolOccurrence,
                  adapter_input: {},
                  delivery_owner: validOwner,
                },
                timeCreated: Date.now(),
              })
            }),
          ).toThrow("engine_artifact: dispatch_lineage requires exact Tool occurrence, adapter_input and delivery_owner objects")
        }
      },
    })
  })
})
