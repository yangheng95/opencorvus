import { afterEach, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import {
  artifactCatalogAuthority,
  EngineArtifactIdentityCollisionError,
  publishExpertArtifact,
  readTaskArtifact,
  searchTaskArtifacts,
  TaskArtifactPublicationClosedError,
} from "@/artifact-catalog"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { recordEngineArtifact, updateEngineArtifact } from "@/engine/artifact"
import { createDispatchLineageOrigin, listDispatchLineage, recordDispatchLineage } from "@/engine/dispatch-lineage"
import { assertTaskDispatchesSettledInTransaction, recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { EngineArtifactTable, EngineTaskTable } from "@/engine/engine.sql"
import {
  CrossTaskArtifactDeliveryAuthorityError,
  importsFromResolvedCrossTaskArtifactSources,
  listCrossTaskArtifactImportMappings,
  persistPreparedCrossTaskArtifactImports,
  prepareCrossTaskArtifactImports,
  prepareCrossTaskArtifactSourceImports,
  resolveCrossTaskArtifactSources,
  sameCrossTaskArtifactImportSet,
} from "@/engine/cross-task-artifact-import"
import { findTaskCompletionDecisionForTerminalTime } from "@/engine/completion-decision"
import { EngineGit } from "@/engine/git"
import {
  acquireTaskCompletionClosureInTransaction,
  taskCompletionClosureInTransaction,
  TaskCompletionClosureConflictError,
} from "@/engine/task-completion-closure"
import { insertTaskProcessBinding, prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { insertTaskPackageRevisionBinding } from "@/engine/task-package-revision-binding"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { ProjectTable } from "@/project/project.sql"
import { Project } from "@/project/project"
import { Session } from "@/session"
import { Database, DatabaseUnavailableError, and, eq } from "@/storage/db"
import { createToolExecutionSurface } from "@/tool/execution-surface"
import type { TaskToolExecutionScope } from "@/tool/task-tool-execution-scope"
import { createTaskLifecycleTools } from "@/orchestrator/task-lifecycle-tools"
import { terminalTask } from "@/engine/state"
import { requireTask } from "@/engine/store"
import { openTaskForContinuationInTransaction } from "@/engine/task-intent-open"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { publishImportedTaskArtifactResources, publishTaskArtifactProjectFiles } from "@/task-artifact/store"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function taskFixture(directory: string) {
  const missionID = "mission-terminal-artifact-closure"
  const mission = await ensureMissionSession({
    missionID,
    defaultCwd: directory,
    productPillar: "work",
    heldExpertSquadIDs: ["base"],
  })
  const missionSessionID = mission.id
  const session = await Session.create({
    kind: "root",
    title: "Terminal Artifact closure",
    metadata: { configOverlay: { prompt_profile: { active: "base" } } },
  })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const packageRevision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "base",
    version: "2026.08.13.1",
    packageDigest: "a".repeat(64),
  }
  const processBinding = await prepareTaskProcessBinding({
    mode: "native",
    taskID,
    projectID: Instance.project.id,
    rootDirectory: directory,
    packageRevisionSHA256: packageRevision.packageDigest,
    timeCreated: now,
  })
  Database.transaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: session.id,
        source: "test",
        product_pillar: "work",
        title: "Terminal Artifact closure",
        request: "Keep the Task result immutable after completion",
        priority: "normal",
        metadata: {
          actor: "mission",
          mission: { id: missionID, session_id: missionSessionID },
        },
        time_created: now,
      })
      .run()
    appendTaskOpenedInTransaction({
      db,
      taskID,
      sessionID: session.id,
      now,
      source: "test.task-terminal-artifact-closure",
    })
    insertTaskPackageRevisionBinding({ db, taskID, packageRevision, timeCreated: now })
    insertTaskProcessBinding({ db, payload: processBinding })
  })
  const scope: TaskToolExecutionScope = Object.freeze({
    kind: "task",
    projectID: Instance.project.id,
    projectDirectory: directory,
    taskID,
    taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(directory, taskID),
    sessionID: session.id,
    messageID: Identifier.ascending("message"),
    toolCallID: "call_terminal_artifact_closure",
    toolPartID: Identifier.ascending("part"),
    executionSurface: createToolExecutionSurface({ toolIDs: ["artifact_publish"], permission: [] }),
    owner: Object.freeze({
      kind: "projected-worker" as const,
      expertSquadID: "base",
      packageRevision,
      agentID: "base-developer",
      projectionHash: "b".repeat(64),
      workerTurnDescriptorID: Identifier.ascending("artifact"),
      workerTurnDescriptorHash: "c".repeat(64),
    }),
  })
  return { taskID, sessionID: session.id, packageRevision, scope, missionID, missionSessionID }
}

