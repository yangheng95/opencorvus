import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { PackageInstallReceipt } from "../src/bun/install-receipt"
import { Global } from "../src/global"
import { Instance } from "../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const PKG = "receipt-probe-package"
const VERSION = "1.2.3"

async function writeCachedTree(input: { dependencies?: Record<string, string>; installDeps?: string[] }) {
  const moduleDirectory = path.join(Global.Path.cache, "node_modules", PKG)
  await fs.mkdir(moduleDirectory, { recursive: true })
  await fs.writeFile(
    path.join(moduleDirectory, "package.json"),
    JSON.stringify({ name: PKG, version: VERSION, ...(input.dependencies ? { dependencies: input.dependencies } : {}) }),
  )
  for (const dependency of input.installDeps ?? []) {
    const directory = path.join(Global.Path.cache, "node_modules", dependency)
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(path.join(directory, "package.json"), JSON.stringify({ name: dependency, version: "1.0.0" }))
  }
  return moduleDirectory
}

describe("package installation readiness is a receipt, not a directory", () => {
  test("a tree whose declared dependencies never resolved publishes no receipt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        // The exact durable state a killed `bun add` leaves: the package's own
        // manifest is readable and reports the right version, but the tree its
        // manifest declares was never completed.
        const moduleDirectory = await writeCachedTree({
          dependencies: { "receipt-probe-dependency": "^1.0.0" },
        })
        const occurrenceID = await PackageInstallReceipt.begin({ package: PKG, requestedVersion: VERSION })

        await expect(
          PackageInstallReceipt.verifyAndPublish({
            occurrenceID,
            package: PKG,
            requestedVersion: VERSION,
            resolvedVersion: VERSION,
            moduleDirectory,
          }),
        ).rejects.toThrow("unresolved receipt-probe-dependency")

        // Nothing is Ready: the next load reinstalls instead of failing
        // forever against the incomplete tree.
        expect(await PackageInstallReceipt.isPublished(PKG, VERSION)).toBe(false)
      },
    })
  }, 60_000)

  test("a complete tree publishes its receipt under both the requested and resolved revisions", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const moduleDirectory = await writeCachedTree({
          dependencies: { "receipt-probe-dependency": "^1.0.0" },
          installDeps: ["receipt-probe-dependency"],
        })
        const occurrenceID = await PackageInstallReceipt.begin({ package: PKG, requestedVersion: "latest" })
        await PackageInstallReceipt.verifyAndPublish({
          occurrenceID,
          package: PKG,
          requestedVersion: "latest",
          resolvedVersion: VERSION,
          moduleDirectory,
        })
        // Readiness is keyed by the RESOLVED revision, which is what every
        // reader asks about; a receipt under the selector would be a fact
        // nothing reads.
        expect({
          resolved: await PackageInstallReceipt.isPublished(PKG, VERSION),
          unrelated: await PackageInstallReceipt.isPublished(PKG, "9.9.9"),
        }).toEqual({ resolved: true, unrelated: false })
      },
    })
  }, 60_000)

  test("a dependency resolved by nesting is a complete install, not a missing one", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        // A version conflict with something already in the shared cache is
        // resolved by NESTING the dependency under the package that needs it.
        // Reading only the hoisted flat path called that correct tree
        // incomplete, so no receipt was ever published and every later load
        // reinstalled and failed again.
        const moduleDirectory = await writeCachedTree({
          dependencies: { "receipt-probe-dependency": "^2.0.0" },
        })
        const nested = path.join(moduleDirectory, "node_modules", "receipt-probe-dependency")
        await fs.mkdir(nested, { recursive: true })
        await fs.writeFile(
          path.join(nested, "package.json"),
          JSON.stringify({ name: "receipt-probe-dependency", version: "2.1.0" }),
        )

        const occurrenceID = await PackageInstallReceipt.begin({ package: PKG, requestedVersion: VERSION })
        await PackageInstallReceipt.verifyAndPublish({
          occurrenceID,
          package: PKG,
          requestedVersion: VERSION,
          resolvedVersion: VERSION,
          moduleDirectory,
        })
        expect(await PackageInstallReceipt.isPublished(PKG, VERSION)).toBe(true)
      },
    })
  }, 60_000)

  test("a dependency whose manifest is truncated is not a readable manifest", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        // The same killed install that leaves a partial tree also leaves
        // zero-byte and truncated manifests; a path that merely exists is not
        // proof that anything is installed.
        const moduleDirectory = await writeCachedTree({
          dependencies: { "receipt-probe-truncated": "^1.0.0" },
        })
        const flat = path.join(Global.Path.cache, "node_modules", "receipt-probe-truncated")
        await fs.mkdir(flat, { recursive: true })
        await fs.writeFile(path.join(flat, "package.json"), '{"name": "receipt-probe-trunc')

        const occurrenceID = await PackageInstallReceipt.begin({ package: PKG, requestedVersion: VERSION })
        await expect(
          PackageInstallReceipt.verifyAndPublish({
            occurrenceID,
            package: PKG,
            requestedVersion: VERSION,
            resolvedVersion: VERSION,
            moduleDirectory,
          }),
        ).rejects.toThrow("unresolved receipt-probe-truncated")
        expect(await PackageInstallReceipt.isPublished(PKG, VERSION)).toBe(false)
      },
    })
  }, 60_000)

  test("a new attempt supersedes an unsettled occurrence for the same revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const moduleDirectory = await writeCachedTree({ installDeps: [] })
        const abandoned = await PackageInstallReceipt.begin({ package: PKG, requestedVersion: VERSION })
        const retried = await PackageInstallReceipt.begin({ package: PKG, requestedVersion: VERSION })
        expect(retried).toBe(abandoned)

        await PackageInstallReceipt.verifyAndPublish({
          occurrenceID: retried,
          package: PKG,
          requestedVersion: VERSION,
          resolvedVersion: VERSION,
          moduleDirectory,
        })
        expect(await PackageInstallReceipt.isPublished(PKG, VERSION)).toBe(true)
      },
    })
  }, 60_000)
})
