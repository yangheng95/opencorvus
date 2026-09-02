import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

/**
 * Current physical admission slots for one non-secret resource generation.
 * This table owns no job, retry, ordering, or completion state. A lease may
 * be replaced only after expiry and is released when the physical stream
 * settles; expiry is the sole crash-recovery authority.
 */
export const RuntimeExecutionCapacityLeaseTable = sqliteTable(
  "runtime_execution_capacity_lease",
  {
    resource_key: text().notNull(),
    slot: integer().notNull(),
    lease_id: text().notNull(),
    owner_id: text().notNull(),
    time_acquired: integer().notNull(),
    expires_at: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.resource_key, table.slot] }),
    index("runtime_execution_capacity_expiry_idx").on(table.expires_at),
    check(
      "runtime_execution_capacity_resource_digest",
      sql`length(${table.resource_key}) = 64 AND ${table.resource_key} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check("runtime_execution_capacity_slot_range", sql`${table.slot} BETWEEN 0 AND 63`),
    check("runtime_execution_capacity_lease_id_nonempty", sql`length(${table.lease_id}) > 0`),
    check("runtime_execution_capacity_owner_id_nonempty", sql`length(${table.owner_id}) > 0`),
    check("runtime_execution_capacity_time_nonnegative", sql`${table.time_acquired} >= 0`),
    check("runtime_execution_capacity_expiry_order", sql`${table.expires_at} >= ${table.time_acquired}`),
  ],
)
