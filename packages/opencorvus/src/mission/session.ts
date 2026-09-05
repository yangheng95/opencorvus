import { Database, NotFoundError, and, desc, eq, isNull, like, or, sql } from "../storage/db"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Project } from "@/project/project"
import { Session } from "@/session"
import { assertSessionDeletionAdmissionInTransaction } from "@/session/deletion-cleanup"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { Filesystem } from "@/util/filesystem"
import { MISSION_CONTROL_DEFAULT_TITLE } from "@/session/first-message-title"
import {
  MissionID,
  MissionPendingPrompt,
  MissionVisibleExpertSquadIDs,
  ProductPillarSchema,
  type ProductPillar,
} from "./schema"
import type { SessionPrompt } from "@/session/prompt"
import { missionExpertSquadSnapshotsMatch } from "./expert-squad-authority"
import { NamedError } from "@opencorvus-ai/util/error"
import { createHash } from "node:crypto"
import z from "zod"

export type MissionSession = Session.Info & { missionID: string; productPillar: ProductPillar }

export const MissionExpertSquadSnapshotMismatchError = NamedError.create(
  "MissionExpertSquadSnapshotMismatchError",
  z.object({
    message: z.string(),
    missionID: MissionID,
    heldCount: z.number().int().positive(),
    heldSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
)

export function assertMissionExpertSquadSnapshot(
  missionID: MissionID,
  held: MissionVisibleExpertSquadIDs,
  requested: MissionVisibleExpertSquadIDs,
): void {
  if (missionExpertSquadSnapshotsMatch(held, requested)) return
  const heldSnapshotHash = createHash("sha256").update(JSON.stringify(held)).digest("hex")
  throw new MissionExpertSquadSnapshotMismatchError({
    message: `Mission ${missionID} already holds a different immutable Expert Squad snapshot.`,
    missionID,
    heldCount: held.length,
    heldSnapshotHash,
  })
}

/**
 * Project the fixed Mission control-plane capability onto a user prompt.
 * Mission is an independent panel runtime; caller ingress provenance does not
 * decide this authorization and durable ingress transport must only preserve it.
 */
export function applyMissionControlPromptOverlay<T extends Omit<SessionPrompt.PromptInput, "sessionID">>(prompt: T): T {
  return {
    ...prompt,
    extra: {
      ...(prompt.extra ?? {}),
      surface: "panel",
    },
  }
}

const locks = new Map<string, Promise<MissionSession>>()

// channelKey is legacy/display metadata derived from the missionID. Session
// identity is the row selected by project, directory, and missionID.
function channelKeyForMission(missionID: string): string {
  return `mission:${missionID}`
}

const MissionLaunchMetadata = z
  .object({
    id: MissionID,
    channelKey: z.string(),
    cwd: z.string().min(1),
    productPillar: ProductPillarSchema,
    visibleExpertSquadIDs: MissionVisibleExpertSquadIDs,
  })
  .passthrough()
  .superRefine((mission, context) => {
    if (mission.channelKey !== channelKeyForMission(mission.id)) {
      context.addIssue({ code: "custom", path: ["channelKey"], message: "Mission channel key must match its ID" })
    }
  })

function withMissionID(session: Session.Info, missionID: string): MissionSession {
  const metadata = requireMissionLaunchMetadata(session)
  if (metadata.id !== missionID || !Project.samePath(metadata.cwd, session.directory)) {
    throw new Error(`Mission Session ${session.id} holds launch metadata that conflicts with its Session identity.`)
  }
  return { ...session, missionID, productPillar: metadata.productPillar }
}

function requireMissionLaunchMetadata(session: Pick<Session.Info, "metadata">) {
  return MissionLaunchMetadata.parse((session.metadata as { mission?: unknown } | undefined)?.mission)
}

export function missionProductPillar(session: Pick<Session.Info, "metadata">): ProductPillar {
  return requireMissionLaunchMetadata(session).productPillar
}

function missionIDFromInfo(session: Session.Info): string | undefined {
  const missionID = (session.metadata as { mission?: { id?: unknown } } | undefined)?.mission?.id
  const parsed = MissionID.safeParse(missionID)
  return parsed.success ? parsed.data : undefined
}

function canonicalMissionMetadata(input: {
  missionID: MissionID
  directory: string
  productPillar: ProductPillar
  heldExpertSquadIDs: MissionVisibleExpertSquadIDs
}) {
  return {
    mission: MissionLaunchMetadata.parse({
      id: input.missionID,
      channelKey: channelKeyForMission(input.missionID),
      cwd: input.directory,
      productPillar: input.productPillar,
      visibleExpertSquadIDs: input.heldExpertSquadIDs,
    }),
  }
}

export async function requireMissionSession(sessionID: string): Promise<MissionSession> {
  const session = await Session.get(sessionID)
  const missionID = missionIDFromInfo(session)
  if (session.kind !== "mission" || !missionID) {
    throw new Error(`Session ${sessionID} is not a Mission session with canonical metadata.mission.id.`)
  }
  return withMissionID(session, missionID)
}

export function missionVisibleExpertSquadIDs(session: Session.Info): MissionVisibleExpertSquadIDs {
  return requireMissionLaunchMetadata(session).visibleExpertSquadIDs
}

export function missionPendingPrompt(session: Session.Info): MissionPendingPrompt | undefined {
  const mission = (session.metadata as { mission?: { pendingPrompt?: unknown } } | undefined)?.mission
  if (mission?.pendingPrompt === undefined) return undefined
  return MissionPendingPrompt.parse(mission.pendingPrompt)
}

export async function setMissionPendingPrompt(input: {
  session: Session.Info
  pendingPrompt?: MissionPendingPrompt
}): Promise<Session.Info> {
  if (input.session.kind !== "mission") {
    throw new Error(`Session ${input.session.id} is not a Mission session.`)
  }
  const metadata = (input.session.metadata ?? {}) as Record<string, unknown>
  const mission = metadata.mission
  if (!mission || typeof mission !== "object" || Array.isArray(mission)) {
    throw new Error(`Mission session ${input.session.id} is missing metadata.mission.`)
  }
  const { pendingPrompt: _consumedPendingPrompt, ...currentMission } = mission as Record<string, unknown>
  return Session.mergeMetadata({
    sessionID: input.session.id,
    patch: {
      mission: {
        ...currentMission,
        ...(input.pendingPrompt ? { pendingPrompt: MissionPendingPrompt.parse(input.pendingPrompt) } : {}),
      },
    },
  })
}

async function ensureMissionRuntimeDirectory(input: {
  directory: string
  missionID: string
}): Promise<string | undefined> {
  const root = ProjectRuntimePaths.missionRoot(input.directory, input.missionID)
  await fs.mkdir(path.dirname(root), { recursive: true })
  try {
    await fs.mkdir(root)
    return root
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await fs.stat(root)).isDirectory()) throw error
    return undefined
  }
}

