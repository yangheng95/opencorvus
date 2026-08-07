import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * Durable identity of one logical SQLite database instance.
 * The row survives an exact-current-schema reopen, while an explicitly
 * authorized database reset or fresh rebuild creates a new instance identity.
 */
export const DatabaseAuthorityTable = sqliteTable("database_authority", {
  key: text().primaryKey(),
  instance_id: text().notNull().unique(),
  time_created: integer().notNull(),
})
