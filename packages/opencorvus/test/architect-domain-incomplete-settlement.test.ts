import { afterAll, describe, expect, test } from "bun:test"
import { createDispatchLineageOrigin } from "@/engine/dispatch-lineage"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { describeTask } from "@/engine/describe"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { persistArchitectGoalProjection } from "@/engine/persist"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { listGoalGraphProjectionArtifacts, requireTask } from "@/engine/store"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { recordEngineArtifact } from "@/engine/artifact"
import { Identifier } from "@/id/id"
import { createArchitectStageDispatcher } from "@/orchestrator/architect-stage"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database, sql } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "architect-settlement-test",
  version: "2026.08.13.1",
  packageDigest: "a".repeat(64),
}

const workflowBinding: SelectedWorkflowBinding = {
  kind: "virtual_workflow",
  workflow_id: "architect-delivery",
  package_revision: {
    scope: "built_in",
    project_id: null,
    namespace: packageRevision.namespace,
    id: packageRevision.id,
    version: packageRevision.version,
    package_digest: packageRevision.packageDigest,
  },
  nodes: [
    { node_id: "architecture", agent_id: "solution-architect", depends_on: [] },
    { node_id: "implementation", agent_id: "implementation-engineer", depends_on: ["architecture"] },
  ],
}

const projectedArchitect = {
  identity: {
    agentID: "solution-architect",
    baseRole: "architect" as const,
    sessionKind: "architect" as const,
    dispatchAdapterID: "architect" as const,
    runtimeTemplateABIVersion: 1 as const,
    dispatchAdapterABIVersion: 1 as const,
    projectionHash: "b".repeat(64),
  },
  packageRevision,
  virtualWorkflows: {},
  capabilityOwner: "package" as const,
  label: "Solution architect",
  builtInToolIDs: [],
  projectedToolIDs: [],
}

afterAll(async () => {
  await resetMemoryDatabase()
})

async function createTask(title: string) {
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
    request: "Persist an accepted GoalGraph before implementation",
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
  const child = await Session.create({ kind: "architect", parentID: root.id, title: "Architect worker" })
  const parent = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "user",
    author: "orchestrator",
    time: { created: now + 1 },
    agent: projectedArchitect.identity.agentID,
    model: { providerID: "test", modelID: "test-model" },
  })
  const controlPart = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: child.id,
    messageID: parent.id,
    type: "text",
    text: "Produce the accepted GoalGraph projection",
  })
  const final = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: child.id,
    role: "assistant",
    author: projectedArchitect.identity.agentID,
    parentID: parent.id,
    time: { created: now + 2, completed: now + 3 },
    agent: projectedArchitect.identity.agentID,
    providerID: "test",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  WorkerTurnDescriptor.create({
    sessionID: child.id,
    payload: {
      identity: projectedArchitect.identity,
      expertSquadID: packageRevision.id,
      packageRevision,
      model: { selection: "explicit", providerID: "test", modelID: "test-model" },
      prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
      tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID, workScope: { kind: "task" } },
      messageAuthority: {
        user_message_id: parent.id,
        control_text_parts: [{ part_id: controlPart.id, text_sha256: taskRequestSHA256(controlPart.text) }],
      },
    },
  })
  return { taskID, root, child, final }
}

function requirementSetLocator(taskID: string) {
  const artifactID = recordEngineArtifact({
    taskID,
    kind: "requirement_set",
    label: "RequirementSet",
    payload: {
      schema_version: 2,
      requirements: [],
      decisions: [],
      observed_artifact_locators: [],
      source_artifact_locators: [],
      producer: {
        session_id: Identifier.ascending("session"),
        final_message_id: Identifier.ascending("message"),
      },
      coverage_receipt: {
        status: "incomplete",
        request_sha256: taskRequestSHA256(requireTask(taskID).request),
        requirement_ids: [],
        source_artifact_locators: [],
        unresolved: [],
        issues: ["no_requirements_registered"],
        declaration: null,
      },
    },
  })
  return exactEngineArtifactLocator({ taskID, artifactID })
}

