import fs from "node:fs/promises"
import type { Dirent } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Global } from "@/global"
import { Database, eq } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"
import { ProjectTable } from "./project.sql"
import { ImplicitProject } from "./implicit-project"
import { ProjectRuntimePaths } from "./runtime-paths"
import { RuntimeServerOwnership } from "@/server/runtime-server-ownership"

const CleanupTarget = z.object({
  source: z.string().min(1),
  quarantine: z.string().min(1),
})

const CleanupManifest = z.object({
  format: z.literal("opencorvus.project-deletion-cleanup.v3"),
  operationID: z.string().uuid(),
  databaseInstanceID: z.string().uuid(),
  projectID: z.string().min(1),
  projectGeneration: z.string().uuid(),
  directory: z.string().min(1),
  targets: z.array(CleanupTarget).min(1),
  timeCreated: z.number().int().nonnegative(),
})

export type ProjectDeletionCleanupManifest = z.infer<typeof CleanupManifest>
export type ProjectDeletionCleanupPlan = {
  manifest: ProjectDeletionCleanupManifest
  manifestPath: string
}

export const ProjectDeletionCleanupDatabaseMismatchError = NamedError.create(
  "ProjectDeletionCleanupDatabaseMismatchError",
  z.object({
    operationID: z.string().uuid(),
    projectID: z.string(),
    manifestDatabaseInstanceID: z.string().uuid(),
    currentDatabaseInstanceID: z.string().uuid(),
    manifestPath: z.string(),
    message: z.string(),
  }),
)

function cleanupRoot(): string {
  return path.join(Global.Path.data, "maintenance", "project-deletion-cleanup", "active")
}

function completedCleanupBaseRoot(): string {
  return path.join(Global.Path.data, "maintenance", "project-deletion-cleanup", "completed")
}

function completedCleanupRoot(databaseInstanceID = Database.Identity()): string {
  return path.join(completedCleanupBaseRoot(), databaseInstanceID)
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => {
    const resolved = path.resolve(value)
    return process.platform === "win32" ? resolved.toLowerCase() : resolved
  }
  return normalize(left) === normalize(right)
}

function validateTarget(
  manifest: ProjectDeletionCleanupManifest,
  target: z.infer<typeof CleanupTarget>,
  index: number,
): void {
  const source = path.resolve(target.source)
  const directory = path.resolve(manifest.directory)
  if (!path.isAbsolute(manifest.directory) || !samePath(manifest.directory, directory)) {
    throw new Error(`Project deletion cleanup directory is not canonical: ${manifest.directory}`)
  }
  const expectedSource = ImplicitProject.isAnonymousDirectory(directory)
    ? directory
    : ProjectRuntimePaths.projectConfigRoot(directory)
  if (!path.isAbsolute(target.source) || !samePath(source, expectedSource)) {
    throw new Error(`Project deletion cleanup source is outside the exact Project-owned root: ${target.source}`)
  }
  const expected = `${source}.deleting-${manifest.operationID}-${index}`
  if (!samePath(target.quarantine, expected)) {
    throw new Error(`Project deletion cleanup target is not the exact quarantine for ${source}`)
  }
}

function parseManifest(
  value: unknown,
  manifestPath: string,
  state: "active" | "completed",
): ProjectDeletionCleanupManifest {
  const manifest = CleanupManifest.parse(value)
  if (manifest.targets.length !== 1) throw new Error("Project deletion cleanup must own exactly one root")
  manifest.targets.forEach((target, index) => validateTarget(manifest, target, index))
  const root = state === "active" ? cleanupRoot() : completedCleanupRoot(manifest.databaseInstanceID)
  if (!samePath(manifestPath, path.join(root, `${manifest.operationID}.json`))) {
    throw new Error(`Project deletion cleanup manifest path does not match operation ${manifest.operationID}`)
  }
  return manifest
}

async function pathState(target: string): Promise<"present" | "absent"> {
  try {
    await fs.lstat(target)
    return "present"
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return "absent"
    throw error
  }
}

export async function createProjectDeletionCleanupPlan(input: {
  projectID: string
  directory: string
  sources: string[]
}): Promise<ProjectDeletionCleanupPlan> {
  if (input.sources.length !== 1) throw new Error("Project deletion cleanup must own exactly one root")
  const authority = Database.use((db) =>
    db
      .select({ generation: ProjectTable.generation })
      .from(ProjectTable)
      .where(eq(ProjectTable.id, input.projectID))
      .get(),
  )
  if (!authority) throw new Error(`Cannot create deletion cleanup authority for missing Project ${input.projectID}`)
  if (!authority.generation) throw new Error(`Project ${input.projectID} has no durable generation`)
  const operationID = randomUUID()
  const targets = input.sources.map((source, index) => ({
    source: path.resolve(source),
    quarantine: `${path.resolve(source)}.deleting-${operationID}-${index}`,
  }))
  const manifest = CleanupManifest.parse({
    format: "opencorvus.project-deletion-cleanup.v3",
    operationID,
    databaseInstanceID: Database.Identity(),
    projectID: input.projectID,
    projectGeneration: authority.generation,
    directory: path.resolve(input.directory),
    targets,
    timeCreated: Date.now(),
  })
  manifest.targets.forEach((target, index) => validateTarget(manifest, target, index))
  const manifestPath = path.join(cleanupRoot(), `${operationID}.json`)
  await Filesystem.writeDurableAtomicIfAbsent(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 0o600).then(
    (created) => {
      if (!created) throw new Error(`Project deletion cleanup operation already exists: ${operationID}`)
    },
  )
  return { manifest, manifestPath }
}

