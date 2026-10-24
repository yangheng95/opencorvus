import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

/** Installation effects outlive their originating Task. The Task Artifact is
 * a report projection, not the lifetime owner of this immutable commit fact. */
export const ExpertSquadMutationReceiptTable = sqliteTable(
  "expert_squad_mutation_receipt",
  {
    artifact_id: text().primaryKey(),
    task_id: text().notNull(),
    envelope: text({ mode: "json" }).notNull().$type<Record<string, unknown>>(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("expert_squad_mutation_receipt_task_idx").on(table.task_id, table.artifact_id),
    check(
      "expert_squad_mutation_receipt_identity",
      sql`coalesce((
      json_type(${table.envelope}) = 'object'
      AND json_extract(${table.envelope}, '$.artifact_type') = 'evolution-lab/promotion-receipt'
      AND json_extract(${table.envelope}, '$.schema_version') = 1
      AND json_extract(${table.envelope}, '$.producer.owner_kind') = 'core'
      AND json_extract(${table.envelope}, '$.producer.component_id') = 'expert-squad-package-manager'
      AND json_type(${table.envelope}, '$.import_lineage') IS NULL
      AND json_extract(${table.envelope}, '$.payload.authorization.task_id') = ${table.task_id}
      AND json_extract(${table.envelope}, '$.producer.operation_id') = json_extract(${table.envelope}, '$.payload.authorization.message_id')
    ), 0)`,
    ),
  ],
)
