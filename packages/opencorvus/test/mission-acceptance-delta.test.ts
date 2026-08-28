import { afterEach, describe, expect, test } from "bun:test"
import { materializeMissionAcceptanceGap, renderMissionAcceptanceRepairMessage } from "@/mission/acceptance-gap"
import { createAcceptanceEpochCheckpoint } from "@/mission/acceptance-checkpoint"
import {
  affectedAcceptanceWorkflowNodes,
  readLatestTaskAcceptanceLedger,
  validateTaskAcceptanceLedgerTransition,
  workflowNodeConsumesAcceptanceCriterion,
  type TaskAcceptanceLedgerProjection,
} from "@/mission/acceptance-ledger"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
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
import { renderTaskProjectionContext, renderTaskProjectionDelta } from "@/orchestrator/agent"
import type { TaskDesc } from "@/engine/describe"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
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
const preservedLocator = {
  source: "engine_artifact" as const,
  artifact_id: "art_acceptance_preserved",
  catalog_revision: 3,
  expected_sha256: "c".repeat(64),
}
const workflowBinding = {
  kind: "virtual_workflow",
  workflow_id: "repair",
  package_revision: {
    scope: "built_in",
    project_id: null,
    namespace: "@opencorvus-ai",
    id: "acceptance-repair",
    version: "1.0.0",
    package_digest: "e".repeat(64),
  },
  nodes: [
    { node_id: "planner", agent_id: "planner", depends_on: [] },
    { node_id: "builder", agent_id: "builder", depends_on: ["planner"] },
    { node_id: "tester", agent_id: "tester", depends_on: ["builder"] },
    { node_id: "publisher", agent_id: "publisher", depends_on: ["tester"] },
  ],
} satisfies SelectedWorkflowBinding

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("Mission acceptance delta closure", () => {
  test("materializes one visible repair Message from exact read references", () => {
    const gap = materializeMissionAcceptanceGap({
      gap: {
        gap_id: "gap-builder-receipt",
        current_ledger_revision_artifact_id: null,
        criteria: [
          {
            criterion_id: "receipt",
            disposition: "failed",
            finding: "The receipt contradicts the canonical build output.",
            relied_evidence_read_refs: ["ar_acceptance_first"],
            contradictory_evidence_read_refs: [],
            responsible_workflow_node_id: "builder",
            required_new_evidence_kind: "corrected-receipt",
          },
        ],
        preserved_acceptances: [],
        requested_next_action: "Correct only the receipt and publish its next canonical revision.",
      },
      reviewedTerminalLifecycleReference: terminal,
      evidenceByReadReference: new Map([["ar_acceptance_first", firstLocator]]),
    })
    expect({ gap, message: renderMissionAcceptanceRepairMessage(gap) }).toMatchObject({
      gap: {
        gap_id: "gap-builder-receipt",
        reviewed_terminal_lifecycle_reference: terminal,
        criteria: [
          {
            criterion_id: "receipt",
            responsible_workflow_node_id: "builder",
            relied_evidence_locators: [firstLocator],
          },
        ],
      },
      message: expect.stringContaining("# Mission acceptance repair"),
    })
  })

  test("admits a repeated criterion with new evidence and retains the workflow verification closure", () => {
    const priorGap = {
      gap_id: "gap-builder-r1",
      reviewed_terminal_lifecycle_reference: terminal,
      criteria: [
        {
          criterion_id: "receipt",
          disposition: "failed" as const,
          finding: "The first receipt is incomplete.",
          relied_evidence_locators: [firstLocator],
          contradictory_evidence_locators: [],
          responsible_workflow_node_id: "builder",
          required_new_evidence_kind: "corrected-receipt",
        },
      ],
      preserved_acceptances: [{ criterion_id: "plan", evidence_locators: [preservedLocator] }],
      requested_next_action: "Publish the first corrected receipt.",
    }
    const previous = {
      artifactID: "art_acceptance_ledger_r1",
      revision: {
        protocol: "task-acceptance-ledger-v1",
        revision: 1,
        task_id: "tsk_acceptance",
        execution_epoch: 2,
        previous_revision_artifact_id: null,
        gap: priorGap,
        time_recorded: 1,
      },
    } satisfies TaskAcceptanceLedgerProjection
    const nextGap = validateTaskAcceptanceLedgerTransition({
      taskID: "tsk_acceptance",
      previous,
      workflowBinding,
      gap: {
        ...priorGap,
        gap_id: "gap-builder-r2",
        criteria: [
          {
            ...priorGap.criteria[0],
            finding: "The second receipt still lacks the verifier digest.",
            relied_evidence_locators: [firstLocator, secondLocator],
            repeat_disposition: "repairable_with_new_evidence",
          },
        ],
        requested_next_action: "Add the verifier digest to the current canonical receipt revision.",
      },
    })
    expect({
      gapID: nextGap.gap_id,
      affected: [...affectedAcceptanceWorkflowNodes(workflowBinding, nextGap)].sort(),
      testerConsumes: workflowNodeConsumesAcceptanceCriterion(workflowBinding, "builder", "tester"),
    }).toEqual({
      gapID: "gap-builder-r2",
      affected: ["builder", "publisher", "tester"],
      testerConsumes: true,
    })
  })

  test("moves every prior open criterion into an evidence-preserving accepted or repeated state", () => {
    const priorGap = {
      gap_id: "gap-receipt-open",
      reviewed_terminal_lifecycle_reference: terminal,
      criteria: [
        {
          criterion_id: "receipt",
          disposition: "failed" as const,
          finding: "The receipt is incomplete.",
          relied_evidence_locators: [firstLocator],
          contradictory_evidence_locators: [],
          responsible_workflow_node_id: "builder",
          required_new_evidence_kind: "corrected-receipt",
        },
      ],
      preserved_acceptances: [{ criterion_id: "plan", evidence_locators: [preservedLocator] }],
      requested_next_action: "Correct the receipt.",
    }
    const next = validateTaskAcceptanceLedgerTransition({
      taskID: "tsk_acceptance",
      workflowBinding,
      previous: {
        artifactID: "art_acceptance_ledger_open",
        revision: {
          protocol: "task-acceptance-ledger-v1",
          revision: 1,
          task_id: "tsk_acceptance",
          execution_epoch: 2,
          previous_revision_artifact_id: null,
          gap: priorGap,
          time_recorded: 1,
        },
      },
      gap: {
        gap_id: "gap-publisher-open",
        reviewed_terminal_lifecycle_reference: terminal,
        criteria: [
          {
            criterion_id: "publication",
            disposition: "unresolved",
            finding: "The accepted receipt has not been published.",
            relied_evidence_locators: [secondLocator],
            contradictory_evidence_locators: [],
            responsible_workflow_node_id: "publisher",
            required_new_evidence_kind: "publication-receipt",
          },
        ],
        preserved_acceptances: [
          { criterion_id: "plan", evidence_locators: [preservedLocator] },
          { criterion_id: "receipt", evidence_locators: [firstLocator] },
        ],
        requested_next_action: "Publish the accepted receipt.",
      },
    })
    expect(next).toMatchObject({
      criteria: [{ criterion_id: "publication" }],
      preserved_acceptances: [
        { criterion_id: "plan", evidence_locators: [preservedLocator] },
        { criterion_id: "receipt", evidence_locators: [firstLocator] },
      ],
    })
  })

  test("renders a criterion-bound continuation and a cursor-bound canonical Task delta", () => {
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
        criteria: [
          {
            criterion_id: "receipt",
            disposition: "failed",
            finding: "The receipt still lacks the verifier digest.",
            relied_evidence_locators: [secondLocator],
            contradictory_evidence_locators: [],
            responsible_workflow_node_id: "builder",
            required_new_evidence_kind: "verified-receipt",
          },
        ],
        checkpoint_required: true,
      },
    })
    const continuation = renderDispatchContinuationTurn({
      turn,
      guidance: "Add the verifier digest to the canonical receipt revision.",
    })
    const before = { id: "tsk_acceptance", status: "active", goals: [] } as unknown as TaskDesc
    const after = {
      id: "tsk_acceptance",
      status: "active",
      goals: [{ id: "goal_receipt", title: "Receipt", revision: 2 }],
    } as unknown as TaskDesc
    expect({
      continuation,
      repairEvidence:
        turn.kind === "continuation" && turn.acceptance_repair
          ? acceptanceRepairEvidenceLocators(turn.acceptance_repair)
          : [],
      delta: renderTaskProjectionDelta(before, after),
    }).toEqual({
      continuation: expect.stringContaining("criterion_ids: receipt"),
      repairEvidence: [secondLocator],
      delta: expect.stringContaining('"op":"append","path":"/goals"'),
    })
  })

  test("keeps the frozen full Task baseline visible beside every later canonical delta", () => {
    const baseline = {
      id: "tsk_acceptance",
      title: "Acceptance repair",
      status: "active",
      source: "mission",
      request: "Repair the failed criterion",
      goals: [],
      budget: { max_executor_groups: 4 },
    } satisfies TaskDesc
    const current = {
      ...baseline,
      status: "failed",
    } satisfies TaskDesc
    const first = renderTaskProjectionContext(undefined, baseline)
    const second = renderTaskProjectionContext(first.baseline, current)
    expect({ first: first.labels, second: second.labels, secondParts: second.parts }).toEqual({
      first: ["runtime:orchestrator-live-task-render"],
      second: ["runtime:orchestrator-live-task-baseline", "runtime:orchestrator-live-task-delta"],
      secondParts: [
        expect.stringContaining("projection_mode: full"),
        expect.stringContaining('"op":"replace","path":"/status"'),
      ],
    })
  })

  test("reuses one immutable epoch checkpoint across later worker continuation Messages", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Acceptance checkpoint worker" })
        const firstSource = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          time: { created: Date.now() },
          agent: "base",
          model: { providerID: "firmware", modelID: "gpt-5" },
        })
        const secondSource = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          time: { created: Date.now() + 1 },
          agent: "base",
          model: { providerID: "firmware", modelID: "gpt-5" },
        })
        const gap = materializeMissionAcceptanceGap({
          gap: {
            gap_id: "gap-checkpoint-r1",
            current_ledger_revision_artifact_id: null,
            criteria: [
              {
                criterion_id: "receipt",
                disposition: "failed",
                finding: "The receipt is incomplete.",
                relied_evidence_read_refs: ["ar_acceptance_first"],
                contradictory_evidence_read_refs: [],
                responsible_workflow_node_id: "builder",
                required_new_evidence_kind: "corrected-receipt",
              },
            ],
            preserved_acceptances: [{ criterion_id: "plan", evidence_read_refs: ["ar_acceptance_preserved"] }],
            requested_next_action: "Correct the receipt.",
          },
          reviewedTerminalLifecycleReference: terminal,
          evidenceByReadReference: new Map([
            ["ar_acceptance_first", firstLocator],
            ["ar_acceptance_preserved", preservedLocator],
          ]),
        })
        const common = {
          sessionID: session.id,
          taskID: "tsk_acceptance_checkpoint",
          ledgerRevisionArtifactID: "art_acceptance_ledger_checkpoint",
          gap,
          executionEpoch: 2,
          workflowNodeID: "builder",
        }
        const first = await createAcceptanceEpochCheckpoint({ ...common, source: firstSource })
        const second = await createAcceptanceEpochCheckpoint({ ...common, source: secondSource })
        expect({
          ids: [first.id, second.id],
          originalSource: second.payload.source_user_message_id,
          focus: JSON.parse(String(second.payload.focus)),
        }).toMatchObject({
          ids: [first.id, first.id],
          originalSource: firstSource.id,
          focus: {
            preserved_acceptances: [{ criterion_id: "plan", evidence_locators: [preservedLocator] }],
            open_criteria: [{ criterion_id: "receipt", relied_evidence_locators: [firstLocator] }],
          },
        })
      },
    })
  })

  test("atomically opens the next epoch with its visible Mission Message and first acceptance ledger revision", async () => {
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
        const packageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "base",
          version: "2026.08.28.1",
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
        const boundWorkflow = {
          kind: "virtual_workflow" as const,
          workflow_id: "acceptance-transaction",
          package_revision: {
            scope: "built_in" as const,
            project_id: null,
            namespace: "builtin",
            id: "base",
            version: packageRevision.version,
            package_digest: packageRevision.packageDigest,
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
        const gap = {
          gap_id: "gap-transaction-r1",
          reviewed_terminal_lifecycle_reference: terminalReference,
          criteria: [
            {
              criterion_id: "receipt",
              disposition: "failed" as const,
              finding: "The reviewed receipt is incomplete.",
              relied_evidence_locators: [evidenceLocator],
              contradictory_evidence_locators: [],
              responsible_workflow_node_id: "builder",
              required_new_evidence_kind: "corrected-receipt",
            },
          ],
          preserved_acceptances: [],
          requested_next_action: "Publish the corrected receipt and its new evidence locator.",
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
          acceptanceGap: gap,
          completeEvidenceLocators: [evidenceLocator],
          toolPartID: "prt_acceptance_resume",
        })
        const ledger = readLatestTaskAcceptanceLedger(taskID)
        const messages = await Session.messages({ sessionID: rootSession.id })
        const repairMessage = messages.find((message) => message.info.id === result.message_id)
        expect({
          result: {
            kind: result.kind,
            ledgerArtifactID: result.acceptance_ledger_revision_artifact_id,
            wakeStatus: result.wake_status,
          },
          lifecycle: taskLifecycleProjection(taskID),
          ledger,
          repairMessage: repairMessage && {
            role: repairMessage.info.role,
            author: repairMessage.info.author,
            text: repairMessage.parts.find((part) => part.type === "text")?.text,
          },
        }).toMatchObject({
          result: {
            kind: "resumed",
            ledgerArtifactID: ledger?.artifactID,
          },
          lifecycle: { status: "active", epoch: 2 },
          ledger: {
            revision: {
              protocol: "task-acceptance-ledger-v1",
              revision: 1,
              execution_epoch: 2,
              previous_revision_artifact_id: null,
              gap: { gap_id: gap.gap_id },
            },
          },
          repairMessage: {
            role: "user",
            author: "mission",
            text: expect.stringContaining("# Mission acceptance repair"),
          },
        })
      },
    })
  }, 30_000)
})
