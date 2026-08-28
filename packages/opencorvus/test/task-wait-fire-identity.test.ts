import { afterAll, describe, expect, spyOn, test } from "bun:test"
import { EngineTaskRootIngressTable } from "../src/engine/engine.sql"
import {
  configureTaskIngressRunner,
  dispatchPersistedTaskLoop,
  persistTaskRootIngressInTransaction,
  taskRootIngressDebugProjection,
  waitForIngressDeliveryHooksForTest,
} from "../src/engine/task-root-ingress-delivery"
import { EngineConfig } from "../src/engine/config"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { findTask } from "../src/engine/store"
import { acquireControlLease, currentControlLeaseInTransaction, renewControlLease } from "../src/engine/control-lease"
import { Identifier } from "../src/id/id"
import { currentOrchestratorControlMessage } from "../src/orchestrator/agent"
import { Instance } from "../src/project/instance"
import { AutomationDefinitionTombstoneTable, AutomationRunTable, AutomationTable } from "../src/scheduler/automation.sql"
import { AutomationService } from "../src/scheduler/automation-service"
import { createDelayedSessionWake, createTaskWake } from "../src/scheduler/delayed-wake-schedule"
import { taskWaitFireID } from "../src/scheduler/task-wait-fire-identity"
import { createSchedulerExecutionInactivityFence } from "../src/scheduler/execution-inactivity"
import { Session } from "../src/session"
import { Message } from "../src/session/message"
import { Database, eq } from "../src/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await waitForIngressDeliveryHooksForTest()
  await resetMemoryDatabase()
})

