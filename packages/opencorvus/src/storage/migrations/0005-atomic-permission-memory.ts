import type { Database as SQLite } from "bun:sqlite"
import { SchemaMigrationError } from "../schema-migration"
import { queryAllFinalized } from "../sqlite-statement"

/** Old callbacks committed their effect before their receipt. A historical
 * attempt without success cannot prove whether its consumed inbox ever existed.
 * The exclusive version migration is the boundary before atomic callbacks run. */
export function validateHistoricalPermissionMemoryDeliveries(sqlite: SQLite) {
  const unresolved = queryAllFinalized<{ occurrence_id: string; request_id: string }>(sqlite, `
    SELECT publication.occurrence_id, requested.request_id
    FROM bus_publication_outbox AS publication
    JOIN permission_ledger AS requested
      ON requested.request_id = json_extract(publication.properties, '$.requestID')
      AND requested.event_type = 'requested'
      AND requested.task_id IS NOT NULL
    WHERE publication.event_type = 'permission.replied'
      AND json_type(publication.properties, '$.userInput') = 'object'
      AND NOT EXISTS (
        SELECT 1 FROM bus_publication_delivery_receipt AS receipt
        WHERE receipt.occurrence_id = publication.occurrence_id
          AND receipt.phase = 'exact'
          AND receipt.subscriber_id = 'engine.interaction.permission-replied'
          AND receipt.outcome = 'succeeded'
      )
      AND (
        EXISTS (
          SELECT 1 FROM engine_control_activation_lease AS lease
          WHERE lease.target = 'bus_delivery'
            AND lease.target_id = publication.occurrence_id || char(0) || 'exact' || char(0) || 'engine.interaction.permission-replied'
        )
        OR EXISTS (
          SELECT 1 FROM bus_publication_delivery_receipt AS receipt
          WHERE receipt.occurrence_id = publication.occurrence_id
            AND receipt.phase = 'exact'
            AND receipt.subscriber_id = 'engine.interaction.permission-replied'
        )
        OR EXISTS (
          SELECT 1 FROM bus_publication_phase_receipt AS phase
          WHERE phase.occurrence_id = publication.occurrence_id AND phase.phase = 'exact'
        )
      )
    ORDER BY publication.occurrence_id
  `)
  if (unresolved.length) {
    throw new SchemaMigrationError("SCHEMA_MIGRATION_REQUIRED",
      `Permission memory delivery requires original effect evidence before upgrading: ${JSON.stringify(unresolved)}. ` +
      "Historical attempts without a successful subscriber receipt cannot distinguish an uncaptured input from an already consumed one. The database and backup are retained; do not reset or replay these inputs speculatively.")
  }
}