let beforeRuntimeMaterializationForTest:
  | ((input: { sessionID: string; missionID: string }) => void | Promise<void>)
  | undefined

function normalizeDirectory(directory: string) {
  return Filesystem.resolve(directory)
}

function findMissionSessionIDByDirectory(input: { missionID: string; directory: string }) {
  return Database.use(
    (db) =>
      db
        .select({ id: SessionTable.id })
        .from(SessionTable)
        .where(
          and(
            eq(SessionTable.project_id, Instance.project.id),
            eq(SessionTable.directory, input.directory),
            eq(SessionTable.kind, "mission"),
            sql`json_extract(${SessionTable.metadata}, '$.mission.id') = ${input.missionID}`,
          ),
        )
        .get()?.id,
  )
}

function findGlobalMissionSessionIDByDirectory(input: { missionID: string; directory: string }) {
  return Database.use(
    (db) =>
      db
        .select({ id: SessionTable.id })
        .from(SessionTable)
        .where(
          and(
            eq(SessionTable.directory, input.directory),
            eq(SessionTable.kind, "mission"),
            sql`json_extract(${SessionTable.metadata}, '$.mission.id') = ${input.missionID}`,
          ),
        )
        .get()?.id,
  )
}

function missionSessionConditions(
  input?: {
    directory?: string
    search?: string
    cursorUpdated?: number
    cursorSessionID?: string
    archived?: boolean
  },
  projectID?: string,
) {
  const conditions = [
    eq(SessionTable.kind, "mission"),
    sql`json_extract(${SessionTable.metadata}, '$.mission.id') IS NOT NULL`,
  ]

  if (projectID) {
    conditions.push(eq(SessionTable.project_id, projectID))
  }
  if (input?.directory) {
    conditions.push(eq(SessionTable.directory, input.directory))
  }
  if (input?.search) {
    const term = `%${input.search}%`
    conditions.push(
      or(
        like(SessionTable.title, term),
        sql`json_extract(${SessionTable.metadata}, '$.mission.id') LIKE ${term}`,
        like(SessionTable.directory, term),
      )!,
    )
  }
  if (input?.cursorUpdated !== undefined && input.cursorSessionID) {
    conditions.push(sql`(
      ${SessionTable.time_updated} < ${input.cursorUpdated}
      OR (${SessionTable.time_updated} = ${input.cursorUpdated} AND ${SessionTable.id} < ${input.cursorSessionID})
    )`)
  }
  if (!input?.archived) {
    conditions.push(isNull(SessionTable.time_archived))
  }
  return conditions
}

