import { afterAll, describe, expect, test } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import { createDispatchLineageOrigin, recordDispatchLineage } from "@/engine/dispatch-lineage"
import { recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { describeTask } from "@/engine/describe"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { recordEngineArtifact } from "@/engine/artifact"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import {
  listRequirementSetArtifacts,
  requireTask,
} from "@/engine/store"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { Identifier } from "@/id/id"
import { createRequirementsStageDispatcher } from "@/orchestrator/requirements-stage"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { Instance } from "@/project/instance"
import type { RequirementCoverageDeclaration, RequirementSet } from "@/requirements/types"
import { Session } from "@/session"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { createArtifactReadAiTool, createArtifactSearchAiTool, createArtifactSelectAiTool } from "@/tool/artifact-catalog"
import { createRequirementsOutputTools } from "@/requirements/output-tools"
import { EngineArtifactEnvelopeSchema } from "@opencorvus-ai/plugin"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { Database, DatabaseUnavailableError, and, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "requirements-settlement-test",
  version: "2026.08.13.1",
  packageDigest: "9".repeat(64),
}

const identity = {
  agentID: "requirement-engineer",
  baseRole: "requirements" as const,
  sessionKind: "requirements" as const,
  dispatchAdapterID: "requirements" as const,
  runtimeTemplateABIVersion: 1 as const,
  dispatchAdapterABIVersion: 1 as const,
  projectionHash: "8".repeat(64),
}

const workflowBinding: SelectedWorkflowBinding = {
  kind: "virtual_workflow",
  workflow_id: "requirements-to-architecture",
  package_revision: {
    scope: "built_in",
    project_id: null,
    namespace: packageRevision.namespace,
    id: packageRevision.id,
    version: packageRevision.version,
    package_digest: packageRevision.packageDigest,
  },
  nodes: [
    { node_id: "requirements", agent_id: identity.agentID, depends_on: [] },
    { node_id: "architecture", agent_id: "solution-architect", depends_on: ["requirements"] },
  ],
}

afterAll(async () => {
  await resetMemoryDatabase()
})

async function fixture(title: string) {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title,
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  persistTask({
    taskID,
    rootSession: root,
    now,
    title,
    request: "Register every observable requirement and preserve unresolved coverage",
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
  const worker = await Session.create({ kind: "requirements", parentID: root.id, title: "Requirements worker" })
  const input = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: worker.id,
    role: "user",
    author: "orchestrator",
    time: { created: now + 1 },
    agent: identity.agentID,
    model: { providerID: "test", modelID: "test-model" },
  })
  const control = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: worker.id,
    messageID: input.id,
    type: "text",
    text: "Produce the exact typed Requirements delivery",
  })
  const final = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: worker.id,
    role: "assistant",
    author: identity.agentID,
    parentID: input.id,
    time: { created: now + 8, completed: now + 9 },
    agent: identity.agentID,
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  const dispatchID = Identifier.ascending("artifact")
  const turn = {
    kind: "initial" as const,
    current_dispatch_id: dispatchID,
    workflow_binding: workflowBinding,
    workflow_node_id: "requirements",
    workflow_occurrence_id: dispatchID,
    delivery_slice_revision_ids: [],
    evidence_locators: [],
    task_authority: {
      task_id: taskID,
      root_session_id: root.id,
      request_sha256: taskRequestSHA256(requireTask(taskID).request),
      initial_control_text_parts: [],
    },
  }
  WorkerTurnDescriptor.create({
    sessionID: worker.id,
    payload: {
      identity,
      expertSquadID: packageRevision.id,
      packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test-model" },
      prompt: { systemMode: "complete", systemSha256: "7".repeat(64) },
      tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: input.id,
        control_text_parts: [{ part_id: control.id, text_sha256: taskRequestSHA256(control.text) }],
      },
      dispatchTurn: turn,
    },
  })
  recordDispatchLineage({
    origin: createDispatchLineageOrigin({
      dispatchID,
      taskID,
      orchestratorSessionID: root.id,
      orchestratorMessageID: Identifier.ascending("message"),
      toolPartID: Identifier.ascending("part"),
      toolCallID: Identifier.ascending("call"),
      targetAgentID: identity.agentID,
      projectedWorkerIdentity: identity,
      workScope: { kind: "task" },
      workflowBinding,
      workflowNodeID: "requirements",
      adapterInput: { reason: "Extract exact requirements" },
    }),
    childSessionID: worker.id,
  })
  return { taskID, root, worker, final, dispatchID, turn }
}

