import { lstat, readFile, readlink } from "node:fs/promises"
import path from "node:path"
import { workspaceTreeDigest, type WorkspaceTreeSnapshot } from "@opencorvus-ai/plugin"
import { EngineGitProcess } from "@/engine/git-process"
import { ProjectRuntimePaths } from "@/project/runtime-paths"

function sourcePaths(output: Buffer, root: string): string[] {
  if (output.length === 0) return []
  if (output.at(-1) !== 0) throw new Error(`Execution Capsule source enumeration for ${root} was not NUL-terminated`)
  return output.subarray(0, -1).toString().split("\0").filter(ProjectRuntimePaths.isSourceEnumerationAllowed).toSorted()
}

function sameFilesystemPath(left: string, right: string): boolean {
  const resolvedLeft = path.resolve(left)
  const resolvedRight = path.resolve(right)
  return process.platform === "win32"
    ? resolvedLeft.toLocaleLowerCase("en-US") === resolvedRight.toLocaleLowerCase("en-US")
    : resolvedLeft === resolvedRight
}

async function selectedTreeSnapshot(
  root: string,
  relativePaths: readonly string[],
  prefix = "",
): Promise<WorkspaceTreeSnapshot> {
  const files: WorkspaceTreeSnapshot["files"] = []
  for (const relativePath of relativePaths) {
    const absolute = path.join(root, ...relativePath.split("/"))
    const stat = await lstat(absolute)
    const projectedPath = prefix ? `${prefix}/${relativePath}` : relativePath
    if (stat.isSymbolicLink()) {
      const target = await readlink(absolute)
      files.push({ path: projectedPath, bytes_base64: Buffer.from(target).toString("base64") })
      continue
    }
    if (stat.isDirectory()) {
      const topLevel = await EngineGitProcess.topLevel(absolute)
      if (topLevel.exitCode !== 0 || !sameFilesystemPath(topLevel.text().trim(), absolute)) continue
      const listed = await EngineGitProcess.sourceSnapshotPaths(absolute)
      if (listed.exitCode !== 0) {
        const detail = listed.stderr.toString().trim() || listed.stdout.toString().trim() || "git ls-files failed"
        throw new Error(`Execution Capsule nested source enumeration failed: ${detail}`)
      }
      const nested = await selectedTreeSnapshot(absolute, sourcePaths(listed.stdout, absolute), projectedPath)
      files.push(...nested.files)
      continue
    }
    if (!stat.isFile()) throw new Error(`Execution Capsule tree contains a non-regular entry: ${relativePath}`)
    const bytes = await readFile(absolute)
    files.push({ path: projectedPath, bytes_base64: bytes.toString("base64") })
  }
  return {
    protocol: "opencorvus/workspace-tree@1",
    files: files.toSorted((left, right) => left.path.localeCompare(right.path)),
  }
}

export async function executionCapsuleTreeSnapshot(root: string): Promise<WorkspaceTreeSnapshot> {
  const listed = await EngineGitProcess.sourceSnapshotPaths(root)
  if (listed.exitCode !== 0) {
    const detail = listed.stderr.toString().trim() || listed.stdout.toString().trim() || "git ls-files failed"
    throw new Error(`Execution Capsule source enumeration failed: ${detail}`)
  }
  return selectedTreeSnapshot(root, sourcePaths(listed.stdout, root))
}

export async function executionCapsuleSourceTreeSnapshot(root: string): Promise<WorkspaceTreeSnapshot> {
  return executionCapsuleTreeSnapshot(root)
}

export async function executionCapsuleTreeDigest(root: string) {
  return workspaceTreeDigest(await executionCapsuleTreeSnapshot(root))
}

export async function executionCapsuleSourceTreeDigest(root: string) {
  return workspaceTreeDigest(await executionCapsuleSourceTreeSnapshot(root))
}
