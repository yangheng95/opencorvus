import { Session } from "@/session"
import { PanelLeafTools } from "@/tool/panel"
import { Tool } from "@/tool/tool"
import { panelLeafToolID, type PanelActionID } from "@/panel/action-ids"
import { afterEach, expect, test } from "bun:test"
import { ArtifactReadInputSchema, type ArtifactReadLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { recordEngineArtifact, updateEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable, EngineControlActivationLeaseTable, EngineTaskRootIngressTable } from "@/engine/engine.sql"
import { requireTask } from "@/engine/store"
import { terminalTask } from "@/engine/state"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { requireCurrentTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { currentTaskArtifactObservation } from "@/engine/task-artifact-observation"
import {
  TestHooks,
  readTaskRootIngressEvidence,
  reconcileTaskControlPlane,
  taskControlDriverSnapshot,
} from "@/engine/task-root-ingress-delivery"
import { projectTaskRootIngress } from "@/engine/task-root-fact-store"
import { Identifier } from "@/id/id"
import { materializeMissionAcceptanceGap, type MissionAcceptanceGapInput } from "@/mission/acceptance-gap"
import { readLatestTaskAcceptanceLedger, readTaskAcceptanceLedgerArtifact } from "@/mission/acceptance-ledger"
import { readMissionAcceptanceExtensionOutcome } from "@/mission/acceptance-extension"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { SessionWake } from "@/session/wake"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { renderWakeProvenanceNotice } from "@/orchestrator/agent"
import { settleScriptedStatusInput } from "./fixture/task-root-status-input"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { openMissionThroughRealWake } from "./fixture/mission-opened"

type MissionAcceptanceCriterionInput = MissionAcceptanceGapInput["criteria"][number]

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

// Public service and real Tool/reconciler contract. The scripted participant is
// explicit test input, not an LLM. No direct Task/Protocol/ledger table writes.
for (const responsibilityKind of ["task_initialization", "task_owner"] as const)
for (const boundary of ["cancelled", "completed"] as const)
  test(`Mission ${responsibilityKind} extension applies in order, rejects stale CAS, and respects ${boundary}`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        let phase = "setup"
        const trace = (next: string, details: Record<string, unknown> = {}) => {
          phase = next
          console.log("acceptance-extension", JSON.stringify({ responsibilityKind, boundary, phase, ...details }))
        }
        const initialFinished = Promise.withResolvers<void>()
        const repairStarted = Promise.withResolvers<void>()
        const releaseRepair = Promise.withResolvers<void>()
        const extensionFinished = Promise.withResolvers<void>()
        const applicationObserved = Promise.withResolvers<void>()
        const runnerFailure = Promise.withResolvers<never>()
        // The scripted participant owns these receivers; background faults
        // must reach them instead of becoming an unrelated hook timeout.
        void runnerFailure.promise.catch(() => undefined)
        const awaitParticipant = <T>(completion: Promise<T>) => Promise.race([completion, runnerFailure.promise])
        let extensionActivations = 0
        const cancellationStarted = Promise.withResolvers<void>()
        const releaseCancellation = Promise.withResolvers<void>()
        let holdCancellation = false
        let normalLeaseMilliseconds: number | undefined
        using _loop = TestHooks.replaceTaskIngressRunner({
          runner: async (input) => {
            const { taskID, event, wakeID, activationID, predecessorID } = input
            try {
              trace("runner:start", {
                taskID, wakeID, activationID,
                resume: Boolean(event.missionAcceptanceResume),
                extension: Boolean(event.missionAcceptanceExtension),
              })
              if (!wakeID || !activationID || !predecessorID) throw new Error("Expected real ingress identity")
              const lease = Database.use((db) => db.select().from(EngineControlActivationLeaseTable)
                .where(eq(EngineControlActivationLeaseTable.id, activationID)).get())!
              const leaseDuration = lease.expires_at - lease.time_activated
              normalLeaseMilliseconds ??= leaseDuration
              if (event.missionAcceptanceResume) {
                repairStarted.resolve()
                await releaseRepair.promise
              }
              if (holdCancellation && event.rootMessage?.kind === "operator") {
                cancellationStarted.resolve()
                await Promise.race([
                  releaseCancellation.promise,
                  new Promise<void>((resolve) =>
                    input.signal?.addEventListener("abort", () => resolve(), { once: true }),
                  ),
                ])
                return {}
              }
              if (event.missionAcceptanceExtension) {
                extensionActivations += 1
                const lostActivation = boundary === "completed" && extensionActivations === 1
                expect(leaseDuration).toBe(lostActivation ? 1500 : normalLeaseMilliseconds)
                // The first applied input deliberately loses its runner before a decision.
                // Recovery reloads the same immutable application with normal lease timing.
                if (lostActivation) {
                  applicationObserved.resolve()
                  return {}
                }
                const current = readLatestTaskAcceptanceLedger(taskID)!
                expect({
                  actual: event.missionAcceptanceExtension.acceptanceLedgerRevisionArtifactID,
                  current: current.artifactID,
                }).toEqual({ actual: current.artifactID, current: current.artifactID })
                expect(renderWakeProvenanceNotice(event, taskID, wakeID)).toContain(
                  "extension added obligations in the current Task execution",
                )
              }
              trace("runner:settle", { taskID, wakeID, activationID })
              const result = await settleScriptedStatusInput({
                taskID,
                event,
                wakeID,
                activationID,
                predecessorID,
                directory: project.path,
              })
              trace("runner:settled", { taskID, wakeID, activationID })
              initialFinished.resolve()
              if (event.missionAcceptanceExtension) extensionFinished.resolve()
              return result
            } catch (error) {
              console.error("acceptance-extension-runner-failed", { taskID, wakeID, activationID, error })
              runnerFailure.reject(error)
              throw error
            }
          },
        })
        const mission = await ensureMissionSession({
          missionID: "local-extension-mission",
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const opened = await openMissionThroughRealWake({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.dispatch",
          requestID: "local-extension-open",
        })
        using _missionLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
        const taskID = await EngineService.createTask(
          {
            requestID: Identifier.ascending("artifact"),
            title: "Local extension protocol",
            request: "LOCAL PROTOCOL TEST: observe supplied A and initialize B.",
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
        const diagnostic = setInterval(() => {
          try {
            const ingresses = Database.use((db) => db.select({ id: EngineTaskRootIngressTable.id })
              .from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.task_id, taskID)).all())
            console.log("acceptance-extension-state", JSON.stringify({
              responsibilityKind, boundary, phase, taskID,
              lifecycle: taskLifecycleProjection(taskID), driver: taskControlDriverSnapshot(),
              ingresses: ingresses.map(({ id }) => ({
                id, projection: projectTaskRootIngress(id, Date.now(), readTaskRootIngressEvidence),
              })),
            }))
          } catch (error) {
            console.error("acceptance-extension-diagnostic", error)
          }
        }, 10_000)
        diagnostic.unref()
        try {
          trace("await:initial")
          await awaitParticipant(initialFinished.promise)
          await reconcileTaskControlPlane(taskID)
          const locators = new Map<string, ArtifactReadLocator>()
          for (const name of ["A", "A-review", "B", "A-counter", "C"]) {
            const id = recordEngineArtifact({
              taskID,
              kind: "expert_output",
              label: name,
              payload: { scope: "local_protocol_test", name },
              timeCreated: Date.now(),
            })
            const row = Database.use((db) =>
              db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, id)).get(),
            )!
            locators.set(`ar_local_${name}`, {
              source: "engine_artifact",
              artifact_id: id,
              catalog_revision: row.catalog_revision,
              expected_sha256: row.payload_sha256,
            })
          }
          const task = requireTask(taskID)
          await terminalTask(
            task,
            {
              status: "failed",
              error: "LOCAL TEST initialization precondition",
              time_started: task.time_started ?? Date.now(),
              time_completed: Date.now(),
            },
            "Local initialization precondition",
          )
          const terminal = requireCurrentTerminalLifecycleReference(taskID)
          const responsibility = responsibilityKind === "task_owner"
            ? { kind: "task_owner" as const }
            : { kind: "task_initialization" as const, failure_reference: terminal }
          const common = {
            responsibility,
            repair_evidence_read_refs: [],
            invalidating_evidence_read_refs: [],
            irreducible_blocker_evidence_read_refs: [],
          }
          const a: MissionAcceptanceCriterionInput = {
            ...common,
            criterion_id: "A",
            state: "accepted",
            finding: "Test A accepted",
            observation_evidence_read_refs: ["ar_local_A"],
            resolution_evidence_read_refs: ["ar_local_A-review"],
          }
          const b: MissionAcceptanceCriterionInput = {
            ...common,
            criterion_id: "B",
            state: "open",
            disposition: "unresolved",
            finding: "Test B incomplete",
            observation_evidence_read_refs: ["ar_local_B"],
            resolution_evidence_read_refs: [],
            repair_action: { operation: "initialize", target: "B", expected_evidence_kind: "B-result", parameters: {} },
          }
          const materialize = (criteria: MissionAcceptanceCriterionInput[], gapID: string) =>
            materializeMissionAcceptanceGap({
              reviewedTerminalLifecycleReference: terminal,
              evidenceByReadReference: locators,
              gap: { gap_id: gapID, current_ledger_revision_artifact_id: null, criteria },
            })
          const importer = {
            missionID: mission.missionID,
            sessionID: mission.id,
            messageID: "msg_local_extension_driver",
            toolCallID: "local-extension-driver-resume",
          }
          // Complete reads by the Native API driver are not claimed as Panel read refs.
          for (const locator of locators.values())
            await EngineService.readMissionTaskArtifact({
              taskID,
              importer,
              read: ArtifactReadInputSchema.parse({ locator }),
            })
          const first = await EngineService.resumeMissionTask({
            taskID,
            importer,
            toolPartID: "prt_local_extension_resume",
            reviewedTerminalLifecycleReference: terminal,
            expectedAcceptanceLedgerArtifactID: null,
            acceptanceGap: materialize([a, b], "local-initial"),
            completeEvidenceLocators: [...locators.values()],
          })
          trace("await:repair")
          await awaitParticipant(repairStarted.promise)
          const original = readLatestTaskAcceptanceLedger(taskID)!
          const reopened: MissionAcceptanceCriterionInput = {
            ...a,
            state: "open",
            disposition: "stale_evidence",
            finding: "Test counterevidence invalidates A",
            invalidating_evidence_read_refs: ["ar_local_A-counter"],
            repair_action: {
              operation: "reconcile",
              target: "A",
              expected_evidence_kind: "A-reconciled",
              parameters: {},
            },
          }
          const gap = materialize([reopened, b], "local-extension")
          const active = currentTaskArtifactObservation(taskID).active_execution_reference!
          for (const locator of locators.values())
            await EngineService.readMissionTaskArtifact({
              taskID,
              importer,
              read: ArtifactReadInputSchema.parse({ locator }),
            })
          // Scripted Mission participant calls actual query/catalog/read/extension leaves.
          // Every read ref and application receipt below is generated by production code.
          const parent = (await Session.messages({ sessionID: mission.id })).find((row) => row.info.role === "user")!
            .info.id
          const caller = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: mission.id,
            parentID: parent,
            role: "assistant",
            author: "mission",
            time: { created: Date.now() },
            agent: "mission",
            providerID: "firmware",
            modelID: "gpt-5",
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          })
          const panelCall = async (action: PanelActionID, input: Record<string, unknown>) => {
            const id = panelLeafToolID(action)
            const leaf = await PanelLeafTools.find((entry) => entry.id === id)!.init({ agentID: "mission" })
            await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: mission.id,
              messageID: caller.id,
              type: "step-start",
            })
            const callID = Identifier.ascending("part")
            const part = await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: mission.id,
              messageID: caller.id,
              type: "tool",
              callID,
              tool: id,
              state: { status: "running", input, time: { start: Date.now() } },
            })
            const result = await leaf.execute(input, {
              sessionID: mission.id,
              messageID: caller.id,
              callID,
              agent: "mission",
              abort: new AbortController().signal,
              messages: [],
              executionSurface: Tool.executionSurface([id], []),
              extra: { surface: "panel" },
              metadata() {},
              async ask() {},
            })
            await Session.updatePart({
              ...part,
              state: {
                status: "completed",
                input,
                output: result.output,
                title: result.title,
                metadata: result.metadata,
                time: { start: part.state.time.start, end: Date.now() },
              },
            })
            return JSON.parse(result.output)
          }
          await panelCall("query_task", { taskIDs: [taskID] })
          const catalog = await panelCall("query_task_artifacts", { queries: [{ taskID, page_number: 1 }] })
          const refs = new Map<string, string>()
          for (const [driverRef, locator] of locators) {
            const entry = catalog.results[0].value.entries.find(
              (entry: any) => entry.locator.artifact_id === (locator as any).artifact_id,
            )
            if (!entry) throw new Error("Test evidence missing from real catalog page")
            const read = await panelCall("read_task_artifact", {
              reads: [
                {
                  taskID,
                  artifact_transport_version: 2,
                  artifact_locator_ref: entry.artifact_locator_ref,
                  byte_offset: 0,
                  max_bytes: 65536,
                  delivery: "inline",
                },
              ],
            })
            expect(read.results[0].value.complete).toBe(true)
            refs.set(driverRef, read.results[0].value.artifact_read_ref)
          }
          const panelCriteria = [reopened, b].map((criterion) =>
            Object.fromEntries(
              Object.entries(criterion).map(([key, value]) => [
                key,
                key.endsWith("_read_refs") ? (value as string[]).map((ref) => refs.get(ref)!) : value,
              ]),
            ),
          )
          const accepted = await panelCall("extend_task_acceptance", {
            taskID,
            acceptance_gap: {
              gap_id: gap.gap_id,
              current_ledger_revision_artifact_id: original.artifactID,
              criteria: panelCriteria,
            },
          })
          const request = {
            taskID,
            importer: { ...importer, messageID: accepted.panel_message_id, toolCallID: accepted.tool_call_id },
            toolPartID: accepted.tool_part_id,
            activeExecutionReference: active,
            expectedAcceptanceLedgerArtifactID: original.artifactID,
            acceptanceGap: gap,
            completeEvidenceLocators: [...locators.values()],
          }
          const competingInput = {
            ...request,
            importer: { ...importer, toolCallID: "local-extension-driver-2" },
            toolPartID: "prt_local_extension_2",
          }
          const [competing, concurrentReplay] = await Promise.all([
            EngineService.extendMissionTaskAcceptance(competingInput),
            EngineService.extendMissionTaskAcceptance(competingInput),
          ])
          expect(concurrentReplay.request_artifact_id).toBe(competing.request_artifact_id)
          expect(() => updateEngineArtifact({ id: accepted.request_artifact_id, label: "changed-request" })).toThrow(
            "Mission acceptance extension facts are immutable",
          )
          await expect(
            EngineService.extendMissionTaskAcceptance({
              ...request,
              importer: { ...importer, missionID: "another-mission", toolCallID: "local-wrong-owner" },
            }),
          ).rejects.toThrow("outside Mission another-mission lineage")
          await expect(
            EngineService.extendMissionTaskAcceptance({
              ...request,
              importer: { ...importer, toolCallID: "local-stale-epoch" },
              activeExecutionReference: { ...active, executionEpoch: 1 },
            }),
          ).rejects.toThrow("active execution changed")
          const changedB = { ...b, finding: "Changed in-flight B grant" }
          await expect(
            EngineService.extendMissionTaskAcceptance({
              ...request,
              importer: { ...importer, toolCallID: "local-change-open" },
              acceptanceGap: materialize([reopened, changedB], "invalid-change"),
            }),
          ).rejects.toThrow("preserve open criterion B")
          expect({
            application: accepted.application,
            revision: readLatestTaskAcceptanceLedger(taskID)!.revision.revision,
          }).toEqual({ application: { kind: "pending" }, revision: 1 })
          expect(
            projectTaskRootIngress(first.ingress_artifact_id, Date.now(), readTaskRootIngressEvidence),
          ).toMatchObject({ state: "leased" })
          {
            // Only the deliberately lost activation gets the short recovery
            // lease. Normal participant execution uses production timing.
            using _lostActivationLease = boundary === "completed"
              ? TestHooks.replaceLeaseTiming({ leaseMilliseconds: 1500, renewalMilliseconds: 250 })
              : undefined
            trace("release:repair")
            releaseRepair.resolve()
            if (boundary === "completed") await awaitParticipant(applicationObserved.promise)
          }
          if (boundary === "completed") {
            // A fresh recovery sweep after the lost activation's lease expires.
            await new Promise((resolve) => setTimeout(resolve, 1700))
            await reconcileTaskControlPlane(taskID)
          }
          trace("await:extension")
          await awaitParticipant(extensionFinished.promise)
          trace("reconcile:extension")
          await reconcileTaskControlPlane(taskID)
          expect(extensionActivations).toBe(boundary === "completed" ? 2 : 1)
          const revised = readLatestTaskAcceptanceLedger(taskID)!
          expect(revised.revision).toMatchObject({
            revision: 2,
            execution_epoch: 2,
            previous_revision_artifact_id: original.artifactID,
            gap: {
              criteria: [
                { criterion_id: "A", state: "open", disposition: "stale_evidence" },
                original.revision.gap.criteria[1],
              ],
            },
          })
          expect(readTaskAcceptanceLedgerArtifact(taskID, original.artifactID)).toEqual(original)
          const replay = await EngineService.extendMissionTaskAcceptance(request)
          expect({ request: replay.request_artifact_id, application: replay.application }).toMatchObject({
            request: accepted.request_artifact_id,
            application: { kind: "applied", ledger_artifact_id: revised.artifactID },
          })
          const rejected = Database.use((db) =>
            readMissionAcceptanceExtensionOutcome(db, taskID, competing.ingress_artifact_id),
          )!
          expect(rejected.outcome.result).toMatchObject({
            kind: "rejected",
            code: "ledger_conflict",
            current_ledger_artifact_id: revised.artifactID,
          })
          expect(
            projectTaskRootIngress(competing.ingress_artifact_id, Date.now(), readTaskRootIngressEvidence),
          ).toEqual({ state: "input_rejected", evidenceIDs: [rejected.artifactID] })
          expect(taskLifecycleProjection(taskID)).toMatchObject({ status: "active", epoch: 2 })

          holdCancellation = true
          await EngineService.handleTaskMessage(taskID, {
            source: "api",
            text: "LOCAL TEST: hold this input until cancellation",
          })
          trace("await:cancellation")
          await awaitParticipant(cancellationStarted.promise)
          const c: MissionAcceptanceCriterionInput = {
            ...b,
            criterion_id: "C",
            observation_evidence_read_refs: ["ar_local_C"],
            repair_action: { ...b.repair_action, target: "C" },
          }
          const cancelledRequest = {
            ...request,
            importer: { ...importer, toolCallID: "local-extension-driver-cancel" },
            toolPartID: "prt_local_extension_cancel",
            expectedAcceptanceLedgerArtifactID: revised.artifactID,
            acceptanceGap: materialize([reopened, b, c], "local-extension-C"),
          }
          const queued = await EngineService.extendMissionTaskAcceptance(cancelledRequest)
          expect(queued.application).toEqual({ kind: "pending" })
          const priorBoundary =
            boundary === "cancelled"
              ? EngineService.cancelTask(taskID, {
                  origin: {
                    actor: "user",
                    source: "task.cancel",
                    surface: "api",
                    requestID: "local-extension-cleanup",
                    reason: "Finish local protocol checker",
                  },
                })
              : terminalTask(
                  requireTask(taskID),
                  { status: "completed", time_started: Date.now(), time_completed: Date.now() },
                  "LOCAL PROTOCOL TEST: prior input completed before extension",
                )
          trace("await:boundary")
          await priorBoundary
          trace("boundary:committed")
          expect(taskLifecycleProjection(taskID)).toMatchObject({ status: boundary, epoch: 2 })
          releaseCancellation.resolve()
          expect((await EngineService.extendMissionTaskAcceptance(cancelledRequest)).application).toEqual({
            kind: "inapplicable",
            lifecycle: boundary,
            execution_epoch: 2,
          })
          expect(readLatestTaskAcceptanceLedger(taskID)).toEqual(revised)
          expect(
            projectTaskRootIngress(queued.ingress_artifact_id, Date.now(), readTaskRootIngressEvidence),
          ).toMatchObject({
            state: "terminal_inapplicable",
            boundary: boundary === "cancelled" ? "cancelled" : "closed",
          })
        } finally {
          trace("cleanup")
          clearInterval(diagnostic)
          releaseRepair.resolve()
          releaseCancellation.resolve()
          if (taskLifecycleProjection(taskID).status === "active")
            await EngineService.cancelTask(taskID, {
              origin: {
                actor: "user",
                source: "task.cancel",
                surface: "api",
                requestID: "local-extension-finally",
                reason: "Clean local checker",
              },
            })
        }
      },
    })
  }, 60_000)
