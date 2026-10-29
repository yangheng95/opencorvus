import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"
import type { LanguageModelV3CallOptions, LanguageModelV3StreamResult } from "@ai-sdk/provider"
import fs from "node:fs/promises"
import path from "node:path"
import { hostGit as git } from "@/util/git"
import z from "zod"
import { Provider } from "@/provider/provider"
import type { Provider as ProviderType } from "@/provider/provider"
import { SessionProcessor } from "@/session/processor"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { Session } from "@/session"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { createBuildTool, type BuildToolDependencies } from "@/orchestrator/build-tool"
import type { DispatchAdapterExecutionContext } from "@/orchestrator/dispatch-adapter-execution-context"
import { selectedWorkflowBinding } from "@/engine/workflow-binding"
import { recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { createDispatchLineageOrigin } from "@/engine/dispatch-lineage"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { describeTask } from "@/engine/describe"
import { EngineArtifactTable, EngineTaskTable } from "@/engine/engine.sql"
import { Database, DatabaseUnavailableError, and, eq } from "@/storage/db"
import { recordEngineArtifact } from "@/engine/artifact"
import { buildObservationRefName } from "@/engine/build-observation-ref"
import { pinBuildObservationTree } from "@/build/agent"
import { recordTaskInfrastructureError, recordTaskLevelBuildHostObservation } from "@/engine/persist"
import { buildTerminalFactObservationID } from "@/build/terminal-fact-publication"
import {
  buildObservationCleanupRowsForTask,
  beginBuildObservationCleanup,
  reconcileBuildObservationCleanups,
  resolveBuildObservationGitDir,
  settleBuildObservationCleanup,
} from "@/engine/build-observation-cleanup"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { EngineService } from "@/task-api"
import { writeTaskUpdateInTransaction } from "@/engine/state"
import { findArtifact, findTask, viewBuildHostObservationArtifact } from "@/engine/store"
import { readBuildObservationContentRange } from "@/engine/build-observation-content"
import { listPendingAgentCoordinationRequests } from "@/engine/agent-coordination"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import { deleteProject, ProjectDeleteTestHooks } from "@/project/delete"
import { Project } from "@/project/project"
import { AttachmentStore } from "@/storage/attachment-store"
import { projectIntentAnalysisInput } from "@/intent-analysis/input-projection"
import { projectRequirementsInput } from "@/requirements/input-projection"
import { projectArchitectInput } from "@/architect/input-projection"
import { taskInputAttachmentRefs } from "@/agent/prompt-projection"
import { EvolutionMutationReceiptIdentityConflictError } from "@/expert-squad/mutation-receipt-validation"

const modelRef = { providerID: "test", modelID: "build-terminal-publication" }
let restoreHelperLanguage: (() => void) | undefined
let physicalBuildStream: ((options: LanguageModelV3CallOptions) => LanguageModelV3StreamResult) | undefined

beforeEach(() => {
  const language = spyOn(Provider, "getLanguage").mockResolvedValue(
    new MockLanguageModelV3({
      provider: modelRef.providerID,
      modelId: modelRef.modelID,
      async doStream(options): Promise<LanguageModelV3StreamResult> {
        if (physicalBuildStream && options.tools?.some((entry) => entry.name === "request_orchestrator_decision")) {
          return physicalBuildStream(options)
        }
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: "stream-start", warnings: [] },
              { type: "text-start", id: "helper" },
              { type: "text-delta", id: "helper", delta: "Local helper completed." },
              { type: "text-end", id: "helper" },
              {
                type: "finish",
                finishReason: { unified: "stop", raw: "stop" },
                usage: {
                  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 1, text: 1, reasoning: 0 },
                },
              },
            ],
          }),
        }
      },
    }),
  )
  restoreHelperLanguage = () => language.mockRestore()
})

