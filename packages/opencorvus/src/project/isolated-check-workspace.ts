import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { ProjectRuntimePaths } from "@/project/runtime-paths"

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

const removeIsolatedWorkspaceRoot = (root: string) =>
  fs.rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  })

export async function disposeIsolatedProjectCheckWorkspaceAfterFailure(
  isolated: IsolatedProjectCheckWorkspace,
  failure: unknown,
  operation: string,
): Promise<never> {
  try {
    await isolated.dispose()
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
}): Promise<IsolatedProjectCheckWorkspace> {
  const scratchParent = input.taskID
    ? ProjectRuntimePaths.acceptancePaths(input.projectDir, input.taskID).checkWorkspaces
    : ProjectRuntimePaths.tasklessAcceptancePaths(input.sourceCwd).checkWorkspaces
  await fs.mkdir(scratchParent, { recursive: true })
  const root = await fs.mkdtemp(path.join(scratchParent, `${randomUUID()}-`))
  const workspace = path.join(root, "workspace")
  try {
    await copyTreeIntoCheckWorkspace(path.resolve(input.sourceCwd), workspace, path.resolve(input.sourceCwd), new Set())
  } catch (error) {
    try {
      await removeIsolatedWorkspaceRoot(root)
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `isolated workspace initialization and cleanup failed: ${root}`,
      )
    }
    throw error
  }
  return {
    root,
    workspace,
    dispose: () => removeIsolatedWorkspaceRoot(root),
  }
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
): Promise<void> {
  if (!shouldCopyIntoCheckWorkspace(sourceRoot, source)) return
  const stat = await fs.lstat(source)
  if (stat.isSymbolicLink()) {
    const target = await fs.readlink(source)
    const resolvedTarget = path.resolve(path.dirname(source), target)
    if (!isInsideOrSamePath(sourceRoot, resolvedTarget)) {
      throw new Error(`isolated check workspace refuses symlink outside source root: ${source} -> ${target}`)
    }
    await copyTreeIntoCheckWorkspace(resolvedTarget, destination, sourceRoot, activeDirectories)
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
        await copyTreeIntoCheckWorkspace(path.join(source, entry), path.join(destination, entry), sourceRoot, activeDirectories)
      }
    } finally {
      activeDirectories.delete(real)
    }
    return
  }
  if (stat.isFile()) {
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(source, destination)
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