/**
 * Look up an existing mission session by missionID without creating one.
 *
 * The POST /mission/wake route uses this to distinguish "started a new
 * mission" from "resumed an existing mission" in its response. The actual
 * session acquisition still goes through `ensureMissionSession` — this
 * lookup intentionally has no create semantics.
 */
export function findExistingMissionSession(input: { missionID: string; directory: string }): string | undefined {
  return findMissionSessionIDByDirectory({
    missionID: MissionID.parse(input.missionID),
    directory: normalizeDirectory(input.directory),
  })
}

export async function getMissionSessionByDirectory(input: {
  missionID: string
  directory: string
}): Promise<MissionSession> {
  const directory = normalizeDirectory(input.directory)
  const sessionID = findGlobalMissionSessionIDByDirectory({ missionID: input.missionID, directory })
  if (!sessionID) throw new NotFoundError({ message: `Mission not found: ${input.missionID}` })
  const session = await Session.get(sessionID)
  const parsedMissionID = missionIDFromInfo(session)
  if (parsedMissionID !== input.missionID || session.directory !== directory) {
    throw new NotFoundError({ message: `Mission not found: ${input.missionID}` })
  }
  return withMissionID(session, parsedMissionID)
}

export async function* listMissionSessions(input?: {
  directory?: string
  search?: string
  limit?: number
  cursorUpdated?: number
  cursorSessionID?: string
  archived?: boolean
}) {
  const conditions = missionSessionConditions(input, Instance.project.id)
  const limit = input?.limit ?? 100
  const rows = Database.use((db) =>
    db
      .select({ id: SessionTable.id })
      .from(SessionTable)
      .where(and(...conditions))
      .orderBy(desc(SessionTable.time_updated), desc(SessionTable.id))
      .limit(limit)
      .all(),
  )

  for (const row of rows) {
    const session = await Session.get(row.id)
    const missionID = missionIDFromInfo(session)
    if (!missionID) continue
    yield withMissionID(session, missionID)
  }
}

export async function* listGlobalMissionSessions(input?: {
  directory?: string
  search?: string
  limit?: number
  cursorUpdated?: number
  cursorSessionID?: string
  archived?: boolean
}) {
  const conditions = missionSessionConditions(input)
  const limit = input?.limit ?? 100
  const rows = Database.use((db) =>
    db
      .select({ id: SessionTable.id })
      .from(SessionTable)
      .where(and(...conditions))
      .orderBy(desc(SessionTable.time_updated), desc(SessionTable.id))
      .limit(limit)
      .all(),
  )

  for (const row of rows) {
    const session = await Session.get(row.id)
    const missionID = missionIDFromInfo(session)
    if (!missionID) continue
    yield withMissionID(session, missionID)
  }
}

export type GlobalMissionProcessRecoveryCandidate = {
  sessionID: string
  directory: string
}

/**
 * Discover standalone Mission Sessions whose canonical reducer has work:
 * either a delete-retention intent lacks its Session tombstone, the latest
 * execution fact is `closing`, or a process-owned Turn did not settle.
 * Discovery is only a hint; the reconciler re-reads exact facts.
 */
