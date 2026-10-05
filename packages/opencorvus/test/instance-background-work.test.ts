import { afterAll, describe, expect, spyOn, test } from "bun:test"
import { Instance, InstanceProcessAdmissionClosedError, runInstanceBackgroundWork } from "@/project/instance"
import { Scheduler } from "@/scheduler"
import { DatabaseEffectAdmissionClosedError } from "@/storage/db"
import { Log } from "@/util/log"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("condition did not settle in time")
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe("instance background work", () => {
  test.each(["source", "same text", "instance admission", "database admission", "mixed", "cleanup"])(
    "retains the %s fault diagnostic after owner cancellation and joins physical cleanup",
    async (kind) => {
      await using project = await memoryProject()
      const admitted = Promise.withResolvers<void>()
      const cancelled = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const trace: string[] = []
      const label = `diagnostic-${kind}`
      const warn = spyOn(Log.Default, "warn")
      let fault: Error | undefined
      let ownerReason: unknown
      try {
        const projectID = await Instance.provide({
          directory: project.path,
          fn: async () => {
            const id = Instance.project.id
            const completion = runInstanceBackgroundWork(label, async (signal) => {
              signal.addEventListener("abort", () => {
                ownerReason = signal.reason
                cancelled.resolve()
              }, { once: true })
              admitted.resolve()
              await cancelled.promise
              fault = kind === "same text" ? new Error((ownerReason as Error).message)
                : kind === "instance admission" ? new InstanceProcessAdmissionClosedError()
                : kind === "database admission" ? new DatabaseEffectAdmissionClosedError("diagnostic fixture")
                : kind === "mixed" ? new AggregateError([
                  ownerReason, new InstanceProcessAdmissionClosedError(),
                  new DatabaseEffectAdmissionClosedError("diagnostic fixture"), new Error("independent source fault"),
                ], "mixed cancellation and independent faults")
                : new Error(`${kind} fault after cancellation`)
              try {
                if (kind === "cleanup") throw ownerReason
                throw fault
              } finally {
                await release.promise
                trace.push(`cleanup:${Instance.project.id}`)
                if (kind === "cleanup") throw fault
              }
            }).then(() => { trace.push("completion") })
            await admitted.promise
            const disposal = Instance.dispose().then(() => { trace.push("disposed") })
            await cancelled.promise
            release.resolve()
            await completion
            await disposal
            return id
          },
        })
        expect(trace).toEqual([`cleanup:${projectID}`, "completion", "disposed"])
        expect(ownerReason).toBeInstanceOf(Error)
        expect(fault).toBeInstanceOf(Error)
        expect(warn.mock.calls.find((call) => call[1]?.label === label)).toEqual([
          "instance background work did not complete",
          { label, directory: project.path, error: fault!.message },
        ])
      } finally {
        release.resolve()
        warn.mockRestore()
      }
    },
    30_000,
  )

  test.each([new Error("external cancellation"), new InstanceProcessAdmissionClosedError(), "external primitive"])(
    "settles exact external owner reason %s after complete unwind",
    async (reason) => {
      await using project = await memoryProject()
      const owner = new AbortController()
      const admitted = Promise.withResolvers<void>()
      const cancelled = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const trace: string[] = []
      let observed: unknown
      const projectID = await Instance.provide({ directory: project.path, fn: async () => {
        const id = Instance.project.id
        const completion = runInstanceBackgroundWork("exact-owner", async (signal) => {
          signal.addEventListener("abort", () => cancelled.resolve(), { once: true })
          admitted.resolve()
          await cancelled.promise
          try { signal.throwIfAborted() } catch (error) { observed = error; throw error }
          finally { await release.promise; trace.push(`cleanup:${Instance.project.id}`) }
        }, owner.signal).then(() => { trace.push("completion") })
        await admitted.promise
        owner.abort(reason)
        await cancelled.promise
        release.resolve()
        await completion
        await Instance.dispose()
        trace.push("disposed")
        return id
      } })
      expect(observed).toBe(reason)
      expect(trace).toEqual([`cleanup:${projectID}`, "completion", "disposed"])
    },
    30_000,
  )
  test("global disposal cancels scheduled owners across projects before draining their leases", async () => {
    await using first = await memoryProject("scheduled-disposal-first")
    await using second = await memoryProject("scheduled-disposal-second")
    const projects = [first, second]
    const entered = projects.map(() => Promise.withResolvers<void>())
    const cancelled = projects.map(() => Promise.withResolvers<void>())
    const release = Promise.withResolvers<void>()
    const observed: string[] = []
    Scheduler.register({
      id: "test.instance-scheduler-disposal",
      interval: 60_000,
      runAtStart: true,
      run: async (signal) => {
        await Promise.all(projects.map((project, index) => Instance.provide({
          directory: project.path,
          fn: async () => {
            signal.addEventListener("abort", () => cancelled[index]!.resolve(), { once: true })
            if (signal.aborted) cancelled[index]!.resolve()
            entered[index]!.resolve()
            await Promise.race([cancelled[index]!.promise, release.promise])
            observed.push(`${index}:${signal.aborted ? "cancelled" : "released"}:${Instance.project.id}`)
          },
        })))
      },
    })
    await Promise.all(entered.map((entry) => entry.promise))
    const disposal = Instance.disposeAll()
    try {
      await waitFor(() => observed.length === projects.length)
    } finally {
      release.resolve()
      await disposal
    }
    expect(observed.sort()).toEqual([expect.stringMatching(/^0:cancelled:/), expect.stringMatching(/^1:cancelled:/)])
    expect(await Instance.provide({ directory: first.path, fn: () => Instance.project.id })).toBe(
      observed.find((entry) => entry.startsWith("0:"))!.split(":")[2]!,
    )
  }, 30_000)

  test.each(["abort listener", "draining owner"])(
    "settles nested background registration from a %s after teardown closes admission",
    async (source) => {
      await using project = await memoryProject()
      const admitted = Promise.withResolvers<void>()
      const observed: string[] = []
      const outcome = await Instance.provide({
        directory: project.path,
        fn: async () => {
          const completion = runInstanceBackgroundWork("outer-teardown-owner", async (signal) => {
            let nested: Promise<void> | undefined
            const schedule = () => runInstanceBackgroundWork("nested-during-teardown", async () => undefined)
            const cancelled = new Promise<void>((resolve) => {
              signal.addEventListener(
                "abort",
                () => {
                  if (source === "abort listener") nested = schedule()
                  resolve()
                },
                { once: true },
              )
            })
            admitted.resolve()
            await cancelled
            if (source === "draining owner") nested = schedule()
            await nested
            observed.push("outer settled")
          })
          await admitted.promise
          await Instance.dispose()
          await completion
          return "disposed"
        },
      })
      expect({ outcome, observed }).toEqual({ outcome: "disposed", observed: ["outer settled"] })
    },
    10_000,
  )

  test("keeps an admitted background lease valid through its complete cancellation settlement", async () => {
    await using project = await memoryProject()
    const admitted = Promise.withResolvers<void>()
    const cancelled = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const observed: string[] = []
    const expectedProject = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        const completion = runInstanceBackgroundWork("admitted-settlement", async (signal) => {
          signal.addEventListener("abort", () => cancelled.resolve(), { once: true })
          admitted.resolve()
          await release.promise
          observed.push(Instance.project.id)
        })
        await admitted.promise
        const disposal = Instance.dispose()
        await cancelled.promise
        release.resolve()
        await completion
        await disposal
        return projectID
      },
    })
    expect(observed).toEqual([expectedProject])
  }, 30_000)

  test("returns a settled completion when teardown races background admission", async () => {
    await using project = await memoryProject()
    const result = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const completion = runInstanceBackgroundWork("admission-race", async (signal) => {
          signal.throwIfAborted()
          await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
        })
        await Instance.dispose()
        return completion.then(() => "settled")
      },
    })
    expect(result).toBe("settled")
  }, 30_000)

  test("background work keeps a valid instance context for as long as it runs", async () => {
    await using project = await memoryProject()
    const observed: string[] = []
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        runInstanceBackgroundWork("context-probe", async () => {
          // The scheduling scope has long returned by the time this reads the
          // context — the exact moment a detached callback would throw
          // "closed instance cache lease".
          await new Promise((resolve) => setTimeout(resolve, 150))
          observed.push(Instance.project.id)
        })
      },
    })
    await waitFor(() => observed.length === 1)
    expect(observed[0]).toMatch(/\w+/)
  }, 30_000)

  test("instance disposal cancels in-flight background work instead of waiting for it", async () => {
    await using project = await memoryProject()
    let cancelled: unknown
    let ownerReason: unknown
    let started = false
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        runInstanceBackgroundWork("disposal-probe", async (signal) => {
          started = true
          // Without the teardown cancellation this never resolves, and the
          // background lease is exactly what disposal would wait on forever.
          await new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              ownerReason = signal.reason
              reject(signal.reason)
            }, { once: true })
          }).catch((reason) => {
            cancelled = reason
            throw reason
          })
        })
        await waitFor(() => started)
      },
    })

    const disposalStarted = Date.now()
    await Instance.disposeAll()
    expect(Date.now() - disposalStarted).toBeLessThan(10_000)
    await waitFor(() => cancelled !== undefined)
    expect(String(cancelled)).toContain("Instance background work cancelled")
    expect(cancelled).toBe(ownerReason)
  }, 30_000)

  test("work scheduled and completed before disposal leaves nothing for disposal to cancel", async () => {
    await using project = await memoryProject()
    let completions = 0
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        runInstanceBackgroundWork("fast-work", async () => {
          completions += 1
        })
        await waitFor(() => completions === 1)
      },
    })
    await Instance.disposeAll()
    expect(completions).toBe(1)
  }, 30_000)
})
