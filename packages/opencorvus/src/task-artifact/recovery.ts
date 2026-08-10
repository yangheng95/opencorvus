import { EngineArtifactEnvelopeSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import {
  EngineArtifactTable,
  EngineArtifactVersionTable,
  EngineTaskTable,
} from "@/engine/engine.sql"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { and, Database, eq, gt, sql } from "@/storage/db"
import { discardEngineArtifactResources, listTaskArtifactSnapshots, readTaskArtifactRef } from "@/task-artifact/store"
import { Filesystem } from "@/util/filesystem"

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
}

export type TaskArtifactBootstrapRecoveryReport =
  | Readonly<{
      status: "completed"
      removed: readonly string[]
    }>
  | Readonly<{
      status: "corrupt"
      error: Readonly<{
        name: string
        message: string
        cause: string | null
      }>
    }>

function describeRecoveryError(error: unknown): Extract<TaskArtifactBootstrapRecoveryReport, { status: "corrupt" }> {
  const normalized = error instanceof Error ? error : new Error(String(error))
  const directCause = normalized.cause
  return Object.freeze({
    status: "corrupt",
    error: Object.freeze({
      name: normalized.name,
      message: normalized.message,
      cause:
        directCause === undefined
          ? null
          : directCause instanceof Error
            ? `${directCause.name}: ${directCause.message}`
            : String(directCause),
    }),
  })
}

/**
 * Project initialization owns availability, not Artifact repair. Run the
 * strict retention primitive once and preserve any integrity failure as a
 * structured report. Exact Artifact/resource consumers still use the strict
 * store and receive the original verification error; this boundary never
 * retries, substitutes bytes, or starts a second cleanup path.
 */
export async function recoverTaskArtifactsDuringBootstrap(input: {
  projectID: string
  projectDirectory: string
}): Promise<TaskArtifactBootstrapRecoveryReport> {
  try {
    return Object.freeze({
      status: "completed",
      removed: await removeUnreferencedTaskArtifactRoots(input),
    })
  } catch (error) {
    return describeRecoveryError(error)
  }
}

/**
 * Recover filesystem publications that could only have been created before a
 * target Task transaction committed. A committed Task always has a durable DB
 * row; a missing row therefore proves its TaskArtifact root is unreachable.
 * Only the TaskArtifact subtree is removed—other runtime ownership remains
 * outside this protocol.
 */
