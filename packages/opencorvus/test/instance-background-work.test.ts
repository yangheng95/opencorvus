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
