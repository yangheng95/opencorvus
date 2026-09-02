import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "../src/config/config"
import { WorkerTurnDescriptor } from "../src/agent/worker-turn-descriptor"
import { createDispatchLineageOrigin } from "../src/engine/dispatch-lineage"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { findDispatchSettlementByDispatchID } from "../src/engine/dispatch-settlement"
import {
  EngineArtifactTable,
  EngineControlActivationLeaseTable,
  EngineTaskRootIngressTable,
  EngineTaskTable,
  type EngineArtifactKind,
} from "../src/engine/engine.sql"
import { insertEngineArtifact } from "../src/engine/artifact"
import {
  dispatchRecoveryCandidatesInTransaction,
  DispatchDeliveryDispositionTestHooks,
  unresolvedDispatchRecoveryPageInTransaction,
} from "../src/engine/dispatch-delivery-disposition"
import { requireTask } from "../src/engine/store"
import { selectedWorkflowBinding } from "../src/engine/workflow-binding"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import {
  dispatchTaskLoop,
  reconcileTerminalAgentLifecycleDelivery,
  reconcileTaskControlPlane,
  taskControlDriverSnapshot,
  TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET,
  TestHooks as TaskControlTestHooks,
} from "../src/engine/task-root-ingress-delivery"
import { recordTaskInfrastructureError } from "../src/engine/persist"
import { resolveDispatchOccurrenceAuthority } from "../src/engine/dispatch-lineage"
import { DispatchOutcome } from "../src/agent/dispatch-outcome"
import { exactEngineArtifactLocator } from "../src/artifact-catalog"
import {
  deriveEngineArtifactCatalogMetadata,
  engineArtifactCatalogMetadataSHA256,
} from "../src/engine/artifact-catalog-metadata"
import { engineArtifactCatalogLabelIndex } from "../src/engine/artifact-catalog-constants"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../src/id/id"
import { BrowserMCPBuiltin } from "../src/mcp/browser/builtin"
import { taskRequestSHA256 } from "../src/orchestrator/dispatch-turn-projection"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { MessageTable, SessionTable, WorkerTurnDescriptorTable } from "../src/session/session.sql"
import { ProjectTable } from "../src/project/project.sql"
import { Database, and, eq, inArray } from "../src/storage/db"
import { ProtocolStore } from "../src/protocol/store"
import { executionLifecycleOrderKey } from "../src/session/status"
import { acceptTaskRootIngressInTransaction } from "../src/engine/task-root-fact-store"
import { appendTaskReopenedInTransaction } from "../src/engine/task-lifecycle"
import { restartTaskControlProjectFrontier } from "../src/engine/task-root-ingress-disposition"
import { acquireControlLease } from "../src/engine/control-lease"
import { TaskControlDriver } from "../src/engine/task-control-driver"
import { joinProcessLivenessLease } from "../src/engine/process-liveness"
import { currentRuntimeOccurrenceID } from "../src/runtime/process-occurrence"
import {
  exportMysqlTransferSnapshot,
  importMysqlTransferSnapshot,
  preflightMysqlTransferSnapshot,
} from "../src/storage/mysql-transfer"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function replaceTransferArtifactPayload(row: Record<string, unknown>, payload: Record<string, unknown>): void {
  const payloadText = JSON.stringify(payload)
  const derived = deriveEngineArtifactCatalogMetadata({
    kind: String(row.kind) as EngineArtifactKind,
    payloadText,
  })
  Object.assign(row, {
    payload: payloadText,
    payload_sha256: derived.payload_sha256,
    payload_bytes: derived.payload_bytes,
    payload_block_sha256s: JSON.stringify(derived.payload_block_sha256s),
    payload_block_index_sha256: derived.payload_block_index_sha256,
    catalog_artifact_type: derived.catalog_artifact_type,
    catalog_schema_diagnostic: derived.catalog_schema_diagnostic,
    catalog_producer: derived.catalog_producer === null ? null : JSON.stringify(derived.catalog_producer),
    catalog_import_source_task_id: derived.catalog_import_source_task_id,
    catalog_resource_count: derived.catalog_resource_count,
    catalog_resource_media_types: JSON.stringify(derived.catalog_resource_media_types),
    catalog_search_text: derived.catalog_search_text,
    catalog_search_text_truncated: derived.catalog_search_text_truncated ? 1 : 0,
    catalog_metadata_sha256: engineArtifactCatalogMetadataSHA256({
      artifact_id: String(row.id),
      task_id: String(row.task_id),
      kind: String(row.kind) as EngineArtifactKind,
      label_index: engineArtifactCatalogLabelIndex(String(row.label)),
      time_created: Number(row.time_created),
      time_updated: Number(row.time_updated),
      ...derived,
    }),
  })
}

async function commitAcceptedDispatchDescriptor(input: {
  taskID: string
  childSessionID: string
  dispatchID: string
  worker: Awaited<ReturnType<typeof PromptProfileResolver.resolveWorkerCapability>>
  scheduler: Awaited<ReturnType<typeof PromptProfileResolver.resolveSchedulerCapability>>
  workflowBinding: ReturnType<typeof selectedWorkflowBinding>
  timeCreated?: number
}) {
  const task = requireTask(input.taskID)
  const now = Date.now()
  const message = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: input.childSessionID,
    role: "user",
    author: "orchestrator",
    agent: input.worker.identity.agentID,
    model: { providerID: "test", modelID: "test-model" },
    time: { created: now },
  })
  const controlText = `Execute dispatch ${input.dispatchID}`
  const controlPart = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: input.childSessionID,
    messageID: message.id,
    type: "text",
    text: controlText,
  })
  const prepared = WorkerTurnDescriptor.prepare({
    sessionID: input.childSessionID,
    payload: {
      identity: input.worker.identity,
      expertSquadID: input.scheduler.packageRevision.id,
      packageRevision: input.scheduler.packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test-model" },
      prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
      tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID: input.taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: message.id,
        control_text_parts: [{ part_id: controlPart.id, text_sha256: taskRequestSHA256(controlText) }],
      },
      dispatchTurn: {
        kind: "initial",
        current_dispatch_id: input.dispatchID,
        workflow_binding: input.workflowBinding,
        workflow_node_id: null,
        workflow_occurrence_id: input.dispatchID,
        delivery_slice_revision_ids: [],
        evidence_locators: [],
        task_authority: {
          task_id: input.taskID,
          root_session_id: task.session_id!,
          request_sha256: taskRequestSHA256(task.request),
          initial_control_text_parts: [],
        },
      },
    },
  })
  return WorkerTurnDescriptor.persistPrepared({
    descriptor:
      input.timeCreated === undefined
        ? prepared
        : { ...prepared, time: { created: input.timeCreated, updated: input.timeCreated } },
  })
}

/**
 * A dispatch decision resolves its ingress as soon as the worker is accepted,
 * so nothing durable remains that can wake the Orchestrator if the delivery
 * owner dies. Without abandonment recovery the Task holds an empty ready set,
 * no lease and no timer — the multi-agent stall this suite fences.
 */
