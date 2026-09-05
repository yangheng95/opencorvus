import { afterEach, expect, spyOn, test } from "bun:test"
import { Instance } from "../src/project/instance"
import { AutomationService } from "../src/scheduler/automation-service"
import { AutomationFireFrontierTable } from "../src/scheduler/automation.sql"
import {
  latestAutomationDefinitionInTransaction,
  projectAutomationInTransaction,
} from "../src/scheduler/automation-projection"
import { Database, eq } from "../src/storage/db"
import { exportMysqlTransferSnapshot, preflightMysqlTransferSnapshot } from "../src/storage/mysql-transfer"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

function stamp(time: number) {
  return new Date(time)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

function completedWake() {
  return AutomationService.TestHooks.installWakeExecutor(async (input) => ({
    sessionID: input.sessionID!,
    messageID: input.messageID!,
    activation: Promise.resolve({ owner: new AbortController().signal }),
    completion: Promise.resolve({ ok: true as const }),
  }))
}

test("the final finite scheduled Fire commits success and exposes an exhausted schedule", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const automation = await AutomationService.create({
        name: "finite success",
        target: { scope: "project", projectIds: [Instance.project.id] },
        recurrence: `DTSTART:${stamp(Date.now() + 1_000)}\nRRULE:FREQ=DAILY;COUNT=1`,
        prompt: "finish once",
      })
      const due = automation.nextRun!
      await Bun.sleep(Math.max(0, due - Date.now() + 5))
      using _wake = completedWake()
      await AutomationService.TestHooks.runDueWithSignal(new AbortController().signal)
      expect(AutomationService.list().find((entry) => entry.id === automation.id)).toMatchObject({
        nextRun: null,
        status: "active",
      })
      expect(
        AutomationService.listFireHistory(automation.id).map((entry) => ({ state: entry.state, origin: entry.origin })),
      ).toEqual([{ state: "succeeded", origin: "scheduled" }])
      expect(preflightMysqlTransferSnapshot(exportMysqlTransferSnapshot()).snapshot.format).toBe(
        "opencorvus.mysql-transfer.v2",
      )
      const manual = await AutomationService.runNow(automation.id)
      expect(manual.map((entry) => entry.outcome)).toEqual(["succeeded"])
      expect(AutomationService.list().find((entry) => entry.id === automation.id)).toMatchObject({
        nextRun: null,
        status: "active",
      })
    },
  })
}, 30_000)

test("paused manual API execution settles while preserving the paused definition", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const automation = await AutomationService.create({
        name: "paused manual",
        target: { scope: "project", projectIds: [Instance.project.id] },
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
        prompt: "manual command",
      })
      await AutomationService.update({ id: automation.id, status: "paused" })
      using _wake = completedWake()
      expect((await AutomationService.runNow(automation.id)).map((entry) => entry.outcome)).toEqual(["succeeded"])
      expect(AutomationService.list().find((entry) => entry.id === automation.id)).toMatchObject({ status: "paused" })
      expect(
        AutomationService.listFireHistory(automation.id)
          .filter((entry) => entry.origin === "manual_api")
          .map((entry) => entry.state),
      ).toEqual(["succeeded"])
      expect(preflightMysqlTransferSnapshot(exportMysqlTransferSnapshot()).snapshot.format).toBe(
        "opencorvus.mysql-transfer.v2",
      )
    },
  })
}, 30_000)

test("an exhausted new revision projects from its own creation boundary after older manual history", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      let now = Date.now()
      using _clock = spyOn(Date, "now").mockImplementation(() => now)
      const automation = await AutomationService.create({
        name: "new finite revision",
        target: { scope: "project", projectIds: [Instance.project.id] },
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
        prompt: "project current definition",
      })
      using _wake = completedWake()
      expect((await AutomationService.runNow(automation.id)).map((entry) => entry.outcome)).toEqual(["succeeded"])
      const pastOccurrence = now + 2_000
      now += 5_000
      expect(
        await AutomationService.update({
          id: automation.id,
          recurrence: `DTSTART:${stamp(pastOccurrence)}\nRRULE:FREQ=DAILY;COUNT=1`,
        }),
      ).toMatchObject({ nextRun: null })
      expect(AutomationService.list().find((entry) => entry.id === automation.id)).toMatchObject({ nextRun: null })
      expect(preflightMysqlTransferSnapshot(exportMysqlTransferSnapshot()).snapshot.format).toBe(
        "opencorvus.mysql-transfer.v2",
      )
    },
  })
}, 30_000)

