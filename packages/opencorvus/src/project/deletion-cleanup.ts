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
import { ProjectMaintenanceFenceTable } from "./project.sql"
import type { RuntimeProcessOccurrenceObserver } from "@/runtime/process-occurrence"
import { ImplicitProject } from "./implicit-project"
import { ProjectRuntimePaths } from "./runtime-paths"
import { McpAuth } from "@/mcp/auth"
import { projectDeletionCleanupRoot } from "./deletion-cleanup-admission"
import { ProjectDirectoryAdmission } from "./directory-admission"

const DirectoryOccurrence = z.object({
  directoryKey: z.string().min(1),
  device: z.number().finite(),
  inode: z.number().finite(),
  birthtimeMs: z.number().finite(),
})

const CleanupTarget = z.object({
  source: z.string().min(1),
  quarantine: z.string().min(1),
  occurrence: DirectoryOccurrence.nullable(),
})

const RegisteredDirectory = z.object({
  path: z.string().min(1),
  physicalPath: z.string().min(1).nullable(),
})

const CleanupManifest = z.object({
  format: z.literal("opencorvus.project-deletion-cleanup.v5"),
  operationID: z.string().uuid(),
  databaseInstanceID: z.string().uuid(),
  projectID: z.string().min(1),
  projectGeneration: z.string().uuid(),
  projectKind: z.enum(["ordinary", "anonymous"]),
  directory: z.string().min(1),
  registeredDirectories: z.array(RegisteredDirectory).min(1).max(256),
  targets: z.array(CleanupTarget).min(1).max(256),
  timeCreated: z.number().int().nonnegative(),
})

export type ProjectDeletionCleanupManifest = z.infer<typeof CleanupManifest>
export type ProjectDeletionCleanupPlan = {
  manifest: ProjectDeletionCleanupManifest
  manifestPath: string
}
export type ProjectDeletionDirectoryAdmissions = ProjectDirectoryAdmission.Token[]

