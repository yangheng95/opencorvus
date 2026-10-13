import { afterEach, expect, test } from "bun:test"
import { open, readFile } from "node:fs/promises"
import path from "node:path"
import { Instance, InstanceSettlementInactivityError, runInstanceBackgroundWork } from "@/project/instance"
import { Server } from "@/server/server"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("a process gate cancels background work and retains the foreground owner until retry settlement", async () => {
  await using project = await memoryProject("background-gate-retry")
  const admitted = Promise.withResolvers<void>()
  const foregroundReady = Promise.withResolvers<void>()
  const releaseForeground = Promise.withResolvers<void>()
  const owner = new AbortController()
  let background: Promise<void> | undefined
  let reason: unknown
  const projectID = await Instance.provide({
    directory: project.path,
    fn: async () => {
      const id = Instance.project.id
      background = runInstanceBackgroundWork(
        "gate-retry-background",
        async (signal) => {
          admitted.resolve()
          await new Promise<void>((resolve) =>
            signal.addEventListener(
              "abort",
              () => {
                reason = signal.reason
                resolve()
              },
              { once: true },
            ),
          )
        },
        owner.signal,
      )
      await admitted.promise
      return id
    },
  })
  const foreground = Instance.provide({
    directory: project.path,
    fn: async () => {
      foregroundReady.resolve()
      await releaseForeground.promise
    },
  })
  await foregroundReady.promise
  try {
    using gate = Instance.acquireProcessSettlementGate()
    const failure = await gate.waitForIdle(25).catch((error) => error)
    expect(failure).toBeInstanceOf(InstanceSettlementInactivityError)
    expect(failure).toMatchObject({ inactivityTimeoutMilliseconds: 25, labels: [expect.stringContaining("serving:")] })
    expect(reason).toMatchObject({ message: "Instance background work cancelled: process settlement" })
    releaseForeground.resolve()
    await foreground
    await background
    expect(await gate.waitForIdle(250).then(() => "settled")).toBe("settled")
  } finally {
    owner.abort(new Error("Owned gate checker cleanup"))
    releaseForeground.resolve()
    await foreground
    await background
  }
  expect(await Instance.provide({ directory: project.path, fn: () => Instance.project.id })).toBe(projectID)
}, 30_000)

test.each([
  { count: 1, admission: "serial" },
  { count: 2, admission: "serial" },
  { count: 2, admission: "parallel" },
])(
  "listener shutdown cancels $count $admission Project owners and joins physical cleanup",
  async ({ count, admission }) => {
    const projects = await Promise.all(
      Array.from({ length: count }, (_, index) => memoryProject(`background-stop-${index}`)),
    )
    const admitted = projects.map(() => Promise.withResolvers<void>())
    const cancelled = projects.map(() => Promise.withResolvers<void>())
    const controls = projects.map(() => new AbortController())
    const release = Promise.withResolvers<void>()
    const traces = projects.map(() => [] as string[])
    const settlementTrace: string[] = []
    const identities: string[] = []
    const reasons: unknown[] = []
    const completions: Promise<void>[] = []
    const listener = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    let stopping: Promise<void> | undefined
    let deadline: ReturnType<typeof setTimeout> | undefined
    try {
      const start = async (index: number) =>
        Instance.provide({
          directory: projects[index]!.path,
          fn: async () => {
            identities[index] = Instance.project.id
            completions[index] = runInstanceBackgroundWork(
              `physical-shutdown:${index}`,
              async (signal) => {
                const handle = await open(path.join(projects[index]!.path, "physical-work.txt"), "w")
                try {
                  await handle.write(`started:${Instance.project.id}\n`)
                  await handle.sync()
                  traces[index]!.push("admitted")
                  signal.addEventListener(
                    "abort",
                    () => {
                      reasons[index] = signal.reason
                      traces[index]!.push("cancelled")
                      cancelled[index]!.resolve()
                    },
                    { once: true },
                  )
                  admitted[index]!.resolve()
                  await cancelled[index]!.promise
                  await release.promise
                  await handle.write(`cancelled:${Instance.project.id}\n`)
                  await handle.sync()
                  traces[index]!.push("flushed")
                } finally {
                  await handle.close()
                  traces[index]!.push("closed")
                  settlementTrace.push(`closed:${index}`)
                }
              },
              controls[index]!.signal,
            ).then(() => {
              traces[index]!.push("completed")
            })
            await admitted[index]!.promise
          },
        })
      if (admission === "parallel") await Promise.all(projects.map((_, index) => start(index)))
      else for (let index = 0; index < count; index++) await start(index)

      stopping = listener.stop(true).then(() => {
        settlementTrace.push("listener:stopped")
      })
      await Promise.race([
        Promise.all(cancelled.map((entry) => entry.promise)),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error("Listener shutdown did not broadcast background cancellation")),
            5_000,
          )
        }),
      ])
      clearTimeout(deadline)
      expect(traces).toEqual(projects.map(() => ["admitted", "cancelled"]))
      expect(reasons).toEqual(
        projects.map(() =>
          expect.objectContaining({
            message: "Instance background work cancelled: process settlement",
          }),
        ),
      )
      release.resolve()
      await stopping
      await Promise.all(completions)
      expect({ beforeStop: settlementTrace.slice(0, -1).sort(), final: settlementTrace.at(-1) }).toEqual({
        beforeStop: projects.map((_, index) => `closed:${index}`),
        final: "listener:stopped",
      })
      expect(traces).toEqual(projects.map(() => ["admitted", "cancelled", "flushed", "closed", "completed"]))
      expect(
        await Promise.all(projects.map((project) => readFile(path.join(project.path, "physical-work.txt"), "utf8"))),
      ).toEqual(identities.map((identity) => `started:${identity}\ncancelled:${identity}\n`))
      expect(await Instance.provide({ directory: projects[0]!.path, fn: () => Instance.project.id })).toBe(
        identities[0]!,
      )
    } finally {
      clearTimeout(deadline)
      for (const control of controls) control.abort(new Error("Owned checker cleanup"))
      release.resolve()
      await Promise.allSettled(completions)
      await (stopping ?? listener.stop(true))
      for (const project of projects) await project[Symbol.asyncDispose]()
    }
  },
  30_000,
)
