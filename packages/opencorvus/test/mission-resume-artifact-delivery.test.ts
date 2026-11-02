import { afterEach, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import {
  ArtifactReadInputSchema,
  type ArtifactReadLocator,
  type CrossTaskArtifactSource,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { recordEngineArtifact } from "@/engine/artifact"
import { engineArtifactCatalogMetadataSHA256 } from "@/engine/artifact-catalog-metadata"
import { EngineArtifactTable, EngineArtifactCatalogRevisionTable } from "@/engine/engine.sql"
import {
  listCrossTaskArtifactImportMappings,
  resolveCrossTaskArtifactSources,
  prepareCrossTaskArtifactSourceImports,
  persistPreparedCrossTaskArtifactImports,
} from "@/engine/cross-task-artifact-import"
import { requireTask } from "@/engine/store"
import { terminalTask } from "@/engine/state"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { openTaskForContinuationInTransaction } from "@/engine/task-intent-open"
import { requireCurrentTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { TestHooks as TaskControlTestHooks, taskRootIngressDebugProjection } from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { materializeMissionAcceptanceGap } from "@/mission/acceptance-gap"
import { readLatestTaskAcceptanceLedger } from "@/mission/acceptance-ledger"
import { readMissionTaskResumeReceipt } from "@/mission/acceptance-resume-receipt"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { Database, eq } from "@/storage/db"
import { publishEngineArtifactResources, readTaskArtifactRef } from "@/task-artifact/store"
import { removeUnreferencedTaskArtifactRoots } from "@/task-artifact/recovery"
import { EngineService } from "@/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { openMissionThroughRealWake } from "./fixture/mission-opened"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function artifact(taskID: string, payload: unknown): ArtifactReadLocator {
  const id = recordEngineArtifact({
    taskID,
    kind: "expert_output",
    label: "Native delivery contract evidence",
    payload,
    timeCreated: Date.now(),
  })
  const row = Database.use((db) => db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, id)).get())!
  return {
    source: "engine_artifact",
    artifact_id: id,
    catalog_revision: row.catalog_revision,
    expected_sha256: row.payload_sha256,
  }
}

async function fail(taskID: string) {
  const task = requireTask(taskID)
  await terminalTask(
    task,
    {
      status: "failed",
      error: "Native service contract: missing predecessor input",
      time_started: task.time_started ?? Date.now(),
      time_completed: Date.now(),
    },
    "Explicit failed fixture occurrence",
  )
}