const requirement: RequirementSet["requirements"][number] = {
  id: "REQ-1",
  type: "explicit",
  description: "The delivery preserves every requested observable behavior.",
  acceptance: "The focused contract test reports the exact durable outcome.",
  non_goals: "It does not invent additional product scope.",
  evidence_refs: [],
}

function completeDeclaration(task: Awaited<ReturnType<typeof fixture>>): RequirementCoverageDeclaration {
  return {
    status: "complete",
    request_sha256: taskRequestSHA256(requireTask(task.taskID).request),
    requirement_ids: [requirement.id],
    source_artifact_locators: [],
    unresolved: [],
  }
}

async function addSelectedEvidence(task: Awaited<ReturnType<typeof fixture>>) {
  const artifactID = recordEngineArtifact({
    taskID: task.taskID,
    kind: "expert_output",
    label: "Requirements evidence",
    payload: EngineArtifactEnvelopeSchema.parse({
      artifact_type: "requirements-test/source",
      schema_version: 1,
      producer: {
        owner_kind: "core",
        component_id: "requirements-domain-incomplete-test",
        operation_id: Identifier.ascending("artifact"),
      },
      payload: { fact: "selected durable evidence" },
      resources: [],
      observed_artifact_locators: [],
      source_artifact_locators: [],
    }),
  })
  const locator = exactEngineArtifactLocator({ taskID: task.taskID, artifactID })
  // Each of these Messages is created open and completed only after its Tool
  // Part is written: a completed assistant Message is immutable, so appending
  // the Part first and stamping completion afterwards is the order the Host
  // allows. Building them pre-completed made the fixture, not the code under
  // test, the thing that failed.
  const assistantMessage = (id: string, created: number) => ({
    id,
    sessionID: task.worker.id,
    role: "assistant" as const,
    author: identity.agentID,
    parentID: task.final.parentID,
    time: { created },
    agent: identity.agentID,
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop" as const,
  })
  const searchMessage = await Session.updateMessage(
    assistantMessage(Identifier.ascending("message"), task.final.time.created - 6),
  )
  const searchTool = createArtifactSearchAiTool(task.taskID)
  if (!searchTool.execute) throw new Error("artifact_search is missing its production execution boundary")
  const searchInput = {
    artifact_types: ["requirements-test/source"],
    version_scope: "current" as const,
    limit: 10,
  }
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: task.worker.id,
    messageID: searchMessage.id,
    type: "step-start",
  })
  const searchPart = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: task.worker.id,
    messageID: searchMessage.id,
    type: "tool",
    callID: "requirements-search",
    tool: "artifact_search",
    state: { status: "running", input: searchInput, time: { start: task.final.time.created - 6 } },
  })
  const searchOutput = await searchTool.execute(searchInput, {
    toolCallId: "requirements-search",
    messages: [],
    abortSignal: new AbortController().signal,
    opencorvus: { sessionID: task.worker.id, messageID: searchMessage.id, toolPartID: searchPart.id },
  } as never)
  await Session.updatePart({
    id: searchPart.id,
    sessionID: task.worker.id,
    messageID: searchMessage.id,
    type: "tool",
    callID: "requirements-search",
    tool: "artifact_search",
    state: {
      status: "completed",
      input: searchInput,
      output: searchOutput.output,
      title: searchOutput.title,
      metadata: searchOutput.metadata,
      time: { start: task.final.time.created - 6, end: task.final.time.created - 5 },
    },
  })
  const searchPage = JSON.parse(searchOutput.output) as { entries: Array<{ artifact_locator_ref: string }> }
  const artifactLocatorRef = searchPage.entries[0]?.artifact_locator_ref
  if (!artifactLocatorRef) throw new Error("artifact_search did not return the persisted requirements evidence")
  await Session.updateMessage({
    ...searchMessage,
    time: { ...searchMessage.time, completed: task.final.time.created - 5 },
  })
  const readMessage = await Session.updateMessage(
    assistantMessage(Identifier.ascending("message"), task.final.time.created - 4),
  )
  const readTool = createArtifactReadAiTool(task.taskID)
  if (!readTool.execute) throw new Error("artifact_read is missing its production execution boundary")
  const readInput = {
    artifact_transport_version: 2 as const,
    artifact_locator_ref: artifactLocatorRef,
    byte_offset: 0,
    max_bytes: 16_384,
    delivery: "inline" as const,
  }
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: task.worker.id,
    messageID: readMessage.id,
    type: "step-start",
  })
  const readPart = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: task.worker.id,
    messageID: readMessage.id,
    type: "tool",
    callID: "requirements-read",
    tool: "artifact_read",
    state: { status: "running", input: readInput, time: { start: task.final.time.created - 4 } },
  })
  const readOutput = await readTool.execute(
    readInput,
    {
      toolCallId: "requirements-read",
      messages: [],
      abortSignal: new AbortController().signal,
      opencorvus: { sessionID: task.worker.id, messageID: readMessage.id, toolPartID: readPart.id },
    } as never,
  )
  await Session.updatePart({
    id: readPart.id,
    sessionID: task.worker.id,
    messageID: readMessage.id,
    type: "tool",
    callID: "requirements-read",
    tool: "artifact_read",
    state: {
      status: "completed",
      input: readInput,
      output: readOutput.output,
      title: readOutput.title,
      metadata: readOutput.metadata,
      time: { start: task.final.time.created - 4, end: task.final.time.created - 3 },
    },
  })
  const readResult = JSON.parse(readOutput.output) as { artifact_read_ref?: string }
  if (!readResult.artifact_read_ref) throw new Error("artifact_read did not return a persisted read reference")
  await Session.updateMessage({
    ...readMessage,
    time: { ...readMessage.time, completed: task.final.time.created - 3 },
  })
  const selectMessage = await Session.updateMessage(
    assistantMessage(Identifier.ascending("message"), task.final.time.created - 2),
  )
  const selectTool = createArtifactSelectAiTool(task.taskID)
  if (!selectTool.execute) throw new Error("artifact_select is missing its production execution boundary")
  const selectInput = {
    artifact_transport_version: 2 as const,
    artifact_read_ref: readResult.artifact_read_ref,
    purpose: "Supports REQ-1",
  }
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: task.worker.id,
    messageID: selectMessage.id,
    type: "step-start",
  })
  const selectPart = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: task.worker.id,
    messageID: selectMessage.id,
    type: "tool",
    callID: "requirements-select",
    tool: "artifact_select",
    state: { status: "running", input: selectInput, time: { start: task.final.time.created - 2 } },
  })
  const selectOutput = await selectTool.execute(selectInput, {
    toolCallId: "requirements-select",
    messages: [],
    abortSignal: new AbortController().signal,
    opencorvus: { sessionID: task.worker.id, messageID: selectMessage.id, toolPartID: selectPart.id },
  } as never)
  await Session.updatePart({
    id: selectPart.id,
    sessionID: task.worker.id,
    messageID: selectMessage.id,
    type: "tool",
    callID: "requirements-select",
    tool: "artifact_select",
    state: {
      status: "completed",
      input: selectInput,
      output: selectOutput.output,
      title: selectOutput.title,
      metadata: selectOutput.metadata,
      time: { start: task.final.time.created - 2, end: task.final.time.created - 1 },
    },
  })
  await Session.updateMessage({
    ...selectMessage,
    time: { ...selectMessage.time, completed: task.final.time.created - 1 },
  })
  return locator
}

