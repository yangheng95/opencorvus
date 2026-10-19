import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { ConfigCandidateValidationError } from "@/config/candidate-validation"
import { Instance } from "@/project/instance"
import { ProjectInstanceContext } from "@/project/instance-context"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  Config.TestHooks.afterSourceSnapshotRead = undefined
  await resetMemoryDatabase()
})

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
