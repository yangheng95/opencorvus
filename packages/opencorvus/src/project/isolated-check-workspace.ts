import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import { createReadStream, createWriteStream } from "node:fs"
import path from "node:path"
import { pipeline } from "node:stream/promises"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import {
  cachedRuntimeProcessOccurrenceObserver,
  currentRuntimeProcessOccurrence,
} from "@/runtime/process-occurrence"
import type { RuntimeProcessOccurrenceObserver } from "@/runtime/process-occurrence"
import { Project } from "@/project/project"

const CHECK_WORKSPACE_EXCLUDED_NAMES = new Set([
  ".git",
  ".opencorvus",
  ".opencorvus-worktrees",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  "dist",
  "dist-vite",
  "node_modules",
  "out",
])

export type IsolatedProjectCheckWorkspace = {
  root: string
  workspace: string
  dispose: () => Promise<void>
}

const cleanupOwners = new Map<string, Promise<void>>()
const ISOLATED_CLEANUP_TIMEOUT_MS = 5_000
const ISOLATED_OWNER_FILE = "owner.json"

type IsolatedWorkspaceOwner = {
  protocol: 1
  workspace_id: string
  owner_pid: number
  owner_process_instance_id: string
  runtime_occurrence_id: string
}

function parseWorkspaceOwner(value: unknown): IsolatedWorkspaceOwner | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const owner = value as Record<string, unknown>
  const keys = Object.keys(owner).sort()
  const expected = ["owner_pid", "owner_process_instance_id", "protocol", "runtime_occurrence_id", "workspace_id"]
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return undefined
  if (
    owner.protocol !== 1 ||
    !Number.isInteger(owner.owner_pid) ||
    Number(owner.owner_pid) <= 0 ||
    typeof owner.workspace_id !== "string" ||
    owner.workspace_id.length === 0 ||
    typeof owner.owner_process_instance_id !== "string" ||
    owner.owner_process_instance_id.length === 0 ||
    typeof owner.runtime_occurrence_id !== "string" ||
    owner.runtime_occurrence_id.length === 0
  ) {
    return undefined
  }
  return owner as IsolatedWorkspaceOwner
}

const removeIsolatedWorkspaceRoot = (root: string) => {
  const current = cleanupOwners.get(root)
  if (current) return current
  const cleanup = fs.rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  })
  cleanupOwners.set(root, cleanup)
  void cleanup.finally(() => cleanupOwners.delete(root)).catch(() => undefined)
  return cleanup
}

async function awaitIsolatedCleanup(root: string, cleanup: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      cleanup,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`isolated workspace cleanup did not settle within ${ISOLATED_CLEANUP_TIMEOUT_MS}ms: ${root}`),
            ),
          ISOLATED_CLEANUP_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function disposeIsolatedProjectCheckWorkspaceAfterFailure(
  isolated: IsolatedProjectCheckWorkspace,
  failure: unknown,
  operation: string,
): Promise<never> {
  try {
    await awaitIsolatedCleanup(isolated.root, isolated.dispose())
  } catch (cleanupError) {
    throw new AggregateError(
      [failure, cleanupError],
      `${operation}; isolated workspace cleanup also failed: ${isolated.root}`,
    )
  }
  throw failure
}

export async function createIsolatedProjectCheckWorkspace(input: {
  projectDir: string
  sourceCwd: string
  taskID?: string
  signal?: AbortSignal
}): Promise<IsolatedProjectCheckWorkspace> {
  input.signal?.throwIfAborted()
  const scratchParent = input.taskID
    ? ProjectRuntimePaths.acceptancePaths(input.projectDir, input.taskID).checkWorkspaces
    : ProjectRuntimePaths.tasklessAcceptancePaths(input.sourceCwd).checkWorkspaces
  await fs.mkdir(scratchParent, { recursive: true })
  input.signal?.throwIfAborted()
  const root = await fs.mkdtemp(path.join(scratchParent, `${randomUUID()}-`))
  const workspace = path.join(root, "workspace")
  try {
    const runtimeOwner = currentRuntimeProcessOccurrence()
    const owner: IsolatedWorkspaceOwner = {
      protocol: 1,
      workspace_id: path.basename(root),
      owner_pid: runtimeOwner.pid,
      owner_process_instance_id: runtimeOwner.processInstanceID,
      runtime_occurrence_id: runtimeOwner.occurrenceID,
    }
    await fs.writeFile(path.join(root, ISOLATED_OWNER_FILE), JSON.stringify(owner), { encoding: "utf8", flag: "wx" })
    await copyTreeIntoCheckWorkspace(
      path.resolve(input.sourceCwd),
      workspace,
      path.resolve(input.sourceCwd),
      new Set(),
      input.signal,
    )
  } catch (error) {
    let failure = error
    try {
      input.signal?.throwIfAborted()
    } catch (abortReason) {
      failure = abortReason
    }
    try {
      await awaitIsolatedCleanup(root, removeIsolatedWorkspaceRoot(root))
    } catch (cleanupError) {
      throw new AggregateError([failure, cleanupError], `isolated workspace initialization and cleanup failed: ${root}`)
    }
    throw failure
  }
  return {
    root,
    workspace,
    dispose: () => removeIsolatedWorkspaceRoot(root),
  }
}

