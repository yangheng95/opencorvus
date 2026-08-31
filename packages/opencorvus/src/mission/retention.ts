import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Bus } from "@/bus"
import type { TaskCancellationOrigin } from "@/engine/cancellation-origin"
import {
  acquireControlLease,
  assertControlLeaseInTransaction,
  releaseControlLeaseInTransaction,
  releaseControlLeaseOnErrorPath,
  renewControlLease,
} from "@/engine/control-lease"
import { Identifier } from "@/id/id"
import { Session } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { Database, and, eq, sql } from "@/storage/db"
import { abortAfterAny } from "@/util/abort"
import { currentMissionExecutionClosureInTransaction, type MissionExecutionClosure } from "./execution-closure"
import { MissionID } from "./schema"
import {
  currentMissionDeleteRetentionIntent,
  currentMissionDeleteRetentionIntentInTransaction,
  ensureMissionDeleteRetentionIntentInTransaction,
  sessionDeletedInTransaction,
  type MissionDeleteRetentionIntent,
} from "./retention-facts"
import type { MissionExecutionCloseProvenance } from "./execution-closure-schema"

const leaseMilliseconds = 120_000
const renewalMilliseconds = 40_000

let afterDeleteIntentCommittedForTest: ((intent: MissionDeleteRetentionIntent) => void | Promise<void>) | undefined
let afterDeleteCompletionObservedPendingForTest:
  | ((intent: MissionDeleteRetentionIntent) => void | Promise<void>)
  | undefined
type MissionSessionDeleter = (
  sessionID: string,
  input: { deleteTasks: true; projectID: string; cancellationOrigin: TaskCancellationOrigin },
) => Promise<boolean>
let missionSessionDeleter: MissionSessionDeleter | undefined

export function bindMissionRetentionSessionDeleter(deleter: MissionSessionDeleter): void {
  missionSessionDeleter = deleter
}

function requireMissionRetentionSessionDeleter(): MissionSessionDeleter {
  if (!missionSessionDeleter) {
    throw new Error("Mission retention Session deleter is not bound by Task runtime bootstrap")
  }
  return missionSessionDeleter
}

export const MissionDeleteRetentionRequestedError = NamedError.create(
  "MissionDeleteRetentionRequestedError",
  z
    .object({
      message: z.string(),
      missionID: MissionID,
      sessionID: Identifier.schema("session"),
      deleteRequestEventID: Identifier.schema("protocol_event"),
    })
    .strict(),
)

export const MissionDeleteRetentionOwnedError = NamedError.create(
  "MissionDeleteRetentionOwnedError",
  z
    .object({
      message: z.string(),
      missionID: MissionID,
      sessionID: Identifier.schema("session"),
      deleteRequestEventID: Identifier.schema("protocol_event"),
      leaseExpiresAt: z.number().int().nonnegative(),
    })
    .strict(),
)

function assertMissionIdentity(
  closure: MissionExecutionClosure | undefined,
  input: { missionID: string; sessionID: string },
): asserts closure is MissionExecutionClosure {
  if (!closure) throw new Error(`Mission ${input.missionID} has no execution closure fact`)
  if (closure.missionID !== input.missionID || closure.sessionID !== input.sessionID) {
    throw new Error(`Mission execution closure for Session ${input.sessionID} has conflicting Mission identity`)
  }
}

function deleteRequestedError(intent: MissionDeleteRetentionIntent) {
  return new MissionDeleteRetentionRequestedError({
    message: `Mission ${intent.missionID} has accepted delete request ${intent.requestID}.`,
    missionID: intent.missionID,
    sessionID: intent.sessionID,
    deleteRequestEventID: intent.eventID,
  })
}

export type MissionRetentionCommitResult<T> = { status: "committed"; value: T } | { status: "occurrence_changed" }

/**
 * Archive and restore share the Session projection writer. The exact closed
 * occurrence and absence of a delete intent are proved under the same write
 * lock as the projection update, so a wake or delete request linearizes first.
 */
