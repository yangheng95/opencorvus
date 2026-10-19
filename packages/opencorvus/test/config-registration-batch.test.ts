import { afterEach, beforeEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { withTimeout } from "@/util/await-with-timeout"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

beforeEach(async () => {
  await fs.writeFile(
    path.join(Global.Path.config, "opencorvus.jsonc"),
    JSON.stringify({ prompt_profile: { active: "base" }, permission_mode: "ask" }),
  )
  Config.global.reset()
})
afterEach(resetMemoryDatabase)

test("a global cold candidate completes both independent admitted Project identities together", async () => {
  await using first = await memoryProject()
  await using second = await memoryProject()
  const directories = [first.path, second.path]
  const identities = await Promise.all(directories.map((directory) => Project.fromDirectory(directory)))
  await Instance.disposeAll()
  const admitted = new Set<string>()
  let release!: () => void
  const together = new Promise<void>((resolve) => {
    release = resolve
  })
  using hook = Project.TestHooks.installAfterDiscoveryAdmission(async ({ directory }) => {
    if (!directories.includes(directory)) return
    admitted.add(directory)
    if (admitted.size === 2) release()
    await withTimeout(together, 1000, "independent admitted Project identities")
  })
  const saved = await Config.updateGlobalPatch({ username: "parallel-admitted-identities" })
  expect({
    username: saved.username,
    admitted: [...admitted].sort(),
    generations: identities.map((identity) => Project.occurrence(identity.project.id)?.generation),
  }).toEqual({
    username: "parallel-admitted-identities",
    admitted: [...directories].sort(),
    generations: identities.map((identity) => identity.generation),
  })
}, 20000)