async function completeFixtureTask(
  task: Awaited<ReturnType<typeof taskFixture>>,
  projectPath: string,
  deliverables: readonly {
    source: "engine_artifact"
    artifact_id: string
    catalog_revision: number
    expected_sha256: string
  }[],
  suffix: string,
  workflow: {
    id: string
    nodes: Record<string, { agent_id: string; description: string; depends_on: string[] }>
  } | null = null,
) {
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: task.sessionID,
    role: "user",
    author: "orchestrator",
    time: { created: Date.now() },
    agent: "orchestrator",
    model: { providerID: "test", modelID: `completion-${suffix}` },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: task.sessionID,
    parentID: user.id,
    role: "assistant",
    author: "orchestrator",
    time: { created: Date.now() },
    agent: "orchestrator",
    providerID: "test",
    modelID: `completion-${suffix}`,
    path: { cwd: projectPath, root: projectPath },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  const callID = `call_complete_${suffix}`
  const part = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: task.sessionID,
    messageID: assistant.id,
    type: "tool",
    callID,
    tool: "complete_task",
    state: { status: "running", input: {}, time: { start: Date.now() } },
  })
  const tools = createTaskLifecycleTools({
    taskID: task.taskID,
    workflowProjection: {
      packageRevision: task.packageRevision,
      virtualWorkflows: workflow
        ? {
            [workflow.id]: {
              label: "Terminal evidence fixture",
              description: "Terminal evidence fixture",
              nodes: workflow.nodes,
            },
          }
        : {},
    },
    requireExecutionContext: async () => ({
      orchestratorSessionID: task.sessionID,
      orchestratorMessageID: assistant.id,
      toolCallID: callID,
      toolPartID: part.id,
      visibleToolName: "complete_task",
    }),
  })
  // The model-facing boundary names revisions only; digests are Host-derived.
  const namedDeliverables = deliverables.map(({ expected_sha256: _digest, ...named }) => named)
  return (tools.complete_task.execute as any)(
    {
      summary: `Complete fixture ${suffix}`,
      evidence_locators: namedDeliverables,
      deliverable_artifact_locators: namedDeliverables,
      accepted_delivery_slice_revision_ids: [],
      workflow_id: workflow?.id ?? null,
    },
    { toolCallId: callID, messages: [] },
  )
}

test("seals every terminal workflow worker Artifact into the completion decision without asking the model", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const task = await taskFixture(project.path)
      const first = await publishExpertArtifact({
        scope: task.scope,
        artifact: {
          artifact_type: "base/terminal-result-one",
          schema_version: 1,
          label: "Terminal result one",
          payload: { result: "one" },
          resources: [],
          source_artifact_locators: [],
          idempotent: true,
        },
      })
      const second = await publishExpertArtifact({
        scope: task.scope,
        artifact: {
          artifact_type: "base/terminal-result-two",
          schema_version: 1,
          label: "Terminal result two",
          payload: { result: "two" },
          resources: [],
          source_artifact_locators: [],
          idempotent: true,
        },
      })
      const workflow = {
        id: "terminal-evidence-fixture",
        nodes: {
          planner: { agent_id: "base-planner", description: "Plan", depends_on: [] },
          intermediate: { agent_id: "base-developer", description: "Build", depends_on: ["planner"] },
          owner: { agent_id: "base-developer", description: "Deliver", depends_on: ["intermediate"] },
        },
      }

      // The Orchestrator names only the first Artifact. The second is still a terminal-node
      // `expert_output` of the bound workflow, so the Host seals it itself instead of rejecting a
      // decision whose only missing input the Host already holds.
      expect(await completeFixtureTask(task, project.path, [first.locator], "derived", workflow)).toMatchObject({
        title: "Task Completed",
      })
      const decision = findTaskCompletionDecisionForTerminalTime({
        taskID: task.taskID,
        timeCompleted: requireTask(task.taskID).time_completed!,
      })
      expect(decision?.payload.deliverable_artifact_locators).toEqual([first.locator])
      // The derivation orders by artifact id under SQLite's binary collation, so the expectation
      // uses the same comparison rather than a locale-aware one.
      expect(decision?.payload.terminal_workflow_artifact_locators).toEqual(
        [first.locator, second.locator].sort((left, right) =>
          left.artifact_id < right.artifact_id ? -1 : left.artifact_id > right.artifact_id ? 1 : 0,
        ),
      )
    },
  })
}, 60_000)

test("keeps the exact terminal expert Artifact immutable while preserving an idempotent replay", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const task = await taskFixture(project.path)
      const publication = {
        artifact_type: "base/terminal-result",
        schema_version: 1,
        label: "Canonical terminal result",
        payload: { result: "accepted" },
        resources: [],
        source_artifact_locators: [],
        idempotent: true as const,
      }
      const accepted = await publishExpertArtifact({ scope: task.scope, artifact: publication })
      expect(accepted.locator.artifact_id).toHaveLength(Identifier.MAX_LENGTH)
      expect(accepted.locator.expected_sha256).toHaveLength(64)
      const completedAt = Date.now()
      await terminalTask(requireTask(task.taskID), { status: "completed" }, "Terminal publication fixture completed", {
        projectDir: project.path,
        terminalAt: completedAt,
      })

      expect(await publishExpertArtifact({ scope: task.scope, artifact: publication })).toEqual(accepted)
      let latePublication: unknown
      try {
        await publishExpertArtifact({
          scope: task.scope,
          artifact: { ...publication, payload: { result: "different late result" } },
        })
      } catch (error) {
        latePublication = error
      }
      expect(latePublication).toMatchObject({
        name: TaskArtifactPublicationClosedError.name,
        code: "TASK_ARTIFACT_PUBLICATION_CLOSED",
        taskID: task.taskID,
        timeCompleted: completedAt,
      })
      expect(
        Database.use((db) =>
          db
            .select({ id: EngineArtifactTable.id })
            .from(EngineArtifactTable)
            .where(and(eq(EngineArtifactTable.task_id, task.taskID), eq(EngineArtifactTable.kind, "expert_output")))
            .all(),
        ),
      ).toEqual([{ id: accepted.locator.artifact_id }])
    },
  })
}, 60_000)