for (const family of ["build", "partial", "cleanup", "evolution"] as const) {
  test(family === "evolution" ? "the current writer reports the typed error for an invalid legacy mutation receipt" : `startup reports the typed migration contract for legacy ${family} terminal identity`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        using _spies = await installPhysicalBuildSpies()
        const fixture = await createProductionFixture(project.path, `Legacy ${family} identity`)
        const id = `art_${family === "evolution" ? "evolution_mutation" : "build_terminal"}_${"a".repeat(64)}`
        if (family === "build" || family === "cleanup") {
          beginBuildObservationCleanup({
            observationID: id,
            taskID: fixture.taskID,
            gitDir: await resolveBuildObservationGitDir(project.path),
            activate: false,
          })
          if (family === "build")
            recordTaskLevelBuildHostObservation({
            id,
            taskID: fixture.taskID,
            executionMode: "current_project",
            diffs: [],
          })
        } else if (family === "partial") {
          recordTaskInfrastructureError({
            id,
            taskID: fixture.taskID,
            component: "build-host-observation",
            operation: "collect-git-workspace",
            reason: "legacy partial observation",
            context: { observation_id: id },
          })
        } else {
          const error = (() => {
            try {
              recordEngineArtifact({
                id,
                taskID: fixture.taskID,
                kind: "expert_output",
                label: "evolution-lab/promotion-receipt",
                payload: {
                  artifact_type: "evolution-lab/promotion-receipt",
                  schema_version: 1,
                  producer: { owner_kind: "core", component_id: "expert-squad-package-manager", operation_id: "legacy" },
                  payload: {},
                  resources: [],
                  observed_artifact_locators: [],
                  source_artifact_locators: [],
                },
              })
            } catch (error) {
              return error
            }
          })()
          expect(error).toBeInstanceOf(EvolutionMutationReceiptIdentityConflictError)
          expect(error).toMatchObject({ data: { artifactID: id } })
          return
        }
        await Database.awaitEffectIdle(30_000)
        Database.close()
        let observed: unknown
        try {
          Database.Client()
        } catch (error) {
          observed = error
        }
        expect(DatabaseUnavailableError.isInstance(observed) ? observed.data : undefined).toMatchObject({
          code: "DATA_MIGRATION_REQUIRED",
          operation: "Database.Client.dataIntegrity.compactTerminalArtifactIdentity",
          message: expect.stringContaining(id),
        })
        await Database.resetFiles(Database.Path())
        Database.Client()
      },
    })
  }, 60_000)
}

function providerModel(): ProviderType.Model {
  return {
    id: modelRef.modelID,
    providerID: modelRef.providerID,
    name: "Build terminal publication",
    api: { id: modelRef.modelID, npm: "@ai-sdk/anthropic", url: "https://build.test.invalid" },
    status: "active",
    headers: {},
    options: {},
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 100_000, input: 90_000, output: 4_096 },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      interleaved: false,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
    },
    release_date: "2026-08-13",
  } as ProviderType.Model
}

afterEach(async () => {
  try {
    await Instance.disposeAll()
    await resetMemoryDatabase()
  } finally {
    restoreHelperLanguage?.()
    restoreHelperLanguage = undefined
    physicalBuildStream = undefined
  }
})

async function createProductionFixture(
  projectPath: string,
  title: string,
  agentID = "base-planner",
  attachments: Array<{
    sha: string
    url: string
    mime: string
    size: number
    filename?: string
    intent: "task_input"
    source: "user-upload"
  }> = [],
) {
  await Config.updateProjectPatch({
    prompt_profile: { active: "base" },
    model: `${modelRef.providerID}/${modelRef.modelID}`,
    provider: {
      [modelRef.providerID]: {
        npm: providerModel().api.npm,
        api: providerModel().api.url,
        options: { apiKey: "owned-build-test-participant" },
        models: { [modelRef.modelID]: { name: providerModel().name, limit: providerModel().limit } },
      },
    },
  })
  const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
    prompt_profile: { active: "base" },
    model: `${modelRef.providerID}/${modelRef.modelID}`,
  })
  const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
    projectDirectory: projectPath,
    config,
  })
  const skillProjection = await PromptProfileResolver.resolveSkillProjection({
    projectDirectory: projectPath,
    config,
    packageRevision,
  })
  const projectedAgent = skillProjection.projectedAgents.find((candidate) => candidate.identity.agentID === agentID)
  if (!projectedAgent) throw new Error(`Base package did not project ${agentID}`)
  const workflow = selectedWorkflowBinding({
    projection: { packageRevision, virtualWorkflows: projectedAgent.virtualWorkflows },
    workflowID: "planner-parallel-delivery",
  })
  if (workflow.kind !== "virtual_workflow") throw new Error("Expected Base planner-parallel-delivery workflow")
  const taskID = Identifier.ascending("task")
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title,
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  const now = Date.now()
  persistTask({
    taskID,
    rootSession: root,
    now,
    title,
    request: "Produce one durable Build terminal fact",
    productPillar: "code",
    source: "test",
    priority: "normal",
    metadata: { actor: "user" },
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: projectPath,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
    attachments,
  })
  const dispatchID = Identifier.ascending("artifact")
  const childSessionID = Identifier.deterministic("session", `build-terminal-fact\0${dispatchID}`)
  const turn = {
    kind: "initial" as const,
    current_dispatch_id: dispatchID,
    workflow_binding: workflow,
    workflow_node_id: agentID,
    workflow_occurrence_id: dispatchID,
    delivery_slice_revision_ids: [],
    evidence_locators: [],
    task_authority: {
      task_id: taskID,
      root_session_id: root.id,
      request_sha256: taskRequestSHA256("Produce one durable Build terminal fact"),
      initial_control_text_parts: [],
    },
  }
  const lineage = recordTestDispatchLineage({
    origin: createDispatchLineageOrigin({
      dispatchID,
      taskID,
      orchestratorSessionID: root.id,
      orchestratorMessageID: Identifier.ascending("message"),
      toolPartID: Identifier.ascending("part"),
      toolCallID: Identifier.ascending("call"),
      targetAgentID: projectedAgent.identity.agentID,
      projectedWorkerIdentity: projectedAgent.identity,
      workScope: { kind: "task" },
      workflowBinding: workflow,
      workflowNodeID: agentID,
      adapterInput: { goal_ids: [], reason: "Publish terminal fact" },
    }),
    childSessionID,
  })
  const dispatchSignal = new AbortController().signal
  const context: DispatchAdapterExecutionContext = {
    agentID: projectedAgent.identity.agentID,
    projectedAgent,
    workScope: { kind: "task" },
    newSessionID: childSessionID,
    dispatch: {
      dispatchID,
      deliverySliceRevisionIDs: [],
      newSessionID: childSessionID,
      turn,
      adapterInput: { goal_ids: [], reason: "Publish terminal fact" },
      signal: dispatchSignal,
      observeSession() {},
      commitSession(sessionID, descriptor) {
        if (sessionID !== childSessionID || descriptor.payload.dispatchTurn?.current_dispatch_id !== dispatchID) {
          throw new Error(`Build fixture dispatch authority drift for ${dispatchID}`)
        }
        return { artifactID: lineage.artifactID }
      },
      releaseAdmission() {},
    },
    signal: dispatchSignal,
    toolOptions: {},
  }
  return { taskID, root, dispatchID, context }
}

