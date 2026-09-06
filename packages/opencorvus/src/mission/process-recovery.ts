import { Identifier } from "@/id/id"
import {
  acquireControlLease,
  assertControlLeaseInTransaction,
  releaseControlLeaseOnErrorPath,
  renewControlLease,
} from "@/engine/control-lease"
import { SessionLoop } from "@/session/loop"
import { MessageStore } from "@/session/message-store"
import { SessionPrompt } from "@/session/prompt"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { SessionWake } from "@/session/wake"
import { Database, and, desc, eq, inArray, sql } from "@/storage/db"
import { MessageTable } from "@/session/session.sql"
import { abortAfterAny } from "@/util/abort"
import { admitMissionExecutionWake, currentMissionExecutionClosure } from "./execution-closure"
import { applyMissionControlPromptOverlay, requireMissionSession } from "./session"
import {
  readActionableMissionProcessRecoveryWake,
  readIncompleteMissionAssistantMessageIDs,
  type MissionProcessRecoveryReason as RecoveryReason,
} from "./process-recovery-facts"

const RECOVERY_LEASE_MS = 30_000
const RECOVERY_DEADLINE_MS = 120_000
const MAX_RECOVERY_FRONTIER_MESSAGES = 64

function readTrailingIncompleteAssistantMessageIDs(sessionID: string): string[] {
  const rows = Database.use((db) =>
    db
      .select({ id: MessageTable.id })
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.session_id, sessionID),
          sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
          sql`json_extract(${MessageTable.data}, '$.time.completed') IS NULL`,
          sql`NOT EXISTS (
            SELECT 1 FROM message AS newer_user
            WHERE newer_user.session_id = ${sessionID}
              AND json_extract(newer_user.data, '$.role') = 'user'
              AND (
                newer_user.time_created > ${MessageTable.time_created}
                OR (newer_user.time_created = ${MessageTable.time_created} AND newer_user.id > ${MessageTable.id})
              )
          )`,
        ),
      )
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .limit(MAX_RECOVERY_FRONTIER_MESSAGES + 1)
      .all(),
  )
  if (rows.length > MAX_RECOVERY_FRONTIER_MESSAGES) {
    throw new Error(`Mission Session ${sessionID} recovery frontier exceeds ${MAX_RECOVERY_FRONTIER_MESSAGES} Messages`)
  }
  return rows.map((row) => row.id).toSorted()
}

function recoveryIdentity(input: {
  closureEventID: string
  deadOwnerGeneration: string
  interruptedFrontierDigest: string
}) {
  const key = [
    "mission-process-recovery-v3",
    input.closureEventID,
    input.deadOwnerGeneration,
    input.interruptedFrontierDigest,
  ].join("\0")
  return {
    occurrenceID: Identifier.deterministic("session_control", `${key}\0occurrence`),
    wakeMessageID: Identifier.deterministic("message", `${key}\0message`),
    wakeTextPartID: Identifier.deterministic("part", `${key}\0text`),
    wakeControlID: Identifier.deterministic("session_control", `${key}\0control`),
  }
}

function recoveryPrompt(interruptedCount: number): string {
  return (
    `The backend process ended while ${interruptedCount} assistant turn${interruptedCount === 1 ? " was" : "s were"} ` +
    "still executing. Inspect the persisted process-interruption facts, reconcile durable Mission state, and continue from the last safe boundary without duplicating completed work."
  )
}

function assertExactIncompleteFrontierInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; messageIDs: readonly string[] },
): void {
  Database.requireActiveTransaction("assertExactIncompleteFrontierInTransaction")
  if (input.messageIDs.length === 0) return
  const rows = db
    .select({ id: MessageTable.id })
    .from(MessageTable)
    .where(
      and(
        eq(MessageTable.session_id, input.sessionID),
        inArray(MessageTable.id, [...input.messageIDs]),
        sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
        sql`json_extract(${MessageTable.data}, '$.time.completed') IS NULL`,
      ),
    )
    .all()
  const exact = new Set(rows.map((row) => row.id))
  if (exact.size !== input.messageIDs.length || input.messageIDs.some((id) => !exact.has(id))) {
    throw new Error(`Mission Session ${input.sessionID} interrupted assistant frontier changed before recovery claim`)
  }
}

let afterRecoveryWriteAheadForTest:
  | ((input: { sessionID: string; wakeMessageID: string }) => void | Promise<void>)
  | undefined

export const MissionProcessRecoveryTestHooks = {
  installAfterWriteAhead(
    hook: (input: { sessionID: string; wakeMessageID: string }) => void | Promise<void>,
  ): Disposable {
    if (afterRecoveryWriteAheadForTest) throw new Error("Mission recovery write-ahead hook is already installed")
    afterRecoveryWriteAheadForTest = hook
    return {
      [Symbol.dispose]() {
        if (afterRecoveryWriteAheadForTest === hook) afterRecoveryWriteAheadForTest = undefined
      },
    }
  },
}

