import fs from "node:fs/promises"
import path from "node:path"

export function nodeExecutableName(platform: NodeJS.Platform) {
  return platform === "win32" ? "node.exe" : "node"
}

export function nodeBinaryPackageName(platform: NodeJS.Platform, arch: NodeJS.Architecture) {
  const packageNames: Partial<Record<NodeJS.Platform, Partial<Record<NodeJS.Architecture, string>>>> = {
    win32: { x64: "node-win-x64" },
    linux: { x64: "node-linux-x64", arm64: "node-linux-arm64" },
    darwin: { x64: "node-darwin-x64", arm64: "node-bin-darwin-arm64" },
  }
  const packageName = packageNames[platform]?.[arch]
  if (!packageName) throw new Error(`Node sidecar runtime does not support ${platform}-${arch}.`)
  return packageName
}

export function isBunExecutable(execPath: string) {
  const executable = path
    .basename(execPath)
    .toLowerCase()
    .replace(/\.exe$/, "")
  return executable === "bun"
}

export function packagedNodeRuntimePaths(
  input: {
    execPath?: string
    platform?: NodeJS.Platform
    directoryName?: string
  } = {},
) {
  const execPath = input.execPath ?? process.execPath
  const platform = input.platform ?? process.platform
  const directory = path.join(path.dirname(execPath), input.directoryName ?? "browser-mcp-node")
  return {
    directory,
    nodeExecutable: path.join(directory, nodeExecutableName(platform)),
  }
}

export async function pathExists(file: string) {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false)
}
