import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { BunProc } from "../src/bun"
import { PackageInstallReceipt } from "../src/bun/install-receipt"
import { PackageRegistry } from "../src/bun/registry"
import { Global } from "../src/global"
import { Instance } from "../src/project/instance"
import { loadProviderModule } from "../src/provider/install"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const roots = new Set<string>()

afterEach(async () => {
  await Instance.disposeAll()
  await Promise.all([...roots].map((root) => fs.rm(root, { recursive: true, force: true })))
  roots.clear()
  await resetMemoryDatabase()
})

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function publicationRoot(pkg: string) {
  const root = path.join(Global.Path.cache, "package-installations", digest(pkg))
  roots.add(root)
  return root
}

function revisionShape(installed: string, pkg: string) {
  const parts = path.relative(publicationRoot(pkg), installed).split(path.sep)
  return {
    family: parts[0],
    version: parts[1],
    generation: parts[2],
    modulePath: parts.slice(3),
  }
}

function mockBunInstall(input: { pkg: string; version: () => string; marker: () => string }) {
  let runs = 0
  const run = spyOn(BunProc, "run").mockImplementation(async (_cmd, options) => {
    runs += 1
    const root = options?.cwd
    if (!root) throw new Error("test installer requires a staging cwd")
    const moduleDirectory = path.join(root, "node_modules", input.pkg)
    const dependencyDirectory = path.join(root, "node_modules", "arc021-probe-dependency")
    await fs.mkdir(moduleDirectory, { recursive: true })
    await fs.mkdir(dependencyDirectory, { recursive: true })
    await fs.writeFile(
      path.join(moduleDirectory, "package.json"),
      JSON.stringify({
        name: input.pkg,
        version: input.version(),
        dependencies: { "arc021-probe-dependency": "1.0.0" },
      }),
    )
    await fs.writeFile(path.join(moduleDirectory, "marker.txt"), input.marker())
    await fs.writeFile(
      path.join(dependencyDirectory, "package.json"),
      JSON.stringify({ name: "arc021-probe-dependency", version: "1.0.0" }),
    )
    return {} as never
  })
  return { run, runs: () => runs }
}

