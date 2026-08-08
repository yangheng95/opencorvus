import { lstat, readFile, readlink } from "node:fs/promises"
import path from "node:path"
import { workspaceTreeDigest, type WorkspaceTreeSnapshot } from "@opencorvus-ai/plugin"
import { EngineGitProcess } from "@/engine/git-process"
import { ProjectRuntimePaths } from "@/project/runtime-paths"

function sourcePaths(output: Buffer, root: string): string[] {
  if (output.length === 0) return []
  if (output.at(-1) !== 0) throw new Error(`Execution Capsule source enumeration for ${root} was not NUL-terminated`)
  return output
    .subarray(0, -1)
    .toString()
    .split("\0")
    .filter(ProjectRuntimePaths.isSourceEnumerationAllowed)
    .toSorted()
}

async function selectedTreeSnapshot(root: string, relativePaths: readonly string[]): Promise<WorkspaceTreeSnapshot> {
  const files: WorkspaceTreeSnapshot["files"] = []
  for (const relativePath of relativePaths) {
    const absolute = path.join(root, ...relativePath.split("/"))
    const stat = await lstat(absolute)
    if (stat.isSymbolicLink()) {
      const target = await readlink(absolute)
      files.push({ path: relativePath, bytes_base64: Buffer.from(target).toString("base64") })
      continue
    }
    if (!stat.isFile()) throw new Error(`Execution Capsule tree contains a non-regular entry: ${relativePath}`)
    const bytes = await readFile(absolute)
    files.push({ path: relativePath, bytes_base64: bytes.toString("base64") })
  }
  return {
    protocol: "opencorvus/workspace-tree@1",
    files,
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
