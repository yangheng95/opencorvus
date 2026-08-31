import { afterAll, describe, expect, spyOn, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { acquireControlLease, currentControlLeaseInTransaction } from "../src/engine/control-lease"
import { EngineControlActivationLeaseTable } from "../src/engine/engine.sql"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Project } from "../src/project/project"
import { deleteProject } from "../src/project/delete"
import { Session } from "../src/session"
import { Server } from "../src/server/server"
import { GlobalConversationService } from "../src/chat/global-chat-service"
import {
  AutomationDefinitionTombstoneTable,
  AutomationFireAttemptTable,
  AutomationFireAttemptReceiptTable,
  AutomationFireTable,
  AutomationRunReceiptTable,
  AutomationRunTable,
  AutomationTable,
} from "../src/scheduler/automation.sql"
import { AutomationRunningConflictError, AutomationService } from "../src/scheduler/automation-service"
import {
  currentAutomationFrontiersInTransaction,
  latestAutomationDefinitionInTransaction,
  projectAutomationFrontierInTransaction,
  projectAutomationInTransaction,
} from "../src/scheduler/automation-projection"
import { Database, and, eq, sql } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Config } from "@/config/config"
import { SessionWake } from "@/session/wake"
import {
  closeMissionExecutionOperation,
  missionOperatorWakeReason,
  openMissionExecutionWithWake,
} from "@/mission/execution-closure"
import { ensureMissionSession } from "@/mission/session"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { SessionStatus } from "@/session/status"

afterAll(resetMemoryDatabase)

async function openMissionOccurrence(
  mission: Awaited<ReturnType<typeof ensureMissionSession>>,
  requestID: string,
): Promise<void> {
  await openMissionExecutionWithWake({
    missionID: mission.missionID,
    sessionID: mission.id,
    source: "mission.wake",
    requestID,
    acceptedInput: {
      text: `Open Mission occurrence ${requestID}`,
      model: null,
      attachments: [],
      configPatch: {},
      context: { surface: "test.scheduler-automation" },
    },
    wake: (admission) =>
      SessionWake.wakeWithReceipt({
        sessionID: mission.id,
        messageID: admission.messageID,
        textPartID: admission.textPartID,
        controlID: admission.controlID,
        prompt: `Open Mission occurrence ${requestID}`,
        author: "user",
        agent: "mission",
        surface: "panel",
        userAuthored: true,
        reason: missionOperatorWakeReason(admission, mission.missionID),
        commitBundle: admission.commitBundle,
        preflightBundle: admission.preflightBundle,
        ownerPreflight: admission.ownerPreflight,
        ownerLifecycle: admission.ownerLifecycle,
      }),
  })
}

async function acquireDurablePromptExecution(
  session: Awaited<ReturnType<typeof Session.create>>,
  projectPath: string,
) {
  const input = await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "user",
    sessionID: session.id,
    author: "user",
    time: { created: Date.now() },
    agent: "assistant",
    model: { providerID: "test", modelID: "test" },
  })
  const owner = SessionPromptOwner.acquire({
    sessionID: session.id,
    projectID: Instance.project.id,
    directory: Instance.directory,
  })
  if (!owner.acquired) throw new Error("Durable prompt execution fixture did not acquire its Prompt owner")
  const assistant = await Session.beginAssistantReply({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "assistant",
    author: "assistant",
    parentID: input.id,
    acceptedInputMessageIDs: [input.id],
    agent: "assistant",
    modelID: "test",
    providerID: "test",
    path: { cwd: projectPath, root: projectPath },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() },
  })
  let released = false
  return {
    owner: owner.authority,
    assistant,
    async settle() {
      if (assistant.time.completed === undefined) {
        assistant.finish = "stop"
        assistant.time.completed = Date.now()
        await Session.updateMessage(assistant)
      }
      if (!released) released = SessionPromptOwner.release(owner.authority)
      return released
    },
    release() {
      if (!released) released = SessionPromptOwner.release(owner.authority)
      return released
    },
  }
}

