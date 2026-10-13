import baseline from "./0001-baseline.sql" with { type: "text" }
import type { SchemaMigration } from "../schema-migration"

/** Published entries are immutable. Append a revision for every schema or stored-data change. */
export const DATABASE_MIGRATIONS: readonly SchemaMigration[] = [
  { version: 1, name: "Current SQLite baseline", ddl: baseline },
]