function terminalFacts(taskID: string) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.label, "git-workspace")))
      .all(),
  )
}

function completeTask(taskID: string) {
  const now = Date.now()
  Database.transaction((db) =>
    writeTaskUpdateInTransaction({
    db,
    taskID,
    values: { status: "completed" },
    summary: "Build terminal publication test completed",
    now,
    }),
  )
}

async function createTaskDeletionObservation(input: {
  projectPath: string
  taskID: string
  retained: boolean
  cleanupGitDir?: string
}) {
  const observationID = Identifier.ascending("artifact")
  beginBuildObservationCleanup({
    observationID,
    taskID: input.taskID,
    gitDir: input.cleanupGitDir ?? (await resolveBuildObservationGitDir(input.projectPath)),
    activate: false,
  })
  const baseRef = await pinBuildObservationTree({
    worktreeDir: input.projectPath,
    refName: buildObservationRefName(observationID, "base"),
  })
  const headRef = await pinBuildObservationTree({
    worktreeDir: input.projectPath,
    refName: buildObservationRefName(observationID, "head"),
  })
  if (input.retained) {
    recordTaskLevelBuildHostObservation({
      id: observationID,
      taskID: input.taskID,
      executionMode: "current_project",
      primaryBaseCommitRef: baseRef.slice(0, 12),
      primaryTerminalCommitRef: headRef.slice(0, 12),
      diffBaseRef: baseRef,
      diffHeadRef: headRef,
      diffs: [],
      observedArtifactLocators: [],
      sourceArtifactLocators: [],
      now: Date.now(),
    })
  }
  return observationID
}

async function executeProductionBuild(input: {
  fixture: Awaited<ReturnType<typeof createProductionFixture>>
  worktreeUsage?: "managed_worktree" | "current_project"
  recordSettlement?: boolean
  writer?: BuildToolDependencies["terminalFactWriter"]
  cleanup?: BuildToolDependencies["terminalFactCleanup"]
  provenance?: BuildToolDependencies["terminalFactProvenance"]
}) {
  const adapter = createBuildTool({
    inputSchema: z.object({
      goal_ids: z.array(z.string()),
      request: z.string().optional(),
      reason: z.string(),
      worktreeUsage: z.enum(["managed_worktree", "current_project"]).optional(),
    }),
    taskID: input.fixture.taskID,
    parentSessionID: input.fixture.root.id,
    buildAgentContextSections: () => [],
    terminalFactWriter: input.writer,
    terminalFactCleanup: input.cleanup,
    terminalFactProvenance: input.provenance,
  }).build
  if (!adapter.execute) throw new Error("Build adapter has no executor")
  const outcome = await adapter.execute(
    { goal_ids: [], reason: "Publish terminal fact", worktreeUsage: input.worktreeUsage ?? "current_project" },
    input.fixture.context as never,
  )
  if (input.recordSettlement !== false) {
    recordDispatchSettlement({
      taskID: input.fixture.taskID,
      dispatchID: input.fixture.dispatchID,
      outcome: outcome as never,
    })
  }
  return { outcome, workflow: (await describeTask(input.fixture.taskID)).dispatch_execution }
}

async function withBootstrappedProject<R>(directory: string, fn: () => R): Promise<Awaited<R>> {
  return await Instance.provide({ directory, init: InstanceBootstrap, fn })
}

async function installPhysicalBuildSpies(options?: { mockProvider?: boolean; realProcessor?: boolean }) {
  const provider =
    options?.mockProvider === false ? undefined : spyOn(Provider, "getModel").mockResolvedValue(providerModel())
  const ingressRunner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => {} })
  const processor = options?.realProcessor ? undefined : spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
    const assistant = input.assistantMessage
    return {
      message: assistant,
      partFromToolCall() {
        return undefined
      },
      async process() {
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: assistant.sessionID,
          messageID: assistant.id,
          type: "text",
          text: "physical Build completed",
        })
        assistant.finish = "stop"
        assistant.time.completed = Date.now()
        await Session.updateMessage(assistant)
        return "stop"
      },
    } as any
  })
  return {
    [Symbol.dispose]() {
      ingressRunner[Symbol.dispose]()
      processor?.mockRestore()
      provider?.mockRestore()
    },
  }
}

