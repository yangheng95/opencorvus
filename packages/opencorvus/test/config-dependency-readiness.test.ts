import { afterEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { BunProc } from "../src/bun"
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
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({ dependencies: { [PLUGIN]: version } }, null, 2))
  await fs.writeFile(path.join(dir, "node_modules", PLUGIN, "package.json"), JSON.stringify({ name: PLUGIN, version }))
}

const PREVIOUS_VERSION = "0.0.54-beta"

async function publishReceipt(dir: string, version: string) {
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
}

const PEER_DIRECTORY_OWNER = `
import fs from "node:fs/promises"
import { acquireProcessLock } from "PROCESS_LOCK_SOURCE"

const [target, trace] = process.argv.slice(2)
const release = await acquireProcessLock(target, { realpath: false })
await fs.appendFile(trace, "peer-acquired\\n")
process.stdout.write("acquired\\n")
await new Promise((resolve) => setTimeout(resolve, 400))
await fs.appendFile(trace, "peer-released\\n")
await release()
`

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

        await publishReceipt(dir, version)

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
        await publishReceipt(other, version)

        // The receipt names the tree it is about; readiness does not travel.
        expect({
          other: await Config.needsInstall(other),
          owned: await Config.needsInstall(owned),
        }).toEqual({ other: false, owned: true })
      },
    })
  }, 60_000)

  test("a Config loader joins the in-flight directory generation before its plugins become ready", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pin = pinReleasedChannel()
        using _pinned = { [Symbol.dispose]: () => pin.mockRestore() }
        const dir = path.join(project.path, ".opencorvus")
        const pluginDir = path.join(dir, "plugin")
        const moduleManifest = path.join(dir, "node_modules", PLUGIN, "package.json")
        const targetVersion = Installation.VERSION
        await fs.mkdir(pluginDir, { recursive: true })
        await fs.writeFile(path.join(pluginDir, "generation-race.ts"), "export default {}\n")

        // Preserve a historical completion receipt for the target revision,
        // then make the current physical tree a prior revision. The upgrader
        // will publish the target manifest before replacing this tree.
        await writeKilledInstallTree(dir, targetVersion)
        await publishReceipt(dir, targetVersion)
        await fs.writeFile(
          path.join(dir, "package.json"),
          JSON.stringify({ dependencies: { [PLUGIN]: PREVIOUS_VERSION } }, null, 2),
        )
        await fs.writeFile(moduleManifest, JSON.stringify({ name: PLUGIN, version: PREVIOUS_VERSION }))

        const timeline: string[] = []
        let admitUpgrade!: () => void
        const upgradeAdmission = new Promise<void>((resolve) => {
          admitUpgrade = resolve
        })
        let continueUpgrade!: () => void
        const upgradeGate = new Promise<void>((resolve) => {
          continueUpgrade = resolve
        })
        const originalBegin = PackageInstallReceipt.begin
        const begin = spyOn(PackageInstallReceipt, "begin").mockImplementation(async (input) => {
          if (path.resolve(input.root) !== path.resolve(dir) || input.requestedVersion !== targetVersion) {
            return originalBegin(input)
          }
          timeline.push("upgrade-owner-held")
          admitUpgrade()
          await upgradeGate
          return originalBegin(input)
        })
        const run = spyOn(BunProc, "run").mockImplementation(async (_cmd, options) => {
          if (path.resolve(String(options?.cwd || "")) !== path.resolve(dir)) {
            throw new Error(`Unexpected dependency install directory: ${String(options?.cwd || "<missing>")}`)
          }
          await fs.writeFile(moduleManifest, JSON.stringify({ name: PLUGIN, version: targetVersion }))
          timeline.push("target-tree-published")
          return {} as never
        })
        using _spies = {
          [Symbol.dispose]() {
            begin.mockRestore()
            run.mockRestore()
          },
        }

        const upgrade = Config.installDependencies(dir)
        await upgradeAdmission
        await Config.state.reset()
        const loaded = await Config.get()
        const loader = Config.waitForDependencies().then(() => {
          timeline.push("loader-ready")
        })
        await new Promise((resolve) => setTimeout(resolve, 100))
        continueUpgrade()
        await Promise.all([upgrade, loader])

        expect({
          timeline,
          plugin: loaded.plugin?.some((item) => item.endsWith("generation-race.ts")),
          installedVersion: JSON.parse(await fs.readFile(moduleManifest, "utf8")).version,
        }).toEqual({
          timeline: ["upgrade-owner-held", "target-tree-published", "loader-ready"],
          plugin: true,
          installedVersion: targetVersion,
        })
      },
    })
  }, 60_000)

  test("begin failure leaves the prior generation intact and retryable", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pin = pinReleasedChannel()
        using _pinned = { [Symbol.dispose]: () => pin.mockRestore() }
        const dir = path.join(project.path, "config-deps-begin-failure")
        await fs.mkdir(dir, { recursive: true })
        await writeKilledInstallTree(dir, PREVIOUS_VERSION)

        const begin = spyOn(PackageInstallReceipt, "begin").mockRejectedValueOnce(
          new Error("receipt owner unavailable"),
        )
        const error = await Config.installDependencies(dir).catch((cause) => cause)
        begin.mockRestore()

        expect({
          error: error instanceof Error ? error.message : String(error),
          selectedVersion: JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8")).dependencies[PLUGIN],
          physicalVersion: JSON.parse(await fs.readFile(path.join(dir, "node_modules", PLUGIN, "package.json"), "utf8"))
            .version,
          retryRequired: await Config.needsInstall(dir),
        }).toEqual({
          error: "receipt owner unavailable",
          selectedVersion: PREVIOUS_VERSION,
          physicalVersion: PREVIOUS_VERSION,
          retryRequired: true,
        })
      },
    })
  }, 60_000)

  test("an interrupted target occurrence remains a retryable generation after restart", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pin = pinReleasedChannel()
        using _pinned = { [Symbol.dispose]: () => pin.mockRestore() }
        const dir = path.join(project.path, "config-deps-interrupted-generation")
        const targetVersion = Installation.VERSION
        await fs.mkdir(dir, { recursive: true })
        await writeKilledInstallTree(dir, targetVersion)
        await publishReceipt(dir, targetVersion)

        await fs.writeFile(
          path.join(dir, "node_modules", PLUGIN, "package.json"),
          JSON.stringify({ name: PLUGIN, version: PREVIOUS_VERSION }),
        )
        await PackageInstallReceipt.begin({ root: dir, package: PLUGIN, requestedVersion: targetVersion })
        await fs.writeFile(
          path.join(dir, "package.json"),
          JSON.stringify({ dependencies: { [PLUGIN]: targetVersion } }, null, 2),
        )

        expect({
          selectedVersion: JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8")).dependencies[PLUGIN],
          physicalVersion: JSON.parse(await fs.readFile(path.join(dir, "node_modules", PLUGIN, "package.json"), "utf8"))
            .version,
          retryRequired: await Config.needsInstall(dir),
        }).toEqual({
          selectedVersion: targetVersion,
          physicalVersion: PREVIOUS_VERSION,
          retryRequired: true,
        })
      },
    })
  }, 60_000)

  test("a failed physical upgrade is retried before the target generation becomes ready", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pin = pinReleasedChannel()
        using _pinned = { [Symbol.dispose]: () => pin.mockRestore() }
        const dir = path.join(project.path, "config-deps-failed-upgrade")
        const moduleManifest = path.join(dir, "node_modules", PLUGIN, "package.json")
        const targetVersion = Installation.VERSION
        await fs.mkdir(dir, { recursive: true })
        await writeKilledInstallTree(dir, PREVIOUS_VERSION)
        await publishReceipt(dir, PREVIOUS_VERSION)

        let attempts = 0
        const run = spyOn(BunProc, "run").mockImplementation(async (_cmd, options) => {
          if (path.resolve(String(options?.cwd || "")) !== path.resolve(dir)) {
            throw new Error(`Unexpected dependency install directory: ${String(options?.cwd || "<missing>")}`)
          }
          attempts++
          await fs.writeFile(moduleManifest, JSON.stringify({ name: PLUGIN, version: targetVersion }))
          if (attempts === 1) throw new Error("physical target publication interrupted")
          return {} as never
        })
        using _run = { [Symbol.dispose]: () => run.mockRestore() }

        const firstError = await Config.installDependencies(dir).catch((cause) => cause)
        const afterFailure = {
          error: firstError instanceof Error ? firstError.message : String(firstError),
          selectedVersion: JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8")).dependencies[PLUGIN],
          retryRequired: await Config.needsInstall(dir),
        }
        await Config.installDependencies(dir)

        expect({
          afterFailure,
          attempts,
          installedVersion: JSON.parse(await fs.readFile(moduleManifest, "utf8")).version,
          ready: !(await Config.needsInstall(dir)),
        }).toEqual({
          afterFailure: {
            error: "physical target publication interrupted",
            selectedVersion: targetVersion,
            retryRequired: true,
          },
          attempts: 2,
          installedVersion: targetVersion,
          ready: true,
        })
      },
    })
  }, 60_000)

  test("a Config readiness reader waits for the directory owner in another process", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const dir = path.join(project.path, "config-deps-process-owner")
        const trace = path.join(project.path, "config-deps-process-owner.trace")
        const peerPath = path.join(project.path, "config-deps-process-owner.ts")
        const processLockSource = path.resolve(import.meta.dir, "../src/util/process-lock").replaceAll("\\", "/")
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(peerPath, PEER_DIRECTORY_OWNER.replace("PROCESS_LOCK_SOURCE", processLockSource))

        const peer = Bun.spawn([process.execPath, "run", peerPath, dir, trace], {
          cwd: path.resolve(import.meta.dir, ".."),
          stdout: "pipe",
          stderr: "pipe",
        })
        const output = peer.stdout.getReader()
        const decoder = new TextDecoder()
        let announced = ""
        while (!announced.includes("acquired")) {
          const chunk = await output.read()
          if (chunk.done) throw new Error(`peer exited before acquiring directory owner: ${announced}`)
          announced += decoder.decode(chunk.value)
        }
        output.releaseLock()

        const retryRequired = await Config.needsInstall(dir)
        await fs.appendFile(trace, "reader-ready\n")
        const peerExit = await peer.exited
        const peerError = await new Response(peer.stderr).text()

        expect({
          retryRequired,
          trace: (await fs.readFile(trace, "utf8")).trim().split("\n"),
          peerExit,
          peerError,
        }).toEqual({
          retryRequired: true,
          trace: ["peer-acquired", "peer-released", "reader-ready"],
          peerExit: 0,
          peerError: "",
        })
      },
    })
  }, 60_000)
})
