import { afterAll, describe, expect, test } from "bun:test"
import { Instance, runInstanceBackgroundWork } from "@/project/instance"
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
    let started = false
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        runInstanceBackgroundWork("disposal-probe", async (signal) => {
          started = true
          // Without the teardown cancellation this never resolves, and the
          // background lease is exactly what disposal would wait on forever.
          await new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true })
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
