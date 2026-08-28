import { createHash } from "node:crypto"
import { afterEach, describe, expect, test } from "bun:test"
import {
  materializeMissionAcceptanceGap,
  renderMissionAcceptanceRepairMessage,
  type MissionAcceptanceGap,
  type MissionAcceptanceOpenCriterion,
} from "@/mission/acceptance-gap"
import {
  createAcceptanceEpochCheckpoint,
  currentAcceptanceEpochCheckpoint,
} from "@/mission/acceptance-checkpoint"
import {
  affectedAcceptanceWorkflowNodes,
  dispatchConsumesAcceptanceCriterion,
  readLatestTaskAcceptanceLedger,
  validateTaskAcceptanceLedgerTransition,
  workflowNodeConsumesAcceptanceCriterion,
  type TaskAcceptanceLedgerProjection,
} from "@/mission/acceptance-ledger"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import type { DispatchLineageRow } from "@/engine/dispatch-lineage-facts"
import { recordEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { requireTask } from "@/engine/store"
import { terminalTask } from "@/engine/state"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { requireCurrentTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import {
  acceptanceRepairEvidenceLocators,
  renderDispatchContinuationTurn,
  DispatchTurnSchema,
} from "@/orchestrator/dispatch-turn-projection"
import {
  applyTaskProjectionDelta,
  renderTaskProjectionContext,
  renderTaskProjectionDelta,
} from "@/orchestrator/agent"
import type { TaskDesc } from "@/engine/describe"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionControl } from "@/session/control"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { canonicalJSONValue } from "@/util/canonical-digest"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const terminal = { terminalEventID: "pev_acceptance_terminal" }
const firstLocator = {
  source: "engine_artifact" as const,
  artifact_id: "art_acceptance_first",
  catalog_revision: 1,
  expected_sha256: "a".repeat(64),
}
const secondLocator = {
  source: "engine_artifact" as const,
  artifact_id: "art_acceptance_second",
  catalog_revision: 2,
  expected_sha256: "b".repeat(64),
}
const thirdLocator = {
  source: "engine_artifact" as const,
  artifact_id: "art_acceptance_third",
  catalog_revision: 3,
  expected_sha256: "c".repeat(64),
}
const fourthLocator = {
  source: "engine_artifact" as const,
  artifact_id: "art_acceptance_fourth",
  catalog_revision: 4,
  expected_sha256: "d".repeat(64),
}
const packageRevision = {
  scope: "built_in" as const,
  project_id: null,
  namespace: "@opencorvus-ai",
  id: "acceptance-repair",
  version: "1.0.0",
  package_digest: "e".repeat(64),
}
const workflowBinding = {
  kind: "virtual_workflow",
  workflow_id: "repair",
  package_revision: packageRevision,
  nodes: [
    { node_id: "planner", agent_id: "planner", depends_on: [] },
    { node_id: "builder", agent_id: "builder", depends_on: ["planner"] },
    { node_id: "tester", agent_id: "tester", depends_on: ["builder"] },
    { node_id: "publisher", agent_id: "publisher", depends_on: ["tester"] },
  ],
} satisfies SelectedWorkflowBinding
const builderResponsibility = {
  kind: "workflow_node" as const,
  workflow_id: workflowBinding.workflow_id,
  workflow_node_id: "builder",
}

function repairAction(sequence: number) {
  return {
    operation: "correct_artifact",
    target: "build-receipt",
    expected_evidence_kind: "verified-receipt",
    parameters: { sequence },
  }
}

function repairActionIdentity(sequence: number) {
  const action = repairAction(sequence)
  return {
    ...action,
    identity_sha256: createHash("sha256")
      .update(canonicalJSONValue(action, "mission-acceptance-repair-action-v1"))
      .digest("hex"),
  }
}

function openCriterion(input: {
  observation?: typeof firstLocator[]
  repair?: typeof firstLocator[]
  resolution?: typeof firstLocator[]
  invalidating?: typeof firstLocator[]
  irreducibleBlocker?: typeof firstLocator[]
  actionSequence?: number
  disposition?: "failed" | "unresolved" | "stale_evidence"
  criterionID?: string
  responsibility?: MissionAcceptanceOpenCriterion["responsibility"]
} = {}): MissionAcceptanceOpenCriterion {
  return {
    criterion_id: input.criterionID ?? "receipt",
    state: "open",
    disposition: input.disposition ?? "failed",
    finding: "The current receipt does not satisfy the acceptance contract.",
    responsibility: input.responsibility ?? builderResponsibility,
    observation_evidence_locators: input.observation ?? [firstLocator],
    repair_evidence_locators: input.repair ?? [],
    resolution_evidence_locators: input.resolution ?? [],
    invalidating_evidence_locators: input.invalidating ?? [],
    irreducible_blocker_evidence_locators: input.irreducibleBlocker ?? [],
    repair_action: repairActionIdentity(input.actionSequence ?? 1),
  }
}

function gap(criteria: MissionAcceptanceGap["criteria"], gapID = "gap-acceptance"): MissionAcceptanceGap {
  return { gap_id: gapID, reviewed_terminal_lifecycle_reference: terminal, criteria }
}

function ledgerProjection(criteria: MissionAcceptanceGap["criteria"]): TaskAcceptanceLedgerProjection {
  return {
    artifactID: "art_acceptance_ledger_r1",
    revision: {
      protocol: "task-acceptance-ledger-v2",
      revision: 1,
      task_id: "tsk_acceptance",
      execution_epoch: 2,
      previous_revision_artifact_id: null,
      gap: gap(criteria, "gap-r1"),
      time_recorded: 1,
    },
  }
}

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("Mission acceptance baseline readiness", () => {
  test("materializes one visible typed repair state from exact read references", () => {
    const materialized = materializeMissionAcceptanceGap({
      gap: {
        gap_id: "gap-builder-receipt",
        current_ledger_revision_artifact_id: null,
        criteria: [
          {
            criterion_id: "receipt",
            state: "open",
            disposition: "failed",
            finding: "The receipt contradicts the canonical build output.",
            responsibility: builderResponsibility,
            observation_evidence_read_refs: ["ar_acceptance_first"],
            repair_evidence_read_refs: [],
            resolution_evidence_read_refs: [],
            invalidating_evidence_read_refs: [],
            irreducible_blocker_evidence_read_refs: [],
            repair_action: repairAction(1),
          },
        ],
      },
      reviewedTerminalLifecycleReference: terminal,
      evidenceByReadReference: new Map([["ar_acceptance_first", firstLocator]]),
    })
    expect({ gap: materialized, message: renderMissionAcceptanceRepairMessage(materialized) }).toMatchObject({
      gap: {
        criteria: [
          {
            criterion_id: "receipt",
            state: "open",
            responsibility: builderResponsibility,
            observation_evidence_locators: [firstLocator],
            repair_action: { identity_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
          },
        ],
      },
      message: expect.stringContaining("# Mission acceptance repair"),
    })
  })

  test("reduces open criteria through new-evidence, accepted, blocked, and stale-reopen transitions", () => {
    const repeated = validateTaskAcceptanceLedgerTransition({
      taskID: "tsk_acceptance",
      previous: ledgerProjection([openCriterion()]),
      workflowBinding,
      gap: gap([openCriterion({ observation: [firstLocator, secondLocator], actionSequence: 1 })], "gap-r2"),
    })
    expect([...affectedAcceptanceWorkflowNodes(workflowBinding, repeated)].sort()).toEqual([
      "builder",
      "publisher",
      "tester",
    ])
    expect(workflowNodeConsumesAcceptanceCriterion(workflowBinding, "builder", "tester")).toBe(true)

    const accepted = {
      criterion_id: "receipt",
      state: "accepted" as const,
      finding: "The corrected receipt is verified.",
      responsibility: builderResponsibility,
      observation_evidence_locators: [firstLocator],
      repair_evidence_locators: [],
      resolution_evidence_locators: [secondLocator],
      invalidating_evidence_locators: [],
      irreducible_blocker_evidence_locators: [],
    }
    const sentinel = openCriterion({ criterionID: "publication", responsibility: { ...builderResponsibility, workflow_node_id: "publisher" }, observation: [thirdLocator] })
    const acceptedGap = validateTaskAcceptanceLedgerTransition({
      taskID: "tsk_acceptance",
      previous: ledgerProjection([openCriterion()]),
      workflowBinding,
      gap: gap([accepted, sentinel], "gap-accepted"),
    })
    const stale = openCriterion({
      observation: [firstLocator],
      resolution: [secondLocator],
      invalidating: [fourthLocator],
      disposition: "stale_evidence",
      actionSequence: 2,
    })
    const reopened = validateTaskAcceptanceLedgerTransition({
      taskID: "tsk_acceptance",
      previous: ledgerProjection(acceptedGap.criteria),
      workflowBinding,
      gap: gap(
        [
          stale,
          openCriterion({
            criterionID: "publication",
            responsibility: { ...builderResponsibility, workflow_node_id: "publisher" },
            observation: [thirdLocator],
            actionSequence: 2,
          }),
        ],
        "gap-stale",
      ),
    })
    expect(reopened.criteria[0]).toMatchObject({ state: "open", disposition: "stale_evidence" })

    const blocked = validateTaskAcceptanceLedgerTransition({
      taskID: "tsk_acceptance",
      previous: ledgerProjection([openCriterion()]),
      workflowBinding,
      gap: gap([
        {
          criterion_id: "receipt",
          state: "blocked",
          finding: "The upstream signed source is permanently unavailable.",
          responsibility: builderResponsibility,
          observation_evidence_locators: [firstLocator],
          repair_evidence_locators: [],
          resolution_evidence_locators: [],
          invalidating_evidence_locators: [],
          irreducible_blocker_evidence_locators: [secondLocator],
        },
        sentinel,
      ]),
    })
    expect(blocked.criteria[0]).toMatchObject({ state: "blocked", irreducible_blocker_evidence_locators: [secondLocator] })
  })

  test("binds a direct acceptance criterion to its exact immutable dispatch lineage", () => {
    const directBinding = { kind: "direct" as const, package_revision: packageRevision }
    const responsibility = {
      kind: "direct_dispatch" as const,
      package_revision: packageRevision,
      agent_id: "builder",
      dispatch_lineage_id: "art_direct_lineage",
    }
    const lineage = {
      artifactID: responsibility.dispatch_lineage_id,
      taskID: "tsk_acceptance",
      dispatchID: "dispatch-direct",
      timeCreated: 1,
      payload: {
        target_agent_id: responsibility.agent_id,
        workflow_node_id: null,
        workflow_binding: directBinding,
      },
    } as DispatchLineageRow
    const directGap = validateTaskAcceptanceLedgerTransition({
      taskID: "tsk_acceptance",
      previous: undefined,
      workflowBinding: directBinding,
      gap: gap([openCriterion({ responsibility })]),
      dispatchLineageByArtifactID: (artifactID) => (artifactID === lineage.artifactID ? lineage : undefined),
    })
    expect({
      admitted: directGap.criteria[0].responsibility,
      exact: dispatchConsumesAcceptanceCriterion({
        binding: directBinding,
        responsibility,
        candidateWorkflowNodeID: null,
        sourceDispatchLineageArtifactID: lineage.artifactID,
        targetAgentID: "builder",
      }),
      foreign: dispatchConsumesAcceptanceCriterion({
        binding: directBinding,
        responsibility,
        candidateWorkflowNodeID: null,
        sourceDispatchLineageArtifactID: "art_foreign_lineage",
        targetAgentID: "builder",
      }),
    }).toEqual({ admitted: responsibility, exact: true, foreign: false })
  })

  test("renders an open criterion continuation and applies the exact canonical Task delta", () => {
    const criterion = openCriterion({ observation: [secondLocator] })
    const turn = DispatchTurnSchema.parse({
      kind: "continuation",
      current_dispatch_id: "dispatch_builder_r2",
      source_dispatch_id: "dispatch_builder_r1",
      child_session_id: "ses_builder_repair",
      workflow_binding: workflowBinding,
      workflow_node_id: "builder",
      workflow_occurrence_id: "occ_builder",
      delivery_slice_revision_ids: [],
      evidence_locators: [secondLocator],
      task_authority: {
        task_id: "tsk_acceptance",
        root_session_id: "ses_task_root",
        request_sha256: "c".repeat(64),
        initial_user_message_id: "msg_task_request",
        initial_control_text_parts: [{ part_id: "prt_task_request", text_sha256: "d".repeat(64) }],
      },
      acceptance_repair: {
        gap_id: "gap-builder-r2",
        ledger_revision_artifact_id: "art_acceptance_ledger_r2",
        execution_epoch: 3,
        criteria: [criterion],
        checkpoint_required: true,
      },
    })
    const continuation = renderDispatchContinuationTurn({ turn, guidance: "Add the verifier digest." })
    const before = { id: "tsk_acceptance", status: "active", goals: [] } as unknown as TaskDesc
    const after = {
      id: "tsk_acceptance",
      status: "active",
      goals: [{ id: "goal_receipt", title: "Receipt", revision: 2 }],
    } as unknown as TaskDesc
    const delta = renderTaskProjectionDelta(before, after)
    expect({
      continuation,
      repairEvidence: turn.kind === "continuation" && turn.acceptance_repair ? acceptanceRepairEvidenceLocators(turn.acceptance_repair) : [],
      baseline: JSON.parse(renderTaskProjectionContext(undefined, before).parts[0]!),
      applied: applyTaskProjectionDelta(before, delta),
    }).toEqual({
      continuation: expect.stringContaining("criterion_ids: receipt"),
      repairEvidence: [secondLocator],
      baseline: before,
      applied: after,
    })
  })

  test("keeps baseline plus an applicable delta on the first and every later Provider step", () => {
    const baseline = {
      id: "tsk_acceptance",
      title: "Acceptance repair",
      status: "active",
      source: "mission",
      request: "Repair the failed criterion",
      goals: [],
      budget: { max_executor_groups: 4 },
    } satisfies TaskDesc
    const current = { ...baseline, status: "failed" } satisfies TaskDesc
    const first = renderTaskProjectionContext(undefined, baseline)
    const second = renderTaskProjectionContext(first.baseline, current)
    expect({
      firstLabels: first.labels,
      firstParts: first.parts.length,
      firstApplied: applyTaskProjectionDelta(JSON.parse(first.parts[0]!), first.parts[1]!),
      secondLabels: second.labels,
      secondApplied: applyTaskProjectionDelta(JSON.parse(second.parts[0]!), second.parts[1]!),
    }).toEqual({
      firstLabels: ["runtime:orchestrator-live-task-baseline", "runtime:orchestrator-live-task-delta"],
      firstParts: 2,
      firstApplied: baseline,
      secondLabels: ["runtime:orchestrator-live-task-baseline", "runtime:orchestrator-live-task-delta"],
      secondApplied: current,
    })
  })

  test("creates a new immutable checkpoint attempt after failure and projects the successful binding", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Acceptance checkpoint worker" })
        const source = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          time: { created: Date.now() },
          agent: "base",
          model: { providerID: "firmware", modelID: "gpt-5" },
        })
        const common = {
          sessionID: session.id,
          taskID: "tsk_acceptance_checkpoint",
          ledgerRevisionArtifactID: "art_acceptance_ledger_checkpoint",
          gap: gap([openCriterion()]),
          executionEpoch: 2,
          workflowNodeID: "builder",
        }
        const first = await createAcceptanceEpochCheckpoint({ ...common, source })
        SessionControl.fail({ id: first.control.id, sessionID: session.id, error: "provider interrupted" })
        const second = await createAcceptanceEpochCheckpoint({ ...common, source })
        SessionControl.consume({
          id: second.control.id,
          sessionID: session.id,
          payload: { ...second.control.payload, result_summary_message_id: "msg_acceptance_summary" },
        })
        const current = currentAcceptanceEpochCheckpoint({
          sessionID: session.id,
          logicalCheckpointID: first.logicalCheckpointID,
        })
        const reused = await createAcceptanceEpochCheckpoint({ ...common, source })
        expect({
          logical: [first.logicalCheckpointID, second.logicalCheckpointID],
          attempts: [first.attempt, second.attempt],
          ids: [first.control.id, second.control.id, reused.control.id],
          current,
        }).toMatchObject({
          logical: [first.logicalCheckpointID, first.logicalCheckpointID],
          attempts: [1, 2],
          ids: [first.control.id, second.control.id, second.control.id],
          current: { attempt: 2, control: { status: "consumed" }, successfulSummaryMessageID: "msg_acceptance_summary" },
        })
      },
    })
  })

  test("atomically opens the next epoch with its Mission Message and v2 ledger revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-acceptance-transaction",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const taskID = Identifier.ascending("task")
        const rootSession = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Acceptance transaction",
          metadata: { configOverlay: { model: "firmware/gpt-5", prompt_profile: { active: "base" } } },
        })
        const now = Date.now()
        const revision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "base",
          version: "2026.08.29.1",
          packageDigest: "f".repeat(64),
        }
        persistEstablishedTask({
          taskID,
          rootSession,
          now,
          title: "Acceptance transaction",
          request: "Repair only the failed acceptance criterion",
          productPillar: "work",
          source: "mission",
          metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } },
          projectID: Instance.project.id,
          packageRevision: revision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: revision.packageDigest,
            timeCreated: now,
          }),
        })
        const boundWorkflow = {
          kind: "virtual_workflow" as const,
          workflow_id: "acceptance-transaction",
          package_revision: {
            scope: "built_in" as const,
            project_id: null,
            namespace: "builtin",
            id: "base",
            version: revision.version,
            package_digest: revision.packageDigest,
          },
          nodes: [{ node_id: "builder", agent_id: "base", depends_on: [] }],
        }
        recordEngineArtifact({
          taskID,
          kind: "task_completion_decision",
          label: "accepted-terminal-binding",
          payload: { workflow_binding: boundWorkflow },
          timeCreated: now + 1,
        })
        const evidenceArtifactID = recordEngineArtifact({
          taskID,
          kind: "expert_output",
          label: "reviewed-evidence",
          payload: { criterion: "receipt", accepted: false },
          timeCreated: now + 2,
        })
        const evidenceRow = Database.use((db) =>
          db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, evidenceArtifactID)).get(),
        )!
        const evidenceLocator = {
          source: "engine_artifact" as const,
          artifact_id: evidenceRow.id,
          catalog_revision: evidenceRow.catalog_revision,
          expected_sha256: evidenceRow.payload_sha256,
        }
        await terminalTask(
          requireTask(taskID),
          { status: "failed", error: "Initial receipt was incomplete", time_started: now, time_completed: now + 3 },
          "Initial delivery failed acceptance",
        )
        const terminalReference = requireCurrentTerminalLifecycleReference(taskID)
        const acceptanceGap = {
          gap_id: "gap-transaction-r1",
          reviewed_terminal_lifecycle_reference: terminalReference,
          criteria: [
            {
              ...openCriterion({
                observation: [evidenceLocator as typeof firstLocator],
                responsibility: {
                  kind: "workflow_node" as const,
                  workflow_id: boundWorkflow.workflow_id,
                  workflow_node_id: "builder",
                },
              }),
              finding: "The reviewed receipt is incomplete.",
            },
          ],
        }
        using _ingressRunner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const result = await EngineService.resumeMissionTask({
          taskID,
          importer: {
            missionID: mission.missionID,
            sessionID: mission.id,
            messageID: "msg_acceptance_panel",
            toolCallID: "call_acceptance_resume",
          },
          reviewedTerminalLifecycleReference: terminalReference,
          expectedAcceptanceLedgerArtifactID: null,
          acceptanceGap,
          completeEvidenceLocators: [evidenceLocator],
          toolPartID: "prt_acceptance_resume",
        })
        const ledger = readLatestTaskAcceptanceLedger(taskID)
        const messages = await Session.messages({ sessionID: rootSession.id })
        const repairMessage = messages.find((message) => message.info.id === result.message_id)
        expect({
          result,
          lifecycle: taskLifecycleProjection(taskID),
          ledger,
          repairText: repairMessage?.parts.find((part) => part.type === "text")?.text,
        }).toMatchObject({
          result: { kind: "resumed", acceptance_ledger_revision_artifact_id: ledger?.artifactID },
          lifecycle: { status: "active", epoch: 2 },
          ledger: { revision: { protocol: "task-acceptance-ledger-v2", revision: 1, execution_epoch: 2 } },
          repairText: expect.stringContaining("# Mission acceptance repair"),
        })
      },
    })
  }, 30_000)
})
