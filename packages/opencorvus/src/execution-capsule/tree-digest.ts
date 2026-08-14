import { constants, type Dirent } from "node:fs"
import { lstat, open, readdir, readlink, realpath } from "node:fs/promises"
import path from "node:path"
import { workspaceTreeDigest, type WorkspaceTreeSnapshot } from "@opencorvus-ai/plugin"
import { NamedError } from "@opencorvus-ai/util/error"
import { EngineGitProcess } from "@/engine/git-process"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import z from "zod"

export const ExecutionCapsuleTreeInspectionConflictError = NamedError.create(
  "ExecutionCapsuleTreeInspectionConflictError",
  z
    .object({
      message: z.string(),
      path: z.string(),
      reason: z.enum([
        "root_identity_changed",
        "directory_identity_changed",
        "file_identity_changed",
        "symlink_identity_changed",
        "path_outside_root",
        "directory_entries_changed",
        "source_enumeration_changed",
      ]),
    })
    .strict(),
)

type StableStat = {
  dev: bigint
  ino: bigint
  mode: bigint
  size: bigint
  mtimeNs: bigint
  ctimeNs: bigint
  isDirectory(): boolean
  isFile(): boolean
  isSymbolicLink(): boolean
}

type StableRoot = {
  path: string
  real: string
  stat: StableStat
}

export type ExecutionCapsuleDirectoryEntryIdentity = {
  name: string
  type: "directory" | "file" | "symlink" | "other"
}

function sourcePaths(output: Buffer, root: string): string[] {
  if (output.length === 0) return []
  if (output.at(-1) !== 0) throw new Error(`Execution Capsule source enumeration for ${root} was not NUL-terminated`)
  return output.subarray(0, -1).toString().split("\0").filter(ProjectRuntimePaths.isSourceEnumerationAllowed).toSorted()
}

async function sameFilesystemPath(left: string, right: string): Promise<boolean> {
  try {
    const [resolvedLeft, resolvedRight] = await Promise.all([realpath(left), realpath(right)])
    return process.platform === "win32"
      ? resolvedLeft.toLocaleLowerCase("en-US") === resolvedRight.toLocaleLowerCase("en-US")
      : resolvedLeft === resolvedRight
  } catch {
    return false
  }
}

function canonicalPathOrder(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function inspectionConflict(
  pathname: string,
  reason: z.infer<typeof ExecutionCapsuleTreeInspectionConflictError.Schema>["data"]["reason"],
): never {
  throw new ExecutionCapsuleTreeInspectionConflictError({
    message: `Execution Capsule tree identity changed while reading ${pathname}.`,
    path: pathname,
    reason,
  })
}

function sameNodeIdentity(left: StableStat, right: StableStat): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode
}

function sameFileState(left: StableStat, right: StableStat): boolean {
  return (
    sameNodeIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  )
}

function sameDirectoryState(left: StableStat, right: StableStat): boolean {
  return (
    sameNodeIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  )
}

function directoryEntryIdentity(entry: Dirent): ExecutionCapsuleDirectoryEntryIdentity {
  return {
    name: entry.name,
    type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : entry.isSymbolicLink() ? "symlink" : "other",
  }
}

function canonicalDirectoryEntries(entries: readonly ExecutionCapsuleDirectoryEntryIdentity[]) {
  return entries.toSorted(
    (left, right) => canonicalPathOrder(left.name, right.name) || canonicalPathOrder(left.type, right.type),
  )
}

export function assertExecutionCapsuleDirectoryEntriesStable(
  pathname: string,
  before: readonly ExecutionCapsuleDirectoryEntryIdentity[],
  after: readonly ExecutionCapsuleDirectoryEntryIdentity[],
): void {
  if (JSON.stringify(canonicalDirectoryEntries(before)) !== JSON.stringify(canonicalDirectoryEntries(after))) {
    inspectionConflict(pathname, "directory_entries_changed")
  }
}

export function assertExecutionCapsuleSourceEnumerationStable(
  pathname: string,
  before: readonly string[],
  after: readonly string[],
): void {
  if (JSON.stringify(before) !== JSON.stringify(after)) inspectionConflict(pathname, "source_enumeration_changed")
}

function pathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
}

async function stableLstat(
  pathname: string,
  reason: "root_identity_changed" | "directory_identity_changed" | "file_identity_changed" | "symlink_identity_changed",
): Promise<StableStat> {
  try {
    return await lstat(pathname, { bigint: true })
  } catch {
    return inspectionConflict(pathname, reason)
  }
}

async function containedRealPath(root: StableRoot, pathname: string): Promise<string> {
  let resolved: string
  try {
    resolved = await realpath(pathname)
  } catch {
    return inspectionConflict(pathname, "path_outside_root")
  }
  if (!pathInside(root.real, resolved)) inspectionConflict(pathname, "path_outside_root")
  return resolved
}

