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
import { AutomationDefinitionTombstoneTable, AutomationRunReceiptTable, AutomationRunTable, AutomationTable } from "../src/scheduler/automation.sql"
import { AutomationRunningConflictError, AutomationService } from "../src/scheduler/automation-service"
import { Database, and, eq } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Config } from "@/config/config"
import { SessionWake } from "@/session/wake"
import {
  closeMissionExecutionOperation,
  missionOperatorWakeReason,
  openMissionExecutionWithWake,
} from "@/mission/execution-closure"
import { ensureMissionSession } from "@/mission/session"

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

describe("scheduler immutable definition and fire identity", () => {
  test("manual execution returns only runs bound to its exact definition revision and fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({ name: "manual", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "run" })
      const runs = await AutomationService.TestHooks.runNowWithExecutor(automation.id, async (job) => {
        const fireID = Identifier.ascending("call")
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

  test("a failed fire ends its execution lease with its retry receipt, so the recorded retry time is the only deferral", async () => {
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
      expect(AutomationService.remove(automation.id)).toEqual({ id: automation.id, name: "retrying" })
    } })
  }, 30_000)

  test("a fire that throws hands back its lease with its failure receipt", async () => {
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
      // The failure receipt owns the retry time, so the definition is mutable
      // immediately instead of waiting out the lease.
      expect(AutomationService.remove(automation.id)).toEqual({ id: automation.id, name: "throwing" })
    } })
  }, 30_000)

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
