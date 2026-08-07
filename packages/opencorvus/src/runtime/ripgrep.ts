import fs from "node:fs/promises"
import path from "node:path"
import { which } from "@/util/which"

export interface RipgrepRuntime {
  filepath: string
  packaged: boolean
}

export function ripgrepExecutableName(platform: NodeJS.Platform | string = process.platform): string {
  return platform === "win32" || platform.startsWith("windows") ? "rg.exe" : "rg"
}

export function packagedRipgrepRuntimePaths(
  input: {
    execPath?: string
    platform?: NodeJS.Platform | string
  } = {},
) {
  const execPath = input.execPath ?? process.execPath
  const platform = input.platform ?? process.platform
  return {
    executable: path.join(path.dirname(execPath), "bin", ripgrepExecutableName(platform)),
  }
}

export async function resolveRipgrepRuntime(
  input: {
    execPath?: string
    env?: NodeJS.ProcessEnv
    platform?: NodeJS.Platform | string
  } = {},
): Promise<RipgrepRuntime> {
  const execPath = input.execPath ?? process.execPath
  if (isBunExecutable(execPath)) {
    const source = which("rg", input.env)
    if (source && (await isFile(source))) return { filepath: source, packaged: false }
    throw new Error("Source ripgrep executable is missing. Install ripgrep in PATH before running source mode.")
  }

  const packaged = packagedRipgrepRuntimePaths(input)
  if (await isFile(packaged.executable)) {
    return { filepath: packaged.executable, packaged: true }
  }

  throw new Error(
    `Packaged ripgrep runtime is missing. Expected ${packaged.executable} beside the opencorvus executable.`,
  )
}

function isBunExecutable(execPath: string): boolean {
  const executable = path
    .basename(execPath)
    .toLowerCase()
    .replace(/\.exe$/, "")
  return executable === "bun"
}

async function isFile(file: string): Promise<boolean> {
  const stat = await fs.stat(file).catch(() => undefined)
  return stat?.isFile() === true
}