export function commitMissionArchiveRetention(input: {
  missionID: string
  sessionID: string
  expectedClosureEventID: string
  archived: boolean
}): MissionRetentionCommitResult<Session.Info> {
  return Database.immediateTransaction((db) => {
    const intent = currentMissionDeleteRetentionIntentInTransaction(db, input.sessionID)
    if (intent) throw deleteRequestedError(intent)
    if (sessionDeletedInTransaction(db, input.sessionID)) {
      throw new Error(`Mission ${input.missionID} Session ${input.sessionID} is already deleted`)
    }
    const closure = currentMissionExecutionClosureInTransaction(db, input.sessionID)
    assertMissionIdentity(closure, input)
    if (closure.state !== "closed" || closure.eventID !== input.expectedClosureEventID) {
      return { status: "occurrence_changed" as const }
    }
    const now = Date.now()
    const row = db
      .update(SessionTable)
      .set({ time_archived: input.archived ? now : null, time_updated: now })
      .where(
        and(
          eq(SessionTable.id, input.sessionID),
          eq(SessionTable.kind, "mission"),
          sql`json_extract(${SessionTable.metadata}, '$.mission.id') = ${input.missionID}`,
        ),
      )
      .returning()
      .get()
    if (!row) throw new Error(`Mission ${input.missionID} Session disappeared during retention update`)
    const info = Session.fromRow(row)
    Bus.publishOwnedInTransaction(Session.Event.Updated, { info })
    return { status: "committed" as const, value: info }
  })
}

/** Append or replay the one immutable delete admission against an exact closed occurrence. */
export async function requestMissionDeleteRetention(input: {
  missionID: string
  sessionID: string
  expectedClosureEventID: string
  requestID: string
  provenance: z.input<typeof MissionExecutionCloseProvenance>
}): Promise<MissionRetentionCommitResult<MissionDeleteRetentionIntent>> {
  const result = Database.immediateTransaction((db) => {
    const existing = currentMissionDeleteRetentionIntentInTransaction(db, input.sessionID)
    if (existing) {
      if (existing.missionID !== input.missionID) {
        throw new Error(
          `Mission delete retention ${existing.eventID} belongs to Mission ${existing.missionID}, not ${input.missionID}`,
        )
      }
      return { status: "committed" as const, value: existing }
    }
    const closure = currentMissionExecutionClosureInTransaction(db, input.sessionID)
    assertMissionIdentity(closure, input)
    if (closure.state !== "closed" || closure.eventID !== input.expectedClosureEventID) {
      return { status: "occurrence_changed" as const }
    }
    const value = ensureMissionDeleteRetentionIntentInTransaction(db, input)
    return { status: "committed" as const, value }
  })
  if (result.status === "committed") {
    await afterDeleteIntentCommittedForTest?.(result.value)
  }
  return result
}

export function findMissionDeleteRetention(input: {
  missionID: string
  projectID: string
  directory: string
}): MissionDeleteRetentionIntent | undefined {
  return Database.use((db) => {
    const row = db
      .select({ sessionID: SessionTable.id })
      .from(SessionTable)
      .where(
        and(
          eq(SessionTable.project_id, input.projectID),
          eq(SessionTable.directory, input.directory),
          eq(SessionTable.kind, "mission"),
          sql`json_extract(${SessionTable.metadata}, '$.mission.id') = ${input.missionID}`,
        ),
      )
      .get()
    if (!row) return undefined
    const intent = currentMissionDeleteRetentionIntentInTransaction(db, row.sessionID)
    if (intent && intent.missionID !== input.missionID) {
      throw new Error(
        `Mission delete retention ${intent.eventID} belongs to Mission ${intent.missionID}, not ${input.missionID}`,
      )
    }
    return intent
  })
}

function cancellationOrigin(intent: MissionDeleteRetentionIntent): TaskCancellationOrigin {
  return {
    actor: "user",
    source: "mission.delete",
    surface: intent.provenance.surface,
    requestID: intent.requestID,
    reason: intent.provenance.reason,
    sessionID: intent.sessionID,
    missionID: intent.missionID,
  }
}

export type MissionDeleteRetentionResumeResult =
  | { status: "completed"; intent: MissionDeleteRetentionIntent }
  | { status: "owned"; intent: MissionDeleteRetentionIntent; leaseExpiresAt: number }

/**
 * Direct HTTP, startup and heartbeat all enter this physical owner. The
 * immutable intent remains the recovery input until EngineService appends the
 * unique session.deleted boundary.
 */
