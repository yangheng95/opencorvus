import { Database, NotFoundError, and, desc, eq, isNull, like, or, sql } from "../storage/db"
import fs from "node:fs/promises"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Project } from "@/project/project"
import { Session } from "@/session"
import { MessageTable, SessionControlRecordTable, SessionTable } from "@/session/session.sql"
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
import { ProtocolEventTable } from "@/protocol/protocol.sql"

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

async function ensureMissionRuntimeDirectory(input: { directory: string; missionID: string }) {
  await fs.mkdir(ProjectRuntimePaths.missionRoot(input.directory, input.missionID), { recursive: true })
}

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
 * Discover standalone Mission Sessions whose process-owned Turn did not
 * settle, including the post-terminalization/pre-wake crash cut represented
 * by the durable Mission recovery marker, or whose exact current execution
 * occurrence is already durably closing and must converge after host restart.
 */
export function listGlobalMissionProcessRecoveryCandidates(input?: {
  scopeProjectWorktree?: string
}): GlobalMissionProcessRecoveryCandidate[] {
  const rows = Database.use((db) =>
    db
      .select({ sessionID: SessionTable.id, directory: SessionTable.directory })
      .from(SessionTable)
      .where(
        and(
          eq(SessionTable.kind, "mission"),
          isNull(SessionTable.time_archived),
          sql`json_extract(${SessionTable.metadata}, '$.mission.id') IS NOT NULL`,
          sql`(
            EXISTS (
              SELECT 1
              FROM ${SessionControlRecordTable}
              WHERE ${SessionControlRecordTable.session_id} = ${SessionTable.id}
                AND ${SessionControlRecordTable.kind} = 'mission_process_recovery'
                AND NOT EXISTS (
                  SELECT 1 FROM session_control_event
                  WHERE session_control_event.control_id = ${SessionControlRecordTable.id}
                    AND session_control_event.kind IN ('consumed', 'failed')
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
              FROM ${ProtocolEventTable} AS current_closure
              WHERE current_closure.aggregate_type = 'session'
                AND current_closure.aggregate_id = ${SessionTable.id}
                AND current_closure.type = 'mission.execution.closing'
                AND NOT EXISTS (
                  SELECT 1
                  FROM ${ProtocolEventTable} AS newer_closure
                  WHERE newer_closure.aggregate_type = 'session'
                    AND newer_closure.aggregate_id = current_closure.aggregate_id
                    AND newer_closure.type IN (
                      'mission.execution.opened',
                      'mission.execution.closing',
                      'mission.execution.closed'
                    )
                    AND newer_closure.seq > current_closure.seq
                )
            )
          )`,
        ),
      )
      .orderBy(SessionTable.directory, SessionTable.id)
      .all(),
  )
  return rows.filter(
    (row) => !input?.scopeProjectWorktree || Project.samePath(row.directory, input.scopeProjectWorktree),
  )
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
      const row = db.select().from(SessionTable).where(eq(SessionTable.id, existingID)).get()!
      const existing = Session.fromRow(row)
      const metadata = requireMissionLaunchMetadata(existing)
      if (!Project.samePath(metadata.cwd, existing.directory)) {
        throw new Error(`Mission ${missionID} holds a working directory that conflicts with its Session directory.`)
      }
      return existing
    }
    return Session.persistPreparedNextInTransaction(db, Session.prepareRootNext({
      directory: input.directory,
      title: input.initialTitle ?? MISSION_CONTROL_DEFAULT_TITLE,
      kind: "mission",
      metadata: {
        ...canonicalMissionMetadata(input),
        ...(input.initialConfigOverlay ? { configOverlay: input.initialConfigOverlay } : {}),
      },
    }))
  })
  if (missionProductPillar(session) !== input.productPillar) {
    throw new Error(`Mission ${missionID} already holds a different immutable product pillar.`)
  }
  assertMissionExpertSquadSnapshot(missionID, missionVisibleExpertSquadIDs(session), input.heldExpertSquadIDs)
  await ensureMissionRuntimeDirectory({ directory: session.directory, missionID })
  return withMissionID(session, missionID)
}

export async function ensureMissionSession(input: {
  missionID: string
  defaultCwd: string
  productPillar: ProductPillar
  heldExpertSquadIDs: MissionVisibleExpertSquadIDs
  initialTitle?: string
  initialConfigOverlay?: Record<string, unknown>
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
  }).finally(() => locks.delete(lockKey))
  locks.set(lockKey, promise)
  return promise
}
