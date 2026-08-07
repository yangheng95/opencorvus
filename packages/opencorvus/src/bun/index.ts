import z from "zod"
import { Global } from "../global"
import { Log } from "../util/log"
import path from "node:path"
import { Filesystem } from "../util/filesystem"
import { NamedError } from "@opencorvus-ai/util/error"
import { text } from "node:stream/consumers"
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
    const result = Process.spawnHost([executable, ...cmd], {
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
    const stdout = result.stdout ? await text(result.stdout) : undefined
    const stderr = result.stderr ? await text(result.stderr) : undefined
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
    // Use lock to ensure only one install at a time
    using _ = await Lock.write("bun-install")

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

    if (!modExists || !cachedVersion) {
      // continue to install
    } else if (version !== "latest" && cachedVersion === version) {
      await installedVersion(cachedVersion)
      return mod
    } else if (version === "latest") {
      await installedVersion(cachedVersion)
      const isOutdated = await PackageRegistry.isOutdated(pkg, cachedVersion, Global.Path.cache)
      if (!isOutdated) return mod
      log.info("Cached version is outdated, proceeding with install", { pkg, cachedVersion })
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
    return mod
  }
}
