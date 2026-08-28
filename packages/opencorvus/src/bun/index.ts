import z from "zod"
import { createHash, randomUUID } from "node:crypto"
import { Global } from "../global"
import { CROSS_PROCESS_LOCK_RETRY, withProcessLock } from "../util/process-lock"
import fs from "node:fs/promises"
import { PackageInstallReceipt } from "./install-receipt"
import { Log } from "../util/log"
import path from "node:path"
import { Filesystem } from "../util/filesystem"
import { NamedError } from "@opencorvus-ai/util/error"
import { Lock } from "../util/lock"
import { PackageRegistry } from "./registry"
import { proxied } from "@/util/proxied"
import { Process } from "../util/process"
import { BunExecutable } from "./executable"

export namespace BunProc {
  const log = Log.create({ service: "bun" })

  export async function run(cmd: string[], options?: Process.Options) {
    const executable = BunExecutable.resolve()
    log.info("running", {
      cmd: [executable, ...cmd],
      ...options,
    })
    const result = await Process.spawnHost([executable, ...cmd], {
      ...options,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        ...options?.env,
        BUN_BE_BUN: "1",
      },
    })
    const code = await result.exited
    const stdout = result.stdout ? await Process.readText(result.stdout) : undefined
    const stderr = result.stderr ? await Process.readText(result.stderr) : undefined
    log.info("done", {
      code,
      stdout,
      stderr,
    })
    if (code !== 0) {
      throw new Error(`Command failed with exit code ${code}`)
    }
    return result
  }

  export function which() {
    return BunExecutable.resolve()
  }

  export const InstallFailedError = NamedError.create(
    "BunInstallFailedError",
    z.object({
      pkg: z.string(),
      version: z.string(),
    }),
  )

  export async function install(pkg: string, version = "latest") {
    const packageRoot = packagePublicationRoot(pkg)
    using _ = await Lock.write(`bun-install:${packageRoot}`)
    await fs.mkdir(packageRoot, { recursive: true })
    return withProcessLock(packageRoot, { realpath: false, retries: CROSS_PROCESS_LOCK_RETRY }, () =>
      installOwned(pkg, version, packageRoot),
    )
  }

  function identitySegment(value: string) {
    return createHash("sha256").update(value).digest("hex")
  }

  function packagePublicationRoot(pkg: string) {
    return path.join(Global.Path.cache, "package-installations", identitySegment(pkg))
  }

  function revisionParent(packageRoot: string, version: string) {
    return path.join(packageRoot, "revisions", identitySegment(version))
  }

  async function installedVersion(moduleDirectory: string, pkg: string, expected?: string) {
    const installed = z
      .object({ version: z.string().min(1) })
      .passthrough()
      .parse(await Filesystem.readJson(path.join(moduleDirectory, "package.json"))).version
    if (expected !== undefined && installed !== expected) {
      throw new Error(
        `Published package version mismatch for ${pkg}: revision records ${expected}, installed package reports ${installed}`,
      )
    }
    return installed
  }

  async function readyRevision(packageRoot: string, pkg: string, resolvedVersion: string) {
    const parent = revisionParent(packageRoot, resolvedVersion)
    const generations = await fs.readdir(parent, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return []
      throw error
    })
    for (const generation of generations
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()) {
      const root = path.join(parent, generation)
      const moduleDirectory = path.join(root, "node_modules", pkg)
      if (!(await PackageInstallReceipt.isPublished({ root, package: pkg, version: resolvedVersion }))) continue
      const valid = await PackageInstallReceipt.verifyTree({
        root,
        package: pkg,
        resolvedVersion,
        moduleDirectory,
      }).then(
        () => true,
        () => false,
      )
      if (valid) return moduleDirectory
    }
    return undefined
  }

  function exactVersion(selector: string) {
    return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(selector) ? selector : undefined
  }

  async function resolveVersion(pkg: string, selector: string, cwd: string) {
    return exactVersion(selector) ?? PackageRegistry.info(`${pkg}@${selector}`, "version", cwd)
  }

  async function installOwned(pkg: string, version: string, packageRoot: string) {
    await PackageInstallReceipt.recoverAbandonedPreparations({ packageRoot, package: pkg })
    const candidateVersion = await resolveVersion(pkg, version, packageRoot)
    const ready = await readyRevision(packageRoot, pkg, candidateVersion)
    if (ready) return ready

    const stagingParent = path.join(packageRoot, "staging")
    const generationID = randomUUID()
    const stagingRoot = path.join(stagingParent, generationID)

    const args = [
      "add",
      "--force",
      "--exact",
      // Workaround for bun issue oven-sh/bun#19936: --no-cache required under proxy/CI.
      ...(proxied() || process.env.CI ? ["--no-cache"] : []),
      "--cwd",
      stagingRoot,
      pkg + "@" + version,
    ]

    // Let Bun handle registry resolution:
    // - If .npmrc files exist, Bun will use them automatically
    // - If no .npmrc files exist, Bun will default to https://registry.npmjs.org
    // - No need to pass --registry flag
    log.info("installing package using Bun's default registry resolution", {
      pkg,
      version,
    })

    // The occurrence is durable BEFORE the tree is mutated, so an install
    // killed halfway leaves an unsettled occurrence — never a receipt.
    const finalRootFor = (resolvedVersion: string) =>
      path.join(revisionParent(packageRoot, resolvedVersion), generationID)
    let occurrenceRoot = finalRootFor(candidateVersion)
    let occurrenceID = await PackageInstallReceipt.begin({
      root: occurrenceRoot,
      package: pkg,
      requestedVersion: version,
      preparationRoot: stagingRoot,
    })
    try {
      await fs.mkdir(stagingParent, { recursive: true })
      await fs.mkdir(stagingRoot, { recursive: false })
      await Filesystem.writeJson(path.join(stagingRoot, "package.json"), { private: true, dependencies: {} })
      await BunProc.run(args, {
        cwd: stagingRoot,
      }).catch((e) => {
        throw new InstallFailedError(
          { pkg, version },
          {
            cause: e,
          },
        )
      })

      // The installed package metadata, not the requested selector, owns the cached version.
      const stagedModule = path.join(stagingRoot, "node_modules", pkg)
      const resolvedVersion = await installedVersion(stagedModule, pkg)
      await PackageInstallReceipt.verifyTree({
        root: stagingRoot,
        package: pkg,
        resolvedVersion,
        moduleDirectory: stagedModule,
      })

      const finalRoot = finalRootFor(resolvedVersion)
      const finalModule = path.join(finalRoot, "node_modules", pkg)
      const existingReady = await readyRevision(packageRoot, pkg, resolvedVersion)
      if (existingReady) {
        await fs.rm(stagingRoot, { recursive: true, force: true })
        await PackageInstallReceipt.rollback(occurrenceID, "resolved revision already published")
        return existingReady
      }
      if (finalRoot !== occurrenceRoot) {
        const priorOccurrenceID = occurrenceID
        occurrenceRoot = finalRoot
        occurrenceID = await PackageInstallReceipt.begin({
          root: occurrenceRoot,
          package: pkg,
          requestedVersion: version,
          preparationRoot: stagingRoot,
        })
        await PackageInstallReceipt.rollback(priorOccurrenceID, "registry resolution changed during installation")
      }
      await fs.mkdir(path.dirname(finalRoot), { recursive: true })
      await fs.rename(stagingRoot, finalRoot)

      await PackageInstallReceipt.verifyAndPublish({
        occurrenceID,
        root: finalRoot,
        package: pkg,
        requestedVersion: version,
        resolvedVersion,
        moduleDirectory: finalModule,
      })
      return finalModule
    } catch (error) {
      await PackageInstallReceipt.rollback(occurrenceID, error instanceof Error ? error.message : String(error)).catch(
        () => undefined,
      )
      await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined)
      throw error
    }
  }
}