test("returns the typed compact Artifact identity collision contract", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const task = await taskFixture(project.path)
      const publication = {
        artifact_type: "base/terminal-result",
        schema_version: 1,
        label: "Canonical terminal result",
        payload: { result: "accepted" },
        resources: [],
        source_artifact_locators: [],
        idempotent: true as const,
      }
      const accepted = await publishExpertArtifact({ scope: task.scope, artifact: publication })
      const row = Database.use((db) =>
        db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, accepted.locator.artifact_id)).get(),
      )
      if (!row || !row.payload || typeof row.payload !== "object")
        throw new Error("Published Artifact fixture is absent")
      Database.use((db) =>
        db.delete(EngineArtifactTable).where(eq(EngineArtifactTable.id, accepted.locator.artifact_id)).run(),
      )
      recordEngineArtifact({
        id: accepted.locator.artifact_id,
        taskID: task.taskID,
        kind: "log",
        label: "Foreign compact identity partition",
        payload: { occupied: true },
      })

      let observed: unknown
      try {
        await publishExpertArtifact({ scope: task.scope, artifact: publication })
      } catch (error) {
        observed = error
      }
      expect(observed).toMatchObject({
        name: EngineArtifactIdentityCollisionError.name,
        code: "ENGINE_ARTIFACT_IDENTITY_COLLISION",
        artifactID: accepted.locator.artifact_id,
      })
    },
  })
}, 60_000)

test("requires a pre-release reset for the legacy expanded idempotent Artifact epoch", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const task = await taskFixture(project.path)
      const legacyID = `art_idempotent_${"a".repeat(64)}`
      const accepted = await publishExpertArtifact({
        scope: task.scope,
        artifact: {
          artifact_type: "base/legacy-terminal-result",
          schema_version: 1,
          label: "Legacy deterministic Artifact",
          payload: { result: "legacy" },
          resources: [],
          source_artifact_locators: [],
          idempotent: true,
        },
      })
      const current = Database.use((db) =>
        db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, accepted.locator.artifact_id)).get(),
      )
      if (!current) throw new Error("Compact Artifact fixture is absent")
      recordEngineArtifact({
        id: legacyID,
        taskID: task.taskID,
        kind: "expert_output",
        label: "Legacy deterministic Artifact",
        payload: current.payload,
      })
      await Database.awaitEffectIdle(30_000)
      Database.close()

      let observed: unknown
      try {
        Database.Client()
      } catch (error) {
        observed = error
      }
      expect(DatabaseUnavailableError.isInstance(observed) ? observed.data : undefined).toMatchObject({
        code: "DATA_RESET_REQUIRED",
        operation: "Database.Client.dataIntegrity.compactArtifactIdentity",
      })
      await Database.resetFiles(Database.Path())
      Database.Client()
    },
  })
}, 60_000)

test("requires a pre-release reset for the legacy expanded Project identity epoch", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const legacyID = "a".repeat(40)
      const markerPath = path.join(project.path, ".git", "opencorvus")
      await fs.writeFile(markerPath, legacyID, "utf8")
      Database.use((db) =>
        db
          .insert(ProjectTable)
          .values({
            id: legacyID,
            worktree: path.join(project.path, "legacy-project"),
            sandboxes: [],
            generation: randomUUID(),
          })
          .run(),
      )
      await Database.awaitEffectIdle(30_000)
      Database.close()

      let observed: unknown
      try {
        Database.Client()
      } catch (error) {
        observed = error
      }
      expect(DatabaseUnavailableError.isInstance(observed) ? observed.data : undefined).toMatchObject({
        code: "DATA_RESET_REQUIRED",
        operation: "Database.Client.dataIntegrity.compactProjectIdentity",
      })
      await Database.resetFiles(Database.Path())
      Database.Client()
      const discovered = await Project.fromDirectory(project.path)
      expect(discovered.project.id).toHaveLength(Identifier.MAX_LENGTH)
      expect(Identifier.isCanonical("project", discovered.project.id)).toBe(true)
      expect(await fs.readFile(markerPath, "utf8")).toBe(discovered.project.id)
      expect(
        Database.use((db) =>
          db.select({ id: ProjectTable.id }).from(ProjectTable).where(eq(ProjectTable.id, discovered.project.id)).get(),
        ),
      ).toEqual({ id: discovered.project.id })
      Database.close()
      expect(() => Database.Client()).not.toThrow()
    },
  })
}, 60_000)

