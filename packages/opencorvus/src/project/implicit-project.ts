import { randomUUID } from "node:crypto"
import * as fs from "node:fs/promises"
import path from "node:path"
import { isDeepStrictEqual } from "node:util"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { GlobalBus } from "@/bus/global"
import { Global } from "@/global"
import { Database, eq } from "@/storage/db"
import { Session } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { Filesystem } from "@/util/filesystem"
import { Log } from "@/util/log"
import { ImplicitProjectCreation } from "./implicit-project-creation"
import { PromotionDatabaseSnapshot, PromotionJournal } from "./promotion-journal"
import { Project } from "./project"
import { ProjectMaintenanceFenceTable, ProjectTable } from "./project.sql"
import {
  ensureProjectPromotionFenceInTransaction,
  releaseProjectMaintenanceFencesInTransaction,
} from "./deletion-registry"
import { ProjectDirectoryAdmission } from "./directory-admission"
import type { RuntimeProcessOccurrenceObserver } from "@/runtime/process-occurrence"

function calendarSegment(value: number): string {
  return String(value).padStart(2, "0")
}

export namespace ImplicitProject {
  const log = Log.create({ service: "implicit-project" })
  type CreationCompensationHook = (directory: string) => void | Promise<void>
  let beforeCreationCompensationLookup: CreationCompensationHook | undefined
  let beforeCreationCompensationRemoval: CreationCompensationHook | undefined
  let afterPromotionSourceRestore: (() => void | Promise<void>) | undefined
  let afterPromotionAdmissions: (() => void | Promise<void>) | undefined
  let afterPromotionPrepared: (() => void | Promise<void>) | undefined

  export namespace TestHooks {
    export function installCreationCompensation(input: {
      beforeLookup?: CreationCompensationHook
      beforeRemoval?: CreationCompensationHook
    }) {
      const previousLookup = beforeCreationCompensationLookup
      const previousRemoval = beforeCreationCompensationRemoval
      beforeCreationCompensationLookup = input.beforeLookup
      beforeCreationCompensationRemoval = input.beforeRemoval
      return {
        [Symbol.dispose]() {
          if (beforeCreationCompensationLookup === input.beforeLookup) {
            beforeCreationCompensationLookup = previousLookup
          }
          if (beforeCreationCompensationRemoval === input.beforeRemoval) {
            beforeCreationCompensationRemoval = previousRemoval
          }
        },
      }
    }
  }

  export type PromotionRollbackResidue = {
    sourceExists: boolean | null
    destinationExists: boolean | null
    stagingExists: boolean | null
    quarantineExists: boolean | null
    projectMappingChanged: boolean | null
    changedSessionIDs: string[] | null
  }

  export class PromotionRollbackError extends AggregateError {
    override readonly name = "AnonymousProjectPromotionRollbackError"

    constructor(
      originalCause: unknown,
      rollbackFailures: unknown[],
      public readonly residue: PromotionRollbackResidue,
      public readonly paths: {
        source: string
        destination: string
        staging: string
        quarantine: string
      },
    ) {
      super(
        [originalCause, ...rollbackFailures],
        "Anonymous project promotion failed and rollback did not restore the canonical filesystem and database mappings",
        { cause: originalCause },
      )
    }
  }

  export const PromotionInput = z.object({
    destinationParent: z.string().trim().min(1),
    name: z.string().trim().min(1),
  })

  export const PromotionResult = z
    .object({
      project: Project.Info,
      sourceDirectory: z.string(),
      directory: z.string(),
      cleanupPending: z.boolean(),
    })
    .meta({ ref: "AnonymousProjectPromotionResult" })

  export const PromotionError = NamedError.create(
    "AnonymousProjectPromotionError",
    z.object({
      message: z.string(),
      sourceDirectory: z.string(),
      destination: z.string().optional(),
      reason: z.enum(["not_anonymous", "invalid_name", "invalid_destination", "destination_exists", "path_overlap"]),
    }),
  )