export type IsolatedWorkspaceRecoveryResult = {
  inspected: number
  removed: number
  retainedCurrent: number
  retainedLive: number
  /** Unreconcilable workspaces that also could not be quarantined; left in place. */
  retainedUnknown: number
  /** Unreconcilable workspaces moved aside so they can never gate a startup again. */
  quarantined: number
  unreconciled: IsolatedWorkspaceArtifactUnknownError[]
}

export class IsolatedWorkspaceArtifactUnknownError extends Error {
  override readonly name = "IsolatedWorkspaceArtifactUnknownError"
  quarantineFailure: unknown

  constructor(
    readonly artifactPath: string,
    cause: unknown,
  ) {
    super(`Isolated check-workspace artifact cannot be reconciled: ${artifactPath}`, { cause })
  }
}

const WORKSPACE_QUARANTINE_DIRECTORY = ".quarantine"

async function listDirectories(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name))
}

async function projectCheckWorkspaceRoots(projectDir: string): Promise<string[]> {
  const runtimeRoot = ProjectRuntimePaths.projectRuntimeRoot(projectDir)
  const roots = [ProjectRuntimePaths.tasklessAcceptancePaths(projectDir).checkWorkspaces]
  for (const taskRoot of await listDirectories(path.join(runtimeRoot, "tasks"))) {
    roots.push(path.join(taskRoot, "acceptance", "check-workspaces"))
  }
  const candidates = await Promise.all(roots.map(listDirectories))
  return candidates.flat().filter((candidate) => path.basename(candidate) !== WORKSPACE_QUARANTINE_DIRECTORY)
}

async function quarantineWorkspaceArtifact(root: string): Promise<void> {
  const quarantineRoot = path.join(path.dirname(root), WORKSPACE_QUARANTINE_DIRECTORY)
  await fs.mkdir(quarantineRoot, { recursive: true })
  await fs.rename(root, path.join(quarantineRoot, `${path.basename(root)}-${Date.now()}`))
}

/** Remove only exact prior/dead workspace occurrences. Missing or malformed
 * owner facts are never upgraded to orphan proof: they are quarantined beside
 * their workspace root and reported, never allowed to gate startup. */