async function fixture(directory: string) {
  const mission = await ensureMissionSession({
    missionID: "native-delivery-" + randomUUID(),
    defaultCwd: directory,
    productPillar: "code",
    heldExpertSquadIDs: ["base"],
  })
  const opened = await openMissionThroughRealWake({
    missionID: mission.missionID,
    sessionID: mission.id,
    source: "mission.dispatch",
    requestID: "delivery-open:" + mission.id,
  })
  using missionLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
  const create = (title: string) =>
    EngineService.createTask(
      {
        requestID: Identifier.ascending("artifact"),
        title,
        request: "Native service contract: explicitly deliver predecessor evidence",
        productPillar: "code",
        model: "firmware/gpt-5",
        promptProfile: "base",
      },
      {
        actor: "mission",
        sessionID: mission.id,
        openedOccurrence: { eventID: opened.eventID, operationID: opened.operationID },
      },
    )
  const sourceID = await create("Predecessor resource")
  const sourcePath = path.join(ProjectRuntimePaths.taskRoot(directory, sourceID), "input.txt")
  await fs.mkdir(path.dirname(sourcePath), { recursive: true })
  await fs.writeFile(sourcePath, "Exact native predecessor resource\n")
  const producer = {
    owner_kind: "core" as const,
    component_id: "native-service-contract",
    operation_id: "predecessor-resource",
  }
  const publication = await publishEngineArtifactResources({
    projectID: Instance.project.id,
    projectDirectory: directory,
    taskID: sourceID,
    producer,
    files: [{ sourcePath, resourcePath: "input.txt", mediaType: "text/plain" }],
  })
  const resource: ArtifactReadLocator = { source: "task_artifact_resource", ref: publication.artifacts[0]! }
  // A real catalog Artifact owns the resource; recovery preserves its source.
  artifact(sourceID, {
    artifact_type: "contract/predecessor",
    schema_version: 1,
    producer,
    payload: { result: "input" },
    resources: publication.artifacts,
    observed_artifact_locators: [],
    source_artifact_locators: [],
  })
  await fail(sourceID)
  const indirectID = await create("Predecessor referencing another source")
  const indirect = artifact(indirectID, {
    referenced_predecessor: resource,
    meaning: "Provenance is not delivery authority",
  })
  await fail(indirectID)
  const indirectSource: CrossTaskArtifactSource = {
    authority: "terminal_lifecycle",
    source_task_id: indirectID,
    locator: indirect,
  }
  const taskID = await create("Same Task repair target")
  // Exercise the same production import writer used by creation, without
  // fabricating a model panel_create_task Tool provenance in this service test.
  const initialImporter = {
    missionID: mission.missionID,
    sessionID: mission.id,
    messageID: Identifier.ascending("message"),
    toolCallID: "native-service-initial-import:" + taskID,
  }
  const initial = await prepareCrossTaskArtifactSourceImports({
    resolved: resolveCrossTaskArtifactSources({
      sources: [indirectSource],
      projectID: Instance.project.id,
      importer: initialImporter,
    }),
    projectID: Instance.project.id,
    targetProjectDirectory: directory,
    targetTaskID: taskID,
    importer: initialImporter,
  })
  Database.immediateTransaction((db) =>
    persistPreparedCrossTaskArtifactImports(db, {
      targetTaskID: taskID,
      prepared: initial.imports,
      authorities: initial.authorities,
      timeCreated: Date.now(),
    }),
  )
  const evidence = artifact(taskID, { missing_input: resource })
  await fail(taskID)
  const terminal = requireCurrentTerminalLifecycleReference(taskID)
  const gap = materializeMissionAcceptanceGap({
    reviewedTerminalLifecycleReference: terminal,
    evidenceByReadReference: new Map([["ar_native_delivery", evidence]]),
    gap: {
      gap_id: "native-delivery-gap",
      current_ledger_revision_artifact_id: null,
      criteria: [
        {
          criterion_id: "predecessor",
          state: "open",
          disposition: "unresolved",
          finding: "Deliver the exact predecessor input",
          responsibility: { kind: "task_initialization", failure_reference: terminal },
          observation_evidence_read_refs: ["ar_native_delivery"],
          repair_evidence_read_refs: [],
          resolution_evidence_read_refs: [],
          invalidating_evidence_read_refs: [],
          irreducible_blocker_evidence_read_refs: [],
          repair_action: {
            operation: "deliver",
            target: "predecessor",
            expected_evidence_kind: "input",
            parameters: {},
          },
        },
      ],
    },
  })
  const input = {
    taskID,
    importer: {
      missionID: mission.missionID,
      sessionID: mission.id,
      messageID: Identifier.ascending("message"),
      toolCallID: "native-service-resume:" + taskID,
    },
    toolPartID: Identifier.ascending("part"),
    reviewedTerminalLifecycleReference: terminal,
    expectedAcceptanceLedgerArtifactID: null,
    acceptanceGap: gap,
    completeEvidenceLocators: [evidence],
    artifactSources: [
      { authority: "terminal_lifecycle", source_task_id: sourceID, locator: resource },
      indirectSource,
    ] as CrossTaskArtifactSource[],
  }
  return { taskID, sourceID, indirectID, resource, input }
}

