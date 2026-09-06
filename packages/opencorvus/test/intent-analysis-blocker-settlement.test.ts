import { afterEach, describe, expect, test } from "bun:test"
import z from "zod"
import type { IntentAnalysisAgent } from "@/intent-analysis/agent"
import { createDispatchLineageOrigin } from "@/engine/dispatch-lineage"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { describeTask } from "@/engine/describe"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { findArtifact, listInteractions, requireTask } from "@/engine/store"
import { EngineArtifactTable } from "@/engine/engine.sql"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { createAnalyzeIntentTool } from "@/orchestrator/analyze-intent-tool"
import type { DispatchAdapterExecutionContext } from "@/orchestrator/dispatch-adapter-execution-context"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { EngineService } from "@/task-api"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Database, and, eq } from "@/storage/db"
import type { persistIntentAnalysisArtifact } from "@/engine/persist"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "intent-blocker-settlement-test",
  version: "2026.08.12.1",
  packageDigest: "5".repeat(64),
}

const projectedIntentAnalyst = {
  identity: {
    agentID: "intent-analyst",
    baseRole: "intent-analysis" as const,
    sessionKind: "intent-analysis" as const,
    dispatchAdapterID: "analyze_intent" as const,
    runtimeTemplateABIVersion: 1 as const,
    dispatchAdapterABIVersion: 1 as const,
    projectionHash: "6".repeat(64),
  },
  packageRevision,
  virtualWorkflows: {},
  capabilityOwner: "package" as const,
  label: "Intent analyst",
  builtInToolIDs: [],
  projectedToolIDs: [],
}

const workflowBinding: SelectedWorkflowBinding = {
  kind: "virtual_workflow",
  workflow_id: "intent-to-requirements",
  package_revision: {
    scope: "built_in",
    project_id: null,
    namespace: packageRevision.namespace,
    id: packageRevision.id,
    version: packageRevision.version,
    package_digest: packageRevision.packageDigest,
  },
  nodes: [
    { node_id: "intent", agent_id: projectedIntentAnalyst.identity.agentID, depends_on: [] },
    { node_id: "requirements", agent_id: "requirements-analyst", depends_on: ["intent"] },
  ],
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function createFixture(title: string) {
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
    request: "Implement the exact user-selected scope",
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

  const orchestratorMessageID = Identifier.ascending("message")
  const toolPartID = Identifier.ascending("part")
  const callID = Identifier.ascending("call")

  const worker = await Session.create({ kind: "intent-analysis", parentID: root.id, title: `${title} worker` })
  const workerInput = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: worker.id,
    role: "user",
    author: "orchestrator",
    time: { created: now + 2 },
    agent: projectedIntentAnalyst.identity.agentID,
    model: { providerID: "test", modelID: "test-model" },
  })
  const controlPart = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: worker.id,
    messageID: workerInput.id,
    type: "text",
    text: "Analyze the exact implementation scope",
  })
  const workerFinal = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: worker.id,
    role: "assistant",
    author: projectedIntentAnalyst.identity.agentID,
    parentID: workerInput.id,
    time: { created: now + 3, completed: now + 4 },
    agent: projectedIntentAnalyst.identity.agentID,
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  const dispatchID = Identifier.ascending("artifact")
  const childSessionID = Identifier.deterministic("session", `intent-analysis-dispatch\0${dispatchID}`)
  recordTestDispatchLineage({
    origin: createDispatchLineageOrigin({
      dispatchID,
      taskID,
      orchestratorSessionID: root.id,
      orchestratorMessageID,
      toolPartID,
      toolCallID: callID,
      targetAgentID: projectedIntentAnalyst.identity.agentID,
      projectedWorkerIdentity: projectedIntentAnalyst.identity,
      workScope: { kind: "task" },
      workflowBinding,
      workflowNodeID: "intent",
      adapterInput: { reason: "Resolve scope", attachment_refs: [] },
    }),
    childSessionID: worker.id,
  })
  WorkerTurnDescriptor.create({
    sessionID: worker.id,
    payload: {
      identity: projectedIntentAnalyst.identity,
      expertSquadID: packageRevision.id,
      packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test-model" },
      prompt: { systemMode: "complete", systemSha256: "7".repeat(64) },
      tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: workerInput.id,
        control_text_parts: [{ part_id: controlPart.id, text_sha256: taskRequestSHA256(controlPart.text) }],
      },
      dispatchTurn: {
        kind: "initial",
        current_dispatch_id: dispatchID,
        workflow_binding: workflowBinding,
        workflow_node_id: "intent",
        workflow_occurrence_id: dispatchID,
        delivery_slice_revision_ids: [],
        evidence_locators: [],
        task_authority: {
          task_id: taskID,
          root_session_id: root.id,
          request_sha256: taskRequestSHA256(requireTask(taskID).request),
          initial_control_text_parts: [],
        },
      },
    },
  })

  const signal = new AbortController().signal
  const context: DispatchAdapterExecutionContext = {
    agentID: projectedIntentAnalyst.identity.agentID,
    projectedAgent: projectedIntentAnalyst as never,
    workScope: { kind: "task" },
    newSessionID: childSessionID,
    dispatch: {
      dispatchID,
      deliverySliceRevisionIDs: [],
      newSessionID: childSessionID,
      adapterInput: {},
      signal,
      turn: {
        kind: "initial",
        current_dispatch_id: dispatchID,
        workflow_binding: workflowBinding,
        workflow_node_id: "intent",
        workflow_occurrence_id: dispatchID,
        delivery_slice_revision_ids: [],
        evidence_locators: [],
        task_authority: {
          task_id: taskID,
          root_session_id: root.id,
          request_sha256: taskRequestSHA256(requireTask(taskID).request),
          initial_control_text_parts: [],
        },
      },
      observeSession() {},
      commitSession() {
        return { artifactID: Identifier.ascending("artifact") }
      },
      releaseAdmission() {},
    },
    signal,
    toolOptions: {
      toolCallId: callID,
      opencorvus: {
        sessionID: root.id,
        messageID: orchestratorMessageID,
        toolCallID: callID,
        toolPartID,
        visibleToolName: "dispatch_agent",
      },
    },
  }
  return { taskID, root, worker, workerFinal, context }
}

