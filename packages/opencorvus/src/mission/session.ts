import { settledRecoveryReplyPredicateSql } from "@/session/completed-reply"
import { Database, NotFoundError, and, desc, eq, isNull, like, or, sql } from "../storage/db"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Project } from "@/project/project"
import { Session } from "@/session"
import { sessionDirectoryFilterCondition } from "@/session/directory-filter"
import { activeSessionDeletionFenceInTransaction, assertSessionDeletionAdmissionInTransaction } from "@/session/deletion-cleanup"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { sessionNotDeletedSql } from "@/session/retention-read"
import { Filesystem } from "@/util/filesystem"
import { Identifier } from "@/id/id"
import { canonicalDigestSource, canonicalJSONValue } from "@/util/canonical-digest"
import { MISSION_CONTROL_DEFAULT_TITLE } from "@/session/first-message-title"
import {
  MissionID,
  MissionPendingPrompt,
  MissionRequestedExpertSquadIDs,
  MissionVisibleExpertSquadIDs,
  ProductPillarSchema,
  type ProductPillar,
} from "./schema"
import type { SessionPrompt } from "@/session/prompt"
import { missionExpertSquadSnapshotsMatch } from "./expert-squad-authority"
import { currentMissionDeleteRetentionIntentInTransaction } from "./retention-facts"
import { NamedError } from "@opencorvus-ai/util/error"
import { createHash, randomUUID } from "node:crypto"
import z from "zod"

export type MissionSession = Session.Info & { missionID: string; productPillar: ProductPillar }

