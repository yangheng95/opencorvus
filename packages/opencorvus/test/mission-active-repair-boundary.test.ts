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
import { readLatestTaskAcceptanceLedger } from "@/mission/acceptance-ledger"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { SessionWake } from "@/session/wake"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { openMissionThroughRealWake } from "./fixture/mission-opened"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function evidence(taskID: string, label: string, value: unknown): ArtifactReadLocator {
  const artifactID = recordEngineArtifact({
    taskID, kind: "expert_output", label,
    payload: { scope: "local_protocol_test", value }, timeCreated: Date.now(),
  })
  const row = Database.use((db) => db.select().from(EngineArtifactTable)
    .where(eq(EngineArtifactTable.id, artifactID)).get())!
  return { source: "engine_artifact", artifact_id: row.id,
    catalog_revision: row.catalog_revision, expected_sha256: row.payload_sha256 }
}

// Scripted service-level inputs only. No assistant Messages, Tool outcomes, or
// Provider replies are fabricated. Worker decisions and transport are not covered.
test("public Mission API exposes the active repair evidence and revision boundary", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, init: InstanceBootstrap, fn: async () => {
    using _taskLoop = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
    const mission = await ensureMissionSession({
      missionID: "mission-local-protocol-repair", defaultCwd: project.path,
      productPillar: "code", heldExpertSquadIDs: ["base"],
    })
    const opened = await openMissionThroughRealWake({
      missionID: mission.missionID, sessionID: mission.id,
      source: "mission.dispatch", requestID: "local-protocol-test:open",
    })
    using _missionLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
    const taskID = await EngineService.createTask({
      requestID: Identifier.ascending("artifact"), title: "Local protocol test A and B",
      request: "LOCAL PROTOCOL TEST: A is a supplied input claim; initialization B is incomplete.",
      productPillar: "code", model: "firmware/gpt-5", promptProfile: "base",
    }, { actor: "mission", sessionID: mission.id,
      openedOccurrence: { eventID: opened.eventID, operationID: opened.operationID } })
    try {
      const originalA = evidence(taskID, "local-protocol-test-A", { criterion: "A", input: "original" })
      const reviewedA = evidence(taskID, "local-protocol-test-A-review", {
        criterion: "A", reviewed_input: originalA, decision: "accepted test precondition",
      })
      const missingB = evidence(taskID, "local-protocol-test-B", { criterion: "B", initialization: "missing" })
      const task = requireTask(taskID)
      await terminalTask(task, {
        status: "failed", error: "LOCAL PROTOCOL TEST: initialization B is incomplete",
        time_started: task.time_started ?? Date.now(), time_completed: Date.now(),
      }, "Local protocol test precondition: failed initialization")
      const terminal = requireCurrentTerminalLifecycleReference(taskID)
      const importer = { missionID: mission.missionID, sessionID: mission.id }
      for (const locator of [originalA, reviewedA, missingB]) {
        const read = await EngineService.readMissionTaskArtifact({ taskID, importer,
          read: ArtifactReadInputSchema.parse({ locator }) })
        expect(read).toMatchObject({ chunk: { complete: true, locator } })
        expect(JSON.parse(read.chunk!.text!)).toMatchObject({ scope: "local_protocol_test" })
      }
      const responsibility = { kind: "task_initialization" as const, failure_reference: terminal }
      const originalGap = materializeMissionAcceptanceGap({
        reviewedTerminalLifecycleReference: terminal,
        evidenceByReadReference: new Map([["ar_local_protocol_A", originalA], ["ar_local_protocol_A_review", reviewedA], ["ar_local_protocol_B", missingB]]),
        gap: { gap_id: "local-protocol-A-accepted-B-open", current_ledger_revision_artifact_id: null,
          criteria: [
            { criterion_id: "A", state: "accepted", finding: "Local test input A was accepted.", responsibility,
              observation_evidence_read_refs: ["ar_local_protocol_A"], repair_evidence_read_refs: [],
              resolution_evidence_read_refs: ["ar_local_protocol_A_review"], invalidating_evidence_read_refs: [],
              irreducible_blocker_evidence_read_refs: [] },
            { criterion_id: "B", state: "open", disposition: "unresolved", finding: "Initialization B is incomplete.",
              responsibility, observation_evidence_read_refs: ["ar_local_protocol_B"], repair_evidence_read_refs: [],
              resolution_evidence_read_refs: [], invalidating_evidence_read_refs: [], irreducible_blocker_evidence_read_refs: [],
              repair_action: { operation: "initialize", target: "B", expected_evidence_kind: "initialized-B", parameters: {} } },
          ] },
      })
      // Native API call identities belong to this test driver, not to invented model Tool calls.
      const firstInput = { taskID, importer: { ...importer, messageID: "msg_local_protocol_driver",
        toolCallID: "local-protocol-driver:first-review" }, toolPartID: "prt_local_protocol_driver",
        reviewedTerminalLifecycleReference: terminal, expectedAcceptanceLedgerArtifactID: null,
        acceptanceGap: originalGap, completeEvidenceLocators: [originalA, reviewedA, missingB] }
      const first = await EngineService.resumeMissionTask(firstInput)
      const originalLedger = readLatestTaskAcceptanceLedger(taskID)!
      expect({ lifecycle: taskLifecycleProjection(taskID), ledger: originalLedger.revision }).toMatchObject({
        lifecycle: { status: "active", epoch: 2 }, ledger: { revision: 1, execution_epoch: 2,
          gap: { criteria: [{ criterion_id: "A", state: "accepted" }, { criterion_id: "B", state: "open" }] } },
      })
      const contraryA = evidence(taskID, "local-protocol-test-A-new-fact", { criterion: "A", input: "corrected" })
      const taskRead = await readTaskArtifact({ authority: artifactCatalogAuthority(taskID),
        read: ArtifactReadInputSchema.parse({ locator: contraryA }) })
      expect(taskRead).toMatchObject({ chunk: { complete: true, locator: contraryA } })
      expect(JSON.parse(taskRead.chunk!.text!)).toEqual({ scope: "local_protocol_test", value: { criterion: "A", input: "corrected" } })
      await expect(EngineService.readMissionTaskArtifact({ taskID, importer,
        read: ArtifactReadInputSchema.parse({ locator: contraryA }) }))
        .rejects.toThrow(`Cross-Task Artifact source ${taskID} is not terminal`)

      const attemptedGap = materializeMissionAcceptanceGap({
        reviewedTerminalLifecycleReference: terminal,
        evidenceByReadReference: new Map([["ar_local_protocol_A", originalA], ["ar_local_protocol_A_review", reviewedA], ["ar_local_protocol_B", missingB],
          ["ar_local_protocol_new_A", contraryA]]),
        gap: { gap_id: "local-protocol-A-invalidated", current_ledger_revision_artifact_id: originalLedger.artifactID,
          criteria: [
            { criterion_id: "A", state: "open", disposition: "stale_evidence",
              finding: "Local new input contradicts the accepted A input.", responsibility,
              observation_evidence_read_refs: ["ar_local_protocol_A"], repair_evidence_read_refs: [],
              resolution_evidence_read_refs: ["ar_local_protocol_A_review"], invalidating_evidence_read_refs: ["ar_local_protocol_new_A"],
              irreducible_blocker_evidence_read_refs: [],
              repair_action: { operation: "reconcile", target: "A", expected_evidence_kind: "reconciled-A", parameters: {} } },
            { criterion_id: "B", state: "open", disposition: "unresolved", finding: "Initialization B remains open.", responsibility,
              observation_evidence_read_refs: ["ar_local_protocol_B"], repair_evidence_read_refs: [],
              resolution_evidence_read_refs: [], invalidating_evidence_read_refs: [], irreducible_blocker_evidence_read_refs: [],
              repair_action: { operation: "initialize", target: "B", expected_evidence_kind: "initialized-B", parameters: { revisit: true } } },
          ] },
      })
      await expect(EngineService.resumeMissionTask({ ...firstInput,
        importer: { ...importer, messageID: "msg_local_protocol_driver_next", toolCallID: "local-protocol-driver:active-review" },
        toolPartID: "prt_local_protocol_driver_next", expectedAcceptanceLedgerArtifactID: originalLedger.artifactID,
        acceptanceGap: attemptedGap,
        // No Mission read receipt for the rejected active read is invented.
        completeEvidenceLocators: [originalA, reviewedA, missingB],
      })).rejects.toMatchObject({ name: "MissionTaskResumeLifecycleConflictError",
        data: { taskID, currentLifecycle: "active", reviewedTerminalLifecycleReference: terminal } })
      const replay = await EngineService.resumeMissionTask(firstInput)
      expect({ receipt: replay.receipt_artifact_id, message: replay.message_id,
        ledger: readLatestTaskAcceptanceLedger(taskID), lifecycle: taskLifecycleProjection(taskID) }).toMatchObject({
        receipt: first.receipt_artifact_id, message: first.message_id, ledger: originalLedger,
        lifecycle: { status: "active", epoch: 2 },
      })
    } finally {
      if (taskLifecycleProjection(taskID).status === "active") {
        await EngineService.cancelTask(taskID, { origin: { actor: "user", source: "task.cancel", surface: "api",
          requestID: "local-protocol-test:cleanup", reason: "Finish isolated protocol test" } })
      }
    }
    expect(taskLifecycleProjection(taskID)).toMatchObject({ status: "cancelled", epoch: 2 })
  } })
}, 60_000)