function analysisResult(fixture: Awaited<ReturnType<typeof createFixture>>, priority: "blocker" | "nice") {
  return {
    sessionID: fixture.worker.id,
    finalMessageID: fixture.workerFinal.id,
    facts: {
      judgment: null,
      slots: [],
      missing: ["scope"],
      clarifications: [
        {
          header: "Scope",
          question: "Which scope should the implementation use?",
          options: [{ value: "bounded", label: "Bounded", description: "Use the bounded scope." }],
          multiple: false,
          custom: false,
          why_needed: "The implementation boundary must be explicit.",
          priority,
        },
      ],
    },
  } as Awaited<ReturnType<typeof IntentAnalysisAgent.analyze>>
}

async function execute(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  priority: "blocker" | "nice",
  persistIntentArtifact?: typeof persistIntentAnalysisArtifact,
) {
  const adapter = createAnalyzeIntentTool({
    inputSchema: z.object({ reason: z.string(), attachment_refs: z.array(z.string()) }),
    taskID: fixture.taskID,
    agentSessionID: fixture.root.id,
    requireTask: () => requireTask(fixture.taskID),
    analyzeIntent: async () => analysisResult(fixture, priority),
    persistIntentArtifact,
  }).analyze_intent
  if (!adapter.execute) throw new Error("analyze_intent is missing its production executor")
  return adapter.execute({ reason: "Resolve scope", attachment_refs: [] }, fixture.context as never)
}

async function waitForInteraction(taskID: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const [interaction] = listInteractions(taskID)
    if (interaction) return interaction
    await Bun.sleep(25)
  }
  throw new Error(`Task ${taskID} Question was not projected`)
}