export function listGlobalMissionProcessRecoveryCandidates(input: {
  scopeProjectID?: string
  sessionID?: string
  afterSessionID?: string
  limit: number
}): GlobalMissionProcessRecoveryCandidate[] {
  if (!Number.isSafeInteger(input.limit) || input.limit <= 0) {
    throw new Error("Mission process recovery discovery requires a positive bounded page size")
  }
  const rows = Database.use((db) =>
    db
      .select({ sessionID: SessionTable.id, directory: SessionTable.directory })
      .from(SessionTable)
      .where(
        and(
          eq(SessionTable.kind, "mission"),
          input.scopeProjectID ? eq(SessionTable.project_id, input.scopeProjectID) : undefined,
          input.sessionID ? eq(SessionTable.id, input.sessionID) : undefined,
          input.afterSessionID ? sql`${SessionTable.id} > ${input.afterSessionID}` : undefined,
          sql`json_extract(${SessionTable.metadata}, '$.mission.id') IS NOT NULL`,
          sql`(
            (
              EXISTS (
                SELECT 1
                FROM protocol_event AS delete_request
                WHERE delete_request.aggregate_type = 'session'
                  AND delete_request.aggregate_id = ${SessionTable.id}
                  AND delete_request.type = 'mission.retention.delete_requested'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM protocol_event AS deleted_session
                WHERE deleted_session.aggregate_type = 'session'
                  AND deleted_session.aggregate_id = ${SessionTable.id}
                  AND deleted_session.type = 'session.deleted'
              )
            )
            OR (
              ${SessionTable.time_archived} IS NULL
              AND (
            EXISTS (
              SELECT 1
              FROM protocol_event AS closing_event
              WHERE closing_event.aggregate_type = 'session'
                AND closing_event.aggregate_id = ${SessionTable.id}
                AND closing_event.type = 'mission.execution.closing'
                AND NOT EXISTS (
                  SELECT 1
                  FROM protocol_event AS later_closure
                  WHERE later_closure.aggregate_type = 'session'
                    AND later_closure.aggregate_id = closing_event.aggregate_id
                    AND later_closure.type IN (
                      'mission.execution.opened',
                      'mission.execution.closing',
                      'mission.execution.closed'
                    )
                    AND (
                      later_closure.seq > closing_event.seq
                      OR (later_closure.seq = closing_event.seq AND later_closure.id > closing_event.id)
                    )
                )
            )
            OR EXISTS (
              SELECT 1
              FROM ${MessageTable}
              WHERE ${MessageTable.session_id} = ${SessionTable.id}
                AND json_extract(${MessageTable.data}, '$.role') = 'assistant'
                AND json_extract(${MessageTable.data}, '$.time.completed') IS NULL
                AND NOT EXISTS (
                  SELECT 1
                  FROM message AS newer_user
                  WHERE newer_user.session_id = ${SessionTable.id}
                    AND json_extract(newer_user.data, '$.role') = 'user'
                    AND (
                      newer_user.time_created > ${MessageTable.time_created}
                      OR (
                        newer_user.time_created = ${MessageTable.time_created}
                        AND newer_user.id > ${MessageTable.id}
                      )
                    )
                )
            )
            OR EXISTS (
              SELECT 1
              FROM ${MessageTable} AS recovery_wake
              WHERE recovery_wake.session_id = ${SessionTable.id}
                AND json_extract(recovery_wake.data, '$.role') = 'user'
                AND json_extract(recovery_wake.data, '$.extra.wake_reason.source') = 'mission.process_recovery'
                AND json_extract(recovery_wake.data, '$.extra.wake_reason.version') = 3
                AND json_extract(recovery_wake.data, '$.extra.wake_reason.openedEventID') = (
                  SELECT current_opened.id
                  FROM protocol_event AS current_opened
                  WHERE current_opened.aggregate_type = 'session'
                    AND current_opened.aggregate_id = ${SessionTable.id}
                    AND current_opened.type IN (
                      'mission.execution.opened',
                      'mission.execution.closing',
                      'mission.execution.closed'
                    )
                  ORDER BY current_opened.seq DESC,current_opened.id DESC
                  LIMIT 1
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM ${MessageTable} AS terminal_recovery_reply
                  WHERE terminal_recovery_reply.session_id = ${SessionTable.id}
                    AND json_extract(terminal_recovery_reply.data, '$.role') = 'assistant'
                    AND json_extract(terminal_recovery_reply.data, '$.parentID') = recovery_wake.id
                    AND json_extract(terminal_recovery_reply.data, '$.time.completed') IS NOT NULL
                    AND NOT (
                      json_extract(terminal_recovery_reply.data, '$.finish') = 'error'
                      AND json_extract(terminal_recovery_reply.data, '$.error.name') = 'ProcessExecutionInterruptedError'
                      AND json_type(terminal_recovery_reply.data, '$.error') = 'object'
                      AND (SELECT COUNT(*) FROM json_each(json_extract(terminal_recovery_reply.data, '$.error'))) = 2
                      AND json_type(terminal_recovery_reply.data, '$.error.data') = 'object'
                      AND (SELECT COUNT(*) FROM json_each(json_extract(terminal_recovery_reply.data, '$.error.data'))) = 1
                      AND json_type(terminal_recovery_reply.data, '$.error.data.message') = 'text'
                      AND length(json_extract(terminal_recovery_reply.data, '$.error.data.message')) > 0
                    )
                )
            )
              )
            )
          )`,
        ),
      )
      .orderBy(SessionTable.id)
      .limit(input.limit)
      .all(),
  )
  return rows
}