export class ProjectDeletionDirectoryAdmissionRollbackError extends AggregateError {
  override readonly name = "ProjectDeletionDirectoryAdmissionRollbackError"
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

async function physicalDirectoryPath(directory: string): Promise<string | null> {
  try {
    const info = await fs.stat(directory)
    if (!info.isDirectory()) throw new Error(`Project registered directory is not a directory: ${directory}`)
    return path.resolve(await fs.realpath(directory))
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return null
    throw error
  }
}

async function observeDirectoryOccurrence(
  directory: string,
): Promise<ProjectDirectoryAdmission.DirectoryOccurrence | null> {
  try {
    return await ProjectDirectoryAdmission.observeDirectory(directory)
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return null
    throw error
  }
}

function samePhysicalOccurrence(
  left: ProjectDirectoryAdmission.DirectoryOccurrence,
  right: ProjectDirectoryAdmission.DirectoryOccurrence,
): boolean {
  return left.device === right.device && left.inode === right.inode && left.birthtimeMs === right.birthtimeMs
}

async function captureRegisteredDirectories(input: {
  projectID: string
  projectKind: "ordinary" | "anonymous"
  directories: string[]
}): Promise<Array<z.infer<typeof RegisteredDirectory>>> {
  const registeredDirectories = await Promise.all(
    input.directories.map(async (registeredDirectory) => {
      const resolved = path.resolve(registeredDirectory)
      return { path: resolved, physicalPath: await physicalDirectoryPath(resolved) }
    }),
  )
  if (input.projectKind === "anonymous" && registeredDirectories.length !== 1) {
    throw new Error(`Anonymous Project ${input.projectID} cannot own additional registered deletion roots`)
  }
  const physicalRoots = registeredDirectories.flatMap((registeredDirectory) =>
    registeredDirectory.physicalPath
      ? [ProjectRuntimePaths.projectRuntimeRoot(registeredDirectory.physicalPath)]
      : [],
  )
  for (let index = 0; index < physicalRoots.length; index += 1) {
    for (let peer = 0; peer < index; peer += 1) {
      if (Filesystem.overlaps(physicalRoots[index]!, physicalRoots[peer]!)) {
        throw new Error(
          `Project ${input.projectID} physical registered deletion roots overlap: ${physicalRoots[peer]} and ${physicalRoots[index]}`,
        )
      }
    }
  }
  return registeredDirectories
}

export async function assertProjectDeletionRegisteredDirectoryAuthority(input: {
  projectID: string
  directory: string
  sandboxes: string[]
}): Promise<void> {
  const directory = path.resolve(input.directory)
  const projectKind = ImplicitProject.isAnonymousDirectory(directory) ? "anonymous" : "ordinary"
  await captureRegisteredDirectories({
    projectID: input.projectID,
    projectKind,
    directories: [directory, ...input.sandboxes],
  })
}

function validateManifest(manifest: ProjectDeletionCleanupManifest): void {
  const directory = path.resolve(manifest.directory)
  if (!path.isAbsolute(manifest.directory) || !samePath(manifest.directory, directory)) {
    throw new Error(`Project deletion cleanup directory is not canonical: ${manifest.directory}`)
  }
  const registeredDirectories = manifest.registeredDirectories.map((registeredDirectory) => {
    const resolved = path.resolve(registeredDirectory.path)
    if (!path.isAbsolute(registeredDirectory.path) || !samePath(registeredDirectory.path, resolved)) {
      throw new Error(`Project deletion cleanup registered directory is not canonical: ${registeredDirectory.path}`)
    }
    if (
      registeredDirectory.physicalPath &&
      (!path.isAbsolute(registeredDirectory.physicalPath) ||
        !samePath(registeredDirectory.physicalPath, path.resolve(registeredDirectory.physicalPath)))
    ) {
      throw new Error(
        `Project deletion cleanup physical directory identity is not canonical: ${registeredDirectory.physicalPath}`,
      )
    }
    return { path: resolved, physicalPath: registeredDirectory.physicalPath }
  })
  if (!samePath(registeredDirectories[0]!.path, directory)) {
    throw new Error(`Project deletion cleanup primary directory does not match its registered-directory authority`)
  }
  const anonymous = ImplicitProject.isAnonymousDirectory(directory)
  if ((anonymous ? "anonymous" : "ordinary") !== manifest.projectKind) {
    throw new Error(`Project deletion cleanup kind does not match its exact primary directory`)
  }
  if (anonymous && registeredDirectories.length !== 1) {
    throw new Error(`Anonymous Project deletion cleanup must own exactly one registered directory`)
  }
  const expectedSources = anonymous
    ? [directory]
    : registeredDirectories.map((registeredDirectory) =>
        path.resolve(
          ProjectRuntimePaths.projectRuntimeRoot(registeredDirectory.physicalPath ?? registeredDirectory.path),
        ),
      )
  for (let index = 0; index < expectedSources.length; index += 1) {
    for (let peer = 0; peer < index; peer += 1) {
      if (Filesystem.overlaps(expectedSources[index]!, expectedSources[peer]!)) {
        throw new Error(
          `Project deletion cleanup registered roots overlap: ${expectedSources[peer]} and ${expectedSources[index]}`,
        )
      }
    }
  }
  if (manifest.targets.length !== expectedSources.length) {
    throw new Error(`Project deletion cleanup target set does not match its registered-directory authority`)
  }
  manifest.targets.forEach((target, index) => {
    const source = path.resolve(target.source)
    const expectedSource = expectedSources[index]!
    if (!path.isAbsolute(target.source) || !samePath(source, expectedSource)) {
      throw new Error(`Project deletion cleanup source is outside the exact Project-owned root: ${target.source}`)
    }
    const expected = `${source}.deleting-${manifest.operationID}-${index}`
    if (!samePath(target.quarantine, expected)) {
      throw new Error(`Project deletion cleanup target is not the exact quarantine for ${source}`)
    }
    if (target.occurrence && !samePath(target.occurrence.directoryKey, source)) {
      throw new Error(`Project deletion cleanup target occurrence does not match its source: ${source}`)
    }
  })
  for (let index = 0; index < registeredDirectories.length; index += 1) {
    for (let peer = 0; peer < index; peer += 1) {
      if (samePath(registeredDirectories[index]!.path, registeredDirectories[peer]!.path)) {
        throw new Error(`Project deletion cleanup repeats a registered directory`)
      }
    }
  }
}

async function assertRegisteredDirectoryIdentities(manifest: ProjectDeletionCleanupManifest): Promise<void> {
  if (manifest.projectKind === "anonymous") return
  const physicalRoots: string[] = []
  for (const registeredDirectory of manifest.registeredDirectories) {
    const current = await physicalDirectoryPath(registeredDirectory.path)
    const expected = registeredDirectory.physicalPath
    if ((current === null) !== (expected === null) || (current && expected && !samePath(current, expected))) {
      throw new Error(
        `Project deletion cleanup registered directory occurrence changed: ${registeredDirectory.path}`,
      )
    }
    if (current) physicalRoots.push(ProjectRuntimePaths.projectRuntimeRoot(current))
  }
  for (let index = 0; index < physicalRoots.length; index += 1) {
    for (let peer = 0; peer < index; peer += 1) {
      if (Filesystem.overlaps(physicalRoots[index]!, physicalRoots[peer]!)) {
        throw new Error(
          `Project deletion cleanup physical registered roots overlap: ${physicalRoots[peer]} and ${physicalRoots[index]}`,
        )
      }
    }
  }
}

async function assertTargetRecoverable(target: z.infer<typeof CleanupTarget>): Promise<void> {
  const current = await targetOccurrences(target)
  if (!target.occurrence) {
    if (!current.source && !current.quarantine) return
    throw new Error(`Project deletion cleanup absent target changed before recovery: ${target.source}`)
  }
  const sourceMatches =
    current.source && ProjectDirectoryAdmission.sameOccurrence(target.occurrence, current.source)
  const quarantineMatches =
    current.quarantine && samePhysicalOccurrence(target.occurrence, current.quarantine)
  if ((sourceMatches && !current.quarantine) || (!current.source && quarantineMatches)) return
  throw new Error(`Project deletion cleanup target occurrence is ambiguous during recovery: ${target.source}`)
}

async function targetOccurrences(target: z.infer<typeof CleanupTarget>) {
  const [source, quarantine] = await Promise.all([
    observeDirectoryOccurrence(target.source),
    observeDirectoryOccurrence(target.quarantine),
  ])
  return { source, quarantine }
}

async function assertTargetSourceOccurrence(target: z.infer<typeof CleanupTarget>): Promise<void> {
  const current = await targetOccurrences(target)
  if (current.quarantine) {
    throw new Error(`Project deletion cleanup quarantine already exists before staging: ${target.quarantine}`)
  }
  if (!target.occurrence) {
    if (current.source) throw new Error(`Project deletion cleanup absent source occurrence changed: ${target.source}`)
    return
  }
  if (!current.source || !ProjectDirectoryAdmission.sameOccurrence(target.occurrence, current.source)) {
    throw new Error(`Project deletion cleanup source occurrence changed: ${target.source}`)
  }
}

export async function projectDeletionCleanupTargetStaged(
  target: z.infer<typeof CleanupTarget>,
): Promise<boolean> {
  const current = await targetOccurrences(target)
  if (!target.occurrence) {
    if (current.source === null && current.quarantine === null) return false
    throw new Error(`Project deletion cleanup absent target acquired a filesystem occurrence: ${target.source}`)
  }
  if (current.source === null && current.quarantine && samePhysicalOccurrence(target.occurrence, current.quarantine)) {
    return true
  }
  throw new Error(`Project deletion cleanup target did not settle in quarantine: ${target.source}`)
}

export async function assertProjectDeletionCleanupTargetRestored(
  target: z.infer<typeof CleanupTarget>,
): Promise<void> {
  const current = await targetOccurrences(target)
  if (!target.occurrence) {
    if (!current.source && !current.quarantine) return
    throw new Error(`Project deletion cleanup absent target changed during rollback: ${target.source}`)
  }
  if (current.source && !current.quarantine && ProjectDirectoryAdmission.sameOccurrence(target.occurrence, current.source)) {
    return
  }
  throw new Error(`Project deletion cleanup target did not restore its exact occurrence: ${target.source}`)
}

function parseManifest(
  value: unknown,
  manifestPath: string,
  state: "active" | "completed",
): ProjectDeletionCleanupManifest {
  const manifest = CleanupManifest.parse(value)
  validateManifest(manifest)
  const root = state === "active" ? projectDeletionCleanupRoot() : completedCleanupRoot(manifest.databaseInstanceID)
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

function sameManifest(left: ProjectDeletionCleanupManifest, right: ProjectDeletionCleanupManifest): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function completedManifestMatches(plan: ProjectDeletionCleanupPlan, completedPath: string): Promise<boolean> {
  if ((await pathState(plan.manifestPath)) !== "absent") return false
  try {
    const completed = parseManifest(JSON.parse(await fs.readFile(completedPath, "utf8")), completedPath, "completed")
    return sameManifest(completed, plan.manifest)
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return false
    throw error
  }
}

export async function createProjectDeletionCleanupPlan(input: {
  projectID: string
  directory: string
  operationID?: string
}): Promise<ProjectDeletionCleanupPlan> {
  const authority = Database.use((db) =>
    db
      .select({
        generation: ProjectTable.generation,
        worktree: ProjectTable.worktree,
        sandboxes: ProjectTable.sandboxes,
      })
      .from(ProjectTable)
      .where(eq(ProjectTable.id, input.projectID))
      .get(),
  )
  if (!authority) throw new Error(`Cannot create deletion cleanup authority for missing Project ${input.projectID}`)
  if (!authority.generation) throw new Error(`Project ${input.projectID} has no durable generation`)
  if (!samePath(input.directory, authority.worktree)) {
    throw new Error(`Project ${input.projectID} deletion cleanup directory is not its exact primary worktree`)
  }
  const operationID = input.operationID ?? randomUUID()
  const directory = path.resolve(authority.worktree)
  const projectKind = ImplicitProject.isAnonymousDirectory(directory) ? "anonymous" : "ordinary"
  const registeredDirectories = await captureRegisteredDirectories({
    projectID: input.projectID,
    projectKind,
    directories: [authority.worktree, ...authority.sandboxes],
  })
  const sources =
    projectKind === "anonymous"
      ? [directory]
      : registeredDirectories.map((registeredDirectory) =>
          ProjectRuntimePaths.projectRuntimeRoot(registeredDirectory.physicalPath ?? registeredDirectory.path),
        )
  const targets = await Promise.all(
    sources.map(async (source, index) => {
      const resolved = path.resolve(source)
      return {
        source: resolved,
        quarantine: `${resolved}.deleting-${operationID}-${index}`,
        occurrence: await observeDirectoryOccurrence(resolved),
      }
    }),
  )
  const manifest = CleanupManifest.parse({
    format: "opencorvus.project-deletion-cleanup.v5",
    operationID,
    databaseInstanceID: Database.Identity(),
    projectID: input.projectID,
    projectGeneration: authority.generation,
    projectKind,
    directory,
    registeredDirectories,
    targets,
    timeCreated: Date.now(),
  })
  validateManifest(manifest)
  await assertRegisteredDirectoryIdentities(manifest)
  const manifestPath = path.join(projectDeletionCleanupRoot(), `${operationID}.json`)
  try {
    const created = await Filesystem.writeDurableAtomicIfAbsent(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      0o600,
    )
    if (!created) {
      const existing = parseManifest(JSON.parse(await fs.readFile(manifestPath, "utf8")), manifestPath, "active")
      if (!sameManifest(existing, manifest)) {
        throw new Error(`Project deletion cleanup operation already exists: ${operationID}`)
      }
    }
  } catch (error) {
    try {
      const existing = parseManifest(JSON.parse(await fs.readFile(manifestPath, "utf8")), manifestPath, "active")
      if (sameManifest(existing, manifest)) return { manifest, manifestPath }
    } catch {
      // The publication error remains authoritative when exact durable bytes cannot be proven.
    }
    throw error
  }
  return { manifest, manifestPath }
}

export async function removeProjectDeletionCleanupPlan(plan: ProjectDeletionCleanupPlan): Promise<void> {
  await fs.rm(plan.manifestPath, { force: true })
  await Filesystem.syncDirectoryMetadata(path.dirname(plan.manifestPath))
}

export async function assertProjectDeletionCleanupPlanCurrent(plan: ProjectDeletionCleanupPlan): Promise<void> {
  await assertRegisteredDirectoryIdentities(plan.manifest)
  for (const target of plan.manifest.targets) await assertTargetSourceOccurrence(target)
}

export async function acquireProjectDeletionDirectoryAdmissions(
  plan: ProjectDeletionCleanupPlan,
  observe?: RuntimeProcessOccurrenceObserver,
): Promise<ProjectDeletionDirectoryAdmissions> {
  const tokens: ProjectDeletionDirectoryAdmissions = []
  try {
    for (const target of plan.manifest.targets) {
      const admission = await ProjectDirectoryAdmission.acquire({
        directory: target.source,
        operationID: plan.manifest.operationID,
        kind: "reclamation",
        ...(observe ? { observe } : {}),
      })
      if (admission.outcome !== "acquired") {
        throw new Error(`Project deletion directory ${target.source} has an unexpected existing owner`)
      }
      tokens.push(admission.token)
    }
  } catch (error) {
    try {
      if (tokens.length > 0) settleProjectDeletionDirectoryAdmissions(tokens)
    } catch (settlementError) {
      throw new ProjectDeletionDirectoryAdmissionRollbackError(
        [error, settlementError],
        `Project deletion directory admission rollback failed for ${plan.manifest.operationID}`,
      )
    }
    throw error
  }
  return tokens
}

export function settleProjectDeletionDirectoryAdmissions(
  admissions: ProjectDeletionDirectoryAdmissions,
): void {
  ProjectDirectoryAdmission.settleMany(admissions, () => undefined)
}

export async function cleanupCommittedProjectDeletion(
  plan: ProjectDeletionCleanupPlan,
  options: {
    retireMcpAuth?: boolean
    directoryAdmissions?: ProjectDeletionDirectoryAdmissions
    observeProcessOccurrence?: RuntimeProcessOccurrenceObserver
  } = {},
): Promise<Array<{ path: string; message: string }>> {
  const residue: Array<{ path: string; message: string }> = []
  let directoryAdmissions = options.directoryAdmissions
  try {
    directoryAdmissions ??= await acquireProjectDeletionDirectoryAdmissions(
      plan,
      options.observeProcessOccurrence,
    )
  } catch (error) {
    return [
      {
        path: plan.manifestPath,
        message: error instanceof Error ? error.message : String(error),
      },
    ]
  }
  if (options.retireMcpAuth !== false) {
    try {
      await McpAuth.removeProject(plan.manifest.projectID)
    } catch (error) {
      residue.push({
        path: path.join(Global.Path.data, "mcp-auth.json"),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  for (const target of plan.manifest.targets) {
    try {
      const quarantineOccurrence = await observeDirectoryOccurrence(target.quarantine)
      if (quarantineOccurrence) {
        if (!target.occurrence || !samePhysicalOccurrence(target.occurrence, quarantineOccurrence)) {
          throw new Error(`Project deletion cleanup quarantine occurrence changed: ${target.quarantine}`)
        }
        try {
          await fs.rm(target.quarantine, { recursive: true, force: true })
        } catch (error) {
          if ((await pathState(target.quarantine)) !== "absent") throw error
        }
        if ((await pathState(target.quarantine)) !== "absent") {
          throw new Error(`Project deletion cleanup quarantine remained after removal: ${target.quarantine}`)
        }
      }
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
  try {
    settleProjectDeletionDirectoryAdmissions(directoryAdmissions)
  } catch (error) {
    residue.push({
      path: plan.manifestPath,
      message: error instanceof Error ? error.message : String(error),
    })
    return residue
  }
  const completedRoot = completedCleanupRoot(plan.manifest.databaseInstanceID)
  const completedPath = path.join(completedRoot, path.basename(plan.manifestPath))
  if (!samePath(plan.manifestPath, completedPath))
    try {
      await Filesystem.mkdirDurable(completedRoot)
      await Filesystem.renameDurableNoReplace(plan.manifestPath, completedPath)
    } catch (error) {
      if (!(await completedManifestMatches(plan, completedPath))) {
        residue.push({
          path: plan.manifestPath,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  return residue
}

async function recoverManifest(
  manifestPath: string,
  state: "active" | "completed",
  observeProcessOccurrence?: RuntimeProcessOccurrenceObserver,
): Promise<void> {
  let serialized: string
  try {
    serialized = await fs.readFile(manifestPath, "utf8")
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    // Another backend may have completed or rolled back the exact active
    // operation after this process enumerated it.
    if (state === "active" && (code === "ENOENT" || code === "ENOTDIR")) return
    throw error
  }
  const manifest = parseManifest(JSON.parse(serialized), manifestPath, state)
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
            .select({
              generation: ProjectTable.generation,
              worktree: ProjectTable.worktree,
              sandboxes: ProjectTable.sandboxes,
            })
            .from(ProjectTable)
            .where(eq(ProjectTable.id, manifest.projectID))
            .get(),
        )
      : undefined
  if (state === "active" && project?.generation === manifest.projectGeneration) {
    const registeredDirectories = manifest.registeredDirectories.map((registeredDirectory) => registeredDirectory.path)
    if (
      !samePath(project.worktree, manifest.directory) ||
      project.sandboxes.length + 1 !== registeredDirectories.length ||
      !samePath(project.worktree, registeredDirectories[0]!) ||
      project.sandboxes.some((sandbox, index) => !samePath(sandbox, registeredDirectories[index + 1]!))
    ) {
      throw new Error(`Project deletion cleanup registry snapshot changed for retained Project ${manifest.projectID}`)
    }
    const projectFence = Database.use((db) =>
      db
        .select()
        .from(ProjectMaintenanceFenceTable)
        .where(eq(ProjectMaintenanceFenceTable.project_id, manifest.projectID))
        .get(),
    )
    if (projectFence) {
      if (
        projectFence.operation_id !== manifest.operationID ||
        projectFence.project_generation !== manifest.projectGeneration ||
        projectFence.kind !== "delete"
      ) {
        return
      }
      if (!observeProcessOccurrence) return
      const owner = observeProcessOccurrence({
        pid: projectFence.owner_pid,
        processInstanceID: projectFence.owner_process_instance_id,
        occurrenceID: projectFence.owner_occurrence_id,
      })
      if (owner !== "dead_or_reused") return
    }
    const plan = { manifest, manifestPath }
    const directoryAdmissions = await acquireProjectDeletionDirectoryAdmissions(plan, observeProcessOccurrence)
    await assertRegisteredDirectoryIdentities(manifest)
    for (const target of manifest.targets) await assertTargetRecoverable(target)
    for (const target of manifest.targets.toReversed()) {
      const [sourceState, quarantineState] = await Promise.all([pathState(target.source), pathState(target.quarantine)])
      if (sourceState === "present" && quarantineState === "present") {
        throw new Error(
          `Project deletion recovery found both source and quarantine for retained Project ${manifest.projectID}`,
        )
      }
      if (sourceState === "absent" && quarantineState === "present") {
        try {
          await Filesystem.renameDurableNoReplace(target.quarantine, target.source)
        } catch (error) {
          try {
            await assertProjectDeletionCleanupTargetRestored(target)
          } catch (settlementError) {
            throw new AggregateError(
              [error, settlementError],
              `Project deletion recovery did not restore ${target.source}`,
            )
          }
        }
        await assertProjectDeletionCleanupTargetRestored(target)
      }
    }
    settleProjectDeletionDirectoryAdmissions(directoryAdmissions)
    await removeProjectDeletionCleanupPlan(plan)
    return
  }

  const residue = await cleanupCommittedProjectDeletion(
    { manifest, manifestPath },
    {
      retireMcpAuth: state === "active" && !project,
      observeProcessOccurrence,
    },
  )
  if (residue.length > 0) {
    throw new AggregateError(
      residue.map((item) => new Error(`${item.path}: ${item.message}`)),
      `Committed Project deletion cleanup remains pending for ${manifest.projectID}`,
    )
  }
}

export type ProjectDeletionCleanupRecoveryResult = {
  /** Manifests this pass could not converge. They stay on disk for the next
   * attempt and are reported; deletion cleanup is deferrable work and must
   * never keep the runtime from starting. */
  unreconciled: unknown[]
  retainedOperationIDs: string[]
}

export async function recoverProjectDeletionCleanup(
  observeProcessOccurrence?: RuntimeProcessOccurrenceObserver,
): Promise<ProjectDeletionCleanupRecoveryResult> {
  const failures: unknown[] = []
  const retainedOperationIDs = new Set<string>()
  const recoverRoot = async (root: string, state: "active" | "completed") => {
    let names: string[]
    try {
      names = await fs.readdir(root)
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
      if (code === "ENOENT" || code === "ENOTDIR") return
      failures.push(error)
      return
    }
    for (const name of names.filter((candidate) => candidate.endsWith(".json")).sort()) {
      const operationID = path.basename(name, ".json")
      try {
        const manifestPath = path.join(root, name)
        await recoverManifest(manifestPath, state, observeProcessOccurrence)
        if (state === "active" && (await pathState(manifestPath)) === "present") {
          retainedOperationIDs.add(operationID)
        }
      } catch (error) {
        if (state === "active") retainedOperationIDs.add(operationID)
        failures.push(error)
      }
    }
  }
  await recoverRoot(projectDeletionCleanupRoot(), "active")
  let databaseRoots: Dirent[]
  try {
    databaseRoots = await fs.readdir(completedCleanupBaseRoot(), { withFileTypes: true })
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code !== "ENOENT" && code !== "ENOTDIR") failures.push(error)
    databaseRoots = []
  }
  for (const entry of databaseRoots.sort((left, right) => left.name.localeCompare(right.name))) {
    const temporaryTarget = Filesystem.durableDirectoryTemporaryTargetName(entry.name)
    if (temporaryTarget && z.string().uuid().safeParse(temporaryTarget).success) continue
    if (!entry.isDirectory() || !z.string().uuid().safeParse(entry.name).success) {
      failures.push(new Error(`Invalid completed Project deletion cleanup database directory: ${entry.name}`))
      continue
    }
    await recoverRoot(path.join(completedCleanupBaseRoot(), entry.name), "completed")
  }
  return { unreconciled: failures, retainedOperationIDs: [...retainedOperationIDs].sort() }
}

export const ProjectDeletionCleanupTestHooks = {
  root: projectDeletionCleanupRoot,
  completedRoot: completedCleanupRoot,
}
