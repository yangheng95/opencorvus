import fs from "node:fs/promises"
import path from "node:path"
import {
  TaskArtifactSnapshotLocatorSchema,
  TaskArtifactSnapshotManifestSchema,
  TaskArtifactRefSchema,
  compareTaskArtifactPathsByUTF8,
  sameTaskArtifactSnapshotIdentity,
  type TaskArtifactSnapshotIdentity,
  type TaskArtifactSnapshotManifest,
  type TaskArtifactRef,
  type TaskArtifactPublicationFile,
} from "@opencorvus-ai/plugin"

export const FRONTEND_REPLICA_SOURCE_CONTEXT_TREE = "source-context"
export const FRONTEND_REPLICA_SOURCE_CONTEXT_MANIFEST = "web-clone-source-manifest.json"
export const FRONTEND_REPLICA_REFERENCE_IMAGE = "reference.png"

export const FrontendReplicaSourceContextLocatorSchema = TaskArtifactSnapshotLocatorSchema

export type FrontendReplicaSourceContextSnapshot = Readonly<{
  manifest: TaskArtifactSnapshotManifest
  sourceContextManifest: TaskArtifactRef
  referenceImage: TaskArtifactRef
  resources: readonly TaskArtifactRef[]
}>

/**
 * Resolve the Frontend Replica files from the generic immutable snapshot
 * manifest. The manifest, rather than a producer-composed handoff object, is
 * the complete inventory and digest authority.
 */
export function resolveFrontendReplicaSourceContextSnapshot(input: {
  snapshot: TaskArtifactSnapshotIdentity
  manifest: unknown
}): FrontendReplicaSourceContextSnapshot {
  const manifest = TaskArtifactSnapshotManifestSchema.parse(input.manifest)
  if (!sameTaskArtifactSnapshotIdentity(input.snapshot, snapshotIdentity(manifest, input.snapshot.manifest_sha256))) {
    throw new Error("Frontend Replica source-context snapshot manifest does not match the exact locator")
  }
  if (manifest.snapshot_kind !== "catalog") {
    throw new Error(
      `Frontend Replica source-context requires snapshot_kind=catalog, found ${manifest.snapshot_kind}`,
    )
  }
  const treeNames = Object.keys(manifest.trees)
  if (
    treeNames.length !== 1 ||
    treeNames[0] !== FRONTEND_REPLICA_SOURCE_CONTEXT_TREE
  ) {
    throw new Error(
      `Frontend Replica source-context snapshot requires only the canonical ${FRONTEND_REPLICA_SOURCE_CONTEXT_TREE} tree`,
    )
  }
  const resources = manifest.trees[FRONTEND_REPLICA_SOURCE_CONTEXT_TREE]!.files.map((file) =>
    TaskArtifactRefSchema.parse({
      snapshot: input.snapshot,
      tree: FRONTEND_REPLICA_SOURCE_CONTEXT_TREE,
      ...file,
    }),
  )
  const sourceContextManifest = resources.find(
    (resource) =>
      resource.path === FRONTEND_REPLICA_SOURCE_CONTEXT_MANIFEST &&
      resource.media_type === "application/json",
  )
  if (!sourceContextManifest) {
    throw new Error(
      `Frontend Replica source-context snapshot is missing canonical ${FRONTEND_REPLICA_SOURCE_CONTEXT_MANIFEST}`,
    )
  }
  const referenceImage = resources.find(
    (resource) =>
      resource.path === FRONTEND_REPLICA_REFERENCE_IMAGE &&
      resource.media_type === "image/png",
  )
  if (!referenceImage) {
    throw new Error(
      `Frontend Replica source-context snapshot is missing canonical ${FRONTEND_REPLICA_REFERENCE_IMAGE}`,
    )
  }
  return Object.freeze({
    manifest,
    sourceContextManifest,
    referenceImage,
    resources: Object.freeze(resources),
  })
}

function snapshotIdentity(
  manifest: TaskArtifactSnapshotManifest,
  manifestSHA256: string,
): TaskArtifactSnapshotIdentity {
  return {
    schema_version: manifest.schema_version,
    project_id: manifest.project_id,
    task_id: manifest.task_id,
    snapshot_id: manifest.snapshot_id,
    manifest_sha256: manifestSHA256,
  }
}

export async function sourceContextPublicationFiles(root: string): Promise<TaskArtifactPublicationFile[]> {
  const files: TaskArtifactPublicationFile[] = []
  await visit(root, "", files)
  return files.sort((left, right) => compareTaskArtifactPathsByUTF8(left.path, right.path))
}

async function visit(root: string, relativeDirectory: string, files: TaskArtifactPublicationFile[]): Promise<void> {
  const directory = path.join(root, ...relativeDirectory.split("/").filter(Boolean))
  const entries = (await fs.readdir(directory, { withFileTypes: true })).sort((left, right) =>
    compareTaskArtifactPathsByUTF8(left.name, right.name),
  )
  for (const entry of entries) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      await visit(root, relativePath, files)
      continue
    }
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`Frontend Replica source context contains a non-regular entry: ${relativePath}`)
    }
    files.push({
      tree: FRONTEND_REPLICA_SOURCE_CONTEXT_TREE,
      path: relativePath,
      media_type: sourceContextMediaType(relativePath),
    })
  }
}

function sourceContextMediaType(relativePath: string): string {
  const extension = path.posix.extname(relativePath).toLowerCase()
  const mediaTypes: Readonly<Record<string, string>> = {
    ".avif": "image/avif",
    ".bin": "application/octet-stream",
    ".bmp": "image/bmp",
    ".css": "text/css",
    ".gif": "image/gif",
    ".html": "text/html",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".json": "application/json",
    ".md": "text/markdown",
    ".otf": "font/otf",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".txt": "text/plain",
    ".wasm": "application/wasm",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  }
  const mediaType = mediaTypes[extension]
  if (!mediaType) throw new Error(`Frontend Replica source context has an unsupported file type: ${relativePath}`)
  return mediaType
}
