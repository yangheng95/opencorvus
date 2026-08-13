import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  ExpertSquadPackageRevisionSchema,
  ExpertSquadPackageCommitSubtreeSchema,
  MaterializedExpertSquadPackageSchema,
  PreparedExpertSquadCandidateSchema,
  TaskArtifactResourceSetLocatorSchema,
  ValidatedExpertSquadPackageSchema,
  type ExpertSquadPackageHost,
  type TaskArtifactHost,
} from "@opencorvus-ai/plugin"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { assertMergedPrimaryCommitToolAuthority } from "@/build/merge-back-publication-authority"
import { publishTaskArtifactGitCommitSubtree } from "@/task-artifact/store"
import type { TaskToolExecutionScope } from "@/tool/task-tool-execution-scope"

type PackageFile = {
  path: string
  bytes: Uint8Array
  sha256: string
  utf8Text: boolean
}

async function packageFiles(root: string): Promise<PackageFile[]> {
  const files: PackageFile[] = []
  const decoder = new TextDecoder("utf-8", { fatal: true })
  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (!entry.isFile()) throw new Error(`Expert Squad package contains a non-regular entry: ${absolute}`)
      const bytes = await readFile(absolute)
      let utf8Text = false
      try {
        utf8Text = !decoder.decode(bytes).includes("\u0000")
      } catch {
        utf8Text = false
      }
      files.push({
        path: path.relative(root, absolute).split(path.sep).join("/"),
        bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        utf8Text,
      })
    }
  }
  await walk(root)
  return files
}