describe("Intent blocker Question settlement", () => {
  for (const status of ["rejected", "expired"] as const) {
    test(`${status} blocker persists exact correlation and keeps the workflow frontier closed`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          EngineService.init()
          const fixture = await createFixture(`${status} Intent blocker`)
          const previousTimeout = process.env.OPENCORVUS_QUESTION_TIMEOUT_MS
          if (status === "expired") process.env.OPENCORVUS_QUESTION_TIMEOUT_MS = "1000"
          try {
            const pending = execute(fixture, "blocker")
            const interaction = await waitForInteraction(fixture.taskID)
            if (status === "rejected") {
              await EngineService.rejectInteraction(interaction.id, { autoReply: false })
            }
            const outcome = await pending
            if (outcome.kind !== "domain_blocked") {
              throw new Error(`Expected domain_blocked, received ${outcome.kind}`)
            }
            const artifactID = outcome.domain_artifact.artifact_id
            expect({
              kind: outcome.kind,
              domain: outcome.domain,
              sessionID: outcome.session_id,
              finalMessageID: outcome.final_message_id,
              blockingQuestion: outcome.blocking_question,
              domainArtifact: outcome.domain_artifact,
            }).toEqual({
              kind: "domain_blocked",
              domain: "intent_analysis",
              sessionID: fixture.worker.id,
              finalMessageID: fixture.workerFinal.id,
              blockingQuestion: { request_id: interaction.external_id, status },
              domainArtifact: {
                source: "engine_artifact",
                artifact_id: artifactID,
                catalog_revision: expect.any(Number),
                expected_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
              },
            })
            const artifact = findArtifact({ taskID: fixture.taskID, artifactID })
            expect(artifact?.payload).toMatchObject({
              clarification_outcome: { status, answers: [], clarified_user_request: null },
            })
            recordDispatchSettlement({
              taskID: fixture.taskID,
              dispatchID: fixture.context.dispatch.dispatchID,
              outcome: outcome as never,
            })
            expect((await describeTask(fixture.taskID)).workflow_execution).toMatchObject({
              nodes: [
                { node_id: "intent", terminal_success: false },
                { node_id: "requirements", terminal_success: false, dispatches: [] },
              ],
              frontier_node_ids: [],
            })
          } finally {
            if (previousTimeout === undefined) delete process.env.OPENCORVUS_QUESTION_TIMEOUT_MS
            else process.env.OPENCORVUS_QUESTION_TIMEOUT_MS = previousTimeout
          }
        },
      })
    }, 30_000)
  }

  test("answered blocker persists clarified intent and opens the dependent frontier", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const fixture = await createFixture("Answered Intent blocker")
        const pending = execute(fixture, "blocker")
        const interaction = await waitForInteraction(fixture.taskID)
        await EngineService.replyInteraction(interaction.id, { answers: [["bounded"]], autoReply: false })
        const outcome = await pending
        recordDispatchSettlement({
          taskID: fixture.taskID,
          dispatchID: fixture.context.dispatch.dispatchID,
          outcome: outcome as never,
        })
        expect({ outcome, workflow: (await describeTask(fixture.taskID)).workflow_execution }).toMatchObject({
          outcome: {
            kind: "terminal_success",
            session_id: fixture.worker.id,
            final_message_id: fixture.workerFinal.id,
          },
          workflow: {
            nodes: [
              { node_id: "intent", terminal_success: true },
              { node_id: "requirements", terminal_success: false, dispatches: [] },
            ],
            frontier_node_ids: ["requirements"],
          },
        })
      },
    })
  }, 30_000)

  test("non-blocker clarification retains the current terminal domain contract", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const fixture = await createFixture("Optional Intent clarification")
        const outcome = await execute(fixture, "nice")
        expect({ outcome, interactions: listInteractions(fixture.taskID) }).toEqual({
          outcome: {
            kind: "terminal_success",
            session_id: fixture.worker.id,
            final_message_id: fixture.workerFinal.id,
          },
          interactions: [],
        })
      },
    })
  }, 30_000)

  test("canonical Intent writer failure returns post-Turn partial without an Intent Artifact", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const fixture = await createFixture("Intent Artifact persistence failure")
        const outcome = await execute(fixture, "nice", () => {
          throw new Error("intent artifact database unavailable")
        })
        const intentArtifacts = Database.use((db) =>
          db
            .select({ id: EngineArtifactTable.id })
            .from(EngineArtifactTable)
            .where(
              and(eq(EngineArtifactTable.task_id, fixture.taskID), eq(EngineArtifactTable.kind, "intent_analysis")),
            )
            .all(),
        )
        expect({ outcome, intentArtifacts }).toEqual({
          outcome: {
            kind: "partial",
            session_id: fixture.worker.id,
            final_message_id: fixture.workerFinal.id,
            failed_operation: "persist-intent-analysis-artifact",
            infrastructure_error: expect.objectContaining({
              source: "engine_artifact",
              artifact_id: expect.any(String),
              catalog_revision: expect.any(Number),
              expected_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            }),
          },
          intentArtifacts: [],
        })
      },
    })
  }, 30_000)
})
