import { SCHEMA_DDL } from "../../src/storage/ddl"
import { DATABASE_MIGRATIONS } from "../../src/storage/migrations"
import { validateMigrationRegistry } from "../../src/storage/schema-migration"

export function checkDatabaseMigrations() {
  const version = validateMigrationRegistry(DATABASE_MIGRATIONS, SCHEMA_DDL)
  console.log(`database-migrations check ok — target version ${version}, in-memory SQLite objects match the declared migration target`)
}

if (import.meta.main) checkDatabaseMigrations()
