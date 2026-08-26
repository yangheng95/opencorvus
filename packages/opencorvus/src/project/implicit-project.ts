import { randomUUID } from "node:crypto"
import * as fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { GlobalBus } from "@/bus/global"
import { Global } from "@/global"
import { Database, eq } from "@/storage/db"
import { Session } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { Filesystem } from "@/util/filesystem"
import { PromotionJournal } from "./promotion-journal"
import { Project } from "./project"
import { ProjectTable } from "./project.sql"

function calendarSegment(value: number): string {
  return String(value).padStart(2, "0")
}

export namespace ImplicitProject {
  type PromotionDatabaseSnapshot = {
    project: {
      worktree: string
      name: string | null
      sandboxes: string[]
      generation: string
    }
    sessions: Array<{
      id: string
      directory: string
      metadata: Record<string, unknown> | null
    }>
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

  function promotionDatabaseSnapshot(projectID: string): PromotionDatabaseSnapshot {
    return Database.use((db) => {
      const project = db
        .select({
          worktree: ProjectTable.worktree,
          name: ProjectTable.name,
          sandboxes: ProjectTable.sandboxes,
          generation: ProjectTable.generation,
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
        })
        .from(SessionTable)
        .where(eq(SessionTable.project_id, projectID))
        .all()
      return { project, sessions }
    })
  }

  function sameJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right)
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
    const attempt = async (label: string, operation: () => Promise<void>) => {
      try {
        await operation()
      } catch (cause) {
        rollbackFailures.push(new Error(`Anonymous project promotion rollback failed to ${label}`, { cause }))
      }
    }

