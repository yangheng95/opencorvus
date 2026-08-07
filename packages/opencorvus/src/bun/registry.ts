import { semver } from "bun"
import { text } from "node:stream/consumers"
import { Process } from "../util/process"
import { BunExecutable } from "./executable"

export namespace PackageRegistry {
  export async function info(pkg: string, field: string, cwd?: string): Promise<string> {
    const result = Process.spawnHost([BunExecutable.resolve(), "info", pkg, field], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        BUN_BE_BUN: "1",
      },
    })

    const code = await result.exited
    const stdout = result.stdout ? await text(result.stdout) : ""
    const stderr = result.stderr ? await text(result.stderr) : ""

    if (code !== 0) {
      const detail = stderr.trim()
      throw new Error(
        detail
          ? `bun info failed for ${pkg} field ${field} with exit code ${code}: ${detail}`
          : `bun info failed for ${pkg} field ${field} with exit code ${code}`,
      )
    }

    const value = stdout.trim()
    if (!value) throw new Error(`bun info returned an empty ${field} value for ${pkg}`)
    return value
  }

  export async function isOutdated(pkg: string, cachedVersion: string, cwd?: string): Promise<boolean> {
    const latestVersion = await info(pkg, "version", cwd)
    const isRange = /[\s^~*xX<>|=]/.test(cachedVersion)
    if (isRange) return !semver.satisfies(latestVersion, cachedVersion)

    return semver.order(cachedVersion, latestVersion) === -1
  }
}
