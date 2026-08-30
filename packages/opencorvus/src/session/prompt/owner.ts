import { Identifier } from "@/id/id"
import { currentRuntimeProcessOccurrence, observeRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
import { Database, and, eq, sql } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"
import { MessageTable, SessionPromptOwnerTable, SessionTable } from "../session.sql"
import { MissionProcessRecoveryWakeReason } from "../mission-process-recovery-schema"

export namespace SessionPromptOwner {
  export type Authority = typeof SessionPromptOwnerTable.$inferSelect

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

  /** Release only the exact dead physical owner observed by the caller. */
  export function releaseDeadInTransaction(
    db: Database.TxOrDb,
    input: { sessionID: string; expectedGeneration?: string },
  ): Authority | undefined {
    Database.requireActiveTransaction("SessionPromptOwner.releaseDeadInTransaction")
    const current = currentInTransaction(db, input.sessionID)
    if (!current) {
      if (input.expectedGeneration) {
        throw new Error(
          `Session ${input.sessionID} Prompt owner ${input.expectedGeneration} disappeared before recovery claim`,
        )
      }
      return undefined
    }
    if (input.expectedGeneration && current.generation !== input.expectedGeneration) {
      throw new Error(
        `Session ${input.sessionID} Prompt owner changed from ${input.expectedGeneration} to ${current.generation}`,
      )
    }
    if (observation(current) !== "dead_or_reused") {
      throw new Error(`Session ${input.sessionID} Prompt owner ${current.generation} is still live`)
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
    if (removed?.sessionID !== input.sessionID) {
      throw new Error(`Session ${input.sessionID} Prompt owner ${current.generation} changed during recovery claim`)
    }
    return current
  }

  export function currentInTransaction(db: Database.TxOrDb, sessionID: string): Authority | undefined {
    return db.select().from(SessionPromptOwnerTable).where(eq(SessionPromptOwnerTable.session_id, sessionID)).get()
  }

  export function current(sessionID: string): Authority | undefined {
    return Database.use((db) => currentInTransaction(db, sessionID))
  }

  export function observation(authority: Authority): "exact_live" | "dead_or_reused" | "unknown_live" {
    return observeRuntimeProcessOccurrence({
      pid: authority.owner_pid,
      processInstanceID: authority.owner_process_instance_id,
      occurrenceID: authority.owner_occurrence_id,
    })
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
    return Database.immediateTransaction((db) => {
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

      const prior = currentInTransaction(db, input.sessionID)
      if (prior) {
        const sameProcess =
          prior.owner_pid === owner.pid &&
          prior.owner_process_instance_id === owner.processInstanceID &&
          prior.owner_occurrence_id === owner.occurrenceID
        const observed = observation(prior)
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