describe("scheduler immutable definition and fire identity", () => {
  test("a busy Session retains its exact due occurrence behind one timed control lease", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "busy Automation target" })
      const input = await Session.updateMessage({
        id: Identifier.ascending("message"),
        role: "user",
        sessionID: session.id,
        author: "user",
        time: { created: Date.now() },
        agent: "assistant",
        model: { providerID: "test", modelID: "test" },
      })
      const promptOwner = SessionPromptOwner.acquire({
        sessionID: session.id,
        projectID: Instance.project.id,
        directory: Instance.directory,
      })
      if (!promptOwner.acquired) throw new Error("Focused busy-Session test did not acquire its Prompt owner")
      let promptOwnerReleased = false
      const assistant = await Session.beginAssistantReply({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "assistant",
        author: "assistant",
        parentID: input.id,
        acceptedInputMessageIDs: [input.id],
        agent: "assistant",
        modelID: "test",
        providerID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        time: { created: Date.now() },
      })

      try {
        const startsAt = Date.now() + 3_000
        const stamp = new Date(startsAt)
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}Z$/, "Z")
        const automation = await AutomationService.create({
          name: "busy exact Session",
          target: { scope: "session", sessionId: session.id },
          recurrence: `DTSTART:${stamp}\nRRULE:FREQ=SECONDLY;INTERVAL=120`,
          prompt: "retain this due occurrence",
        })
        await expect(AutomationService.runNow(automation.id)).rejects.toBeInstanceOf(AutomationRunningConflictError)
        while (Date.now() <= automation.nextRun) await Bun.sleep(25)
        await AutomationService.runDueNow()

        const delayed = Database.use((db) =>
          projectAutomationInTransaction(db, latestAutomationDefinitionInTransaction(db, automation.id)!),
        )
        const delayedLeaseUntil = delayed.lease_until
        expect({
          id: automation.id,
          nextRun: delayed.next_run,
          leaseOwner: delayed.lease_owner,
        }).toEqual({
          id: automation.id,
          nextRun: automation.nextRun,
          leaseOwner: Identifier.deterministic(
            "call",
            `automation-busy-session-delay-v1\0${automation.id}\0${automation.nextRun}`,
          ),
        })
        expect(delayedLeaseUntil).toBeGreaterThan(Date.now())

        assistant.finish = "stop"
        assistant.time.completed = Date.now()
        await Session.updateMessage(assistant)
        promptOwnerReleased = SessionPromptOwner.release(promptOwner.authority)
        expect(promptOwnerReleased).toBe(true)
        await expect(AutomationService.runNow(automation.id)).rejects.toBeInstanceOf(AutomationRunningConflictError)
        await expect(
          AutomationService.update({ id: automation.id, prompt: "fenced mutation" }),
        ).rejects.toBeInstanceOf(AutomationRunningConflictError)
        expect(() => AutomationService.remove(automation.id)).toThrow(AutomationRunningConflictError)
      } finally {
        if (!promptOwnerReleased) SessionPromptOwner.release(promptOwner.authority)
      }
    } })
  }, 15_000)

  test("manual execution ignores stale local lifecycle when durable Session execution is idle", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "stale local lifecycle" })
      const input = await Session.updateMessage({
        id: Identifier.ascending("message"),
        role: "user",
        sessionID: session.id,
        author: "user",
        time: { created: Date.now() },
        agent: "assistant",
        model: { providerID: "test", modelID: "test" },
      })
      const localOwner = new AbortController()
      SessionStatus.beginExecutionOccurrence(session.id, input.id, localOwner.signal)
      await SessionStatus.set(session.id, { type: "streaming" }, { inputMessageID: input.id })
      try {
        const automation = await AutomationService.create({
          name: "durable idle wins",
          target: { scope: "session", sessionId: session.id },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "run from the durable idle fact",
        })
        using _wake = AutomationService.TestHooks.installWakeExecutor(async (wake) => ({
          sessionID: wake.sessionID!,
          messageID: wake.messageID!,
          activation: Promise.resolve({ owner: new AbortController().signal }),
          completion: Promise.resolve({ ok: true as const }),
        }))
        const runs = await AutomationService.runNow(automation.id)
        expect(runs.map((run) => run.outcome)).toEqual(["succeeded"])
      } finally {
        SessionStatus.release(session.id)
      }
    } })
  }, 15_000)

  test("a live standby Prompt owner without an unfinished assistant allows one manual claim", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "standby Prompt owner" })
      const standby = SessionPromptOwner.acquire({
        sessionID: session.id,
        projectID: Instance.project.id,
        directory: Instance.directory,
      })
      if (!standby.acquired) throw new Error("Standby fixture did not acquire its Prompt owner")
      try {
        const automation = await AutomationService.create({
          name: "standby claim",
          target: { scope: "session", sessionId: session.id },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "claim while the Prompt owner is in standby",
        })
        const claimed = AutomationService.TestHooks.claim(automation.id, "standby-manual-owner", Date.now(), true)
        expect(claimed).toMatchObject({
          id: automation.id,
          lease_owner: "standby-manual-owner",
          pending_fire_id: expect.stringMatching(/^atm_/),
        })
      } finally {
        SessionPromptOwner.release(standby.authority)
      }
    } })
  }, 15_000)

  test("a dead Prompt owner with an unfinished assistant permits one manual takeover claim", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "dead Prompt owner" })
      const execution = await acquireDurablePromptExecution(session, project.path)
      using _dead = SessionPromptOwner.TestHooks.installActiveExecutionObservation(() => "dead_or_reused")
      try {
        const automation = await AutomationService.create({
          name: "dead owner takeover",
          target: { scope: "session", sessionId: session.id },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "take over after the exact owner died",
        })
        const claimed = AutomationService.TestHooks.claim(automation.id, "dead-owner-successor", Date.now(), true)
        expect(claimed).toMatchObject({
          id: automation.id,
          lease_owner: "dead-owner-successor",
          pending_fire_id: expect.stringMatching(/^atm_/),
        })
      } finally {
        await execution.settle()
      }
    } })
  }, 15_000)

  test("an unknown-live Prompt owner with an unfinished assistant keeps manual execution fenced", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "unknown-live Prompt owner" })
      const execution = await acquireDurablePromptExecution(session, project.path)
      using _unknown = SessionPromptOwner.TestHooks.installActiveExecutionObservation(() => "unknown_live")
      try {
        const automation = await AutomationService.create({
          name: "unknown owner fence",
          target: { scope: "session", sessionId: session.id },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "preserve the unknown live execution",
        })
        await expect(AutomationService.runNow(automation.id)).rejects.toBeInstanceOf(AutomationRunningConflictError)
      } finally {
        await execution.settle()
      }
    } })
  }, 15_000)

  test("manual execution returns only runs bound to its exact definition revision and fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({ name: "manual", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "run" })
      const runs = await AutomationService.TestHooks.runNowWithExecutor(automation.id, async (job) => {
        const fireID = job.pending_fire_id!
        const runID = Identifier.ascending("automation")
        Database.transaction((db) => {
          db.insert(AutomationRunTable).values({ id: runID, automation_revision_id: job.revision_id, fire_id: fireID, target_project_id: Instance.project.id, started_at: Date.now() }).run()
          db.insert(AutomationRunReceiptTable).values({ id: Identifier.ascending("automation"), run_id: runID, outcome: "succeeded", time_created: Date.now() }).run()
        })
        return fireID
      })
      expect(runs).toHaveLength(1)
      expect(runs[0]).toMatchObject({ automationId: automation.id, outcome: "succeeded" })
    } })
  })

  test("updates and removal append revisions while historical runs retain their exact definition", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const created = await AutomationService.create({ name: "v1", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "first" })
      const updated = await AutomationService.update({ id: created.id, name: "v2", prompt: "second" })
      expect(updated).toMatchObject({ id: created.id, name: "v2", prompt: "second" })
      expect(AutomationService.remove(created.id)).toEqual({ id: created.id, name: "v2" })
      const revisions = Database.use((db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, created.id)).orderBy(AutomationTable.revision).all())
      expect(revisions.map((row) => ({ revision: row.revision, name: row.name }))).toEqual([
        { revision: 1, name: "v1" },
        { revision: 2, name: "v2" },
      ])
      expect(Database.use((db) => db.select().from(AutomationDefinitionTombstoneTable).where(eq(AutomationDefinitionTombstoneTable.definition_id, created.id)).get()))
        .toMatchObject({ definition_id: created.id, revision: 3 })
      expect(AutomationService.list().some((row) => row.id === created.id)).toBe(false)
    } })
  })

  test("a claim publishes the lease it took and a refused claim leaves the first owner in place", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({ name: "fenced", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "run" })
      const now = Date.now()
      const claimed = AutomationService.TestHooks.claim(automation.id, "owner:first", now, true)
      const current = Database.use((db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, automation.id)).orderBy(AutomationTable.revision).all()).at(-1)!
      expect(claimed).toMatchObject({
        id: automation.id,
        revision_id: current.id,
        revision: current.revision,
        lease_owner: "owner:first",
        lease_until: now + 2 * 60 * 1000,
      })
      expect(AutomationService.TestHooks.claim(automation.id, "owner:second", now, true)).toBeUndefined()
      expect(Database.use((db) => currentControlLeaseInTransaction(db, "automation", automation.id)))
        .toMatchObject({ owner_occurrence_id: "owner:first", expires_at: now + 2 * 60 * 1000 })
      expect(Database.use((db) => db.select().from(EngineControlActivationLeaseTable)
        .where(and(eq(EngineControlActivationLeaseTable.target, "automation"), eq(EngineControlActivationLeaseTable.target_id, automation.id))).all()))
        .toHaveLength(1)
    } })
  })

  test("terminal legacy Fire history advances recurrence without replaying an old due occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const now = Date.now()
      const automation = await AutomationService.create({
        name: "migrated recurrence boundary",
        target: { scope: "project", projectIds: [Instance.project.id] },
        recurrence: "DTSTART:20200101T000000Z\nRRULE:FREQ=DAILY",
        prompt: "do not backfill",
      })
      const definition = Database.use((db) =>
        db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, automation.id)).get()!,
      )
      Database.transaction((db) => {
        for (let index = 0; index < 128; index += 1) {
          const outcome = index % 2 === 0 ? ("succeeded" as const) : ("failed" as const)
          const fireID = `cal_legacy_${index}`
          const runID = `atr_legacy_${index}`
          const occurrenceTime = now - (128 - index) * 86_400_000
          db.insert(AutomationFireTable).values({
            id: fireID,
            automation_revision_id: definition.id,
            scheduled_due_at: occurrenceTime,
            origin: "legacy",
            tool_part_id: null,
            input_digest: null,
            time_created: occurrenceTime,
          }).run()
          db.insert(AutomationRunTable).values({
            id: runID,
            automation_revision_id: definition.id,
            fire_id: fireID,
            target_project_id: Instance.project.id,
            started_at: occurrenceTime,
          }).run()
          db.insert(AutomationRunReceiptTable).values({
            id: `arc_legacy_${index}`,
            run_id: runID,
            outcome,
            error: outcome === "failed" ? "historical failure" : null,
            time_created: index === 127 ? now : occurrenceTime + 1_000,
          }).run()
        }
      })
      const projected = Database.use((db) => projectAutomationFrontierInTransaction(db, definition))
      expect(projected.next_run).toBeGreaterThan(now)
      const before = Database.use((db) =>
        db.select().from(AutomationFireTable).where(eq(AutomationFireTable.automation_revision_id, definition.id)).all().length,
      )
      await AutomationService.runDueNow()
      expect(Database.use((db) =>
        db.select().from(AutomationFireTable).where(eq(AutomationFireTable.automation_revision_id, definition.id)).all().length,
      )).toBe(before)
      expect(AutomationService.TestHooks.claim(automation.id, "legacy-boundary-owner", now, false)).toBeUndefined()
    } })
  })

  test("indexed frontier pages use fixed set queries and agree with public reduction across definitions and targets", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const now = Date.now()
      const definitionIDs = Array.from({ length: 96 }, (_, index) => `atm_frontier_page_${index}`)
      Database.transaction((db) => {
        for (const [index, definitionID] of definitionIDs.entries()) {
          db.insert(AutomationTable).values({
            id: definitionID,
            definition_id: definitionID,
            revision: 1,
            project_id: Instance.project.id,
            name: `frontier ${index}`,
            kind: "recurring",
            scope: "project",
            recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
            execution_mode: "local",
            prompt: "frontier",
            agent: "default",
            status: "active",
            time_created: 1,
          }).run()
          for (let history = 0; history < 8; history += 1) {
            const fireID = `cal_frontier_${index}_history_${history}`
            const runID = `atr_frontier_${index}_history_${history}`
            db.insert(AutomationFireTable).values({
              id: fireID,
              automation_revision_id: definitionID,
              scheduled_due_at: 100 + history,
              origin: "legacy",
              time_created: 100 + history,
            }).run()
            db.insert(AutomationRunTable).values({
              id: runID,
              automation_revision_id: definitionID,
              fire_id: fireID,
              target_project_id: Instance.project.id,
              started_at: 100 + history,
            }).run()
            if (index === 95 && history === 7) {
              db.insert(AutomationRunReceiptTable).values({
                id: "arc_frontier_success_reset_retry",
                run_id: runID,
                outcome: "retry_wait",
                retry_at: 199,
                error: "transient before success",
                time_created: 199,
              }).run()
            }
            db.insert(AutomationRunReceiptTable).values({
              id: `arc_frontier_${index}_history_${history}`,
              run_id: runID,
              outcome: "succeeded",
              time_created: 200 + history,
            }).run()
          }
          if (index % 2 !== 0) continue
          const fireID = `cal_frontier_${index}_pending`
          const attemptID = `afa_frontier_${index}`
          const retryAt = index % 4 === 0 ? now - 1 : now + 60_000
          db.insert(AutomationFireTable).values({
            id: fireID,
            automation_revision_id: definitionID,
            scheduled_due_at: now - 1_000,
            origin: "scheduled",
            time_created: now - 1_000,
          }).run()
          db.insert(EngineControlActivationLeaseTable).values({
            id: `lease_frontier_${index}`,
            target: "automation",
            target_id: definitionID,
            owner_occurrence_id: `owner:${index}`,
            time_activated: now - 2_000,
            expires_at: now - 500,
          }).run()
          db.insert(AutomationFireAttemptTable).values({
            id: attemptID,
            fire_id: fireID,
            ordinal: 1,
            owner_occurrence_id: `owner:${index}`,
            time_created: now - 1_000,
          }).run()
          db.insert(AutomationFireAttemptReceiptTable).values({
            attempt_id: attemptID,
            outcome: "reserved",
            time_created: now - 999,
          }).run()
          for (let target = 0; target < 3; target += 1) {
            const runID = `atr_frontier_${index}_pending_${target}`
            db.insert(AutomationRunTable).values({
              id: runID,
              automation_revision_id: definitionID,
              fire_id: fireID,
              target_project_id: `${Instance.project.id}:${target}`,
              started_at: now - 900 + target,
            }).run()
            db.insert(AutomationRunReceiptTable).values({
              id: `arc_frontier_${index}_pending_${target}`,
              run_id: runID,
              outcome: target === 0 ? "succeeded" : "retry_wait",
              retry_at: target === 0 ? null : retryAt,
              error: target === 0 ? null : `retry target ${target}`,
              time_created: now - 800 + target,
            }).run()
          }
        }
      })
      const { compared, stages } = Database.use((db) => {
        const stages: string[] = []
        const batched = new Map(
          currentAutomationFrontiersInTransaction(db, { observe: (stage) => stages.push(stage) })
            .filter((row) => definitionIDs.includes(row.definition_id))
            .map((row) => [row.definition_id, row]),
        )
        const compared = definitionIDs.map((definitionID) => {
          const definition = db.select().from(AutomationTable).where(eq(AutomationTable.id, definitionID)).get()!
          const full = projectAutomationInTransaction(db, definition)
          const frontier = batched.get(definitionID)!
          return {
            definitionID,
            full: {
              nextRun: full.next_run,
              pendingFireID: full.pending_fire_id,
              failureCount: full.failure_count,
              lastError: full.last_error,
              attemptID: full.attempt_id,
              attemptOrdinal: full.attempt_ordinal,
            },
            frontier: {
              nextRun: frontier.next_run,
              pendingFireID: frontier.pending_fire_id,
              failureCount: frontier.failure_count,
              lastError: frontier.last_error,
              attemptID: frontier.attempt_id,
              attemptOrdinal: frontier.attempt_ordinal,
            },
          }
        })
        return { compared, stages }
      })
      expect(compared.find((entry) => JSON.stringify(entry.full) !== JSON.stringify(entry.frontier))).toBeUndefined()
      expect(compared.filter((entry) => entry.frontier.nextRun <= now).map((entry) => entry.definitionID))
        .toEqual(definitionIDs.filter((_, index) => index % 4 === 0))
      expect(compared.find((entry) => entry.definitionID === "atm_frontier_page_95")?.frontier.failureCount).toBe(0)
      expect(stages).toEqual([
        "definitions", "fires", "runs", "attempts", "leases",
        "definitions", "fires", "runs", "attempts", "leases",
      ])
      const plan = Database.use((db) => db.all<{ detail: string }>(sql`
        EXPLAIN QUERY PLAN
        SELECT candidate.id
        FROM automation_fire AS candidate
        JOIN automation AS revision ON revision.id=candidate.automation_revision_id
        WHERE revision.definition_id=${definitionIDs[0]!}
        ORDER BY candidate.scheduled_due_at DESC,candidate.time_created DESC,candidate.id DESC
        LIMIT 1
      `))
      expect(plan.some((entry) => entry.detail.includes("automation_definition_latest_idx"))).toBe(true)
      expect(plan.some((entry) => entry.detail.includes("automation_fire_revision_frontier_idx"))).toBe(true)
      const definitionPlan = Database.use((db) => db.all<{ detail: string }>(sql`
        EXPLAIN QUERY PLAN
        SELECT current.*
        FROM automation AS current
        WHERE current.definition_id>${"atm_frontier_page_0"}
          AND current.status='active'
          AND NOT EXISTS (
            SELECT 1 FROM automation AS candidate
            WHERE candidate.definition_id=current.definition_id
              AND (
                candidate.revision>current.revision
                OR (candidate.revision=current.revision AND candidate.id>current.id)
              )
          )
          AND NOT EXISTS (
            SELECT 1 FROM automation_definition_tombstone AS tombstone
            WHERE tombstone.definition_id=current.definition_id
              AND tombstone.revision>=current.revision
          )
        ORDER BY current.definition_id,current.revision DESC,current.id DESC
        LIMIT 65
      `))
      expect(definitionPlan.some((entry) => entry.detail.includes("automation_definition_latest_idx"))).toBe(true)
      expect(definitionPlan.some((entry) => entry.detail.includes("automation_definition_tombstone_latest_idx")))
        .toBe(true)
    } })
  })

  test("manual API and scheduled Fires at the same due millisecond retain distinct occurrence identities", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({
        name: "manual and scheduled identity",
        target: { scope: "session", sessionId: (await Session.create({ kind: "root", title: "Fire identity" })).id },
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
        prompt: "run",
      })
      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
        sessionID: input.sessionID!,
        messageID: input.messageID!,
        activation: Promise.resolve({ owner: new AbortController().signal }),
        completion: Promise.resolve({ ok: true as const }),
      }))
      const exactDue = AutomationService.list().find((row) => row.id === automation.id)!.nextRun
      const manualOwner = `manual-exact-due:${exactDue}`
      const manual = AutomationService.TestHooks.claim(automation.id, manualOwner, exactDue, true)!
      expect(manual).toBeDefined()
      await AutomationService.TestHooks.executeClaimedDueOccurrence({ job: manual, owner: manualOwner, now: exactDue })

      const scheduledOwner = `scheduled-exact-due:${exactDue}`
      const scheduled = AutomationService.TestHooks.claim(automation.id, scheduledOwner, exactDue, false)!
      expect(scheduled).toBeDefined()
      expect(scheduled.pending_fire_id).not.toBe(manual.pending_fire_id)
      const fires = Database.use((db) =>
        db
          .select()
          .from(AutomationFireTable)
          .where(eq(AutomationFireTable.automation_revision_id, manual.revision_id))
          .all(),
      )
      expect(fires.map((fire) => ({ id: fire.id, origin: fire.origin, due: fire.scheduled_due_at })))
        .toEqual(expect.arrayContaining([
          { id: manual.pending_fire_id, origin: "manual_api", due: exactDue },
          { id: scheduled.pending_fire_id, origin: "scheduled", due: exactDue },
        ]))
    } })
  }, 30_000)

  test("a completed fire ends its execution lease with its terminal receipt, so the definition is immediately mutable", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({ name: "settling", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "run" })
      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
        sessionID: input.sessionID!,
        messageID: input.messageID!,
        activation: Promise.resolve({ owner: new AbortController().signal }),
        completion: Promise.resolve({ ok: true as const }),
      }))
      const runs = await AutomationService.runNow(automation.id)
      expect(runs.map((run) => run.outcome)).toEqual(["succeeded"])
      const settled = Database.use((db) => currentControlLeaseInTransaction(db, "automation", automation.id))!
      expect(settled.expires_at).toBeLessThanOrEqual(Date.now())
      expect(AutomationService.remove(automation.id)).toEqual({ id: automation.id, name: "settling" })
    } })
  }, 30_000)

  test("a Mission run stays bound to its first opened occurrence when the Mission closes and reopens", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      await Config.updateProjectPatch({
        model: "scheduler-automation-mission/wake-model",
        provider: {
          "scheduler-automation-mission": {
            name: "Scheduler Automation Mission test",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:1/v1",
            models: {
              "wake-model": {
                name: "Scheduler Automation Mission model",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 32_000, output: 4_096 },
              },
            },
          },
        },
      })
      const mission = await ensureMissionSession({
        missionID: `automation-mission-${Date.now()}`,
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      await openMissionOccurrence(mission, "automation-old-occurrence")
      const automation = await AutomationService.create({
        name: "Mission closure disposition",
        target: { scope: "session", sessionId: mission.id },
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
        prompt: "This old run must not cross the reopen.",
      })
      using _admission = AutomationService.TestHooks.installBeforeMissionSessionAdmission(async () => {
        await closeMissionExecutionOperation({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "close-automation-old-occurrence",
          provenance: { kind: "request", surface: "api", reason: "Close the Automation occurrence" },
          signal: AbortSignal.timeout(20_000),
        })
        await openMissionOccurrence(mission, "automation-new-occurrence")
      })
      const [run] = await AutomationService.runNow(automation.id)
      expect(run).toMatchObject({
        outcome: "disposition",
        disposition: "mission_closed",
        closureEventID: expect.stringMatching(/^pev_/),
      })
    } })
  }, 60_000)

  test("a closed Mission reservation atomically survives a post-commit crash and a later reopen", async () => {
    await using project = await memoryProject()
    const missionID = `automation-closed-reservation-${Date.now()}`
    const first = await Instance.provide({ directory: project.path, fn: async () => {
      await Config.updateProjectPatch({
        model: "scheduler-automation-mission/wake-model",
        provider: {
          "scheduler-automation-mission": {
            name: "Scheduler Automation Mission test",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:1/v1",
            models: {
              "wake-model": {
                name: "Scheduler Automation Mission model",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 32_000, output: 4_096 },
              },
            },
          },
        },
      })
      const mission = await ensureMissionSession({
        missionID,
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      await openMissionOccurrence(mission, "automation-closed-reservation-open")
      const automation = await AutomationService.create({
        name: "Closed Mission durable reservation",
        target: { scope: "session", sessionId: mission.id },
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
        prompt: "Never cross this closed Mission occurrence.",
      })
      const closed = await closeMissionExecutionOperation({
        missionID,
        sessionID: mission.id,
        source: "mission.abort",
        requestID: "automation-closed-reservation-close",
        provenance: { kind: "request", surface: "api", reason: "Close before Automation reservation" },
        signal: AbortSignal.timeout(20_000),
      })
      using _crash = AutomationService.TestHooks.installAfterRunReservation(() => {
        throw new Error("simulated Automation process crash after durable reservation")
      })
      await expect(AutomationService.runNow(automation.id)).rejects.toThrow("simulated Automation process crash")
      const [run] = Database.use((db) => {
        const revision = db.select({ id: AutomationTable.id }).from(AutomationTable)
          .where(eq(AutomationTable.definition_id, automation.id)).get()!
        return db.select().from(AutomationRunTable)
          .where(eq(AutomationRunTable.automation_revision_id, revision.id)).all()
      })
      const receipts = Database.use((db) => db.select().from(AutomationRunReceiptTable)
        .where(eq(AutomationRunReceiptTable.run_id, run!.id)).all())
      return { missionSessionID: mission.id, automationID: automation.id, runID: run!.id, closureEventID: closed.eventID, run, receipts }
    } })

    await Instance.provide({ directory: project.path, fn: async () => {
      const mission = await ensureMissionSession({
        missionID,
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      await openMissionOccurrence(mission, "automation-closed-reservation-reopen")
      const recovered = AutomationService.listRuns(first.automationID).find((run) => run.id === first.runID)
      expect({ first, recovered }).toMatchObject({
        first: {
          run: {
            mission_opened_event_id: null,
            mission_disposition: "mission_closed",
            mission_closure_event_id: first.closureEventID,
          },
          receipts: [{ outcome: "disposition", disposition: "mission_closed", closure_event_id: first.closureEventID }],
        },
        recovered: {
          outcome: "disposition",
          disposition: "mission_closed",
          closureEventID: first.closureEventID,
        },
      })
    } })
  }, 60_000)

  test("a target retry receipt releases ownership while retaining one pending logical fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({ name: "retrying", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "run" })
      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
        sessionID: input.sessionID!,
        messageID: input.messageID!,
        activation: Promise.resolve({ owner: new AbortController().signal }),
        completion: Promise.resolve({ ok: false as const, error: "wake refused" }),
      }))
      const runs = await AutomationService.runNow(automation.id)
      expect(runs.map((run) => run.outcome)).toEqual(["retry_wait"])
      const settled = Database.use((db) => currentControlLeaseInTransaction(db, "automation", automation.id))!
      expect(settled.expires_at).toBeLessThanOrEqual(Date.now())
      expect(AutomationService.list().find((candidate) => candidate.id === automation.id))
        .toMatchObject({ id: automation.id, failureCount: 1 })
      expect(() => AutomationService.remove(automation.id)).toThrow(AutomationRunningConflictError)
    } })
  }, 30_000)

  test("a pre-reservation failure settles only its physical attempt and retains the logical fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({ name: "throwing", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "run" })
      const now = Date.now()
      const owner = `manual:${process.pid}:${now}`
      const job = AutomationService.TestHooks.claim(automation.id, owner, now, true)!
      expect(job).toBeDefined()
      await expect(
        AutomationService.TestHooks.executeWithRuntimeSettlement(job, owner, now, false, async () => {
          throw new Error("fire refused")
        }),
      ).rejects.toThrow("fire refused")
      const settled = Database.use((db) => currentControlLeaseInTransaction(db, "automation", automation.id))!
      expect(settled.expires_at).toBeLessThanOrEqual(Date.now())
      expect(Database.use((db) => ({
        receipt: db.select().from(AutomationFireAttemptReceiptTable)
          .where(eq(AutomationFireAttemptReceiptTable.attempt_id, job.attempt_id!)).get(),
        runs: db.select().from(AutomationRunTable)
          .where(eq(AutomationRunTable.fire_id, job.pending_fire_id!)).all(),
      }))).toMatchObject({
        receipt: { attempt_id: job.attempt_id, outcome: "retry_wait", retry_at: expect.any(Number), error: "fire refused" },
        runs: [],
      })
      expect(() => AutomationService.remove(automation.id)).toThrow(AutomationRunningConflictError)
    } })
  }, 30_000)

  test("a multi-project retry keeps one logical fire and executes only the unsettled target", async () => {
    await using firstProject = await memoryProject()
    await using secondProject = await memoryProject()
    const secondProjectID = await Instance.provide({
      directory: secondProject.path,
      fn: async () => Instance.project.id,
    })
    await Instance.provide({ directory: firstProject.path, fn: async () => {
      const firstProjectID = Instance.project.id
      const calls: string[] = []
      let refuseSecondTarget = true
      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => {
        const projectID = Instance.project.id
        calls.push(projectID)
        const refused = projectID === secondProjectID && refuseSecondTarget
        return {
          sessionID: input.sessionID!,
          messageID: input.messageID!,
          activation: Promise.resolve({ owner: new AbortController().signal }),
          completion: Promise.resolve(
            refused ? { ok: false as const, error: "second target refused once" } : { ok: true as const },
          ),
        }
      })
      const automation = await AutomationService.create({
        name: "partial multi-project retry",
        target: { scope: "project", projectIds: [firstProjectID, secondProjectID] },
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
        prompt: "retry only the unsettled target",
      })

      const first = await AutomationService.runNow(automation.id)
      expect(Object.fromEntries(first.map((run) => [run.targetProjectId, run.outcome]))).toEqual({
        [firstProjectID]: "succeeded",
        [secondProjectID]: "retry_wait",
      })
      const retryAt = Database.use((db) =>
        db
          .select({ retryAt: AutomationRunReceiptTable.retry_at })
          .from(AutomationRunReceiptTable)
          .innerJoin(AutomationRunTable, eq(AutomationRunReceiptTable.run_id, AutomationRunTable.id))
          .where(
            and(
              eq(AutomationRunTable.fire_id, first[0]!.fireId),
              eq(AutomationRunTable.target_project_id, secondProjectID),
              eq(AutomationRunReceiptTable.outcome, "retry_wait"),
            ),
          )
          .get()!.retryAt!,
      )
      refuseSecondTarget = false
      const owner = `retry:${process.pid}:${retryAt}`
      const retry = AutomationService.TestHooks.claim(automation.id, owner, retryAt, false)!
      expect(retry.pending_fire_id).toBe(first[0]!.fireId)
      await AutomationService.TestHooks.executeClaimedDueOccurrence({ job: retry, owner, now: retryAt })

      expect(
        Object.fromEntries(AutomationService.listRuns(automation.id).map((run) => [run.targetProjectId, run.outcome])),
      ).toEqual({
        [firstProjectID]: "succeeded",
        [secondProjectID]: "succeeded",
      })
      expect({
        first: calls.filter((projectID) => projectID === firstProjectID).length,
        second: calls.filter((projectID) => projectID === secondProjectID).length,
      }).toEqual({ first: 1, second: 2 })
    } })
  }, 60_000)

  test("a live execution lease atomically rejects definition mutation", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const created = await AutomationService.create({ name: "leased", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "first" })
      expect(acquireControlLease({ target: "automation", targetID: created.id, ownerOccurrenceID: "owner:race", now: Date.now(), leaseMilliseconds: 30_000 }).acquired).toBe(true)
      await expect(AutomationService.update({ id: created.id, prompt: "conflict" })).rejects.toBeInstanceOf(AutomationRunningConflictError)
      expect(Database.use((db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, created.id)).all())).toHaveLength(1)
    } })
  })

  test("a global fire uses the process runtime creator and wakes its exact canonical Session", async () => {
    await using project = await memoryProject()
    let carryingProjectID: string | undefined
    try {
      await Instance.provide({ directory: project.path, fn: async () => {
      const outerProjectID = Instance.project.id
      const outerDirectory = Instance.directory
      const creatorInputs: Array<{ experience: string; model?: string; sessionID?: string }> = []
      const wakeContexts: Array<{ sessionID: string; projectID: string; directory: string }> = []
      const originalCreate = GlobalConversationService.create
      const createGlobalConversation = spyOn(GlobalConversationService, "create").mockImplementation(
        async (input) => {
          creatorInputs.push(input)
          const created = await originalCreate(input)
          carryingProjectID = created.session.projectID
          return created
        },
      )
      using _creatorState = AutomationService.TestHooks.isolateGlobalConversationCreator()
      try {
        Server.initializeGlobalAutomation()
        Server.initializeGlobalAutomation()
        expect(() =>
          AutomationService.initGlobal({ createGlobalConversation: async (input) => originalCreate(input) }),
        ).toThrow("Global Automation conversation creator is already bound to another implementation.")
        using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => {
          wakeContexts.push({
            sessionID: input.sessionID!,
            projectID: Instance.project.id,
            directory: Instance.directory,
          })
          return {
            sessionID: input.sessionID!,
            messageID: input.messageID!,
            activation: Promise.resolve({ owner: new AbortController().signal }),
            completion: Promise.resolve({ ok: true as const }),
          }
        })
        const automation = await AutomationService.create({
          name: "global-runtime-composition",
          target: { scope: "global" },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "wake the canonical global conversation",
        })

        const runs = await AutomationService.runNow(automation.id)
        const canonicalSession = await Session.get(runs[0]!.session!.id)
        carryingProjectID = canonicalSession.projectID

        expect(creatorInputs).toEqual([
          { experience: "chat", model: undefined, sessionID: canonicalSession.id },
        ])
        expect({
          projectChanged: canonicalSession.projectID !== outerProjectID,
          directoryChanged: canonicalSession.directory !== outerDirectory,
        }).toEqual({ projectChanged: true, directoryChanged: true })
        expect(wakeContexts).toEqual([
          {
            sessionID: canonicalSession.id,
            projectID: canonicalSession.projectID,
            directory: canonicalSession.directory,
          },
        ])
        expect(runs).toMatchObject([
          {
            automationId: automation.id,
            targetScope: "global",
            targetProjectId: null,
            outcome: "succeeded",
            session: { id: canonicalSession.id, directory: canonicalSession.directory, kind: "assistant" },
          },
        ])
      } finally {
        createGlobalConversation.mockRestore()
      }
      } })
    } finally {
      const carryingProject = carryingProjectID ? Project.get(carryingProjectID) : undefined
      if (carryingProject) {
        await deleteProject(carryingProject, {
          actor: "user",
          source: "project.delete",
          surface: "api",
          requestID: randomUUID(),
          reason: "Clean up the global Automation composition contract Project",
        })
      }
    }
  }, 30_000)
})
