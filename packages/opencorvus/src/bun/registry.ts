import { Process } from "../util/process"
import { BunExecutable } from "./executable"

export namespace PackageRegistry {
  export async function info(pkg: string, field: string, cwd?: string): Promise<string> {
    const result = await Process.spawnHost([BunExecutable.resolve(), "info", pkg, field], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        BUN_BE_BUN: "1",
      },
    })

    const code = await result.exited
    const stdout = await Process.readText(result.stdout)
    const stderr = await Process.readText(result.stderr)

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
}