function coordinatingFileStream(contentForDirectory = (_directory: string) => "Saved before coordination\n") {
  const calls = new Map<string, number>()
  physicalBuildStream = () => {
    const directory = Instance.directory
    const step = (calls.get(directory) ?? 0) + 1
    calls.set(directory, step)
    if (step > 2) throw new Error("Expected the real coordination tool to drain this worker Turn")
    const toolName = step === 1 ? "write" : "request_orchestrator_decision"
    const input = step === 1
      ? { filePath: path.join(directory, "handoff.txt"), content: contentForDirectory(directory) }
      : {
          summary: "File saved; local commit awaits a decision",
          details: "The authorized file write is complete. Decide whether to commit it locally.",
          blocking: true,
          requested_decision: "Confirm the local commit",
          evidence_locators: [],
          severity: "blocked",
        }
    return {
      stream: simulateReadableStream({ chunks: [
        { type: "stream-start", warnings: [] },
        { type: "tool-call", toolCallId: Identifier.ascending("call"), toolName, input: JSON.stringify(input) },
        {
          type: "finish",
          finishReason: { unified: "tool-calls", raw: "tool_calls" },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
        },
      ] }),
    }
  }
  return calls
}

async function expectCoordinatedFile(input: {
  fixture: Awaited<ReturnType<typeof createProductionFixture>>
  content: string
  worktreeUsage: "current_project" | "managed_worktree"
}) {
  const { fixture, content } = input
  const facts = terminalFacts(fixture.taskID)
  expect(facts).toHaveLength(1)
  const fact = findArtifact({ taskID: fixture.taskID, artifactID: facts[0]!.id })!
  const observation = viewBuildHostObservationArtifact(fact)
  expect(observation).toMatchObject({
    task_id: fixture.taskID,
    execution_mode: input.worktreeUsage,
    session_id: fixture.context.newSessionID,
    diffs: expect.arrayContaining([{
      file: "handoff.txt", status: "added", is_binary: false, additions: 1, deletions: 0,
      before: null, after: expect.objectContaining({ bytes: Buffer.byteLength(content) }),
    }]),
  })
  const range = await readBuildObservationContentRange({
    taskID: fixture.taskID, artifactID: fact.id, file: "handoff.txt", side: "after", offset: 0, length: 1024,
  })
  expect(Buffer.from(range.bytes).toString()).toBe(content)
  expect(buildObservationCleanupRowsForTask(fixture.taskID)).toEqual([
    expect.objectContaining({ observation_id: fact.id, status: "retained" }),
  ])
  return fact.id
}

