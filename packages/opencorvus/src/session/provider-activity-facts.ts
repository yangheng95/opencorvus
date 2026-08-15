import { Identifier } from "@/id/id"
import type { LLMActivityEvent } from "@/llm/activity"
import { Database, eq } from "@/storage/db"
import { MessageTable, ProviderActivityOutcomeTable, ProviderActivityRequestTable } from "./session.sql"
import { assertTaskRootAssistantActivationFenceInTransaction } from "@/engine/task-root-fact-store"

export function recordProviderActivityEvent(assistantMessageID: string, event: LLMActivityEvent): void {
  if (event.type !== "started" && event.type !== "terminal") return
  Database.transaction((db) => {
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
      ...(event.cls ? { error_class: event.cls } : {}),
      ...(event.error ? { error: event.error } : {}),
    }
    const existing = db.select().from(ProviderActivityOutcomeTable)
      .where(eq(ProviderActivityOutcomeTable.request_id, event.id)).get()
    if (existing) {
      if (existing.id !== id || JSON.stringify(existing.data) !== JSON.stringify(data)) {
        throw new Error(`Provider activity ${event.id} has conflicting terminal receipts.`)
      }
      return
    }
    db.insert(ProviderActivityOutcomeTable).values({ id, request_id: event.id, data, time_created: event.ts }).run()
  })
}
