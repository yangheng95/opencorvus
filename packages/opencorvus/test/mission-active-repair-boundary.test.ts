import { afterEach, expect, test } from "bun:test"
import { ArtifactReadInputSchema, type ArtifactReadLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { artifactCatalogAuthority, readTaskArtifact } from "@/artifact-catalog"
import { recordEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { requireTask } from "@/engine/store"
import { terminalTask } from "@/engine/state"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { requireCurrentTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { materializeMissionAcceptanceGap } from "@/mission/acceptance-gap"
import {
  appendTaskAcceptanceLedgerRevisionInTransaction,
  readLatestTaskAcceptanceLedger,
  readTaskAcceptanceLedgerArtifact,
} from "@/mission/acceptance-ledger"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { SessionWake } from "@/session/wake"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { PanelArtifactQuerySchema } from "@/panel/capability"
import {
  currentTaskArtifactObservation,
  assertCurrentTaskArtifactObservation,
  TaskArtifactObservationSchema,
} from "@/engine/task-artifact-observation"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { openMissionThroughRealWake } from "./fixture/mission-opened"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function evidence(taskID: string, label: string, value: unknown): ArtifactReadLocator {
  const artifactID = recordEngineArtifact({
    taskID,
    kind: "expert_output",
    label,
    payload: { scope: "local_protocol_test", value },
    timeCreated: Date.now(),
  })
  const row = Database.use((db) =>
    db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, artifactID)).get(),
  )!
  return {
    source: "engine_artifact",
    artifact_id: row.id,
    catalog_revision: row.catalog_revision,
    expected_sha256: row.payload_sha256,
  }
}

test("Artifact observations bind exactly one lifecycle authority", () => {
  const active = {
    terminal_lifecycle_reference: null,
    active_execution_reference: { openedEventID: "pev_test_observation", executionEpoch: 2 },
  }
  const terminal = { terminal_lifecycle_reference: { terminalEventID: "pev_test_terminal" } }
  expect(TaskArtifactObservationSchema.parse(active)).toEqual(active)
  expect(TaskArtifactObservationSchema.parse(terminal)).toEqual(terminal)
  for (const invalid of [{ terminal_lifecycle_reference: null }, { ...active, ...terminal }]) {
    expect(TaskArtifactObservationSchema.safeParse(invalid)).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ code: "custom", path: ["active_execution_reference"] })] },
    })
  }
})

test("Panel catalog pages bind a first query or an explicit continuation", () => {
  expect(PanelArtifactQuerySchema.parse({ taskID: "local-protocol-test", page_number: 1 })).toMatchObject({
    page_number: 1,
  })
  expect(
    PanelArtifactQuerySchema.parse({ taskID: "local-protocol-test", page_number: 2, cursor: "host-cursor" }),
  ).toMatchObject({ page_number: 2, cursor: "host-cursor" })
  for (const invalid of [{ page_number: 2 }, { page_number: 1, cursor: "host-cursor" }]) {
    expect(PanelArtifactQuerySchema.safeParse({ taskID: "local-protocol-test", ...invalid })).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ code: "custom", path: ["cursor"] })] },
    })
  }
})