async function ensureMissionSessionInner(input: {
  missionID: MissionID
  directory: string
  productPillar: ProductPillar
  heldExpertSquadIDs: MissionVisibleExpertSquadIDs
  /** Committed in the Session insert, never patched in afterwards: a Mission
   *  Session must carry its title and model overlay from its first durable
   *  instant, or a death right after publication runs it on the base model. */
  initialTitle?: string
  initialConfigOverlay?: Record<string, unknown>
  creationMetadata?: Record<string, unknown>
}) {
  const missionID = input.missionID
  const session = Database.immediateTransaction((db) => {
    const existingID = db
      .select({ id: SessionTable.id })
      .from(SessionTable)
      .where(
        and(
          eq(SessionTable.project_id, Instance.project.id),
          eq(SessionTable.directory, input.directory),
          eq(SessionTable.kind, "mission"),
          sql`json_extract(${SessionTable.metadata}, '$.mission.id') = ${missionID}`,
        ),
      )
      .get()?.id
    if (existingID) {
      assertSessionDeletionAdmissionInTransaction(db, existingID)
      const row = db.select().from(SessionTable).where(eq(SessionTable.id, existingID)).get()!
      const existing = Session.fromRow(row)
      const metadata = requireMissionLaunchMetadata(existing)
      if (!Project.samePath(metadata.cwd, existing.directory)) {
        throw new Error(`Mission ${missionID} holds a working directory that conflicts with its Session directory.`)
      }
      return existing
    }
    return Session.persistPreparedNextInTransaction(
      db,
      Session.prepareRootNext({
        directory: input.directory,
        title: input.initialTitle ?? MISSION_CONTROL_DEFAULT_TITLE,
        kind: "mission",
        metadata: {
          ...(input.creationMetadata ?? {}),
          ...canonicalMissionMetadata(input),
          ...(input.initialConfigOverlay ? { configOverlay: input.initialConfigOverlay } : {}),
        },
      }),
    )
  })
  if (missionProductPillar(session) !== input.productPillar) {
    throw new Error(`Mission ${missionID} already holds a different immutable product pillar.`)
  }
  assertMissionExpertSquadSnapshot(missionID, missionVisibleExpertSquadIDs(session), input.heldExpertSquadIDs)
  await beforeRuntimeMaterializationForTest?.({ sessionID: session.id, missionID })
  const createdRuntimeRoot = await ensureMissionRuntimeDirectory({ directory: session.directory, missionID })
  try {
    Database.immediateTransaction((db) => assertSessionDeletionAdmissionInTransaction(db, session.id))
  } catch (error) {
    if (!createdRuntimeRoot) throw error
    try {
      await fs.rm(createdRuntimeRoot, { recursive: true })
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Mission ${missionID} deletion admission failed after runtime materialization and cleanup also failed`,
      )
    }
    throw error
  }
  return withMissionID(session, missionID)
}

export async function ensureMissionSession(input: {
  missionID: string
  defaultCwd: string
  productPillar: ProductPillar
  heldExpertSquadIDs: MissionVisibleExpertSquadIDs
  initialTitle?: string
  initialConfigOverlay?: Record<string, unknown>
  creationMetadata?: Record<string, unknown>
}) {
  const missionID = MissionID.parse(input.missionID)
  const directory = normalizeDirectory(input.defaultCwd)
  const lockKey = `${Instance.project.id}:${directory}:${missionID}`
  const existing = locks.get(lockKey)
  if (existing) {
    const session = await existing
    if (session.productPillar !== input.productPillar) {
      throw new Error(`Mission ${missionID} already holds a different immutable product pillar.`)
    }
    assertMissionExpertSquadSnapshot(missionID, missionVisibleExpertSquadIDs(session), input.heldExpertSquadIDs)
    return session
  }

  const promise = ensureMissionSessionInner({
    missionID,
    directory,
    productPillar: input.productPillar,
    heldExpertSquadIDs: input.heldExpertSquadIDs,
    initialTitle: input.initialTitle,
    initialConfigOverlay: input.initialConfigOverlay,
    creationMetadata: input.creationMetadata,
  }).finally(() => locks.delete(lockKey))
  locks.set(lockKey, promise)
  return promise
}

export const MissionSessionTestHooks = {
  installBeforeRuntimeMaterialization(
    hook: (input: { sessionID: string; missionID: string }) => void | Promise<void>,
  ): Disposable {
    if (beforeRuntimeMaterializationForTest) {
      throw new Error("Mission runtime-materialization test hook is already installed")
    }
    beforeRuntimeMaterializationForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeRuntimeMaterializationForTest === hook) beforeRuntimeMaterializationForTest = undefined
      },
    }
  },
}
