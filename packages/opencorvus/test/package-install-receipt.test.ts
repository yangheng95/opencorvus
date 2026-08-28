import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { DurablePublicationStore } from "@opencorvus-ai/util/durable-publication"
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
  await fs.rm(moduleDirectory, { recursive: true, force: true })
  await fs.mkdir(moduleDirectory, { recursive: true })
  await fs.writeFile(
    path.join(moduleDirectory, "package.json"),
    JSON.stringify({
      name: PKG,
      version: VERSION,
      ...(input.dependencies ? { dependencies: input.dependencies } : {}),
    }),
  )
  for (const dependency of input.installDeps ?? []) {
    const directory = path.join(Global.Path.cache, "node_modules", dependency)
    await fs.rm(directory, { recursive: true, force: true })
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
        const occurrenceID = await PackageInstallReceipt.begin({
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
        })

        await expect(
          PackageInstallReceipt.verifyAndPublish({
            occurrenceID,
            root: Global.Path.cache,
            package: PKG,
            requestedVersion: VERSION,
            resolvedVersion: VERSION,
            moduleDirectory,
          }),
        ).rejects.toThrow("unresolved receipt-probe-dependency")

        // Nothing is Ready: the next load reinstalls instead of failing
        // forever against the incomplete tree.
        expect(
          await PackageInstallReceipt.isPublished({ root: Global.Path.cache, package: PKG, version: VERSION }),
        ).toBe(false)
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
        const occurrenceID = await PackageInstallReceipt.begin({
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: "latest",
        })
        await PackageInstallReceipt.verifyAndPublish({
          occurrenceID,
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: "latest",
          resolvedVersion: VERSION,
          moduleDirectory,
        })
        // Readiness is keyed by the RESOLVED revision, which is what every
        // reader asks about; a receipt under the selector would be a fact
        // nothing reads.
        expect({
          resolved: await PackageInstallReceipt.isPublished({
            root: Global.Path.cache,
            package: PKG,
            version: VERSION,
          }),
          unrelated: await PackageInstallReceipt.isPublished({
            root: Global.Path.cache,
            package: PKG,
            version: "9.9.9",
          }),
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

        const occurrenceID = await PackageInstallReceipt.begin({
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
        })
        await PackageInstallReceipt.verifyAndPublish({
          occurrenceID,
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
          resolvedVersion: VERSION,
          moduleDirectory,
        })
        expect(
          await PackageInstallReceipt.isPublished({ root: Global.Path.cache, package: PKG, version: VERSION }),
        ).toBe(true)
      },
    })
  }, 60_000)

  test("the verified closure follows dependency identities recursively", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const moduleDirectory = await writeCachedTree({
          dependencies: { "receipt-probe-dependency": "1.0.0" },
          installDeps: ["receipt-probe-dependency"],
        })
        const missingTransitive = "receipt-probe-transitive-arc021-missing"
        await fs.writeFile(
          path.join(Global.Path.cache, "node_modules", "receipt-probe-dependency", "package.json"),
          JSON.stringify({
            name: "receipt-probe-dependency",
            version: "1.0.0",
            dependencies: { [missingTransitive]: "1.0.0" },
          }),
        )
        await Promise.all(
          [
            path.join(Global.Path.cache, "node_modules", missingTransitive),
            path.join(Global.Path.cache, "node_modules", "receipt-probe-dependency", "node_modules", missingTransitive),
          ].map((directory) => fs.rm(directory, { recursive: true, force: true })),
        )
        const occurrenceID = await PackageInstallReceipt.begin({
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
        })
        const result = await PackageInstallReceipt.verifyAndPublish({
          occurrenceID,
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
          resolvedVersion: VERSION,
          moduleDirectory,
        }).catch((error) => ({ name: error instanceof Error ? error.name : "Unknown", message: String(error) }))
        expect(result).toEqual({
          name: "Error",
          message: `Error: Installed ${PKG}@${VERSION} is incomplete: unresolved ${missingTransitive}`,
        })
      },
    })
  }, 60_000)

  test("the first private dependency candidate cannot fall through to a valid hoisted package", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const dependency = "receipt-probe-private-corruption"
        const moduleDirectory = await writeCachedTree({ dependencies: { [dependency]: "1.0.0" } })
        const privateDirectory = path.join(moduleDirectory, "node_modules", dependency)
        const hoistedDirectory = path.join(Global.Path.cache, "node_modules", dependency)
        await fs.mkdir(privateDirectory, { recursive: true })
        await fs.mkdir(hoistedDirectory, { recursive: true })
        await fs.writeFile(path.join(privateDirectory, "package.json"), "{")
        await fs.writeFile(
          path.join(hoistedDirectory, "package.json"),
          JSON.stringify({ name: dependency, version: "1.0.0" }),
        )
        const occurrenceID = await PackageInstallReceipt.begin({
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
        })
        const result = await PackageInstallReceipt.verifyAndPublish({
          occurrenceID,
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
          resolvedVersion: VERSION,
          moduleDirectory,
        }).catch((error) => ({ name: error instanceof Error ? error.name : "Unknown", message: String(error) }))
        expect({
          result,
          published: await PackageInstallReceipt.isPublished({
            root: Global.Path.cache,
            package: PKG,
            version: VERSION,
          }),
        }).toEqual({
          result: {
            name: "Error",
            message: `Error: Installed dependency ${dependency} resolves first to a package with an unreadable or mismatched manifest`,
          },
          published: false,
        })
      },
    })
  }, 60_000)

  test("an npm alias validates the target manifest identity at the alias path", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const alias = "receipt-probe-alias"
        const target = "receipt-probe-real-package"
        const scopedAlias = "receipt-probe-scoped-alias"
        const scopedTarget = "@receipt-probe/real-package"
        const moduleDirectory = await writeCachedTree({
          dependencies: {
            [alias]: `npm:${target}@^1.0.0`,
            [scopedAlias]: `npm:${scopedTarget}@~2.0.0`,
          },
        })
        const aliasDirectory = path.join(Global.Path.cache, "node_modules", alias)
        const scopedAliasDirectory = path.join(Global.Path.cache, "node_modules", scopedAlias)
        await Promise.all(
          [
            [aliasDirectory, target, "1.1.0"],
            [scopedAliasDirectory, scopedTarget, "2.0.1"],
          ].map(async ([directory, name, version]) => {
            await fs.rm(directory, { recursive: true, force: true })
            await fs.mkdir(directory, { recursive: true })
            await fs.writeFile(path.join(directory, "package.json"), JSON.stringify({ name, version }))
          }),
        )
        const occurrenceID = await PackageInstallReceipt.begin({
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
        })
        await PackageInstallReceipt.verifyAndPublish({
          occurrenceID,
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
          resolvedVersion: VERSION,
          moduleDirectory,
        })
        expect({
          closure: await PackageInstallReceipt.verifyTree({
            root: Global.Path.cache,
            package: PKG,
            resolvedVersion: VERSION,
            moduleDirectory,
          }),
          published: await PackageInstallReceipt.isPublished({
            root: Global.Path.cache,
            package: PKG,
            version: VERSION,
          }),
        }).toEqual({ closure: [alias, scopedAlias], published: true })
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

        const occurrenceID = await PackageInstallReceipt.begin({
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
        })
        await expect(
          PackageInstallReceipt.verifyAndPublish({
            occurrenceID,
            root: Global.Path.cache,
            package: PKG,
            requestedVersion: VERSION,
            resolvedVersion: VERSION,
            moduleDirectory,
          }),
        ).rejects.toThrow(
          "Installed dependency receipt-probe-truncated resolves first to a package with an unreadable or mismatched manifest",
        )
        expect(
          await PackageInstallReceipt.isPublished({ root: Global.Path.cache, package: PKG, version: VERSION }),
        ).toBe(false)
      },
    })
  }, 60_000)

  test("a new attempt supersedes an unsettled occurrence for the same revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const moduleDirectory = await writeCachedTree({ installDeps: [] })
        const abandoned = await PackageInstallReceipt.begin({
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
        })
        const retried = await PackageInstallReceipt.begin({
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
        })
        expect(retried).toBe(abandoned)

        await PackageInstallReceipt.verifyAndPublish({
          occurrenceID: retried,
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: VERSION,
          resolvedVersion: VERSION,
          moduleDirectory,
        })
        expect(
          await PackageInstallReceipt.isPublished({ root: Global.Path.cache, package: PKG, version: VERSION }),
        ).toBe(true)
      },
    })
  }, 60_000)

  test("a caught resolved-revision publication failure settles both occurrences", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const moduleDirectory = await writeCachedTree({ installDeps: [] })
        const selectorID = await PackageInstallReceipt.begin({
          root: Global.Path.cache,
          package: PKG,
          requestedVersion: "latest",
        })
        const originalAppend = DurablePublicationStore.prototype.appendPhase
        let phases = 0
        const append = spyOn(DurablePublicationStore.prototype, "appendPhase").mockImplementation(
          async function (kind, input) {
            phases += 1
            if (phases === 2) throw new Error("simulated resolved phase failure")
            return originalAppend.call(this, kind, input)
          },
        )
        try {
          const result = await PackageInstallReceipt.verifyAndPublish({
            occurrenceID: selectorID,
            root: Global.Path.cache,
            package: PKG,
            requestedVersion: "latest",
            resolvedVersion: VERSION,
            moduleDirectory,
          }).catch(async (error) => {
            await PackageInstallReceipt.rollback(selectorID, String(error))
            return { name: error instanceof Error ? error.name : "Unknown", message: String(error) }
          })
          const open = await new DurablePublicationStore(path.join(Global.Path.data, "durable-publications")).listOpen(
            "package-install",
          )
          expect({
            result,
            openForPackage: open
              .filter((entry) => (entry.intent.payload as { package?: string }).package === PKG)
              .map((entry) => entry.occurrenceID),
          }).toEqual({
            result: { name: "Error", message: "Error: simulated resolved phase failure" },
            openForPackage: [],
          })
        } finally {
          append.mockRestore()
        }
      },
    })
  }, 60_000)
})