export async function removeProjectDeletionCleanupPlan(plan: ProjectDeletionCleanupPlan): Promise<void> {
  await fs.rm(plan.manifestPath, { force: true })
  await Filesystem.syncDirectoryMetadata(path.dirname(plan.manifestPath))
}

export async function cleanupCommittedProjectDeletion(
  plan: ProjectDeletionCleanupPlan,
): Promise<Array<{ path: string; message: string }>> {
  const residue: Array<{ path: string; message: string }> = []
  for (const target of plan.manifest.targets) {
    try {
      await fs.rm(target.quarantine, { recursive: true, force: true })
      const parent = path.dirname(target.quarantine)
      try {
        await Filesystem.syncDirectoryMetadata(parent)
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
        if ((code !== "ENOENT" && code !== "ENOTDIR") || (await pathState(target.quarantine)) !== "absent") {
          throw error
        }
      }
    } catch (error) {
      residue.push({
        path: target.quarantine,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  if (residue.length > 0) return residue
  const completedRoot = completedCleanupRoot(plan.manifest.databaseInstanceID)
  const completedPath = path.join(completedRoot, path.basename(plan.manifestPath))
  if (!samePath(plan.manifestPath, completedPath))
    try {
      await Filesystem.mkdirDurable(completedRoot)
      await Filesystem.renameDurableNoReplace(plan.manifestPath, completedPath)
    } catch (error) {
      residue.push({
        path: plan.manifestPath,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  return residue
}

async function recoverManifest(manifestPath: string, state: "active" | "completed"): Promise<void> {
  const manifest = parseManifest(JSON.parse(await fs.readFile(manifestPath, "utf8")), manifestPath, state)
  const currentDatabaseInstanceID = Database.Identity()
  if (state === "active" && currentDatabaseInstanceID !== manifest.databaseInstanceID) {
    throw new ProjectDeletionCleanupDatabaseMismatchError({
      operationID: manifest.operationID,
      projectID: manifest.projectID,
      manifestDatabaseInstanceID: manifest.databaseInstanceID,
      currentDatabaseInstanceID,
      manifestPath,
      message:
        `Project deletion cleanup ${manifest.operationID} belongs to database ${manifest.databaseInstanceID}, ` +
        `but the active database is ${currentDatabaseInstanceID}; manual recovery is required`,
    })
  }
  const project =
    state === "active"
      ? Database.use((db) =>
          db
            .select({ generation: ProjectTable.generation })
            .from(ProjectTable)
            .where(eq(ProjectTable.id, manifest.projectID))
            .get(),
        )
      : undefined
  if (state === "active" && project?.generation === manifest.projectGeneration) {
    for (const target of manifest.targets.toReversed()) {
      const [sourceState, quarantineState] = await Promise.all([pathState(target.source), pathState(target.quarantine)])
      if (sourceState === "present" && quarantineState === "present") {
        throw new Error(
          `Project deletion recovery found both source and quarantine for retained Project ${manifest.projectID}`,
        )
      }
      if (sourceState === "absent" && quarantineState === "present") {
        await Filesystem.renameDurableNoReplace(target.quarantine, target.source)
      }
    }
    await removeProjectDeletionCleanupPlan({ manifest, manifestPath })
    return
  }

  const residue = await cleanupCommittedProjectDeletion({ manifest, manifestPath })
  if (residue.length > 0) {
    throw new AggregateError(
      residue.map((item) => new Error(`${item.path}: ${item.message}`)),
      `Committed Project deletion cleanup remains pending for ${manifest.projectID}`,
    )
  }
}

export async function recoverProjectDeletionCleanup(ownership: RuntimeServerOwnership.Handle): Promise<void> {
  RuntimeServerOwnership.assertHandleForDatabase(ownership, Database.Path())
  const failures: unknown[] = []
  const recoverRoot = async (root: string, state: "active" | "completed") => {
    let names: string[]
    try {
      names = await fs.readdir(root)
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
      if (code === "ENOENT" || code === "ENOTDIR") return
      throw error
    }
    for (const name of names.filter((candidate) => candidate.endsWith(".json")).sort()) {
      try {
        await recoverManifest(path.join(root, name), state)
      } catch (error) {
        failures.push(error)
      }
    }
  }
  await recoverRoot(cleanupRoot(), "active")
  let databaseRoots: Dirent[]
  try {
    databaseRoots = await fs.readdir(completedCleanupBaseRoot(), { withFileTypes: true })
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code !== "ENOENT" && code !== "ENOTDIR") throw error
    databaseRoots = []
  }
  for (const entry of databaseRoots.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory() || !z.string().uuid().safeParse(entry.name).success) {
      failures.push(new Error(`Invalid completed Project deletion cleanup database directory: ${entry.name}`))
      continue
    }
    await recoverRoot(path.join(completedCleanupBaseRoot(), entry.name), "completed")
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Project deletion cleanup recovery failed")
  }
}

export const ProjectDeletionCleanupTestHooks = {
  root: cleanupRoot,
  completedRoot: completedCleanupRoot,
}