describe("abandoned dispatch recovery", () => {
  test("settles a committed dispatch whose delivery owner vanished and wakes the Task", async () => {
    await using project = await memoryProject()
    let restartTaskID = ""
    let frontierDispatchIDs = new Set<string>()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          prompt_profile: { active: "base" },
          mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
        })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const worker = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: scheduler.packageRevision,
          agentID: "base-developer",
        })
        const taskID = Identifier.ascending("task")
        restartTaskID = taskID
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Abandoned dispatch recovery",
          metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
        })
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: root,
          now,
          title: "Abandoned dispatch recovery",
          request: "Prove an abandoned worker is settled and handed back to the Orchestrator",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
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

        // A worker Session committed by a runtime that is now gone: the child
        // Session exists, no terminal lifecycle was ever recorded, and this
        // process owns neither a prompt generation nor a delivery pipeline.
        const task = requireTask(taskID)
        const child = await Session.create({ kind: "delegated-worker", parentID: root.id, title: "Abandoned worker" })
        const dispatchID = Identifier.ascending("artifact")
        const remoteOwnerID = `runtime:test-live-then-expire:${Identifier.ascending("call")}`
        const lineage = (() => {
          using _remoteOwner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime(remoteOwnerID)
          return recordTestDispatchLineage({
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
              projection: {
                packageRevision: scheduler.packageRevision,
                virtualWorkflows: scheduler.virtualWorkflows,
              },
              workflowID: null,
            }),
            workflowNodeID: null,
            adapterInput: {},
            }),
            childSessionID: child.id,
          })
        })()
        const beforeDescriptor = TaskControlTestHooks.currentProjectFrontierSlice({
          connectionEpoch: Database.physicalConnectionEpoch(),
          ingress: { state: "exhausted" },
          wait: { state: "exhausted" },
          cancellation: { state: "exhausted" },
        })
        expect(beforeDescriptor.taskIDs).toEqual([])
        const descriptor = await commitAcceptedDispatchDescriptor({
          taskID,
          childSessionID: child.id,
          dispatchID,
          worker,
          scheduler,
          workflowBinding: lineage.payload.workflow_binding,
        })
        const otherProjectID = Identifier.ascending("project")
        const sameProjectOtherTaskID = Identifier.ascending("task")
        Database.immediateTransaction((db) => {
          db.insert(ProjectTable)
            .values({
              id: otherProjectID,
              worktree: `${project.path}-other`,
              sandboxes: [],
              generation: crypto.randomUUID(),
              time_created: now,
              time_updated: now,
            })
            .run()
          db.insert(EngineTaskTable)
            .values({
              id: sameProjectOtherTaskID,
              project_id: Instance.project.id,
              source: "test",
              product_pillar: "code",
              title: "Same-Project descriptor drift target",
              request: "Must not capture another Task dispatch lineage",
              time_created: now,
            })
            .run()
        })
        expect(() =>
          Database.use((db) =>
            db.update(EngineTaskTable).set({ project_id: otherProjectID }).where(eq(EngineTaskTable.id, taskID)).run(),
          ),
        ).toThrow("engine_task: Project authority is immutable")
        expect(() =>
          Database.use((db) =>
            db
              .update(WorkerTurnDescriptorTable)
              .set({ time_created: descriptor.time.created + 1 })
              .where(eq(WorkerTurnDescriptorTable.id, descriptor.id))
              .run(),
          ),
        ).toThrow("worker_turn_descriptor: immutable dispatch authority")
        expect(() =>
          Database.use((db) =>
            db.delete(WorkerTurnDescriptorTable).where(eq(WorkerTurnDescriptorTable.id, descriptor.id)).run(),
          ),
        ).toThrow("worker_turn_descriptor: immutable dispatch authority")
        const descriptorRow = Database.use((db) =>
          db.select().from(WorkerTurnDescriptorTable).where(eq(WorkerTurnDescriptorTable.id, descriptor.id)).get(),
        )!
        expect(() =>
          Database.use((db) =>
            db
              .insert(WorkerTurnDescriptorTable)
              .values({
                ...descriptorRow,
                id: Identifier.ascending("worker_turn_descriptor"),
                task_id: sameProjectOtherTaskID,
                payload: {
                  ...descriptorRow.payload,
                  lifecycle: { ...descriptorRow.payload.lifecycle, taskID: sameProjectOtherTaskID },
                },
              })
              .run(),
          ),
        ).toThrow("worker_turn_descriptor: Task Project or dispatch lineage authority mismatch")
        Database.use((db) =>
          db.delete(EngineTaskTable).where(eq(EngineTaskTable.id, sameProjectOtherTaskID)).run(),
        )
        const afterDescriptor = TaskControlTestHooks.currentProjectFrontierSlice(
          restartTaskControlProjectFrontier(beforeDescriptor.checkpoint),
        )
        expect(afterDescriptor.taskIDs).toContain(taskID)

        const unrelatedChild = await Session.create({
          kind: "delegated-worker",
          parentID: root.id,
          title: "Unrelated transfer child",
        })
        const transferSnapshot = exportMysqlTransferSnapshot()
        expect(preflightMysqlTransferSnapshot(transferSnapshot).schemaFingerprint).toBe(
          transferSnapshot.schemaFingerprint,
        )
        const descriptorTable = transferSnapshot.tables.find(
          (table) => table.name === "worker_turn_descriptor",
        )
        const artifactTable = transferSnapshot.tables.find((table) => table.name === "engine_artifact")
        const descriptorSnapshot = descriptorTable?.rows.find((row) => row.id === descriptor.id)
        if (!descriptorTable || !artifactTable || !descriptorSnapshot) {
          throw new Error("Transfer snapshot omitted the exact Worker Turn descriptor aggregate")
        }
        const expectInvalidTransferDescriptor = (snapshot: typeof transferSnapshot) => {
          expect(() => preflightMysqlTransferSnapshot(snapshot)).toThrow(
            `worker_turn_descriptor ${descriptor.id} has invalid Task Project or dispatch lineage authority`,
          )
        }
        const wrongDispatch = structuredClone(transferSnapshot)
        const wrongDispatchDescriptor = wrongDispatch.tables
          .find((table) => table.name === "worker_turn_descriptor")!
          .rows.find((row) => row.id === descriptor.id)!
        const wrongDispatchPayload = JSON.parse(String(wrongDispatchDescriptor.payload)) as Record<string, any>
        wrongDispatchPayload.dispatchTurn.current_dispatch_id = Identifier.ascending("artifact")
        wrongDispatchDescriptor.payload = JSON.stringify(wrongDispatchPayload)
        expectInvalidTransferDescriptor(wrongDispatch)

        const wrongSession = structuredClone(transferSnapshot)
        wrongSession.tables
          .find((table) => table.name === "worker_turn_descriptor")!
          .rows.find((row) => row.id === descriptor.id)!.session_id = unrelatedChild.id
        expectInvalidTransferDescriptor(wrongSession)

        const missingLineage = structuredClone(transferSnapshot)
        const missingLineageArtifacts = missingLineage.tables.find(
          (table) => table.name === "engine_artifact",
        )!
        missingLineageArtifacts.rows = missingLineageArtifacts.rows.filter((row) => row.id !== lineage.artifactID)
        expectInvalidTransferDescriptor(missingLineage)

        const malformedLineageShape = structuredClone(transferSnapshot)
        const malformedShapeRow = malformedLineageShape.tables
          .find((table) => table.name === "engine_artifact")!
          .rows.find((row) => row.id === lineage.artifactID)!
        const malformedShapePayload = JSON.parse(String(malformedShapeRow.payload)) as Record<string, unknown>
        malformedShapePayload.alternate_delivery_authority = true
        replaceTransferArtifactPayload(malformedShapeRow, malformedShapePayload)
        expect(() => preflightMysqlTransferSnapshot(malformedLineageShape)).toThrow(
          "engine_artifact: dispatch_lineage requires exact Tool occurrence, workflow lineage, adapter_input and delivery_owner objects",
        )

        const malformedLineageSemantics = structuredClone(transferSnapshot)
        const malformedSemanticsRow = malformedLineageSemantics.tables
          .find((table) => table.name === "engine_artifact")!
          .rows.find((row) => row.id === lineage.artifactID)!
        const malformedSemanticsPayload = JSON.parse(String(malformedSemanticsRow.payload)) as Record<string, any>
        malformedSemanticsPayload.projected_worker_identity.baseRole = "unknown-runtime-template"
        replaceTransferArtifactPayload(malformedSemanticsRow, malformedSemanticsPayload)
        expect(() => preflightMysqlTransferSnapshot(malformedLineageSemantics)).toThrow(
          "engine_artifact: dispatch_lineage requires exact Tool occurrence, workflow lineage, adapter_input and delivery_owner objects",
        )
        expect(() => importMysqlTransferSnapshot(wrongDispatch)).toThrow(
          `worker_turn_descriptor ${descriptor.id} has invalid Task Project or dispatch lineage authority`,
        )
        expect(() => importMysqlTransferSnapshot(malformedLineageSemantics)).toThrow(
          "engine_artifact: dispatch_lineage requires exact Tool occurrence, workflow lineage, adapter_input and delivery_owner objects",
        )
        expect(exportMysqlTransferSnapshot()).toEqual(transferSnapshot)
        expect(importMysqlTransferSnapshot(transferSnapshot)).toMatchObject({ ok: true })
        expect(
          Database.use((db) =>
            db
              .select({ id: WorkerTurnDescriptorTable.id })
              .from(WorkerTurnDescriptorTable)
              .where(eq(WorkerTurnDescriptorTable.id, descriptor.id))
              .get(),
          ),
        ).toEqual({ id: descriptor.id })

        const remoteLease = acquireControlLease({
          target: "runtime_process",
          targetID: remoteOwnerID,
          ownerOccurrenceID: remoteOwnerID,
          now: Date.now(),
          leaseMilliseconds: 5_000,
        })
        if (!remoteLease.acquired) throw new Error("Expected the remote dispatch owner lease")

        expect(findDispatchSettlementByDispatchID({ taskID, dispatchID })).toBeUndefined()

        const activatedIngressSources: string[] = []
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:test-abandoned-dispatch")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ wakeID }) => {
            const ingress = Database.use((db) =>
              db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.id, wakeID!)).get(),
            )
            if (ingress) activatedIngressSources.push(ingress.source)
            // The Orchestrator decision itself is out of scope; this scan only
            // has to prove the abandoned worker produced a real wake.
            return {}
          },
        })
        let settlementDeliveryAttempts = 0
        using _firstDeliveryFailure = TaskControlTestHooks.replaceBeforeDispatchSettlementDelivery((input) => {
          if (input.taskID !== taskID || input.dispatchID !== dispatchID) return
          settlementDeliveryAttempts += 1
          if (settlementDeliveryAttempts === 1) {
            throw new Error("injected post-settlement delivery failure")
          }
        })

        await reconcileTaskControlPlane(taskID)
        expect(findDispatchSettlementByDispatchID({ taskID, dispatchID })).toBeUndefined()
        expect(taskControlDriverSnapshot()).toContainEqual(
          expect.objectContaining({ taskID, wakeAt: remoteLease.lease.expires_at }),
        )
        const recoveryDeadline = Date.now() + 10_000
        while (!findDispatchSettlementByDispatchID({ taskID, dispatchID }) && Date.now() < recoveryDeadline) {
          await Bun.sleep(25)
        }
        while (
          taskControlDriverSnapshot().some((entry) => entry.taskID === taskID && entry.running) &&
          Date.now() < recoveryDeadline
        ) {
          await Bun.sleep(25)
        }
        while (
          Database.use(
            (db) =>
              db
                .select({ id: EngineTaskRootIngressTable.id })
                .from(EngineTaskRootIngressTable)
                .where(
                  and(
                    eq(EngineTaskRootIngressTable.task_id, taskID),
                    eq(EngineTaskRootIngressTable.source, "engine_artifact"),
                  ),
                )
                .get() === undefined,
          ) &&
          Date.now() < recoveryDeadline
        ) {
          await Bun.sleep(25)
        }

        const settlement = findDispatchSettlementByDispatchID({ taskID, dispatchID })
        const ingresses = Database.use((db) =>
          db
            .select()
            .from(EngineTaskRootIngressTable)
            .where(
              and(
                eq(EngineTaskRootIngressTable.task_id, taskID),
                eq(EngineTaskRootIngressTable.source, "engine_artifact"),
              ),
            )
            .all(),
        )
        // The recovery fact enters the epoch FIFO as an ordinary accepted
        // ingress and reaches the production Task runner. The creation
        // ingress was already resolved by the preceding scan, so this exact
        // activation proves the recovered outcome, rather than a generic
        // driver wake, crossed the Task-root boundary.
        expect({
          outcomeKind: settlement?.payload.outcome.kind,
          settledSession: settlement?.payload.session_id,
          settledLineage: settlement?.payload.dispatch_lineage_id,
          recoveryIngresses: ingresses.length,
          settlementCount: Database.use(
            (db) =>
              db
                .select({ payload: EngineArtifactTable.payload })
                .from(EngineArtifactTable)
                .where(
                  and(
                    eq(EngineArtifactTable.task_id, taskID),
                    eq(EngineArtifactTable.kind, "dispatch_settlement"),
                  ),
                )
                .all()
                .filter((row) => (row.payload as { dispatch_id?: string }).dispatch_id === dispatchID).length,
          ),
          scanActivatedHead: activatedIngressSources,
          settlementDeliveryAttempts,
          unresolvedAfterDelivery: Database.use((db) =>
            unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 32 }).lineages.map(
              (row) => row.dispatchID,
            ),
          ),
        }).toMatchObject({
          outcomeKind: "infrastructure_failure",
          settledSession: child.id,
          settledLineage: lineage.artifactID,
          recoveryIngresses: 1,
          settlementCount: 1,
          scanActivatedHead: ["engine_artifact"],
          settlementDeliveryAttempts: 2,
          unresolvedAfterDelivery: [],
        })

        // Recovery is idempotent: a second scan finds the dispatch settled and
        // must not mint a second outcome or a second wake.
        await reconcileTaskControlPlane(taskID)
        const afterReplay = Database.use((db) =>
          db
            .select()
            .from(EngineTaskRootIngressTable)
            .where(
              and(
                eq(EngineTaskRootIngressTable.task_id, taskID),
                eq(EngineTaskRootIngressTable.source, "engine_artifact"),
              ),
            )
            .all(),
        )
        expect(afterReplay.length).toBe(1)

        let lifecycleProbe: { childSessionID: string; dispatchID: string; inputMessageID: string } | undefined
        for (let index = 0; index < 33; index += 1) {
          const frontierChild = await Session.create({
            kind: worker.identity.sessionKind,
            parentID: root.id,
            title: `Frontier worker ${index}`,
          })
          const frontierDispatchID = Identifier.ascending("artifact")
          const frontierLineage = recordTestDispatchLineage({
            origin: createDispatchLineageOrigin({
              dispatchID: frontierDispatchID,
              taskID,
              orchestratorSessionID: task.session_id!,
              orchestratorMessageID: Identifier.ascending("message"),
              toolPartID: Identifier.ascending("part"),
              toolCallID: Identifier.ascending("call"),
              targetAgentID: worker.identity.agentID,
              projectedWorkerIdentity: worker.identity,
              workScope: { kind: "task" },
              workflowBinding: selectedWorkflowBinding({
                projection: {
                  packageRevision: scheduler.packageRevision,
                  virtualWorkflows: scheduler.virtualWorkflows,
                },
                workflowID: null,
              }),
              workflowNodeID: null,
              adapterInput: { frontierIndex: index },
            }),
            childSessionID: frontierChild.id,
          })
          const descriptor = await commitAcceptedDispatchDescriptor({
            taskID,
            childSessionID: frontierChild.id,
            dispatchID: frontierDispatchID,
            worker,
            scheduler,
            workflowBinding: frontierLineage.payload.workflow_binding,
          })
          if (index === 0) {
            lifecycleProbe = {
              childSessionID: frontierChild.id,
              dispatchID: frontierDispatchID,
              inputMessageID: descriptor.payload.messageAuthority.user_message_id,
            }
          }
        }
        const firstPage = Database.use((db) => unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 32 }))
        const secondPage = Database.use((db) =>
          unresolvedDispatchRecoveryPageInTransaction(db, {
            taskID,
            after: firstPage.next!,
            limit: 32,
          }),
        )
        expect({
          scannedPageSizes: [firstPage.scannedCount, secondPage.scannedCount],
          candidatePageSizes: [firstPage.lineages.length, secondPage.lineages.length],
          uniqueDispatches: new Set([...firstPage.lineages, ...secondPage.lineages].map((row) => row.dispatchID)).size,
        }).toEqual({ scannedPageSizes: [32, 2], candidatePageSizes: [31, 2], uniqueDispatches: 33 })
        frontierDispatchIDs = new Set(
          [...firstPage.lineages, ...secondPage.lineages].map((lineage) => lineage.dispatchID),
        )

        const probe = lifecycleProbe!
        const lifecycleEvidence = (id: string, sequence: number, time = 10) => ({
          id,
          kind: "closed" as const,
          epoch: 1,
          sequence,
          time,
        })
        expect(
          TaskControlTestHooks.taskRootLifecycleDispositionEvidence({
            lifecycle: [lifecycleEvidence("pev_a", 1), lifecycleEvidence("pev_B", 1)],
            boundary: "closed",
            executionEpoch: 1,
            timeAccepted: 1,
          })?.id,
        ).toBe("pev_B")
        expect(
          TaskControlTestHooks.taskRootLifecycleDispositionEvidence({
            lifecycle: [lifecycleEvidence("pev_A", 2, 1), lifecycleEvidence("pev_z", 1, 100)],
            boundary: "closed",
            executionEpoch: 1,
            timeAccepted: 1,
          })?.id,
        ).toBe("pev_z")
        const appendLifecycle = async (input: {
          taskID: string
          status:
            | { type: "streaming" }
            | { type: "retry"; attempt: number; message: string; next: number }
            | { type: "terminal"; reason: "completed"; final_message_id?: string }
            | { type: "terminal"; reason: "error"; error: string }
        }) => {
          const event = await ProtocolStore.appendEvent({
            kind: "event",
            type: "agent.execution.lifecycle",
            aggregate: "task",
            aggregate_id: input.taskID,
            task_id: null,
            session_id: probe.childSessionID,
            source: "test.dispatch-frontier-lifecycle",
            order_key: executionLifecycleOrderKey(probe.childSessionID, probe.inputMessageID),
            payload: { inputMessageID: probe.inputMessageID, status: input.status },
          })
          return event
        }
        for (const status of [
          { type: "streaming" as const },
          { type: "retry" as const, attempt: 1, message: "retrying", next: Date.now() + 1_000 },
        ]) {
          const event = await appendLifecycle({ taskID, status })
          Database.immediateTransaction((db) =>
            acceptTaskRootIngressInTransaction(db, {
              taskID,
              executionEpoch: 1,
              source: "protocol_event",
              sourceID: event.id,
              semanticTurnLimit: 2,
              activationLimit: 2,
              now: Date.now(),
            }),
          )
          expect(
            Database.use((db) =>
              unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.some(
                (row) => row.dispatchID === probe.dispatchID,
              ),
            ),
          ).toBe(true)
        }
        const wrongTaskID = Identifier.ascending("task")
        Database.immediateTransaction((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: wrongTaskID,
              project_id: Instance.project.id,
              session_id: task.session_id,
              source: "test",
              product_pillar: "code",
              title: "Other Task",
              request: "Other Task",
              time_created: Date.now(),
            })
            .run(),
        )
        const wrongTaskEvent = await appendLifecycle({
          taskID: wrongTaskID,
          status: { type: "terminal", reason: "completed" },
        })
        expect(() =>
          Database.immediateTransaction((db) =>
            acceptTaskRootIngressInTransaction(db, {
              taskID,
              executionEpoch: 1,
              source: "protocol_event",
              sourceID: wrongTaskEvent.id,
              semanticTurnLimit: 2,
              activationLimit: 2,
              now: Date.now(),
            }),
          ),
        ).toThrow(`belongs to task:${wrongTaskEvent.aggregateID}`)
        expect(
          Database.use((db) =>
            unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.some(
              (row) => row.dispatchID === probe.dispatchID,
            ),
          ),
        ).toBe(true)
        const final = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: probe.childSessionID,
          role: "assistant",
          author: worker.identity.agentID,
          parentID: probe.inputMessageID,
          time: { created: Date.now(), completed: Date.now() + 1 },
          agent: worker.identity.agentID,
          providerID: "test",
          modelID: "test-model",
          path: { cwd: Instance.directory, root: Instance.directory },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const terminal = await appendLifecycle({
          taskID,
          status: { type: "terminal", reason: "completed", final_message_id: final.id },
        })
        let releaseLifecycle!: () => void
        let markLifecycleBlocked!: () => void
        const lifecycleRelease = new Promise<void>((resolve) => (releaseLifecycle = resolve))
        const lifecycleBlocked = new Promise<void>((resolve) => (markLifecycleBlocked = resolve))
        using _blockedLifecycle = TaskControlTestHooks.replaceBeforeTerminalLifecycleDelivery(async (input) => {
          if (input.taskID !== taskID || input.dispatchID !== probe.dispatchID) return
          markLifecycleBlocked()
          await lifecycleRelease
        })
        const lifecycleDelivery = reconcileTerminalAgentLifecycleDelivery({
          taskID,
          sessionID: probe.childSessionID,
          dispatchID: probe.dispatchID,
        })
        await lifecycleBlocked

        let releaseRecovery!: () => void
        let markRecoveryBlocked!: () => void
        const recoveryRelease = new Promise<void>((resolve) => (releaseRecovery = resolve))
        const recoveryBlocked = new Promise<void>((resolve) => (markRecoveryBlocked = resolve))
        using _blockedRecovery = TaskControlTestHooks.replaceBeforeDispatchSettlementDelivery(async (input) => {
          if (input.taskID !== taskID || input.dispatchID !== probe.dispatchID) return
          markRecoveryBlocked()
          await recoveryRelease
        })
        const concurrentRecovery = reconcileTaskControlPlane(taskID)
        await recoveryBlocked
        releaseLifecycle()
        expect(await lifecycleDelivery).toBe("delivered")
        releaseRecovery()
        await concurrentRecovery

        const probeSettlement = findDispatchSettlementByDispatchID({ taskID, dispatchID: probe.dispatchID })
        if (!probeSettlement) throw new Error("Expected the terminal lifecycle settlement")
        const probeDeliverySourceIDs = new Set([
          terminal.id,
          probeSettlement.artifactID,
          ...(probeSettlement.payload.outcome.kind === "infrastructure_failure" &&
          probeSettlement.payload.outcome.infrastructure_error
            ? [probeSettlement.payload.outcome.infrastructure_error.artifact_id]
            : []),
        ])
        const terminalDeliverySources = Database.use((db) =>
          db
            .select({ source: EngineTaskRootIngressTable.source, sourceID: EngineTaskRootIngressTable.source_id })
            .from(EngineTaskRootIngressTable)
            .where(eq(EngineTaskRootIngressTable.task_id, taskID))
            .all()
            .filter((ingress) => probeDeliverySourceIDs.has(ingress.sourceID)),
        )
        expect(terminalDeliverySources).toEqual([{ source: "protocol_event", sourceID: terminal.id }])
        expect(
          Database.use((db) =>
            unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.some(
              (row) => row.dispatchID === probe.dispatchID,
            ),
          ),
        ).toBe(false)

        // Every driver revision owns one fixed descriptor page. Effects from
        // the first page coalesce a fresh revision, so this request may finish
        // the second page without waiting for the periodic heartbeat.
        await reconcileTaskControlPlane(taskID)
        const frontierRecoveryDeadline = Date.now() + 10_000
        while (
          Database.use((db) =>
            unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.length,
          ) > 0 &&
          Date.now() < frontierRecoveryDeadline
        ) {
          await Bun.sleep(25)
        }
        const firstProcessCheckpoint = Database.use((db) => ({
          unresolved: unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.length,
          frontierSettlements: db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "dispatch_settlement")))
            .all()
            .filter((artifact) => {
              const dispatch = (artifact.payload as { dispatch_id?: string }).dispatch_id
              return typeof dispatch === "string" && frontierDispatchIDs.has(dispatch)
            }).length,
          budgetDispositions: db
            .select({ id: EngineArtifactTable.id })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, taskID),
                eq(EngineArtifactTable.kind, "dispatch_delivery_disposition"),
              ),
            )
            .all().length,
        }))
        expect({
          ...firstProcessCheckpoint,
          wakeArmed: taskControlDriverSnapshot().some((entry) => entry.taskID === taskID && entry.wakeAt !== undefined),
        }).toEqual({ unresolved: 0, frontierSettlements: 33, budgetDispositions: 28, wakeArmed: true })
      },
    })
    await Instance.disposeAll()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime(
          "runtime:test-abandoned-dispatch-restart",
        )
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        expect(
          Database.use(
            (db) =>
              unresolvedDispatchRecoveryPageInTransaction(db, { taskID: restartTaskID, limit: 64 }).lineages.length,
          ),
        ).toBe(0)
        await reconcileTaskControlPlane(restartTaskID)
        const deadline = Date.now() + 5_000
        let unresolved = 0
        while (unresolved > 0 && Date.now() < deadline) {
          await Bun.sleep(25)
          unresolved = Database.use(
            (db) =>
              unresolvedDispatchRecoveryPageInTransaction(db, { taskID: restartTaskID, limit: 64 }).lineages.length,
          )
        }
        const productionSweep = Database.use((db) => ({
          unresolved,
          frontierSettlements: db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(
              and(eq(EngineArtifactTable.task_id, restartTaskID), eq(EngineArtifactTable.kind, "dispatch_settlement")),
            )
            .all()
            .filter((artifact) => {
              const dispatch = (artifact.payload as { dispatch_id?: string }).dispatch_id
              return typeof dispatch === "string" && frontierDispatchIDs.has(dispatch)
            }).length,
          budgetDispositions: db
            .select({ id: EngineArtifactTable.id })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, restartTaskID),
                eq(EngineArtifactTable.kind, "dispatch_delivery_disposition"),
              ),
            )
            .all().length,
        }))
        expect(productionSweep).toEqual({ unresolved: 0, frontierSettlements: 33, budgetDispositions: 28 })
        const retainedDescriptor = Database.use((db) =>
          db
            .select({ id: WorkerTurnDescriptorTable.id, sessionID: WorkerTurnDescriptorTable.session_id })
            .from(WorkerTurnDescriptorTable)
            .where(eq(WorkerTurnDescriptorTable.task_id, restartTaskID))
            .get(),
        )!
        Database.immediateTransaction((db) => {
          db.delete(SessionTable).where(eq(SessionTable.id, retainedDescriptor.sessionID)).run()
        })
        expect(
          Database.use((db) =>
            db.select({ id: WorkerTurnDescriptorTable.id }).from(WorkerTurnDescriptorTable)
              .where(eq(WorkerTurnDescriptorTable.id, retainedDescriptor.id)).get(),
          ),
        ).toBeUndefined()
      },
    })
  }, 60_000)

  test("keeps an epoch-one settlement out after terminalization and reopen", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          prompt_profile: { active: "base" },
          mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
        })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const worker = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: scheduler.packageRevision,
          agentID: "base-developer",
        })
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Dispatch epoch recovery boundary",
          metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
        })
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: root,
          now,
          title: "Dispatch epoch recovery boundary",
          request: "Do not deliver an old dispatch after this Task occurrence closes",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
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
        const child = await Session.create({
          kind: "delegated-worker",
          parentID: root.id,
          title: "Old-epoch worker",
        })
        const dispatchID = Identifier.ascending("artifact")
        const remoteOwnerID = `runtime:test-old-epoch:${Identifier.ascending("call")}`
        const lineage = (() => {
          using _remoteOwner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime(remoteOwnerID)
          return recordTestDispatchLineage({
            origin: createDispatchLineageOrigin({
              dispatchID,
              taskID,
              orchestratorSessionID: root.id,
              orchestratorMessageID: Identifier.ascending("message"),
              toolPartID: Identifier.ascending("part"),
              toolCallID: Identifier.ascending("call"),
              targetAgentID: worker.identity.agentID,
              projectedWorkerIdentity: worker.identity,
              workScope: { kind: "task" },
              workflowBinding: selectedWorkflowBinding({
                projection: {
                  packageRevision: scheduler.packageRevision,
                  virtualWorkflows: scheduler.virtualWorkflows,
                },
                workflowID: null,
              }),
              workflowNodeID: null,
              adapterInput: { crashCut: "settlement-before-delivery" },
            }),
            childSessionID: child.id,
          })
        })()
        expect(lineage.payload.execution_epoch).toBe(1)
        const creatorActivationID = Database.use((db) => {
          const message = db
            .select({ data: MessageTable.data })
            .from(MessageTable)
            .where(eq(MessageTable.id, lineage.payload.orchestrator_message_id))
            .get()
          const activationID = message?.data.activationID
          if (typeof activationID !== "string") throw new Error("Expected the exact lineage creator activation")
          return activationID
        })
        const expectInvalidCreatorOccurrence = (
          mutate: (payload: typeof lineage.payload) => typeof lineage.payload,
        ) => {
          const invalidDispatchID = Identifier.ascending("artifact")
          expect(() =>
            Database.immediateTransaction((db) =>
              insertEngineArtifact(db, {
                id: Identifier.ascending("artifact"),
                taskID,
                kind: "dispatch_lineage",
                label: "invalid-dispatch-lineage",
                payload: mutate({
                  ...lineage.payload,
                  dispatch_id: invalidDispatchID,
                  workflow_occurrence_id: invalidDispatchID,
                }),
                timeCreated: Date.now(),
              }),
            ),
          ).toThrow("engine_artifact: dispatch_lineage requires exact Task-root Tool creator occurrence")
        }
        expectInvalidCreatorOccurrence((payload) => ({ ...payload, execution_epoch: 2 }))
        expectInvalidCreatorOccurrence((payload) => ({ ...payload, tool_part_id: Identifier.ascending("part") }))
        expect(() =>
          Database.immediateTransaction((db) =>
            db.delete(EngineArtifactTable).where(eq(EngineArtifactTable.id, lineage.artifactID)).run(),
          ),
        ).toThrow("engine_artifact: dispatch lineage is immutable until Task retention")
        expect(() =>
          Database.immediateTransaction((db) =>
            db
              .update(EngineControlActivationLeaseTable)
              .set({ target_id: Identifier.ascending("artifact") })
              .where(eq(EngineControlActivationLeaseTable.id, creatorActivationID))
              .run(),
          ),
        ).toThrow("engine_control_activation_lease: dispatch lineage causal identity is immutable")
        expect(() =>
          Database.immediateTransaction((db) =>
            db
              .delete(EngineControlActivationLeaseTable)
              .where(eq(EngineControlActivationLeaseTable.id, creatorActivationID))
              .run(),
          ),
        ).toThrow("engine_control_activation_lease: dispatch lineage causal identity is immutable until Task retention")
        const renewedExpiry = Date.now() + 120_000
        expect(
          Database.immediateTransaction((db) =>
            db
              .update(EngineControlActivationLeaseTable)
              .set({ expires_at: renewedExpiry })
              .where(eq(EngineControlActivationLeaseTable.id, creatorActivationID))
              .returning({ expiresAt: EngineControlActivationLeaseTable.expires_at })
              .get(),
          ),
        ).toEqual({ expiresAt: renewedExpiry })
        await commitAcceptedDispatchDescriptor({
          taskID,
          childSessionID: child.id,
          dispatchID,
          worker,
          scheduler,
          workflowBinding: lineage.payload.workflow_binding,
        })

        let releaseDelivery!: () => void
        let markDeliveryBlocked!: () => void
        const deliveryRelease = new Promise<void>((resolve) => (releaseDelivery = resolve))
        const deliveryBlocked = new Promise<void>((resolve) => (markDeliveryBlocked = resolve))
        let deliveryAttempts = 0
        using _blockedDelivery = TaskControlTestHooks.replaceBeforeDispatchSettlementDelivery(async (input) => {
          if (input.taskID !== taskID || input.dispatchID !== dispatchID) return
          deliveryAttempts += 1
          markDeliveryBlocked()
          await deliveryRelease
        })
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime(
          "runtime:test-old-epoch-recovery",
        )
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const recovery = reconcileTaskControlPlane(taskID)
        await deliveryBlocked
        const settlement = findDispatchSettlementByDispatchID({ taskID, dispatchID })
        if (!settlement) throw new Error("Expected settlement before the delivery barrier")
        await ProtocolStore.appendEvent({
          kind: "event",
          type: "task.completed",
          aggregate: "task",
          aggregate_id: taskID,
          task_id: null,
          session_id: root.id,
          source: "test.dispatch-epoch-boundary",
          emitted_at: Date.now(),
          payload: { execution_epoch: 1 },
        })
        releaseDelivery()
        await recovery

        const settlementSourceIDs = new Set([
          settlement.artifactID,
          ...(settlement.payload.outcome.kind === "infrastructure_failure" &&
          settlement.payload.outcome.infrastructure_error
            ? [settlement.payload.outcome.infrastructure_error.artifact_id]
            : []),
        ])
        const acceptedSettlementSources = () =>
          Database.use((db) =>
            db
              .select({ sourceID: EngineTaskRootIngressTable.source_id })
              .from(EngineTaskRootIngressTable)
              .where(eq(EngineTaskRootIngressTable.task_id, taskID))
              .all()
              .filter((row) => settlementSourceIDs.has(row.sourceID)),
          )
        expect({
          deliveryAttempts,
          acceptedSettlementSources: acceptedSettlementSources(),
          unresolved: Database.use(
            (db) => unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.length,
          ),
          hasCursor: TaskControlTestHooks.hasDispatchRecoveryCursor(taskID),
        }).toEqual({
          deliveryAttempts: 1,
          acceptedSettlementSources: [],
          unresolved: 0,
          hasCursor: false,
        })

        const reopened = Database.immediateTransaction((db) =>
          appendTaskReopenedInTransaction({
            db,
            taskID,
            sessionID: root.id,
            now: Date.now(),
            source: "test.dispatch-epoch-boundary",
          }),
        )
        expect(reopened).toMatchObject({ epoch: 2, status: "active" })
        await reconcileTaskControlPlane(taskID)
        expect({
          deliveryAttempts,
          acceptedSettlementSources: acceptedSettlementSources(),
          unresolved: Database.use(
            (db) => unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.length,
          ),
          hasCursor: TaskControlTestHooks.hasDispatchRecoveryCursor(taskID),
        }).toEqual({
          deliveryAttempts: 1,
          acceptedSettlementSources: [],
          unresolved: 0,
          hasCursor: false,
        })

        Database.immediateTransaction((db) => {
          for (let epoch = 2; epoch <= 257; epoch += 1) {
            ProtocolStore.appendEventInTransaction({
              kind: "event",
              type: "task.completed",
              aggregate: "task",
              aggregate_id: taskID,
              task_id: null,
              session_id: root.id,
              source: "test.dispatch-epoch-history",
              emitted_at: Date.now() + epoch * 2,
              payload: { execution_epoch: epoch },
            })
            appendTaskReopenedInTransaction({
              db,
              taskID,
              sessionID: root.id,
              now: Date.now() + epoch * 2 + 1,
              source: "test.dispatch-epoch-history",
            })
          }
        })
        const queryStages: Array<{ stage: string; rowCount: number }> = []
        const boundedCandidates = Database.use((db) =>
          dispatchRecoveryCandidatesInTransaction(db, {
            descriptors: [{ taskID, sessionID: child.id, dispatchID }],
            observe: (stage, rowCount) => queryStages.push({ stage, rowCount }),
          }),
        )
        expect(() =>
          Database.use((db) =>
            dispatchRecoveryCandidatesInTransaction(db, {
              descriptors: Array.from({ length: 65 }, (_, index) => ({
                taskID,
                sessionID: child.id,
                dispatchID: `dispatch_overflow_${index}`,
              })),
            }),
          ),
        ).toThrow("Dispatch recovery classifier accepts at most 64 descriptors")
        const occurrenceFacts = Database.use((db) =>
          DispatchDeliveryDispositionTestHooks.executionOccurrencesInTransaction(db, [lineage]),
        )
        const occurrencePlan = Database.use((db) =>
          DispatchDeliveryDispositionTestHooks.executionOccurrenceQueryPlan(db, [lineage]),
        ).join("\n")
        const deliveryPlans = Database.use((db) =>
          DispatchDeliveryDispositionTestHooks.deliveryQueryPlans(
            db,
            Array.from({ length: 64 }, (_, index) => ({
              taskID: `tsk_recovery_plan_${index}`,
              sessionID: `ses_recovery_plan_${index}`,
              dispatchID: `dispatch_recovery_plan_${index}`,
            })),
          ),
        )
        const deliveryPlanText = Object.fromEntries(
          Object.entries(deliveryPlans).map(([stage, details]) => [stage, details.join("\n")]),
        ) as Record<keyof typeof deliveryPlans, string>
        const projectDispatchFrontier = TaskControlTestHooks.currentProjectFrontierSlice({
          connectionEpoch: Database.physicalConnectionEpoch(),
          ingress: { state: "exhausted" },
          wait: { state: "exhausted" },
          cancellation: { state: "exhausted" },
        })
        expect({
          boundedCandidates: boundedCandidates.length,
          queryStages,
          occurrenceFacts,
          taskLocalDue: Database.use(
            (db) => unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.length,
          ),
          projectDue: projectDispatchFrontier.taskIDs.includes(taskID),
          indexed: [
            occurrencePlan.includes("protocol_event_task_epoch_open_idx"),
            occurrencePlan.includes("protocol_event_task_epoch_terminal_idx"),
            occurrencePlan.includes("protocol_event_task_deleted_idx"),
            deliveryPlanText.dispositions.includes("engine_dispatch_delivery_disposition_dispatch_id_idx"),
            deliveryPlanText.settlementDeliveries.includes("engine_dispatch_settlement_dispatch_id_idx"),
            deliveryPlanText.settlementDeliveries.includes("engine_task_root_ingress_source_idx"),
            deliveryPlanText.lifecycleDeliveries.includes("worker_turn_descriptor_dispatch_idx"),
          ],
        }).toEqual({
          boundedCandidates: 0,
          queryStages: [
            { stage: "lineages", rowCount: 1 },
            { stage: "dispositions", rowCount: 0 },
            { stage: "settlement-deliveries", rowCount: 0 },
            { stage: "lifecycle-deliveries", rowCount: 0 },
            { stage: "execution-occurrences", rowCount: 1 },
          ],
          occurrenceFacts: [
            { taskID, executionEpoch: 1, currentEpoch: 258, terminal: 1, deleted: 0 },
          ],
          taskLocalDue: 0,
          projectDue: false,
          indexed: [true, true, true, true, true, true, true],
        })
        Database.immediateTransaction((db) =>
          db.delete(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).run(),
        )
        expect(
          Database.use((db) =>
            db.select({ id: EngineArtifactTable.id }).from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, lineage.artifactID)).get(),
          ),
        ).toBeUndefined()
        expect(
          Database.immediateTransaction((db) =>
            db.delete(EngineControlActivationLeaseTable)
              .where(eq(EngineControlActivationLeaseTable.id, creatorActivationID)).run().changes,
          ),
        ).toBe(1)
      },
    })
  }, 30_000)

  test("preserves a first-page live-owner expiry across later descriptor pages", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          prompt_profile: { active: "base" },
          mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
        })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const worker = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: scheduler.packageRevision,
          agentID: "base-developer",
        })
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Paged live-owner recovery",
          metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
        })
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: root,
          now,
          title: "Paged live-owner recovery",
          request: "Keep the earliest live-owner expiry through the complete descriptor traversal",
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
        const liveOwnerID = `runtime:test-paged-live-owner:${Identifier.ascending("call")}`
        const lateDescriptorChild = await Session.create({
          kind: worker.identity.sessionKind,
          parentID: root.id,
          title: "Descriptor committed after the first recovery page",
        })
        const lateDescriptorDispatchID = Identifier.ascending("artifact")
        const lateDescriptorLineage = (() => {
          using _lineageOwner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime(
            "runtime:test-late-descriptor-owner",
          )
          return recordTestDispatchLineage({
            origin: createDispatchLineageOrigin({
              dispatchID: lateDescriptorDispatchID,
              taskID,
              orchestratorSessionID: task.session_id!,
              orchestratorMessageID: Identifier.ascending("message"),
              toolPartID: Identifier.ascending("part"),
              toolCallID: Identifier.ascending("call"),
              targetAgentID: worker.identity.agentID,
              projectedWorkerIdentity: worker.identity,
              workScope: { kind: "task" },
              workflowBinding: selectedWorkflowBinding({
                projection: {
                  packageRevision: scheduler.packageRevision,
                  virtualWorkflows: scheduler.virtualWorkflows,
                },
                workflowID: null,
              }),
              workflowNodeID: null,
              adapterInput: { committedAfterDescriptorCursor: true },
            }),
            childSessionID: lateDescriptorChild.id,
            // Older caller time must not place this accepted occurrence behind
            // the descriptor append cursor committed later below.
            now: 1,
          })
        })()
        let failedFirstPageDispatchID = ""
        for (let index = 0; index < 33; index += 1) {
          const child = await Session.create({
            kind: worker.identity.sessionKind,
            parentID: root.id,
            title: `Paged owner worker ${index}`,
          })
          const dispatchID = Identifier.ascending("artifact")
          const ownerID =
            index === 0
              ? "runtime:test-paged-delivery-failure"
              : index < 32
                ? liveOwnerID
                : `runtime:test-paged-dead-owner:${index}`
          if (index === 0) failedFirstPageDispatchID = dispatchID
          const lineage = (() => {
            using _lineageOwner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime(ownerID)
            return recordTestDispatchLineage({
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
                  projection: {
                    packageRevision: scheduler.packageRevision,
                    virtualWorkflows: scheduler.virtualWorkflows,
                  },
                  workflowID: null,
                }),
                workflowNodeID: null,
                adapterInput: { pagedOwnerIndex: index },
              }),
              childSessionID: child.id,
            })
          })()
          await commitAcceptedDispatchDescriptor({
            taskID,
            childSessionID: child.id,
            dispatchID,
            worker,
            scheduler,
            workflowBinding: lineage.payload.workflow_binding,
          })
        }
        const firstPage = Database.use((db) =>
          unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 32 }),
        )
        let projectFrontier = TaskControlTestHooks.currentProjectFrontierSlice()
        while (projectFrontier.next) {
          projectFrontier = TaskControlTestHooks.currentProjectFrontierSlice(projectFrontier.next)
        }
        const projectCheckpoint = restartTaskControlProjectFrontier(projectFrontier.checkpoint)
        let coalescedRequests: number[] = []
        const sourcePasses: number[] = []
        let lateDescriptorProjectDiscovery = false
        let lateDescriptorPageEvidence:
          | { scannedPageSizes: number[]; lateDescriptorRecovered: boolean }
          | undefined
        const lease = acquireControlLease({
          target: "runtime_process",
          targetID: liveOwnerID,
          ownerOccurrenceID: liveOwnerID,
          now: Date.now(),
          leaseMilliseconds: 5_000,
        })
        if (!lease.acquired) throw new Error("Expected the paged live-owner lease")
        const productionDriver = new TaskControlDriver({
          scan: (requestedTaskID, context) =>
            TaskControlTestHooks.scanTaskControlPlane(requestedTaskID, context),
          initialBackoffMilliseconds: 10_000,
        })
        const productionLiveness = joinProcessLivenessLease(currentRuntimeOccurrenceID())
        using _productionResources = {
          [Symbol.dispose]() {
            productionDriver.dispose()
            productionLiveness.release()
          },
        }
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        let failedDeliveryAttempts = 0
        using _firstPageDeliveryFailure = TaskControlTestHooks.replaceBeforeDispatchSettlementDelivery((input) => {
          if (input.taskID !== taskID || input.dispatchID !== failedFirstPageDispatchID) return
          failedDeliveryAttempts += 1
          if (failedDeliveryAttempts === 1) throw new Error("injected first-page settlement delivery failure")
        })
        using _sourceInterleaving = TaskControlTestHooks.replaceAfterSourceReconciliation(
          async ({ taskID: scannedTaskID, pass }) => {
            if (scannedTaskID === taskID) sourcePasses.push(pass)
            if (scannedTaskID === taskID && pass === 0) {
              await commitAcceptedDispatchDescriptor({
                taskID,
                childSessionID: lateDescriptorChild.id,
                dispatchID: lateDescriptorDispatchID,
                worker,
                scheduler,
                workflowBinding: lateDescriptorLineage.payload.workflow_binding,
                timeCreated: 1,
              })
              const secondPage = Database.use((db) =>
                unresolvedDispatchRecoveryPageInTransaction(db, {
                  taskID,
                  after: firstPage.next!,
                  limit: 32,
                }),
              )
              lateDescriptorPageEvidence = {
                scannedPageSizes: [firstPage.scannedCount, secondPage.scannedCount],
                lateDescriptorRecovered: secondPage.lineages.some(
                  (lineage) => lineage.dispatchID === lateDescriptorDispatchID,
                ),
              }
              lateDescriptorProjectDiscovery = TaskControlTestHooks.currentProjectFrontierSlice(
                projectCheckpoint,
              ).taskIDs.includes(taskID)
              coalescedRequests.push(await productionDriver.request(taskID))
            }
          },
        )

        await productionDriver.request(taskID, { propagateFailure: true })
        expect({
          coalescedRequests,
          lateDescriptorProjectDiscovery,
          lateDescriptorPageEvidence,
          lateDescriptorSettlement: findDispatchSettlementByDispatchID({
            taskID,
            dispatchID: lateDescriptorDispatchID,
          })?.payload.dispatch_id,
        }).toEqual({
          coalescedRequests: [0],
          lateDescriptorProjectDiscovery: true,
          lateDescriptorPageEvidence: { scannedPageSizes: [32, 2], lateDescriptorRecovered: true },
          lateDescriptorSettlement: lateDescriptorDispatchID,
        })
        expect(sourcePasses).toContain(1)
        const continuationDeadline = Date.now() + 2_000
        while (
          Database.use((db) =>
            unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.length,
          ) !== 32 &&
          Date.now() < continuationDeadline
        ) {
          await Bun.sleep(25)
        }
        expect(
          Database.use((db) =>
            unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.length,
          ),
        ).toBe(32)
        const armedWake = productionDriver.snapshot().find((entry) => entry.taskID === taskID)?.wakeAt
        expect(armedWake).toBeDefined()
        expect(armedWake!).toBeLessThanOrEqual(lease.lease.expires_at)

        const recoveryDeadline = lease.lease.expires_at + 5_000
        let unresolved = 32
        while (unresolved > 0 && Date.now() < recoveryDeadline) {
          await Bun.sleep(25)
          unresolved = Database.use((db) =>
            unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 64 }).lineages.length,
          )
        }
        expect(unresolved).toBe(0)
        const failedSettlement = findDispatchSettlementByDispatchID({
          taskID,
          dispatchID: failedFirstPageDispatchID,
        })
        const failedRecoverySourceIDs = [
          failedSettlement?.artifactID,
          failedSettlement?.payload.outcome.kind === "infrastructure_failure"
            ? failedSettlement.payload.outcome.infrastructure_error?.artifact_id
            : undefined,
        ].filter((id): id is string => typeof id === "string")
        expect({
          failedDeliveryAttempts,
          failedSettlementCount: Database.use(
            (db) =>
              db
                .select({ payload: EngineArtifactTable.payload })
                .from(EngineArtifactTable)
                .where(
                  and(
                    eq(EngineArtifactTable.task_id, taskID),
                    eq(EngineArtifactTable.kind, "dispatch_settlement"),
                  ),
                )
                .all()
                .filter(
                  (row) =>
                    (row.payload as { dispatch_id?: string }).dispatch_id === failedFirstPageDispatchID,
                ).length,
          ),
          failedRecoveryIngressCount: Database.use(
            (db) =>
              db
                .select({ id: EngineTaskRootIngressTable.id })
                .from(EngineTaskRootIngressTable)
                .where(
                  and(
                    eq(EngineTaskRootIngressTable.task_id, taskID),
                    eq(EngineTaskRootIngressTable.source, "engine_artifact"),
                    inArray(EngineTaskRootIngressTable.source_id, failedRecoverySourceIDs),
                  ),
                )
                .all().length,
          ),
        }).toEqual({ failedDeliveryAttempts: 2, failedSettlementCount: 1, failedRecoveryIngressCount: 1 })

        const deletedTaskID = Identifier.ascending("task")
        const deletedRoot = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Deleted paged-recovery Task",
          metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
        })
        persistTask({
          taskID: deletedTaskID,
          rootSession: deletedRoot,
          now: Date.now(),
          title: "Deleted paged-recovery Task",
          request: "Release process-local recovery state at the Task deletion boundary",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision: scheduler.packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID: deletedTaskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: scheduler.packageRevision.packageDigest,
            timeCreated: Date.now(),
          }),
        })
        const deletedTask = requireTask(deletedTaskID)
        const deletedOwnerID = `runtime:test-delete-paged-cursor:${Identifier.ascending("call")}`
        const deletedOwnerLease = acquireControlLease({
          target: "runtime_process",
          targetID: deletedOwnerID,
          ownerOccurrenceID: deletedOwnerID,
          now: Date.now(),
          leaseMilliseconds: 60_000,
        })
        if (!deletedOwnerLease.acquired) throw new Error("Expected the deleted-Task fixture owner lease")
        for (let index = 0; index < 33; index += 1) {
          const child = await Session.create({
            kind: worker.identity.sessionKind,
            parentID: deletedRoot.id,
            title: `Deleted Task worker ${index}`,
          })
          const dispatchID = Identifier.ascending("artifact")
          const lineage = recordTestDispatchLineage({
            origin: createDispatchLineageOrigin({
                dispatchID,
                taskID: deletedTaskID,
                orchestratorSessionID: deletedTask.session_id!,
                orchestratorMessageID: Identifier.ascending("message"),
                toolPartID: Identifier.ascending("part"),
                toolCallID: Identifier.ascending("call"),
                targetAgentID: worker.identity.agentID,
                projectedWorkerIdentity: worker.identity,
                workScope: { kind: "task" },
                workflowBinding: selectedWorkflowBinding({
                  projection: {
                    packageRevision: scheduler.packageRevision,
                    virtualWorkflows: scheduler.virtualWorkflows,
                  },
                  workflowID: null,
                }),
                workflowNodeID: null,
                adapterInput: { deletedTaskIndex: index },
            }),
            childSessionID: child.id,
            ownerProcessOccurrenceID: deletedOwnerID,
          })
          await commitAcceptedDispatchDescriptor({
            taskID: deletedTaskID,
            childSessionID: child.id,
            dispatchID,
            worker,
            scheduler,
            workflowBinding: lineage.payload.workflow_binding,
          })
        }
        const deletionDriver = new TaskControlDriver({
          scan: (requestedTaskID, context) =>
            TaskControlTestHooks.scanTaskControlPlane(requestedTaskID, context),
          retireSettledEntries: true,
        })
        using _deletionDriver = { [Symbol.dispose]: () => deletionDriver.dispose() }
        let cursorObservedBeforeDeletion = false
        let deletionCommitted = false
        using _deleteBetweenPages = TaskControlTestHooks.replaceAfterSourceReconciliation(
          ({ taskID: scannedTaskID, pass }) => {
            if (scannedTaskID !== deletedTaskID || pass !== 0 || deletionCommitted) return
            cursorObservedBeforeDeletion = TaskControlTestHooks.hasDispatchRecoveryCursor(deletedTaskID)
            Database.transaction(() => {
              ProtocolStore.appendEventInTransaction({
                kind: "event",
                type: "task.deleted",
                aggregate: "task",
                aggregate_id: deletedTaskID,
                task_id: null,
                session_id: deletedRoot.id,
                source: "test.paged-recovery-delete",
                emitted_at: Date.now(),
                payload: { execution_epoch: 1 },
              })
            })
            deletionCommitted = true
          },
        )
        await deletionDriver.request(deletedTaskID)
        const deletionDeadline = Date.now() + 2_000
        while (
          (TaskControlTestHooks.hasDispatchRecoveryCursor(deletedTaskID) ||
            deletionDriver.snapshot().some((entry) => entry.taskID === deletedTaskID)) &&
          Date.now() < deletionDeadline
        ) {
          await Bun.sleep(25)
        }
        expect({
          cursorObservedBeforeDeletion,
          cursorRetained: TaskControlTestHooks.hasDispatchRecoveryCursor(deletedTaskID),
          driverEntryRetained: deletionDriver.snapshot().some((entry) => entry.taskID === deletedTaskID),
        }).toEqual({ cursorObservedBeforeDeletion: true, cursorRetained: false, driverEntryRetained: false })
      },
    })
  }, 45_000)

  test("a spent infrastructure budget silences the recovery sweep too", async () => {
    await using project = await memoryProject()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          prompt_profile: { active: "base" },
          mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
        })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const worker = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: scheduler.packageRevision,
          agentID: "base-developer",
        })
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Budget-silenced recovery",
          metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
        })
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: root,
          now,
          title: "Budget-silenced recovery",
          request: "Prove the settled-undelivered sweep honours the epoch infrastructure budget",
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
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })

        // Spend the whole epoch budget on unrelated failures.
        for (let attempt = 0; attempt < TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET; attempt += 1) {
          const filler = await Session.create({
            kind: "delegated-worker",
            parentID: root.id,
            title: `Filler ${attempt}`,
          })
          const artifactID = recordTaskInfrastructureError({
            taskID,
            component: "dispatch-agent",
            operation: "recover-abandoned-dispatch",
            reason: `Filler worker ${attempt} failed`,
            errorName: "AbandonedDispatchError",
            sessionID: filler.id,
            context: { target: "base-developer", dispatchID: `filler-${attempt}` },
            now: Date.now(),
          })
          await dispatchTaskLoop({
            taskID,
            event: {
              note: `Filler worker ${attempt} failed`,
              dispatchInfrastructureFailure: {
                infrastructureFactID: artifactID,
                outcome: DispatchOutcome.infrastructureFailure({
                  operation: "recover-abandoned-dispatch",
                  message: `Filler worker ${attempt} failed`,
                  errorName: "AbandonedDispatchError",
                  sessionID: filler.id,
                  recoveryAuthority: resolveDispatchOccurrenceAuthority({ taskID, dispatchID: `filler-${attempt}` }),
                  infrastructureError: exactEngineArtifactLocator({ taskID, artifactID }),
                }),
              },
            },
          })
        }

        // An abandoned dispatch settles after the budget is spent: its own
        // wake is suppressed, and the settled-undelivered recovery sweep must
        // not smuggle a replacement wake past the gate as `processRecovery`.
        const task = requireTask(taskID)
        const child = await Session.create({ kind: "delegated-worker", parentID: root.id, title: "Silenced worker" })
        const dispatchID = Identifier.ascending("artifact")
        const lineage = recordTestDispatchLineage({
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
              projection: {
                packageRevision: scheduler.packageRevision,
                virtualWorkflows: scheduler.virtualWorkflows,
              },
              workflowID: null,
            }),
            workflowNodeID: null,
            adapterInput: {},
          }),
          childSessionID: child.id,
          ownerProcessOccurrenceID: "runtime:vanished-owner",
        })
        await commitAcceptedDispatchDescriptor({
          taskID,
          childSessionID: child.id,
          dispatchID,
          worker,
          scheduler,
          workflowBinding: lineage.payload.workflow_binding,
        })

        const ingressCount = () =>
          Database.use(
            (db) =>
              db
                .select({ id: EngineTaskRootIngressTable.id })
                .from(EngineTaskRootIngressTable)
                .where(eq(EngineTaskRootIngressTable.task_id, taskID))
                .all().length,
          )

        await reconcileTaskControlPlane(taskID)
        const afterSettlement = {
          settled: findDispatchSettlementByDispatchID({ taskID, dispatchID })?.payload.outcome.kind,
          ingresses: ingressCount(),
          dispositions: Database.use((db) =>
            db
              .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(
                and(
                  eq(EngineArtifactTable.task_id, taskID),
                  eq(EngineArtifactTable.kind, "dispatch_delivery_disposition"),
                ),
              )
              .all(),
          ),
          unresolved: Database.use((db) =>
            unresolvedDispatchRecoveryPageInTransaction(db, { taskID, limit: 32 }).lineages.map(
              (row) => row.dispatchID,
            ),
          ),
        }
        const disposition = afterSettlement.dispositions[0]!
        expect(() =>
          Database.immediateTransaction((db) =>
            insertEngineArtifact(db, {
              id: Identifier.ascending("artifact"),
              taskID,
              kind: "dispatch_delivery_disposition",
              label: "fractional-dispatch-disposition",
              payload: { ...(disposition.payload as Record<string, unknown>), time_created: 1.5 },
              timeCreated: Date.now(),
            }),
          ),
        ).toThrow(
          "engine_artifact: dispatch delivery disposition requires exact lineage, settlement, source, epoch, and budget authority",
        )
        for (const unsafePayload of [
          { ...(disposition.payload as Record<string, unknown>), time_created: Number.MAX_SAFE_INTEGER + 1 },
          { ...(disposition.payload as Record<string, unknown>), execution_epoch: Number.MAX_SAFE_INTEGER + 1 },
        ]) {
          expect(() =>
            Database.immediateTransaction((db) =>
              insertEngineArtifact(db, {
                id: Identifier.ascending("artifact"),
                taskID,
                kind: "dispatch_delivery_disposition",
                label: "unsafe-integer-dispatch-disposition",
                payload: unsafePayload,
                timeCreated: Date.now(),
              }),
            ),
          ).toThrow(
            "engine_artifact: dispatch delivery disposition requires exact lineage, settlement, source, epoch, and budget authority",
          )
        }
        expect(() =>
          Database.immediateTransaction((db) =>
            insertEngineArtifact(db, {
              id: Identifier.ascending("artifact"),
              taskID,
              kind: "dispatch_delivery_disposition",
              label: "maximum-safe-dispatch-disposition",
              payload: {
                ...(disposition.payload as Record<string, unknown>),
                time_created: Number.MAX_SAFE_INTEGER,
              },
              timeCreated: Date.now(),
            }),
          ),
        ).toThrow("UNIQUE constraint failed")
        const dispositionPayload = disposition.payload as {
          infrastructure_source_artifact_id: string
          budget_artifact_id: string
        }
        const settlementArtifact = Database.use((db) =>
          db
            .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "dispatch_settlement")))
            .get(),
        )!
        const insertSettlement = (payload: Record<string, unknown>) =>
          Database.immediateTransaction((db) =>
            insertEngineArtifact(db, {
              id: Identifier.ascending("artifact"),
              taskID,
              kind: "dispatch_settlement",
              label: "invalid-dispatch-settlement",
              payload,
              timeCreated: Date.now(),
            }),
          )
        const settlementPayload = settlementArtifact.payload as Record<string, unknown> & {
          outcome: Record<string, unknown> & {
            recovery_authority: Record<string, unknown>
            infrastructure_error: Record<string, unknown>
          }
        }
        const invalidSettlements: Record<string, unknown>[] = [
          {
            task_id: taskID,
            dispatch_lineage_id: lineage.artifactID,
            dispatch_id: dispatchID,
            session_id: child.id,
            outcome: {
              kind: "infrastructure_failure",
              session_id: child.id,
              infrastructure_error: {
                artifact_id: dispositionPayload.infrastructure_source_artifact_id,
              },
            },
            time_created: Date.now(),
          },
          {
            ...settlementPayload,
            outcome: {
              ...settlementPayload.outcome,
              recovery_authority: {
                ...settlementPayload.outcome.recovery_authority,
                dispatch_id: "dispatch_drift",
              },
            },
          },
          {
            ...settlementPayload,
            outcome: {
              ...settlementPayload.outcome,
              infrastructure_error: {
                ...settlementPayload.outcome.infrastructure_error,
                expected_sha256: "0".repeat(64),
              },
            },
          },
          {
            ...settlementPayload,
            session_id: root.id,
            outcome: { ...settlementPayload.outcome, session_id: root.id },
          },
          { ...settlementPayload, time_created: 1.5 },
          { ...settlementPayload, time_created: Number.MAX_SAFE_INTEGER + 1 },
          {
            ...settlementPayload,
            outcome: { ...settlementPayload.outcome, error_name: 7 },
          },
          {
            ...settlementPayload,
            outcome: { ...settlementPayload.outcome, failure_issues: [] },
          },
          {
            ...settlementPayload,
            outcome: {
              ...settlementPayload.outcome,
              failure_issues: [{ code: "bad", path: ["input", 1.5], message: "invalid fractional path" }],
            },
          },
          {
            ...settlementPayload,
            outcome: {
              ...settlementPayload.outcome,
              failure_issues: [
                { code: "bad", path: [Number.MAX_SAFE_INTEGER + 1], message: "unsafe positive path" },
              ],
            },
          },
          {
            ...settlementPayload,
            outcome: {
              ...settlementPayload.outcome,
              failure_issues: [
                { code: "bad", path: [-Number.MAX_SAFE_INTEGER - 1], message: "unsafe negative path" },
              ],
            },
          },
          {
            ...settlementPayload,
            outcome: {
              ...settlementPayload.outcome,
              worker_turn: { descriptor_id: "wtd_bad", descriptor_hash: 7, input_message_id: "msg_bad" },
            },
          },
          {
            ...settlementPayload,
            outcome: {
              ...settlementPayload.outcome,
              infrastructure_error: {
                ...settlementPayload.outcome.infrastructure_error,
                catalog_revision: "1",
              },
            },
          },
          {
            ...settlementPayload,
            outcome: {
              ...settlementPayload.outcome,
              infrastructure_error: {
                ...settlementPayload.outcome.infrastructure_error,
                catalog_revision: Number.MAX_SAFE_INTEGER + 1,
              },
            },
          },
          {
            ...settlementPayload,
            outcome: {
              kind: "partial",
              session_id: child.id,
              final_message_id: Identifier.ascending("message"),
              failed_operation: "persist_domain_artifact",
              infrastructure_error: {
                ...settlementPayload.outcome.infrastructure_error,
                unexpected: true,
              },
            },
          },
          {
            ...settlementPayload,
            outcome: {
              kind: "partial",
              session_id: child.id,
              final_message_id: Identifier.ascending("message"),
              failed_operation: "persist_domain_artifact",
              infrastructure_error: {
                ...settlementPayload.outcome.infrastructure_error,
                catalog_revision: Number.MAX_SAFE_INTEGER + 1,
              },
            },
          },
          {
            ...settlementPayload,
            outcome: {
              kind: "domain_incomplete",
              session_id: child.id,
              final_message_id: Identifier.ascending("message"),
              domain: "research",
              domain_artifact: {
                ...settlementPayload.outcome.infrastructure_error,
                expected_sha256: "not-a-sha256",
              },
            },
          },
          {
            ...settlementPayload,
            outcome: {
              kind: "domain_incomplete",
              session_id: child.id,
              final_message_id: Identifier.ascending("message"),
              domain: "research",
              domain_artifact: {
                ...settlementPayload.outcome.infrastructure_error,
                catalog_revision: Number.MAX_SAFE_INTEGER + 1,
              },
            },
          },
          {
            ...settlementPayload,
            outcome: { ...settlementPayload.outcome, message: "😀".repeat(4_097) },
          },
          {
            ...settlementPayload,
            outcome: {
              kind: "domain_blocked",
              session_id: child.id,
              final_message_id: Identifier.ascending("message"),
              domain: "research",
              domain_artifact: { ...settlementPayload.outcome.infrastructure_error },
              blocking_question: { request_id: "QUE_case_drift", status: "expired" },
            },
          },
          {
            ...settlementPayload,
            outcome: {
              kind: "coordination",
              session_id: child.id,
              coordination_request: { source: "coordination_request", request_id: "art_valid\u00a0" },
              dispatch_lineage_id: lineage.artifactID,
            },
          },
        ]
        for (const invalidSettlement of invalidSettlements) {
          expect(() => insertSettlement(invalidSettlement)).toThrow(
            "engine_artifact: dispatch settlement requires exact final outcome and lineage authority",
          )
        }
        expect(
          DispatchOutcome.parse({ ...settlementPayload.outcome, message: "😀".repeat(3_000) }).kind,
        ).toBe("infrastructure_failure")
        expect(
          DispatchOutcome.parse({
            ...settlementPayload.outcome,
            infrastructure_error: {
              ...settlementPayload.outcome.infrastructure_error,
              catalog_revision: Number.MAX_SAFE_INTEGER,
            },
            failure_issues: [
              {
                code: "safe_integer_boundaries",
                path: [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
                message: "both safe integer boundaries",
              },
            ],
          }).kind,
        ).toBe("infrastructure_failure")
        expect(() =>
          DispatchOutcome.parse({
            ...settlementPayload.outcome,
            failure_issues: [
              { code: "unsafe_integer", path: [Number.MAX_SAFE_INTEGER + 1], message: "outside safe range" },
            ],
          }),
        ).toThrow()
        expect(() =>
          DispatchOutcome.parse({ ...settlementPayload.outcome, message: "😀".repeat(4_097) }),
        ).toThrow("at most 4096 code points")
        expect(() =>
          DispatchOutcome.parse({
            kind: "domain_blocked",
            session_id: child.id,
            final_message_id: Identifier.ascending("message"),
            domain: "research",
            domain_artifact: { ...settlementPayload.outcome.infrastructure_error },
            blocking_question: { request_id: "QUE_case_drift", status: "expired" },
          }),
        ).toThrow()
        expect(() =>
          DispatchOutcome.parse({
            kind: "coordination",
            session_id: child.id,
            coordination_request: { source: "coordination_request", request_id: "art_valid\u00a0" },
            dispatch_lineage_id: lineage.artifactID,
          }),
        ).toThrow()
        for (const evidenceID of [
          lineage.artifactID,
          dispositionPayload.infrastructure_source_artifact_id,
          dispositionPayload.budget_artifact_id,
          settlementArtifact.id,
        ]) {
          expect(() =>
            Database.use((db) =>
              db
                .update(EngineArtifactTable)
                .set({ label: "drift" })
                .where(eq(EngineArtifactTable.id, evidenceID))
                .run(),
            ),
          ).toThrow()
          expect(() =>
            Database.use((db) => db.delete(EngineArtifactTable).where(eq(EngineArtifactTable.id, evidenceID)).run()),
          ).toThrow("engine_artifact: scheduling disposition evidence is immutable until Task retention")
        }
        expect(() =>
          Database.use((db) => db.delete(EngineArtifactTable).where(eq(EngineArtifactTable.id, disposition.id)).run()),
        ).toThrow("engine_artifact: scheduling settlement or disposition is immutable until Task retention")
        // Two more sweeps: the settled-but-undelivered dispatch must stay
        // silent instead of re-entering through a budget-exempt event.
        await reconcileTaskControlPlane(taskID)
        await reconcileTaskControlPlane(taskID)

        expect({
          ...afterSettlement,
          ingressesAfterSweeps: ingressCount(),
        }).toMatchObject({
          settled: "infrastructure_failure",
          // Creation ingress + the budgeted failures; the silenced dispatch
          // minted nothing, then and later.
          ingresses: 1 + TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET,
          dispositions: [
            {
              payload: {
                task_id: taskID,
                dispatch_lineage_id: lineage.artifactID,
                dispatch_id: dispatchID,
                execution_epoch: 1,
                disposition: "budget_suppressed",
              },
            },
          ],
          unresolved: [],
          ingressesAfterSweeps: 1 + TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET,
        })
      },
    })
  }, 30_000)
})