export async function removeUnreferencedTaskArtifactRoots(input: {
  projectID: string
  projectDirectory: string
}): Promise<readonly string[]> {
  const activeTasks = Database.use((db) =>
    db
      .select({ id: EngineTaskTable.id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.project_id, input.projectID))
      .all(),
  )
  const activeTaskIDs = new Set(activeTasks.map((task) => task.id))
  const tasksRoot = ProjectRuntimePaths.taskCollectionRoot(input.projectDirectory)
  let taskEntries: import("node:fs").Dirent[]
  try {
    taskEntries = await fs.readdir(tasksRoot, { withFileTypes: true })
  } catch (cause) {
    if (missing(cause)) {
      taskEntries = []
    } else {
      throw cause
    }
  }
  const removed: string[] = []
  for (const entry of taskEntries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || activeTaskIDs.has(entry.name)) continue
    const target = path.join(tasksRoot, entry.name, "artifacts")
    let targetInfo
    try {
      targetInfo = await fs.lstat(target)
    } catch (cause) {
      if (missing(cause)) continue
      throw cause
    }
    if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink()) {
      throw new Error(`Unreferenced TaskArtifact recovery target is not a real directory: ${target}`)
    }
    await fs.rm(target, { recursive: true, force: false })
    removed.push(target)
  }

  for (const task of activeTasks) {
    const projectDirectory = taskPrimaryProjectRoot(task.id, { activeProjectID: input.projectID })
    if (
      Filesystem.normalizePath(path.resolve(projectDirectory)) !==
      Filesystem.normalizePath(path.resolve(input.projectDirectory))
    ) {
      continue
    }
    const envelopeRows = Database.transaction((db) => [
      ...db
        .select({
          id: EngineArtifactTable.id,
          revision: EngineArtifactTable.catalog_revision,
          rawPayload: sql<Uint8Array>`CAST(COALESCE(${EngineArtifactTable.payload}, 'null') AS BLOB)`,
          payloadSHA256: EngineArtifactTable.payload_sha256,
        })
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.task_id, task.id),
            gt(EngineArtifactTable.catalog_resource_count, 0),
          ),
        )
        .all(),
      ...db
        .select({
          id: EngineArtifactVersionTable.artifact_id,
          revision: EngineArtifactVersionTable.catalog_revision,
          rawPayload: sql<Uint8Array>`CAST(COALESCE(${EngineArtifactVersionTable.payload}, 'null') AS BLOB)`,
          payloadSHA256: EngineArtifactVersionTable.payload_sha256,
        })
        .from(EngineArtifactVersionTable)
        .where(
          and(
            eq(EngineArtifactVersionTable.task_id, task.id),
            gt(EngineArtifactVersionTable.catalog_resource_count, 0),
          ),
        )
        .all(),
    ])
    const authority = {
      projectID: input.projectID,
      projectDirectory,
      taskID: task.id,
    }
    const referencedSnapshots = new Map<string, string>()
    const referencedResources = new Map<
      string,
      {
        artifactID: string
        resource: Parameters<typeof readTaskArtifactRef>[0]["ref"]
      }
    >()
    for (const row of envelopeRows) {
      if (createHash("sha256").update(row.rawPayload).digest("hex") !== row.payloadSHA256) {
        throw new Error(
          `TaskArtifact recovery found corrupt Engine Artifact payload identity: ${row.id}@${row.revision}`,
        )
      }
      let decoded: unknown
      try {
        decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(row.rawPayload))
      } catch (cause) {
        throw new Error(
          `TaskArtifact recovery found invalid Engine Artifact envelope bytes: ${row.id}@${row.revision}`,
          { cause },
        )
      }
      const envelope = EngineArtifactEnvelopeSchema.parse(decoded)
      for (const resource of envelope.resources) {
        if (resource.snapshot.project_id !== input.projectID || resource.snapshot.task_id !== task.id) {
          throw new Error(
            `TaskArtifact recovery found a non-target-owned resource in Engine Artifact ${row.id}@${row.revision}`,
          )
        }
        const identity = JSON.stringify(resource.snapshot)
        const previous = referencedSnapshots.get(resource.snapshot.snapshot_id)
        if (previous && previous !== identity) {
          throw new Error(
            `TaskArtifact recovery found conflicting identities for snapshot ${resource.snapshot.snapshot_id}`,
          )
        }
        referencedSnapshots.set(resource.snapshot.snapshot_id, identity)
        referencedResources.set(JSON.stringify(resource), {
          artifactID: `${row.id}@${row.revision}`,
          resource,
        })
      }
    }
    for (const { artifactID, resource } of referencedResources.values()) {
      try {
        await readTaskArtifactRef({ ...authority, ref: resource })
      } catch (cause) {
        throw new Error(
          `TaskArtifact recovery found an invalid resource reference in Engine Artifact ${artifactID}: ${resource.tree}/${resource.path}`,
          { cause },
        )
      }
    }
    const records = await listTaskArtifactSnapshots(authority)
    const committedSnapshotIDs = new Set(records.map((record) => record.identity.snapshot_id))
    for (const [snapshotID] of referencedSnapshots) {
      if (!committedSnapshotIDs.has(snapshotID)) {
        throw new Error(`TaskArtifact recovery found a missing referenced snapshot: ${snapshotID}`)
      }
    }
    for (const record of records) {
      const referencedIdentity = referencedSnapshots.get(record.identity.snapshot_id)
      if (referencedIdentity && referencedIdentity !== JSON.stringify(record.identity)) {
        throw new Error(
          `TaskArtifact recovery found a stale referenced snapshot identity: ${record.identity.snapshot_id}`,
        )
      }
      if (record.manifest.snapshot_kind !== "engine_resource" || referencedIdentity) continue
      await discardEngineArtifactResources({ ...authority, snapshot: record.identity })
      removed.push(ProjectRuntimePaths.taskArtifactSnapshotRoot(projectDirectory, task.id, record.identity.snapshot_id))
    }
  }
  return Object.freeze(removed.sort((left, right) => Buffer.from(left).compare(Buffer.from(right))))
}
