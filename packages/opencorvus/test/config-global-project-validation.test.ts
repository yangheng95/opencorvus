import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { ConfigCandidateValidationError } from "@/config/candidate-validation"
import { Instance } from "@/project/instance"
import { ProjectInstanceContext } from "@/project/instance-context"
import { GlobalBus } from "@/bus/global"
import { withTimeout } from "@/util/await-with-timeout"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  Config.TestHooks.afterSourceSnapshotRead = undefined
  Config.TestHooks.beforeGlobalPersist = undefined
  Config.TestHooks.beforeGlobalRuntimeSettlement = undefined
  await resetMemoryDatabase()
})

test("a retained global writer settles its original transition after repeated projection failures", async () => {
  await using project = await memoryProject()
  await projectSource(project.path, { permission_mode: "ask" })
  let attempts = 0
  let resolveRetried!: () => void
  const retried = new Promise<void>((resolve) => {
    resolveRetried = resolve
  })
  const listener = (event: { directory?: string; payload: { type?: string; properties?: Config.Info } }) => {
    if (
      event.directory !== project.path ||
      event.payload.type !== "config.changed" ||
      event.payload.properties?.username !== "retained-global-retry"
    )
      return
    attempts++
    if (attempts <= 2) throw new Error("declared global projection settlement failure")
    resolveRetried()
  }
  GlobalBus.on("event", listener)
  try {
    const failure = await Config.updateGlobalPatch({ username: "retained-global-retry" }).catch((error) => error)
    expect(failure instanceof Config.GlobalConfigCommittedReconcileError).toBe(true)
    await withTimeout(retried, 5000, "retained global transition retry")
    expect({
      name: failure instanceof Error ? failure.name : undefined,
      committed: failure instanceof Config.GlobalConfigCommittedReconcileError ? failure.committed : undefined,
      username: (await Config.getGlobal()).username,
      attempts,
    }).toEqual({
      name: "GlobalConfigCommittedReconcileError",
      committed: true,
      username: "retained-global-retry",
      attempts: 3,
    })
    const next = await Config.updateGlobalPatch({ username: "retained-global-next" })
    expect(next.username).toBe("retained-global-next")
  } finally {
    GlobalBus.off("event", listener)
  }
}, 20000)

async function projectSource(directory: string, source: Record<string, unknown>) {
  const file = path.join(directory, ".opencorvus", "opencorvus.jsonc")
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(source))
  await Instance.provideProjectIdentity({ directory, fn: () => undefined })
  return file
}

test("one global generation projects every registered project's own configuration", async () => {
  await using first = await memoryProject()
  await using second = await memoryProject()
  const files = new Map([
    [await projectSource(first.path, { permission_mode: "ask" }), first.path],
    [await projectSource(second.path, { permission_mode: "full_access" }), second.path],
  ])
  const observed = new Set<string>()
  Config.TestHooks.afterSourceSnapshotRead = async ({ path: file }) => {
    const directory = files.get(file)
    if (!directory) return
    const current = ProjectInstanceContext.use().directory
    expect(current).toBe(directory)
    observed.add(current)
  }
  const saved = await Config.updateGlobalPatch({ username: "registered-generation" })
  expect(saved.username).toBe("registered-generation")
  expect([...observed].sort()).toEqual([first.path, second.path].sort())
  Config.TestHooks.afterSourceSnapshotRead = undefined
  const actual = await Promise.all(
    [first.path, second.path].map((directory) =>
      Instance.provideProjectIdentity({ directory, fn: () => Config.get() }),
    ),
  )
  expect(actual.map((config) => ({ username: config.username, mode: config.permission_mode }))).toEqual([
    { username: "registered-generation", mode: "ask" },
    { username: "registered-generation", mode: "full_access" },
  ])
}, 20000)

test("one global mutation retains its exact candidate identities through persistence and runtime convergence", async () => {
  await using first = await memoryProject()
  await using second = await memoryProject()
  await projectSource(first.path, { permission_mode: "ask" })
  await projectSource(second.path, { permission_mode: "ask" })
  const directories = [first.path, second.path]
  const identities = await Promise.all(
    directories.map((directory) => Instance.provideProjectIdentity({ directory, fn: () => Instance.current() })),
  )
  const observations: Array<{ phase: string; retained: number; active: number }> = []
  const observe = async (phase: string) => {
    const result = await Instance.converge({ maximumRetained: 1 })
    observations.push({ phase, retained: result.retained, active: result.active })
  }
  Config.TestHooks.beforeGlobalPersist = () => observe("candidate")
  Config.TestHooks.beforeGlobalRuntimeSettlement = () => observe("runtime")
  const saved = await Config.updateGlobalPatch({ username: "retained-global-generation" })
  expect(saved.username).toBe("retained-global-generation")
  expect(observations).toEqual([
    { phase: "candidate", retained: 2, active: 2 },
    { phase: "runtime", retained: 2, active: 2 },
  ])
  const current = await Promise.all(
    directories.map((directory) =>
      Instance.provideProjectIdentity({
        directory,
        fn: async () => ({ identity: Instance.current(), config: await Config.get() }),
      }),
    ),
  )
  current.forEach((entry, index) => expect(entry.identity).toBe(identities[index]))
  expect(current.map((entry) => entry.config.username)).toEqual([
    "retained-global-generation",
    "retained-global-generation",
  ])
  const released = await Instance.converge({ maximumRetained: 1 })
  expect({ retained: released.retained, active: released.active, released: released.disposed.length }).toEqual({
    retained: 1,
    active: 0,
    released: 1,
  })
}, 20000)

test("an invalid Project returns the candidate error and a corrected source accepts a full retry", async () => {
  await using first = await memoryProject()
  await using second = await memoryProject()
  await projectSource(first.path, { permission_mode: "ask" })
  await projectSource(second.path, { prompt_profile: { active: "config-validation-missing-profile" } })
  const failure = await Config.updateGlobalPatch({ username: "candidate-rejected" }).catch((error) => error)
  expect(ConfigCandidateValidationError.isInstance(failure)).toBe(true)
  expect(failure.data.message).toContain("config-validation-missing-profile")
  await projectSource(second.path, { prompt_profile: { active: "base" }, permission_mode: "ask" })
  const saved = await Config.updateGlobalPatch({ username: "candidate-retry-accepted" })
  expect(saved.username).toBe("candidate-retry-accepted")
  const actual = await Promise.all(
    [first.path, second.path].map((directory) =>
      Instance.provideProjectIdentity({ directory, fn: () => Config.get() }),
    ),
  )
  expect(actual.map((config) => config.username)).toEqual(["candidate-retry-accepted", "candidate-retry-accepted"])
}, 20000)
