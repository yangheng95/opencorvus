import type { Database as SQLite } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Identifier } from "@/id/id"
import { planHistoricalGrantDecisionIndexes, validateCurrentPermissionLedger } from "@/permission/ledger-facts"
import { PermissionLedgerTable } from "@/permission/permission.sql"
import { ApplicationSchema } from "../schema"

/** Index immutable historical captures without reissuing their authorizations. */
export function indexHistoricalGrantDecisions(sqlite: SQLite): void {
  const db = drizzle({ client: sqlite, schema: ApplicationSchema })
  const indexes = planHistoricalGrantDecisionIndexes(db)
  for (const entry of indexes) {
    db.insert(PermissionLedgerTable).values({
      id: Identifier.ascending("permission"), request_id: entry.requestID,
      event_type: "grant_decision_indexed", decision_slot: entry.requestID, source_event_id: entry.sourceEventID,
      actor_id: "schema-migration", metadata: { migrationVersion: 2 }, time_created: Date.now(),
    }).run()
  }
  validateCurrentPermissionLedger(db)
}