describe.serial("Build terminal-fact publication", () => {
  for (const worktreeUsage of ["current_project", "managed_worktree"] as const) {
    for (const publication of ["success", "retry", "writer_failure", "provenance_failure"] as const) {
    test(`physical coordination retains its required publication in ${worktreeUsage}/${publication}`, async () => {
      await using project = await memoryProject()
      await withBootstrappedProject(project.path, async () => {
        using _spies = await installPhysicalBuildSpies({ realProcessor: true })
        await Config.updateProjectPatch({ permission: { "*": "allow" } })
        const fixture = await createProductionFixture(project.path, "Coordinated file observation", "base-developer")
        const content = "Saved before coordination\n"
        const calls = coordinatingFileStream()
        const attempts: string[] = []
        const settled = await executeProductionBuild({
          fixture,
          worktreeUsage,
          ...(publication === "retry" || publication === "writer_failure" ? {
            writer(input, attempt) {
              attempts.push(input.observation.id)
              if (publication === "writer_failure" || attempt === 1) throw new Error("Coordinated publication unavailable")
              return { kind: "terminal_success", artifactID: recordTaskLevelBuildHostObservation(input.observation) }
            },
          } satisfies Partial<Parameters<typeof executeProductionBuild>[0]> : {}),
          ...(publication === "provenance_failure" ? {
            provenance() { throw new Error("Coordinated provenance unavailable") },
          } : {}),
        })
        const request = listPendingAgentCoordinationRequests(fixture.taskID)[0]!
        expect({ calls: [...calls.values()], request: request.payload.status }).toEqual({ calls: [2], request: "pending" })
        if (publication === "writer_failure" || publication === "provenance_failure") {
          expect(settled).toMatchObject({
            outcome: {
              kind: "partial",
              failed_operation: publication === "writer_failure" ? "persist-git-workspace" : "collect-git-workspace",
            },
            workflow: { dispatches: [{ settlement: { outcome_kind: "partial" } }] },
          })
          expect(buildObservationCleanupRowsForTask(fixture.taskID)).toEqual([
            expect.objectContaining({ status: "complete", attempts: 1 }),
          ])
          if (publication === "writer_failure") expect(attempts).toHaveLength(2)
          else expect(findArtifact({
            taskID: fixture.taskID,
            artifactID: buildTerminalFactObservationID({ taskID: fixture.taskID, dispatchID: fixture.dispatchID }),
          })).toMatchObject({ kind: "task-infrastructure-error", payload: { operation: "collect-git-workspace" } })
          return
        }
        expect({ outcome: settled.outcome, workflow: settled.workflow }).toMatchObject({
          outcome: {
            kind: "coordination",
            session_id: fixture.context.newSessionID,
            coordination_request: { source: "coordination_request", request_id: request.artifactID },
          },
          workflow: { dispatches: [{ settlement: { outcome_kind: "coordination" } }] },
        })
        const id = await expectCoordinatedFile({ fixture, content, worktreeUsage })
        if (publication === "retry") expect(attempts).toEqual([id, id])
      })
    }, 90_000)
    }
  }

  test("physical coordination keeps two concurrent Project file observations independently readable", async () => {
    await using first = await memoryProject("first-coordination-project")
    await using second = await memoryProject("second-coordination-project")
    using _provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
    const projects = [first, second]
    const contentFor = (directory: string) => `Saved by ${path.basename(directory)}\n`
    const calls = coordinatingFileStream(contentFor)
    const results = await Promise.all(projects.map((project) => withBootstrappedProject(project.path, async () => {
        using _spies = await installPhysicalBuildSpies({ realProcessor: true, mockProvider: false })
        await Config.updateProjectPatch({ permission: { "*": "allow" } })
        const fixture = await createProductionFixture(project.path, "Independent coordinated file", "base-developer")
        const settled = await executeProductionBuild({ fixture })
        expect(settled.outcome).toMatchObject({ kind: "coordination", session_id: fixture.context.newSessionID })
        const observationID = await expectCoordinatedFile({ fixture, content: contentFor(project.path), worktreeUsage: "current_project" })
        const session = await Session.get(fixture.context.newSessionID!)
        return { projectID: session.projectID, taskID: fixture.taskID, observationID }
    })))
    expect({ projects: new Set(results.map((result) => result.projectID)).size, tasks: new Set(results.map((result) => result.taskID)).size, observations: new Set(results.map((result) => result.observationID)).size, calls: [...calls.values()] }).toEqual({ projects: 2, tasks: 2, observations: 2, calls: [2, 2] })
  }, 120_000)

  test("physical Build receives every immutable Task-input attachment", async () => {
    await using project = await memoryProject()
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies()
      const originals = [
        {
          filename: "PRD.md",
          mime: "text/markdown",
          text: "# PRD\nThe counter starts at seven and reset restores seven.\n",
        },
        { filename: "prototype.html", mime: "text/html", text: "<h1>Counter reference</h1>" },
      ]
      const attachments = await Promise.all(
        originals.map(async (source) => ({
          ...(await AttachmentStore.write(Instance.project.id, Buffer.from(source.text), source.mime, source.filename)),
        intent: "task_input" as const,
        source: "user-upload" as const,
        })),
      )
      const fixture = await createProductionFixture(
        project.path,
        "Build complete source projection",
        "base-developer",
        attachments,
      )
      const sourceInput = {
        taskID: fixture.taskID,
        instruction: "Read the original PRD",
        workScope: { kind: "task" as const },
        attachmentRefs: taskInputAttachmentRefs(findTask(fixture.taskID)!.attachments),
      }
      expect([
        projectIntentAnalysisInput(sourceInput).attachments,
        projectRequirementsInput(sourceInput).attachments,
        projectArchitectInput(sourceInput).attachments,
      ]).toEqual([attachments, attachments, attachments])
      const settled = await executeProductionBuild({
        fixture,
        recordSettlement: false,
      })
      const messages = await Session.messages({ sessionID: fixture.context.newSessionID! })
      const userText = messages
        .filter((message) => message.info.role === "user")
        .flatMap((message) => message.parts)
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
      for (const source of originals) {
        const relative = `references/${source.filename}`
        expect(await fs.readFile(path.join(project.path, relative), "utf8")).toBe(source.text)
        expect(userText).toContain(relative)
      }
      expect(settled.outcome).toMatchObject({ kind: "terminal_success", session_id: fixture.context.newSessionID })
    })
  }, 60_000)

  test("fresh managed-worktree Build preserves the preallocated Session identity", async () => {
    await using project = await memoryProject()
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies()
      const fixture = await createProductionFixture(
        project.path,
        "Build deterministic identity managed worktree",
        "base-developer",
      )
      const settled = await executeProductionBuild({
        fixture,
        worktreeUsage: "managed_worktree",
        recordSettlement: false,
      })
      const expectedSessionID = fixture.context.newSessionID!
      const session = await Session.get(expectedSessionID)
      expect({
        expectedSessionID,
        outcomeSessionID: "session_id" in settled.outcome ? settled.outcome.session_id : undefined,
        sessionID: session.id,
      }).toEqual({ expectedSessionID, outcomeSessionID: expectedSessionID, sessionID: expectedSessionID })
    })
  }, 60_000)

  test("the physical Build retries its exact publication before final settlement", async () => {
    await using project = await memoryProject()
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies()
      const fixture = await createProductionFixture(project.path, "Build publication recovery")
      const attempts: string[] = []
      const settled = await executeProductionBuild({
        fixture,
        writer(input, attempt) {
          attempts.push(JSON.stringify(input))
          if (attempt === 1) throw new Error("first publication attempt unavailable")
          return { kind: "terminal_success", artifactID: recordTaskLevelBuildHostObservation(input.observation) }
        },
      })
      const facts = terminalFacts(fixture.taskID)
      expect(facts[0]!.id.length).toBe(Identifier.MAX_LENGTH)
      expect({
        attempts: attempts.length,
        samePayload: attempts[0] === attempts[1],
        expectedSessionID: fixture.context.newSessionID,
        settled,
        facts,
        observationID: buildTerminalFactObservationID({ taskID: fixture.taskID, dispatchID: fixture.dispatchID }),
      }).toMatchObject({
        attempts: 2,
        samePayload: true,
        expectedSessionID: (settled.outcome as { session_id?: string }).session_id,
        settled: {
          outcome: { kind: "terminal_success" },
          workflow: { dispatches: [{ settlement: { outcome_kind: "terminal_success" } }] },
        },
        facts: [{ kind: "build_host_observation" }],
        observationID: facts[0]?.id,
      })
    })
  }, 60_000)

  test("an exhausted physical publication settles typed partial with its completed cleanup receipt", async () => {
    await using project = await memoryProject()
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies()
      const fixture = await createProductionFixture(project.path, "Build publication exhausted")
      const settled = await executeProductionBuild({
        fixture,
        writer() {
          throw new Error("publication unavailable")
        },
      })
      const observationID = buildTerminalFactObservationID({
        taskID: fixture.taskID,
        dispatchID: fixture.dispatchID,
      })
      expect({
        outcome: settled.outcome,
        cleanup: buildObservationCleanupRowsForTask(fixture.taskID),
      }).toEqual({
        outcome: expect.objectContaining({ kind: "partial", failed_operation: "persist-git-workspace" }),
        cleanup: [expect.objectContaining({ observation_id: observationID, status: "complete", attempts: 1 })],
      })
    })
  }, 60_000)

  test("the canonical exact identity rejects payload drift after production publication", async () => {
    await using project = await memoryProject()
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies()
      const fixture = await createProductionFixture(project.path, "Build publication drift")
      await executeProductionBuild({ fixture })
      const fact = terminalFacts(fixture.taskID)[0]!
      expect(() =>
        recordTaskLevelBuildHostObservation({
        id: fact.id,
        taskID: fixture.taskID,
        sessionID: (fact.payload as any).session_id,
        finalMessageID: (fact.payload as any).final_message_id,
        executionMode: "current_project",
        diffs: [],
        observedArtifactLocators: [],
        sourceArtifactLocators: [],
        now: Date.now(),
        }),
      ).toThrow(`Engine Artifact ${fact.id} exact publication identity drift`)
      expect(terminalFacts(fixture.taskID)).toHaveLength(1)
    })
  }, 60_000)

  test("cleanup failure retains one durable owner and recovery deletes its exact refs before settlement retry", async () => {
    await using project = await memoryProject()
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies()
      const fixture = await createProductionFixture(project.path, "Build cleanup recovery")
      let cleanupAttempts = 0
      await expect(
        executeProductionBuild({
        fixture,
          writer() {
            throw new Error("publication unavailable")
          },
        async cleanup(input) {
          cleanupAttempts++
          await settleBuildObservationCleanup(input, {
              async deleteRefs() {
                throw new Error("Git metadata unavailable")
              },
          })
        },
        }),
      ).rejects.toThrow("remains pending")
      const owner = buildObservationCleanupRowsForTask(fixture.taskID)[0]!
      expect({ status: owner.status, attempts: owner.attempts, cleanupAttempts }).toEqual({
        status: "pending",
        attempts: 1,
        cleanupAttempts: 1,
      })
      expect(await reconcileBuildObservationCleanups({ projectID: Instance.project.id })).toBe(1)
      expect(buildObservationCleanupRowsForTask(fixture.taskID)[0]).toMatchObject({
        status: "complete",
        attempts: 2,
        last_error: null,
      })
    })
  }, 60_000)

  test("lease-renewal loss aborts the stale cleanup executor and lets one successor settle", async () => {
    await using project = await memoryProject()
    await withBootstrappedProject(project.path, async () => {
      const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
      using _provider = {
        [Symbol.dispose]() {
          provider.mockRestore()
        },
      }
      const fixture = await createProductionFixture(project.path, "Build cleanup lease loss")
      const observationID = await createTaskDeletionObservation({
        projectPath: project.path,
        taskID: fixture.taskID,
        retained: false,
      })
      let staleAborted = false
      await expect(
        settleBuildObservationCleanup(
        { observationID },
        {
          leaseMilliseconds: 20,
          renewalMilliseconds: 2,
            renewLease() {
              throw new Error("simulated lease fence loss")
            },
            deleteRefs: async (_row, signal) =>
              new Promise<void>((_resolve, reject) => {
                signal.addEventListener(
                  "abort",
                  () => {
              staleAborted = true
              reject(signal.reason)
                  },
                  { once: true },
                )
          }),
        },
        ),
      ).rejects.toThrow("remains pending")
      expect({ staleAborted, projection: buildObservationCleanupRowsForTask(fixture.taskID)[0] }).toMatchObject({
        staleAborted: true,
        projection: { status: "active", attempts: 0 },
      })
      await new Promise((resolve) => setTimeout(resolve, 25))
      let successorCalls = 0
      await settleBuildObservationCleanup(
        { observationID },
        {
          async deleteRefs() {
            successorCalls++
          },
        },
      )
      expect({ successorCalls, projection: buildObservationCleanupRowsForTask(fixture.taskID)[0] }).toMatchObject({
        successorCalls: 1,
        projection: { status: "complete", attempts: 1, last_error: null },
      })
    })
  }, 60_000)

  test("production provenance failure publishes one typed partial only after private refs are cleaned", async () => {
    await using project = await memoryProject()
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies()
      const fixture = await createProductionFixture(project.path, "Build provenance failure")
      const settled = await executeProductionBuild({
        fixture,
        provenance() {
          throw new Error("durable provenance unavailable")
        },
      })
      const owner = buildObservationCleanupRowsForTask(fixture.taskID)[0]!
      const facts = Database.use((db) =>
        db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.task_id, fixture.taskID)).all(),
      )
      expect({
        outcome: settled.outcome,
        owner,
        infrastructureFacts: facts.filter((fact) => fact.kind === "task-infrastructure-error"),
      }).toMatchObject({
        outcome: { kind: "partial", failed_operation: "collect-git-workspace" },
        owner: { status: "complete" },
        infrastructureFacts: [{ kind: "task-infrastructure-error", payload: { operation: "collect-git-workspace" } }],
      })
    })
  }, 60_000)

  test("project bootstrap resumes the same pending cleanup owner after project close and reopen", async () => {
    await using project = await memoryProject()
    const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
    using _provider = {
      [Symbol.dispose]() {
        provider.mockRestore()
      },
    }
    let taskID = ""
    let observationID = ""
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies({ mockProvider: false })
      const fixture = await createProductionFixture(project.path, "Build startup cleanup recovery")
      taskID = fixture.taskID
      let movedGit = false
      await expect(
        executeProductionBuild({
        fixture,
          writer() {
            throw new Error("publication unavailable")
          },
        async cleanup(input) {
          observationID = input.observationID
          movedGit = true
          await settleBuildObservationCleanup(input, {
              async deleteRefs() {
                throw new Error("Git metadata unavailable")
              },
          })
        },
        }),
      ).rejects.toThrow("remains pending")
      expect(movedGit).toBe(true)
      expect(buildObservationCleanupRowsForTask(taskID)[0]).toMatchObject({ status: "pending", attempts: 1 })
      completeTask(taskID)
    })
    await Instance.disposeAll()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        expect(buildObservationCleanupRowsForTask(taskID)[0]).toMatchObject({
          observation_id: observationID,
          status: "complete",
          attempts: 2,
          last_error: null,
        })
      },
    })
  }, 60_000)

  test("Task deletion settles retained observation refs before appending its audit-preserving tombstone", async () => {
    await using project = await memoryProject()
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies()
      const fixture = await createProductionFixture(project.path, "Build retained cleanup deletion")
      await createTaskDeletionObservation({ projectPath: project.path, taskID: fixture.taskID, retained: true })
      const owner = buildObservationCleanupRowsForTask(fixture.taskID)[0]!
      expect(owner.status).toBe("retained")
      completeTask(fixture.taskID)
      expect(await EngineService.deleteTask(fixture.taskID)).toBe(true)
      expect({
        retainedTask: Database.use((db) =>
          db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, fixture.taskID)).get(),
        ),
        owners: buildObservationCleanupRowsForTask(fixture.taskID),
      }).toMatchObject({
        retainedTask: { id: fixture.taskID, session_id: fixture.root.id },
        owners: [{ observation_id: owner.observation_id, status: "complete" }],
      })
    })
  }, 60_000)

  test("Task deletion preserves its Task and owner when Git metadata is missing, then retries the same owner", async () => {
    await using project = await memoryProject()
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies()
      const fixture = await createProductionFixture(project.path, "Build deletion cleanup recovery")
      await createTaskDeletionObservation({ projectPath: project.path, taskID: fixture.taskID, retained: false })
      const owner = buildObservationCleanupRowsForTask(fixture.taskID)[0]!
      completeTask(fixture.taskID)
      const gitDirectory = path.join(project.path, ".git")
      const unavailableGitDirectory = path.join(project.path, ".git-unavailable")
      await fs.rename(gitDirectory, unavailableGitDirectory)
      try {
        await expect(EngineService.deleteTask(fixture.taskID)).rejects.toThrow("remains pending")
        expect({
          task: Database.use((db) =>
            db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, fixture.taskID)).get(),
          ),
          owner: buildObservationCleanupRowsForTask(fixture.taskID)[0],
        }).toMatchObject({
          task: { id: fixture.taskID },
          owner: { observation_id: owner.observation_id, status: "pending" },
        })
      } finally {
        await fs.rename(unavailableGitDirectory, gitDirectory)
      }
      expect(await EngineService.deleteTask(fixture.taskID)).toBe(true)
      expect({
        retainedTask: Database.use((db) =>
          db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, fixture.taskID)).get(),
        ),
        owners: buildObservationCleanupRowsForTask(fixture.taskID),
      }).toMatchObject({
        retainedTask: { id: fixture.taskID },
        owners: [{ observation_id: owner.observation_id, status: "complete" }],
      })
    })
  }, 60_000)

  test("Project deletion settles Build observation refs before deleting the aggregate", async () => {
    await using project = await memoryProject()
    let projectID = ""
    let firstTaskID = ""
    let secondTaskID = ""
    let firstObservationID = ""
    let secondObservationID = ""
    let secondGitDirectory = ""
    let secondCleanupDirectory = ""
    await withBootstrappedProject(project.path, async () => {
      using _spies = await installPhysicalBuildSpies()
      const first = await createProductionFixture(project.path, "Project Build child cleanup first")
      const second = await createProductionFixture(project.path, "Project Build child cleanup second")
      projectID = Instance.project.id
      firstTaskID = first.taskID
      secondTaskID = second.taskID
      await createTaskDeletionObservation({ projectPath: project.path, taskID: firstTaskID, retained: true })
      secondGitDirectory = await resolveBuildObservationGitDir(project.path)
      secondCleanupDirectory = path.join(project.path, ".git-unavailable")
      await createTaskDeletionObservation({
        projectPath: project.path,
        taskID: secondTaskID,
        retained: true,
        cleanupGitDir: secondCleanupDirectory,
      })
      firstObservationID = buildObservationCleanupRowsForTask(firstTaskID)[0]!.observation_id
      const secondOwner = buildObservationCleanupRowsForTask(secondTaskID)[0]!
      secondObservationID = secondOwner.observation_id
      completeTask(firstTaskID)
      completeTask(secondTaskID)
    })
    const first = await deleteProject(Project.get(projectID)!, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_project_build_child_cleanup_first",
      reason: "Prove Project deletion retains its aggregate until Build refs settle",
    }).catch((cause) => cause)
    const retainedAfterFirst = Project.get(projectID)?.id
    const tasksAfterFirst = Database.use((db) =>
      db
        .select({ id: EngineTaskTable.id })
        .from(EngineTaskTable)
        .where(eq(EngineTaskTable.project_id, projectID))
        .all()
        .map((row) => row.id)
        .sort(),
    )
    const ownersAfterFirst = [
      buildObservationCleanupRowsForTask(firstTaskID)[0],
      buildObservationCleanupRowsForTask(secondTaskID)[0],
    ].map((owner) => ({ observationID: owner?.observation_id, status: owner?.status }))
    await fs.symlink(secondGitDirectory, secondCleanupDirectory, "junction")
    const lateObservationID = Identifier.ascending("artifact")
    let lateAdmission: unknown
    using _lateAdmission = ProjectDeleteTestHooks.replaceBeforeDatabaseCommit(() => {
      try {
        beginBuildObservationCleanup({
          observationID: lateObservationID,
          taskID: firstTaskID,
          gitDir: secondGitDirectory,
          activate: false,
        })
      } catch (cause) {
        lateAdmission = cause
      }
    })
    const retry = await deleteProject(Project.get(projectID)!, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_project_build_child_cleanup_retry",
      reason: "Complete Project deletion after the same Build cleanup owner resumes",
    })

    expect({
      first: first.name,
      retainedAfterFirst,
      tasksAfterFirst,
      ownersAfterFirst,
      lateAdmission: lateAdmission instanceof Error ? lateAdmission.message : lateAdmission,
      retry,
    }).toEqual({
      first: "ProjectDeletePendingError",
      retainedAfterFirst: projectID,
      tasksAfterFirst: [firstTaskID, secondTaskID].sort(),
      ownersAfterFirst: [
        { observationID: firstObservationID, status: "complete" },
        { observationID: secondObservationID, status: "pending" },
      ],
      lateAdmission: expect.stringContaining(`Project ${projectID} maintenance`),
      retry: expect.objectContaining({
        ok: true,
        status: "committed",
        projectID,
        directory: project.path,
        deletedTaskCount: 2,
      }),
    })
  }, 90_000)
})