test("closes continuation admission before the real completion checkpoint and imports only declared deliverables", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    init: InstanceBootstrap,
    fn: async () => {
      const task = await taskFixture(project.path)
      const childSessionID = Identifier.ascending("session")
      const origin = createDispatchLineageOrigin({
        taskID: task.taskID,
        orchestratorSessionID: task.sessionID,
        orchestratorMessageID: Identifier.ascending("message"),
        toolPartID: Identifier.ascending("part"),
        toolCallID: "call_committed_dispatch",
        targetAgentID: "base-developer",
        projectedWorkerIdentity: {
          agentID: "base-developer",
          baseRole: "build",
          sessionKind: "build",
          dispatchAdapterID: "build",
          runtimeTemplateABIVersion: 1,
          dispatchAdapterABIVersion: 1,
          projectionHash: "b".repeat(64),
        },
        workScope: { kind: "task" },
        workflowBinding: {
          kind: "direct",
          package_revision: {
            scope: "built_in",
            project_id: null,
            namespace: "builtin",
            id: task.packageRevision.id,
            version: task.packageRevision.version,
            package_digest: task.packageRevision.packageDigest,
          },
        },
        workflowNodeID: null,
        adapterInput: { request: "Publish one terminal result" },
      })
      const lineage = recordDispatchLineage({ origin, childSessionID })
      recordDispatchSettlement({
        taskID: task.taskID,
        dispatchID: lineage.dispatchID,
        outcome: DispatchOutcome.terminal({
          sessionID: childSessionID,
          finalMessageID: Identifier.ascending("message"),
        }),
      })
      expect(Database.use((db) => assertTaskDispatchesSettledInTransaction(db, task.taskID))).toBeUndefined()
      const canonical = await publishExpertArtifact({
        scope: task.scope,
        artifact: {
          artifact_type: "base/canonical-terminal-result",
          schema_version: 1,
          label: "Canonical terminal result",
          payload: { authority: "completion-decision" },
          resources: [],
          source_artifact_locators: [],
          idempotent: true,
        },
      })
      const canonicalSupplement = await publishExpertArtifact({
        scope: task.scope,
        artifact: {
          artifact_type: "base/canonical-terminal-supplement",
          schema_version: 1,
          label: "Canonical terminal supplement",
          payload: { authority: "completion-decision-supplement" },
          resources: [],
          source_artifact_locators: [],
          idempotent: true,
        },
      })
      const incidental = await publishExpertArtifact({
        scope: task.scope,
        artifact: {
          artifact_type: "base/incidental-terminal-candidate",
          schema_version: 1,
          label: "Incidental terminal candidate",
          payload: { authority: "not-delivered" },
          resources: [],
          source_artifact_locators: [],
          idempotent: true,
        },
      })
      const lateOrigin = createDispatchLineageOrigin({
        ...origin,
        dispatchID: undefined,
        toolPartID: Identifier.ascending("part"),
        toolCallID: "call_late_dispatch",
      })
      let lateDispatch: unknown
      const userMessage = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: task.sessionID,
        role: "user",
        author: "orchestrator",
        time: { created: Date.now() },
        agent: "orchestrator",
        model: { providerID: "test", modelID: "completion-closure" },
      })
      const assistantMessage = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: task.sessionID,
        parentID: userMessage.id,
        role: "assistant",
        author: "orchestrator",
        time: { created: Date.now() },
        agent: "orchestrator",
        providerID: "test",
        modelID: "completion-closure",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      const completionCallID = "call_complete_terminal_artifact_closure"
      const completionPart = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: task.sessionID,
        messageID: assistantMessage.id,
        type: "tool",
        callID: completionCallID,
        tool: "complete_task",
        state: { status: "running", input: {}, time: { start: Date.now() } },
      })
      const originalPrepare = EngineGit.prepare.bind(EngineGit)
      using _checkpointRace = spyOn(EngineGit, "prepare").mockImplementation(async (row) => {
        try {
          recordDispatchLineage({ origin: lateOrigin, childSessionID: Identifier.ascending("session") })
        } catch (error) {
          lateDispatch = error
        }
        return await originalPrepare(row)
      })
      const lifecycleTools = createTaskLifecycleTools({
        taskID: task.taskID,
        workflowProjection: { packageRevision: task.packageRevision, virtualWorkflows: {} },
        requireExecutionContext: async () => ({
          orchestratorSessionID: task.sessionID,
          orchestratorMessageID: assistantMessage.id,
          toolCallID: completionCallID,
          toolPartID: completionPart.id,
          visibleToolName: "complete_task",
        }),
      })
      // The model-facing boundary names revisions only; digests are Host-derived.
      const namedLocators = [canonical.locator, canonicalSupplement.locator].map(
        ({ expected_sha256: _digest, ...named }) => named,
      )
      const { expected_sha256: _incidentalDigest, ...namedIncidental } = incidental.locator
      const completion = await (lifecycleTools.complete_task.execute as any)(
        {
          summary: "Freeze one exact terminal deliverable",
          evidence_locators: namedLocators,
          deliverable_artifact_locators: namedLocators,
          accepted_delivery_slice_revision_ids: [],
          workflow_id: null,
        },
        { toolCallId: completionCallID, messages: [] },
      )
      expect(completion).toMatchObject({ title: "Task Completed" })
      expect(lateDispatch).toMatchObject({
        name: TaskCompletionClosureConflictError.name,
        code: "TASK_COMPLETION_CLOSURE_CONFLICT",
        taskID: task.taskID,
      })
      const terminalTask = requireTask(task.taskID)
      const decision = findTaskCompletionDecisionForTerminalTime({
        taskID: task.taskID,
        timeCompleted: terminalTask.time_completed!,
      })!
      expect(Database.use((db) => taskCompletionClosureInTransaction(db, task.taskID))).toBeUndefined()
      expect(decision.payload.deliverable_artifact_locators).toEqual([canonical.locator, canonicalSupplement.locator])
      expect(listDispatchLineage(task.taskID).map((item) => item.dispatchID)).toEqual([lineage.dispatchID])
      const terminalGit = structuredClone((terminalTask.metadata as Record<string, any>).git)

      const importer = {
        missionID: task.missionID,
        sessionID: task.missionSessionID,
        messageID: Identifier.ascending("message"),
        toolCallID: "call_import_terminal_artifact_closure",
      }
      const hostExpandedImports = resolveCrossTaskArtifactSources({
        sources: [{ authority: "completion_decision", source_task_id: task.taskID }],
        projectID: Instance.project.id,
        importer,
      })
      expect(
        sameCrossTaskArtifactImportSet(importsFromResolvedCrossTaskArtifactSources(hostExpandedImports), [
          { source_task_id: task.taskID, locator: canonical.locator },
          { source_task_id: task.taskID, locator: canonicalSupplement.locator },
        ]),
      ).toBe(true)
      const importedTarget = await taskFixture(project.path)
      const preparedCommittedImports = await prepareCrossTaskArtifactSourceImports({
        resolved: hostExpandedImports,
        projectID: Instance.project.id,
        targetProjectDirectory: project.path,
        targetTaskID: importedTarget.taskID,
        importer,
      })
      Database.transaction((db) =>
        persistPreparedCrossTaskArtifactImports(db, {
          targetTaskID: importedTarget.taskID,
          prepared: preparedCommittedImports.imports,
          authorities: preparedCommittedImports.authorities,
          timeCreated: Date.now(),
        }),
      )
      expect(
        sameCrossTaskArtifactImportSet(
          listCrossTaskArtifactImportMappings(importedTarget.taskID).map((mapping) => ({
            source_task_id: mapping.source_task_id,
            locator: mapping.source_locator,
          })),
          importsFromResolvedCrossTaskArtifactSources(hostExpandedImports),
        ),
      ).toBe(true)
      const preparedCanonicalImport = await prepareCrossTaskArtifactSourceImports({
        resolved: hostExpandedImports,
        projectID: Instance.project.id,
        targetProjectDirectory: project.path,
        targetTaskID: Identifier.ascending("task"),
        importer,
      })
      expect(preparedCanonicalImport.imports).toHaveLength(2)
      let incidentalImport: unknown
      try {
        await prepareCrossTaskArtifactImports({
          imports: [{ source_task_id: task.taskID, locator: incidental.locator }],
          projectID: Instance.project.id,
          targetProjectDirectory: project.path,
          targetTaskID: Identifier.ascending("task"),
          importer,
        })
      } catch (error) {
        incidentalImport = error
      }
      expect(incidentalImport).toMatchObject({
        name: CrossTaskArtifactDeliveryAuthorityError.name,
        code: "CROSS_TASK_ARTIFACT_DELIVERY_AUTHORITY_REQUIRED",
        sourceTaskID: task.taskID,
        requestedLocator: incidental.locator,
        allowedLocators: [decision.locator, canonical.locator, canonicalSupplement.locator],
      })

      _checkpointRace.mockRestore()
      Database.transaction((db) =>
        openTaskForContinuationInTransaction({
          db,
          taskID: task.taskID,
          now: Date.now(),
        }),
      )
      const reopenedTask = requireTask(task.taskID)
      expect({
        completionClosure: Database.use((db) => taskCompletionClosureInTransaction(db, task.taskID)),
        git: (reopenedTask.metadata as Record<string, any>).git,
      }).toEqual({ completionClosure: undefined, git: terminalGit })
      const continuationBaseline = await EngineGit.prepare(reopenedTask)
      const continuationGit = (continuationBaseline.task.metadata as Record<string, any>).git
      expect({
        error: "error" in continuationBaseline ? continuationBaseline.error : undefined,
        baselineMode: continuationGit?.baseline?.mode,
        priorResultMode: continuationGit?.result_history?.at(-1)?.mode,
      }).toEqual({ error: undefined, baselineMode: "recorded_head", priorResultMode: "recorded_head" })
      const reopenedLineage = recordDispatchLineage({
        origin: lateOrigin,
        childSessionID: Identifier.ascending("session"),
      })
      recordDispatchSettlement({
        taskID: task.taskID,
        dispatchID: reopenedLineage.dispatchID,
        outcome: DispatchOutcome.terminal({
          sessionID: reopenedLineage.payload.child_session_id,
          finalMessageID: Identifier.ascending("message"),
        }),
      })

      let stalePreparedImport: unknown
      try {
        Database.transaction((db) =>
          persistPreparedCrossTaskArtifactImports(db, {
            targetTaskID: Identifier.ascending("task"),
            prepared: preparedCanonicalImport.imports,
            authorities: preparedCanonicalImport.authorities,
            timeCreated: Date.now(),
          }),
        )
      } catch (error) {
        stalePreparedImport = error
      }
      expect(stalePreparedImport).toMatchObject({
        name: CrossTaskArtifactDeliveryAuthorityError.name,
        code: "CROSS_TASK_ARTIFACT_DELIVERY_AUTHORITY_REQUIRED",
        sourceTaskID: task.taskID,
        requestedLocator: null,
      })
      const retryUserMessage = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: task.sessionID,
        role: "user",
        author: "orchestrator",
        time: { created: Date.now() },
        agent: "orchestrator",
        model: { providerID: "test", modelID: "completion-closure-retry" },
      })
      const retryAssistantMessage = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: task.sessionID,
        parentID: retryUserMessage.id,
        role: "assistant",
        author: "orchestrator",
        time: { created: Date.now() },
        agent: "orchestrator",
        providerID: "test",
        modelID: "completion-closure-retry",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      const retryCallID = "call_complete_terminal_artifact_retry"
      const retryPart = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: task.sessionID,
        messageID: retryAssistantMessage.id,
        type: "tool",
        callID: retryCallID,
        tool: "complete_task",
        state: { status: "running", input: {}, time: { start: Date.now() } },
      })
      const retryTools = createTaskLifecycleTools({
        taskID: task.taskID,
        workflowProjection: { packageRevision: task.packageRevision, virtualWorkflows: {} },
        requireExecutionContext: async () => ({
          orchestratorSessionID: task.sessionID,
          orchestratorMessageID: retryAssistantMessage.id,
          toolCallID: retryCallID,
          toolPartID: retryPart.id,
          visibleToolName: "complete_task",
        }),
      })
      expect(
        await (retryTools.complete_task.execute as any)(
          {
            summary: "Complete the reopened Task with the same canonical deliverable",
            evidence_locators: [...namedLocators, namedIncidental],
            deliverable_artifact_locators: [...namedLocators, namedIncidental],
            accepted_delivery_slice_revision_ids: [],
            workflow_id: null,
          },
          { toolCallId: retryCallID, messages: [] },
        ),
      ).toMatchObject({ title: "Task Completed" })
      const retriedTask = requireTask(task.taskID)
      const retryDecision = findTaskCompletionDecisionForTerminalTime({
        taskID: task.taskID,
        timeCompleted: retriedTask.time_completed!,
      })
      expect(retryDecision?.id).not.toBe(decision.id)
      let staleResolvedImport: unknown
      try {
        await prepareCrossTaskArtifactSourceImports({
          resolved: hostExpandedImports,
          projectID: Instance.project.id,
          targetProjectDirectory: project.path,
          targetTaskID: Identifier.ascending("task"),
          importer,
        })
      } catch (error) {
        staleResolvedImport = error
      }
      expect(staleResolvedImport).toMatchObject({
        name: CrossTaskArtifactDeliveryAuthorityError.name,
        code: "CROSS_TASK_ARTIFACT_DELIVERY_AUTHORITY_REQUIRED",
        sourceTaskID: task.taskID,
      })
      expect(listDispatchLineage(task.taskID).map((item) => item.dispatchID)).toEqual([
        lineage.dispatchID,
        reopenedLineage.dispatchID,
      ])
    },
  })
}, 60_000)