describe("shared registry packages publish immutable revisions", () => {
  test("reuses one completed revision and publishes a later version beside it", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pkg = "arc021-immutable-publication-probe"
        let version = "1.2.3"
        let marker = "first-generation"
        const info = spyOn(PackageRegistry, "info").mockImplementation(async () => version)
        const install = mockBunInstall({ pkg, version: () => version, marker: () => marker })
        try {
          const first = await BunProc.install(pkg)
          const reused = await BunProc.install(pkg)
          version = "1.2.4"
          marker = "second-generation"
          const second = await BunProc.install(pkg)

          expect({
            reused,
            first: revisionShape(first, pkg),
            second: revisionShape(second, pkg),
            markers: [
              await fs.readFile(path.join(first, "marker.txt"), "utf8"),
              await fs.readFile(path.join(second, "marker.txt"), "utf8"),
            ],
            installRuns: install.runs(),
          }).toEqual({
            reused: first,
            first: {
              family: "revisions",
              version: digest("1.2.3"),
              generation: expect.stringMatching(/^[0-9a-f-]{36}$/),
              modulePath: ["node_modules", pkg],
            },
            second: {
              family: "revisions",
              version: digest("1.2.4"),
              generation: expect.stringMatching(/^[0-9a-f-]{36}$/),
              modulePath: ["node_modules", pkg],
            },
            markers: ["first-generation", "second-generation"],
            installRuns: 2,
          })
        } finally {
          install.run.mockRestore()
          info.mockRestore()
        }
      },
    })
  }, 60_000)

  test("bypasses an atomically renamed revision whose receipt never committed", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pkg = "arc021-uncommitted-publication-probe"
        const version = "2.0.0"
        let marker = "uncommitted-generation"
        const info = spyOn(PackageRegistry, "info").mockImplementation(async () => version)
        const install = mockBunInstall({ pkg, version: () => version, marker: () => marker })
        const originalPublish = PackageInstallReceipt.verifyAndPublish
        let publications = 0
        const publish = spyOn(PackageInstallReceipt, "verifyAndPublish").mockImplementation(async (input) => {
          publications += 1
          if (publications === 1) throw new Error("simulated receipt commit failure")
          return originalPublish(input)
        })
        try {
          const first = await BunProc.install(pkg).catch((error) => ({
            name: error instanceof Error ? error.name : "UnknownError",
            message: error instanceof Error ? error.message : String(error),
          }))
          marker = "recovered-generation"
          const recovered = await BunProc.install(pkg)

          expect({
            first,
            recovered,
            marker: await fs.readFile(path.join(recovered, "marker.txt"), "utf8"),
            installRuns: install.runs(),
            publications,
          }).toEqual({
            first: { name: "Error", message: "simulated receipt commit failure" },
            recovered: expect.stringMatching(
              new RegExp(
                `${digest(pkg)}[\\\\/]revisions[\\\\/]${digest(version)}[\\\\/][0-9a-f-]{36}[\\\\/]node_modules[\\\\/]${pkg}$`,
              ),
            ),
            marker: "recovered-generation",
            installRuns: 2,
            publications: 2,
          })
        } finally {
          publish.mockRestore()
          install.run.mockRestore()
          info.mockRestore()
        }
      },
    })
  }, 60_000)

  test("publishes a fresh generation when a committed dependency tree is corrupt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pkg = "arc021-corrupt-revision-probe"
        const version = "2.1.0"
        let marker = "initial-generation"
        const info = spyOn(PackageRegistry, "info").mockImplementation(async () => version)
        const install = mockBunInstall({ pkg, version: () => version, marker: () => marker })
        try {
          const first = await BunProc.install(pkg)
          await fs.rm(path.join(first, "..", "arc021-probe-dependency"), { recursive: true, force: true })
          marker = "replacement-generation"
          const replacement = await BunProc.install(pkg)
          expect({
            first: revisionShape(first, pkg),
            replacement: revisionShape(replacement, pkg),
            marker: await fs.readFile(path.join(replacement, "marker.txt"), "utf8"),
            installRuns: install.runs(),
          }).toEqual({
            first: {
              family: "revisions",
              version: digest(version),
              generation: expect.stringMatching(/^[0-9a-f-]{36}$/),
              modulePath: ["node_modules", pkg],
            },
            replacement: {
              family: "revisions",
              version: digest(version),
              generation: expect.stringMatching(/^[0-9a-f-]{36}$/),
              modulePath: ["node_modules", pkg],
            },
            marker: "replacement-generation",
            installRuns: 2,
          })
        } finally {
          install.run.mockRestore()
          info.mockRestore()
        }
      },
    })
  }, 60_000)

  test("maps exact and range selectors for a loadable scoped Provider package", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pkg = "@arc021/provider-probe"
        let resolvedVersion = "4.0.0"
        const info = spyOn(PackageRegistry, "info").mockImplementation(async () => resolvedVersion)
        let registryCalls = 0
        info.mockImplementation(async () => {
          registryCalls += 1
          return resolvedVersion
        })
        const run = spyOn(BunProc, "run").mockImplementation(async (_cmd, options) => {
          const root = options?.cwd
          if (!root) throw new Error("test installer requires a staging cwd")
          const moduleDirectory = path.join(root, "node_modules", pkg)
          await fs.mkdir(moduleDirectory, { recursive: true })
          await fs.writeFile(
            path.join(moduleDirectory, "package.json"),
            JSON.stringify({
              name: pkg,
              version: resolvedVersion,
              type: "module",
              exports: "./index.js",
              dependencies: { "arc021-provider-alias": "npm:arc021-provider-real@^1.0.0" },
            }),
          )
          const aliasDirectory = path.join(root, "node_modules", "arc021-provider-alias")
          await fs.mkdir(aliasDirectory, { recursive: true })
          await fs.writeFile(
            path.join(aliasDirectory, "package.json"),
            JSON.stringify({
              name: "arc021-provider-real",
              version: "1.0.0",
              type: "module",
              exports: "./index.js",
            }),
          )
          await fs.writeFile(path.join(aliasDirectory, "index.js"), `export const aliasValue = "alias-loaded"`)
          await fs.writeFile(
            path.join(moduleDirectory, "index.js"),
            `import { aliasValue } from "arc021-provider-alias"; export function createArc021Provider() { return ${JSON.stringify(resolvedVersion)} + ":" + aliasValue }`,
          )
          return {} as never
        })
        try {
          const exact = await BunProc.install(pkg, "4.0.0")
          const exactFactory = await loadProviderModule(exact)
          resolvedVersion = "4.1.0"
          const ranged = await BunProc.install(pkg, "^4.0.0")
          const rangedFactory = await loadProviderModule(ranged)
          expect({
            registryCalls,
            exact: { shape: revisionShape(exact, pkg), value: exactFactory() },
            ranged: { shape: revisionShape(ranged, pkg), value: rangedFactory() },
          }).toEqual({
            registryCalls: 1,
            exact: {
              shape: {
                family: "revisions",
                version: digest("4.0.0"),
                generation: expect.stringMatching(/^[0-9a-f-]{36}$/),
                modulePath: ["node_modules", "@arc021", "provider-probe"],
              },
              value: "4.0.0:alias-loaded",
            },
            ranged: {
              shape: {
                family: "revisions",
                version: digest("4.1.0"),
                generation: expect.stringMatching(/^[0-9a-f-]{36}$/),
                modulePath: ["node_modules", "@arc021", "provider-probe"],
              },
              value: "4.1.0:alias-loaded",
            },
          })
        } finally {
          run.mockRestore()
          info.mockRestore()
        }
      },
    })
  }, 60_000)

  test("a second backend bypasses the unready revision left by a killed owner", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-arc021-process-"))
    const fixture = path.join(import.meta.dir, "fixture", "bun-package-publication-child.ts")
    const env = { ...process.env, OPENCORVUS_HOME: home }
    try {
      const cut = Bun.spawn([process.execPath, fixture, "cut"], { env, stdout: "pipe", stderr: "pipe" })
      const reader = cut.stdout.getReader()
      const decoder = new TextDecoder()
      let output = ""
      while (!output.includes("RENAMED\n")) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error(`cut child exited before rename: ${output}`)
        output += decoder.decode(chunk.value, { stream: true })
      }
      cut.kill()
      await cut.exited

      const recovery = Bun.spawn([process.execPath, fixture, "recover"], { env, stdout: "pipe", stderr: "pipe" })
      const [recoveryOutput, recoveryError, recoveryCode] = await Promise.all([
        new Response(recovery.stdout).text(),
        new Response(recovery.stderr).text(),
        recovery.exited,
      ])
      const resultLine = recoveryOutput.split(/\r?\n/).find((line) => line.startsWith("RESULT "))
      const diagnostics = recoveryError
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const entry = JSON.parse(line) as Record<string, unknown>
          return {
            level: entry.level,
            service: entry.service,
            pkg: entry.pkg,
            version: entry.version,
            message: entry.message,
          }
        })
      expect({
        recoveryCode,
        diagnostics,
        result: resultLine ? JSON.parse(resultLine.slice("RESULT ".length)) : undefined,
      }).toEqual({
        recoveryCode: 0,
        diagnostics: [
          {
            level: "info",
            service: "bun",
            pkg: "arc021-killed-owner-probe",
            version: "latest",
            message: "installing package using Bun's default registry resolution",
          },
        ],
        result: expect.objectContaining({
          installed: expect.stringMatching(
            new RegExp(
              `${digest("arc021-killed-owner-probe")}[\\\\/]revisions[\\\\/]${digest("3.0.0")}[\\\\/][0-9a-f-]{36}[\\\\/]node_modules[\\\\/]arc021-killed-owner-probe$`,
            ),
          ),
          marker: "recovered",
        }),
      })
    } finally {
      await fs.rm(home, { recursive: true, force: true })
    }
  }, 60_000)

  test("a compromised installer lock cannot overwrite another backend's published generation", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-arc021-compromise-"))
    const fixture = path.join(import.meta.dir, "fixture", "bun-package-publication-child.ts")
    const gate = path.join(home, "release-compromised-owner")
    const pkg = "arc021-killed-owner-probe"
    const packageRoot = path.join(home, "cache", "package-installations", digest(pkg))
    const lockDirectory = `${packageRoot}.lock`
    const env = { ...process.env, OPENCORVUS_HOME: home, ARC021_RELEASE_GATE: gate }
    try {
      const owner = Bun.spawn([process.execPath, fixture, "compromise"], { env, stdout: "pipe", stderr: "pipe" })
      const reader = owner.stdout.getReader()
      const decoder = new TextDecoder()
      let ownerOutput = ""
      while (!ownerOutput.includes("RENAMED\n")) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error(`owner exited before rename: ${ownerOutput}`)
        ownerOutput += decoder.decode(chunk.value, { stream: true })
      }

      expect(path.relative(home, lockDirectory).startsWith("..")).toBe(false)
      await fs.rm(lockDirectory, { recursive: true, force: true })
      await Bun.sleep(5_500)

      const winner = Bun.spawn([process.execPath, fixture, "recover"], { env, stdout: "pipe", stderr: "pipe" })
      const [winnerOutput, winnerError, winnerCode] = await Promise.all([
        new Response(winner.stdout).text(),
        new Response(winner.stderr).text(),
        winner.exited,
      ])
      const winnerLine = winnerOutput.split(/\r?\n/).find((line) => line.startsWith("RESULT "))
      const winnerResult = winnerLine
        ? (JSON.parse(winnerLine.slice("RESULT ".length)) as { installed: string; marker: string })
        : undefined
      if (!winnerResult) throw new Error(`winner produced no result: ${winnerOutput}\n${winnerError}`)
      const markerBeforeOwnerRelease = await fs.readFile(path.join(winnerResult.installed, "marker.txt"), "utf8")

      await fs.writeFile(gate, "release")
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        ownerOutput += decoder.decode(chunk.value, { stream: true })
      }
      ownerOutput += decoder.decode()
      const [ownerError, ownerCode] = await Promise.all([new Response(owner.stderr).text(), owner.exited])

      expect({
        winnerCode,
        winner: winnerResult,
        markerBeforeOwnerRelease,
        markerAfterOwnerRelease: await fs.readFile(path.join(winnerResult.installed, "marker.txt"), "utf8"),
        ownerCode,
        ownerOutput,
        ownerError: ownerError.includes("ProcessLockCompromisedError"),
      }).toEqual({
        winnerCode: 0,
        winner: expect.objectContaining({
          installed: expect.stringMatching(
            new RegExp(
              `${digest(pkg)}[\\\\/]revisions[\\\\/]${digest("3.0.0")}[\\\\/][0-9a-f-]{36}[\\\\/]node_modules[\\\\/]${pkg}$`,
            ),
          ),
          marker: "recovered",
        }),
        markerBeforeOwnerRelease: "recovered",
        markerAfterOwnerRelease: "recovered",
        ownerCode: 1,
        ownerOutput: "RENAMED\n",
        ownerError: true,
      })
    } finally {
      await fs.rm(home, { recursive: true, force: true })
    }
  }, 60_000)

  test("keeps a live preparation generation and reclaims it after its occurrence terminalizes", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pkg = "arc021-live-preparation-probe"
        const packageRoot = publicationRoot(pkg)
        const generationID = randomUUID()
        const stagingRoot = path.join(packageRoot, "staging", generationID)
        const priorRoot = path.join(packageRoot, "revisions", digest("0.9.0"), generationID)
        const finalRoot = path.join(packageRoot, "revisions", digest("1.0.0"), generationID)
        await expect(
          PackageInstallReceipt.begin({
            root: finalRoot,
            package: pkg,
            requestedVersion: "latest",
            preparationRoot: path.join(stagingRoot, "nested"),
          }),
        ).rejects.toThrow(
          "Package installation preparation must be the direct staging child bound to the final generation identity",
        )
        await fs.mkdir(stagingRoot, { recursive: true })
        await fs.writeFile(path.join(stagingRoot, "marker.txt"), "live")
        const priorOccurrenceID = await PackageInstallReceipt.begin({
          root: priorRoot,
          package: pkg,
          requestedVersion: "latest",
          preparationRoot: stagingRoot,
        })
        const occurrenceID = await PackageInstallReceipt.begin({
          root: finalRoot,
          package: pkg,
          requestedVersion: "latest",
          preparationRoot: stagingRoot,
        })
        await PackageInstallReceipt.rollback(priorOccurrenceID, "registry resolution changed")
        await PackageInstallReceipt.recoverAbandonedPreparations({ packageRoot, package: pkg })
        expect(await fs.readFile(path.join(stagingRoot, "marker.txt"), "utf8")).toBe("live")
        await PackageInstallReceipt.rollback(occurrenceID, "test complete")
        await PackageInstallReceipt.recoverAbandonedPreparations({ packageRoot, package: pkg })
        expect(
          await fs.stat(stagingRoot).then(
            () => "present",
            () => "reclaimed",
          ),
        ).toBe("reclaimed")
      },
    })
  }, 60_000)

  test("a backend killed during staging is recovered without retaining its preparation tree", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-arc021-mid-install-"))
    const fixture = path.join(import.meta.dir, "fixture", "bun-package-publication-child.ts")
    const env = { ...process.env, OPENCORVUS_HOME: home }
    const pkg = "arc021-killed-owner-probe"
    const packageRoot = path.join(home, "cache", "package-installations", digest(pkg))
    try {
      const interrupted = Bun.spawn([process.execPath, fixture, "mid-install"], {
        env,
        stdout: "pipe",
        stderr: "pipe",
      })
      const reader = interrupted.stdout.getReader()
      const decoder = new TextDecoder()
      let output = ""
      while (!output.includes("STAGED\n")) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error(`child exited before staging: ${output}`)
        output += decoder.decode(chunk.value, { stream: true })
      }
      interrupted.kill()
      await interrupted.exited

      const recovery = Bun.spawn([process.execPath, fixture, "recover"], { env, stdout: "pipe", stderr: "pipe" })
      const [recoveryOutput, recoveryError, recoveryCode] = await Promise.all([
        new Response(recovery.stdout).text(),
        new Response(recovery.stderr).text(),
        recovery.exited,
      ])
      const resultLine = recoveryOutput.split(/\r?\n/).find((line) => line.startsWith("RESULT "))
      expect({
        recoveryCode,
        result: resultLine ? JSON.parse(resultLine.slice("RESULT ".length)) : undefined,
        stagingEntries: await fs
          .readdir(path.join(packageRoot, "staging"))
          .catch((error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? [] : Promise.reject(error))),
        recoveryError: recoveryError.trim(),
      }).toEqual({
        recoveryCode: 0,
        result: expect.objectContaining({ marker: "recovered" }),
        stagingEntries: [],
        recoveryError: expect.any(String),
      })
    } finally {
      await fs.rm(home, { recursive: true, force: true })
    }
  }, 60_000)
})