test.each(["active", "paused"] as const)(
  "a %s manual retry keeps its exact Fire and restores its prior timer eligibility",
  async (status) => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const automation = await AutomationService.create({
          name: "manual retry",
          target: { scope: "project", projectIds: [Instance.project.id] },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "retry exact occurrence",
        })
        if (status === "paused") await AutomationService.update({ id: automation.id, status })
        const prior = Database.use((db) =>
          db
            .select()
            .from(AutomationFireFrontierTable)
            .where(eq(AutomationFireFrontierTable.definition_id, automation.id))
            .get(),
        )
        {
          using _failure = AutomationService.TestHooks.installBeforeRunReservation(() => {
            throw new Error("transient admission")
          })
          await expect(AutomationService.runNow(automation.id)).rejects.toThrow("transient admission")
        }
        const retry = AutomationService.listFireHistory(automation.id).find((entry) => entry.origin === "manual_api")!
        expect(retry).toMatchObject({ state: "retry_wait", attemptCount: 1 })
        expect(preflightMysqlTransferSnapshot(exportMysqlTransferSnapshot()).snapshot.format).toBe(
          "opencorvus.mysql-transfer.v2",
        )
        using _wake = completedWake()
        using _clock = spyOn(Date, "now").mockImplementation(() => retry.retryAt!)
        const owner = `retry:${retry.fireId}`
        const claimed = AutomationService.TestHooks.claim(automation.id, owner, retry.retryAt!, false, retry.fireId)!
        await AutomationService.TestHooks.executeClaimedOccurrence({ job: claimed, owner, now: retry.retryAt! })
        const settled = AutomationService.listFireHistory(automation.id).find((entry) => entry.fireId === retry.fireId)!
        expect({
          state: settled.state,
          origin: settled.origin,
          due: settled.scheduledDueAt,
          attempts: settled.attemptCount,
        }).toEqual({ state: "succeeded", origin: "manual_api", due: retry.scheduledDueAt, attempts: 2 })
        const frontiers = Database.use((db) =>
          db
            .select()
            .from(AutomationFireFrontierTable)
            .where(eq(AutomationFireFrontierTable.definition_id, automation.id))
            .all(),
        )
        if (prior) expect(frontiers).toEqual([prior])
        expect(AutomationService.list().find((entry) => entry.id === automation.id)).toMatchObject({ status })
        expect(preflightMysqlTransferSnapshot(exportMysqlTransferSnapshot()).snapshot.format).toBe(
          "opencorvus.mysql-transfer.v2",
        )
      },
    })
  },
  30_000,
)

test("the final finite Fire records its fifth pre-reservation failure as terminal", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const automation = await AutomationService.create({
        name: "finite failed admission",
        target: { scope: "project", projectIds: [Instance.project.id] },
        recurrence: `DTSTART:${stamp(Date.now() + 1_000)}\nRRULE:FREQ=DAILY;COUNT=1`,
        prompt: "settle admission failure",
      })
      await Bun.sleep(Math.max(0, automation.nextRun! - Date.now() + 5))
      let now = Date.now()
      using _clock = spyOn(Date, "now").mockImplementation(() => now)
      using _failure = AutomationService.TestHooks.installBeforeRunReservation(() => {
        throw new Error("admission unavailable")
      })
      for (let attempt = 1; attempt <= 5; attempt++) {
        const owner = `finite-failure:${attempt}`
        const job = AutomationService.TestHooks.claim(automation.id, owner, now)!
        await expect(AutomationService.TestHooks.executeWithRuntimeSettlement(job, owner, now)).rejects.toThrow(
          "admission unavailable",
        )
        const fire = AutomationService.listFireHistory(automation.id).find((entry) => entry.origin === "scheduled")!
        expect(fire).toMatchObject({ state: attempt === 5 ? "failed" : "retry_wait", attemptCount: attempt })
        now = fire.retryAt ?? now
      }
      expect(AutomationService.list().find((entry) => entry.id === automation.id)).toMatchObject({
        nextRun: null,
        status: "active",
      })
      expect(preflightMysqlTransferSnapshot(exportMysqlTransferSnapshot()).snapshot.format).toBe(
        "opencorvus.mysql-transfer.v2",
      )
    },
  })
}, 30_000)

