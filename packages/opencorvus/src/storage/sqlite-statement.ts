import type { Database as BunDatabase } from "bun:sqlite"

/**
 * Execute one read-only SQL (Structured Query Language) statement and release
 * its SQLite statement owner before the caller advances a lifecycle boundary.
 */
export function queryAllFinalized<TResult>(sqlite: BunDatabase, sql: string): TResult[] {
  const statement = sqlite.query<TResult, []>(sql)
  let rows: TResult[] | undefined
  let operationFailure: unknown
  let operationFailed = false
  try {
    rows = statement.all()
  } catch (error) {
    operationFailure = error
    operationFailed = true
  }
  try {
    statement.finalize()
  } catch (finalizeFailure) {
    if (operationFailed) {
      throw new AggregateError(
        [operationFailure, finalizeFailure],
        "SQLite query and statement finalization both failed",
        { cause: operationFailure },
      )
    }
    throw finalizeFailure
  }
  if (operationFailed) throw operationFailure
  return rows as TResult[]
}
