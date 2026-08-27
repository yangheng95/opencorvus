import z from "zod"
import { Global } from "../global"
import { acquireProcessLock } from "../util/process-lock"
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
    // Use lock to ensure only one install at a time in this process...
    using _ = await Lock.write("bun-install")
    // ...and one across processes for the whole span from opening the
    // occurrence to publishing its receipt. The in-process mutex alone let a
    // second backend supersede the occurrence a first was installing under —
    // the occurrence ID is deterministic per revision — after which the first
    // committed its receipt into the second's occurrence while that install
    // was still rewriting the shared tree.
    await fs.mkdir(Global.Path.cache, { recursive: true })
    const releaseCacheOwner = await acquireProcessLock(Global.Path.cache, { realpath: false })
    try {
      return await installOwned(pkg, version)
    } finally {
      await releaseCacheOwner()
    }
  }

  async function installOwned(pkg: string, version: string) {
    const mod = path.join(Global.Path.cache, "node_modules", pkg)
    const pkgjsonPath = path.join(Global.Path.cache, "package.json")
    const packageSchema = z.object({ dependencies: z.record(z.string(), z.string()).optional() }).passthrough()
    const parsed = (await Filesystem.exists(pkgjsonPath))
      ? packageSchema.parse(await Filesystem.readJson(pkgjsonPath))
      : { dependencies: {} as Record<string, string> }
    if (!parsed.dependencies) parsed.dependencies = {} as Record<string, string>
    const dependencies = parsed.dependencies
    const modExists = await Filesystem.exists(mod)
    const cachedVersion = dependencies[pkg]

    async function installedVersion(expected?: string) {
      const installed = z
        .object({ version: z.string().min(1) })
        .passthrough()
        .parse(await Filesystem.readJson(path.join(mod, "package.json"))).version
      if (expected !== undefined && installed !== expected) {
        throw new Error(
          `Cached package version mismatch for ${pkg}: cache records ${expected}, installed package reports ${installed}`,
        )
      }
      return installed
    }

    // A cached tree is usable only when its completeness receipt exists. A
    // killed install leaves node_modules and a readable manifest behind, and
    // treating those as proof of installation is what made every later load
    // fail persistently against an incomplete tree instead of completing it.
    if (!modExists || !cachedVersion) {
      // continue to install
    } else if (version !== "latest" && cachedVersion === version) {
      await installedVersion(cachedVersion)
      if (await PackageInstallReceipt.isPublished({ root: Global.Path.cache, package: pkg, version: cachedVersion }))
        return mod
      log.info("cached package has no completeness receipt, reinstalling", { pkg, cachedVersion })
    } else if (version === "latest") {
      await installedVersion(cachedVersion)
      const published = await PackageInstallReceipt.isPublished({
        root: Global.Path.cache,
        package: pkg,
        version: cachedVersion,
      })
      const isOutdated = await PackageRegistry.isOutdated(pkg, cachedVersion, Global.Path.cache)
      if (published && !isOutdated) return mod
      log.info("proceeding with install", { pkg, cachedVersion, published, isOutdated })
    }

    // Build command arguments
    const args = [
      "add",
      "--force",
      "--exact",
      // Workaround for bun issue oven-sh/bun#19936: --no-cache required under proxy/CI.
      ...(proxied() || process.env.CI ? ["--no-cache"] : []),
      "--cwd",
      Global.Path.cache,
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
    const occurrenceID = await PackageInstallReceipt.begin({
      root: Global.Path.cache,
      package: pkg,
      requestedVersion: version,
    })
    try {
      await BunProc.run(args, {
        cwd: Global.Path.cache,
      }).catch((e) => {
        throw new InstallFailedError(
          { pkg, version },
          {
            cause: e,
          },
        )
      })

      // The installed package metadata, not the requested selector, owns the cached version.
      const resolvedVersion = await installedVersion()

      parsed.dependencies[pkg] = resolvedVersion
      await Filesystem.writeJson(pkgjsonPath, parsed)
      // Readiness is published only after the resolved tree verifies.
      await PackageInstallReceipt.verifyAndPublish({
        occurrenceID,
        root: Global.Path.cache,
        package: pkg,
        requestedVersion: version,
        resolvedVersion,
        moduleDirectory: mod,
      })
      return mod
    } catch (error) {
      await PackageInstallReceipt.rollback(occurrenceID, error instanceof Error ? error.message : String(error)).catch(
        () => undefined,
      )
      throw error
    }
  }
}