async function captureStableRoot(root: string): Promise<StableRoot> {
  const before = await stableLstat(root, "root_identity_changed")
  if (!before.isDirectory() || before.isSymbolicLink()) inspectionConflict(root, "root_identity_changed")
  const resolved = await realpath(root).catch(() => inspectionConflict(root, "root_identity_changed"))
  const after = await stableLstat(root, "root_identity_changed")
  if (!after.isDirectory() || !sameNodeIdentity(before, after)) inspectionConflict(root, "root_identity_changed")
  return { path: root, real: resolved, stat: after }
}

async function assertRootStable(root: StableRoot): Promise<void> {
  const current = await stableLstat(root.path, "root_identity_changed")
  const resolved = await realpath(root.path).catch(() => inspectionConflict(root.path, "root_identity_changed"))
  if (!current.isDirectory() || !sameNodeIdentity(root.stat, current) || resolved !== root.real) {
    inspectionConflict(root.path, "root_identity_changed")
  }
}

async function captureDirectory(root: StableRoot, directory: string, expected?: StableStat) {
  const before = expected ?? (await stableLstat(directory, "directory_identity_changed"))
  if (!before.isDirectory() || before.isSymbolicLink()) inspectionConflict(directory, "directory_identity_changed")
  const resolved = await containedRealPath(root, directory)
  const after = await stableLstat(directory, "directory_identity_changed")
  if (!after.isDirectory() || !sameNodeIdentity(before, after)) {
    inspectionConflict(directory, "directory_identity_changed")
  }
  return { real: resolved, stat: after }
}

async function assertDirectoryStable(root: StableRoot, directory: string, expected: StableStat, expectedReal: string) {
  const current = await stableLstat(directory, "directory_identity_changed")
  const resolved = await containedRealPath(root, directory)
  if (!current.isDirectory() || !sameDirectoryState(expected, current) || resolved !== expectedReal) {
    inspectionConflict(directory, "directory_identity_changed")
  }
}

async function readStableFile(root: StableRoot, pathname: string, expected: StableStat): Promise<Buffer> {
  if (!expected.isFile() || expected.isSymbolicLink()) inspectionConflict(pathname, "file_identity_changed")
  const parent = await captureDirectory(root, path.dirname(pathname))
  await containedRealPath(root, pathname)
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0
  let handle
  try {
    handle = await open(pathname, constants.O_RDONLY | noFollow)
  } catch {
    return inspectionConflict(pathname, "file_identity_changed")
  }
  let bytes: Buffer
  let openedBefore: StableStat
  let openedAfter: StableStat
  try {
    openedBefore = await handle.stat({ bigint: true })
    if (!openedBefore.isFile() || !sameFileState(expected, openedBefore)) {
      inspectionConflict(pathname, "file_identity_changed")
    }
    bytes = await handle.readFile()
    openedAfter = await handle.stat({ bigint: true })
    if (!sameFileState(openedBefore, openedAfter)) inspectionConflict(pathname, "file_identity_changed")
  } finally {
    await handle.close()
  }
  const current = await stableLstat(pathname, "file_identity_changed")
  await containedRealPath(root, pathname)
  await assertDirectoryStable(root, path.dirname(pathname), parent.stat, parent.real)
  if (!current.isFile() || !sameFileState(openedAfter!, current)) {
    inspectionConflict(pathname, "file_identity_changed")
  }
  return bytes!
}

async function readStableSymlink(root: StableRoot, pathname: string, expected: StableStat): Promise<Buffer> {
  if (!expected.isSymbolicLink()) inspectionConflict(pathname, "symlink_identity_changed")
  const parent = await captureDirectory(root, path.dirname(pathname))
  let target: Buffer
  try {
    target = await readlink(pathname, { encoding: "buffer" })
  } catch {
    return inspectionConflict(pathname, "symlink_identity_changed")
  }
  const current = await stableLstat(pathname, "symlink_identity_changed")
  await assertDirectoryStable(root, path.dirname(pathname), parent.stat, parent.real)
  if (!current.isSymbolicLink() || !sameFileState(expected, current)) {
    inspectionConflict(pathname, "symlink_identity_changed")
  }
  return target
}

async function filesystemTreeSnapshot(root: string): Promise<WorkspaceTreeSnapshot> {
  const stableRoot = await captureStableRoot(root)
  const files: WorkspaceTreeSnapshot["files"] = []
  const walk = async (directory: string) => {
    const captured = await captureDirectory(stableRoot, directory)
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return inspectionConflict(directory, "directory_identity_changed")
    }
    entries.sort((left, right) => canonicalPathOrder(left.name, right.name))
    const initialEntries = entries.map(directoryEntryIdentity)
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      const relative = path.relative(root, absolute).split(path.sep).join("/")
      const current = await stableLstat(absolute, "file_identity_changed")
      if (entry.isDirectory() && !current.isDirectory()) {
        inspectionConflict(absolute, "directory_identity_changed")
      }
      if (entry.isFile() && !current.isFile()) inspectionConflict(absolute, "file_identity_changed")
      if (current.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (!current.isFile() || current.isSymbolicLink()) {
        throw new Error(`Execution Capsule tree contains a non-regular entry: ${relative}`)
      }
      const bytes = await readStableFile(stableRoot, absolute, current)
      files.push({ path: relative, bytes_base64: bytes.toString("base64") })
    }
    let finalEntries
    try {
      finalEntries = await readdir(directory, { withFileTypes: true })
    } catch {
      return inspectionConflict(directory, "directory_identity_changed")
    }
    assertExecutionCapsuleDirectoryEntriesStable(directory, initialEntries, finalEntries.map(directoryEntryIdentity))
    await assertDirectoryStable(stableRoot, directory, captured.stat, captured.real)
  }
  await walk(root)
  await assertRootStable(stableRoot)
  return {
    protocol: "opencorvus/workspace-tree@1",
    files: files.toSorted((left, right) => canonicalPathOrder(left.path, right.path)),
  }
}