    await attempt("remove the staging directory", () => fs.rm(input.staging, { recursive: true, force: true }))
    if (input.published) {
      await attempt("remove the published destination", () =>
        fs.rm(input.destination, { recursive: true, force: true }),
      )
    }
    await attempt("restore the quarantined source", () =>
      Filesystem.renameAfterTransientContention(input.quarantine, input.physicalSource),
    )

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
    if (rollbackFailures.length === 0 && restored) {
      await attempt("settle the promotion journal rollback", () =>
        PromotionJournal.settle(input.operationID, "rolled_back", { projectID: input.projectID }),
      )
      if (rollbackFailures.length === 0) throw input.cause
    }
    throw new PromotionRollbackError(input.cause, rollbackFailures, residue, {
      source: input.physicalSource,
      destination: input.destination,
      staging: input.staging,
      quarantine: input.quarantine,
    })
  }

  async function recoverPromotionJournalEntry(projectID: string): Promise<"absent" | "forward" | "backward"> {
    const entry = await PromotionJournal.get(projectID)
    if (!entry) return "absent"
    return convergePromotionJournalEntry(entry)
  }

  async function convergePromotionJournalEntry(entry: PromotionJournal.Entry): Promise<"forward" | "backward"> {
    const authority = Database.use((db) =>
      db
        .select({
          generation: ProjectTable.generation,
          worktree: ProjectTable.worktree,
          sandboxes: ProjectTable.sandboxes,
        })
        .from(ProjectTable)
        .where(eq(ProjectTable.id, entry.projectID))
        .get(),
    )
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
    if (destinationExists) {
      if (!entry.destinationDigest) {
        throw new Error(`Promotion journal destination has no prepared content digest: ${entry.destination}`)
      }
      const destinationDigest = await PromotionJournal.digestDirectory(entry.destination)
      if (destinationDigest !== entry.destinationDigest) {
        throw new Error(
          `Promotion journal destination digest mismatch: expected ${entry.destinationDigest}, received ${destinationDigest}`,
        )
      }
      // The destination was published: the new identity wins. Completing the
      // database relocation is idempotent — a crash after the commit but
      // before the journal cleared re-runs it as a no-op.
      Database.transaction((db) => {
        Project.relocate(
          {
            projectID: entry.projectID,
            worktree: entry.destination,
            name: entry.name,
            sandboxes: authority.sandboxes.map((item) => mappedDirectory(item, entry.source, entry.destination)),
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
      })
      await fs.rm(entry.staging, { recursive: true, force: true })
      await fs.rm(entry.quarantine, { recursive: true, force: true })
      await PromotionJournal.settle(entry.operationID, "committed", {
        projectID: entry.projectID,
        projectGeneration: entry.projectGeneration,
        destinationDigest,
      })
      const project = Project.get(entry.projectID)
      if (project) {
        GlobalBus.emit("event", {
          payload: { type: Project.Event.Updated.type, properties: project },
        })
      }
      return "forward"
    }
    // The destination never published: the old identity wins. The staging tree
    // is discarded and the quarantined source moves back.
    await fs.rm(entry.staging, { recursive: true, force: true })
    const sourceExists = await Filesystem.exists(entry.physicalSource)
    if (!sourceExists) {
      if (!(await Filesystem.exists(entry.quarantine))) {
        throw new Error(
          `Promotion recovery for ${entry.projectID} found neither source ${entry.physicalSource} nor quarantine ${entry.quarantine}`,
        )
      }
      await Filesystem.renameAfterTransientContention(entry.quarantine, entry.physicalSource)
    } else {
      await fs.rm(entry.quarantine, { recursive: true, force: true })
    }
    await PromotionJournal.settle(entry.operationID, "rolled_back", {
      projectID: entry.projectID,
      projectGeneration: entry.projectGeneration,
    })
    return "backward"
  }

  /** Converge every unsettled promotion occurrence — the startup owner. Runs
   *  before any Project directory is exposed to recovery or opening. */
  export async function recoverPromotions(): Promise<{ forward: number; backward: number; failures: string[] }> {
    const entries = await PromotionJournal.all()
    let forward = 0
    let backward = 0
    const failures: string[] = []
    for (const entry of entries) {
      try {
        const outcome = await convergePromotionJournalEntry(entry)
        if (outcome === "forward") forward += 1
        else backward += 1
      } catch (error) {
        failures.push(`${entry.projectID}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return { forward, backward, failures }
  }

  export async function promote(
    input: z.infer<typeof PromotionInput> & { project: Project.Info; beforeMove?: () => Promise<void> },
  ) {
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

    // A crash-interrupted earlier promotion of this Project converges first;
    // its journal entry is the durable authority on which identity survives.
    await recoverPromotionJournalEntry(input.project.id)
    await input.beforeMove?.()
    const quarantine = path.join(
      path.dirname(physicalSource),
      `.${path.basename(physicalSource)}.promoting-${randomUUID()}`,
    )
    const staging = path.join(destinationParent, `.opencorvus-promoting-${randomUUID()}`)
    const database = promotionDatabaseSnapshot(input.project.id)
    const operationID = randomUUID()
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
      time_created: Date.now(),
    })
    try {
      await Filesystem.renameAfterTransientContention(physicalSource, quarantine)
      await fs.cp(quarantine, staging, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: true })
      await PromotionJournal.markPrepared(operationID, await PromotionJournal.digestDirectory(staging))
      await Filesystem.renameAfterTransientContention(staging, destination)
      published = true
      await PromotionJournal.markPublished(operationID)

      Database.transaction((db) => {
        const relocated = Project.relocate(
          {
            projectID: input.project.id,
            worktree: destination,
            name: input.name,
            sandboxes: input.project.sandboxes.map((item) => mappedDirectory(item, source, destination)),
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
        return relocated
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

    const cleanupPending = await fs.rm(quarantine, { recursive: true, force: true }).then(
      () => false,
      () => true,
    )
    if (!cleanupPending) {
      await PromotionJournal.settle(operationID, "committed", {
        projectID: input.project.id,
        projectGeneration: database.project.generation,
        destinationDigest: await PromotionJournal.digestDirectory(destination),
      })
    }
    const project = Project.get(input.project.id)
    if (!project) throw new Error(`Promoted project row disappeared: ${input.project.id}`)
    GlobalBus.emit("event", {
      payload: {
        type: Project.Event.Updated.type,
        properties: project,
      },
    })
    return PromotionResult.parse({ project, sourceDirectory: source, directory: destination, cleanupPending })
  }

  export const Anonymous = z
    .object({
      directory: z.string(),
      project: Project.Info,
    })
    .meta({ ref: "AnonymousProject" })

  export async function create() {
    const now = new Date()
    const parent = path.join(
      Global.Path.data,
      "projects",
      String(now.getFullYear()),
      calendarSegment(now.getMonth() + 1),
      calendarSegment(now.getDate()),
    )
    const directory = path.join(parent, randomUUID())
    await fs.mkdir(parent, { recursive: true })
    await fs.mkdir(directory)
    try {
      const initialized = await Project.initGit(directory)
      return {
        directory: initialized.project.worktree,
        project: initialized.project,
      }
    } catch (error) {
      await fs.rm(directory, { recursive: true, force: true })
      throw error
    }
  }
}