// Native service calls are authored by this test driver. Worker/model decisions
// are outside this checker; no assistant Messages or Tool outcomes are invented.
test("same-Task resume commits exact flat imports, readable resources and replay across database reopening", async () => {
  await using project = await memoryProject()
  const accepted = await Instance.provide({
    directory: project.path,
    init: InstanceBootstrap,
    fn: async () => {
      using taskLoop = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })

      const f = await fixture(project.path)
      using missionLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      const prior = listCrossTaskArtifactImportMappings(f.taskID)
      expect(prior.map((m) => m.source_task_id)).toEqual([f.indirectID])
      const [first, repeated] = await Promise.all([
        EngineService.resumeMissionTask(f.input),
        EngineService.resumeMissionTask(f.input),
      ])
      expect(first.kind).toBe("resumed")
      expect(repeated.kind).toBe("resumed")
      if (first.kind !== "resumed" || repeated.kind !== "resumed") throw Error("Accepted resume required")
      expect(repeated).toMatchObject({
        receipt_artifact_id: first.receipt_artifact_id,
        message_id: first.message_id,
        artifact_sources: f.input.artifactSources,
        artifact_imports: first.artifact_imports,
      })
      expect(first.artifact_imports).toHaveLength(2)
      expect(first.artifact_imports!.find((m) => m.source_task_id === f.indirectID)).toEqual(prior[0])
      expect(taskLifecycleProjection(f.taskID)).toMatchObject({ status: "active", epoch: 2 })
      expect(readLatestTaskAcceptanceLedger(f.taskID)).toMatchObject({
        artifactID: first.acceptance_ledger_revision_artifact_id,
        revision: { execution_epoch: 2, gap: f.input.acceptanceGap },
      })
      const messages = await Session.messages({ sessionID: requireTask(f.taskID).session_id! })
      expect(
        messages.filter((m) => m.info.role === "user" && m.info.author === "mission").map((m) => m.info.id),
      ).toEqual([first.message_id])
      const mapping = first.artifact_imports!.find((m) => m.source_task_id === f.sourceID)!
      const read = await EngineService.readMissionTaskArtifact({
        taskID: f.taskID,
        importer: f.input.importer,
        read: ArtifactReadInputSchema.parse({ locator: mapping.imported_locator }),
      })
      expect(read.chunk!.complete).toBe(true)
      const envelope = JSON.parse(read.chunk!.text!)
      expect(envelope.import_lineage).toMatchObject({ source_task_id: f.sourceID, source_locator: f.resource })
      expect(envelope.resources).toHaveLength(1)
      expect(envelope.resources[0].snapshot.task_id).toBe(f.taskID)
      expect(
        Buffer.from(
          await readTaskArtifactRef({
            projectID: Instance.project.id,
            projectDirectory: project.path,
            taskID: f.taskID,
            ref: envelope.resources[0],
          }),
        ).toString(),
      ).toBe("Exact native predecessor resource\n")
      const receipt = readMissionTaskResumeReceipt(f.taskID, { toolCallID: f.input.importer.toolCallID })!
      expect(receipt).toMatchObject({
        artifactID: first.receipt_artifact_id,
        receipt: { artifact_imports: first.artifact_imports },
      })
      return { f, first, receipt }
    },
  })
  await Instance.disposeAll()
  Database.close()
  await Instance.provide({
    directory: project.path,
    init: InstanceBootstrap,
    fn: async () => {
      using taskLoop = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })

      const replay = await EngineService.resumeMissionTask(accepted.f.input)
      expect(replay).toMatchObject({
        kind: "resumed",
        receipt_artifact_id: accepted.first.receipt_artifact_id,
        message_id: accepted.first.message_id,
        artifact_imports: accepted.first.artifact_imports,
      })
      expect(
        readMissionTaskResumeReceipt(accepted.f.taskID, { ingressID: accepted.first.ingress_artifact_id }),
      ).toEqual(accepted.receipt)
      expect(listCrossTaskArtifactImportMappings(accepted.f.taskID)).toEqual(accepted.first.artifact_imports!)
      await expect(EngineService.resumeMissionTask({ ...accepted.f.input, artifactSources: [] })).rejects.toThrow(
        "tool identity conflicts",
      )
    },
  })
}, 60_000)

test("a source occurrence change before commit returns exact authority failure and preserves durable repair state", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    init: InstanceBootstrap,
    fn: async () => {
      using taskLoop = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })

      const f = await fixture(project.path)
      using missionLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      const prior = {
        lifecycle: taskLifecycleProjection(f.taskID),
        imports: listCrossTaskArtifactImportMappings(f.taskID),
        messages: await Session.messages({ sessionID: requireTask(f.taskID).session_id! }),
        ledger: readLatestTaskAcceptanceLedger(f.taskID),
      }
      const persist = Session.persistMessageWithCommit
      using beforeCommit = spyOn(Session, "persistMessageWithCommit").mockImplementationOnce(async (...args) => {
        Database.immediateTransaction((db) =>
          openTaskForContinuationInTransaction({ db, taskID: f.sourceID, now: Date.now() }),
        )
        return persist(...args)
      })
      await expect(EngineService.resumeMissionTask(f.input)).rejects.toMatchObject({
        name: "CrossTaskArtifactDeliveryAuthorityError",
        sourceTaskID: f.sourceID,
      })
      expect({
        lifecycle: taskLifecycleProjection(f.taskID),
        imports: listCrossTaskArtifactImportMappings(f.taskID),
        messages: await Session.messages({ sessionID: requireTask(f.taskID).session_id! }),
        ledger: readLatestTaskAcceptanceLedger(f.taskID),
      }).toEqual(prior)
      const removed = await removeUnreferencedTaskArtifactRoots({
        projectID: Instance.project.id,
        projectDirectory: project.path,
      })
      expect(removed).toHaveLength(1)
      expect(listCrossTaskArtifactImportMappings(f.taskID)).toEqual(prior.imports)
    },
  })
}, 60_000)

