import { Slug } from "@opencorvus-ai/util/slug"
import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Decimal } from "decimal.js"
import z from "zod"
import { type LanguageModelUsage, type ProviderMetadata } from "ai"
import { Config } from "../config/config"
import { Flag } from "../flag/flag"
import { Identifier } from "../id/id"
import { Installation } from "../installation"

import { Database, NotFoundError, eq, and, gte, isNull, desc, like, inArray, or, sql } from "../storage/db"
import type { SQL } from "../storage/db"
import { SessionTable, MessageTable, PartTable, SESSION_KINDS, type PartData, type SessionKind } from "./session.sql"
import { ProjectTable } from "../project/project.sql"
import { Project } from "../project/project"
import { Log } from "../util/log"
import { Message } from "./message"
import { MessageStore } from "./message-store"
import { SessionEvents } from "./events"
import { Instance } from "../project/instance"
import path from "path"
import { fn } from "@/util/fn"
import { Snapshot } from "@/snapshot"
import { Filesystem } from "@/util/filesystem"
import { ProjectRuntimePaths } from "@/project/runtime-paths"

import type { Provider } from "@/provider/provider"
import { CapabilityRules } from "@/capability/rules"
import { iife } from "@/util/iife"
import { NamedError } from "@opencorvus-ai/util/error"
import { timelineMessageOrderKey, timelinePartOrderKey } from "@/timeline/order"
import { inlineBase64DataUrlMatch, inlineBase64DataUrlSnippet } from "@/util/inline-base64"
import { withKeyedLock } from "@/util/lock"
import { SessionControl } from "./control"
import { CompactionHandoff } from "./compaction-handoff"
import { SessionStatus as SessionStatusLifecycle } from "./status"
import { SessionPromptState } from "./prompt/state"
import { PermissionAuthority } from "@/permission/authority"
import {
  TaskPromptProfileImmutableError,
  requireTaskPackageRevisionBinding,
  requireTaskResolvedPackageRevision,
} from "@/engine/task-package-revision-binding"
import { ProjectMemory } from "@/memory/project-memory"

export namespace Session {
  const log = Log.create({ service: "session" })

  const parentTitlePrefix = "New session - "
  const childTitlePrefix = "Child session - "

  function createDefaultTitle(isChild = false) {
    return (isChild ? childTitlePrefix : parentTitlePrefix) + new Date().toISOString()
  }

  export function isDefaultTitle(title: string) {
    return new RegExp(
      `^(${parentTitlePrefix}|${childTitlePrefix})\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$`,
    ).test(title)
  }

  type SessionRow = typeof SessionTable.$inferSelect

  export function fromRow(row: SessionRow): Info {
    const summary =
      row.summary_additions !== null || row.summary_deletions !== null || row.summary_files !== null
        ? {
            additions: row.summary_additions ?? 0,
            deletions: row.summary_deletions ?? 0,
            files: row.summary_files ?? 0,
          }
        : undefined
    const share = row.share_url ? { url: row.share_url } : undefined
    return {
      id: row.id,
      slug: row.slug,
      projectID: row.project_id,
      directory: row.directory,
      parentID: row.parent_id ?? undefined,
      title: row.title,
      version: row.version,
      kind: row.kind,
      metadata: row.metadata ?? undefined,
      summary,
      share,
      permission: row.permission ?? undefined,
      time: {
        created: row.time_created,
        updated: row.time_updated,
        compacting: row.time_compacting ?? undefined,
        archived: row.time_archived ?? undefined,
        pinned: row.time_pinned ?? undefined,
      },
    }
  }

  function relocatedDirectory(value: string, source: string, destination: string): string {
    if (!Filesystem.contains(source, value)) return value
    return path.join(destination, path.relative(source, value))
  }

  function relocatedMetadata(metadata: Record<string, unknown> | null, source: string, destination: string) {
    if (!metadata) return metadata
    const mission = metadata.mission
    if (!mission || typeof mission !== "object" || Array.isArray(mission)) return metadata
    const cwd = (mission as Record<string, unknown>).cwd
    if (typeof cwd !== "string" || !Filesystem.contains(source, cwd)) return metadata
    return {
      ...metadata,
      mission: {
        ...(mission as Record<string, unknown>),
        cwd: relocatedDirectory(cwd, source, destination),
      },
    }
  }

  export function relocateProject(
    input: {
      projectID: string
      sourceDirectory: string
      destinationDirectory: string
    },
    db: Database.TxOrDb,
  ) {
    const rows = db.select().from(SessionTable).where(eq(SessionTable.project_id, input.projectID)).all()
    const updatedAt = Date.now()
    for (const row of rows) {
      db.update(SessionTable)
        .set({
          directory: relocatedDirectory(row.directory, input.sourceDirectory, input.destinationDirectory),
          metadata: relocatedMetadata(row.metadata, input.sourceDirectory, input.destinationDirectory),
          time_updated: updatedAt,
        })
        .where(eq(SessionTable.id, row.id))
        .run()
    }
  }

  export function toRow(info: Info) {
    return {
      id: info.id,
      project_id: info.projectID,
      parent_id: info.parentID,
      slug: info.slug,
      directory: info.directory,
      title: info.title,
      version: info.version,
      kind: info.kind,
      metadata: info.metadata ?? null,
      share_url: info.share?.url,
      summary_additions: info.summary?.additions,
      summary_deletions: info.summary?.deletions,
      summary_files: info.summary?.files,
      permission: info.permission,
      time_created: info.time.created,
      time_updated: info.time.updated,
      time_compacting: info.time.compacting,
      time_archived: info.time.archived,
      time_pinned: info.time.pinned,
    }
  }

  function getForkedTitle(title: string): string {
    const match = title.match(/^(.+) \(fork #(\d+)\)$/)
    if (match) {
      const base = match[1]
      const num = parseInt(match[2], 10)
      return `${base} (fork #${num + 1})`
    }
    return `${title} (fork #1)`
  }

  export const Info = z
    .object({
      id: Identifier.schema("session"),
      slug: z.string(),
      projectID: z.string(),
      directory: z.string(),
      parentID: Identifier.schema("session").optional(),
      summary: z
        .object({
          additions: z.number(),
          deletions: z.number(),
          files: z.number(),
        })
        .optional(),
      share: z
        .object({
          url: z.string(),
        })
        .optional(),
      title: z.string(),
      version: z.string(),
      /** Session's role/purpose, fixed at creation. Authoritative source of
       *  "what is this session for"; UI channel routing reads this column
       *  directly. See SessionKind in session.sql.ts. */
      kind: z.enum(SESSION_KINDS),
      /** Free-form per-session state. */
      metadata: z.record(z.string(), z.any()).optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
        compacting: z.number().optional(),
        archived: z.number().optional(),
        pinned: z.number().optional(),
      }),
      permission: CapabilityRules.Ruleset.optional(),
    })
    .meta({
      ref: "Session",
    })
  export type Info = z.output<typeof Info>

  export const ProjectInfo = z
    .object({
      id: z.string(),
      name: z.string().optional(),
      worktree: z.string(),
    })
    .meta({
      ref: "ProjectSummary",
    })
  export type ProjectInfo = z.output<typeof ProjectInfo>

  export const GlobalInfo = Info.extend({
    project: ProjectInfo.nullable(),
  }).meta({
    ref: "GlobalSession",
  })
  export type GlobalInfo = z.output<typeof GlobalInfo>

  export const Event = {
    Created: BusEvent.define(
      "session.created",
      z.object({
        info: Info,
      }),
    ),
    Updated: BusEvent.define(
      "session.updated",
      z.object({
        info: Info,
      }),
    ),
    Deleted: BusEvent.define(
      "session.deleted",
      z.object({
        info: Info,
      }),
    ),
    Diff: BusEvent.define(
      "session.diff",
      z.object({
        sessionID: z.string(),
        diff: Snapshot.FileDiff.array(),
      }),
    ),
    ConfigChanged: BusEvent.define(
      "config.changed",
      z.object({
        sessionID: z.string(),
      }),
    ),
    Error: SessionEvents.Error,
  }

