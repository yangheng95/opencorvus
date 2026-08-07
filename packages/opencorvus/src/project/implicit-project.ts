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
    if (rollbackFailures.length === 0 && restored) throw input.cause
    throw new PromotionRollbackError(input.cause, rollbackFailures, residue, {
      source: input.physicalSource,
      destination: input.destination,
      staging: input.staging,
      quarantine: input.quarantine,
    })
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

    await input.beforeMove?.()
    const quarantine = path.join(
      path.dirname(physicalSource),
      `.${path.basename(physicalSource)}.promoting-${randomUUID()}`,
    )
    const staging = path.join(destinationParent, `.opencorvus-promoting-${randomUUID()}`)
    const database = promotionDatabaseSnapshot(input.project.id)
    let published = false
    await Filesystem.renameAfterTransientContention(physicalSource, quarantine)
    try {
      await fs.cp(quarantine, staging, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: true })
      await Filesystem.renameAfterTransientContention(staging, destination)
      published = true

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
      })
    }

    const cleanupPending = await fs.rm(quarantine, { recursive: true, force: true }).then(
      () => false,
      () => true,
    )
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
        discard: async () => {
          await fs.rm(directory, { recursive: true, force: true })
          Project.deleteRows([initialized.project.id])
        },
      }
    } catch (error) {
      await fs.rm(directory, { recursive: true, force: true })
      throw error
    }
  }
}