describe("delayed Task-wait immutable occurrence", () => {
  test("projects exact active Session and Task wake schedules for runtime settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Task wait schedule" })
        const mission = await Session.create({ kind: "root", title: "Session wait schedule" })
        const now = Date.now()
        const packageRevision = { scope: "built_in" as const, projectID: null, namespace: "builtin", id: "base", version: "2026.08.09.1", packageDigest: "b".repeat(64) }
        persistEstablishedTask({
          taskID, rootSession: root, now, title: "Task wait schedule", request: "Resume later", productPillar: "code",
          source: "test", priority: "normal", metadata: { actor: "user" }, projectID: Instance.project.id, packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID, projectID: Instance.project.id, rootDirectory: Instance.directory, packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now }),
        })
        const taskWake = await createTaskWake({
          name: "task resume",
          projectId: Instance.project.id,
          taskId: taskID,
          durationMs: 60_000,
          reason: "resume exact task",
        })
        const sessionWake = await createDelayedSessionWake({
          name: "session resume",
          projectId: Instance.project.id,
          sessionId: mission.id,
          durationMs: 120_000,
          prompt: "resume exact session",
        })

        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [mission.id],
            taskIDs: [taskID],
            now,
          }),
        ).toEqual([
          {
            id: taskWake.id,
            projectID: Instance.project.id,
            target: { scope: "task", taskID },
            nextRun: taskWake.nextRun,
            leaseUntil: 0,
            state: "scheduled",
            claim: null,
          },
          {
            id: sessionWake.id,
            projectID: Instance.project.id,
            target: { scope: "session", sessionID: mission.id },
            nextRun: sessionWake.nextRun,
            leaseUntil: 0,
            state: "scheduled",
            claim: null,
          },
        ])
        const firstClaimAt = now + 1
        const firstClaim = acquireControlLease({
          target: "automation",
          targetID: taskWake.id,
          ownerOccurrenceID: "automation-attempt-a",
          now: firstClaimAt,
          leaseMilliseconds: 10_000,
        })
        if (!firstClaim.acquired) throw new Error("Expected the first delayed-wake claim")
        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [],
            taskIDs: [taskID],
            now: firstClaimAt,
          }),
        ).toEqual([
          {
            id: taskWake.id,
            projectID: Instance.project.id,
            target: { scope: "task", taskID },
            nextRun: taskWake.nextRun,
            leaseUntil: firstClaim.lease.expires_at,
            state: "leased",
            claim: {
              leaseID: firstClaim.lease.id,
              ownerOccurrenceID: firstClaim.lease.owner_occurrence_id,
              activatedAt: firstClaim.lease.time_activated,
            },
          },
        ])
        const renewedUntil = firstClaim.lease.expires_at + 10_000
        renewControlLease({
          target: "automation",
          targetID: taskWake.id,
          leaseID: firstClaim.lease.id,
          ownerOccurrenceID: firstClaim.lease.owner_occurrence_id,
          now: firstClaimAt + 100,
          expiresAt: renewedUntil,
        })
        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [],
            taskIDs: [taskID],
            now: firstClaimAt + 101,
          }),
        ).toEqual([
          {
            id: taskWake.id,
            projectID: Instance.project.id,
            target: { scope: "task", taskID },
            nextRun: taskWake.nextRun,
            leaseUntil: renewedUntil,
            state: "leased",
            claim: {
              leaseID: firstClaim.lease.id,
              ownerOccurrenceID: firstClaim.lease.owner_occurrence_id,
              activatedAt: firstClaim.lease.time_activated,
            },
          },
        ])
        const replacementClaimAt = renewedUntil + 1
        const replacementClaim = acquireControlLease({
          target: "automation",
          targetID: taskWake.id,
          ownerOccurrenceID: "automation-attempt-b",
          now: replacementClaimAt,
          leaseMilliseconds: 10_000,
        })
        if (!replacementClaim.acquired) throw new Error("Expected the replacement delayed-wake claim")
        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [],
            taskIDs: [taskID],
            now: replacementClaimAt,
          }),
        ).toEqual([
          {
            id: taskWake.id,
            projectID: Instance.project.id,
            target: { scope: "task", taskID },
            nextRun: taskWake.nextRun,
            leaseUntil: replacementClaim.lease.expires_at,
            state: "leased",
            claim: {
              leaseID: replacementClaim.lease.id,
              ownerOccurrenceID: replacementClaim.lease.owner_occurrence_id,
              activatedAt: replacementClaim.lease.time_activated,
            },
          },
        ])
      },
    })
  }, 30_000)

  test("maps delayed wake lineage and duration validation to their exact errors", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Delayed wake validation" })
        await expect(
          createDelayedSessionWake({
            name: "foreign session",
            projectId: "prj_foreign",
            sessionId: session.id,
            durationMs: 1_000,
            prompt: "must retain exact project lineage",
          }),
        ).rejects.toThrow(`Session not found: ${session.id}`)
        await expect(
          createDelayedSessionWake({
            name: "invalid duration",
            projectId: Instance.project.id,
            sessionId: session.id,
            durationMs: 0,
            prompt: "must require a positive integer delay",
          }),
        ).rejects.toThrow("Invalid delay duration: 0")
      },
    })
  })

  test("binds accepted ingress to the exact Automation run and definition revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        configureTaskIngressRunner(async ({ wakeID, activationID }) => {
          expect(
            taskRootIngressDebugProjection(taskID).find((ingress) => ingress.ingressID === wakeID)?.activationIDs,
          ).toContain(activationID)
          return {}
        })
        const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Task wait facts" })
        const now = Date.now()
        const packageRevision = { scope: "built_in" as const, projectID: null, namespace: "builtin", id: "base", version: "2026.08.09.1", packageDigest: "a".repeat(64) }
        persistEstablishedTask({
          taskID, rootSession: root, now, title: "Task wait facts", request: "Resume once", productPillar: "code",
          source: "test", priority: "normal", metadata: { actor: "user" }, projectID: Instance.project.id, packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID, projectID: Instance.project.id, rootDirectory: Instance.directory, packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now }),
        })
        const scheduled = await createTaskWake({ name: "resume", projectId: Instance.project.id, taskId: taskID, durationMs: 1, reason: "resume exact task" })
        await new Promise((resolve) => setTimeout(resolve, 5))
        await AutomationService.runDueNow()
        await waitForIngressDeliveryHooksForTest()
        const definition = Database.use((db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, scheduled.id)).orderBy(AutomationTable.revision).all())
        expect(definition.map((row) => row.revision)).toEqual([1])
        expect(Database.use((db) => db.select().from(AutomationDefinitionTombstoneTable).where(eq(AutomationDefinitionTombstoneTable.definition_id, scheduled.id)).get()))
          .toMatchObject({ definition_id: scheduled.id, revision: 2 })
        const run = Database.use((db) => db.select().from(AutomationRunTable).where(eq(AutomationRunTable.automation_revision_id, definition[0]!.id)).get())
        expect(run?.fire_id).toBe(taskWaitFireID(scheduled.id))
        const ingress = Database.use((db) => db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.source_id, run!.id)).get())
        expect(ingress).toMatchObject({ task_id: taskID, source: "automation_run", inline_payload: null })
        // The one-shot terminal transaction writes the succeeded receipt, the
        // tombstone and the end of the fire's lease as one fact.
        const settledLease = Database.use((db) => currentControlLeaseInTransaction(db, "automation", scheduled.id))!
        expect(settledLease.expires_at).toBeLessThanOrEqual(Date.now())
        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [],
            taskIDs: [taskID],
          }),
        ).toEqual([])
      },
    })
  }, 30_000)

  test("delegates each sequential durable Task activation and rearms after the final owner", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const get = spyOn(EngineConfig, "get").mockResolvedValue({
          ...EngineConfig.defaults,
          activity: { ...EngineConfig.defaults.activity, execution_progress_idle_ms: 25 },
        })
        try {
          const taskID = Identifier.ascending("task")
          const root = Session.prepareRootNext({
            kind: "root",
            directory: Instance.directory,
            title: "Sequential Task activation ownership",
          })
          const now = Date.now()
          const packageRevision = {
            scope: "built_in" as const,
            projectID: null,
            namespace: "builtin",
            id: "base",
            version: "2026.08.09.1",
            packageDigest: "c".repeat(64),
          }
          persistEstablishedTask({
            taskID,
            rootSession: root,
            now,
            title: "Sequential Task activation ownership",
            request: "Exercise each physical owner",
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
              rootDirectory: Instance.directory,
              packageRevisionSHA256: packageRevision.packageDigest,
              timeCreated: now,
            }),
          })
          Database.transaction((db) => {
            const task = findTask(taskID)
            if (!task) throw new Error(`Expected Task ${taskID}`)
            persistTaskRootIngressInTransaction(
              db,
              task,
              { note: "Second sequential Task ingress" },
              { waitJobID: "sequential-owner-second-ingress" },
              now + 1,
            )
          })
          using fence = await createSchedulerExecutionInactivityFence({
            occurrence: "Automation delayed Task physical owners",
            signals: [],
            initialPhase: "Task ingress preparation",
            configurationOwner: "project",
          })
          let activeDelegations = 0
          let delegatedOwners = 0
          let runnerCalls = 0
          const orchestratorSession = await Session.create({
            kind: "orchestrator",
            parentID: root.id,
            title: "Sequential Task activation owner",
          })
          configureTaskIngressRunner(async ({ event, wakeID, activationID, predecessorID }) => {
            runnerCalls += 1
            if (!event || !wakeID || !activationID || !predecessorID) {
              throw new Error("Sequential Task activation requires exact control identity")
            }
            expect(activeDelegations).toBe(1)
            expect(
              taskRootIngressDebugProjection(taskID).find((ingress) => ingress.ingressID === wakeID)?.activationIDs,
            ).toContain(activationID)
            await Bun.sleep(35)
            fence.signal.throwIfAborted()
            const control = currentOrchestratorControlMessage(event, taskID, wakeID, predecessorID)
            if (!control) throw new Error("Expected sequential Task Orchestrator control")
            await Session.persistMessage({
              info: {
                id: control.messageID,
                sessionID: orchestratorSession.id,
                role: "user",
                author: "orchestrator",
                time: { created: Date.now() },
                agent: "orchestrator",
                model: { providerID: "test", modelID: "sequential-task-owner" },
                extra: control.extra,
              },
              parts: [
                {
                  id: control.partID,
                  sessionID: orchestratorSession.id,
                  messageID: control.messageID,
                  type: "text",
                  text: control.text,
                  kind: "control",
                  source: "system",
                } satisfies Message.TextPart,
              ],
            })
            const completedAt = Date.now()
            const messageID = Identifier.ascending("message")
            const info: Message.Assistant = {
              id: messageID,
              sessionID: orchestratorSession.id,
              parentID: control.messageID,
              role: "assistant",
              author: "orchestrator",
              time: { created: completedAt, completed: completedAt + 1 },
              agent: "orchestrator",
              providerID: "test",
              modelID: "sequential-task-owner",
              path: { cwd: Instance.directory, root: Instance.directory },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
              finish: "stop",
              activationID,
            }
            await Session.updateMessage(info)
            return { finalMessageID: messageID }
          })
          const dispatchResult = await dispatchPersistedTaskLoop(taskID, undefined, {
            runWithActivationOwner: async (completion) => {
              expect(activeDelegations).toBe(0)
              activeDelegations += 1
              delegatedOwners += 1
              try {
                return await fence.runDelegated(`Task physical owner ${delegatedOwners}`, completion)
              } finally {
                activeDelegations -= 1
              }
            },
          })
          const reason = await new Promise<unknown>((resolve) => {
            const observe = () => resolve(fence.signal.reason)
            if (fence.signal.aborted) observe()
            else fence.signal.addEventListener("abort", observe, { once: true })
          })
          expect({ dispatchResult, activeDelegations, delegatedOwners, runnerCalls, reason }).toMatchObject({
            dispatchResult: "accepted",
            activeDelegations: 0,
            delegatedOwners: runnerCalls,
            reason: { name: "SchedulerExecutionInactivityError", phase: `Task physical owner ${delegatedOwners}` },
          })
          expect(runnerCalls).toBeGreaterThan(1)
        } finally {
          get.mockRestore()
        }
      },
    })
  }, 30_000)
})