export async function resumeMissionDeleteRetention(input: {
  sessionID: string
  projectID: string
  signal?: AbortSignal
}): Promise<MissionDeleteRetentionResumeResult> {
  const intent = currentMissionDeleteRetentionIntent(input.sessionID)
  if (!intent) throw new Error(`Mission Session ${input.sessionID} has no delete retention intent`)
  if (Database.use((db) => sessionDeletedInTransaction(db, input.sessionID))) {
    return { status: "completed", intent }
  }
  await afterDeleteCompletionObservedPendingForTest?.(intent)
  const ownerOccurrenceID = Identifier.ascending("call")
  const targetID = `mission:${input.sessionID}`
  const acquired = acquireControlLease({
    target: "lifecycle",
    targetID,
    ownerOccurrenceID,
    now: Date.now(),
    leaseMilliseconds,
  })
  if (!acquired.acquired) {
    return { status: "owned", intent, leaseExpiresAt: acquired.lease.expires_at }
  }
  const owner = new AbortController()
  const deadline = abortAfterAny(120_000, owner.signal, ...(input.signal ? [input.signal] : []))
  let renewalFailure: unknown
  const renewal = setInterval(() => {
    if (renewalFailure) return
    try {
      const now = Date.now()
      renewControlLease({
        target: "lifecycle",
        targetID,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now,
        expiresAt: now + leaseMilliseconds,
      })
    } catch (error) {
      renewalFailure = error
      owner.abort(error)
    }
  }, renewalMilliseconds)
  renewal.unref()
  let completed = false
  try {
    deadline.signal.throwIfAborted()
    const preEffect = Database.immediateTransaction((db) => {
      assertControlLeaseInTransaction(db, {
        target: "lifecycle",
        targetID,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now: Date.now(),
      })
      const current = currentMissionDeleteRetentionIntentInTransaction(db, input.sessionID)
      if (!current || current.eventID !== intent.eventID) {
        throw new Error(`Mission delete retention ${intent.eventID} changed before cleanup`)
      }
      if (!sessionDeletedInTransaction(db, input.sessionID)) return "pending" as const
      releaseControlLeaseInTransaction(db, {
        target: "lifecycle",
        targetID,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now: Date.now(),
      })
      return "completed" as const
    })
    if (preEffect === "completed") {
      completed = true
      return { status: "completed", intent }
    }
    await requireMissionRetentionSessionDeleter()(intent.sessionID, {
      deleteTasks: true,
      projectID: input.projectID,
      cancellationOrigin: cancellationOrigin(intent),
    })
    if (renewalFailure) throw renewalFailure
    deadline.signal.throwIfAborted()
    Database.immediateTransaction((db) => {
      const exact = currentMissionDeleteRetentionIntentInTransaction(db, input.sessionID)
      if (!exact || exact.eventID !== intent.eventID || !sessionDeletedInTransaction(db, input.sessionID)) {
        throw new Error(`Mission delete retention ${intent.eventID} cleanup did not commit session.deleted`)
      }
      releaseControlLeaseInTransaction(db, {
        target: "lifecycle",
        targetID,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now: Date.now(),
      })
    })
    completed = true
    return { status: "completed", intent }
  } finally {
    clearInterval(renewal)
    deadline.clearTimeout()
    if (!completed) {
      releaseControlLeaseOnErrorPath({
        target: "lifecycle",
        targetID,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now: Date.now(),
      })
    }
  }
}

export function requireCompletedMissionDeleteRetention(
  result: MissionDeleteRetentionResumeResult,
): MissionDeleteRetentionIntent {
  if (result.status === "completed") return result.intent
  throw new MissionDeleteRetentionOwnedError({
    message: `Mission ${result.intent.missionID} delete request is owned until ${result.leaseExpiresAt}.`,
    missionID: result.intent.missionID,
    sessionID: result.intent.sessionID,
    deleteRequestEventID: result.intent.eventID,
    leaseExpiresAt: result.leaseExpiresAt,
  })
}

export const MissionRetentionTestHooks = {
  installAfterDeleteIntentCommitted(hook: (intent: MissionDeleteRetentionIntent) => void | Promise<void>): Disposable {
    if (afterDeleteIntentCommittedForTest) throw new Error("Mission delete-intent hook is already installed")
    afterDeleteIntentCommittedForTest = hook
    return {
      [Symbol.dispose]() {
        if (afterDeleteIntentCommittedForTest === hook) afterDeleteIntentCommittedForTest = undefined
      },
    }
  },
  installAfterDeleteCompletionObservedPending(
    hook: (intent: MissionDeleteRetentionIntent) => void | Promise<void>,
  ): Disposable {
    if (afterDeleteCompletionObservedPendingForTest) {
      throw new Error("Mission delete pending-completion hook is already installed")
    }
    afterDeleteCompletionObservedPendingForTest = hook
    return {
      [Symbol.dispose]() {
        if (afterDeleteCompletionObservedPendingForTest === hook) {
          afterDeleteCompletionObservedPendingForTest = undefined
        }
      },
    }
  },
}