export type MissionProcessRecoveryResult =
  | { status: "not_needed"; sessionID: string }
  | { status: "live"; sessionID: string; ownerGeneration: string }
  | { status: "owned"; sessionID: string; ownerExpiresAt: number }
  | { status: "closure_settled"; sessionID: string; closureEventID: string }
  | { status: "woken"; sessionID: string; occurrenceID: string; attempt: 1; wakeMessageID: string }

/** Reconcile one Mission process interruption from immutable facts only. */
export async function recoverMissionProcessSession(
  sessionID: string,
  input: { signal?: AbortSignal; deadlineAt?: number } = {},
): Promise<MissionProcessRecoveryResult> {
  input.signal?.throwIfAborted()
  const deadlineAt = input.deadlineAt ?? Date.now() + RECOVERY_DEADLINE_MS
  if (!Number.isSafeInteger(deadlineAt) || deadlineAt <= Date.now()) {
    throw new Error(`Mission Session ${sessionID} recovery requires a future absolute deadline`)
  }
  const mission = await requireMissionSession(sessionID)
  const ownerOccurrenceID = Identifier.ascending("call")
  const targetID = `mission:${sessionID}`
  const acquired = acquireControlLease({
    target: "lifecycle",
    targetID,
    ownerOccurrenceID,
    now: Date.now(),
    leaseMilliseconds: RECOVERY_LEASE_MS,
  })
  if (!acquired.acquired) return { status: "owned", sessionID, ownerExpiresAt: acquired.lease.expires_at }

  const ownerAbort = new AbortController()
  const deadline = abortAfterAny(
    Math.max(1, deadlineAt - Date.now()),
    ownerAbort.signal,
    ...(input.signal ? [input.signal] : []),
  )
  const releaseLease = () =>
    releaseControlLeaseOnErrorPath({
      target: "lifecycle",
      targetID,
      leaseID: acquired.lease.id,
      ownerOccurrenceID,
      now: Date.now(),
    })
  const releaseLeaseOnAbort = () => releaseLease()
  deadline.signal.addEventListener("abort", releaseLeaseOnAbort, { once: true })
  const renewal = setInterval(() => {
    if (deadline.signal.aborted) return
    try {
      const now = Date.now()
      renewControlLease({
        target: "lifecycle",
        targetID,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now,
        expiresAt: now + RECOVERY_LEASE_MS,
      })
    } catch (error) {
      ownerAbort.abort(error)
    }
  }, RECOVERY_LEASE_MS / 3)
  renewal.unref()

  try {
    const closure = currentMissionExecutionClosure(sessionID)
    if (closure?.state === "closing" || closure?.state === "closed") {
      return { status: "closure_settled", sessionID, closureEventID: closure.eventID }
    }
    if (!closure || closure.state !== "opened") {
      throw new Error(`Mission Session ${sessionID} has interrupted work without an opened execution occurrence`)
    }

    const observedOwner = SessionPromptOwner.observeCurrent(sessionID)
    const owner = observedOwner?.authority
    if (observedOwner) {
      if (observedOwner.observation === "exact_live" || observedOwner.observation === "unknown_live") {
        return { status: "live", sessionID, ownerGeneration: observedOwner.authority.generation }
      }
    }

    const persistedWake = readActionableMissionProcessRecoveryWake({
      sessionID,
      missionID: mission.missionID,
      openedEventID: closure.eventID,
    })
    const trailingIncomplete = readTrailingIncompleteAssistantMessageIDs(sessionID)
    const interruptedAssistantMessageIDs = persistedWake
      ? persistedWake.reason.interruptedAssistantMessageIDs
      : trailingIncomplete
    if (!persistedWake && interruptedAssistantMessageIDs.length === 0) return { status: "not_needed", sessionID }
    if (!persistedWake && !owner) {
      throw new Error(`Mission Session ${sessionID} has an interrupted frontier without its exact dead Prompt owner`)
    }
    const interruptedFrontierDigest = SessionWake.recoveryFrontierDigest(interruptedAssistantMessageIDs)
    const identity = persistedWake
      ? {
          occurrenceID: persistedWake.reason.occurrenceID,
          wakeMessageID: persistedWake.messageID,
          wakeTextPartID: "",
          wakeControlID: "",
        }
      : recoveryIdentity({
          closureEventID: closure.eventID,
          deadOwnerGeneration: owner!.generation,
          interruptedFrontierDigest,
        })

    const exactIncompleteFrontier = [
      ...new Set([
        ...(persistedWake
          ? readIncompleteMissionAssistantMessageIDs(
              sessionID,
              persistedWake.reason.interruptedAssistantMessageIDs,
            )
          : []),
        ...trailingIncomplete,
      ]),
    ].toSorted()
    const completedAt = Date.now()
    const receipt = await admitMissionExecutionWake({
      missionID: mission.missionID,
      sessionID,
      wake: async (missionAdmission) => {
        if (!persistedWake) {
          const reason: RecoveryReason = {
            source: "mission.process_recovery",
            version: 3,
            missionID: mission.missionID,
            occurrenceID: identity.occurrenceID,
            openedEventID: closure.eventID,
            deadOwnerGeneration: owner!.generation,
            interruptedFrontierDigest,
            interruptedAssistantMessageIDs,
          }
          const prompt = applyMissionControlPromptOverlay({
            sessionID,
            messageID: identity.wakeMessageID,
            author: "OpenCorvus runtime recovery",
            agent: "mission",
            noReply: true as const,
            extra: {
              ...SessionWake.reasonExtra(reason),
              surface: "panel" as const,
            },
            byteMaterializationProjectID: mission.projectID,
            parts: [
              {
                id: identity.wakeTextPartID,
                type: "text" as const,
                text: recoveryPrompt(interruptedAssistantMessageIDs.length),
              },
            ],
          })
          await SessionPrompt.persistNoReplySequence([
            {
              input: prompt,
              hooks: {
                controls: (message) => [
                  {
                    id: identity.wakeControlID,
                    sessionID,
                    kind: "wake_reason",
                    status: "consumed",
                    owner: reason.source,
                    payload: { messageID: message.id, wake_reason: reason },
                  },
                ],
                preflightBundle: missionAdmission.preflightBundle,
                commitBundle: () =>
                  Database.use((db) => {
                    Database.requireActiveTransaction("recoverMissionProcessSession.writeAhead")
                    assertControlLeaseInTransaction(db, {
                      target: "lifecycle",
                      targetID,
                      leaseID: acquired.lease.id,
                      ownerOccurrenceID,
                      now: Date.now(),
                    })
                    assertExactIncompleteFrontierInTransaction(db, {
                      sessionID,
                      messageIDs: exactIncompleteFrontier,
                    })
                    SessionPromptOwner.releaseDeadInTransaction(db, { observed: observedOwner! })
                  }),
              },
            },
          ])
          await afterRecoveryWriteAheadForTest?.({ sessionID, wakeMessageID: identity.wakeMessageID })
          deadline.signal.throwIfAborted()
        } else {
          const persistedMessage = await MessageStore.get({ sessionID, messageID: persistedWake.messageID })
          if (persistedMessage.info.role !== "user") {
            throw new Error(`Mission recovery Message ${persistedWake.messageID} changed participant role`)
          }
          const persistedUserInfo = persistedMessage.info
          const persistedUserParts = persistedMessage.parts
          Database.immediateTransaction((db) => {
            missionAdmission.preflightBundle(persistedUserInfo, persistedUserParts)
            assertControlLeaseInTransaction(db, {
              target: "lifecycle",
              targetID,
              leaseID: acquired.lease.id,
              ownerOccurrenceID,
              now: Date.now(),
            })
            assertExactIncompleteFrontierInTransaction(db, {
              sessionID,
              messageIDs: exactIncompleteFrontier,
            })
            if (owner) {
              SessionPromptOwner.releaseDeadInTransaction(db, { observed: observedOwner! })
            }
          })
        }

        if (exactIncompleteFrontier.length > 0) {
          await SessionLoop.terminalizeRecoveredIncompleteAssistant(
            sessionID,
            deadline.signal,
            exactIncompleteFrontier.map((messageID) => ({ messageID, completedAt })),
          )
        }
        if (readIncompleteMissionAssistantMessageIDs(sessionID, exactIncompleteFrontier).length > 0) {
          throw new Error(`Mission Session ${sessionID} interrupted assistant frontier did not terminalize`)
        }
        deadline.signal.throwIfAborted()

        const ownerPreflight = SessionPromptOwner.recoveryFencePreflight({
          sessionID,
          messageID: identity.wakeMessageID,
          preflight: (db) => {
            missionAdmission.ownerPreflight(db)
            assertControlLeaseInTransaction(db, {
              target: "lifecycle",
              targetID,
              leaseID: acquired.lease.id,
              ownerOccurrenceID,
              now: Date.now(),
            })
          },
        })
        return {
          sessionID,
          messageID: identity.wakeMessageID,
          ...SessionWake.resumePersistedWakeWithReceipt({
            sessionID,
            messageID: identity.wakeMessageID,
            directory: mission.directory,
            signal: deadline.signal,
            retryFailedReply: Boolean(persistedWake),
            ownerPreflight,
            ownerLifecycle: missionAdmission.ownerLifecycle,
          }),
        }
      },
    })
    if (receipt.messageID !== identity.wakeMessageID) {
      throw new Error(`Mission process recovery wake identity changed for ${sessionID}`)
    }
    await receipt.activation
    const completion = await receipt.completion
    deadline.signal.throwIfAborted()
    if (!completion.ok) {
      throw new Error(`Mission process recovery wake ${identity.wakeMessageID} failed: ${completion.error}`)
    }
    return {
      status: "woken",
      sessionID,
      occurrenceID: identity.occurrenceID,
      attempt: 1,
      wakeMessageID: identity.wakeMessageID,
    }
  } finally {
    clearInterval(renewal)
    deadline.signal.removeEventListener("abort", releaseLeaseOnAbort)
    deadline.clearTimeout()
    releaseLease()
  }
}
