import fs from "node:fs"
import fsPromises from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { manual, manualSync } from "rimraf"
import { resolveOpenCorvusRuntimePaths, type OpenCorvusRuntimePaths } from "./runtime-paths.js"

const OWNED_RUNTIME_DIRECTORIES: ReadonlyArray<keyof OpenCorvusRuntimePaths> = [
  "root",
  "bin",
  "cache",
  "config",
  "data",
  "log",
  "state",
  "temporary",
  "overlay",
  "overlayEmbedded",
  "overlayWebview",
]

function userHome() {
  const home = os.homedir() || process.env.HOME || process.env.USERPROFILE
  if (!home) throw new Error("OpenCorvus cannot resolve an absolute user home directory")
  return home
}

function temporaryPrefix(prefix: string) {
  const value = prefix.trim()
  if (!value || value !== path.basename(value) || value.includes("/") || value.includes("\\")) {
    throw new Error(`OpenCorvus temporary-directory prefix must be one path segment: ${prefix}`)
  }
  return value
}

export function currentOpenCorvusRuntimePaths(): OpenCorvusRuntimePaths {
  return resolveOpenCorvusRuntimePaths({
    env: process.env,
    platform: process.platform,
    home: userHome(),
  })
}

export async function initializeOpenCorvusRuntimeDirectories(paths = currentOpenCorvusRuntimePaths()) {
  await Promise.all(OWNED_RUNTIME_DIRECTORIES.map((key) => fsPromises.mkdir(paths[key], { recursive: true })))
  return paths
}

export async function createManagedTemporaryDirectory(owner: string, prefix: string) {
  const root = path.resolve(owner)
  await fsPromises.mkdir(root, { recursive: true })
  return fsPromises.mkdtemp(path.join(root, temporaryPrefix(prefix)))
}

export function createManagedTemporaryDirectorySync(owner: string, prefix: string) {
  const root = path.resolve(owner)
  fs.mkdirSync(root, { recursive: true })
  return fs.mkdtempSync(path.join(root, temporaryPrefix(prefix)))
}

export async function createOpenCorvusTemporaryDirectory(prefix: string) {
  return createManagedTemporaryDirectory(currentOpenCorvusRuntimePaths().temporary, prefix)
}

export function createOpenCorvusTemporaryDirectorySync(prefix: string) {
  return createManagedTemporaryDirectorySync(currentOpenCorvusRuntimePaths().temporary, prefix)
}

export async function removeManagedDirectoryTree(directory: string) {
  // Use the same portable walker on every host. Bun 1.3.14's native recursive
  // rm maps Windows delete-pending child handles to EFAULT (oven-sh/bun#39710).
  // Retrying/ignoring that error or switching to rmSync retains the faulty walk.
  const target = path.resolve(directory)
  const deadline = Date.now() + 5_000
  while (true) {
    try {
      await manual(target, { glob: false, preserveRoot: true })
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code
      // The portable walk exposes real Windows contention codes. Keep retries
      // bounded, as with fs.rm's documented retry contract; other errors surface.
      if (!code || !["EBUSY", "EPERM", "ENOTEMPTY"].includes(code) || Date.now() >= deadline) throw error
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
}

export function removeManagedDirectoryTreeSync(directory: string) {
  manualSync(path.resolve(directory), { glob: false, preserveRoot: true })
}