async function selectedTreeSnapshot(
  root: string,
  relativePaths: readonly string[],
  prefix = "",
): Promise<WorkspaceTreeSnapshot> {
  const stableRoot = await captureStableRoot(root)
  const files: WorkspaceTreeSnapshot["files"] = []
  for (const relativePath of relativePaths) {
    const absolute = path.join(root, ...relativePath.split("/"))
    if (!pathInside(path.resolve(root), path.resolve(absolute))) inspectionConflict(absolute, "path_outside_root")
    const stat = await stableLstat(absolute, "file_identity_changed")
    const projectedPath = prefix ? `${prefix}/${relativePath}` : relativePath
    if (stat.isSymbolicLink()) {
      const target = await readStableSymlink(stableRoot, absolute, stat)
      files.push({ path: projectedPath, bytes_base64: target.toString("base64") })
      continue
    }
    if (stat.isDirectory()) {
      const captured = await captureDirectory(stableRoot, absolute, stat)
      const topLevel = await EngineGitProcess.topLevel(absolute)
      if (topLevel.exitCode !== 0 || !(await sameFilesystemPath(topLevel.text().trim(), absolute))) {
        await assertDirectoryStable(stableRoot, absolute, captured.stat, captured.real)
        continue
      }
      const listed = await EngineGitProcess.sourceSnapshotPaths(absolute)
      if (listed.exitCode !== 0) {
        await assertDirectoryStable(stableRoot, absolute, captured.stat, captured.real)
        const detail = listed.stderr.toString().trim() || listed.stdout.toString().trim() || "git ls-files failed"
        throw new Error(`Execution Capsule nested source enumeration failed: ${detail}`)
      }
      const initialSourcePaths = sourcePaths(listed.stdout, absolute)
      const nested = await selectedTreeSnapshot(absolute, initialSourcePaths, projectedPath)
      const finalTopLevel = await EngineGitProcess.topLevel(absolute)
      const finalListed = await EngineGitProcess.sourceSnapshotPaths(absolute)
      if (
        finalTopLevel.exitCode !== 0 ||
        !(await sameFilesystemPath(finalTopLevel.text().trim(), absolute)) ||
        finalListed.exitCode !== 0
      ) {
        inspectionConflict(absolute, "source_enumeration_changed")
      }
      assertExecutionCapsuleSourceEnumerationStable(
        absolute,
        initialSourcePaths,
        sourcePaths(finalListed.stdout, absolute),
      )
      await assertDirectoryStable(stableRoot, absolute, captured.stat, captured.real)
      files.push(...nested.files)
      continue
    }
    if (!stat.isFile()) throw new Error(`Execution Capsule tree contains a non-regular entry: ${relativePath}`)
    const bytes = await readStableFile(stableRoot, absolute, stat)
    files.push({ path: projectedPath, bytes_base64: bytes.toString("base64") })
  }
  await assertRootStable(stableRoot)
  return {
    protocol: "opencorvus/workspace-tree@1",
    files: files.toSorted((left, right) => canonicalPathOrder(left.path, right.path)),
  }
}

export async function executionCapsuleTreeSnapshot(root: string): Promise<WorkspaceTreeSnapshot> {
  return filesystemTreeSnapshot(root)
}

export async function executionCapsuleSourceTreeSnapshot(root: string): Promise<WorkspaceTreeSnapshot> {
  const stableRoot = await captureStableRoot(root)
  const listed = await EngineGitProcess.sourceSnapshotPaths(root)
  await assertRootStable(stableRoot)
  if (listed.exitCode !== 0) {
    const detail = listed.stderr.toString().trim() || listed.stdout.toString().trim() || "git ls-files failed"
    throw new Error(`Execution Capsule source enumeration failed: ${detail}`)
  }
  const initialSourcePaths = sourcePaths(listed.stdout, root)
  const snapshot = await selectedTreeSnapshot(root, initialSourcePaths)
  const finalListed = await EngineGitProcess.sourceSnapshotPaths(root)
  await assertRootStable(stableRoot)
  if (finalListed.exitCode !== 0) inspectionConflict(root, "source_enumeration_changed")
  assertExecutionCapsuleSourceEnumerationStable(root, initialSourcePaths, sourcePaths(finalListed.stdout, root))
  return snapshot
}

export async function executionCapsuleTreeDigest(root: string) {
  return workspaceTreeDigest(await executionCapsuleTreeSnapshot(root))
}

export async function executionCapsuleSourceTreeDigest(root: string) {
  return workspaceTreeDigest(await executionCapsuleSourceTreeSnapshot(root))
}
