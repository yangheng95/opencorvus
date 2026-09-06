import { Identifier } from "@/id/id"
import type { LLMActivityEvent } from "@/llm/activity"
import { Log } from "@/util/log"
import { Database, eq } from "@/storage/db"
import { MessageTable, ProviderActivityOutcomeTable, ProviderActivityRequestTable } from "./session.sql"
import { assertTaskRootAssistantActivationFenceInTransaction } from "@/engine/task-root-fact-store"

const log = Log.create({ service: "session.provider-activity" })

/** Stamped on the outcome recovery writes for a call whose owner is gone. It
 * is the one receipt no owning process authored, so it is also the one a late
 * real receipt may legitimately contradict. */
export const PROVIDER_ACTIVITY_INTERRUPTION_ERROR_NAME = "ProcessExecutionInterruptedError"

export function recordProviderActivityEvent(assistantMessageID: string, event: LLMActivityEvent): void {
  if (event.type !== "started" && event.type !== "terminal") return
  // This is a cross-process write-ahead/terminal fact writer. Reserve the
  // SQLite writer before reading the existing request or outcome so a peer
  // writer cannot turn the later insert into a deferred read-to-write
  // SQLITE_BUSY failure before Provider execution begins.
  Database.immediateTransaction((db) => {
    if (event.type === "started") {
      assertTaskRootAssistantActivationFenceInTransaction(db, {
        assistantMessageID,
        now: event.ts,
      })
      const existing = db.select().from(ProviderActivityRequestTable)
        .where(eq(ProviderActivityRequestTable.id, event.id)).get()
      const message = db.select({ sessionID: MessageTable.session_id }).from(MessageTable)
        .where(eq(MessageTable.id, assistantMessageID)).get()
      if (!message || message.sessionID !== event.sessionID) {
        throw new Error(`Provider activity ${event.id} does not belong to assistant Message ${assistantMessageID}.`)
      }
      if (existing) {
        if (existing.assistant_message_id !== assistantMessageID) {
          throw new Error(`Provider activity ${event.id} already belongs to a different assistant Message.`)
        }
        return
      }
      db.insert(ProviderActivityRequestTable).values({
        id: event.id,
        assistant_message_id: assistantMessageID,
        time_created: event.ts,
      }).run()
      return
    }

    const request = db.select().from(ProviderActivityRequestTable)
      .where(eq(ProviderActivityRequestTable.id, event.id)).get()
    if (!request || request.assistant_message_id !== assistantMessageID) {
      throw new Error(`Provider activity ${event.id} terminal receipt has no matching request.`)
    }
    const id = Identifier.deterministic("part", `provider-activity-outcome\0${event.id}`)
    const data = {
      outcome: event.outcome,
      attempt_count: event.attempts ?? 1,
      ...(event.cls ? { error_class: event.cls } : {}),
      ...(event.error ? { error: event.error } : {}),
    }
    const existing = db.select().from(ProviderActivityOutcomeTable)
      .where(eq(ProviderActivityOutcomeTable.request_id, event.id)).get()
    if (existing) {
      if (existing.id !== id || JSON.stringify(existing.data) !== JSON.stringify(data)) {
        // Two owning processes claiming different results is the Host bug this
        // refuses. Recovery's own verdict is not that: it is written precisely
        // because no owner was left to write one, and an activation lease can
        // expire while the call it covers is still streaming. Throwing at the
        // late receipt would fault a Turn that recovery has already
        // terminalized, so the earlier verdict simply stands and the real
        // result is reported rather than lost silently.
        if (existing.data.error?.name === PROVIDER_ACTIVITY_INTERRUPTION_ERROR_NAME) {
          log.warn("provider activity returned after recovery declared its owner gone", {
            assistantMessageID,
            requestID: event.id,
            recoveredOutcome: existing.data.outcome,
            lateOutcome: event.outcome,
            lateErrorClass: event.cls,
          })
          return
        }
        throw new Error(`Provider activity ${event.id} has conflicting terminal receipts.`)
      }
      return
    }
    db.insert(ProviderActivityOutcomeTable).values({ id, request_id: event.id, data, time_created: event.ts }).run()
  })
}

/**
 * Close every provider activity a dead process abandoned on this assistant.
 *
 * A provider call is bracketed by two immutable facts: the write-ahead request
 * and its exact terminal receipt. A process killed mid-call leaves the first
 * without the second, and the Task-root settlement fence — which refuses to
 * complete an assistant while any accepted activity is unsettled — then has no
 * fact that could ever satisfy it. The assistant can never complete, every
 * later reconcile re-enters the same refusal, and the Task can never accept
 * another operator Message: one crash wedges it permanently.
 *
 * Recovery therefore writes the missing half itself. `aborted` is the truthful
 * outcome rather than a placeholder: a provider call that never returned left
 * no durable effect outside the conversation, and the assistant that owns it is
 * being terminalized as interrupted by the same act. This is the exact
 * counterpart of the pending Tool Parts that recovery already drives to
 * `error`, whose outcome facts are why tool requests were never the half that
 * wedged.
 *
 * Liveness is the caller's to establish: a request row carries no process
 * coordinate, so it cannot be re-derived here. Every caller proves it
 * independently — an expired Task-root activation lease, a recovered Mission
 * Session, or a loop entry that has just taken ownership of the Session.
 *
 * Returns the settled request IDs so the caller reports the dirty state it
 * repaired instead of swallowing it.
 */
export function settleAbandonedProviderActivity(input: {
  assistantMessageID: string
  now: number
  reason: string
}): string[] {
  const abandoned = Database.use((db) =>
    db
      .select({ id: ProviderActivityRequestTable.id })
      .from(ProviderActivityRequestTable)
      .where(eq(ProviderActivityRequestTable.assistant_message_id, input.assistantMessageID))
      .all()
      .filter(
        (request) =>
          !db
            .select({ id: ProviderActivityOutcomeTable.id })
            .from(ProviderActivityOutcomeTable)
            .where(eq(ProviderActivityOutcomeTable.request_id, request.id))
            .get(),
      )
      .map((request) => request.id),
  )
  for (const id of abandoned) {
    recordProviderActivityEvent(input.assistantMessageID, {
      type: "terminal",
      id,
      ts: input.now,
      outcome: "aborted",
      cls: "external_abort",
      error: { name: PROVIDER_ACTIVITY_INTERRUPTION_ERROR_NAME, message: input.reason },
    })
  }
  return abandoned
}
