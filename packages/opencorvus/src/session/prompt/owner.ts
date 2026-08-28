import { Identifier } from "@/id/id"
import { currentRuntimeProcessOccurrence, observeRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
import { Database, and, eq } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"
import { SessionPromptOwnerTable, SessionTable } from "../session.sql"

export namespace SessionPromptOwner {
  export type Authority = typeof SessionPromptOwnerTable.$inferSelect

  export type Admission =
    | { acquired: true; authority: Authority }
    | { acquired: false; authority: Authority; observation: "exact_live" | "unknown_live" }

  function currentInTransaction(db: Database.TxOrDb, sessionID: string): Authority | undefined {
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
  export function acquire(input: { sessionID: string; projectID: string; directory: string }): Admission {
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