const MissionDraftCreation = z.object({
  version: z.literal(1),
  requestID: z.string(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()

const MissionDraftCreationTarget = z.object({
  message: z.string(),
  missionID: MissionID,
  sessionID: Identifier.schema("session"),
})

export const MissionDraftCreationConflictError = NamedError.create(
  "MissionDraftCreationConflictError",
  MissionDraftCreationTarget.extend({ reason: z.enum(["identity", "deletion_in_progress"]) }),
)

export const MissionDraftCreationUnavailableError = NamedError.create(
  "MissionDraftCreationUnavailableError",
  MissionDraftCreationTarget,
)

export const MissionDraftEditConflictError = NamedError.create(
  "MissionDraftEditConflictError",
  z.object({
    message: z.string(),
    missionID: MissionID,
    sessionID: z.string(),
    reason: z.enum(["changed", "missing", "archived"]),
  }),
)

export const MissionDispatchDraftConflictError = NamedError.create(
  "MissionDispatchDraftConflictError",
  z.object({
    message: z.string(),
    missionID: MissionID,
    sessionID: z.string(),
    requestID: z.string(),
    reason: z.enum(["changed", "missing"]),
  }),
)

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

type MissionSessionCreation = {
  missionID: MissionID
  directory: string
  productPillar: ProductPillar
  heldExpertSquadIDs: MissionVisibleExpertSquadIDs
  initialTitle?: string
  initialConfigOverlay?: Record<string, unknown>
  creationMetadata?: Record<string, unknown>
  draft?: { binding: z.infer<typeof MissionDraftCreation>; pendingPrompt: MissionPendingPrompt }
}

function canonicalMissionMetadata(input: MissionSessionCreation) {
  return {
    mission: MissionLaunchMetadata.parse({
      id: input.missionID,
      channelKey: channelKeyForMission(input.missionID),
      cwd: input.directory,
      productPillar: input.productPillar,
      visibleExpertSquadIDs: input.heldExpertSquadIDs,
      ...(input.draft && {
        draftCreation: input.draft.binding,
        pendingPrompt: input.draft.pendingPrompt,
      }),
    }),
  }
}

export function missionSessionFromInfo(session: Session.Info): MissionSession {
  const missionID = missionIDFromInfo(session)
  if (session.kind !== "mission" || !missionID) {
    throw new Error(`Session ${session.id} is not a Mission session with canonical metadata.mission.id.`)
  }
  return withMissionID(session, missionID)
}

export async function requireMissionSession(sessionID: string): Promise<MissionSession> {
  return missionSessionFromInfo(await Session.get(sessionID))
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
  return Database.immediateTransaction((db) =>
    updateMissionPendingPromptInTransaction(db, {
      sessionID: input.session.id,
      pendingPrompt: input.pendingPrompt,
    }),
  )
}

export async function editMissionPendingPrompt(input: {
  sessionID: string
  missionID: string
  request: string
  expectedRequest: string
}): Promise<Session.Info> {
  const pendingPrompt = MissionPendingPrompt.parse({ text: input.request })
  const expectedRequest = MissionPendingPrompt.shape.text.parse(input.expectedRequest)
  return Database.immediateTransaction((db) =>
    updateMissionPendingPromptInTransaction(db, {
      sessionID: input.sessionID,
      pendingPrompt,
      edit: {
        missionID: input.missionID,
        projectID: Instance.project.id,
        directory: normalizeDirectory(Instance.directory),
        expectedRequest,
      },
    }),
  )
}

function updateMissionPendingPromptInTransaction(
  db: Database.TxOrDb,
  input: {
    sessionID: string
    pendingPrompt?: MissionPendingPrompt
    consume?: { missionID: string; requestID: string; text: string }
    edit?: { missionID: string; projectID: string; directory: string; expectedRequest: string }
  },
): Session.Info {
  Database.requireActiveTransaction("updateMissionPendingPromptInTransaction")
  const row = db.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get()
  if (!row) throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
  const session = Session.fromRow(row)
  if (input.edit) {
    if (
      session.kind !== "mission" ||
      session.projectID !== input.edit.projectID ||
      session.directory !== input.edit.directory ||
      missionIDFromInfo(session) !== input.edit.missionID
    ) {
      throw new NotFoundError({ message: `Mission not found: ${input.edit.missionID}` })
    }
    assertSessionDeletionAdmissionInTransaction(db, input.sessionID)
    const pending = missionPendingPrompt(session)
    const reason = session.time.archived !== undefined ? "archived" : !pending ? "missing" : undefined
    if (reason) {
      throw new MissionDraftEditConflictError({
        message:
          reason === "archived"
            ? "Restore this Mission before editing its draft."
            : "This Mission has no pending draft to edit.",
        missionID: input.edit.missionID,
        sessionID: input.sessionID,
        reason,
      })
    }
    if (pending!.text === input.pendingPrompt?.text) return session
    if (pending!.text !== input.edit.expectedRequest) {
      throw new MissionDraftEditConflictError({
        message: "The Mission draft changed. Reload the current draft before saving your edits.",
        missionID: input.edit.missionID,
        sessionID: input.sessionID,
        reason: "changed",
      })
    }
  }
  if (session.kind !== "mission") throw new Error(`Session ${input.sessionID} is not a Mission session.`)
  const metadata = (session.metadata ?? {}) as Record<string, unknown>
  const mission = metadata.mission
  if (!mission || typeof mission !== "object" || Array.isArray(mission)) {
    throw new Error(`Mission session ${input.sessionID} is missing metadata.mission.`)
  }
  if (input.consume) {
    if ((mission as Record<string, unknown>).id !== input.consume.missionID) {
      throw new Error("Mission dispatch draft identity changed")
    }
    const pending = missionPendingPrompt(session)
    if (pending?.text !== input.consume.text) {
      throw new MissionDispatchDraftConflictError({
        message: "Mission pending draft changed before dispatch acceptance; submit the current draft with a new or unaccepted request identity.",
        missionID: input.consume.missionID,
        sessionID: input.sessionID,
        requestID: input.consume.requestID,
        reason: pending ? "changed" : "missing",
      })
    }
  }
  const { pendingPrompt: _consumedPendingPrompt, ...currentMission } = mission as Record<string, unknown>
  return Session.mergeMetadataInTransaction(db, {
    sessionID: input.sessionID,
    patch: {
      mission: {
        ...currentMission,
        ...(input.pendingPrompt ? { pendingPrompt: MissionPendingPrompt.parse(input.pendingPrompt) } : {}),
      },
    },
  })
}

export function consumeMissionPendingPromptInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; missionID: string; requestID: string; text: string },
): Session.Info {
  return updateMissionPendingPromptInTransaction(db, { sessionID: input.sessionID, consume: input })
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

function missionAuthorRequestScope(directory: string, requestID: string) {
  const { project, projectGeneration } = Instance
  const worktree = normalizeDirectory(project.worktree)
  const contained = Filesystem.contains(worktree, directory)
  const relative = contained ? path.relative(worktree, directory) : directory
  const directoryScope = [contained ? "worktree" : "directory", process.platform === "win32" ? relative.toLowerCase() : relative]
  return [project.id, projectGeneration, directoryScope, requestID]
}

/** Resolve the target before a first wake enters Session-scoped admission. */
export function firstMissionWakeID(requestID: string): MissionID {
  const scope = missionAuthorRequestScope(normalizeDirectory(Instance.directory), requestID)
  return MissionID.parse(`wake-${canonicalDigestSource("mission-first-wake-v1", scope).sha256.slice(0, 32)}`)
}

function findScopedMissionSessionID(db: Database.TxOrDb, input: { missionID: string; directory: string }) {
  return db
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
    .get()?.id
}

function findMissionSessionIDByDirectory(input: { missionID: string; directory: string }) {
  return Database.use((db) => findScopedMissionSessionID(db, input))
}

type MissionSessionListInput = {
  directory?: string
  search?: string
  limit?: number
  cursorUpdated?: number
  cursorSessionID?: string
  archived?: boolean
}

function missionSessionConditions(input?: MissionSessionListInput, projectID?: string) {
  const conditions = [
    eq(SessionTable.kind, "mission"),
    sessionNotDeletedSql(SessionTable.id),
    sql`json_extract(${SessionTable.metadata}, '$.mission.id') IS NOT NULL`,
  ]

  if (projectID) {
    conditions.push(eq(SessionTable.project_id, projectID))
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
  return Database.use((db) => {
    const row = db.select().from(SessionTable).where(and(
      eq(SessionTable.directory, directory),
      eq(SessionTable.kind, "mission"),
      sql`json_extract(${SessionTable.metadata}, '$.mission.id') = ${input.missionID}`,
      sessionNotDeletedSql(SessionTable.id),
    )).get()
    if (!row) throw new NotFoundError({ message: `Mission not found: ${input.missionID}` })
    return missionSessionFromInfo(Session.fromRow(row))
  })
}

export async function* listMissionSessions(input?: MissionSessionListInput) {
  yield* readMissionSessionList(input, Instance.project.id)
}

export async function* listGlobalMissionSessions(input?: MissionSessionListInput) {
  yield* readMissionSessionList(input)
}

function* readMissionSessionList(input?: MissionSessionListInput, projectID?: string) {
  const conditions = missionSessionConditions(input, projectID)
  const limit = input?.limit ?? 100
  const rows = Database.transaction((db) =>
    db
      .select()
      .from(SessionTable)
      .where(and(...conditions, sessionDirectoryFilterCondition(db, input?.directory, projectID)))
      .orderBy(desc(SessionTable.time_updated), desc(SessionTable.id))
      .limit(limit)
      .all(),
  )

  for (const row of rows) yield missionSessionFromInfo(Session.fromRow(row))
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
          sessionNotDeletedSql(SessionTable.id),
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
                    AND ${settledRecoveryReplyPredicateSql({ data: sql`terminal_recovery_reply.data`, messageID: sql`terminal_recovery_reply.id`, userMessageID: sql`recovery_wake.id` })}
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

function persistNewMissionSession(db: Database.TxOrDb, input: MissionSessionCreation, id?: string): Session.Info {
  return Session.persistPreparedNextInTransaction(db, Session.prepareRootNext({
    id,
    directory: input.directory,
    title: input.initialTitle ?? MISSION_CONTROL_DEFAULT_TITLE,
    kind: "mission",
    metadata: {
      ...(input.creationMetadata ?? {}),
      ...canonicalMissionMetadata(input),
      ...(input.initialConfigOverlay ? { configOverlay: input.initialConfigOverlay } : {}),
    },
  }))
}

async function ensureMissionSessionInner(input: MissionSessionCreation) {
  const missionID = input.missionID
  const session = Database.immediateTransaction((db) => {
    const existingID = findScopedMissionSessionID(db, input)
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
    return persistNewMissionSession(db, input)
  })
  if (missionProductPillar(session) !== input.productPillar) {
    throw new Error(`Mission ${missionID} already holds a different immutable product pillar.`)
  }
  assertMissionExpertSquadSnapshot(missionID, missionVisibleExpertSquadIDs(session), input.heldExpertSquadIDs)
  return materializeMissionRuntime(withMissionID(session, missionID))
}

async function materializeMissionRuntime(
  session: MissionSession,
  admit: (db: Database.TxOrDb, sessionID: string) => void = assertSessionDeletionAdmissionInTransaction,
): Promise<MissionSession> {
  const { missionID } = session
  await beforeRuntimeMaterializationForTest?.({ sessionID: session.id, missionID })
  const createdRuntimeRoot = await ensureMissionRuntimeDirectory({ directory: session.directory, missionID })
  try {
    Database.immediateTransaction((db) => admit(db, session.id))
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
  return session
}

/** Save one manual draft before its first publication, with exact author replay. */
export async function createMissionDraft(input: {
  requestID?: string
  title: string
  request: string
  productPillar: ProductPillar
  expertSquadIDs?: MissionRequestedExpertSquadIDs
  resolveExpertSquadIDs: () => Promise<MissionVisibleExpertSquadIDs>
}): Promise<MissionSession> {
  const { project } = Instance
  const directory = normalizeDirectory(Instance.directory)
  const requestID = input.requestID ?? randomUUID()
  const intent = missionAuthorRequestScope(directory, requestID)
  const missionID = MissionID.parse(`draft-${canonicalDigestSource("mission-draft-mission-v1", intent).sha256.slice(0, 32)}`)
  const sessionID = Identifier.deterministic("session", canonicalJSONValue(["mission-draft-session-v1", intent]))
  const pendingPrompt = MissionPendingPrompt.parse({ text: input.request })
  const binding = {
    version: 1,
    requestID,
    fingerprint: canonicalDigestSource("mission-draft-input-v1", [
      input.title,
      pendingPrompt.text,
      input.productPillar,
      input.expertSquadIDs ? [...input.expertSquadIDs].sort() : null,
    ]).sha256,
  } as const
  const target = { missionID, sessionID }
  const conflict = () => new MissionDraftCreationConflictError({
    ...target,
    message: "This Mission draft request is bound to a different creation input.",
    reason: "identity",
  })
  const assertAvailable = (db: Database.TxOrDb) => {
    if (Session.deletedInTransaction(db, sessionID)) {
      throw new MissionDraftCreationUnavailableError({ ...target, message: "The accepted Mission draft was deleted." })
    }
    if (currentMissionDeleteRetentionIntentInTransaction(db, sessionID) || activeSessionDeletionFenceInTransaction(db, sessionID)) {
      throw new MissionDraftCreationConflictError({
        ...target,
        message: "Deletion of the accepted Mission draft is in progress.",
        reason: "deletion_in_progress",
      })
    }
  }
  const find = (db: Database.TxOrDb): MissionSession | undefined => {
    assertAvailable(db)
    const row = db.select().from(SessionTable).where(eq(SessionTable.id, sessionID)).get()
    if (!row) {
      if (findScopedMissionSessionID(db, { missionID, directory })) throw conflict()
      return undefined
    }
    const accepted = Session.fromRow(row)
    if (accepted.kind !== "mission" || accepted.projectID !== project.id || !Project.samePath(accepted.directory, directory)) {
      throw conflict()
    }
    const receipt = MissionDraftCreation.safeParse(requireMissionLaunchMetadata(accepted).draftCreation)
    if (missionIDFromInfo(accepted) !== missionID || !receipt.success ||
      receipt.data.requestID !== binding.requestID || receipt.data.fingerprint !== binding.fingerprint) {
      throw conflict()
    }
    return withMissionID(accepted, missionID)
  }
  let session = Database.immediateTransaction(find)
  if (!session) {
    const heldExpertSquadIDs = await input.resolveExpertSquadIDs()
    session = Database.immediateTransaction((db) => find(db) ?? withMissionID(persistNewMissionSession(db, {
      missionID,
      directory,
      productPillar: input.productPillar,
      heldExpertSquadIDs,
      initialTitle: input.title,
      draft: { binding, pendingPrompt },
    }, sessionID), missionID))
  }
  return materializeMissionRuntime(session, assertAvailable)
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