function emptyArchitectResult(input: {
  sessionID: string
  finalMessageID: string
  requirementSetArtifactLocator?: ReturnType<typeof requirementSetLocator>
  priorGoalGraphProjectionArtifactLocator?: ReturnType<typeof requirementSetLocator>
  sourceArtifactLocators?: ReturnType<typeof requirementSetLocator>[]
}) {
  return {
    inputFacts: {
      ...(input.requirementSetArtifactLocator
        ? { requirementSetArtifactLocator: input.requirementSetArtifactLocator }
        : {}),
      ...(input.priorGoalGraphProjectionArtifactLocator
        ? { priorGoalGraphProjectionArtifactLocator: input.priorGoalGraphProjectionArtifactLocator }
        : {}),
      sourceArtifactLocators: input.sourceArtifactLocators ?? [],
      observedArtifactLocators: input.sourceArtifactLocators ?? [],
    },
    goals: [],
    removedGoals: [],
    fidelity: { sourceCoverage: [], referenceCoverage: [], assemblyOwners: [] },
    contractGraph: { contracts: [] },
    sessionID: input.sessionID,
    finalMessageID: input.finalMessageID,
  }
}

function seedProjection(input: {
  taskID: string
  requirementSetArtifactLocator: ReturnType<typeof requirementSetLocator>
  priorGoalGraphProjectionArtifactLocator?: ReturnType<typeof requirementSetLocator>
}) {
  return Database.transaction((db) =>
    persistArchitectGoalProjection(db, {
      taskID: input.taskID,
      producer: {
        kind: "architect_turn",
        session_id: Identifier.ascending("session"),
        final_message_id: Identifier.ascending("message"),
      },
      requirementSetArtifactLocator: input.requirementSetArtifactLocator,
      priorGoalGraphProjectionArtifactLocator: input.priorGoalGraphProjectionArtifactLocator,
      observedArtifactLocators: [],
      sourceArtifactLocators: [],
      architectGoals: [],
      removals: [],
      graph: { contracts: [] },
      fidelity: { sourceCoverage: [], referenceCoverage: [], assemblyOwners: [] },
      now: Date.now(),
    }),
  )
}

function recordArchitectLineage(input: { taskID: string; rootSessionID: string; childSessionID: string }) {
  const dispatchID = Identifier.ascending("artifact")
  recordTestDispatchLineage({
    origin: createDispatchLineageOrigin({
      dispatchID,
      taskID: input.taskID,
      orchestratorSessionID: input.rootSessionID,
      orchestratorMessageID: Identifier.ascending("message"),
      toolPartID: Identifier.ascending("part"),
      toolCallID: Identifier.ascending("call"),
      targetAgentID: projectedArchitect.identity.agentID,
      projectedWorkerIdentity: projectedArchitect.identity,
      workScope: { kind: "task" },
      workflowBinding,
      workflowNodeID: "architecture",
      adapterInput: { reason: "Create the accepted architecture" },
    }),
    childSessionID: input.childSessionID,
  })
  return dispatchID
}

async function dispatchArchitect(input: {
  fixture: Awaited<ReturnType<typeof createTask>>
  result: ReturnType<typeof emptyArchitectResult>
  beforeReturn?: () => void
}) {
  const dispatchID = recordArchitectLineage({
    taskID: input.fixture.taskID,
    rootSessionID: input.fixture.root.id,
    childSessionID: input.fixture.child.id,
  })
  const dispatcher = createArchitectStageDispatcher({
    taskID: input.fixture.taskID,
    parentSessionID: input.fixture.root.id,
    coordinateArchitect: async (coordinateInput) => {
      await coordinateInput.onTurnCompleted?.({
        sessionID: input.result.sessionID,
        finalMessageID: input.result.finalMessageID,
      })
      input.beforeReturn?.()
      return input.result
    },
  })
  const outcome = await dispatcher({
    task: requireTask(input.fixture.taskID),
    agentID: projectedArchitect.identity.agentID,
    packageRevision,
    attachmentRefs: [],
    workScope: { kind: "task" },
  })
  recordDispatchSettlement({ taskID: input.fixture.taskID, dispatchID, outcome })
  return { outcome, projection: await describeTask(input.fixture.taskID) }
}

