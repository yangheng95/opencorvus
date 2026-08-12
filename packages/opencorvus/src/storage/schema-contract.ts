import { Database as BunDatabase } from "bun:sqlite"
import { createHash } from "node:crypto"
import { SCHEMA_DDL } from "./ddl"

type SchemaObjectShape = Map<string, string>

function queryAllFinalized<TResult>(sqlite: BunDatabase, sql: string): TResult[] {
  const statement = sqlite.query<TResult, []>(sql)
  let rows: TResult[] | undefined
  let operationFailure: unknown
  try {
    rows = statement.all()
  } catch (error) {
    operationFailure = error
  }
  try {
    statement.finalize()
  } catch (finalizeFailure) {
    if (operationFailure !== undefined) {
      throw new AggregateError([operationFailure, finalizeFailure], "SQLite schema query and finalization both failed", {
        cause: operationFailure,
      })
    }
    throw finalizeFailure
  }
  if (operationFailure !== undefined) throw operationFailure
  return rows as TResult[]
}

export function readSchemaObjectShape(sqlite: BunDatabase): SchemaObjectShape {
  return new Map(
    queryAllFinalized<{ type: string; name: string; table_name: string; sql: string | null }>(
      sqlite,
      `SELECT type, name, tbl_name AS table_name, sql
       FROM sqlite_schema
       WHERE name NOT LIKE 'sqlite_%'
       ORDER BY type, name`,
    ).map((row) => [
      `${row.type}:${row.name}`,
      `${row.table_name}:${row.sql === null ? "<implicit>" : row.sql.trim()}`,
    ]),
  )
}

export function schemaObjectFingerprint(sqlite: BunDatabase): string {
  return createHash("sha256").update(JSON.stringify([...readSchemaObjectShape(sqlite)])).digest("hex")
}

function expectedSchemaObjectShape(): SchemaObjectShape {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    return readSchemaObjectShape(sqlite)
  } finally {
    sqlite.close(true)
  }
}

export function currentSchemaFingerprint(): string {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    return schemaObjectFingerprint(sqlite)
  } finally {
    sqlite.close(true)
  }
}

export function findSchemaDrift(sqlite: BunDatabase): string | undefined {
  const expected = expectedSchemaObjectShape()
  const actual = readSchemaObjectShape(sqlite)
  for (const objectKey of actual.keys()) {
    if (!expected.has(objectKey)) return `unexpected schema object ${objectKey}`
  }
  for (const [objectKey, expectedSql] of expected) {
    const actualSql = actual.get(objectKey)
    if (actualSql === undefined) return `missing schema object ${objectKey}`
    if (actualSql !== expectedSql) return `schema object ${objectKey} differs from current DDL`
  }
}

export function hasApplicationSchema(sqlite: BunDatabase): boolean {
  return readSchemaObjectShape(sqlite).size > 0
}