export function createExpertSquadPackageHost(
  taskArtifacts: TaskArtifactHost,
  scope?: TaskToolExecutionScope,
): ExpertSquadPackageHost {
  async function validateResourceSet(input: { resource_set: unknown }) {
    const resourceSet = TaskArtifactResourceSetLocatorSchema.parse(input.resource_set)
    const materialized = await taskArtifacts.materialize({ snapshot: resourceSet.snapshot, tree: resourceSet.tree })
    const loaded = await ExpertSquadRegistry.loadSourcePackage(materialized.directory)
    const files = await packageFiles(materialized.directory)
    return ValidatedExpertSquadPackageSchema.parse({
      resource_set: resourceSet,
      package_digest: loaded.packageDigest,
      namespace: loaded.namespace,
      id: loaded.id,
      version: loaded.manifest.version,
      manifest: loaded.manifest,
      skill_closures: [...loaded.packageSkills.values()]
        .map((skill) => ({
          source: skill.snapshot.source,
          files: skill.snapshot.files.map((file) => file.path),
        }))
        .sort((left, right) => (left.source < right.source ? -1 : left.source > right.source ? 1 : 0)),
      files: files.map((file) => ({
        path: file.path,
        sha256: file.sha256,
        bytes: file.bytes.byteLength,
        utf8_text: file.utf8Text,
      })),
    })
  }

  async function prepareCandidateWorkspace(input: {
    loaded: Awaited<ReturnType<typeof ExpertSquadRegistry.loadPackageRevisionSnapshot>>
    files: PackageFile[]
  }): Promise<string> {
    if (!scope) throw new Error("Expert Squad candidate preparation requires a Task tool execution scope")
    if (scope.owner.kind !== "projected-worker") {
      throw new Error("Expert Squad candidate preparation requires a projected worker execution scope")
    }
    const executionDirectory = scope.executionDirectory?.trim()
    if (!executionDirectory) {
      throw new Error("Expert Squad candidate preparation requires the persisted worker execution directory")
    }
    const canonicalExecutionDirectory = path.resolve(executionDirectory)
    const canonicalTaskRuntimeDirectory = path.resolve(scope.taskRuntimeDirectory)
    const executionRelativeToTask = path.relative(canonicalTaskRuntimeDirectory, canonicalExecutionDirectory)
    if (
      !executionRelativeToTask ||
      executionRelativeToTask.startsWith(`..${path.sep}`) ||
      path.isAbsolute(executionRelativeToTask)
    ) {
      throw new Error("Expert Squad candidate preparation requires a Task-owned managed worker worktree")
    }
    const packageRoot = [
      "expert-squad-evolution-candidates",
      scope.taskID,
      input.loaded.namespace,
      input.loaded.id,
    ].join("/")
    const destination = path.resolve(canonicalExecutionDirectory, ...packageRoot.split("/"))
    const relative = path.relative(canonicalExecutionDirectory, destination)
    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("Expert Squad candidate workspace escaped the managed worker worktree")
    }

    const existing = await stat(destination).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (existing) {
      if (!existing.isDirectory()) throw new Error(`Expert Squad candidate workspace is not a directory: ${packageRoot}`)
      const loaded = await ExpertSquadRegistry.loadSourcePackage(destination)
      if (loaded.packageDigest !== input.loaded.packageDigest) {
        throw new Error(`Expert Squad candidate workspace already diverged from its frozen parent: ${packageRoot}`)
      }
      return packageRoot
    }

    const parent = path.dirname(destination)
    await mkdir(parent, { recursive: true })
    const staging = await mkdtemp(path.join(parent, ".candidate-"))
    try {
      for (const file of input.files) {
        const target = path.join(staging, ...file.path.split("/"))
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, file.bytes, { flag: "wx" })
      }
      const staged = await ExpertSquadRegistry.loadSourcePackage(staging)
      if (staged.packageDigest !== input.loaded.packageDigest) {
        throw new Error(`Prepared Expert Squad candidate digest mismatch: ${staged.packageDigest}`)
      }
      await rename(staging, destination)
    } finally {
      await rm(staging, { recursive: true, force: true })
    }
    return packageRoot
  }

  return Object.freeze({
    async prepareCandidate(input) {
      const revision = ExpertSquadPackageRevisionSchema.parse(input.revision)
      const loaded = await ExpertSquadRegistry.loadPackageRevisionSnapshot(revision.package_digest)
      const files = await packageFiles(loaded.root)
      const stage = await taskArtifacts.stage({ trees: ["package"] })
      const treeDirectory = stage.treeDirectories.package!
      for (const file of files) {
        const destination = path.join(treeDirectory, ...file.path.split("/"))
        await mkdir(path.dirname(destination), { recursive: true })
        await writeFile(destination, file.bytes, { flag: "wx" })
      }
      const publication = await taskArtifacts.publish(stage, {
        snapshot_kind: "catalog",
        files: files.map((file) => ({
          tree: "package",
          path: file.path,
          media_type: file.utf8Text ? "text/plain" : "application/octet-stream",
        })),
      })
      const resourceSet = TaskArtifactResourceSetLocatorSchema.parse({
        snapshot: publication.snapshot,
        tree: "package",
      })
      const validated = await validateResourceSet({ resource_set: resourceSet })
      if (validated.package_digest !== revision.package_digest) {
        throw new Error(`Materialized Expert Squad package digest mismatch: ${validated.package_digest}`)
      }
      const packageRoot = await prepareCandidateWorkspace({ loaded, files })
      return PreparedExpertSquadCandidateSchema.parse({
        resource_set: resourceSet,
        package_digest: validated.package_digest,
        namespace: validated.namespace,
        id: validated.id,
        version: validated.version,
        package_root: packageRoot,
      })
    },
    async publishCommitSubtree(input) {
      if (!scope) throw new Error("Expert Squad package commit publication requires a Task tool execution scope")
      const request = ExpertSquadPackageCommitSubtreeSchema.parse(input)
      await assertMergedPrimaryCommitToolAuthority({
        scope,
        claimedSourceCommit: request.source_commit,
      })
      const published = await publishTaskArtifactGitCommitSubtree({
        scope,
        sourceCommit: request.source_commit,
        sourceRoot: request.package_root,
      })
      const validated = await validateResourceSet({ resource_set: published.resourceSet })
      return MaterializedExpertSquadPackageSchema.parse({
        resource_set: published.resourceSet,
        package_digest: validated.package_digest,
        namespace: validated.namespace,
        id: validated.id,
        version: validated.version,
      })
    },
    validateResourceSet,
  })
}