test("projects exact referenced cross-Task resources through frozen Catalog membership", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const sourceFiles = Array.from({ length: 32 }, (_, index) => ({
        path: `cross-task-catalog/resource-${String(index).padStart(2, "0")}.md`,
        mediaType: "text/markdown",
        text: `resource ${index}\n`,
      }))
      await Promise.all(
        sourceFiles.map(async (file) => {
          const target = path.join(project.path, ...file.path.split("/"))
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.writeFile(target, file.text, "utf8")
        }),
      )
      const source = await taskFixture(project.path)
      const sourcePublication = await publishTaskArtifactProjectFiles({
        scope: source.scope,
        source: { kind: "current_task_project" },
        files: sourceFiles.map(({ path: filePath, mediaType }) => ({ path: filePath, mediaType })),
      })
      const declaredSourceResources = sourcePublication.artifacts.slice(0, 30)
      const sourceArtifact = await publishExpertArtifact({
        scope: source.scope,
        artifact: {
          artifact_type: "base/cross-task-resource-set",
          schema_version: 1,
          label: "Cross-Task resource set",
          payload: { resource_count: declaredSourceResources.length },
          resources: declaredSourceResources,
          source_artifact_locators: [],
          idempotent: true,
        },
      })
      await completeFixtureTask(source, project.path, [sourceArtifact.locator], "cross-task-resource-source")

      const importer = {
        missionID: source.missionID,
        sessionID: source.missionSessionID,
        messageID: Identifier.ascending("message"),
        toolCallID: "call_import_cross_task_resource_catalog",
      }
      const resolved = resolveCrossTaskArtifactSources({
        sources: [{ authority: "completion_decision", source_task_id: source.taskID }],
        projectID: Instance.project.id,
        importer,
      })
      const target = await taskFixture(project.path)
      const prepared = await prepareCrossTaskArtifactSourceImports({
        resolved,
        projectID: Instance.project.id,
        targetProjectDirectory: project.path,
        targetTaskID: target.taskID,
        importer,
      })
      Database.transaction((db) =>
        persistPreparedCrossTaskArtifactImports(db, {
          targetTaskID: target.taskID,
          prepared: prepared.imports,
          authorities: prepared.authorities,
          timeCreated: Date.now(),
        }),
      )
      const importedResources = prepared.imports.flatMap((item) => item.importedEnvelope.resources)
      expect(importedResources).toHaveLength(30)

      await publishImportedTaskArtifactResources({
        sourceAuthority: {
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID: source.taskID,
        },
        targetProjectID: Instance.project.id,
        targetProjectDirectory: project.path,
        targetTaskID: target.taskID,
        producer: {
          owner_kind: "mission",
          mission_id: importer.missionID,
          session_id: importer.sessionID,
          message_id: importer.messageID,
          tool_call_id: "call_prepare_unreferenced_cross_task_resource",
        },
        resources: [sourcePublication.artifacts[31]!],
      })

      const authority = artifactCatalogAuthority(target.taskID)
      const search = {
        sources: ["task_artifact" as const],
        kinds: ["task_artifact_resource" as const],
        version_scope: "current" as const,
        sort: "oldest" as const,
        limit: 7,
      }
      const first = await searchTaskArtifacts({ authority, search })
      expect(first).toMatchObject({ filtered_total: 30, catalog_complete: true })
      expect(first.entries).toHaveLength(7)
      expect(first.next_cursor).toEqual(expect.any(String))

      updateEngineArtifact({
        id: prepared.imports[0]!.importedArtifactID,
        payload: { ...prepared.imports[0]!.importedEnvelope, resources: [] },
      })

      const extraPublication = await publishImportedTaskArtifactResources({
        sourceAuthority: {
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID: source.taskID,
        },
        targetProjectID: Instance.project.id,
        targetProjectDirectory: project.path,
        targetTaskID: target.taskID,
        producer: {
          owner_kind: "mission",
          mission_id: importer.missionID,
          session_id: importer.sessionID,
          message_id: importer.messageID,
          tool_call_id: "call_prepare_later_cross_task_resource",
        },
        resources: [sourcePublication.artifacts[30]!],
      })
      await publishExpertArtifact({
        scope: target.scope,
        artifact: {
          artifact_type: "base/later-cross-task-resource",
          schema_version: 1,
          label: "Later cross-Task resource",
          payload: { resource_count: 1 },
          resources: extraPublication.artifacts,
          source_artifact_locators: [],
          idempotent: true,
        },
      })

      const frozenEntries = [...first.entries]
      let cursor = first.next_cursor
      while (cursor) {
        const page = await searchTaskArtifacts({ authority, search: { ...search, cursor } })
        expect(page.filtered_total).toBe(30)
        frozenEntries.push(...page.entries)
        cursor = page.next_cursor
      }
      const frozenRefs = frozenEntries.map((entry) => {
        if (entry.locator.source !== "task_artifact_resource") {
          throw new Error("Referenced Engine resource projected a non-resource locator")
        }
        return entry.locator.ref
      })
      expect(frozenRefs).toEqual(importedResources)

      const exact = await readTaskArtifact({
        authority,
        read: {
          locator: { source: "task_artifact_resource", ref: frozenRefs[0]! },
          byte_offset: 0,
          max_bytes: 65_536,
          delivery: "inline",
        },
      })
      expect(exact.chunk).toMatchObject({
        complete: true,
        total_bytes: Buffer.byteLength(sourceFiles[0]!.text),
        sha256: frozenRefs[0]!.sha256,
        text: sourceFiles[0]!.text,
      })

      const refreshed = await searchTaskArtifacts({
        authority,
        search: { ...search, limit: 100 },
      })
      expect(refreshed).toMatchObject({ filtered_total: 1, next_cursor: null })
      const refreshedRefs = refreshed.entries.map((entry) => {
        if (entry.locator.source !== "task_artifact_resource") {
          throw new Error("Referenced Engine resource projected a non-resource locator")
        }
        return entry.locator.ref
      })
      expect(refreshedRefs).toEqual(extraPublication.artifacts)

      const allAfterRevision = await searchTaskArtifacts({
        authority,
        search: { ...search, version_scope: "all", limit: 100 },
      })
      expect(allAfterRevision.entries.map((entry) => entry.locator)).toEqual(
        [...importedResources, extraPublication.artifacts[0]!].map((ref) => ({
          source: "task_artifact_resource",
          ref,
        })),
      )
      const historicalAfterRevision = await searchTaskArtifacts({
        authority,
        search: { ...search, version_scope: "historical", limit: 100 },
      })
      expect(historicalAfterRevision.entries.map((entry) => entry.locator)).toEqual(
        importedResources.map((ref) => ({ source: "task_artifact_resource", ref })),
      )

      await fs.rm(
        path.join(
          ProjectRuntimePaths.taskArtifactSnapshotRoot(
            project.path,
            target.taskID,
            extraPublication.snapshot.snapshot_id,
          ),
          "manifest.json",
        ),
      )
      const incomplete = await searchTaskArtifacts({
        authority,
        search: { ...search, limit: 100 },
      })
      expect(incomplete).toMatchObject({
        catalog_complete: false,
        provider_errors: [
          {
            source: "task_artifact",
            message: expect.any(String),
          },
        ],
        resolution: {
          status: "incomplete_catalog",
          limitations: ["provider_error"],
        },
      })
    },
  })
}, 60_000)

