import { afterEach, describe, expect, test } from "bun:test"
import { ToolTurnExecutionCoordinator, ToolTurnExecutionConflictError } from "../src/tool/execution-mode"
import { withImmediateParkToolResultControl } from "../src/session/tool-result-control"
import { currentControlLeaseInTransaction, currentControlLeasesInTransaction } from "../src/engine/control-lease"
import { EngineControlActivationLeaseTable } from "../src/engine/engine.sql"
import { Instance } from "../src/project/instance"
import { Database } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { TaskControlDriver } from "../src/engine/task-control-driver"
import { settledWork } from "../src/util/queue"

afterEach(resetMemoryDatabase)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe("scheduling razor primitive contracts", () => {
  test("an input revision read fault uses the same paced recovery contract", async () => {
    let clock = 0
    let readable = false
    let reads = 0
    const driver = new TaskControlDriver({
      now: () => clock,
      inputRevision: () => {
        reads++
        if (!readable) throw new Error("revision-store-unavailable")
        return "input-1"
      },
      scan: async () => ({ activated: 1 }),
      setTimer: () => ({ cancel() {} }),
    })
    try {
      await expect(driver.request("task", { propagateFailure: true })).rejects.toThrow("revision-store-unavailable")
      expect(await driver.requestWithAdmission("task")).toEqual({ status: "coalesced" })
      expect({ reads, wake: driver.snapshot()[0]?.wakeAt, failures: driver.snapshot()[0]?.failures }).toEqual({
        reads: 1,
        wake: 1000,
        failures: 1,
      })
      readable = true
      clock = 1000
      expect(await driver.request("task")).toBe(1)
    } finally {
      driver.dispose()
    }
  })

  test("a fact arriving during a failed scan receives a fresh pass before fault pacing", async () => {
    let revision = "old"
    let scans = 0
    const old = deferred<void>()
    const driver = new TaskControlDriver({
      inputRevision: () => revision,
      scan: async () => {
        scans++
        if (scans === 1) await old.promise
        return { activated: 1 }
      },
      setTimer: () => ({ cancel() {} }),
    })
    try {
      const pending = driver.request("task")
      revision = "new"
      expect(await driver.requestWithAdmission("task")).toEqual({ status: "coalesced" })
      old.reject(new Error("old-fact scan failed"))
      expect(await pending).toBe(1)
      expect(scans).toBe(2)
    } finally {
      driver.dispose()
    }
  })

  test("a changed canonical input revision admits once during fault backoff", async () => {
    let revision = "epoch-1:ingress-1:fact-1"
    let scans = 0
    const driver = new TaskControlDriver({
      inputRevision: () => revision,
      now: () => 0,
      scan: async () => {
        scans++
        return { activated: 0, noProgress: true }
      },
      setTimer: () => ({ cancel() {} }),
    })
    try {
      await driver.request("task")
      expect(await driver.requestWithAdmission("task")).toEqual({ status: "coalesced" })
      revision = "epoch-1:ingress-2:fact-2"
      expect(await driver.requestWithAdmission("task")).toEqual({ status: "admitted", activated: 0 })
      expect(await driver.requestWithAdmission("task")).toEqual({ status: "coalesced" })
      expect(scans).toBe(2)
    } finally {
      driver.dispose()
    }
  })

  test("lazy source cancellation closes the iterator at the admission boundary", async () => {
    const gate = deferred<void>()
    const abort = new AbortController()
    let closed = 0
    async function* source() {
      try {
        await gate.promise
        yield "ready"
      } finally {
        closed++
      }
    }
    const pending = settledWork({
      concurrency: 1,
      items: source(),
      signal: abort.signal,
      run: async () => {
        throw new Error("work was admitted after cancellation")
      },
    })
    abort.abort(new Error("source-cancelled"))
    gate.resolve()
    await expect(pending).rejects.toThrow("source-cancelled")
    expect(closed).toBe(1)
  })

  test("partial heartbeat admission continues its tail after accepted siblings leave the slot", async () => {
    const held = deferred<void>()
    const scanned: string[] = []
    const timers: Array<{ fire: () => void; cancelled: boolean }> = []
    let commits = 0
    const driver = new TaskControlDriver({
      maximumConcurrentScans: 2,
      maximumPendingScans: 1,
      liveTasks: () => ({
        taskIDs: ["fast-1", "fast-2", "tail"],
        hasMore: false,
        commit() {
          commits++
        },
      }),
      scan: async (id) => {
        scanned.push(id)
        if (id === "held") await held.promise
        return { activated: 1 }
      },
      setTimer: (fire) => {
        const timer = { fire, cancelled: false }
        timers.push(timer)
        return {
          cancel() {
            timer.cancelled = true
          },
        }
      },
    })
    const active = driver.request("held")
    const flush = async () => {
      for (let i = 0; i < 40; i++) await Promise.resolve()
    }
    try {
      timers.at(-1)!.fire()
      await flush()
      timers.at(-1)!.fire()
      await flush()
      expect({ scanned, commits }).toEqual({ scanned: ["held", "fast-1", "fast-2", "tail"], commits: 1 })
    } finally {
      held.resolve()
      await active
      driver.dispose()
    }
  })

  test("heartbeat discovers the next page while a sibling retains its own scan owner", async () => {
    const slow = deferred<void>()
    const scanned: string[] = []
    const timers: Array<{ delay: number; fire: () => void; cancelled: boolean }> = []
    let page = 0
    let owners = 0
    const driver = new TaskControlDriver({
      maximumConcurrentScans: 2,
      maximumPendingScans: 1,
      liveTasks: () => ({
        taskIDs: page === 0 ? ["slow", "fast"] : ["later"],
        hasMore: page === 0,
        commit() {
          page++
        },
      }),
      reenter: async (fn) => {
        owners++
        try {
          await fn()
        } finally {
          owners--
        }
      },
      scan: async (id) => {
        scanned.push(id)
        if (id === "slow") await slow.promise
        return { activated: 1 }
      },
      setTimer: (fn, delay) => {
        const timer = { delay, fire: fn, cancelled: false }
        timers.push(timer)
        return {
          cancel() {
            timer.cancelled = true
          },
        }
      },
    })
    const flush = async () => {
      for (let i = 0; i < 30; i++) await Promise.resolve()
    }
    try {
      expect(await driver.bootstrapHeartbeatSlice()).toBe(0)
      timers.find((timer) => !timer.cancelled)!.fire()
      await flush()
      expect({ page, scanned, owners }).toEqual({ page: 1, scanned: ["slow", "fast"], owners: 1 })
      timers.at(-1)!.fire()
      await flush()
      expect({ page, scanned, owners }).toEqual({ page: 2, scanned: ["slow", "fast", "later"], owners: 1 })
      slow.resolve()
      await flush()
      expect(owners).toBe(0)
    } finally {
      slow.resolve()
      driver.dispose()
    }
  })

  test("retry deadline survives readiness, repeated hints and the Mission wake ceiling", async () => {
    let clock = 0
    let scans = 0
    const timers: number[] = []
    const driver = new TaskControlDriver({
      now: () => clock,
      scan: async () => {
        scans++
        return { activated: 0, wakeAt: clock, noProgress: true }
      },
      initialBackoffMilliseconds: 1000,
      maximumBackoffMilliseconds: 8000,
      maximumWakeDelayMilliseconds: 1000,
      setTimer: (_fn, delay) => {
        timers.push(delay)
        return { cancel() {} }
      },
    })
    try {
      for (const instant of [0, 1000, 3000]) {
        clock = instant
        await driver.request("mission")
      }
      clock = 3100
      expect(await driver.requestWithAdmission("mission")).toEqual({ status: "coalesced" })
      expect({ scans, deadline: driver.snapshot()[0]?.wakeAt, delays: timers }).toEqual({
        scans: 3,
        deadline: 7000,
        delays: [1000, 2000, 4000, 3900],
      })
      clock = 7000
      await driver.request("mission")
      expect({ scans, deadline: driver.snapshot()[0]?.wakeAt }).toEqual({ scans: 4, deadline: 15000 })
    } finally {
      driver.dispose()
    }
  })

  test("a successful parallel dispatch retains the turn decision after its earlier sibling fails", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    const first = deferred<string>()
    const pending = coordinator
      .run("ordinary", () => first.promise, { command: "dispatch_agent", commits: true })
      .catch((error: Error) => error.message)
    expect(
      await coordinator.run("ordinary", async () => "worker-b-accepted", {
        command: "dispatch_agent",
        commits: true,
      }),
    ).toBe("worker-b-accepted")
    first.reject(new Error("worker-a-admission-failed"))
    expect(await pending).toBe("worker-a-admission-failed")
    expect(coordinator.committedDecision).toBe("dispatch_agent")
    await expect(
      coordinator.run(
        "turn_control_exclusive",
        async () => ({
          metadata: withImmediateParkToolResultControl({}),
        }),
        { command: "no_action", commits: true },
      ),
    ).rejects.toBeInstanceOf(ToolTurnExecutionConflictError)
    expect(
      await coordinator.run("ordinary", async () => "worker-c-accepted", {
        command: "dispatch_agent",
        commits: true,
      }),
    ).toBe("worker-c-accepted")
  })

  for (const reverse of [false, true]) {
    test(`all failed siblings release their own claims (${reverse ? "reverse" : "acceptance"} order)`, async () => {
      const coordinator = new ToolTurnExecutionCoordinator()
      const calls = [deferred<string>(), deferred<string>()]
      const results = calls.map((call) =>
        coordinator
          .run("ordinary", () => call.promise, {
            command: "dispatch_agent",
            commits: true,
          })
          .catch((error: Error) => error.message),
      )
      for (const index of reverse ? [1, 0] : [0, 1]) {
        calls[index]!.reject(new Error(`worker-${index}-failed`))
        expect(await results[index]).toBe(`worker-${index}-failed`)
      }
      expect(
        await coordinator.run(
          "turn_control_exclusive",
          async () => ({
            output: "current ingress settled",
            metadata: withImmediateParkToolResultControl({}),
          }),
          { command: "no_action", commits: true },
        ),
      ).toMatchObject({ output: "current ingress settled" })
      expect(coordinator.committedDecision).toBe("no_action")
    })
  }

  test("exclusive admission rejection preserves the next legitimate decision", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    const exclusive = deferred<string>()
    const running = coordinator.run("turn_control_exclusive", () => exclusive.promise)
    await expect(
      coordinator.run("ordinary", async () => "worker", {
        command: "dispatch_agent",
        commits: true,
      }),
    ).rejects.toBeInstanceOf(ToolTurnExecutionConflictError)
    exclusive.resolve("inspection completed")
    expect(await running).toBe("inspection completed")
    expect(
      await coordinator.run("turn_control_exclusive", async () => "settled", {
        command: "no_action",
        commits: true,
      }),
    ).toBe("settled")
    expect(coordinator.committedDecision).toBe("no_action")
  })

  test("current lease seeks exact latest winners across retained history, targets and same-time IDs", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        Database.immediateTransaction((db) => {
          for (let index = 0; index < 1000; index++) {
            db.insert(EngineControlActivationLeaseTable)
              .values({
                id: `call_razor_${String(index).padStart(8, "0")}`,
                target: "effect",
                target_id: "target-a",
                owner_occurrence_id: `owner-${index}`,
                time_activated: index,
                expires_at: index + 1,
              })
              .run()
          }
          db.insert(EngineControlActivationLeaseTable)
            .values([
              {
                id: "call_razor_z",
                target: "effect",
                target_id: "target-a",
                owner_occurrence_id: "owner-tie",
                time_activated: 999,
                expires_at: 2000,
              },
              {
                id: "call_razor_other",
                target: "effect",
                target_id: "target-b",
                owner_occurrence_id: "owner-other",
                time_activated: 1000,
                expires_at: 2000,
              },
              {
                id: "call_razor_namespace",
                target: "automation",
                target_id: "target-a",
                owner_occurrence_id: "owner-namespace",
                time_activated: 1001,
                expires_at: 2000,
              },
            ])
            .run()
          expect(currentControlLeaseInTransaction(db, "effect", "target-a")).toMatchObject({
            id: "call_razor_z",
            owner_occurrence_id: "owner-tie",
          })
          expect(
            [...currentControlLeasesInTransaction(db, "effect", ["target-a", "target-b", "target-a"])].map(
              ([id, lease]) => [id, lease.id],
            ),
          ).toEqual([
            ["target-a", "call_razor_z"],
            ["target-b", "call_razor_other"],
          ])
          expect(currentControlLeaseInTransaction(db, "automation", "target-a")).toMatchObject({
            id: "call_razor_namespace",
          })
        })
      },
    })
  })
})
