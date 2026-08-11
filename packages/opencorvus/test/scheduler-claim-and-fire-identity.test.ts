import { afterAll, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { InstanceLifecycleContext } from "../src/project/instance-lifecycle-context"
import { Project } from "../src/project/project"
import { Session } from "../src/session"
import { MessageTable, PartTable } from "../src/session/session.sql"
import { SessionWake } from "../src/session/wake"
import { AutomationRunTable, AutomationTable } from "../src/scheduler/automation.sql"
import { AutomationService } from "../src/scheduler/automation-service"
import { Scheduler, SchedulerDisposalInactivityError } from "../src/scheduler"
import { TaskQueueTable, type TaskQueuePriority } from "../src/scheduler/task-queue.sql"
import { TaskQueueService } from "../src/scheduler/task-queue-service"
import { Database, eq } from "../src/storage/db"
import { assertStartedTaskProjectRecoverySucceeded } from "../src/engine/host-recovery"
import { RuntimeExecutionSettlement } from "../src/runtime/execution-settlement"
import { AutomationRunViewSchema } from "../src/server/routes/global"
import { RuntimeServerOwnership } from "../src/server/runtime-server-ownership"
import { Server } from "../src/server/server"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

function insertQueuedTask(input: { id: string; sessionID: string; priority: TaskQueuePriority; timeCreated: number }) {
  Database.use((db) =>
    db
      .insert(TaskQueueTable)
      .values({
        id: input.id,
        session_id: input.sessionID,
        prompt: input.id,
        priority: input.priority,
        status: "queued",
        source: "scheduler-positive-contract",
        metadata: { kind: "session_prompt", input: {} },
        time_created: input.timeCreated,
        time_updated: input.timeCreated,
      })
      .run(),
  )
}

async function createSession(title: string) {
  return Session.createNext({
    directory: Instance.directory,
    kind: "assistant",
    title,
  })
}

describe("scheduler atomic identity and progress contracts", () => {
  test("surfaces every started-Task project recovery failure as a startup contract error", () => {
    expect(() =>
      assertStartedTaskProjectRecoverySucceeded({
        attempted: 2,
        initialized: 0,
        failures: [
          { directory: "D:/project-a", error: "database unavailable" },
          { directory: "D:/project-b", error: "worktree unavailable" },
        ],
      }),
    ).toThrow(
      expect.objectContaining({
        name: "AggregateError",
        message: "Failed to recover 2 started Task project(s)",
        errors: [
          expect.objectContaining({ message: "D:/project-a: database unavailable" }),
          expect.objectContaining({ message: "D:/project-b: worktree unavailable" }),
        ],
      }),
    )
  })

  test("reserves one shared project concurrency slot across two Instance directories", async () => {
    const previousConcurrency = process.env.OPENCORVUS_TASK_QUEUE_CONCURRENCY
    process.env.OPENCORVUS_TASK_QUEUE_CONCURRENCY = "1"
    try {
      await using project = await memoryProject()
      const setup = await Instance.provide({
        directory: project.path,
        fn: async () => {
          const peerDirectory = path.join(project.path, "queue-peer-instance")
          await fs.mkdir(peerDirectory, { recursive: true })
          await Project.addSandbox(Instance.project.id, peerDirectory)
          const firstSession = await createSession("Cross-Instance concurrency first")
          const secondSession = await createSession("Cross-Instance concurrency second")
          return { peerDirectory, firstSessionID: firstSession.id, secondSessionID: secondSession.id }
        },
      })
      await Instance.provide({ directory: setup.peerDirectory, fn: () => undefined })

      let readyInstances = 0
      let reportBothInstancesReady!: () => void
      const bothInstancesReady = new Promise<void>((resolve) => (reportBothInstancesReady = resolve))
      let startClaims!: () => void
      const claimsStarted = new Promise<void>((resolve) => (startClaims = resolve))
      let releaseValidations!: () => void
      const validationsReleased = new Promise<void>((resolve) => (releaseValidations = resolve))
      let reportBothValidations!: () => void
      const bothValidations = new Promise<void>((resolve) => (reportBothValidations = resolve))
      let validationCount = 0
      const claimFrom = (directory: string) =>
        Instance.provideProjectIdentity({
          directory,
          fn: async () => {
            readyInstances += 1
            if (readyInstances === 2) reportBothInstancesReady()
            await claimsStarted
            return TaskQueueService.TestHooks.claimReadyTaskIDs({
              limit: 1,
              beforeValidation: async () => {
                validationCount += 1
                if (validationCount === 2) reportBothValidations()
                await validationsReleased
              },
            })
          },
        })
      const primaryClaim = claimFrom(project.path)
      const peerClaim = claimFrom(setup.peerDirectory)
      await bothInstancesReady

      const firstID = Identifier.ascending("task")
      const secondID = Identifier.ascending("task")
      const createdAt = Date.now()
      insertQueuedTask({ id: firstID, sessionID: setup.firstSessionID, priority: "normal", timeCreated: createdAt })
      insertQueuedTask({
        id: secondID,
        sessionID: setup.secondSessionID,
        priority: "normal",
        timeCreated: createdAt + 1,
      })

      startClaims()
      await bothValidations
      releaseValidations()
      const [primaryClaimed, peerClaimed] = await Promise.all([primaryClaim, peerClaim])
      const rows = Database.use((db) =>
        db
          .select({ id: TaskQueueTable.id, status: TaskQueueTable.status })
          .from(TaskQueueTable)
          .where(eq(TaskQueueTable.source, "scheduler-positive-contract"))
          .all()
          .filter((row) => row.id === firstID || row.id === secondID)
          .sort((left, right) => left.id.localeCompare(right.id)),
      )

      expect({
        validationCount,
        claimed: [...primaryClaimed, ...peerClaimed],
        statuses: rows.map((row) => row.status).sort(),
      }).toEqual({
        validationCount: 2,
        claimed: [firstID],
        statuses: ["queued", "running"],
      })
    } finally {
      if (previousConcurrency === undefined) delete process.env.OPENCORVUS_TASK_QUEUE_CONCURRENCY
      else process.env.OPENCORVUS_TASK_QUEUE_CONCURRENCY = previousConcurrency
    }
  }, 30_000)

  test("coalesces overlapping ticks into one ordered successor occurrence", async () => {
    const events: string[] = []
    const releases: Array<() => void> = []
    let occurrence = 0
    Scheduler.register({
      id: `scheduler-coalesced-${Identifier.ascending("call")}`,
      interval: 20,
      runAtStart: true,
      scope: "global",
      run: async () => {
        occurrence += 1
        const current = occurrence
        events.push(`start:${current}`)
        await new Promise<void>((resolve) => releases.push(resolve))
        events.push(`end:${current}`)
      },
    })
    const waitForEvent = async (event: string) => {
      const deadline = Date.now() + 2_000
      while (!events.includes(event) && Date.now() < deadline) await Bun.sleep(10)
      expect(events).toContain(event)
    }
    await waitForEvent("start:1")
    await Bun.sleep(70)
    releases.shift()!()
    await waitForEvent("start:2")
    const disposal = Scheduler.disposeGlobal()
    releases.shift()!()
    await disposal
    expect(events).toEqual(["start:1", "end:1", "start:2", "end:2"])
  })

  test("restores registered global jobs when runtime settlement rolls back", async () => {
    const events: string[] = []
    Scheduler.register({
      id: `scheduler-rollback-${Identifier.ascending("call")}`,
      interval: 20,
      runAtStart: true,
      scope: "global",
      run: async () => {
        events.push(`run:${events.length + 1}`)
      },
    })
    const waitForRuns = async (count: number) => {
      const deadline = Date.now() + 2_000
      while (events.length < count && Date.now() < deadline) await Bun.sleep(10)
      expect(events.length).toBeGreaterThanOrEqual(count)
    }
    await waitForRuns(1)
    const gate = Scheduler.acquireGlobalSettlementGate()
    await Scheduler.disposeGlobal()
    const beforeRollback = events.length
    gate[Symbol.dispose]()
    await waitForRuns(beforeRollback + 1)
    await Scheduler.disposeGlobal()
    expect(events.slice(0, beforeRollback + 1)).toEqual(
      Array.from({ length: beforeRollback + 1 }, (_, index) => `run:${index + 1}`),
    )
  })

  test("joins an in-flight instance runtime acquisition before scheduler disposal completes", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const events: string[] = []
        let release!: () => void
        const released = new Promise<void>((resolve) => (release = resolve))
        const runtime = InstanceLifecycleContext.use()
        const originalReenter = runtime.reenter.bind(runtime)
        const reenter = spyOn(runtime, "reenter").mockImplementation(async (input) => {
          events.push("acquisition-started")
          await released
          events.push("acquisition-released")
          return await originalReenter(input)
        })
        try {
          Scheduler.register({
            id: `scheduler-acquisition-${Identifier.ascending("call")}`,
            interval: 60_000,
            runAtStart: true,
            run: async () => {
              events.push("task-owned")
            },
          })
          while (!events.includes("acquisition-started")) await Bun.sleep(5)
          const disposal = Scheduler.TestHooks.disposeCurrent().then(() => events.push("disposed"))
          release()
          await disposal
          expect(events.slice(0, 3)).toEqual(["acquisition-started", "acquisition-released", "disposed"])
        } finally {
          reenter.mockRestore()
        }
      },
    })
  })

  test("claims the current highest-priority queued task after asynchronous validation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await createSession("priority claim")
        const lowID = Identifier.ascending("task")
        const highID = Identifier.ascending("task")
        const now = Date.now()
        insertQueuedTask({ id: lowID, sessionID: session.id, priority: "low", timeCreated: now })

        let insertedHigh = false
        const firstClaim = await TaskQueueService.TestHooks.claimReadyTaskIDs({
          limit: 1,
          beforeValidation: () => {
            if (insertedHigh) return
            insertedHigh = true
            insertQueuedTask({ id: highID, sessionID: session.id, priority: "high", timeCreated: now + 1 })
          },
        })
        expect(firstClaim).toEqual([highID])

        Database.use((db) =>
          db
            .update(TaskQueueTable)
            .set({ status: "completed", time_completed: now + 2, time_updated: now + 2 })
            .where(eq(TaskQueueTable.id, highID))
            .run(),
        )
        expect(await TaskQueueService.TestHooks.claimReadyTaskIDs({ limit: 1 })).toEqual([lowID])
      },
    })
  })

  test("ages an old low-priority occurrence into bounded admission ahead of new high-priority work", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const oldSession = await createSession("aged low priority")
        const newSession = await createSession("new high priority")
        const oldLowID = Identifier.ascending("task")
        const newHighID = Identifier.ascending("task")
        const now = Date.now()
        insertQueuedTask({
          id: oldLowID,
          sessionID: oldSession.id,
          priority: "low",
          timeCreated: now - 60_001,
        })
        insertQueuedTask({ id: newHighID, sessionID: newSession.id, priority: "high", timeCreated: now })

        expect(await TaskQueueService.TestHooks.claimReadyTaskIDs({ limit: 1 })).toEqual([oldLowID])
      },
    })
  })

  test("refills capacity after rejected head candidates and claims the later valid task", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const firstRejected = await createSession("first rejected candidate")
        const secondRejected = await createSession("second rejected candidate")
        const valid = await createSession("later valid candidate")
        const firstRejectedID = Identifier.ascending("task")
        const secondRejectedID = Identifier.ascending("task")
        const validID = Identifier.ascending("task")
        const now = Date.now()
        insertQueuedTask({ id: firstRejectedID, sessionID: firstRejected.id, priority: "normal", timeCreated: now })
        insertQueuedTask({
          id: secondRejectedID,
          sessionID: secondRejected.id,
          priority: "normal",
          timeCreated: now + 1,
        })
        insertQueuedTask({ id: validID, sessionID: valid.id, priority: "normal", timeCreated: now + 2 })

        const rejectedSessions = new Set([firstRejected.id, secondRejected.id])
        const claimed = await TaskQueueService.TestHooks.claimReadyTaskIDs({
          limit: 2,
          beforeValidation: (sessionID) => {
            if (rejectedSessions.has(sessionID)) throw new Error(`Rejected Session ${sessionID}`)
          },
        })
        expect(claimed).toEqual([validID])
        expect(
          Database.use((db) =>
            db
              .select({ id: TaskQueueTable.id, status: TaskQueueTable.status })
              .from(TaskQueueTable)
              .where(eq(TaskQueueTable.source, "scheduler-positive-contract"))
              .all(),
          )
            .filter((row) => [firstRejectedID, secondRejectedID, validID].includes(row.id))
            .sort((left, right) => left.id.localeCompare(right.id)),
        ).toEqual(
          [
            { id: firstRejectedID, status: "failed" },
            { id: secondRejectedID, status: "failed" },
            { id: validID, status: "running" },
          ].sort((left, right) => left.id.localeCompare(right.id)),
        )
      },
    })
  })

  test("manual automation returns the run set bound to its allocated fire identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const automation = await AutomationService.create({
          name: "manual fire identity",
          target: { scope: "global" },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "manual fire identity",
        })
        const manualFireID = Identifier.ascending("call")
        const laterFireID = Identifier.ascending("call")
        const manualRunID = Identifier.ascending("automation_run")
        const laterRunID = Identifier.ascending("automation_run")

        const runs = await AutomationService.TestHooks.runNowWithExecutor(automation.id, async (job, owner, now) => {
          Database.transaction((db) => {
            db.insert(AutomationRunTable)
              .values([
                {
                  id: manualRunID,
                  automation_id: job.id,
                  fire_id: manualFireID,
                  target_scope: "global",
                  owner,
                  outcome: "succeeded",
                  started_at: now,
                  completed_at: now,
                },
                {
                  id: laterRunID,
                  automation_id: job.id,
                  fire_id: laterFireID,
                  target_scope: "global",
                  owner: "poll-owner",
                  outcome: "succeeded",
                  started_at: now + 1,
                  completed_at: now + 1,
                },
              ])
              .run()
            db.update(AutomationTable)
              .set({ lease_owner: null, lease_until: 0 })
              .where(eq(AutomationTable.id, job.id))
              .run()
          })
          return manualFireID
        })

        expect(runs.map((run) => ({ id: run.id, fireID: run.fireId, outcome: run.outcome }))).toEqual([
          { id: manualRunID, fireID: manualFireID, outcome: "succeeded" },
        ])
      },
    })
  })

  test("lists retryable and historical terminal automation outcomes through the public response schema", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const automation = await AutomationService.create({
          name: "automation run outcome contract",
          target: { scope: "global" },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "preserve current and historical outcomes",
        })
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(AutomationRunTable)
            .values([
              {
                id: Identifier.ascending("automation_run"),
                automation_id: automation.id,
                fire_id: "automation-fire:retryable",
                target_scope: "global",
                owner: "automation-owner:retryable",
                outcome: "retry_wait",
                started_at: now,
                error: "retry this occurrence",
              },
              {
                id: Identifier.ascending("automation_run"),
                automation_id: automation.id,
                fire_id: "automation-fire:historical-failed",
                target_scope: "global",
                owner: "automation-owner:historical",
                outcome: "failed",
                started_at: now - 1,
                completed_at: now - 1,
                error: "legacy terminal failure",
              },
            ])
            .run(),
        )

        const response = AutomationService.listRuns(automation.id)
        expect(
          AutomationRunViewSchema.array()
            .parse(response)
            .map((run) => run.outcome),
        ).toEqual(["retry_wait", "failed"])
      },
    })
  })

  test("holds automation runtime settlement through durable failure persistence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await createSession("automation failure settlement")
        const automation = await AutomationService.create({
          name: "automation failure settlement",
          target: { scope: "session", sessionId: session.id },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "persist the exact failure before runtime handoff",
        })
        const now = Date.now()
        Database.use((db) =>
          db
            .update(AutomationTable)
            .set({ next_run: now, lease_owner: null, lease_until: 0 })
            .where(eq(AutomationTable.id, automation.id))
            .run(),
        )
        const owner = "automation-failure-settlement-owner"
        const job = AutomationService.TestHooks.claim(automation.id, owner, now)
        if (!job) throw new Error("Automation failure settlement fixture could not claim its due occurrence")
        const events: string[] = []
        let releaseFailurePersistence!: () => void
        const failurePersistenceReleased = new Promise<void>((resolve) => (releaseFailurePersistence = resolve))
        let failurePersistenceEntered!: () => void
        const failurePersistenceStarted = new Promise<void>((resolve) => (failurePersistenceEntered = resolve))
        using _failure = AutomationService.TestHooks.installFailurePersistenceHook(async (phase) => {
          events.push(`failure-${phase}`)
          if (phase !== "before") return
          failurePersistenceEntered()
          await failurePersistenceReleased
        })
        const execution = AutomationService.TestHooks.executeWithRuntimeSettlement(job, owner, now, true, async () => {
          throw new Error("injected automation wake failure")
        }).catch((error) => error)
        await failurePersistenceStarted
        using gate = RuntimeExecutionSettlement.acquireSettlementGate()
        gate.closeAdmission(["scheduler_automation_fire"])
        const settlement = gate.waitForIdle(["scheduler_automation_fire"]).then(() => {
          events.push("runtime-settled")
        })
        releaseFailurePersistence()
        const error = await execution
        await settlement
        gate.commit()
        const persisted = Database.use((db) =>
          db
            .select({ lastError: AutomationTable.last_error, leaseOwner: AutomationTable.lease_owner })
            .from(AutomationTable)
            .where(eq(AutomationTable.id, automation.id))
            .get(),
        )
        expect({ events, error, persisted }).toMatchObject({
          events: ["failure-before", "failure-after", "runtime-settled"],
          error: { message: "injected automation wake failure" },
          persisted: { lastError: "injected automation wake failure", leaseOwner: null },
        })
      },
    })
  })

  test("reuses one due occurrence after a committed Message interruption and advances recurrence once", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await createSession("automation due successor")
        const automation = await AutomationService.create({
          name: "automation due successor",
          target: { scope: "session", sessionId: session.id },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "resume this exact scheduled due occurrence",
        })
        const scheduledDue = Date.now() - 1_000
        Database.use((db) =>
          db
            .update(AutomationTable)
            .set({ next_run: scheduledDue, lease_owner: null, lease_until: 0 })
            .where(eq(AutomationTable.id, automation.id))
            .run(),
        )

        let retryFailedReply: boolean | undefined
        await using _wakeLoop = SessionWake.TestHooks.installWakeLoopExecutor(async (input) => {
          retryFailedReply = input.retryFailedReply
        })
        let committedWakeCalls = 0
        await using _automationWake = AutomationService.TestHooks.installWakeExecutor(async (input) => {
          const sessionID = input.sessionID!
          const message = {
            id: input.messageID!,
            sessionID,
            role: "user" as const,
            author: input.author,
            time: { created: Date.now() },
            agent: input.agent ?? "coding",
            model: input.model ?? { providerID: "test", modelID: "automation-due-successor" },
            extra: SessionWake.reasonExtra(input.reason),
          }
          const parts = [
            {
              id: input.textPartID!,
              sessionID,
              messageID: input.messageID!,
              type: "text" as const,
              text: input.prompt,
            },
          ]
          await Session.persistMessageWithCommit({ info: message, parts, touchSessionID: sessionID }, () =>
            input.commitBundle?.(message, parts),
          )
          committedWakeCalls += 1
          throw new Error("injected interruption after durable Message commit")
        })
        {
          const firstOwner = "automation-owner:first"
          const firstJob = AutomationService.TestHooks.claim(automation.id, firstOwner, scheduledDue)
          expect(firstJob).toBeDefined()
          const firstFireID = await AutomationService.TestHooks.executeClaimedDueOccurrence({
            job: firstJob!,
            owner: firstOwner,
            now: scheduledDue,
          })

          const interrupted = Database.use((db) => ({
            automation: db.select().from(AutomationTable).where(eq(AutomationTable.id, automation.id)).get(),
            runs: db.select().from(AutomationRunTable).where(eq(AutomationRunTable.automation_id, automation.id)).all(),
            messages: db.select().from(MessageTable).where(eq(MessageTable.session_id, session.id)).all(),
            parts: db.select().from(PartTable).where(eq(PartTable.session_id, session.id)).all(),
          }))
          expect(interrupted.automation?.next_run).toBe(scheduledDue)
          expect(interrupted.runs).toHaveLength(1)
          expect(interrupted.runs[0]).toMatchObject({
            fire_id: firstFireID,
            outcome: "retry_wait",
            session_id: session.id,
          })
          expect(interrupted.messages).toHaveLength(1)
          expect(interrupted.parts).toHaveLength(1)

          Database.use((db) =>
            db
              .update(AutomationTable)
              .set({ lease_owner: null, lease_until: 0 })
              .where(eq(AutomationTable.id, automation.id))
              .run(),
          )
          const secondOwner = "automation-owner:successor"
          const secondJob = AutomationService.TestHooks.claim(automation.id, secondOwner, scheduledDue + 1)
          expect(secondJob).toBeDefined()
          const secondFireID = await AutomationService.TestHooks.executeClaimedDueOccurrence({
            job: secondJob!,
            owner: secondOwner,
            now: scheduledDue + 1,
          })

          const settled = Database.use((db) => ({
            automation: db.select().from(AutomationTable).where(eq(AutomationTable.id, automation.id)).get(),
            runs: db.select().from(AutomationRunTable).where(eq(AutomationRunTable.automation_id, automation.id)).all(),
            messages: db.select().from(MessageTable).where(eq(MessageTable.session_id, session.id)).all(),
            parts: db.select().from(PartTable).where(eq(PartTable.session_id, session.id)).all(),
          }))
          expect(secondFireID).toBe(firstFireID)
          expect(settled.runs).toHaveLength(1)
          expect(settled.runs[0]).toMatchObject({
            id: interrupted.runs[0]!.id,
            fire_id: firstFireID,
            session_id: session.id,
            outcome: "succeeded",
          })
          expect(settled.messages.map((message) => message.id)).toEqual(
            interrupted.messages.map((message) => message.id),
          )
          expect(settled.parts.map((part) => part.id)).toEqual(interrupted.parts.map((part) => part.id))
          expect(settled.automation?.next_run).toBeGreaterThan(scheduledDue)
          expect(committedWakeCalls).toBe(1)
          expect(retryFailedReply).toBe(true)
        }
      },
    })
  })

  test("keeps a target run owned until its exact Session reply settles and records the failed outcome", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await createSession("automation exact reply settlement")
        const automation = await AutomationService.create({
          name: "automation exact reply settlement",
          target: { scope: "session", sessionId: session.id },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "wait for the exact assistant reply outcome",
        })
        const scheduledDue = Date.now() - 1_000
        Database.use((db) =>
          db
            .update(AutomationTable)
            .set({ next_run: scheduledDue, lease_owner: null, lease_until: 0 })
            .where(eq(AutomationTable.id, automation.id))
            .run(),
        )

        let wakeStarted!: () => void
        const started = new Promise<void>((resolve) => (wakeStarted = resolve))
        let settleWake!: (completion: SessionWake.WakeCompletion) => void
        const completion = new Promise<SessionWake.WakeCompletion>((resolve) => (settleWake = resolve))
        await using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => {
          wakeStarted()
          return { sessionID: input.sessionID!, messageID: input.messageID!, completion }
        })

        const owner = "automation-owner:physical-settlement"
        const job = AutomationService.TestHooks.claim(automation.id, owner, scheduledDue)
        expect(job).toBeDefined()
        const execution = AutomationService.TestHooks.executeClaimedDueOccurrence({
          job: job!,
          owner,
          now: scheduledDue,
        })
        await started
        const running = Database.use((db) =>
          db.select().from(AutomationRunTable).where(eq(AutomationRunTable.automation_id, automation.id)).get(),
        )
        expect(running).toMatchObject({ outcome: "running", owner })

        settleWake({ ok: false, error: "injected streamed provider failure" })
        const fireID = await execution
        const settled = Database.use((db) => ({
          automation: db.select().from(AutomationTable).where(eq(AutomationTable.id, automation.id)).get(),
          run: db.select().from(AutomationRunTable).where(eq(AutomationRunTable.automation_id, automation.id)).get(),
        }))
        expect({ fireID, automation: settled.automation, run: settled.run }).toMatchObject({
          fireID: settled.run?.fire_id,
          automation: {
            next_run: scheduledDue,
            failure_count: 1,
            last_error: "Scheduled Automation Session wake failed: injected streamed provider failure",
          },
          run: {
            outcome: "retry_wait",
            error: "Scheduled Automation Session wake failed: injected streamed provider failure",
          },
        })
      },
    })
  })

  test("aborts the old owner signal when lease renewal updates zero rows", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const automation = await AutomationService.create({
          name: "automation lease fence",
          target: { scope: "global" },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "lease fence",
        })
        const scheduledDue = Date.UTC(2099, 0, 1)
        Database.use((db) =>
          db
            .update(AutomationTable)
            .set({ next_run: scheduledDue, lease_owner: null, lease_until: 0 })
            .where(eq(AutomationTable.id, automation.id))
            .run(),
        )
        const oldOwner = "automation-owner:old"
        const claimed = AutomationService.TestHooks.claim(automation.id, oldOwner, scheduledDue)
        expect(claimed).toBeDefined()
        const fence = AutomationService.TestHooks.createLeaseFence(automation.id, oldOwner, "cal_fenced")

        Database.use((db) =>
          db
            .update(AutomationTable)
            .set({ lease_owner: "automation-owner:successor", lease_until: scheduledDue + 120_000 })
            .where(eq(AutomationTable.id, automation.id))
            .run(),
        )

        expect(fence.renewOrAbort()).toBe(false)
        expect(fence.signal.aborted).toBe(true)
        expect(fence.signal.reason).toMatchObject({
          name: "AutomationRunningConflictError",
          message: expect.stringContaining("lost its execution lease"),
        })
      },
    })
  })

  test("releases the lease renewal timer when recurring preflight rejects", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const automation = await AutomationService.create({
          name: "automation preflight timer settlement",
          target: { scope: "global" },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "automation preflight timer settlement",
        })
        const scheduledDue = Date.UTC(2099, 0, 1)
        Database.use((db) =>
          db
            .update(AutomationTable)
            .set({ next_run: scheduledDue, lease_owner: null, lease_until: 0 })
            .where(eq(AutomationTable.id, automation.id))
            .run(),
        )
        const owner = "automation-owner:preflight"
        const claimed = AutomationService.TestHooks.claim(automation.id, owner, scheduledDue)
        expect(claimed).toBeDefined()

        const timerLifecycle: string[] = []
        let activeOwners = 0
        await using _timer = AutomationService.TestHooks.installLeaseRenewTimerFactory((renew) => {
          activeOwners += 1
          timerLifecycle.push(`owned:renewed=${renew()}`)
          return {
            [Symbol.dispose]() {
              activeOwners -= 1
              timerLifecycle.push("released")
            },
          }
        })

        let preflightError: unknown
        try {
          await AutomationService.TestHooks.executeClaimedDueOccurrence({
            job: { ...claimed!, recurrence: null },
            owner,
            now: scheduledDue,
          })
        } catch (error) {
          preflightError = error
        }

        expect(preflightError).toMatchObject({ message: `Automation ${automation.id} has no recurrence rule` })
        expect(activeOwners).toBe(0)
        expect(timerLifecycle).toEqual(["owned:renewed=true", "released"])
      },
    })
  })

  test("joins a cooperative active scheduler job after lifecycle abort and physical finally", async () => {
    const events: string[] = []
    let started!: () => void
    const active = new Promise<void>((resolve) => {
      started = resolve
    })
    Scheduler.register({
      id: `scheduler-cooperative-shutdown-${Identifier.ascending("call")}`,
      interval: 60_000,
      runAtStart: true,
      scope: "global",
      run: async (signal) => {
        events.push("started")
        started()
        try {
          await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
          events.push("aborted")
          signal.throwIfAborted()
        } finally {
          await Bun.sleep(10)
          events.push("physical-finally")
        }
      },
    })
    await active

    await Scheduler.disposeGlobal({ inactivityTimeoutMilliseconds: 500 })

    expect(events).toEqual(["started", "aborted", "physical-finally"])
  })

  test("committed scheduler handoff admits only successor registrations", async () => {
    const events: string[] = []
    Scheduler.register({
      id: `scheduler-committed-owner-${Identifier.ascending("call")}`,
      interval: 20,
      runAtStart: true,
      scope: "global",
      run: async () => {
        events.push("old-owner")
      },
    })
    const deadline = Date.now() + 2_000
    while (events.length < 1 && Date.now() < deadline) await Bun.sleep(10)
    const gate = Scheduler.acquireGlobalSettlementGate()
    await Scheduler.disposeGlobal({ inactivityTimeoutMilliseconds: 500 })
    gate.commit()
    gate[Symbol.dispose]()

    Scheduler.register({
      id: `scheduler-successor-${Identifier.ascending("call")}`,
      interval: 60_000,
      runAtStart: true,
      scope: "global",
      run: async () => {
        events.push("successor")
      },
    })
    while (events.length < 2 && Date.now() < deadline) await Bun.sleep(10)
    expect(events).toEqual(["old-owner", "successor"])
    await Scheduler.disposeGlobal({ inactivityTimeoutMilliseconds: 500 })
  })

  test("fails closed on scheduler disposal inactivity while retaining runtime ownership", async () => {
    const ownership = RuntimeServerOwnership.acquire({ database: Database.Path() })
    const occurrenceID = ownership.owner.occurrenceID
    let runs = 0
    let started!: () => void
    let releaseOldOwner!: () => void
    const active = new Promise<void>((resolve) => {
      started = resolve
    })
    Scheduler.register({
      id: `scheduler-noncooperative-shutdown-${Identifier.ascending("call")}`,
      interval: 10,
      runAtStart: true,
      scope: "global",
      run: async () => {
        runs += 1
        started()
        if (runs === 1) await new Promise<void>((resolve) => (releaseOldOwner = resolve))
      },
    })
    await active
    using _timeout = Server.TestHooks.installRuntimeSettlementInactivityTimeout(50)
    try {
      await expect(
        Server.settleCurrentProcessExecution("scheduler inactivity test", { disposeInstances: async () => {} }),
      ).rejects.toBeInstanceOf(SchedulerDisposalInactivityError)
      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toBe(occurrenceID)
      await Bun.sleep(100)
      expect(runs).toBe(1)
      releaseOldOwner()
      const deadline = Date.now() + 2_000
      while (runs < 2 && Date.now() < deadline) await Bun.sleep(10)
      expect(runs).toBe(2)
      await Scheduler.disposeGlobal({ inactivityTimeoutMilliseconds: 50 })
    } finally {
      await RuntimeServerOwnership.releaseWithRetry(ownership)
    }
  })
})