test("admits a successor completion owner after the immutable activation lease expires", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const task = await taskFixture(project.path)
      const firstOwnerID = "complete-task:expired-owner"
      const now = Date.now()
      Database.transaction((db) =>
        acquireTaskCompletionClosureInTransaction(db, {
          taskID: task.taskID,
          ownerID: firstOwnerID,
          orchestratorSessionID: task.sessionID,
          orchestratorMessageID: Identifier.ascending("message"),
          toolCallID: "call_abandoned_completion",
          toolPartID: Identifier.ascending("part"),
          timeAcquired: now - 130_000,
        }),
      )

      const recoveredOwner = Database.transaction((db) =>
        acquireTaskCompletionClosureInTransaction(db, {
          taskID: task.taskID,
          ownerID: "complete-task:recovered-owner",
          orchestratorSessionID: task.sessionID,
          orchestratorMessageID: Identifier.ascending("message"),
          toolCallID: "call_recovered_completion",
          toolPartID: Identifier.ascending("part"),
          timeAcquired: now,
        }),
      )
      expect(recoveredOwner).toMatchObject({
        owner_id: "complete-task:recovered-owner",
        activation_id: expect.any(String),
        expires_at: now + 120_000,
      })
    },
  })
}, 60_000)

test("keeps an empty completed-source delivery authority through target preparation", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const source = await taskFixture(project.path)
      expect(await completeFixtureTask(source, project.path, [], "empty_delivery")).toMatchObject({
        title: "Task Completed",
      })
      const importer = {
        missionID: source.missionID,
        sessionID: source.missionSessionID,
        messageID: Identifier.ascending("message"),
        toolCallID: "call_import_empty_delivery",
      }
      const resolved = resolveCrossTaskArtifactSources({
        sources: [{ authority: "completion_decision", source_task_id: source.taskID }],
        projectID: Instance.project.id,
        importer,
      })
      expect({ imports: resolved.imports.length, authorities: resolved.authorities.length }).toEqual({
        imports: 0,
        authorities: 1,
      })
      const target = await taskFixture(project.path)
      const prepared = await prepareCrossTaskArtifactSourceImports({
        resolved,
        projectID: Instance.project.id,
        targetProjectDirectory: project.path,
        targetTaskID: target.taskID,
        importer,
      })
      expect({ imports: prepared.imports.length, authorities: prepared.authorities.length }).toEqual({
        imports: 0,
        authorities: 1,
      })
      Database.transaction((db) =>
        openTaskForContinuationInTransaction({
          db,
          taskID: source.taskID,
          now: Date.now(),
        }),
      )
      let staleEmptyAuthority: unknown
      try {
        await prepareCrossTaskArtifactSourceImports({
          resolved,
          projectID: Instance.project.id,
          targetProjectDirectory: project.path,
          targetTaskID: Identifier.ascending("task"),
          importer,
        })
      } catch (error) {
        staleEmptyAuthority = error
      }
      expect(staleEmptyAuthority).toMatchObject({
        name: CrossTaskArtifactDeliveryAuthorityError.name,
        code: "CROSS_TASK_ARTIFACT_DELIVERY_AUTHORITY_REQUIRED",
        sourceTaskID: source.taskID,
        requestedLocator: null,
      })

      let stalePreparedEmptyAuthority: unknown
      try {
        Database.transaction((db) =>
          persistPreparedCrossTaskArtifactImports(db, {
            targetTaskID: target.taskID,
            prepared: prepared.imports,
            authorities: prepared.authorities,
            timeCreated: Date.now(),
          }),
        )
      } catch (error) {
        stalePreparedEmptyAuthority = error
      }
      expect(stalePreparedEmptyAuthority).toMatchObject({
        name: CrossTaskArtifactDeliveryAuthorityError.name,
        code: "CROSS_TASK_ARTIFACT_DELIVERY_AUTHORITY_REQUIRED",
        sourceTaskID: source.taskID,
        requestedLocator: null,
      })
    },
  })
}, 60_000)