  export const create = fn(
    z.object({
      kind: Info.shape.kind,
      parentID: Identifier.schema("session").optional(),
      title: z.string().optional(),
      permission: Info.shape.permission,
      metadata: Info.shape.metadata,
    }),
    async (input) => {
      return createNext({
        kind: input.kind,
        parentID: input.parentID,
        directory: Instance.directory,
        title: input.title,
        permission: input.permission,
        metadata: input.metadata,
      })
    },
  )

  export const fork = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
    }),
    async (input) => {
      const original = await getInProject({ sessionID: input.sessionID, projectID: Instance.project.id })
      if (!original) throw new Error("session not found")
      const title = getForkedTitle(original.title)
      // Forking preserves the original physical Session kind while creating a
      // new Session identity and parent edge.
      const session = await createNext({
        directory: Instance.directory,
        parentID: input.sessionID,
        kind: original.kind,
        title,
      })
      const msgs = await messages({ sessionID: input.sessionID })
      const idMap = new Map<string, string>()

      for (const msg of msgs) {
        if (input.messageID && msg.info.id >= input.messageID) break
        const newID = Identifier.ascending("message")
        idMap.set(msg.info.id, newID)

        const parentID = msg.info.role === "assistant" && msg.info.parentID ? idMap.get(msg.info.parentID) : undefined
        const { orderKey: _clonedMessageOrderKey, ...messageInfo } = msg.info
        const cloned = await updateMessage({
          ...messageInfo,
          sessionID: session.id,
          id: newID,
          ...(parentID && { parentID }),
        })

        for (const part of msg.parts) {
          const { orderKey: _clonedPartOrderKey, ...partInfo } = part
          await updatePart({
            ...partInfo,
            id: Identifier.ascending("part"),
            messageID: cloned.id,
            sessionID: session.id,
          })
        }
      }
      return session
    },
  )

  export const touch = fn(Identifier.schema("session"), async (sessionID) => {
    const now = Date.now()
    Database.transaction((db) => {
      const row = db
        .update(SessionTable)
        .set({ time_updated: now })
        .where(eq(SessionTable.id, sessionID))
        .returning()
        .get()
      if (!row) throw new NotFoundError({ message: `Session not found: ${sessionID}` })
      const info = fromRow(row)
      Bus.publishOwnedInTransaction(Event.Updated, { info })
    })
  })

  type PrepareNextInput = {
    /** Required. The session's role/purpose — see SessionKind in session.sql.ts.
     *  Authoritative for UI channel routing. There is NO default: every
     *  caller must state what the session is for. */
    kind: SessionKind
    id?: string
    title?: string
    parentID?: string
    directory: string
    permission?: CapabilityRules.Ruleset
    metadata?: Record<string, unknown>
  }

  function preparedNextInfo(input: PrepareNextInput): Info {
    return {
      id: Identifier.descending("session", input.id),
      slug: Slug.create(),
      version: Installation.VERSION,
      projectID: Instance.project.id,
      directory: input.directory,
      parentID: input.parentID,
      title: input.title ?? createDefaultTitle(!!input.parentID),
      kind: input.kind,
      metadata: input.metadata,
      permission: input.permission,
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    }
  }

  /** Prepare a root Session synchronously for an enclosing domain identity
   * transaction. Child creation must use `prepareNext` so lineage admission
   * is checked before persistence. */
  export function prepareRootNext(input: Omit<PrepareNextInput, "parentID"> & { parentID?: never }): Info {
    return preparedNextInfo(input)
  }

  export async function prepareNext(input: PrepareNextInput) {
    if (input.parentID) {
      const lineage = await lineageInProject({ sessionID: input.parentID, projectID: Instance.project.id })
      const { SessionPromptState } = await import("./prompt/state")
      SessionPromptState.assertSessionCreationAllowed(lineage.map((session) => session.id))
    }
    return preparedNextInfo(input)
  }

  /** Persist one exact prepared Session in the caller's active transaction.
   * This is the sole physical insert/event authority; domain find-or-create
   * operations may reserve a writer and call it without opening a second
   * transaction around their identity read. */
  export function persistPreparedNextInTransaction(db: Database.TxOrDb, result: Info): Info {
    Project.assertDurableAdmissionOpen(result.projectID)
    db.insert(SessionTable).values(toRow(result)).run()
    log.info("created", result)
    Bus.publishOwnedInTransaction(Event.Created, { info: result })
    Bus.publishOwnedInTransaction(Event.Updated, { info: result })
    return result
  }

  /** Persist one exact prepared Session in its own transaction. */
  export function persistPreparedNext(result: Info): Info {
    return Database.transaction((db) => persistPreparedNextInTransaction(db, result))
  }

  export async function createNext(input: Parameters<typeof prepareNext>[0]) {
    return persistPreparedNext(await prepareNext(input))
  }

  const SessionProjectInput = z.object({
    sessionID: Identifier.schema("session"),
    projectID: z.string().min(1),
  })

  async function lineageInProject({ sessionID, projectID }: z.output<typeof SessionProjectInput>): Promise<Info[]> {
    const lineage: Info[] = []
    let current = await getInProject({ sessionID, projectID })
    for (let hops = 0; ; hops++) {
      lineage.push(current)
      if (!current.parentID) return lineage
      if (hops >= 63) {
        throw new Error(`Session parent chain for ${sessionID} exceeds 64 hops`)
      }
      current = await getInProject({ sessionID: current.parentID, projectID })
    }
  }

  export const getInProject = fn(SessionProjectInput, async ({ sessionID, projectID }) => {
    const row = Database.use((db) =>
      db
        .select()
        .from(SessionTable)
        .where(and(eq(SessionTable.id, sessionID), eq(SessionTable.project_id, projectID)))
        .get(),
    )
    if (!row) throw new NotFoundError({ message: `Session not found: ${sessionID}` })
    return fromRow(row)
  })

  export const assertLineageInProject = fn(SessionProjectInput, async ({ sessionID, projectID }) => {
    return (await lineageInProject({ sessionID, projectID }))[0]
  })

  export const get = fn(Identifier.schema("session"), async (id) => {
    const row = Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, id)).get())
    if (!row) throw new NotFoundError({ message: `Session not found: ${id}` })
    return fromRow(row)
  })

  export const setTitle = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      title: z.string(),
    }),
    async (input) => {
      return Database.transaction((db) => {
        const row = db
          .update(SessionTable)
          .set({ title: input.title, time_updated: Date.now() })
          .where(eq(SessionTable.id, input.sessionID))
          .returning()
          .get()
        if (!row) throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
        const info = fromRow(row)
        Bus.publishOwnedInTransaction(Event.Updated, { info })
        return info
      })
    },
  )

  /**
   * A session config overlay (model / prompt / temperature) is owned by the
   * ROOT session only (task root or standalone root) — R5.1 item 2. Child
   * execution sessions run normally but never own a config overlay; they
   * inherit the task-root overlay at resolution time (R5.1 item 5). The
   * settings UI must target the root session, so both GET and PATCH of the
   * session config reject a child session here (single guard, rule 8).
   */
  export const ChildSessionConfigError = NamedError.create(
    "ChildSessionConfigError",
    z.object({
      sessionID: z.string(),
      parentID: z.string(),
      message: z.string(),
    }),
  )

  export function assertConfigurableRoot(session: Info): void {
    if (session.parentID) {
      throw new ChildSessionConfigError({
        sessionID: session.id,
        parentID: session.parentID,
        message:
          `Session ${session.id} is a child session (parent ${session.parentID}); ` +
          `it does not own a config overlay. Target its root session for model/prompt settings.`,
      })
    }
  }

  function assertNoStoredConfigOverlayNull(value: unknown, path = "configOverlay"): void {
    if (value === null) {
      throw new Error(
        `Stored session overlay contains a null at ${path}; ` +
          `configOverlay must be normalized before it is persisted.`,
      )
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        assertNoStoredConfigOverlayNull(child, `${path}.${key}`)
      }
    }
  }

  /**
   * Merge `patch` into `session.metadata`, preserving keys not listed in patch.
   * Atomic at row-level (single UPDATE under transaction). Caller-side merges
   * race with concurrent writers; collapse all metadata writes for one session
   * through the same code path to avoid lost updates.
   */
  const MetadataPatchInput = z.object({
    sessionID: Identifier.schema("session"),
    patch: z.record(z.string(), z.any()),
  })

  function mergeMetadataInTransaction(db: Database.TxOrDb, input: z.output<typeof MetadataPatchInput>): Info {
    const row = db.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get()
    if (!row) throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
    const current = (row.metadata ?? {}) as Record<string, unknown>
    const next = { ...current, ...input.patch }
    const updated = db
      .update(SessionTable)
      .set({ metadata: next })
      .where(eq(SessionTable.id, input.sessionID))
      .returning()
      .get()!
    const info = fromRow(updated)
    Bus.publishOwnedInTransaction(Event.Updated, { info })
    return info
  }

  export const mergeMetadata = fn(MetadataPatchInput, async (input) =>
    Database.transaction((db) => mergeMetadataInTransaction(db, input)),
  )

  const MergeConfigOverlayInput = z.object({
    sessionID: Identifier.schema("session"),
    patch: Config.Overlay,
  })

  const configOverlayLocks = new Map<string, Promise<unknown>>()

  export const mergeConfigOverlayInProject = fn(
    MergeConfigOverlayInput.extend({
      projectID: z.string().min(1),
    }),
    async (input) => {
      const lockKey = `${input.projectID}:${input.sessionID}`
      return withKeyedLock(configOverlayLocks, lockKey, async () => {
        const initialRow = Database.use((db) =>
          db
            .select()
            .from(SessionTable)
            .where(and(eq(SessionTable.id, input.sessionID), eq(SessionTable.project_id, input.projectID)))
            .get(),
        )
        if (!initialRow) throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
        const initialSession = fromRow(initialRow)
        assertConfigurableRoot(initialSession)
        const stored = (initialRow.metadata as Record<string, unknown> | null | undefined)?.configOverlay ?? {}
        assertNoStoredConfigOverlayNull(stored)
        const current = Config.Overlay.parse(stored)
        const owningProject = Project.get(input.projectID)
        if (!owningProject) throw new NotFoundError({ message: `Project not found: ${input.projectID}` })
        const capabilityProjectDirectory = owningProject.worktree
        const baseConfig = await Instance.provide({ directory: capabilityProjectDirectory, fn: () => Config.get() })
        const { nextOverlay, effective } = Config.previewOverlayUpdate(baseConfig, current, input.patch)
        const currentProfileID = Config.mergeOverlay(baseConfig, current).prompt_profile.active
        const nextProfileID = effective.prompt_profile.active
        assertNoStoredConfigOverlayNull(nextOverlay)
        const engineSql = await import("@/engine/engine.sql")
        const initialTask = Database.use((db) =>
          db
            .select({ id: engineSql.EngineTaskTable.id })
            .from(engineSql.EngineTaskTable)
            .where(
              and(
                eq(engineSql.EngineTaskTable.session_id, input.sessionID),
                eq(engineSql.EngineTaskTable.project_id, input.projectID),
              ),
            )
            .get(),
        )
        const assertPinnedTaskProfile = (taskID: string, db?: Database.TxOrDb) => {
          const pinnedPackageRevision = requireTaskPackageRevisionBinding(taskID, db)
          if (nextProfileID === pinnedPackageRevision.id) return
          throw new TaskPromptProfileImmutableError({
            message: `Task ${taskID} is permanently bound to expert squad ${pinnedPackageRevision.id}`,
            taskID,
            pinnedPackageRevision,
            requestedProfileID: nextProfileID,
          })
        }
        if (initialTask) assertPinnedTaskProfile(initialTask.id)
        if (input.patch.skill_mounts !== undefined || currentProfileID !== nextProfileID) {
          const { PromptProfileResolver } = await import("@/expert-squad/prompt-profile-resolver")
          await PromptProfileResolver.assertSkillMountConfig({
            projectDirectory: capabilityProjectDirectory,
            config: effective,
            packageRevision: initialTask ? requireTaskResolvedPackageRevision(initialTask.id) : undefined,
          })
        }
        return Database.transaction((db) => {
          const row = db
            .select()
            .from(SessionTable)
            .where(and(eq(SessionTable.id, input.sessionID), eq(SessionTable.project_id, input.projectID)))
            .get()
          if (!row) throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
          assertConfigurableRoot(fromRow(row))
          const transactionStored = (row.metadata as Record<string, unknown> | null | undefined)?.configOverlay ?? {}
          assertNoStoredConfigOverlayNull(transactionStored)
          if (JSON.stringify(Config.Overlay.parse(transactionStored)) !== JSON.stringify(current)) {
            throw new Error(`Session config overlay changed while validating ${input.sessionID}.`)
          }
          const task = db
            .select({ id: engineSql.EngineTaskTable.id })
            .from(engineSql.EngineTaskTable)
            .where(
              and(
                eq(engineSql.EngineTaskTable.session_id, input.sessionID),
                eq(engineSql.EngineTaskTable.project_id, input.projectID),
              ),
            )
            .get()
          if (task) {
            assertPinnedTaskProfile(task.id, db)
          }
          const committedOverlay = task
            ? Config.Overlay.parse({
                ...nextOverlay,
                prompt_profile: { active: nextProfileID },
              })
            : nextOverlay
          const metadata = {
            ...((row.metadata ?? {}) as Record<string, unknown>),
            configOverlay: committedOverlay,
          }
          const updated = db
            .update(SessionTable)
            .set({ metadata, time_updated: Date.now() })
            .where(and(eq(SessionTable.id, input.sessionID), eq(SessionTable.project_id, input.projectID)))
            .returning()
            .get()!
          const info = fromRow(updated)
          Bus.publishOwnedInTransaction(Event.Updated, { info })
          Bus.publishOwnedInTransaction(Event.ConfigChanged, { sessionID: input.sessionID })
          return info
        })
      })
    },
  )

  export const mergeConfigOverlay = fn(MergeConfigOverlayInput, async (input) => {
    return mergeConfigOverlayInProject({ ...input, projectID: Instance.project.id })
  })

  export const setArchived = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      time: z.number().nullable(),
    }),
    async (input) => {
      return Database.transaction((db) => {
        const row = db
          .update(SessionTable)
          .set({ time_archived: input.time, time_updated: Date.now() })
          .where(eq(SessionTable.id, input.sessionID))
          .returning()
          .get()
        if (!row) throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
        const info = fromRow(row)
        Bus.publishOwnedInTransaction(Event.Updated, { info })
        return info
      })
    },
  )

  export const setPinned = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      time: z.number().nullable(),
    }),
    async (input) => {
      return Database.transaction((db) => {
        const row = db
          .update(SessionTable)
          .set({
            time_pinned: input.time,
            time_updated: sql`${SessionTable.time_updated}`,
          })
          .where(eq(SessionTable.id, input.sessionID))
          .returning()
          .get()
        if (!row) throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
        const info = fromRow(row)
        Bus.publishOwnedInTransaction(Event.Updated, { info })
        return info
      })
    },
  )

  export const setPermission = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      permission: CapabilityRules.Ruleset,
    }),
    async (input) => {
      return Database.transaction((db) => {
        const row = db
          .update(SessionTable)
          .set({ permission: input.permission, time_updated: Date.now() })
          .where(eq(SessionTable.id, input.sessionID))
          .returning()
          .get()
        if (!row) throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
        const info = fromRow(row)
        Bus.publishOwnedInTransaction(Event.Updated, { info })
        return info
      })
    },
  )

  export const setSummary = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      summary: Info.shape.summary,
    }),
    async (input) => {
      return Database.transaction((db) => {
        const row = db
          .update(SessionTable)
          .set({
            summary_additions: input.summary?.additions,
            summary_deletions: input.summary?.deletions,
            summary_files: input.summary?.files,
            time_updated: Date.now(),
          })
          .where(eq(SessionTable.id, input.sessionID))
          .returning()
          .get()
        if (!row) throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
        const info = fromRow(row)
        Bus.publishOwnedInTransaction(Event.Updated, { info })
        return info
      })
    },
  )

  export const diff = fn(Identifier.schema("session"), async (sessionID) => {
    const target = ProjectRuntimePaths.sessionDiffPath(Instance.directory, Instance.project.id, sessionID)
    try {
      return await Filesystem.readJson<Snapshot.FileDiff[]>(target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return []
      throw error
    }
  })

  export const messages = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      limit: z.number().optional(),
    }),
    async (input) => {
      const result = [] as Message.WithParts[]
      for await (const msg of MessageStore.stream(input.sessionID)) {
        if (input.limit && result.length >= input.limit) break
        result.push(msg)
      }
      result.reverse()
      return result
    },
  )

  /**
   * Observe one exact assistant-message fact for fact-check binding.
   *
   * Completion belongs to the addressed message rather than to a mutable
   * Session lifecycle projection. `contentHash` is SHA-256 (Secure Hash
   * Algorithm 256-bit) over the exact canonical text supplied to fact-check.
   * The parent user message supplies the worker-turn descriptor reference
   * that authored this response.
   */
  export const snapshotAssistantMessage = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }),
    async (
      input,
    ): Promise<{
      finished: boolean
      messageID?: string
      contentHash?: string
      agentID?: string
      workerTurnDescriptor?: { id: string; hash: string }
      reason?:
        | "message_missing"
        | "message_not_assistant"
        | "assistant_incomplete"
        | "assistant_parent_missing"
        | "worker_descriptor_reference_missing"
    }> => {
      const message = await MessageStore.get(input).catch((error) => {
        if (NotFoundError.isInstance(error as Error)) return undefined
        throw error
      })
      if (!message) return { finished: false, reason: "message_missing" }
      const assistant = message.info
      if (assistant.role !== "assistant") return { finished: false, reason: "message_not_assistant" }
      if (assistant.time.completed === undefined) {
        return { finished: false, reason: "assistant_incomplete" }
      }
      if (!assistant.parentID) return { finished: false, reason: "assistant_parent_missing" }
      const source = await MessageStore.get({ sessionID: input.sessionID, messageID: assistant.parentID }).catch(
        (error) => {
          if (NotFoundError.isInstance(error as Error)) return undefined
          throw error
        },
      )
      if (!source) return { finished: false, reason: "assistant_parent_missing" }
      if (source.info.role !== "user") return { finished: false, reason: "assistant_parent_missing" }
      const descriptorValue = source.info.extra?.workerTurnDescriptor
      if (!descriptorValue || typeof descriptorValue !== "object" || Array.isArray(descriptorValue)) {
        return { finished: false, reason: "worker_descriptor_reference_missing" }
      }
      const descriptor = descriptorValue as { id?: unknown; hash?: unknown }
      if (typeof descriptor.id !== "string" || typeof descriptor.hash !== "string") {
        return { finished: false, reason: "worker_descriptor_reference_missing" }
      }
      const { canonicalAssistantMessageContent } = await import("./assistant-message-content")
      const content = canonicalAssistantMessageContent(message.parts)
      return {
        finished: true,
        messageID: assistant.id,
        contentHash: content.hash,
        agentID: assistant.agent,
        workerTurnDescriptor: { id: descriptor.id, hash: descriptor.hash },
      }
    },
  )

  export function* list(input?: {
    directory?: string
    roots?: boolean
    start?: number
    search?: string
    limit?: number
  }) {
    const project = Instance.project
    const conditions = [eq(SessionTable.project_id, project.id)]

    if (input?.directory) {
      conditions.push(eq(SessionTable.directory, input.directory))
    }
    if (input?.roots) {
      conditions.push(isNull(SessionTable.parent_id))
    }
    if (input?.start) {
      conditions.push(gte(SessionTable.time_updated, input.start))
    }
    if (input?.search) {
      conditions.push(like(SessionTable.title, `%${input.search}%`))
    }

    const limit = input?.limit ?? 100

    const rows = Database.use((db) =>
      db
        .select()
        .from(SessionTable)
        .where(and(...conditions))
        .orderBy(desc(SessionTable.time_updated))
        .limit(limit)
        .all(),
    )
    for (const row of rows) {
      yield fromRow(row)
    }
  }

  export function* listGlobal(input?: {
    directory?: string
    roots?: boolean
    start?: number
    cursorUpdated?: number
    cursorSessionID?: string
    search?: string
    limit?: number
    archived?: boolean
  }) {
    const conditions: SQL[] = []

    if (input?.directory) {
      conditions.push(eq(SessionTable.directory, input.directory))
    }
    if (input?.roots) {
      conditions.push(isNull(SessionTable.parent_id))
    }
    if (input?.start) {
      conditions.push(gte(SessionTable.time_updated, input.start))
    }
    if ((input?.cursorUpdated === undefined) !== (input?.cursorSessionID === undefined)) {
      throw new Error("Session.listGlobal requires cursorUpdated and cursorSessionID together")
    }
    if (input?.cursorUpdated !== undefined && input.cursorSessionID) {
      const cursorUpdated = input.cursorUpdated
      const cursorSessionID = input.cursorSessionID
      conditions.push(
        or(
          sql`${SessionTable.time_updated} < ${cursorUpdated}`,
          sql`${SessionTable.time_updated} = ${cursorUpdated} AND ${SessionTable.id} < ${cursorSessionID}`,
        )!,
      )
    }
    if (input?.search) {
      conditions.push(like(SessionTable.title, `%${input.search}%`))
    }
    if (!input?.archived) {
      conditions.push(isNull(SessionTable.time_archived))
    }

    const limit = input?.limit ?? 100

    const rows = Database.use((db) => {
      const query =
        conditions.length > 0
          ? db
              .select()
              .from(SessionTable)
              .where(and(...conditions))
          : db.select().from(SessionTable)
      return query.orderBy(desc(SessionTable.time_updated), desc(SessionTable.id)).limit(limit).all()
    })

    const ids = [...new Set(rows.map((row) => row.project_id))]
    const projects = new Map<string, ProjectInfo>()

    if (ids.length > 0) {
      const items = Database.use((db) =>
        db
          .select({ id: ProjectTable.id, name: ProjectTable.name, worktree: ProjectTable.worktree })
          .from(ProjectTable)
          .where(inArray(ProjectTable.id, ids))
          .all(),
      )
      for (const item of items) {
        projects.set(item.id, {
          id: item.id,
          name: item.name ?? undefined,
          worktree: item.worktree,
        })
      }
    }

    for (const row of rows) {
      const project = projects.get(row.project_id) ?? null
      yield { ...fromRow(row), project }
    }
  }

  export const children = fn(Identifier.schema("session"), async (parentID) => {
    const project = Instance.project
    const rows = Database.use((db) =>
      db
        .select()
        .from(SessionTable)
        .where(and(eq(SessionTable.project_id, project.id), eq(SessionTable.parent_id, parentID)))
        .all(),
    )
    return rows.map(fromRow)
  })

  // Flat list of session IDs in the subtree rooted at `sessionID`, parent
  // first then descendants. Lives here as the single source for "walk the
  // session tree" — callers that need to cancel/abort/cleanup every session
  // under a parent must use this instead of rolling their own recursion
  // (rule 8 single source, rule 9 shared abstraction). Previously duplicated
  // as private `sessionTree` helpers in engine/writer.ts and task-api/index.ts.
  export const tree = fn(Identifier.schema("session"), async (sessionID) => {
    return treeInProject({ sessionID, projectID: Instance.project.id })
  })

  function treeIDsFromRows(rows: Array<{ id: string; parentID: string | null }>, sessionID: string): string[] {
    const childrenByParent = new Map<string, string[]>()
    for (const row of rows) {
      if (!row.parentID) continue
      const existing = childrenByParent.get(row.parentID)
      if (existing) existing.push(row.id)
      else childrenByParent.set(row.parentID, [row.id])
    }
    const ids: string[] = [sessionID]
    const queue: string[] = [sessionID]
    const seen = new Set(ids)
    while (queue.length > 0) {
      const next = queue.shift()!
      const direct = childrenByParent.get(next) ?? []
      for (const childID of direct) {
        if (seen.has(childID)) throw new Error(`Session tree cycle detected at ${childID}`)
        seen.add(childID)
        ids.push(childID)
        queue.push(childID)
      }
    }
    return ids
  }

  export const treeInProject = fn(SessionProjectInput, async ({ sessionID, projectID }) => {
    const rows = Database.use((db) =>
      db
        .select({
          id: SessionTable.id,
          parentID: SessionTable.parent_id,
        })
        .from(SessionTable)
        .where(eq(SessionTable.project_id, projectID))
        .orderBy(SessionTable.time_created, SessionTable.id)
        .all(),
    )
    return treeIDsFromRows(rows, sessionID)
  })

  export function deleteExactTreeInProject(
    tx: Database.TxOrDb,
    input: { sessionID: string; projectID: string; expectedSessionIDs: string[] },
  ): number {
    const rows = tx
      .select({ id: SessionTable.id, parentID: SessionTable.parent_id })
      .from(SessionTable)
      .where(eq(SessionTable.project_id, input.projectID))
      .orderBy(SessionTable.time_created, SessionTable.id)
      .all()
    if (!rows.some((row) => row.id === input.sessionID)) {
      throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
    }
    const currentSessionIDs = treeIDsFromRows(rows, input.sessionID)
    const expectedSessionIDs = [...new Set(input.expectedSessionIDs)]
    if (expectedSessionIDs.length !== input.expectedSessionIDs.length) {
      throw new Error(`Session deletion settlement contains duplicate session identifiers for ${input.sessionID}`)
    }
    const expected = new Set(expectedSessionIDs)
    if (
      currentSessionIDs.length !== expectedSessionIDs.length ||
      currentSessionIDs.some((sessionID) => !expected.has(sessionID))
    ) {
      throw new Error(
        `Session tree ${input.sessionID} changed after settlement: expected ${expectedSessionIDs.join(", ")}; current ${currentSessionIDs.join(", ")}`,
      )
    }
    const deleted = tx
      .delete(SessionTable)
      .where(and(eq(SessionTable.project_id, input.projectID), inArray(SessionTable.id, currentSessionIDs)))
      .returning({ id: SessionTable.id })
      .all()
    if (deleted.length !== currentSessionIDs.length) {
      throw new Error(
        `Session tree ${input.sessionID} deletion removed ${deleted.length} rows, expected ${currentSessionIDs.length}`,
      )
    }
    Database.effect(async () => {
      for (const sessionID of currentSessionIDs) {
        try {
          SessionStatusLifecycle.release(sessionID)
        } finally {
          await SessionPromptState.release(sessionID)
        }
      }
    })
    return deleted.length
  }

  export const childrenInProject = fn(
    z.object({
      parentID: Identifier.schema("session"),
      projectID: z.string().min(1),
    }),
    async ({ parentID, projectID }) => {
      const rows = Database.use((db) =>
        db
          .select()
          .from(SessionTable)
          .where(and(eq(SessionTable.project_id, projectID), eq(SessionTable.parent_id, parentID)))
          .all(),
      )
      return rows.map(fromRow)
    },
  )

  async function removeSessionTree(input: { sessionID: string; projectID: string; publishDeleted: boolean }) {
    const { sessionID, projectID, publishDeleted } = input
    const session = await get(sessionID)
    if (session.projectID !== projectID) {
      throw new Error(`Session ${sessionID} belongs to project ${session.projectID}, not ${projectID}`)
    }
    for (const child of await childrenInProject({ parentID: sessionID, projectID })) {
      await removeSessionTree({ sessionID: child.id, projectID, publishDeleted })
    }
    await PermissionAuthority.cancelPendingForSession(sessionID, "Session deleted before the Tool invocation ran")
    // CASCADE delete handles messages and parts automatically
    Database.transaction((db) => {
      db.delete(SessionTable).where(eq(SessionTable.id, sessionID)).run()
      Database.effect(() => Database.incrementalVacuum())
      Database.effect(async () => {
        try {
          SessionStatusLifecycle.release(sessionID)
        } finally {
          await SessionPromptState.release(sessionID)
        }
      })
      if (publishDeleted) {
        Bus.publishOwnedInTransaction(Event.Deleted, { info: session })
      }
    })
  }

  export const remove = fn(Identifier.schema("session"), async (sessionID) => {
    return removeSessionTree({ sessionID, projectID: Instance.project.id, publishDeleted: true })
  })

  export const removeInProject = fn(SessionProjectInput, async ({ sessionID, projectID }) => {
    return removeSessionTree({ sessionID, projectID, publishDeleted: false })
  })

  function messageWithPersistedCreated(msg: Message.Info, timeCreated: number): Message.VisibleInfo {
    const persisted = {
      ...msg,
      time: {
        ...msg.time,
        created: timeCreated,
      },
    } as Message.Info
    const orderKey = timelineMessageOrderKey({ info: persisted })
    if (typeof msg.orderKey === "string" && msg.orderKey.length > 0 && msg.orderKey !== orderKey) {
      throw new Error(
        `Session.updateMessage: message ${msg.id} orderKey drift between payload and persisted row: payload=${msg.orderKey}, persisted=${orderKey}, payloadCreated=${msg.time.created}, persistedCreated=${timeCreated}`,
      )
    }
    return { ...persisted, orderKey } as Message.VisibleInfo
  }

  function upsertMessageRow(
    msg: Message.Info,
    options: {
      publishCreated: boolean
      publishUpdated: boolean
    },
  ): Message.VisibleInfo {
    let persisted: Message.VisibleInfo | undefined
    Database.transaction((db) => {
      const existing = db
        .select({ time_created: MessageTable.time_created })
        .from(MessageTable)
        .where(eq(MessageTable.id, msg.id))
        .get()
      const persistedMessage = messageWithPersistedCreated(msg, existing?.time_created ?? msg.time.created)
      persisted = persistedMessage
      const time_created = persistedMessage.time.created
      const { id, sessionID, ...data } = persistedMessage
      db.insert(MessageTable)
        .values({
          id,
          session_id: sessionID,
          time_created,
          data,
        })
        .onConflictDoUpdate({ target: MessageTable.id, set: { data } })
        .run()
      if (options.publishCreated && !existing) {
        Bus.publishOwnedInTransaction(Message.Event.Created, { info: persistedMessage })
      }
      if (options.publishUpdated) {
        Bus.publishOwnedInTransaction(Message.Event.Updated, { info: persistedMessage })
      }
    })
    if (!persisted) throw new Error(`Session message ${msg.id} was not persisted`)
    return persisted
  }

  export const updateMessage = fn(Message.Info, async (msg) => {
    return upsertMessageRow(msg, { publishCreated: true, publishUpdated: true })
  })

  const PublishCompactionCheckpointInput = z.object({
    info: Message.Assistant,
    part: Message.CompactionPart,
  })

  export const publishCompactionCheckpoint = fn(PublishCompactionCheckpointInput, async (input) => {
    if (input.info.time.completed === undefined || !CompactionHandoff.isValidSummaryMessage(input.info)) {
      throw new Error(`Compaction checkpoint assistant ${input.info.id} must be a valid completed summary`)
    }
    if (input.part.sessionID !== input.info.sessionID || input.part.messageID !== input.info.parentID) {
      throw new Error(`Compaction checkpoint ${input.info.id} marker does not belong to its parent user message`)
    }
    let info: Message.VisibleInfo | undefined
    let part: Message.CompactionPart | undefined
    Database.transaction((db) => {
      const parent = db
        .select({ data: MessageTable.data })
        .from(MessageTable)
        .where(and(eq(MessageTable.id, input.info.parentID), eq(MessageTable.session_id, input.info.sessionID)))
        .get()
      if (!parent || parent.data.role !== "user") {
        throw new Error(`Compaction checkpoint ${input.info.id} parent must be a user message`)
      }
      const continuationParts = db
        .select()
        .from(PartTable)
        .where(and(eq(PartTable.message_id, input.info.id), eq(PartTable.session_id, input.info.sessionID)))
        .orderBy(PartTable.time_created, PartTable.id)
        .all()
        .map((row) =>
          Message.Part.parse({
            ...row.data,
            id: row.id,
            sessionID: row.session_id,
            messageID: row.message_id,
          }),
        )
      const continuation = Message.compactionContinuationTextParts(continuationParts)
        .map((item) => item.text)
        .join("\n\n")
      if (!continuation.trim()) {
        throw new Error(`Compaction checkpoint assistant ${input.info.id} must contain final-step visible text`)
      }
      info = upsertMessageRow(input.info, { publishCreated: false, publishUpdated: true })
      part = updatePartRow(input.part, { publish: true }, db).outputPart as Message.CompactionPart
    })
    if (!info || !part) throw new Error(`Compaction checkpoint ${input.info.id} was not persisted`)
    return { info, part }
  })

  /**
   * Write a message row to the database without publishing a Bus event.
   * Use this when the message needs to exist in the DB (e.g. as an FK target
   * for parts) but the notification should be deferred until the message is
   * fully assembled. Follow up with `updateMessage` to publish the event.
   */
  export const saveMessage = fn(Message.Info, async (msg) => {
    return upsertMessageRow(msg, { publishCreated: false, publishUpdated: false })
  })

  /**
   * Persist one logical message atomically.
   *
   * The message row itself must exist before parts can reference it, but
   * publishing `message.updated` before the parts are durable creates an
   * observable split-brain: listeners can see a header-only message and miss
   * the authored text if the process dies mid-write. We therefore:
   *   1. save the message row silently as the foreign-key target,
   *   2. queue the first-write `message.created` event when applicable,
   *   3. queue the visible `message.updated` event in the same transaction,
   *   4. write every part in that same transaction,
   *   5. write any message-owned control records in the same transaction,
   *   6. merge any related session metadata facts in the same transaction,
   *   7. optionally touch the owning session before commit.
   *
   * Because the bus effects drain only after the transaction commits, any
   * observer that sees `message.created`, `message.updated`, or
   * `message.part.updated` is guaranteed to read the fully durable message
   * bundle from SQLite.
   */
  const PersistMessageInput = z.object({
    info: Message.Info,
    parts: z.array(Message.Part),
    controls: z.array(SessionControl.CreateInput).optional(),
    metadataPatches: z.array(MetadataPatchInput).optional(),
    touchSessionID: Identifier.schema("session").optional(),
  })
  export type PersistMessageInput = z.infer<typeof PersistMessageInput>

  function persistMessageBundleRows(
    input: PersistMessageInput,
    commit?: () => void,
    beforeVisibilityEffects?: () => void,
    preflightBundle?: () => void,
  ) {
    for (const control of input.controls ?? []) {
      if (control.sessionID !== input.info.sessionID) {
        throw new Error(
          `Message-owned session control ${control.kind} targets ${control.sessionID}, not message session ${input.info.sessionID}`,
        )
      }
    }
    Database.transaction((db) => {
      preflightBundle?.()
      const existing = db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, input.info.id)).get()
      upsertMessageRow(input.info, { publishCreated: false, publishUpdated: false })
      beforeVisibilityEffects?.()
      if (!existing) {
        const createdInfo = messageWithPersistedCreated(input.info, input.info.time.created)
        Bus.publishOwnedInTransaction(Message.Event.Created, { info: createdInfo })
      }
      upsertMessageRow(input.info, { publishCreated: false, publishUpdated: true })
      for (const part of input.parts) updatePartRow(part, { publish: true })
      ProjectMemory.captureMessageInTransaction(db, { info: input.info, parts: input.parts })
      for (const control of input.controls ?? []) SessionControl.createInTransaction(db, control)
      for (const patch of input.metadataPatches ?? []) mergeMetadataInTransaction(db, patch)
      if (input.touchSessionID) touch(input.touchSessionID)
      commit?.()
    })
  }

  async function hydratePersistedMessageBundle(input: PersistMessageInput) {
    const row = Database.use((db) =>
      db
        .select({ time_created: MessageTable.time_created })
        .from(MessageTable)
        .where(and(eq(MessageTable.id, input.info.id), eq(MessageTable.session_id, input.info.sessionID)))
        .get(),
    )
    if (!row) throw new NotFoundError({ message: `Message not found: ${input.info.id}` })
    return {
      info: messageWithPersistedCreated(input.info, row.time_created),
      parts: await MessageStore.parts(input.info.id),
    }
  }

  async function persistMessageBundle(
    input: PersistMessageInput,
    commit?: () => void,
    beforeVisibilityEffects?: () => void,
  ) {
    const persisted = persistMessageWithCommitInTransaction(input, commit ?? (() => undefined), beforeVisibilityEffects)
    return persisted.complete()
  }

  export const persistMessage = fn(PersistMessageInput, async (input) => persistMessageBundle(input))

  /**
   * Persist a message bundle and one synchronous owner commit in the same
   * SQLite transaction. The callback is for durable facts whose validity is
   * defined by the exact message/Part set, such as a projected-worker Turn
   * descriptor and its dispatch lineage. It must not perform asynchronous
   * work or publish process-local runtime state. `beforeVisibilityEffects`
   * may only register post-commit effects that must run before the Message
   * publication effects registered by this bundle.
   */
  export async function persistMessageWithCommit(
    input: PersistMessageInput,
    commit: () => void,
    beforeVisibilityEffects?: () => void,
    preflightBundle?: () => void,
  ) {
    const parsed = PersistMessageInput.parse(input)
    const persisted = persistMessageWithCommitInTransaction(parsed, commit, beforeVisibilityEffects, preflightBundle)
    return persisted.complete()
  }

  export function persistMessageWithCommitInTransaction(
    input: PersistMessageInput,
    commit: () => void,
    beforeVisibilityEffects?: () => void,
    preflightBundle?: () => void,
  ) {
    const parsed = PersistMessageInput.parse(input)
    persistMessageBundleRows(parsed, commit, beforeVisibilityEffects, preflightBundle)
    return {
      complete: () => hydratePersistedMessageBundle(parsed),
    }
  }

  export const removeMessage = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }),
    async (input) => {
      // CASCADE delete handles parts automatically
      Database.transaction((db) => {
        const removed = db
          .delete(MessageTable)
          .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
          .returning({ id: MessageTable.id })
          .get()
        if (!removed) throw new NotFoundError({ message: `Message not found: ${input.messageID}` })
        Bus.publishOwnedInTransaction(Message.Event.Removed, {
          sessionID: input.sessionID,
          messageID: input.messageID,
        })
      })
      return input.messageID
    },
  )

  export const removePart = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
      partID: Identifier.schema("part"),
    }),
    async (input) => {
      Database.transaction((db) => {
        const removed = db
          .delete(PartTable)
          .where(
            and(
              eq(PartTable.id, input.partID),
              eq(PartTable.session_id, input.sessionID),
              eq(PartTable.message_id, input.messageID),
            ),
          )
          .returning({ id: PartTable.id })
          .get()
        if (!removed) throw new NotFoundError({ message: `Part not found: ${input.partID}` })
        Bus.publishOwnedInTransaction(Message.Event.PartRemoved, {
          sessionID: input.sessionID,
          messageID: input.messageID,
          partID: input.partID,
        })
      })
      return input.partID
    },
  )

  const UpdatePartInput = Message.Part

  type ToolStatus = Message.ToolPart["state"]["status"]
  const TOOL_STATUS_RANK: Record<ToolStatus, number> = { pending: 0, running: 1, completed: 2, error: 2 }
  const TERMINAL_TOOL_STATUS: ReadonlySet<ToolStatus> = new Set(["completed", "error"])

  function shouldSkipToolStatusUpdate(previousStatus: ToolStatus, nextStatus: ToolStatus): boolean {
    const oldRank = TOOL_STATUS_RANK[previousStatus]
    const newRank = TOOL_STATUS_RANK[nextStatus]
    if (newRank < oldRank) return true
    return oldRank === newRank && previousStatus !== nextStatus && TERMINAL_TOOL_STATUS.has(previousStatus)
  }

  /** Detector for inline base64 image / pdf / audio / video data URLs inside
   *  a part's serialized data. Single source for the write-boundary guard
   *  (see attachment-store single-source contract):
   *
   *  - This is the inverse pattern of `AttachmentStore` refs
   *    (`/attachment/<projectID>/<sha>.<ext>`). Every inline-base64 producer
   *    that survived the migration must route through `AttachmentStore.write`
   *    instead of stuffing data URLs into `part.state.attachments[].url`
   *    (or `part.url`, for user file parts).
   *
   *  - rule 6.1 second branch: this is a data-integrity gate, not an
   *    LLM-decision shortcut. The producer code path is the bug; this
   *    guard surfaces the regression at the write boundary so it cannot
   *    silently bloat the DB. */
  export class InlineBase64InPartError extends Error {
    constructor(
      public readonly partID: string,
      snippet: string,
    ) {
      super(
        `Session.updatePart: refusing inline base64 data URL in part ${partID}. ` +
          `Route the producer through AttachmentStore.write so part.data stores a ` +
          `/attachment/<sha>.<ext> ref instead of MB of inline bytes. ` +
          `(attachment-store single-source contract). ` +
          `Offending snippet: ${snippet}`,
      )
      this.name = "InlineBase64InPartError"
    }
  }

  function assertPartDataHasNoInlineBase64(partID: string, data: unknown): void {
    // Cheap regex on the serialized string is O(N) over the part payload,
    // dominated by the JSON.stringify cost the insert below would pay
    // anyway. Triggers before the row touches SQLite — keeps the DB clean.
    const serialized = JSON.stringify(data)
    const match = inlineBase64DataUrlMatch(serialized)
    if (match) {
      const snippet = inlineBase64DataUrlSnippet(serialized, match)
      throw new InlineBase64InPartError(partID, snippet)
    }
  }

  export function assertPartHasNoInlineBase64(part: Message.Part): void {
    const { id } = part
    const data = { ...part } as Record<string, unknown>
    delete data.id
    delete data.messageID
    delete data.sessionID
    delete data.orderKey
    assertPartDataHasNoInlineBase64(id, data)
  }

  const UpdatePartDataInput = z.object({
    partID: z.string(),
    data: z.custom<PartData>(),
  })

  export const updatePartData = fn(UpdatePartDataInput, async (input) => {
    assertPartDataHasNoInlineBase64(input.partID, input.data)
    const row = Database.use((db) =>
      db
        .update(PartTable)
        .set({ data: input.data, time_updated: Date.now() })
        .where(eq(PartTable.id, input.partID))
        .returning({ id: PartTable.id })
        .get(),
    )
    if (!row) throw new NotFoundError({ message: `Part not found: ${input.partID}` })
  })

  function updatePartRow(
    part: Message.Part,
    options: { publish: boolean },
    transaction?: Database.TxOrDb,
  ): { outputPart: Message.Part; wrotePart: boolean } {
    assertPartHasNoInlineBase64(part)
    const { id, messageID, sessionID, orderKey: providedOrderKey, ...data } = part
    const assertProvidedPartOrderKey = (canonicalOrderKey: string) => {
      const supplied = typeof providedOrderKey === "string" ? providedOrderKey.trim() : ""
      if (supplied && supplied !== canonicalOrderKey) {
        throw new Error(`Session.updatePart: part ${id} orderKey drift between input and persisted row`)
      }
    }
    const time = Date.now()
    let outputPart = part
    let messageOrderKey = ""
    const publishPartUpdated = () =>
      Bus.publishOwnedInTransaction(Message.Event.PartUpdated, {
        orderKey: messageOrderKey,
        part: outputPart as Message.VisiblePart,
      })
    const publishAfterCommit = options.publish && Database.hasActiveTransaction()
    let wrotePart = false
    const write = (db: Database.TxOrDb) => {
      const message = db
        .select({ id: MessageTable.id, timeCreated: MessageTable.time_created })
        .from(MessageTable)
        .where(and(eq(MessageTable.id, messageID), eq(MessageTable.session_id, sessionID)))
        .get()
      if (!message) throw new NotFoundError({ message: `Message not found: ${messageID}` })
      messageOrderKey = timelineMessageOrderKey({
        info: {
          id: messageID,
          time: { created: message.timeCreated },
        },
      })
      const existingPart = db
        .select({
          data: PartTable.data,
          sessionID: PartTable.session_id,
          messageID: PartTable.message_id,
          timeCreated: PartTable.time_created,
        })
        .from(PartTable)
        .where(eq(PartTable.id, id))
        .get()
      if (existingPart && (existingPart.sessionID !== sessionID || existingPart.messageID !== messageID)) {
        throw new NotFoundError({ message: `Part not found: ${id}` })
      }
      // Tool status monotonicity: never regress a tool part's status
      if (part.type === "tool" && part.state?.status) {
        if (existingPart?.data) {
          const prev = existingPart.data as any
          if (prev.type === "tool" && prev.state?.status) {
            if (shouldSkipToolStatusUpdate(prev.state.status, part.state.status)) {
              const canonicalOrderKey = timelinePartOrderKey({ id, timeCreated: existingPart.timeCreated })
              assertProvidedPartOrderKey(canonicalOrderKey)
              outputPart = {
                ...prev,
                id,
                sessionID,
                messageID,
                orderKey: canonicalOrderKey,
              } as Message.Part
              return
            }
          }
        }
      }
      const canonicalOrderKey = timelinePartOrderKey({ id, timeCreated: existingPart?.timeCreated ?? time })
      assertProvidedPartOrderKey(canonicalOrderKey)
      outputPart = {
        ...part,
        orderKey: canonicalOrderKey,
      } as Message.Part
      db.insert(PartTable)
        .values({
          id,
          message_id: messageID,
          session_id: sessionID,
          time_created: time,
          data,
        })
        .onConflictDoUpdate({ target: PartTable.id, set: { data } })
        .run()
      wrotePart = true
      if (publishAfterCommit) publishPartUpdated()
    }
    if (transaction) write(transaction)
    else Database.use(write)
    return { outputPart, wrotePart }
  }

  /**
   * Synchronous Part writer for a caller-owned transaction. Composite fact
   * commits use this instead of invoking the async public wrapper from a
   * SQLite transaction callback. Validation, monotonicity, and publication
   * remain owned by the same updatePartRow implementation.
   */
  export function writePartInTransaction(
    db: Database.TxOrDb,
    part: Message.Part,
    options: { publish: boolean } = { publish: true },
  ): { outputPart: Message.Part; wrotePart: boolean } {
    Database.requireActiveTransaction("Session.writePartInTransaction")
    return updatePartRow(part, options, db)
  }

  export const updatePart = fn(UpdatePartInput, async (part) => {
    const publishAfterCommit = Database.hasActiveTransaction()
    const { outputPart, wrotePart } = updatePartRow(part, { publish: true })
    // SSE (Server-Sent Events) stream deltas depend on the part-created
    // event already being visible to live subscribers. Outside an existing
    // DB transaction, publish and await that event before callers emit
    // message.part.delta. Inside a transaction, keep the post-commit effect
    // boundary so observers never see uncommitted parts.
    if (wrotePart && !publishAfterCommit) {
      const messageOrderKey = timelineMessageOrderKey({
        info: {
          id: outputPart.messageID,
          time: {
            created: Database.use((db) => {
              const row = db
                .select({ timeCreated: MessageTable.time_created })
                .from(MessageTable)
                .where(
                  and(eq(MessageTable.id, outputPart.messageID), eq(MessageTable.session_id, outputPart.sessionID)),
                )
                .get()
              if (!row) throw new NotFoundError({ message: `Message not found: ${outputPart.messageID}` })
              return row.timeCreated
            }),
          },
        },
      })
      await Bus.publish(Message.Event.PartUpdated, {
        orderKey: messageOrderKey,
        part: outputPart as Message.VisiblePart,
      })
    }
    return outputPart
  })

  export const importSnapshot = fn(
    z.object({
      info: Info,
      messages: z.array(
        z.object({
          info: Message.Info,
          parts: z.array(Message.Part),
        }),
      ),
    }),
    async (input) => {
      Database.transaction((db) => {
        Project.assertDurableAdmissionOpen(input.info.projectID)
        const sessionRow = toRow(input.info)
        const { id: _sessionID, ...sessionSet } = sessionRow
        db.insert(SessionTable)
          .values(sessionRow)
          .onConflictDoUpdate({ target: SessionTable.id, set: sessionSet })
          .run()

        for (const msg of input.messages) {
          const { orderKey: _messageOrderKey, ...messageInfo } = {
            ...msg.info,
            sessionID: input.info.id,
          } as Message.Info & { orderKey?: string }
          upsertMessageRow(messageInfo, { publishCreated: false, publishUpdated: false })
          for (const part of msg.parts) {
            const { orderKey: _partOrderKey, ...partInfo } = {
              ...part,
              messageID: messageInfo.id,
              sessionID: input.info.id,
            } as Message.Part & { orderKey?: string }
            updatePartRow(partInfo as Message.Part, { publish: false })
          }
        }
      })
    },
  )

  // updatePartDelta is a pure Bus publish. Deltas are ephemeral by contract —
  // the protocol bridge (task-message-protocol-bridge.ts:bridgeDelta) routes
  // them through ProtocolStore.dispatchEphemeral with no sequence and no
  // replay, and every streaming caller (session-hooks, engine/runtime,
  // session/processor) already maintains an in-memory accumulator and
  // persists the complete Part via updatePart at each natural boundary
  // (tool-call, reasoning-end, execution standby). Writing deltas to PartTable
  // would therefore produce state that is overwritten at the next boundary
  // and never observed — pure write amplification. Under parallel Session
  // execution this amplification used to starve the SQLite write lock and
  // stall the main event loop, which read as "overlay freezing".
  export const updatePartDelta = fn(
    z.object({
      sessionID: z.string(),
      messageID: z.string(),
      partID: z.string(),
      field: z.string(),
      delta: z.string(),
    }),
    async (input) => {
      return Bus.publish(Message.Event.PartDelta, input)
    },
  )

  export const getUsage = fn(
    z.object({
      model: z.custom<Provider.Model>(),
      usage: z.custom<LanguageModelUsage>(),
      metadata: z.custom<ProviderMetadata>().optional(),
    }),
    (input) => {
      const safe = (value: number | null | undefined) => {
        if (!Number.isFinite(value) || Number(value) < 0) return 0
        return Number(value)
      }
      const inputTokens = safe(input.usage.inputTokens)
      const outputTokens = safe(input.usage.outputTokens)
      const reasoningTokens = safe(input.usage.outputTokenDetails?.reasoningTokens ?? input.usage.reasoningTokens)
      const textOutputTokens = safe(input.usage.outputTokenDetails?.textTokens ?? outputTokens - reasoningTokens)
      const cacheReadInputTokens = safe(input.usage.inputTokenDetails?.cacheReadTokens ?? input.usage.cachedInputTokens)
      const cacheWriteInputTokens = safe(
        (input.usage.inputTokenDetails?.cacheWriteTokens ??
          input.metadata?.["anthropic"]?.["cacheCreationInputTokens"] ??
          (input.metadata?.["bedrock"] as any)?.["usage"]?.["cacheWriteInputTokens"] ??
          (input.metadata?.["venice"] as any)?.["usage"]?.["cacheCreationInputTokens"] ??
          0) as number,
      )

      // AI SDK 6 owns the provider-specific input convention and exposes the
      // normalized non-cache count. Only fall back to subtraction for adapters
      // that do not supply that detail.
      const adjustedInputTokens = safe(
        input.usage.inputTokenDetails?.noCacheTokens ?? inputTokens - cacheReadInputTokens - cacheWriteInputTokens,
      )

      const total = iife(() => {
        // Anthropic doesn't provide total_tokens, also ai sdk will vastly undercount if we
        // don't compute from components
        if (
          input.model.api.npm === "@ai-sdk/anthropic" ||
          input.model.api.npm === "@ai-sdk/amazon-bedrock" ||
          input.model.api.npm === "@ai-sdk/google-vertex/anthropic"
        ) {
          return adjustedInputTokens + textOutputTokens + reasoningTokens + cacheReadInputTokens + cacheWriteInputTokens
        }
        return safe(
          input.usage.totalTokens ??
            adjustedInputTokens + textOutputTokens + reasoningTokens + cacheReadInputTokens + cacheWriteInputTokens,
        )
      })

      const tokens = {
        total,
        input: adjustedInputTokens,
        output: textOutputTokens,
        reasoning: reasoningTokens,
        cache: {
          write: cacheWriteInputTokens,
          read: cacheReadInputTokens,
        },
      }

      const costInfo =
        input.model.cost?.experimentalOver200K && tokens.input + tokens.cache.read + tokens.cache.write > 200_000
          ? input.model.cost.experimentalOver200K
          : input.model.cost
      return {
        billing: {
          status: input.model.cost.available === true ? ("priced" as const) : ("unpriced" as const),
        },
        cost: safe(
          new Decimal(0)
            .add(new Decimal(tokens.input).mul(costInfo?.input ?? 0).div(1_000_000))
            .add(new Decimal(tokens.output).mul(costInfo.output).div(1_000_000))
            .add(new Decimal(tokens.cache.read).mul(costInfo.cache.read).div(1_000_000))
            .add(new Decimal(tokens.cache.write).mul(costInfo.cache.write).div(1_000_000))
            // Reasoning is an output-token subset. It is separated from text for
            // presentation, then charged once at the output rate.
            .add(new Decimal(tokens.reasoning).mul(costInfo.output).div(1_000_000))
            .toNumber(),
        ),
        tokens,
      }
    },
  )

  export class BusyError extends Error {
    constructor(public readonly sessionID: string) {
      super(`Session ${sessionID} is busy`)
    }
  }
}

export { Message } from "./message"
export { Todo } from "./todo"
export { SessionStatus } from "./status"
