import { afterEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { PackageInstallReceipt } from "../src/bun/install-receipt"
import { Config } from "../src/config/config"
import { Installation } from "../src/installation"
import { Instance } from "../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const PLUGIN = "@opencorvus-ai/plugin"

/** The exact durable state a killed `bun install` leaves in a config tree: a
 *  node_modules directory and a package.json naming the right version. */
async function writeKilledInstallTree(dir: string, version: string) {
  await fs.mkdir(path.join(dir, "node_modules", PLUGIN), { recursive: true })
  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ dependencies: { [PLUGIN]: version } }, null, 2),
  )
  await fs.writeFile(
    path.join(dir, "node_modules", PLUGIN, "package.json"),
    JSON.stringify({ name: PLUGIN, version }),
  )
}

const VERSION = "0.0.55-beta"

/** The local channel resolves the dependency target to "latest", which asks the
 *  package registry whether the cached version is outdated — a network answer
 *  unrelated to the readiness contract under test. Pin a released channel so
 *  the version comparison stays local and exact. */
function pinReleasedChannel() {
  return spyOn(Installation, "isLocal").mockReturnValue(false)
}

describe("config dependency readiness is a receipt, not a directory", () => {
  test("a tree left by a killed install is not read as installed", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pin = pinReleasedChannel()
        using _pinned = { [Symbol.dispose]: () => pin.mockRestore() }
        const dir = path.join(project.path, "config-deps-killed")
        await fs.mkdir(dir, { recursive: true })
        const version = Installation.VERSION
        await writeKilledInstallTree(dir, version)

        // Everything the old check looked at says "installed"; no receipt says
        // the install ever completed.
        expect(await Config.needsInstall(dir)).toBe(true)
      },
    })
  }, 60_000)

  test("the same tree with its completeness receipt is ready", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pin = pinReleasedChannel()
        using _pinned = { [Symbol.dispose]: () => pin.mockRestore() }
        const dir = path.join(project.path, "config-deps-ready")
        await fs.mkdir(dir, { recursive: true })
        const version = Installation.VERSION
        await writeKilledInstallTree(dir, version)

        const occurrenceID = await PackageInstallReceipt.begin({
          root: dir,
          package: PLUGIN,
          requestedVersion: version,
        })
        await PackageInstallReceipt.verifyAndPublish({
          occurrenceID,
          root: dir,
          package: PLUGIN,
          requestedVersion: version,
          resolvedVersion: version,
          moduleDirectory: path.join(dir, "node_modules", PLUGIN),
        })

        expect(await Config.needsInstall(dir)).toBe(false)
      },
    })
  }, 60_000)

  test("a receipt for another tree does not make this one ready", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pin = pinReleasedChannel()
        using _pinned = { [Symbol.dispose]: () => pin.mockRestore() }
        const version = Installation.VERSION
        const owned = path.join(project.path, "config-deps-owned")
        const other = path.join(project.path, "config-deps-other")
        for (const dir of [owned, other]) {
          await fs.mkdir(dir, { recursive: true })
          await writeKilledInstallTree(dir, version)
        }
        const occurrenceID = await PackageInstallReceipt.begin({
          root: other,
          package: PLUGIN,
          requestedVersion: version,
        })
        await PackageInstallReceipt.verifyAndPublish({
          occurrenceID,
          root: other,
          package: PLUGIN,
          requestedVersion: version,
          resolvedVersion: version,
          moduleDirectory: path.join(other, "node_modules", PLUGIN),
        })

        // The receipt names the tree it is about; readiness does not travel.
        expect({
          other: await Config.needsInstall(other),
          owned: await Config.needsInstall(owned),
        }).toEqual({ other: false, owned: true })
      },
    })
  }, 60_000)
})
