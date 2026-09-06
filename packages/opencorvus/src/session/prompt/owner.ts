import { Identifier } from "@/id/id"
import { currentRuntimeProcessOccurrence, observeRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
import { Database, and, desc, eq, sql } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"
import { MessageTable, SessionPromptOwnerTable, SessionTable } from "../session.sql"
import { MissionProcessRecoveryWakeReason } from "../mission-process-recovery-schema"
import { assertSessionDeletionAdmissionInTransaction } from "../deletion-cleanup"

export namespace SessionPromptOwner {
  export type Authority = typeof SessionPromptOwnerTable.$inferSelect
  let activeExecutionObservationForTest:
    | ((authority: Authority) => "exact_live" | "dead_or_reused" | "unknown_live")
    | undefined
  let ownerObservationForTest:
    | ((authority: Authority) => "exact_live" | "dead_or_reused" | "unknown_live")
    | undefined

  export type Admission =
    | { acquired: true; authority: Authority }
    | { acquired: false; authority: Authority; observation: "exact_live" | "unknown_live" }

  type RecoveryFencePermit = { sessionID: string; messageID: string }
  const recoveryFencePermits = new WeakMap<(db: Database.TxOrDb) => void, RecoveryFencePermit>()

  export class RecoveryFenceError extends Error {
    override readonly name = "SessionPromptRecoveryFenceError"

    constructor(
      readonly sessionID: string,
      readonly recoveryMessageID: string,
    ) {
      super(`Session ${sessionID} Prompt acquisition is fenced by recovery Message ${recoveryMessageID}`)
    }
  }

  /**
   * Bind one physical Prompt acquisition to the unanswered real recovery
   * Message it is allowed to execute. The permit is process-local execution
   * authority only; the Message remains the durable fence and source of truth.
   */
  export function recoveryFencePreflight(input: {
    sessionID: string
    messageID: string
    preflight: (db: Database.TxOrDb) => void
  }): (db: Database.TxOrDb) => void {
    const preflight = (db: Database.TxOrDb) => input.preflight(db)
    recoveryFencePermits.set(preflight, { sessionID: input.sessionID, messageID: input.messageID })
    return preflight
  }

  function actionableRecoveryMessageIDsInTransaction(db: Database.TxOrDb, sessionID: string): string[] {
    const rows = db
      .select({ id: MessageTable.id, data: MessageTable.data })
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.session_id, sessionID),
          sql`json_extract(${MessageTable.data}, '$.role') = 'user'`,
          sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.source') = 'mission.process_recovery'`,
          sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.version') = 3`,
          sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.openedEventID') = (
            SELECT current_closure.id
            FROM protocol_event AS current_closure
            WHERE current_closure.aggregate_type = 'session'
              AND current_closure.aggregate_id = ${sessionID}
              AND current_closure.type IN (
                'mission.execution.opened',
                'mission.execution.closing',
                'mission.execution.closed'
              )
            ORDER BY current_closure.seq DESC,current_closure.id DESC
            LIMIT 1
          )`,
          sql`NOT EXISTS (
            SELECT 1
            FROM message AS terminal_recovery_reply
            WHERE terminal_recovery_reply.session_id = ${sessionID}
              AND json_extract(terminal_recovery_reply.data, '$.role') = 'assistant'
              AND json_extract(terminal_recovery_reply.data, '$.parentID') = ${MessageTable.id}
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
          )`,
        ),
    )
      .all()
    return rows.map((row) => {
      const data = row.data as { extra?: { wake_reason?: unknown } }
      const parsed = MissionProcessRecoveryWakeReason.safeParse(data.extra?.wake_reason)
      if (!parsed.success) {
        throw new Error(`Session ${sessionID} recovery Message ${row.id} violates its strict durable reason`)
      }
      return row.id
    })
  }

  export type ObservedAuthority = {
    authority: Authority
    observation: "exact_live" | "dead_or_reused" | "unknown_live"
  }

  function sameAuthority(left: Authority | undefined, right: Authority | undefined): boolean {
    if (!left || !right) return left === right
    return (
      left.session_id === right.session_id &&
      left.generation === right.generation &&
      left.owner_pid === right.owner_pid &&
      left.owner_process_instance_id === right.owner_process_instance_id &&
      left.owner_occurrence_id === right.owner_occurrence_id
    )
  }

  function observeAuthority(authority: Authority) {
    return (ownerObservationForTest ?? observation)(authority)
  }

  export function observeCurrent(sessionID: string): ObservedAuthority | undefined {
    const authority = current(sessionID)
    if (!authority) return undefined
    return { authority, observation: observeAuthority(authority) }
  }

  /**
   * Release only the exact dead physical owner observed by the caller outside
   * every database transaction. The transaction may consume that proof only
   * while the complete immutable authority remains unchanged.
   */
  export function releaseDeadInTransaction(
    db: Database.TxOrDb,
    input: { observed: ObservedAuthority },
  ): Authority | undefined {
    Database.requireActiveTransaction("SessionPromptOwner.releaseDeadInTransaction")
    const expected = input.observed.authority
    if (input.observed.observation !== "dead_or_reused") {
      throw new Error(`Session ${expected.session_id} Prompt owner ${expected.generation} is still live`)
    }
    const current = currentInTransaction(db, expected.session_id)
    if (!current) {
      throw new Error(
        `Session ${expected.session_id} Prompt owner ${expected.generation} disappeared before recovery claim`,
      )
    }
    if (!sameAuthority(current, expected)) {
      throw new Error(
        `Session ${expected.session_id} Prompt owner changed from ${expected.generation} to ${current.generation}`,
      )
    }
    const removed = db
      .delete(SessionPromptOwnerTable)
      .where(
        and(
          eq(SessionPromptOwnerTable.session_id, current.session_id),
          eq(SessionPromptOwnerTable.generation, current.generation),
        ),
      )
      .returning({ sessionID: SessionPromptOwnerTable.session_id })
      .get()
    if (removed?.sessionID !== expected.session_id) {
      throw new Error(`Session ${expected.session_id} Prompt owner ${current.generation} changed during recovery claim`)
    }
    return current
  }

  export function currentInTransaction(db: Database.TxOrDb, sessionID: string): Authority | undefined {
    return db.select().from(SessionPromptOwnerTable).where(eq(SessionPromptOwnerTable.session_id, sessionID)).get()
  }

  export function current(sessionID: string): Authority | undefined {
    return Database.use((db) => currentInTransaction(db, sessionID))
  }

  /**
   * Read the shared physical fact that one exact Session is currently inside
   * an unfinished assistant execution owned by a live (or conservatively
   * unobservable) process occurrence. A standby Prompt owner has no unfinished
   * assistant and therefore is not an active execution.
   */
  export function activeExecutionForObservedOwnerInTransaction(
    db: Database.TxOrDb,
    sessionID: string,
    observed: ObservedAuthority | undefined,
  ):
    | { stable: false }
    | {
        stable: true
        active?: {
          authority: Authority
          assistantMessageID: string
          observation: "exact_live" | "unknown_live"
        }
      } {
    const authority = currentInTransaction(db, sessionID)
    if (!sameAuthority(authority, observed?.authority)) return { stable: false }
    if (!authority || !observed || observed.observation === "dead_or_reused") return { stable: true }
    const assistant = db
      .select({ id: MessageTable.id })
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.session_id, sessionID),
          sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
          sql`json_extract(${MessageTable.data}, '$.time.completed') IS NULL`,
        ),
      )
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .get()
    if (!assistant) return { stable: true }
    const observation = activeExecutionObservationForTest
      ? activeExecutionObservationForTest(authority)
      : observed.observation
    if (observation === "dead_or_reused") return { stable: true }
    return {
      stable: true,
      active: {
        authority,
        assistantMessageID: assistant.id,
        observation,
      },
    }
  }

  export function activeExecution(sessionID: string) {
    while (true) {
      const observed = observeCurrent(sessionID)
      const result = Database.use((db) => activeExecutionForObservedOwnerInTransaction(db, sessionID, observed))
      if (result.stable) return result.active
    }
  }

  export function observation(authority: Authority): "exact_live" | "dead_or_reused" | "unknown_live" {
    return observeRuntimeProcessOccurrence({
      pid: authority.owner_pid,
      processInstanceID: authority.owner_process_instance_id,
      occurrenceID: authority.owner_occurrence_id,
    })
  }

  export const TestHooks = {
    installOwnerObservation(
      observe: (authority: Authority) => "exact_live" | "dead_or_reused" | "unknown_live",
    ): Disposable {
      if (ownerObservationForTest) {
        throw new Error("Session Prompt owner observation test hook is already installed")
      }
      ownerObservationForTest = observe
      return {
        [Symbol.dispose]() {
          if (ownerObservationForTest === observe) ownerObservationForTest = undefined
        },
      }
    },
    installActiveExecutionObservation(
      observe: (authority: Authority) => "exact_live" | "dead_or_reused" | "unknown_live",
    ): Disposable {
      if (activeExecutionObservationForTest) {
        throw new Error("Session Prompt active-execution observation test hook is already installed")
      }
      activeExecutionObservationForTest = observe
      return {
        [Symbol.dispose]() {
          if (activeExecutionObservationForTest === observe) activeExecutionObservationForTest = undefined
        },
      }
    },
  }

  /**
   * Acquire the physical prompt owner after process-local admission has proved
   * this process has no owner for the Session. A row from this exact process is
   * therefore cleanup residue and may be replaced; a peer row is replaceable
   * only after the operating system proves that exact process occurrence dead.
   */
  export function acquire(input: {
    sessionID: string
    projectID: string
    directory: string
    preflight?: (db: Database.TxOrDb) => void
  }): Admission {
    const owner = currentRuntimeProcessOccurrence()
    const retry = Symbol("session-prompt-owner-observation-changed")
    while (true) {
      const priorObservation = (() => {
        const authority = current(input.sessionID)
        if (!authority) return undefined
        const sameProcess =
          authority.owner_pid === owner.pid &&
          authority.owner_process_instance_id === owner.processInstanceID &&
          authority.owner_occurrence_id === owner.occurrenceID
        return {
          authority,
          observation: sameProcess ? ("exact_live" as const) : observeAuthority(authority),
        }
      })()
      const admission = Database.immediateTransaction((db) => {
        const prior = currentInTransaction(db, input.sessionID)
        if (!sameAuthority(prior, priorObservation?.authority)) return retry
        const session = db
          .select({ projectID: SessionTable.project_id, directory: SessionTable.directory })
          .from(SessionTable)
          .where(eq(SessionTable.id, input.sessionID))
          .get()
        if (!session) throw new Error(`Session prompt owner cannot acquire missing Session ${input.sessionID}`)
        if (
          session.projectID !== input.projectID ||
          Filesystem.resolve(session.directory) !== Filesystem.resolve(input.directory)
        ) {
          throw new Error(`Session prompt owner authority does not match Session ${input.sessionID}`)
        }
        assertSessionDeletionAdmissionInTransaction(db, input.sessionID)
        input.preflight?.(db)

        const recoveryMessages = actionableRecoveryMessageIDsInTransaction(db, input.sessionID)
        if (recoveryMessages.length > 1) {
          throw new Error(`Session ${input.sessionID} has multiple actionable Mission recovery Messages`)
        }
        const recoveryMessageID = recoveryMessages[0]
        if (recoveryMessageID) {
          const permit = input.preflight ? recoveryFencePermits.get(input.preflight) : undefined
          if (!permit || permit.sessionID !== input.sessionID || permit.messageID !== recoveryMessageID) {
            throw new RecoveryFenceError(input.sessionID, recoveryMessageID)
          }
        }

        if (prior) {
          const sameProcess =
            prior.owner_pid === owner.pid &&
            prior.owner_process_instance_id === owner.processInstanceID &&
            prior.owner_occurrence_id === owner.occurrenceID
          const observed = priorObservation!.observation
          if (!sameProcess && observed !== "dead_or_reused") {
            return { acquired: false as const, authority: prior, observation: observed }
          }
          db.delete(SessionPromptOwnerTable)
            .where(
              and(
                eq(SessionPromptOwnerTable.session_id, prior.session_id),
                eq(SessionPromptOwnerTable.generation, prior.generation),
              ),
            )
            .run()
        }

        const authority: Authority = {
          session_id: input.sessionID,
          project_id: input.projectID,
          directory: Filesystem.resolve(input.directory),
          generation: Identifier.ascending("call"),
          owner_pid: owner.pid,
          owner_process_instance_id: owner.processInstanceID,
          owner_occurrence_id: owner.occurrenceID,
          time_acquired: Date.now(),
        }
        db.insert(SessionPromptOwnerTable).values(authority).run()
        return { acquired: true as const, authority }
      })
      if (admission === retry) continue
      return admission
    }
  }

  export function release(authority: Authority): boolean {
    return Database.immediateTransaction((db) => {
      const currentAuthority = currentInTransaction(db, authority.session_id)
      if (!currentAuthority) return true
      if (currentAuthority.generation !== authority.generation) return false
      const removed = db
        .delete(SessionPromptOwnerTable)
        .where(
          and(
            eq(SessionPromptOwnerTable.session_id, authority.session_id),
            eq(SessionPromptOwnerTable.generation, authority.generation),
          ),
        )
        .returning({ sessionID: SessionPromptOwnerTable.session_id })
        .get()
      return removed?.sessionID === authority.session_id
    })
  }
}