describe("Architect domain-incomplete settlement", () => {
  test("rolls back both Candidate and accepted projection when task.updated publication is rejected", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        Database.use((db) =>
          db.run(
            sql.raw(`
              CREATE TEMP TRIGGER arc019_fail_architect_task_updated
              BEFORE INSERT ON protocol_event
              WHEN NEW.type = 'task.updated' AND NEW.source = 'orchestrator.architect'
              BEGIN SELECT RAISE(ABORT, 'injected architect task.updated commit failure'); END
            `),
          ),
        )
        let conflict: Awaited<ReturnType<typeof dispatchArchitect>>
        let accepted: Awaited<ReturnType<typeof dispatchArchitect>>
        const conflictFixture = await createTask("Atomic Architect Candidate publication")
        const acceptedFixture = await createTask("Atomic Architect projection publication")
        const requirement = requirementSetLocator(acceptedFixture.taskID)
        try {
          conflict = await dispatchArchitect({
            fixture: conflictFixture,
            result: emptyArchitectResult({
              sessionID: conflictFixture.child.id,
              finalMessageID: conflictFixture.final.id,
            }),
          })
          accepted = await dispatchArchitect({
            fixture: acceptedFixture,
            result: emptyArchitectResult({
              sessionID: acceptedFixture.child.id,
              finalMessageID: acceptedFixture.final.id,
              requirementSetArtifactLocator: requirement,
              sourceArtifactLocators: [requirement],
            }),
          })
        } finally {
          Database.use((db) => db.run(sql.raw("DROP TRIGGER arc019_fail_architect_task_updated")))
        }
        expect({
          conflict: conflict.outcome,
          conflictArtifacts: listGoalGraphProjectionArtifacts(conflictFixture.taskID),
          accepted: accepted.outcome,
          acceptedArtifacts: listGoalGraphProjectionArtifacts(acceptedFixture.taskID),
        }).toMatchObject({
          conflict: { kind: "partial", failed_operation: "persist-goals-and-contract-graph" },
          conflictArtifacts: [],
          accepted: { kind: "partial", failed_operation: "persist-goals-and-contract-graph" },
          acceptedArtifacts: [],
        })
      },
    })
  }, 30_000)

  test("preflight conflict preserves its exact Candidate and closes the successor frontier", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createTask("Architect preflight conflict")
        const { outcome, projection } = await dispatchArchitect({
          fixture,
          result: emptyArchitectResult({ sessionID: fixture.child.id, finalMessageID: fixture.final.id }),
        })
        const candidate = listGoalGraphProjectionArtifacts(fixture.taskID).at(-1)
        expect({ outcome, candidate: candidate?.payload, workflow: projection.workflow_execution }).toMatchObject({
          outcome: {
            kind: "domain_incomplete",
            domain: "architect_projection",
            session_id: fixture.child.id,
            final_message_id: fixture.final.id,
            domain_artifact: {
              source: "engine_artifact",
              artifact_id: candidate?.id,
              expected_sha256: candidate?.payload_sha256,
              catalog_revision: candidate?.catalog_revision,
            },
          },
          candidate: {
            projection: null,
            conflicts: [{ code: "requirement_set_not_read" }],
          },
          workflow: {
            nodes: [
              { node_id: "architecture", terminal_success: false },
              { node_id: "implementation", terminal_success: false, dispatches: [] },
            ],
            frontier_node_ids: [],
          },
        })
      },
    })
  }, 30_000)

  test("stale selected tip records the observed current tip and closes the successor frontier", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createTask("Architect projection race")
        const requirement = requirementSetLocator(fixture.taskID)
        const tipA = seedProjection({ taskID: fixture.taskID, requirementSetArtifactLocator: requirement })
        let tipB: ReturnType<typeof seedProjection> | undefined
        const result = emptyArchitectResult({
          sessionID: fixture.child.id,
          finalMessageID: fixture.final.id,
          requirementSetArtifactLocator: requirement,
          priorGoalGraphProjectionArtifactLocator: tipA.goalGraphProjectionArtifactLocator,
          sourceArtifactLocators: [
            requirement,
            tipA.goalGraphProjectionArtifactLocator,
            tipA.contractGraphArtifactLocator,
          ],
        })
        const settled = await dispatchArchitect({
          fixture,
          result,
          beforeReturn: () => {
            tipB = seedProjection({
              taskID: fixture.taskID,
              requirementSetArtifactLocator: requirement,
              priorGoalGraphProjectionArtifactLocator: tipA.goalGraphProjectionArtifactLocator,
            })
          },
        })
        const candidate = listGoalGraphProjectionArtifacts(fixture.taskID).at(-1)
        expect({
          outcome: settled.outcome,
          candidate: candidate?.payload,
          workflow: settled.projection.workflow_execution,
        }).toMatchObject({
          outcome: {
            kind: "domain_incomplete",
            domain_artifact: { artifact_id: candidate?.id },
          },
          candidate: {
            projection: null,
            conflicts: [{ code: "stale_prior_projection" }],
            observed_current_projection_artifact_locator: tipB?.goalGraphProjectionArtifactLocator,
          },
          workflow: {
            nodes: [
              { node_id: "architecture", terminal_success: false },
              { node_id: "implementation", terminal_success: false, dispatches: [] },
            ],
            frontier_node_ids: [],
          },
        })
      },
    })
  }, 30_000)

  test("accepted projection remains terminal success and opens the successor frontier", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createTask("Accepted Architect projection")
        const requirement = requirementSetLocator(fixture.taskID)
        const { outcome, projection } = await dispatchArchitect({
          fixture,
          result: emptyArchitectResult({
            sessionID: fixture.child.id,
            finalMessageID: fixture.final.id,
            requirementSetArtifactLocator: requirement,
            sourceArtifactLocators: [requirement],
          }),
        })
        expect({
          outcome,
          candidates: listGoalGraphProjectionArtifacts(fixture.taskID),
          workflow: projection.workflow_execution,
        }).toMatchObject({
          outcome: { kind: "terminal_success" },
          candidates: [{ payload: { projection: { goal_revision_ids: [] }, conflicts: [] } }],
          workflow: {
            nodes: [
              { node_id: "architecture", terminal_success: true },
              { node_id: "implementation", terminal_success: false, dispatches: [] },
            ],
            frontier_node_ids: ["implementation"],
          },
        })
      },
    })
  }, 30_000)

  test("candidate persistence contract failure remains a post-Turn partial outcome", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createTask("Architect candidate persistence failure")
        const invalidResult = emptyArchitectResult({
          sessionID: fixture.child.id,
          finalMessageID: fixture.final.id,
        })
        invalidResult.goals = [
          {
            id: "candidate-goal",
            title: "",
            objective: "Exercise the canonical Candidate schema boundary",
            acceptance_specs: [],
            owned_paths: [],
            priority: "blocking",
            kind: "feature",
          },
        ]
        const { outcome, projection } = await dispatchArchitect({ fixture, result: invalidResult })
        expect({ outcome, workflow: projection.workflow_execution }).toMatchObject({
          outcome: {
            kind: "partial",
            session_id: fixture.child.id,
            final_message_id: fixture.final.id,
            failed_operation: "persist-goals-and-contract-graph",
            infrastructure_error: {
              source: "engine_artifact",
              artifact_id: expect.any(String),
              expected_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
              catalog_revision: expect.any(Number),
            },
          },
          workflow: {
            nodes: [
              { node_id: "architecture", terminal_success: false },
              { node_id: "implementation", terminal_success: false, dispatches: [] },
            ],
            frontier_node_ids: [],
          },
        })
      },
    })
  }, 30_000)
})
