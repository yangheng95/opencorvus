import fs from "node:fs/promises"
import path from "node:path"
import { isCompiledBinaryRuntime } from "./compiled-binary"

export function projectIndexExecutableName(platform: string = process.platform): string {
  return platform === "win32" || platform.startsWith("windows")
    ? "opencorvus-project-index.exe"
    : "opencorvus-project-index"
}

export function projectIndexSourceDirectory(): string {
  return path.resolve(import.meta.dir, "../../native/project-index")
}

export function sourceProjectIndexExecutable(platform: string = process.platform): string {
  return path.join(projectIndexSourceDirectory(), "target", "release", projectIndexExecutableName(platform))
}

export async function resolveProjectIndexRuntime(input: {
  execPath?: string
  platform?: string
  compiled?: boolean
} = {}): Promise<string> {
  const compiled = input.compiled ?? isCompiledBinaryRuntime()
  const platform = input.platform ?? process.platform
  const filename = compiled
    ? path.join(path.dirname(input.execPath ?? process.execPath), "bin", projectIndexExecutableName(platform))
    : sourceProjectIndexExecutable(platform)
  if ((await fs.stat(filename).catch(() => undefined))?.isFile()) return filename
  const hint = compiled ? "" : " Run bun run --cwd packages/opencorvus prepare:project-index first."
  throw new Error(`Project index runtime is missing at ${filename}.${hint}`)
}