  export function isAnonymousDirectory(directory: string): boolean {
    const relative = path.relative(path.join(Global.Path.data, "projects"), path.resolve(directory))
    const segments = relative.split(path.sep)
    return (
      segments.length === 4 &&
      /^\d{4}$/.test(segments[0] ?? "") &&
      /^(0[1-9]|1[0-2])$/.test(segments[1] ?? "") &&
      /^(0[1-9]|[12]\d|3[01])$/.test(segments[2] ?? "") &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segments[3] ?? "")
    )
  }

  function mappedDirectory(value: string, source: string, destination: string): string {
    if (!Filesystem.contains(source, value)) return value
    return path.join(destination, path.relative(source, value))
  }

  function promotionDatabaseSnapshotInTransaction(db: Database.TxOrDb, projectID: string): PromotionDatabaseSnapshot {
    const project = db
      .select({
        worktree: ProjectTable.worktree,
        name: ProjectTable.name,
        sandboxes: ProjectTable.sandboxes,
        generation: ProjectTable.generation,
        timeUpdated: ProjectTable.time_updated,
      })
      .from(ProjectTable)
      .where(eq(ProjectTable.id, projectID))
      .get()
    if (!project) throw new Error(`Project not found while preparing anonymous promotion: ${projectID}`)
    const sessions = db
      .select({
        id: SessionTable.id,
        directory: SessionTable.directory,
        metadata: SessionTable.metadata,
        timeUpdated: SessionTable.time_updated,
      })
      .from(SessionTable)
      .where(eq(SessionTable.project_id, projectID))
      .all()
    return PromotionDatabaseSnapshot.parse({ project, sessions })
  }

  function promotionDatabaseSnapshot(projectID: string): PromotionDatabaseSnapshot {
    return Database.use((db) => promotionDatabaseSnapshotInTransaction(db, projectID))
  }

  function mappedMetadata(
    metadata: Record<string, unknown> | null,
    source: string,
    destination: string,
  ): Record<string, unknown> | null {
    if (!metadata) return metadata
    const mission = metadata.mission
    if (!mission || typeof mission !== "object" || Array.isArray(mission)) return metadata
    const cwd = (mission as Record<string, unknown>).cwd
    if (typeof cwd !== "string" || !Filesystem.contains(source, cwd)) return metadata
    return {
      ...metadata,
      mission: { ...(mission as Record<string, unknown>), cwd: mappedDirectory(cwd, source, destination) },
    }
  }

  function assertJournalPaths(entry: PromotionJournal.Entry): void {
    const paths = [entry.source, entry.physicalSource, entry.quarantine, entry.staging, entry.destination]
    if (paths.some((candidate) => !path.isAbsolute(candidate))) {
      throw new Error(`Promotion journal ${entry.operationID} contains a non-absolute path`)
    }
    const expectedQuarantine = path.join(
      path.dirname(entry.physicalSource),
      `.${path.basename(entry.physicalSource)}.promoting-${entry.operationID}`,
    )
    const expectedStaging = path.join(path.dirname(entry.destination), `.opencorvus-promoting-${entry.operationID}`)
    if (!Project.samePath(entry.quarantine, expectedQuarantine) || !Project.samePath(entry.staging, expectedStaging)) {
      throw new Error(`Promotion journal ${entry.operationID} path ownership does not match its operation identity`)
    }
    if (!Project.samePath(entry.destination, path.join(path.dirname(entry.destination), entry.name))) {
      throw new Error(`Promotion journal ${entry.operationID} destination does not match its exact name`)
    }
    const owned = [entry.physicalSource, entry.quarantine, entry.staging, entry.destination]
    for (let left = 0; left < owned.length; left++) {
      for (let right = left + 1; right < owned.length; right++) {
        if (Filesystem.overlaps(owned[left]!, owned[right]!)) {
          throw new Error(`Promotion journal ${entry.operationID} contains overlapping owned paths`)
        }
      }
    }
  }

  async function assertDigest(label: string, directory: string, expected: string): Promise<void> {
    const actual = await PromotionJournal.digestDirectory(directory)
    if (actual !== expected) throw new Error(`${label} digest mismatch: expected ${expected}, received ${actual}`)
  }

  function assertDatabaseProjection(entry: PromotionJournal.Entry, side: "source" | "destination"): void {
    const current = promotionDatabaseSnapshot(entry.projectID)
    const before = entry.database
    const expectedProject =
      side === "source"
        ? before.project
        : {
            ...before.project,
            worktree: entry.destination,
            name: entry.name,
            sandboxes: before.project.sandboxes.map((item) => mappedDirectory(item, entry.source, entry.destination)),
          }
    if (
      current.project.generation !== expectedProject.generation ||
      !Project.samePath(current.project.worktree, expectedProject.worktree) ||
      current.project.name !== expectedProject.name ||
      !sameJson(current.project.sandboxes, expectedProject.sandboxes)
    ) {
      throw new Error(`Promotion journal Project ${side} database projection changed`)
    }
    const currentByID = new Map(current.sessions.map((session) => [session.id, session]))
    if (currentByID.size !== before.sessions.length) {
      throw new Error(`Promotion journal Project ${side} session set changed`)
    }
    for (const session of before.sessions) {
      const actual = currentByID.get(session.id)
      const expectedDirectory =
        side === "source" ? session.directory : mappedDirectory(session.directory, entry.source, entry.destination)
      const expectedMetadata =
        side === "source" ? session.metadata : mappedMetadata(session.metadata, entry.source, entry.destination)
      if (
        !actual ||
        !Project.samePath(actual.directory, expectedDirectory) ||
        !sameJson(actual.metadata, expectedMetadata)
      ) {
        throw new Error(`Promotion journal Project ${side} session ${session.id} changed`)
      }
    }
  }

  function sameJson(left: unknown, right: unknown): boolean {
    return isDeepStrictEqual(left, right)
  }

  async function inspectPath(label: string, target: string, rollbackFailures: unknown[]): Promise<boolean | null> {
    try {
      await fs.lstat(target)
      return true
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return false
      rollbackFailures.push(new Error(`Failed to inspect promotion ${label}: ${target}`, { cause }))
      return null
    }
  }

  async function rollbackPromotion(input: {
    cause: unknown
    projectID: string
    database: PromotionDatabaseSnapshot
    physicalSource: string
    destination: string
    staging: string
    quarantine: string
    published: boolean
    operationID: string
  }): Promise<never> {
    const rollbackFailures: unknown[] = []
    try {
      const entry = await PromotionJournal.get(input.projectID)
      if (!entry || entry.operationID !== input.operationID) {
        throw new Error(`Promotion rollback lost its exact journal occurrence ${input.operationID}`)
      }
      assertJournalPaths(entry)
      if (input.published && (await Filesystem.exists(entry.destination))) {
        if (!entry.destinationDigest) throw new Error("Published promotion has no prepared digest")
        await assertDigest("Promotion rollback destination", entry.destination, entry.destinationDigest)
        const current = promotionDatabaseSnapshot(entry.projectID)
        if (!Project.samePath(current.project.worktree, entry.source)) {
          throw new Error("Promotion rollback cannot remove a destination after the database identity changed")
        }
        await fs.rm(entry.destination, { recursive: true, force: false })
      }
      const outcome = await convergePromotionJournalEntry(entry)
      if (outcome !== "backward") throw new Error(`Promotion rollback converged ${outcome} instead of backward`)
      throw input.cause
    } catch (cause) {
      if (cause === input.cause) throw cause
      rollbackFailures.push(cause)
    }

    const [sourceExists, destinationExists, stagingExists, quarantineExists] = await Promise.all([
      inspectPath("source", input.physicalSource, rollbackFailures),
      inspectPath("destination", input.destination, rollbackFailures),
      inspectPath("staging directory", input.staging, rollbackFailures),
      inspectPath("quarantine directory", input.quarantine, rollbackFailures),
    ])

    let projectMappingChanged: boolean | null = null
    let changedSessionIDs: string[] | null = null
    try {
      const current = promotionDatabaseSnapshot(input.projectID)
      projectMappingChanged = !sameJson(current.project, input.database.project)
      const currentSessions = new Map(current.sessions.map((session) => [session.id, session]))
      changedSessionIDs = input.database.sessions
        .filter((session) => !sameJson(currentSessions.get(session.id), session))
        .map((session) => session.id)
      for (const session of current.sessions) {
        if (!input.database.sessions.some((candidate) => candidate.id === session.id))
          changedSessionIDs.push(session.id)
      }
    } catch (cause) {
      rollbackFailures.push(new Error("Failed to inspect promotion database mappings after rollback", { cause }))
    }

    const residue: PromotionRollbackResidue = {
      sourceExists,
      destinationExists,
      stagingExists,
      quarantineExists,
      projectMappingChanged,
      changedSessionIDs,
    }
    const restored =
      sourceExists === true &&
      destinationExists === false &&
      stagingExists === false &&
      quarantineExists === false &&
      projectMappingChanged === false &&
      changedSessionIDs?.length === 0
    if (rollbackFailures.length === 0 && restored) throw input.cause
    throw new PromotionRollbackError(input.cause, rollbackFailures, residue, {
      source: input.physicalSource,
      destination: input.destination,
      staging: input.staging,
      quarantine: input.quarantine,
    })
  }

  /** Converge one Project's open promotion occurrence. The promote path calls
   *  this before it opens a new occurrence; the startup sweep calls it for
   *  every Project that has one. */
  export async function recoverPromotionJournalEntry(projectID: string): Promise<"absent" | "forward" | "backward"> {
    return PromotionJournal.withProjectOwner(projectID, async () => {
      const entry = await PromotionJournal.get(projectID)
      if (!entry) return "absent"
      return convergePromotionJournalEntry(entry)
    })
  }

  async function convergePromotionJournalEntry(entry: PromotionJournal.Entry): Promise<"forward" | "backward"> {
    assertJournalPaths(entry)
    const authority = Database.immediateTransaction((db) => {
      const project = db.select().from(ProjectTable).where(eq(ProjectTable.id, entry.projectID)).get()
      if (project && project.generation !== entry.projectGeneration) return project
      if (project && !entry.terminal) {
        const fence = db
          .select()
          .from(ProjectMaintenanceFenceTable)
          .where(eq(ProjectMaintenanceFenceTable.project_id, entry.projectID))
          .get()
        if (!fence) {
          const current = promotionDatabaseSnapshotInTransaction(db, entry.projectID)
          if (!sameJson(current, entry.database) || !Project.samePath(current.project.worktree, entry.source)) {
            throw new Error(
              `Promotion journal Project/Session snapshot changed before recovery fencing: ${entry.projectID}`,
            )
          }
        }
        ensureProjectPromotionFenceInTransaction(db, { project, operationID: entry.operationID })
      } else if (project) {
        const fence = db
          .select()
          .from(ProjectMaintenanceFenceTable)
          .where(eq(ProjectMaintenanceFenceTable.project_id, entry.projectID))
          .get()
        if (
          fence?.kind !== "promotion" ||
          fence.operation_id !== entry.operationID ||
          fence.project_generation !== entry.projectGeneration
        ) {
          throw new Error(`Settled promotion ${entry.operationID} no longer owns its Project fence`)
        }
      }
      return project
    })
    if (!authority) throw new Error(`Promotion journal references a missing Project: ${entry.projectID}`)
    if (authority.generation !== entry.projectGeneration) {
      throw new Error(
        `Promotion journal Project generation mismatch for ${entry.projectID}: ` +
          `expected ${entry.projectGeneration}, received ${authority.generation}`,
      )
    }
    const mappedWorktree = Filesystem.normalizePath(authority.worktree)
    if (
      mappedWorktree !== Filesystem.normalizePath(entry.source) &&
      mappedWorktree !== Filesystem.normalizePath(entry.destination)
    ) {
      throw new Error(`Promotion journal Project mapping is outside its source/destination occurrence`)
    }
    const destinationExists = await Filesystem.exists(entry.destination)
    if (entry.terminal === "committed" && !destinationExists) {
      throw new Error(`Committed promotion destination is missing: ${entry.destination}`)
    }
    if (entry.terminal === "rolled_back" && destinationExists) {
      throw new Error(`Rolled-back promotion still has a destination: ${entry.destination}`)
    }
    const acquireUnownedPromotionPath = async (
      directory: string,
      kind: "promotion_publish" | "promotion_workspace",
    ) => {
      const ownership = await captureProjectOwningInfo(directory)
      const admission = await ProjectDirectoryAdmission.acquire({
        directory,
        operationID: entry.operationID,
        kind,
        findOwner: ownership.findOwner,
      })
      if (admission.outcome === "owned") {
        return { owner: admission.owner.project, token: undefined, revalidatePhysical: undefined }
      }
      return { owner: undefined, token: admission.token, revalidatePhysical: ownership.revalidatePhysical }
    }
    const acquiredRecoveryTokens: ProjectDirectoryAdmission.Token[] = []
    let stagingAdmission!: Awaited<ReturnType<typeof acquireUnownedPromotionPath>>
    let quarantineAdmission!: Awaited<ReturnType<typeof acquireUnownedPromotionPath>>
    let destinationAdmission!: Awaited<ReturnType<typeof acquireUnownedPromotionPath>>
    try {
      stagingAdmission = await acquireUnownedPromotionPath(entry.staging, "promotion_workspace")
      if (stagingAdmission.owner) {
        throw new Error(`Promotion staging ${entry.staging} is owned by Project ${stagingAdmission.owner.id}`)
      }
      acquiredRecoveryTokens.push(stagingAdmission.token!)
      quarantineAdmission = await acquireUnownedPromotionPath(entry.quarantine, "promotion_workspace")
      if (quarantineAdmission.owner) {
        throw new Error(`Promotion quarantine ${entry.quarantine} is owned by Project ${quarantineAdmission.owner.id}`)
      }
      acquiredRecoveryTokens.push(quarantineAdmission.token!)
      destinationAdmission = await acquireUnownedPromotionPath(entry.destination, "promotion_publish")
      if (
        destinationAdmission.owner &&
        (destinationAdmission.owner.id !== entry.projectID || !Project.samePath(authority.worktree, entry.destination))
      ) {
        throw new Error(
          `Promotion destination ${entry.destination} is owned by Project ${destinationAdmission.owner.id}`,
        )
      }
      if (destinationAdmission.token) acquiredRecoveryTokens.push(destinationAdmission.token)
      for (const admission of [stagingAdmission, quarantineAdmission, destinationAdmission]) {
        await admission.revalidatePhysical?.()
      }
    } catch (error) {
      if (acquiredRecoveryTokens.length === 0) throw error
      try {
        ProjectDirectoryAdmission.settleMany(acquiredRecoveryTokens, () => undefined)
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Promotion recovery admission cleanup failed", {
          cause: error,
        })
      }
      throw error
    }
    if (destinationExists) {
      if (!entry.destinationDigest) {
        throw new Error(`Promotion journal destination has no prepared content digest: ${entry.destination}`)
      }
      const relocated = !Project.samePath(authority.worktree, entry.source)
      if (relocated) assertDatabaseProjection(entry, "destination")
      else {
        await assertDigest("Promotion prepared destination", entry.destination, entry.destinationDigest)
        assertDatabaseProjection(entry, "source")
        if (!destinationAdmission.token) {
          throw new Error(`Promotion destination ${entry.destination} has no publish admission`)
        }
        ProjectDirectoryAdmission.settle(destinationAdmission.token, (db) => {
          Project.beginPromotionCommit(
            { projectID: entry.projectID, operationID: entry.operationID, expectedGeneration: entry.projectGeneration },
            db,
          )
          Project.relocate(
            {
              projectID: entry.projectID,
              operationID: entry.operationID,
              expectedGeneration: entry.projectGeneration,
              expectedWorktree: entry.source,
              worktree: entry.destination,
              name: entry.name,
              sandboxes: entry.database.project.sandboxes.map((item) =>
                mappedDirectory(item, entry.source, entry.destination),
              ),
              directoryAdmission: destinationAdmission.token!,
            },
            db,
          )
          Session.relocateProject(
            {
              projectID: entry.projectID,
              sourceDirectory: entry.source,
              destinationDirectory: entry.destination,
            },
            db,
          )
          Project.finishPromotionCommit(
            { projectID: entry.projectID, operationID: entry.operationID, expectedGeneration: entry.projectGeneration },
            db,
          )
        })
      }
      await fs.rm(entry.staging, { recursive: true, force: true })
      if (await Filesystem.exists(entry.physicalSource)) {
        throw new Error(
          `Promotion recovery found an unknown source beside the published destination: ${entry.physicalSource}`,
        )
      }
      if (await Filesystem.exists(entry.quarantine)) {
        await assertDigest("Promotion quarantine", entry.quarantine, entry.sourceDigest)
        await fs.rm(entry.quarantine, { recursive: true, force: false })
      }
      if (!entry.terminal) {
        await PromotionJournal.settle(entry.operationID, "committed", {
          projectID: entry.projectID,
          projectGeneration: entry.projectGeneration,
          destinationDigest: entry.destinationDigest,
        })
      }
      ProjectDirectoryAdmission.settle(stagingAdmission.token!, () => undefined)
      ProjectDirectoryAdmission.settle(quarantineAdmission.token!, () => undefined)
      if (destinationAdmission.token && relocated) {
        ProjectDirectoryAdmission.settle(destinationAdmission.token, () => undefined)
      }
      Database.transaction((db) => releaseProjectMaintenanceFencesInTransaction(db, { operationID: entry.operationID }))
      const project = Project.get(entry.projectID)
      if (project) {
        GlobalBus.emit("event", {
          payload: { type: Project.Event.Updated.type, properties: project },
        })
      }
      return "forward"
    }
    return ProjectDirectoryAdmission.run(async () => {
      const admission = await ProjectDirectoryAdmission.acquire({
        directory: entry.physicalSource,
        operationID: entry.operationID,
        kind: "promotion_restore",
      })
      if (admission.outcome === "owned") {
        throw new Error(`Promotion restore ${entry.operationID} unexpectedly resolved as Project-owned admission`)
      }

      // The destination never published: the exact original source wins. Both
      // possible source locations are content-bound before any destructive step.
      // The durable directory admission remains owned across the filesystem
      // rename and the database restore, so creation recovery cannot observe
      // the transitional source as abandoned.
      await fs.rm(entry.staging, { recursive: true, force: true })
      const sourceExists = await Filesystem.exists(entry.physicalSource)
      const quarantineExists = await Filesystem.exists(entry.quarantine)
      if (sourceExists && quarantineExists) {
        throw new Error(
          `Promotion recovery found both source and quarantine; ownership is ambiguous and both were preserved`,
        )
      }
      if (!sourceExists) {
        if (!quarantineExists) {
          throw new Error(
            `Promotion recovery for ${entry.projectID} found neither source ${entry.physicalSource} nor quarantine ${entry.quarantine}`,
          )
        }
        await assertDigest("Promotion quarantine", entry.quarantine, entry.sourceDigest)
        await Filesystem.renameAfterTransientContention(entry.quarantine, entry.physicalSource)
      } else {
        await assertDigest("Promotion source", entry.physicalSource, entry.sourceDigest)
      }
      await afterPromotionSourceRestore?.()
      const relocated = Project.samePath(authority.worktree, entry.destination)
      if (relocated) assertDatabaseProjection(entry, "destination")
      else assertDatabaseProjection(entry, "source")
      ProjectDirectoryAdmission.settle(admission.token, (db) => {
        if (!relocated) return
        Project.beginPromotionCommit(
          { projectID: entry.projectID, operationID: entry.operationID, expectedGeneration: entry.projectGeneration },
          db,
        )
        Project.restoreRelocation(
          {
            projectID: entry.projectID,
            operationID: entry.operationID,
            expectedGeneration: entry.projectGeneration,
            expectedWorktree: entry.destination,
            worktree: entry.database.project.worktree,
            name: entry.database.project.name,
            sandboxes: entry.database.project.sandboxes,
            timeUpdated: entry.database.project.timeUpdated,
            directoryAdmission: admission.token,
          },
          db,
        )
        Session.restoreProjectRelocation(
          {
            projectID: entry.projectID,
            sourceDirectory: entry.source,
            destinationDirectory: entry.destination,
            snapshot: entry.database.sessions,
          },
          db,
        )
        Project.finishPromotionCommit(
          { projectID: entry.projectID, operationID: entry.operationID, expectedGeneration: entry.projectGeneration },
          db,
        )
      })
      if (!entry.terminal) {
        await PromotionJournal.settle(entry.operationID, "rolled_back", {
          projectID: entry.projectID,
          projectGeneration: entry.projectGeneration,
        })
      }
      ProjectDirectoryAdmission.settle(stagingAdmission.token!, () => undefined)
      ProjectDirectoryAdmission.settle(quarantineAdmission.token!, () => undefined)
      if (destinationAdmission.token) {
        ProjectDirectoryAdmission.settle(destinationAdmission.token, () => undefined)
      }
      Database.transaction((db) => releaseProjectMaintenanceFencesInTransaction(db, { operationID: entry.operationID }))
      return "backward" as const
    })
  }

  /** Converge every unsettled promotion occurrence — the startup owner. Runs
   *  before any Project directory is exposed to recovery or opening. */
  export async function recoverPromotions(): Promise<{ forward: number; backward: number; failures: string[] }> {
    const entries = await PromotionJournal.all()
    const fences = Database.use((db) =>
      db.select().from(ProjectMaintenanceFenceTable).where(eq(ProjectMaintenanceFenceTable.kind, "promotion")).all(),
    )
    const fencedOperations = new Set(fences.map((fence) => fence.operation_id))
    let forward = 0
    let backward = 0
    const failures: string[] = []
    for (const entry of entries) {
      // A historical terminal with no matching fence is already published and
      // may have changed legitimately. Only the exact terminal->database crash
      // window retains its promotion fence and requires replay.
      if (entry.terminal && !fencedOperations.has(entry.operationID)) continue
      try {
        const outcome = await PromotionJournal.withProjectOwner(entry.projectID, async () => {
          const current = entry.terminal
            ? await PromotionJournal.read(entry.operationID)
            : await PromotionJournal.get(entry.projectID)
          if (!current) return "absent" as const
          return convergePromotionJournalEntry(current)
        })
        if (outcome === "absent") continue
        if (outcome === "forward") forward += 1
        else backward += 1
      } catch (error) {
        failures.push(`${entry.projectID}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const operations = new Set(entries.map((entry) => entry.operationID))
    for (const fence of fences) {
      if (!operations.has(fence.operation_id)) {
        failures.push(`${fence.project_id}: promotion fence ${fence.operation_id} has no durable journal occurrence`)
      }
    }
    return { forward, backward, failures }
  }

  async function promoteOwned(
    input: z.infer<typeof PromotionInput> & { project: Project.Info; beforeMove?: () => Promise<void> },
  ) {
    const recovered = await recoverPromotionJournalEntry(input.project.id)
    if (recovered === "forward") {
      throw new Error(`Project ${input.project.id} already completed an earlier anonymous promotion`)
    }
    const configuredSource = path.resolve(input.project.worktree)
    const physicalSource = await fs.realpath(configuredSource)
    const source = configuredSource
    if (!isAnonymousDirectory(configuredSource)) {
      throw new PromotionError({
        message: `Only a canonical anonymous project can be converted: ${source}`,
        sourceDirectory: source,
        reason: "not_anonymous",
      })
    }
    if (
      input.name === "." ||
      input.name === ".." ||
      input.name.includes("/") ||
      input.name.includes("\\") ||
      input.name.includes("\0")
    ) {
      throw new PromotionError({
        message: "Project name must be one directory segment.",
        sourceDirectory: source,
        reason: "invalid_name",
      })
    }

    let destinationParent: string
    try {
      destinationParent = await fs.realpath(input.destinationParent)
      if (!(await fs.stat(destinationParent)).isDirectory()) throw new Error("not a directory")
    } catch (cause) {
      throw new PromotionError(
        {
          message: `Destination parent is not an existing directory: ${input.destinationParent}`,
          sourceDirectory: source,
          reason: "invalid_destination",
        },
        { cause },
      )
    }
    const destination = path.join(destinationParent, input.name)
    if (Filesystem.overlaps(source, destination)) {
      throw new PromotionError({
        message: "Anonymous source and named destination must not overlap.",
        sourceDirectory: source,
        destination,
        reason: "path_overlap",
      })
    }
    if (await Filesystem.exists(destination)) {
      throw new PromotionError({
        message: `Destination already exists: ${destination}`,
        sourceDirectory: source,
        destination,
        reason: "destination_exists",
      })
    }

    await input.beforeMove?.()
    const operationID = randomUUID()
    const quarantine = path.join(
      path.dirname(physicalSource),
      `.${path.basename(physicalSource)}.promoting-${operationID}`,
    )
    const staging = path.join(destinationParent, `.opencorvus-promoting-${operationID}`)
    const database = promotionDatabaseSnapshot(input.project.id)
    if (!Project.samePath(database.project.worktree, source)) {
      throw new Error(`Anonymous Project identity changed before promotion intent was recorded: ${input.project.id}`)
    }
    const sourceDigest = await PromotionJournal.digestDirectory(physicalSource)
    let published = false
    // The durable occurrence commits BEFORE the first rename: from this point
    // a process death leaves a journal whose recovery converges the physical
    // and database identities to exactly one side.
    await PromotionJournal.record({
      operationID,
      projectID: input.project.id,
      projectGeneration: database.project.generation,
      source,
      physicalSource,
      quarantine,
      staging,
      destination,
      name: input.name,
      sourceDigest,
      database,
      time_created: Date.now(),
    })
    const promotionAdmissions: ProjectDirectoryAdmission.Token[] = []
    const promotionPhysicalRevalidations: (() => Promise<void>)[] = []
    let destinationAdmission!: ProjectDirectoryAdmission.Token
    let quarantineAdmission!: ProjectDirectoryAdmission.Token
    let stagingAdmission!: ProjectDirectoryAdmission.Token
    try {
      const destinationOwnership = await captureProjectOwningInfo(destination)
      const decision = await ProjectDirectoryAdmission.acquire({
        directory: destination,
        operationID,
        kind: "promotion_publish",
        findOwner: destinationOwnership.findOwner,
      })
      if (decision.outcome === "owned") {
        throw new Project.RegisteredDirectoryConflictError({
          directory: destination,
          projectIDs: [input.project.id, decision.owner.project.id].sort(),
          message: `Promotion destination ${destination} is owned by Project ${decision.owner.project.id}`,
        })
      }
      destinationAdmission = decision.token
      promotionAdmissions.push(destinationAdmission)
      promotionPhysicalRevalidations.push(destinationOwnership.revalidatePhysical)
      for (const [directory, assign] of [
        [quarantine, (token: ProjectDirectoryAdmission.Token) => (quarantineAdmission = token)],
        [staging, (token: ProjectDirectoryAdmission.Token) => (stagingAdmission = token)],
      ] as const) {
        const workspaceOwnership = await captureProjectOwningInfo(directory)
        const workspace = await ProjectDirectoryAdmission.acquire({
          directory,
          operationID,
          kind: "promotion_workspace",
          findOwner: workspaceOwnership.findOwner,
        })
        if (workspace.outcome === "owned") {
          throw new Error(`Promotion workspace ${directory} is owned by Project ${workspace.owner.project.id}`)
        }
        assign(workspace.token)
        promotionAdmissions.push(workspace.token)
        promotionPhysicalRevalidations.push(workspaceOwnership.revalidatePhysical)
      }
      await afterPromotionAdmissions?.()
      for (const revalidate of promotionPhysicalRevalidations) await revalidate()
    } catch (cause) {
      for (const token of promotionAdmissions.reverse()) {
        ProjectDirectoryAdmission.settle(token, () => undefined)
      }
      await PromotionJournal.settle(operationID, "rolled_back", {
        projectID: input.project.id,
        projectGeneration: database.project.generation,
        reason: "promotion destination admission is closed",
      })
      throw cause
    }
    try {
      Database.immediateTransaction((db) => {
        const current = promotionDatabaseSnapshotInTransaction(db, input.project.id)
        if (!sameJson(current, database) || !Project.samePath(current.project.worktree, source)) {
          throw new Error(`Anonymous Project identity changed before promotion fencing: ${input.project.id}`)
        }
        const project = db.select().from(ProjectTable).where(eq(ProjectTable.id, input.project.id)).get()
        if (!project || project.generation !== database.project.generation) {
          throw new Error(`Project generation changed before promotion fencing: ${input.project.id}`)
        }
        ensureProjectPromotionFenceInTransaction(db, { project, operationID })
      })
    } catch (cause) {
      for (const token of promotionAdmissions.reverse()) {
        ProjectDirectoryAdmission.settle(token, () => undefined)
      }
      await PromotionJournal.settle(operationID, "rolled_back", {
        projectID: input.project.id,
        projectGeneration: database.project.generation,
        reason: "promotion admission changed before filesystem publication",
      })
      throw cause
    }
    try {
      for (const revalidate of promotionPhysicalRevalidations) await revalidate()
      await Filesystem.renameAfterTransientContention(physicalSource, quarantine)
      await fs.cp(quarantine, staging, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: true })
      await PromotionJournal.markPrepared(operationID, await PromotionJournal.digestDirectory(staging))
      await afterPromotionPrepared?.()
      await Filesystem.renameAfterTransientContention(staging, destination)
      published = true
      await PromotionJournal.markPublished(operationID)
    } catch (cause) {
      return rollbackPromotion({
        cause,
        projectID: input.project.id,
        database,
        physicalSource,
        destination,
        staging,
        quarantine,
        published,
        operationID,
      })
    }

    let preparedDigest: string
    try {
      const prepared = await PromotionJournal.get(input.project.id)
      if (!prepared?.destinationDigest) {
        throw new Error(`Published promotion has no prepared destination digest: ${destination}`)
      }
      preparedDigest = prepared.destinationDigest
      await assertDigest("Promotion prepared destination", destination, preparedDigest)
    } catch (cause) {
      return rollbackPromotion({
        cause,
        projectID: input.project.id,
        database,
        physicalSource,
        destination,
        staging,
        quarantine,
        published,
        operationID,
      })
    }

    try {
      ProjectDirectoryAdmission.settle(destinationAdmission, (db) => {
        Project.beginPromotionCommit(
          { projectID: input.project.id, operationID, expectedGeneration: database.project.generation },
          db,
        )
        Project.relocate(
          {
            projectID: input.project.id,
            operationID,
            expectedGeneration: database.project.generation,
            expectedWorktree: source,
            worktree: destination,
            name: input.name,
            sandboxes: input.project.sandboxes.map((item) => mappedDirectory(item, source, destination)),
            directoryAdmission: destinationAdmission,
          },
          db,
        )
        Session.relocateProject(
          {
            projectID: input.project.id,
            sourceDirectory: source,
            destinationDirectory: destination,
          },
          db,
        )
        Project.finishPromotionCommit(
          { projectID: input.project.id, operationID, expectedGeneration: database.project.generation },
          db,
        )
      })
    } catch (cause) {
      return rollbackPromotion({
        cause,
        projectID: input.project.id,
        database,
        physicalSource,
        destination,
        staging,
        quarantine,
        published,
        operationID,
      })
    }

    await assertDigest("Promotion quarantine", quarantine, sourceDigest)
    await fs.rm(quarantine, { recursive: true, force: false })
    await PromotionJournal.settle(operationID, "committed", {
      projectID: input.project.id,
      projectGeneration: database.project.generation,
      destinationDigest: preparedDigest,
    })
    ProjectDirectoryAdmission.settle(stagingAdmission, () => undefined)
    ProjectDirectoryAdmission.settle(quarantineAdmission, () => undefined)
    Database.transaction((db) => releaseProjectMaintenanceFencesInTransaction(db, { operationID }))
    const project = Project.get(input.project.id)
    if (!project) throw new Error(`Promoted project row disappeared: ${input.project.id}`)
    GlobalBus.emit("event", {
      payload: {
        type: Project.Event.Updated.type,
        properties: project,
      },
    })
    return PromotionResult.parse({ project, sourceDirectory: source, directory: destination, cleanupPending: false })
  }

  export function promote(
    input: z.infer<typeof PromotionInput> & { project: Project.Info; beforeMove?: () => Promise<void> },
  ) {
    return PromotionJournal.withProjectOwner(input.project.id, () => promoteOwned(input))
  }

  /** The exact production snapshot builder, for tests that construct the
   *  durable state a crash leaves behind. */
  export const PromotionTestHooks = {
    promotionDatabaseSnapshot,
    installAfterSourceRestore(hook: () => void | Promise<void>) {
      const previous = afterPromotionSourceRestore
      afterPromotionSourceRestore = hook
      return {
        [Symbol.dispose]() {
          if (afterPromotionSourceRestore === hook) afterPromotionSourceRestore = previous
        },
      }
    },
    installAfterAdmissions(hook: () => void | Promise<void>) {
      const previous = afterPromotionAdmissions
      afterPromotionAdmissions = hook
      return {
        [Symbol.dispose]() {
          if (afterPromotionAdmissions === hook) afterPromotionAdmissions = previous
        },
      }
    },
    installAfterPrepared(hook: () => void | Promise<void>) {
      const previous = afterPromotionPrepared
      afterPromotionPrepared = hook
      return {
        [Symbol.dispose]() {
          if (afterPromotionPrepared === hook) afterPromotionPrepared = previous
        },
      }
    },
  }

  export const Anonymous = z
    .object({
      directory: z.string(),
      project: Project.Info,
    })
    .meta({ ref: "AnonymousProject" })

  /**
   * Capture physical ownership outside SQLite, then revalidate the complete
   * ownership projection in the admission transaction. Registration tokens
   * cover a writer until its row commit; a committed alias/junction is found
   * through realpath keys, and any intervening row change makes deletion
   * undecidable rather than allowing a stale negative answer.
   */
  async function captureProjectOwningInfo(directory: string) {
    const rows = Database.runOutsideContext(() => Database.use((db) => db.select().from(ProjectTable).all()))
    const expected = Project.ownershipProjection(rows)
    const registered = rows
      .flatMap((row) => [
        { projectID: row.id, kind: "worktree" as const, directory: row.worktree },
        ...row.sandboxes.map((sandbox) => ({ projectID: row.id, kind: "sandbox" as const, directory: sandbox })),
      ])
      .sort((left, right) =>
        `${left.projectID}\0${left.kind}\0${left.directory}`.localeCompare(
          `${right.projectID}\0${right.kind}\0${right.directory}`,
        ),
      )
    const capturePhysical = async () => ({
      targetKey: await ProjectDirectoryAdmission.key(directory),
      registered: await Promise.all(
        registered.map(async (entry) => ({
          ...entry,
          directoryKey: await ProjectDirectoryAdmission.key(entry.directory),
        })),
      ),
    })
    const physical = await capturePhysical()
    const ownerIDs = [
      ...new Set(
        physical.registered
          .filter((entry) => ProjectDirectoryAdmission.overlaps(physical.targetKey, entry.directoryKey))
          .map((entry) => entry.projectID),
      ),
    ].sort()
    if (ownerIDs.length > 1) {
      throw new Project.RegisteredDirectoryConflictError({
        directory: path.resolve(directory),
        projectIDs: ownerIDs,
        message: `Physical directory ownership is ambiguous across Projects ${ownerIDs.join(", ")}`,
      })
    }
    const ownerID = ownerIDs[0]
    const exactWorktree = physical.registered.some(
      (entry) => entry.projectID === ownerID && entry.kind === "worktree" && entry.directoryKey === physical.targetKey,
    )
    return {
      findOwner(db: Database.TxOrDb): { project: Project.Info; relation: "worktree_exact" | "overlap" } | undefined {
        const currentRows = db.select().from(ProjectTable).all()
        if (!sameJson(Project.ownershipProjection(currentRows), expected)) {
          throw new Error(`Project directory ownership changed while admission was being prepared: ${directory}`)
        }
        const owner = currentRows.find((row) => row.id === ownerID)
        return owner
          ? { project: Project.fromRow(owner), relation: exactWorktree ? "worktree_exact" : "overlap" }
          : undefined
      },
      async revalidatePhysical() {
        const current = await capturePhysical()
        if (!sameJson(current, physical)) {
          throw new Error(`Physical Project directory ownership changed while admission was held: ${directory}`)
        }
      },
    }
  }

  /** Reclaim anonymous directories a dead process left without a Project row. */
  export async function convergeCreations(observe?: RuntimeProcessOccurrenceObserver) {
    return ImplicitProjectCreation.converge({
      isAnonymousDirectory,
      prepareProjectFor: async (directory) => {
        const ownership = await captureProjectOwningInfo(directory)
        return {
          findOwner: (db) => {
            const owner = ownership.findOwner(db)
            return owner ? { projectID: owner.project.id, relation: owner.relation } : undefined
          },
          revalidatePhysical: ownership.revalidatePhysical,
        }
      },
      observe,
    })
  }

  async function compensateCreation(input: {
    directory: string
    occurrenceID: string
    cause: unknown
  }): Promise<{ outcome: "committed"; project: Project.Info } | { outcome: "rolled_back" }> {
    return ProjectDirectoryAdmission.run(async () => {
      await beforeCreationCompensationLookup?.(input.directory)
      const ownership = await captureProjectOwningInfo(input.directory)
      const decision = await ProjectDirectoryAdmission.acquire({
        directory: input.directory,
        operationID: input.occurrenceID,
        kind: "reclamation",
        findOwner: ownership.findOwner,
      })
      if (decision.outcome === "owned") {
        try {
          await ownership.revalidatePhysical()
        } catch {
          throw input.cause
        }
        if (decision.owner.relation !== "worktree_exact") throw input.cause
        const project = decision.owner.project
        // Project.initGit may throw from work performed after fromDirectory has
        // committed. The durable row is business success; publish the missing
        // receipt when possible and return the canonical Project rather than
        // reporting failure or deleting its worktree.
        await ImplicitProjectCreation.commit(input.occurrenceID, project.id).catch((error) => {
          log.error("anonymous project creation receipt was not published during compensation", {
            directory: input.directory,
            projectID: project.id,
            error,
          })
        })
        return { outcome: "committed", project }
      }

      try {
        await ownership.revalidatePhysical()
      } catch (cause) {
        try {
          ProjectDirectoryAdmission.settle(decision.token, () => undefined)
        } catch (cleanupError) {
          throw new AggregateError([cause, cleanupError], "Project compensation admission cleanup failed", {
            cause,
          })
        }
        throw cause
      }
      await beforeCreationCompensationRemoval?.(input.directory)
      ProjectDirectoryAdmission.assertOwnedNow(decision.token)
      await fs.rm(input.directory, { recursive: true, force: true })
      ProjectDirectoryAdmission.assertOwnedNow(decision.token)
      ProjectDirectoryAdmission.settle(decision.token, () => undefined)
      // A rolled-back receipt is true only after the physical effect succeeds.
      // If removal or this write fails, the occurrence stays open for a later
      // backend to converge instead of losing its only recovery owner.
      await ImplicitProjectCreation.rollback(
        input.occurrenceID,
        input.cause instanceof Error ? input.cause.message : String(input.cause),
      )
      return { outcome: "rolled_back" }
    })
  }

  export async function create(input?: {
    directory?: string
    commitInTransaction?: (
      db: Database.TxOrDb,
      project: { id: string; generation: string; worktree: string; timeCreated: number },
    ) => void
  }) {
    // A creation killed before its Project row committed leaves a directory
    // nothing refers to. Sweep those first — but reclamation must never veto
    // creation. A journal directory this sweep cannot read (a corrupt intent,
    // a foreign entry, a directory Windows will not let it remove) would
    // otherwise make every later anonymous Project creation fail permanently.
    await convergeCreations().catch((error) => {
      log.error("anonymous project creation sweep failed", { error })
    })
    const now = new Date()
    const generatedParent = path.join(
      Global.Path.data,
      "projects",
      String(now.getFullYear()),
      calendarSegment(now.getMonth() + 1),
      calendarSegment(now.getDate()),
    )
    const directory = input?.directory ? path.resolve(input.directory) : path.join(generatedParent, randomUUID())
    if (!isAnonymousDirectory(directory)) {
      throw new Error(`Implicit Project directory is outside the managed anonymous namespace: ${directory}`)
    }
    const parent = path.dirname(directory)
    // The intent is durable before the directory exists: physical existence is
    // never the record that a creation started.
    const occurrenceID = await ImplicitProjectCreation.begin(directory)
    // Compensation may only undo a directory no Project row claims. Bounding
    // it by position is not enough: `Project.initGit` keeps working after
    // `fromDirectory` commits the row — it parses the result — so a throw from
    // that tail would delete the worktree of a Project that is already
    // durable. The row itself is the condition, checked when the compensation
    // actually runs, so no statement added later can quietly widen it.
    let initialized: Awaited<ReturnType<typeof Project.initGit>>
    try {
      await fs.mkdir(parent, { recursive: true })
      await fs.mkdir(directory)
      // Phases are diagnostic: `converge` decides from the payload, the owner
      // observation and the Project row, never from them. A journal hiccup
      // here must not send a healthy creation into the compensation path and
      // fail the user's request, exactly as it must not for `git_initialized`.
      await ImplicitProjectCreation.markDirectoryCreated(occurrenceID).catch((error) => {
        log.error("anonymous project creation phase was not recorded", { directory, error })
      })
      initialized = await Project.initGit(directory, { commitInTransaction: input?.commitInTransaction })
    } catch (error) {
      try {
        const compensation = await compensateCreation({ directory, occurrenceID, cause: error })
        if (compensation.outcome === "committed") {
          return { directory: compensation.project.worktree, project: compensation.project }
        }
      } catch (compensationError) {
        // A failed lookup or removal is undecidable, so retain both directory
        // and open occurrence. The original creation error remains the caller
        // contract; the compensation failure is durable through that journal
        // and visible in logs for the next convergence attempt.
        log.error("anonymous project creation compensation deferred", {
          directory,
          error: compensationError,
          cause: error,
        })
      }
      throw error
    }
    // The row is durable; the receipt only records that fact. A failure here
    // leaves an open occurrence whose directory a later sweep resolves through
    // its Project row, so it must not fail the creation either.
    await ImplicitProjectCreation.markGitInitialized(occurrenceID).catch((error) => {
      log.error("anonymous project creation phase was not recorded", { directory, error })
    })
    await ImplicitProjectCreation.commit(occurrenceID, initialized.project.id).catch((error) => {
      log.error("anonymous project creation receipt was not published", { directory, error })
    })
    return {
      directory: initialized.project.worktree,
      project: initialized.project,
    }
  }
}