// Scripted service-level inputs only. No assistant Messages, Tool outcomes, or
// Provider replies are fabricated. Worker decisions and transport are not covered.
test("Mission inspects active repair evidence while formal mutation retains its terminal authority", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    init: InstanceBootstrap,
    fn: async () => {
      using _taskLoop = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
      const mission = await ensureMissionSession({
        missionID: "mission-local-protocol-repair",
        defaultCwd: project.path,
        productPillar: "code",
        heldExpertSquadIDs: ["base"],
      })
      const opened = await openMissionThroughRealWake({
        missionID: mission.missionID,
        sessionID: mission.id,
        source: "mission.dispatch",
        requestID: "local-protocol-test:open",
      })
      using _missionLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      const taskID = await EngineService.createTask(
        {
          requestID: Identifier.ascending("artifact"),
          title: "Local protocol test A and B",
          request: "LOCAL PROTOCOL TEST: A is a supplied input claim; initialization B is incomplete.",
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
      let activeObservation: ReturnType<typeof currentTaskArtifactObservation> | undefined
      try {
        const originalA = evidence(taskID, "local-protocol-test-A", { criterion: "A", input: "original" })
        const reviewedA = evidence(taskID, "local-protocol-test-A-review", {
          criterion: "A",
          reviewed_input: originalA,
          decision: "accepted test precondition",
        })
        const missingB = evidence(taskID, "local-protocol-test-B", { criterion: "B", initialization: "missing" })
        const task = requireTask(taskID)
        await terminalTask(
          task,
          {
            status: "failed",
            error: "LOCAL PROTOCOL TEST: initialization B is incomplete",
            time_started: task.time_started ?? Date.now(),
            time_completed: Date.now(),
          },
          "Local protocol test precondition: failed initialization",
        )
        const terminal = requireCurrentTerminalLifecycleReference(taskID)
        const terminalObservation = currentTaskArtifactObservation(taskID)
        expect(terminalObservation).toEqual({ terminal_lifecycle_reference: terminal })
        const importer = { missionID: mission.missionID, sessionID: mission.id }
        for (const locator of [originalA, reviewedA, missingB]) {
          const read = await EngineService.readMissionTaskArtifact({
            taskID,
            importer,
            read: ArtifactReadInputSchema.parse({ locator }),
          })
          expect(read).toMatchObject({ chunk: { complete: true, locator } })
          expect(JSON.parse(read.chunk!.text!)).toMatchObject({ scope: "local_protocol_test" })
        }
        const responsibility = { kind: "task_initialization" as const, failure_reference: terminal }
        const originalGap = materializeMissionAcceptanceGap({
          reviewedTerminalLifecycleReference: terminal,
          evidenceByReadReference: new Map([
            ["ar_local_protocol_A", originalA],
            ["ar_local_protocol_A_review", reviewedA],
            ["ar_local_protocol_B", missingB],
          ]),
          gap: {
            gap_id: "local-protocol-A-accepted-B-open",
            current_ledger_revision_artifact_id: null,
            criteria: [
              {
                criterion_id: "A",
                state: "accepted",
                finding: "Local test input A was accepted.",
                responsibility,
                observation_evidence_read_refs: ["ar_local_protocol_A"],
                repair_evidence_read_refs: [],
                resolution_evidence_read_refs: ["ar_local_protocol_A_review"],
                invalidating_evidence_read_refs: [],
                irreducible_blocker_evidence_read_refs: [],
              },
              {
                criterion_id: "B",
                state: "open",
                disposition: "unresolved",
                finding: "Initialization B is incomplete.",
                responsibility,
                observation_evidence_read_refs: ["ar_local_protocol_B"],
                repair_evidence_read_refs: [],
                resolution_evidence_read_refs: [],
                invalidating_evidence_read_refs: [],
                irreducible_blocker_evidence_read_refs: [],
                repair_action: {
                  operation: "initialize",
                  target: "B",
                  expected_evidence_kind: "initialized-B",
                  parameters: {},
                },
              },
            ],
          },
        })
        // Native API call identities belong to this test driver, not to invented model Tool calls.
        const firstInput = {
          taskID,
          importer: {
            ...importer,
            messageID: "msg_local_protocol_driver",
            toolCallID: "local-protocol-driver:first-review",
          },
          toolPartID: "prt_local_protocol_driver",
          reviewedTerminalLifecycleReference: terminal,
          expectedAcceptanceLedgerArtifactID: null,
          acceptanceGap: originalGap,
          completeEvidenceLocators: [originalA, reviewedA, missingB],
        }
        const first = await EngineService.resumeMissionTask(firstInput)
        const originalLedger = readLatestTaskAcceptanceLedger(taskID)!
        activeObservation = currentTaskArtifactObservation(taskID)
        expect(activeObservation).toEqual({
          terminal_lifecycle_reference: null,
          active_execution_reference: {
            openedEventID: taskLifecycleProjection(taskID).openedEventID,
            executionEpoch: 2,
          },
        })
        expect(() => assertCurrentTaskArtifactObservation(taskID, terminalObservation, "protocol test")).toThrow(
          `terminal occurrence changed for Task ${taskID}`,
        )
        expect({ lifecycle: taskLifecycleProjection(taskID), ledger: originalLedger.revision }).toMatchObject({
          lifecycle: { status: "active", epoch: 2 },
          ledger: {
            revision: 1,
            execution_epoch: 2,
            gap: {
              criteria: [
                { criterion_id: "A", state: "accepted" },
                { criterion_id: "B", state: "open" },
              ],
            },
          },
        })
        const contraryA = evidence(taskID, "local-protocol-test-A-new-fact", { criterion: "A", input: "corrected" })
        const taskRead = await readTaskArtifact({
          authority: artifactCatalogAuthority(taskID),
          read: ArtifactReadInputSchema.parse({ locator: contraryA }),
        })
        expect(taskRead).toMatchObject({ chunk: { complete: true, locator: contraryA } })
        expect(JSON.parse(taskRead.chunk!.text!)).toEqual({
          scope: "local_protocol_test",
          value: { criterion: "A", input: "corrected" },
        })
        const missionRead = await EngineService.readMissionTaskArtifact({
          taskID,
          importer,
          read: ArtifactReadInputSchema.parse({ locator: contraryA }),
        })
        expect(missionRead).toEqual(taskRead)
        expect(() => EngineService.requireMissionArtifactSource(taskID, importer)).toThrow(
          `Cross-Task Artifact source ${taskID} is not terminal`,
        )
        await expect(
          EngineService.readMissionTaskArtifact({
            taskID,
            importer: { ...importer, missionID: "unrelated-mission" },
            read: ArtifactReadInputSchema.parse({ locator: contraryA }),
          }),
        ).rejects.toThrow(`outside Mission unrelated-mission lineage`)

        const attemptedGap = materializeMissionAcceptanceGap({
          reviewedTerminalLifecycleReference: terminal,
          evidenceByReadReference: new Map([
            ["ar_local_protocol_A", originalA],
            ["ar_local_protocol_A_review", reviewedA],
            ["ar_local_protocol_B", missingB],
            ["ar_local_protocol_new_A", contraryA],
          ]),
          gap: {
            gap_id: "local-protocol-A-invalidated",
            current_ledger_revision_artifact_id: originalLedger.artifactID,
            criteria: [
              {
                criterion_id: "A",
                state: "open",
                disposition: "stale_evidence",
                finding: "Local new input contradicts the accepted A input.",
                responsibility,
                observation_evidence_read_refs: ["ar_local_protocol_A"],
                repair_evidence_read_refs: [],
                resolution_evidence_read_refs: ["ar_local_protocol_A_review"],
                invalidating_evidence_read_refs: ["ar_local_protocol_new_A"],
                irreducible_blocker_evidence_read_refs: [],
                repair_action: {
                  operation: "reconcile",
                  target: "A",
                  expected_evidence_kind: "reconciled-A",
                  parameters: {},
                },
              },
              {
                criterion_id: "B",
                state: "open",
                disposition: "unresolved",
                finding: "Initialization B is incomplete.",
                responsibility,
                observation_evidence_read_refs: ["ar_local_protocol_B"],
                repair_evidence_read_refs: [],
                resolution_evidence_read_refs: [],
                invalidating_evidence_read_refs: [],
                irreducible_blocker_evidence_read_refs: [],
                repair_action: {
                  operation: "initialize",
                  target: "B",
                  expected_evidence_kind: "initialized-B",
                  parameters: {},
                },
              },
            ],
          },
        })
        await expect(
          EngineService.resumeMissionTask({
            ...firstInput,
            importer: {
              ...importer,
              messageID: "msg_local_protocol_driver_next",
              toolCallID: "local-protocol-driver:active-review",
            },
            toolPartID: "prt_local_protocol_driver_next",
            expectedAcceptanceLedgerArtifactID: originalLedger.artifactID,
            acceptanceGap: attemptedGap,
            completeEvidenceLocators: [originalA, reviewedA, missingB, contraryA],
          }),
        ).rejects.toMatchObject({
          name: "MissionTaskResumeLifecycleConflictError",
          data: { taskID, currentLifecycle: "active", reviewedTerminalLifecycleReference: terminal },
        })
        const replay = await EngineService.resumeMissionTask(firstInput)
        expect({
          receipt: replay.receipt_artifact_id,
          message: replay.message_id,
          ledger: readLatestTaskAcceptanceLedger(taskID),
          lifecycle: taskLifecycleProjection(taskID),
        }).toMatchObject({
          receipt: first.receipt_artifact_id,
          message: first.message_id,
          ledger: originalLedger,
          lifecycle: { status: "active", epoch: 2 },
        })
        // Domain-writer contract only: this driver does not grant Mission a new
        // active API, synthesize a participant decision, or change the Task epoch.
        const revisionID = Identifier.ascending("artifact")
        const revised = Database.immediateTransaction((db) => appendTaskAcceptanceLedgerRevisionInTransaction({
          db, taskID, artifactID: revisionID, executionEpoch: 2,
          expectedPreviousArtifactID: originalLedger.artifactID, gap: attemptedGap, now: Date.now(),
        }))
        expect(revised.revision).toMatchObject({ revision: 2, execution_epoch: 2,
          previous_revision_artifact_id: originalLedger.artifactID,
          gap: { criteria: [{ criterion_id: "A", state: "open", disposition: "stale_evidence" }, originalGap.criteria[1]] },
        })
        expect(readTaskAcceptanceLedgerArtifact(taskID, originalLedger.artifactID)).toEqual(originalLedger)
        expect(() => Database.immediateTransaction((db) => appendTaskAcceptanceLedgerRevisionInTransaction({
          db, taskID, artifactID: Identifier.ascending("artifact"), executionEpoch: 2,
          expectedPreviousArtifactID: originalLedger.artifactID, gap: attemptedGap, now: Date.now(),
        }))).toThrow(`Task ${taskID} acceptance ledger changed; query the current Task before resuming.`)
        expect(() => Database.immediateTransaction((db) => appendTaskAcceptanceLedgerRevisionInTransaction({
          db, taskID, artifactID: Identifier.ascending("artifact"), executionEpoch: 2,
          expectedPreviousArtifactID: revisionID, gap: { ...attemptedGap, gap_id: "renamed-without-progress" }, now: Date.now(),
        }))).toThrow("Acceptance ledger revision requires at least one new or changed criterion.")
        expect({ ledger: readLatestTaskAcceptanceLedger(taskID), lifecycle: taskLifecycleProjection(taskID) })
          .toMatchObject({ ledger: revised, lifecycle: { status: "active", epoch: 2 } })
      } finally {
        if (taskLifecycleProjection(taskID).status === "active") {
          await EngineService.cancelTask(taskID, {
            origin: {
              actor: "user",
              source: "task.cancel",
              surface: "api",
              requestID: "local-protocol-test:cleanup",
              reason: "Finish isolated protocol test",
            },
          })
        }
      }
      expect(taskLifecycleProjection(taskID)).toMatchObject({ status: "cancelled", epoch: 2 })
      expect(() => assertCurrentTaskArtifactObservation(taskID, activeObservation!, "protocol test")).toThrow(
        `active execution changed for Task ${taskID}`,
      )
    },
  })
}, 60_000)
