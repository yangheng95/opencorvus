import { lstat, readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { workspaceTreeDigest, type WorkspaceTreeSnapshot } from "@opencorvus-ai/plugin"
import { ProjectRuntimePaths } from "@/project/runtime-paths"

async function treeSnapshot(
  root: string,
  include: (relativePath: string) => boolean,
): Promise<WorkspaceTreeSnapshot> {
  const files: WorkspaceTreeSnapshot["files"] = []
  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      const relative = path.relative(root, absolute).split(path.sep).join("/")
      if (!include(relative)) continue
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (!entry.isFile() || (await lstat(absolute)).isSymbolicLink()) {
        throw new Error(`Execution Capsule tree contains a non-regular entry: ${relative}`)
      }
      const bytes = await readFile(absolute)
      files.push({ path: relative, bytes_base64: bytes.toString("base64") })
    }
  }
  await walk(root)
  return {
    protocol: "opencorvus/workspace-tree@1",
    files: files.toSorted((left, right) => left.path === right.path ? 0 : left.path < right.path ? -1 : 1),
  }
}

export async function executionCapsuleTreeSnapshot(root: string): Promise<WorkspaceTreeSnapshot> {
  return treeSnapshot(root, () => true)
}

export async function executionCapsuleSourceTreeSnapshot(root: string): Promise<WorkspaceTreeSnapshot> {
  return treeSnapshot(root, ProjectRuntimePaths.isSourceEnumerationAllowed)
}

export async function executionCapsuleTreeDigest(root: string) {
  return workspaceTreeDigest(await executionCapsuleTreeSnapshot(root))
}

export async function executionCapsuleSourceTreeDigest(root: string) {
  return workspaceTreeDigest(await executionCapsuleSourceTreeSnapshot(root))
}