test("the Automation poll fills a free slot from the next page while the first Fire is still running", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      let finalDue = 0
      for (let index = 0; index < 65; index++) {
        const automation = await AutomationService.create({
          name: `page ${index}`,
          target: { scope: "project", projectIds: [Instance.project.id] },
          recurrence: `DTSTART:${stamp(Date.now() + 60_000)}\nRRULE:FREQ=DAILY;COUNT=1`,
          prompt: "fill available slot",
        })
        expect(automation.nextRun).toBeGreaterThan(Date.now())
        finalDue = Math.max(finalDue, automation.nextRun!)
      }
      using _clock = spyOn(Date, "now").mockImplementation(() => finalDue + 5)
      const blocked = Promise.withResolvers<{ ok: true }>()
      const reachedNextPage = Promise.withResolvers<number>()
      let admitted = 0
      using _capacity = AutomationService.TestHooks.installExecutionCapacity(2)
      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => {
        admitted++
        if (admitted === 65) reachedNextPage.resolve(admitted)
        return {
          sessionID: input.sessionID!,
          messageID: input.messageID!,
          activation: Promise.resolve({ owner: new AbortController().signal }),
          completion: admitted === 1 ? blocked.promise : Promise.resolve({ ok: true as const }),
        }
      })
      const polling = AutomationService.TestHooks.runDueWithSignal(new AbortController().signal)
      try {
        expect(
          await Promise.race([
            reachedNextPage.promise,
            Bun.sleep(20_000).then(() => {
              throw new Error(`Only ${admitted} Fires reached execution`)
            }),
          ]),
        ).toBe(65)
      } finally {
        blocked.resolve({ ok: true })
        await polling
      }
      expect(AutomationService.list().map((entry) => entry.nextRun)).toEqual(Array(65).fill(null))
    },
  })
}, 60_000)

test("the active poll admits a newly due Fire into its idle slot", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const first = await AutomationService.create({
        name: "slow first",
        target: { scope: "project", projectIds: [Instance.project.id] },
        recurrence: `DTSTART:${stamp(Date.now() + 1_000)}\nRRULE:FREQ=DAILY;COUNT=1`,
        prompt: "remain running",
      })
      await Bun.sleep(Math.max(0, first.nextRun! - Date.now() + 5))
      const blocked = Promise.withResolvers<{ ok: true }>()
      const firstAdmitted = Promise.withResolvers<void>()
      const newlyAdmitted = Promise.withResolvers<void>()
      let admissions = 0
      using _capacity = AutomationService.TestHooks.installExecutionCapacity(2)
      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => {
        admissions++
        if (admissions === 1) firstAdmitted.resolve()
        else newlyAdmitted.resolve()
        return {
          sessionID: input.sessionID!,
          messageID: input.messageID!,
          activation: Promise.resolve({ owner: new AbortController().signal }),
          completion: admissions === 1 ? blocked.promise : Promise.resolve({ ok: true as const }),
        }
      })
      const polling = AutomationService.TestHooks.runDueWithSignal(new AbortController().signal)
      try {
        await firstAdmitted.promise
        const later = await AutomationService.create({
          name: "new future input",
          target: { scope: "project", projectIds: [Instance.project.id] },
          recurrence: `DTSTART:${stamp(Date.now() + 1_000)}\nRRULE:FREQ=DAILY;COUNT=1`,
          prompt: "use idle slot",
        })
        await Bun.sleep(Math.max(0, later.nextRun! - Date.now() + 5))
        await AutomationService.TestHooks.runDueWithSignal(new AbortController().signal)
        await Promise.race([
          newlyAdmitted.promise,
          Bun.sleep(3_000).then(() => {
            throw new Error("New due Fire lost its idle slot")
          }),
        ])
        expect(admissions).toBe(2)
      } finally {
        blocked.resolve({ ok: true })
        await polling
      }
    },
  })
}, 30_000)

test("exact-Fire admission errors release a handed-off physical permit for the next command", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const automation = await AutomationService.create({
        name: "release admission error",
        target: { scope: "project", projectIds: [Instance.project.id] },
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
        prompt: "retain capacity",
      })
      const job = Database.use((db) =>
        projectAutomationInTransaction(db, latestAutomationDefinitionInTransaction(db, automation.id)!),
      )
      using _capacity = AutomationService.TestHooks.installExecutionCapacity(1)
      const release = await AutomationService.TestHooks.acquireExecutionPermit()
      await expect(
        AutomationService.TestHooks.executeWithRuntimeSettlement(
          job,
          "invalid-admission",
          Date.now(),
          undefined,
          undefined,
          release,
        ),
      ).rejects.toThrow("execution requires its exact claimed Fire")
      using _wake = completedWake()
      const outcome = await Promise.race([
        AutomationService.runNow(automation.id),
        Bun.sleep(3_000).then(() => {
          throw new Error("Admission leaked its physical permit")
        }),
      ])
      expect(outcome.map((entry) => entry.outcome)).toEqual(["succeeded"])
    },
  })
}, 30_000)
