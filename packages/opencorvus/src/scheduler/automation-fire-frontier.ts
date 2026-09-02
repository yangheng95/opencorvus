import { createHash } from "node:crypto"
import { Database, and, desc, eq, sql } from "@/storage/db"
import {
  AutomationFireFrontierTable,
  AutomationFireTable,
  AutomationTable,
} from "./automation.sql"

export function scheduledAutomationFireID(revisionID: string, scheduledDueAt: number): string {
  const digest = createHash("sha256")
    .update(["scheduled-v2", revisionID, String(scheduledDueAt)].join("\u0000"))
    .digest("hex")
  return `cal_automation_${digest.slice(0, 32)}`
}

function assertAvailableAt(availableAt: number): void {
  if (!Number.isSafeInteger(availableAt) || availableAt < 0) {
    throw new Error(`Automation Fire frontier has invalid availability ${availableAt}`)
  }
}

export function currentAutomationFireFrontierInTransaction(
  db: Database.TxOrDb,
  definitionID: string,
): typeof AutomationFireFrontierTable.$inferSelect | undefined {
  return db
    .select()
    .from(AutomationFireFrontierTable)
    .where(eq(AutomationFireFrontierTable.definition_id, definitionID))
    .get()
}

export function publishAutomationFireFrontierInTransaction(
  db: Database.TxOrDb,
  input: {
    definition: typeof AutomationTable.$inferSelect
    fire: typeof AutomationFireTable.$inferSelect
    availableAt: number
  },
): typeof AutomationFireFrontierTable.$inferSelect {
  assertAvailableAt(input.availableAt)
  if (input.definition.status !== "active") {
    throw new Error(`Paused Automation revision ${input.definition.id} cannot own a Fire frontier`)
  }
  if (
    input.fire.automation_revision_id !== input.definition.id ||
    input.fire.scheduled_due_at > input.availableAt
  ) {
    throw new Error(`Automation Fire ${input.fire.id} cannot own frontier ${input.definition.definition_id}`)
  }
  db.insert(AutomationFireFrontierTable)
    .values({
      definition_id: input.definition.definition_id,
      automation_revision_id: input.definition.id,
      fire_id: input.fire.id,
      available_at: input.availableAt,
    })
    .onConflictDoUpdate({
      target: AutomationFireFrontierTable.definition_id,
      set: {
        automation_revision_id: input.definition.id,
        fire_id: input.fire.id,
        available_at: input.availableAt,
      },
    })
    .run()
  const frontier = currentAutomationFireFrontierInTransaction(db, input.definition.definition_id)
  if (
    !frontier ||
    frontier.automation_revision_id !== input.definition.id ||
    frontier.fire_id !== input.fire.id ||
    frontier.available_at !== input.availableAt
  ) {
    throw new Error(`Automation ${input.definition.definition_id} Fire frontier changed during publication`)
  }
  return frontier
}

export function deferAutomationFireFrontierInTransaction(
  db: Database.TxOrDb,
  input: { definitionID: string; fireID: string; availableAt: number },
): void {
  assertAvailableAt(input.availableAt)
  const current = currentAutomationFireFrontierInTransaction(db, input.definitionID)
  if (!current || current.fire_id !== input.fireID) {
    throw new Error(`Automation ${input.definitionID} lost Fire frontier ${input.fireID}`)
  }
  db.update(AutomationFireFrontierTable)
    .set({ available_at: input.availableAt })
    .where(
      and(
        eq(AutomationFireFrontierTable.definition_id, input.definitionID),
        eq(AutomationFireFrontierTable.fire_id, input.fireID),
      ),
    )
    .run()
}

export function clearAutomationFireFrontierInTransaction(
  db: Database.TxOrDb,
  definitionID: string,
): void {
  db.delete(AutomationFireFrontierTable)
    .where(eq(AutomationFireFrontierTable.definition_id, definitionID))
    .run()
}

export function ensureScheduledAutomationFireFrontierInTransaction(
  db: Database.TxOrDb,
  definition: typeof AutomationTable.$inferSelect,
  scheduledDueAt: number,
  now: number,
): typeof AutomationFireTable.$inferSelect {
  if (definition.status !== "active") {
    throw new Error(`Automation revision ${definition.id} cannot own a scheduled Fire frontier`)
  }
  if (definition.kind === "delay" && definition.due_at !== scheduledDueAt) {
    throw new Error(`Automation delay revision ${definition.id} changed its immutable due time`)
  }
  const fireID = scheduledAutomationFireID(definition.id, scheduledDueAt)
  db.insert(AutomationFireTable)
    .values({
      id: fireID,
      automation_revision_id: definition.id,
      scheduled_due_at: scheduledDueAt,
      origin: "scheduled",
      time_created: now,
    })
    .onConflictDoNothing()
    .run()
  const fire = db.select().from(AutomationFireTable).where(eq(AutomationFireTable.id, fireID)).get()
  if (
    !fire ||
    fire.automation_revision_id !== definition.id ||
    fire.scheduled_due_at !== scheduledDueAt ||
    fire.origin !== "scheduled"
  ) {
    throw new Error(`Automation scheduled Fire ${fireID} changed its immutable occurrence`)
  }
  publishAutomationFireFrontierInTransaction(db, { definition, fire, availableAt: scheduledDueAt })
  return fire
}

export function restoreScheduledAutomationFireFrontierInTransaction(
  db: Database.TxOrDb,
  definition: typeof AutomationTable.$inferSelect,
): typeof AutomationFireTable.$inferSelect {
  if (definition.kind !== "recurring" || definition.status !== "active") {
    throw new Error(`Automation revision ${definition.id} cannot restore a scheduled Fire frontier`)
  }
  const fire = db
    .select()
    .from(AutomationFireTable)
    .where(
      and(
        eq(AutomationFireTable.automation_revision_id, definition.id),
        eq(AutomationFireTable.origin, "scheduled"),
        sql`NOT EXISTS (
          SELECT 1 FROM automation_fire_attempt AS attempt
          WHERE attempt.fire_id=${AutomationFireTable.id}
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM automation_run AS run
          WHERE run.fire_id=${AutomationFireTable.id}
        )`,
      ),
    )
    .orderBy(
      desc(AutomationFireTable.scheduled_due_at),
      desc(AutomationFireTable.time_created),
      desc(AutomationFireTable.id),
    )
    .limit(1)
    .get()
  if (!fire) throw new Error(`Automation revision ${definition.id} has no pristine scheduled Fire`)
  publishAutomationFireFrontierInTransaction(db, {
    definition,
    fire,
    availableAt: fire.scheduled_due_at,
  })
  return fire
}