test("corrupt imported evidence uses the durable Mission receipt integrity contract", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    init: InstanceBootstrap,
    fn: async () => {
      using taskLoop = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })

      const f = await fixture(project.path)
      using missionLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      const result = await EngineService.resumeMissionTask(f.input)
      if (result.kind !== "resumed") throw Error("Accepted resume required")
      const imported = result.artifact_imports![0]!
      Database.use((db) => {
        const row = db
          .select()
          .from(EngineArtifactTable)
          .where(eq(EngineArtifactTable.id, imported.imported_locator.artifact_id))
          .get()!
        db.update(EngineArtifactTable)
          .set({
            catalog_resource_count: 999,
            catalog_revision: db
              .insert(EngineArtifactCatalogRevisionTable)
              .values({})
              .returning({ revision: EngineArtifactCatalogRevisionTable.revision })
              .get()!.revision,
            catalog_metadata_sha256: engineArtifactCatalogMetadataSHA256({
              ...row,
              artifact_id: row.id,
              label_index: row.label,
              catalog_resource_count: 999,
            }),
          })
          .where(eq(EngineArtifactTable.id, row.id))
          .run()
      })
      expect(() => listCrossTaskArtifactImportMappings(f.taskID)).toThrow(
        expect.objectContaining({
          name: "CrossTaskArtifactImportIntegrityError",
          code: "CROSS_TASK_ARTIFACT_IMPORT_INTEGRITY_INVALID",
        }),
      )
      expect(() => readMissionTaskResumeReceipt(f.taskID, { ingressID: result.ingress_artifact_id })).toThrow(
        expect.objectContaining({ name: "MissionTaskResumeReceiptIntegrityError" }),
      )
      expect(
        taskRootIngressDebugProjection(f.taskID).find((item) => item.ingressID === result.ingress_artifact_id)
          ?.projection,
      ).toMatchObject({ state: "host_fault", reason: "evidence_violation" })
    },
  })
}, 60_000)

test("foreign Projects, stale target occurrences and cancelled targets retain exact authority contracts", async () => {
  await using project = await memoryProject("resume-main-project")
  await using foreign = await memoryProject("resume-foreign-project")
  const other = await Instance.provide({
    directory: foreign.path,
    init: InstanceBootstrap,
    fn: async () => {
      using taskLoop = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
      return await fixture(foreign.path)
    },
  })
  await Instance.provide({
    directory: project.path,
    init: InstanceBootstrap,
    fn: async () => {
      using taskLoop = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
      const f = await fixture(project.path)
      using missionLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      await expect(
        EngineService.resumeMissionTask({
          ...f.input,
          artifactSources: [
            { authority: "terminal_lifecycle", source_task_id: other.sourceID, locator: other.resource },
          ],
        }),
      ).rejects.toMatchObject({
        name: "CrossTaskArtifactLineageAuthorityError",
        code: "CROSS_TASK_ARTIFACT_LINEAGE_AUTHORITY_INVALID",
        sourceTaskID: other.sourceID,
      })
      Database.immediateTransaction((db) =>
        openTaskForContinuationInTransaction({ db, taskID: f.taskID, now: Date.now() }),
      )
      await fail(f.taskID)
      await expect(EngineService.resumeMissionTask(f.input)).rejects.toMatchObject({
        name: "MissionTaskResumeLifecycleConflictError",
        data: {
          taskID: f.taskID,
          currentLifecycle: "failed",
          reviewedTerminalLifecycleReference: f.input.reviewedTerminalLifecycleReference,
        },
      })
      Database.immediateTransaction((db) =>
        openTaskForContinuationInTransaction({ db, taskID: f.taskID, now: Date.now() }),
      )
      await EngineService.cancelTask(f.taskID, {
        origin: {
          actor: "user",
          source: "task.cancel",
          surface: "api",
          requestID: "native-delivery-cancel",
          reason: "Explicit checker cancellation",
        },
      })
      const cancelled = requireCurrentTerminalLifecycleReference(f.taskID)
      const result = await EngineService.resumeMissionTask({
        ...f.input,
        reviewedTerminalLifecycleReference: cancelled,
        acceptanceGap: {
          ...f.input.acceptanceGap,
          reviewed_terminal_lifecycle_reference: cancelled,
          criteria: f.input.acceptanceGap.criteria.map((criterion) => ({
            ...criterion,
            responsibility: { kind: "task_initialization", failure_reference: cancelled },
          })),
        },
      })
      expect(result).toMatchObject({
        kind: "cancellation_authority_required",
        task_id: f.taskID,
        terminal_lifecycle_reference: cancelled,
        cancellation: { actor: "user", source: "task.cancel", reason: "Explicit checker cancellation" },
      })
      expect(taskLifecycleProjection(f.taskID)).toMatchObject({ status: "cancelled", epoch: 3 })
      expect(listCrossTaskArtifactImportMappings(f.taskID).map((m) => m.source_task_id)).toEqual([f.indirectID])
    },
  })
}, 120_000)