async function run(input: {
  task: Awaited<ReturnType<typeof fixture>>
  requirements: RequirementSet["requirements"]
  decisions?: RequirementSet["decisions"]
  finalization?: RequirementCoverageDeclaration
}) {
  const outcome = await createRequirementsStageDispatcher({
    taskID: input.task.taskID,
    parentSessionID: input.task.root.id,
    runRequirements: async () => ({
      sessionID: input.task.worker.id,
      finalMessageID: input.task.final.id,
      requirements: input.requirements,
      decisions: input.decisions ?? [],
      ...(input.finalization ? { finalization: input.finalization } : {}),
    }),
  })({
    task: requireTask(input.task.taskID),
    attachmentRefs: [],
    agentID: identity.agentID,
    packageRevision,
    workScope: { kind: "task" },
    dispatchTurn: input.task.turn,
  })
  recordDispatchSettlement({ taskID: input.task.taskID, dispatchID: input.task.dispatchID, outcome })
  return {
    outcome,
    artifacts: listRequirementSetArtifacts(input.task.taskID),
    workflow: (await describeTask(input.task.taskID)).workflow_execution,
  }
}

describe("Requirements domain-incomplete settlement", () => {
  test("missing and decisions-only coverage remain exact incomplete evidence with Architect closed", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const empty = await fixture("Empty Requirements")
        const emptyResult = await run({ task: empty, requirements: [] })
        const decisionsOnly = await fixture("Decisions-only Requirements")
        const decisionsOnlyResult = await run({
          task: decisionsOnly,
          requirements: [],
          decisions: [{ key: "runtime", value: "Bun", reason: "Repository fact" }],
          finalization: { ...completeDeclaration(decisionsOnly), requirement_ids: [] },
        })
        expect({ empty: emptyResult, decisionsOnly: decisionsOnlyResult }).toMatchObject({
          empty: {
            outcome: { kind: "domain_incomplete", domain: "requirements" },
            artifacts: [{ payload: { coverage_receipt: { status: "incomplete", issues: ["finalization_missing", "no_requirements_registered"] } } }],
            workflow: { frontier_node_ids: [], nodes: [{ node_id: "requirements", terminal_success: false }, { node_id: "architecture", terminal_success: false }] },
          },
          decisionsOnly: {
            outcome: { kind: "domain_incomplete", domain: "requirements" },
            artifacts: [{ payload: { decisions: [{ key: "runtime", value: "Bun" }], coverage_receipt: { status: "incomplete", issues: ["no_requirements_registered"] } } }],
            workflow: { frontier_node_ids: [] },
          },
        })
      },
    })
  }, 30_000)

  test("a forged complete declaration is recomputed from durable request and remains incomplete", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await fixture("Forged Requirements coverage")
        const result = await run({
          task,
          requirements: [requirement],
          finalization: { ...completeDeclaration(task), request_sha256: "0".repeat(64) },
        })
        expect(result).toMatchObject({
          outcome: { kind: "domain_incomplete", domain: "requirements" },
          artifacts: [{ payload: { producer: { session_id: task.worker.id, final_message_id: task.final.id }, coverage_receipt: { status: "incomplete", issues: ["request_identity_mismatch"], request_sha256: taskRequestSHA256(requireTask(task.taskID).request) } } }],
          workflow: { frontier_node_ids: [] },
        })
      },
    })
  }, 30_000)

  test("one exact finalized RequirementSet succeeds and opens only Architect", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await fixture("Complete Requirements coverage")
        const result = await run({ task, requirements: [requirement], finalization: completeDeclaration(task) })
        expect(result).toMatchObject({
          outcome: { kind: "terminal_success", session_id: task.worker.id, final_message_id: task.final.id },
          artifacts: [{ payload: { requirements: [{ id: "REQ-1" }], coverage_receipt: { status: "complete", issues: [] } } }],
          workflow: { frontier_node_ids: ["architecture"], nodes: [{ node_id: "requirements", terminal_success: true }, { node_id: "architecture", terminal_success: false }] },
        })
      },
    })
  }, 30_000)

  test("wire-valid collector facts are writer-valid at the production adapter boundary", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await fixture("Wire-valid Requirements")
        const output = createRequirementsOutputTools()
        await output.tools.register_requirement.execute?.({
          ...requirement,
          acceptance: "x",
        }, {} as never)
        await output.tools.register_decision.execute?.({ key: "runtime", value: "Bun", reason: "" }, {} as never)
        await output.tools.finalize_requirements.execute?.({
          ...completeDeclaration(task),
          requirement_ids: [requirement.id],
        }, {} as never)
        const collector = output.getCollector()
        const result = await run({
          task,
          requirements: collector.requirements,
          decisions: collector.decisions,
          finalization: collector.finalization,
        })
        expect(result).toMatchObject({
          outcome: { kind: "terminal_success" },
          artifacts: [{ payload: { schema_version: 2, requirements: [{ acceptance: "x" }], decisions: [{ reason: "" }] } }],
          workflow: { frontier_node_ids: ["architecture"] },
        })
      },
    })
  }, 30_000)

  test("durable read and selection facts are the only source and evidence authority", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const complete = await fixture("Selected Requirements evidence")
        const locator = await addSelectedEvidence(complete)
        const selectedRequirement = { ...requirement, evidence_refs: [locator] }
        const success = await run({
          task: complete,
          requirements: [selectedRequirement],
          finalization: {
            ...completeDeclaration(complete),
            source_artifact_locators: [locator],
          },
        })
        expect(success).toMatchObject({
          outcome: { kind: "terminal_success" },
          artifacts: [{ payload: { source_artifact_locators: [locator], coverage_receipt: { status: "complete", issues: [] } } }],
          workflow: { frontier_node_ids: ["architecture"] },
        })

        const sourceDrift = await fixture("Source drift")
        const sourceDriftResult = await run({
          task: sourceDrift,
          requirements: [requirement],
          finalization: { ...completeDeclaration(sourceDrift), source_artifact_locators: [locator] },
        })
        const evidenceDrift = await fixture("Evidence drift")
        const evidenceDriftResult = await run({
          task: evidenceDrift,
          requirements: [{ ...requirement, evidence_refs: [locator] }],
          finalization: completeDeclaration(evidenceDrift),
        })
        expect({ sourceDrift: sourceDriftResult, evidenceDrift: evidenceDriftResult }).toMatchObject({
          sourceDrift: {
            outcome: { kind: "domain_incomplete" },
            artifacts: [{ payload: { coverage_receipt: { issues: ["source_identity_mismatch"] } } }],
            workflow: { frontier_node_ids: [] },
          },
          evidenceDrift: {
            outcome: { kind: "domain_incomplete" },
            artifacts: [{ payload: { coverage_receipt: { issues: ["requirement_evidence_identity_mismatch"] } } }],
            workflow: { frontier_node_ids: [] },
          },
        })
      },
    })
  }, 30_000)

  test("identity, unresolved, and declared-incomplete coverage remain fail-closed", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const cases = [
          {
            title: "Requirement identity mismatch",
            declaration: (task: Awaited<ReturnType<typeof fixture>>) => ({
              ...completeDeclaration(task),
              requirement_ids: ["REQ-2" as const],
            }),
            issue: "requirement_identity_mismatch",
          },
          {
            title: "Unresolved Requirements",
            declaration: (task: Awaited<ReturnType<typeof fixture>>) => ({
              ...completeDeclaration(task),
              unresolved: [{ code: "missing-owner", detail: "A delivery owner is unresolved." }],
            }),
            issue: "unresolved_items",
          },
          {
            title: "Declared incomplete Requirements",
            declaration: (task: Awaited<ReturnType<typeof fixture>>) => ({
              ...completeDeclaration(task),
              status: "incomplete" as const,
            }),
            issue: "declared_incomplete",
          },
        ]
        for (const entry of cases) {
          const task = await fixture(entry.title)
          const result = await run({ task, requirements: [requirement], finalization: entry.declaration(task) })
          expect(result).toMatchObject({
            outcome: { kind: "domain_incomplete" },
            artifacts: [{ payload: { coverage_receipt: { status: "incomplete", issues: [entry.issue] } } }],
            workflow: { frontier_node_ids: [] },
          })
        }
      },
    })
  }, 30_000)

  test("a completed stale Turn in the same reused Session cannot publish for the current dispatch", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await fixture("Reused Requirements Session")
        const staleInput = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: task.worker.id,
          role: "user",
          author: "orchestrator",
          time: { created: task.final.time.completed! + 1 },
          agent: identity.agentID,
          model: { providerID: "test", modelID: "test-model" },
        })
        const staleFinal = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: task.worker.id,
          role: "assistant",
          author: identity.agentID,
          parentID: staleInput.id,
          time: { created: task.final.time.completed! + 2, completed: task.final.time.completed! + 3 },
          agent: identity.agentID,
          providerID: "test",
          modelID: "test-model",
          path: { cwd: Instance.directory, root: Instance.directory },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const outcome = await createRequirementsStageDispatcher({
          taskID: task.taskID,
          parentSessionID: task.root.id,
          runRequirements: async () => ({
            sessionID: task.worker.id,
            finalMessageID: staleFinal.id,
            requirements: [requirement],
            decisions: [],
            finalization: completeDeclaration(task),
          }),
        })({
          task: requireTask(task.taskID),
          attachmentRefs: [],
          agentID: identity.agentID,
          packageRevision,
          workScope: { kind: "task" },
          dispatchTurn: task.turn,
        })
        expect({ outcome, requirementSets: listRequirementSetArtifacts(task.taskID) }).toMatchObject({
          outcome: { kind: "partial", failed_operation: "persist_requirement_set" },
          requirementSets: [],
        })
      },
    })
  }, 30_000)

  test("pre-coverage RequirementSet data makes the pre-release database reset-required", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await fixture("Legacy Requirements")
        const artifactID = recordEngineArtifact({
          taskID: task.taskID,
          kind: "requirement_set",
          label: "Legacy RequirementSet",
          payload: {
            requirements: [requirement],
            decisions: [],
            observed_artifact_locators: [],
            source_artifact_locators: [],
          },
        })
        expect(artifactID).toMatch(/^art_/)
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
          operation: "Database.Client.dataIntegrity.requirementSetCoverage",
        })
        await Database.resetFiles(Database.Path())
        Database.Client()
      },
    })
  }, 30_000)

  test("malformed RequirementSet JSON has the same typed startup reset contract", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await fixture("Malformed legacy Requirements")
        const artifactID = recordEngineArtifact({
          taskID: task.taskID,
          kind: "requirement_set",
          label: "Malformed RequirementSet",
          payload: {
            schema_version: 2,
            requirements: [requirement],
            decisions: [],
            observed_artifact_locators: [],
            source_artifact_locators: [],
          },
        })
        await Database.awaitEffectIdle(30_000)
        Database.close()
        const sqlite = new BunDatabase(Database.Path())
        try {
          const triggers = sqlite
            .query<{ name: string; sql: string }, []>(
              "SELECT name, sql FROM sqlite_schema WHERE type = 'trigger' AND tbl_name IN ('engine_artifact', 'engine_artifact_version') ORDER BY name",
            )
            .all()
          if (triggers.length === 0 || triggers.some((trigger) => !trigger.sql)) {
            throw new Error("artifact integrity trigger fixture is incomplete")
          }
          for (const trigger of triggers) sqlite.run(`DROP TRIGGER "${trigger.name}"`)
          const corrupt = sqlite.prepare("UPDATE engine_artifact SET payload = ? WHERE id = ?")
          try {
            corrupt.run("{", artifactID)
          } finally {
            corrupt.finalize()
          }
          for (const trigger of triggers) sqlite.run(trigger.sql)
        } finally {
          sqlite.close(true)
        }
        let observed: unknown
        try {
          Database.Client()
        } catch (error) {
          observed = error
        }
        expect(DatabaseUnavailableError.isInstance(observed) ? observed.data : undefined).toMatchObject({
          code: "DATA_RESET_REQUIRED",
          operation: "Database.Client.dataIntegrity.requirementSetCoverage",
        })
        await Database.resetFiles(Database.Path())
        Database.Client()
      },
    })
  }, 30_000)
})