test("imports an exact Artifact from a failed same-Mission Task under its terminal lifecycle authority", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const task = await taskFixture(project.path)
      const diagnostic = await publishExpertArtifact({
        scope: task.scope,
        artifact: {
          artifact_type: "base/failed-task-diagnostic",
          schema_version: 1,
          label: "Failed Task diagnostic",
          payload: { cause: "durable failure evidence" },
          resources: [],
          source_artifact_locators: [],
          idempotent: true,
        },
      })
      await terminalTask(
        requireTask(task.taskID),
        {
          status: "failed",
          error: "fixture failure with importable evidence",
        },
        "Failed Task retained exact recovery evidence",
        { preExecutionInfrastructureFailure: true, terminalAt: Date.now() },
      )

      const target = await taskFixture(project.path)
      const terminalEvidenceImports = resolveCrossTaskArtifactSources({
        sources: [
          {
            authority: "terminal_lifecycle",
            source_task_id: task.taskID,
            locator: diagnostic.locator,
          },
        ],
        projectID: Instance.project.id,
        importer: {
          missionID: task.missionID,
          sessionID: task.missionSessionID,
        },
      })
      const prepared = await prepareCrossTaskArtifactSourceImports({
        resolved: terminalEvidenceImports,
        projectID: Instance.project.id,
        targetProjectDirectory: project.path,
        targetTaskID: target.taskID,
        importer: {
          missionID: task.missionID,
          sessionID: task.missionSessionID,
          messageID: Identifier.ascending("message"),
          toolCallID: "call_import_failed_task_diagnostic",
        },
      })
      Database.transaction((db) =>
        persistPreparedCrossTaskArtifactImports(db, {
          targetTaskID: target.taskID,
          prepared: prepared.imports,
          authorities: prepared.authorities,
          timeCreated: Date.now(),
        }),
      )
      expect(listCrossTaskArtifactImportMappings(target.taskID)).toMatchObject([
        {
          source_task_id: task.taskID,
          source_locator: diagnostic.locator,
          imported_locator: { artifact_id: prepared.imports[0]!.importedArtifactID },
        },
      ])
      // Evolution predecessor correlation resolves an imported pair purely from
      // import_lineage, so a failed source Task must retain the same lineage
      // facts a completed source provides.
      expect(prepared.imports[0]!.importedEnvelope).toMatchObject({
        import_lineage: {
          source_task_id: task.taskID,
          source_locator: diagnostic.locator,
          source_producer: { owner_kind: "projected-worker" },
          source_provenance: { source_artifact_locators: [] },
        },
      })
    },
  })
}, 60_000)