export async function recoverOrphanedIsolatedCheckWorkspaces(input: {
  currentOccurrenceID: string
  observeProcessOccurrence?: RuntimeProcessOccurrenceObserver
}): Promise<IsolatedWorkspaceRecoveryResult> {
  const result: IsolatedWorkspaceRecoveryResult = {
    inspected: 0,
    removed: 0,
    retainedCurrent: 0,
    retainedLive: 0,
    retainedUnknown: 0,
    quarantined: 0,
    unreconciled: [],
  }
  if (process.platform !== "win32") return result
  const observeProcessOccurrence =
    input.observeProcessOccurrence ?? cachedRuntimeProcessOccurrenceObserver()
  const quarantineUnknown = async (artifactPath: string, cause: unknown) => {
    const unknown = new IsolatedWorkspaceArtifactUnknownError(artifactPath, cause)
    result.unreconciled.push(unknown)
    try {
      await quarantineWorkspaceArtifact(artifactPath)
      result.quarantined += 1
    } catch (quarantineError) {
      unknown.quarantineFailure = quarantineError
      result.retainedUnknown += 1
    }
  }
  const projectDirectories = new Set<string>()
  for (const project of Project.list()) {
    projectDirectories.add(project.worktree)
    for (const sandbox of project.sandboxes) projectDirectories.add(sandbox)
  }
  for (const projectDir of [...projectDirectories].sort()) {
    let roots: string[]
    try {
      roots = await projectCheckWorkspaceRoots(projectDir)
    } catch (error) {
      result.retainedUnknown += 1
      result.unreconciled.push(new IsolatedWorkspaceArtifactUnknownError(projectDir, error))
      continue
    }
    for (const root of roots) {
      result.inspected += 1
      let owner: IsolatedWorkspaceOwner | undefined
      let ownerFailure: unknown
      try {
        owner = parseWorkspaceOwner(JSON.parse(await fs.readFile(path.join(root, ISOLATED_OWNER_FILE), "utf8")))
      } catch (error) {
        ownerFailure = error
      }
      if (!owner || owner.workspace_id !== path.basename(root)) {
        await quarantineUnknown(
          root,
          ownerFailure ?? new Error("owner.json is malformed, foreign, or identifies another workspace"),
        )
        continue
      }
      if (owner.runtime_occurrence_id === input.currentOccurrenceID) {
        result.retainedCurrent += 1
        continue
      }
      const observation = observeProcessOccurrence({
        pid: owner.owner_pid,
        processInstanceID: owner.owner_process_instance_id,
        occurrenceID: owner.runtime_occurrence_id,
      })
      if (observation !== "dead_or_reused") {
        result.retainedLive += 1
        continue
      }
      try {
        await awaitIsolatedCleanup(root, removeIsolatedWorkspaceRoot(root))
        result.removed += 1
      } catch (error) {
        result.retainedUnknown += 1
        result.unreconciled.push(new IsolatedWorkspaceArtifactUnknownError(root, error))
      }
    }
  }
  return result
}

export async function withIsolatedProjectCheckWorkspace<T>(
  input: {
    projectDir: string
    sourceCwd: string
    taskID?: string
  },
  fn: (workspace: string) => Promise<T>,
): Promise<T> {
  const isolated = await createIsolatedProjectCheckWorkspace(input)
  try {
    return await fn(isolated.workspace)
  } finally {
    await isolated.dispose()
  }
}

async function copyTreeIntoCheckWorkspace(
  source: string,
  destination: string,
  sourceRoot: string,
  activeDirectories: Set<string>,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted()
  if (!shouldCopyIntoCheckWorkspace(sourceRoot, source)) return
  const stat = await fs.lstat(source)
  signal?.throwIfAborted()
  if (stat.isSymbolicLink()) {
    const target = await fs.readlink(source)
    const resolvedTarget = path.resolve(path.dirname(source), target)
    if (!isInsideOrSamePath(sourceRoot, resolvedTarget)) {
      throw new Error(`isolated check workspace refuses symlink outside source root: ${source} -> ${target}`)
    }
    await copyTreeIntoCheckWorkspace(resolvedTarget, destination, sourceRoot, activeDirectories, signal)
    return
  }
  if (stat.isDirectory()) {
    const real = normalizePathKey(await fs.realpath(source))
    if (activeDirectories.has(real)) {
      throw new Error(`isolated check workspace refuses cyclic directory link: ${source}`)
    }
    activeDirectories.add(real)
    await fs.mkdir(destination, { recursive: true })
    try {
      const entries = await fs.readdir(source)
      for (const entry of entries) {
        await copyTreeIntoCheckWorkspace(
          path.join(source, entry),
          path.join(destination, entry),
          sourceRoot,
          activeDirectories,
          signal,
        )
      }
    } finally {
      activeDirectories.delete(real)
    }
    return
  }
  if (stat.isFile()) {
    await fs.mkdir(path.dirname(destination), { recursive: true })
    signal?.throwIfAborted()
    await pipeline(createReadStream(source), createWriteStream(destination, { flags: "wx" }), { signal })
  }
}

function shouldCopyIntoCheckWorkspace(sourceCwd: string, candidate: string) {
  if (!isInsideOrSamePath(sourceCwd, candidate)) return false
  const relative = path.relative(sourceCwd, candidate)
  if (!relative) return true
  return relative.split(path.sep).every((part) => !CHECK_WORKSPACE_EXCLUDED_NAMES.has(part))
}

function isInsideOrSamePath(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function normalizePathKey(value: string): string {
  const resolved = path.resolve(value)
  return process.platform === "win32" ? resolved.toLowerCase() : resolved
}
