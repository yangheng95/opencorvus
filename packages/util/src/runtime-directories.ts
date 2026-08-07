import fs from "node:fs"
import fsPromises from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { resolveOpenCorvusRuntimePaths, type OpenCorvusRuntimePaths } from "./runtime-paths"

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
  await fsPromises.rm(path.resolve(directory), { recursive: true, force: true, maxRetries: 10, retryDelay: 25 })
}

export function removeManagedDirectoryTreeSync(directory: string) {
  fs.rmSync(path.resolve(directory), { recursive: true, force: true, maxRetries: 10, retryDelay: 25 })
}
