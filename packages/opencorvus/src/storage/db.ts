import { Database as BunDatabase } from "bun:sqlite"
import { eq, sql } from "drizzle-orm"
import { drizzle, type SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import { type SQLiteTransaction } from "drizzle-orm/sqlite-core"
export * from "drizzle-orm"
import { Context } from "../util/context"
import { lazy } from "../util/lazy"
import { Global } from "../global"
import { Log } from "../util/log"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import path from "path"
import * as fsSync from "fs"
import * as fsPromises from "fs/promises"
import { randomUUID } from "crypto"
import * as schema from "./schema"
import { SCHEMA_DDL } from "./ddl"
import {
  SchemaMigrationError,
  createSchemaMigrationBackup,
  findSchemaDrift,
  hasApplicationSchema,
  migrateDatabaseFile,
  planSchemaMigration,
  schemaObjectFingerprint,
} from "./schema-migration"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import {
  TASK_CANCELLED_EVENT_TYPE,
  projectTaskCancellationEventChain,
  type TaskCancellationProtocolEvent,
} from "@/engine/cancellation-origin"

export const NotFoundError = NamedError.create(
  "NotFoundError",
  z.object({
    message: z.string(),
  }),
)

export type DatabaseUnavailableErrorData = {
  message: string
  path: string
  operation: string
  code: string
  errno?: number
  byteOffset?: number
}

export const DatabaseUnavailableError = NamedError.create(
  "DatabaseUnavailableError",
  z.object({
    message: z.string(),
    path: z.string(),
    operation: z.string(),
    code: z.string(),
    errno: z.number().optional(),
    byteOffset: z.number().optional(),
  }),
)

export const DatabaseResetTargetRemovalError = NamedError.create(
  "DatabaseResetTargetRemovalError",
  z.object({
    message: z.string(),
    target: z.object({
      label: z.string(),
      path: z.string(),
    }),
    completed: z.array(
      z.object({
        label: z.string(),
        path: z.string(),
      }),
    ),
  }),
)

export class DatabaseEffectAdmissionClosedError extends Error {
  override readonly name = "DatabaseEffectAdmissionClosedError"

  constructor(public readonly operation: string) {
    super(`${operation} rejected because database effect admission is closed during runtime settlement`)
  }
}

const log = Log.create({ service: "db" })

const SQLITE_UNAVAILABLE_CODE_PREFIXES = ["SQLITE_IOERR", "SQLITE_CANTOPEN", "SQLITE_CORRUPT", "SQLITE_READONLY"]
const SQLITE_UNAVAILABLE_CODES = new Set(["SQLITE_NOTADB", "SQLITE_FULL"])

function objectField(input: unknown, key: string): unknown {
  if (!input || typeof input !== "object") return undefined
  return (input as Record<string, unknown>)[key]
}

function stringField(input: unknown, key: string): string | undefined {
  const value = objectField(input, key)
  return typeof value === "string" ? value : undefined
}

function numberField(input: unknown, key: string): number | undefined {
  const value = objectField(input, key)
  return typeof value === "number" ? value : undefined
}

function errorGraph(input: unknown): unknown[] {
  const pending = [input]
  const visited = new Set<unknown>()
  const result: unknown[] = []
  while (pending.length > 0) {
    const current = pending.shift()
    if (current === undefined || current === null || visited.has(current)) continue
    if (typeof current === "object" || typeof current === "function") visited.add(current)
    result.push(current)

    const cause = objectField(current, "cause")
    if (cause !== undefined && cause !== current) pending.push(cause)
    if (current instanceof AggregateError) pending.push(...current.errors)
  }
  return result
}

function isSqliteUnavailableCode(code: string): boolean {
  if (SQLITE_UNAVAILABLE_CODES.has(code)) return true
  return SQLITE_UNAVAILABLE_CODE_PREFIXES.some((prefix) => code === prefix || code.startsWith(`${prefix}_`))
}

function sqliteUnavailableSource(error: unknown): { error: unknown; code: string } | undefined {
  for (const candidate of errorGraph(error)) {
    const code = stringField(candidate, "code")
    if (code && isSqliteUnavailableCode(code)) return { error: candidate, code }
  }
}

function unavailableDataFromSqlite(
  error: unknown,
  operation: string,
  dbPath: string,
): DatabaseUnavailableErrorData | undefined {
  const source = sqliteUnavailableSource(error)
  if (!source) return undefined
  const sourceMessage = source.error instanceof Error ? source.error.message : String(source.error)
  const data: DatabaseUnavailableErrorData = {
    path: dbPath,
    operation,
    code: source.code,
    message: `OpenCorvus database is unavailable at ${dbPath} during ${operation}: ${sourceMessage}`,
  }
  const errno = numberField(source.error, "errno")
  if (errno !== undefined) data.errno = errno
  const byteOffset = numberField(source.error, "byteOffset")
  if (byteOffset !== undefined) data.byteOffset = byteOffset
  return data
}

function quoteIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`
}

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

type PersistedCancellationEventRow = {
  id: string
  kind: string
  type: string
  aggregate_type: string
  aggregate_id: string
  task_id: string | null
  session_id: string | null
  source: string
  causation_id: string | null
  correlation_id: string | null
  seq: number
  emitted_at: number
  payload: string | Record<string, unknown> | null
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function protocolPayload(value: PersistedCancellationEventRow["payload"]): Record<string, unknown> | undefined {
  if (value === null) return undefined
  const parsed = typeof value === "string" ? JSON.parse(value) : value
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Cancellation protocol event payload must be a JSON object.")
  }
  return parsed as Record<string, unknown>
}

function cancellationEventView(
  row: PersistedCancellationEventRow | undefined,
): TaskCancellationProtocolEvent | undefined {
  if (!row) return undefined
  return {
    id: row.id,
    kind: row.kind,
    type: row.type,
    aggregate: row.aggregate_type,
    aggregateID: row.aggregate_id,
    taskID: row.task_id ?? undefined,
    sessionID: row.session_id ?? undefined,
    source: row.source,
    causationID: row.causation_id ?? undefined,
    correlationID: row.correlation_id ?? undefined,
    sequence: row.seq,
    payload: protocolPayload(row.payload),
    time: {
      emitted: row.emitted_at,
    },
  }
}

/**
 * Current Data Definition Language shape alone cannot prove that historical
 * cancellation facts satisfy the canonical causal contract. Validate the
 * exact same pure event-chain projection used by normal Task reads before the
 * database becomes available to any route.
 */
function assertCurrentDataIntegrity(sqlite: BunDatabase, dbPath: string): void {
  const tasks = queryAllFinalized<{ id: string }>(
    sqlite,
    `SELECT id
     FROM engine_task
     WHERE metadata IS NOT NULL
       AND json_valid(metadata) = 1
       AND json_type(metadata, '$.cancelled') = 'true'
     ORDER BY id`,
  )

  for (const task of tasks) {
    const taskID = task.id
    const terminal = queryAllFinalized<PersistedCancellationEventRow>(
      sqlite,
      `SELECT * FROM protocol_event
       WHERE type = ${quoteLiteral(TASK_CANCELLED_EVENT_TYPE)}
         AND (aggregate_id = ${quoteLiteral(taskID)} OR task_id = ${quoteLiteral(taskID)})
       ORDER BY seq DESC, emitted_at DESC, id DESC
       LIMIT 1`,
    )[0]
    const requested = terminal?.causation_id
      ? queryAllFinalized<PersistedCancellationEventRow>(
          sqlite,
          `SELECT * FROM protocol_event WHERE id = ${quoteLiteral(terminal.causation_id)} LIMIT 1`,
        )[0]
      : undefined

    try {
      projectTaskCancellationEventChain(taskID, cancellationEventView(terminal), cancellationEventView(requested))
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new DatabaseUnavailableError({
        message:
          `OpenCorvus database contains a cancelled Task with incomplete causal protocol facts: ${taskID}. ` +
          `Reset the database explicitly; OpenCorvus will not infer or fabricate cancellation provenance. ${reason}`,
        path: dbPath,
        operation: "Database.Client.dataIntegrity",
        code: "DATA_INTEGRITY_RESET_REQUIRED",
      })
    }
  }
}

function configureSqlite(sqlite: BunDatabase) {
  // auto_vacuum must be set before any table is created. An existing database
  // with a different physical setting remains usable only when its schema
  // exactly matches the current DDL; adopting a new physical format requires
  // a separately authorized reset.
  sqlite.run("PRAGMA encoding = 'UTF-8'")
  const encoding = queryAllFinalized<{ encoding: string }>(sqlite, "PRAGMA encoding")[0]?.encoding
  if (encoding !== "UTF-8") {
    throw new Error(
      `OpenCorvus database encoding is ${encoding ?? "unknown"}; reset the database because Artifact byte locators require UTF-8`,
    )
  }
  sqlite.run("PRAGMA auto_vacuum = INCREMENTAL")
  sqlite.run("PRAGMA journal_mode = WAL")
  sqlite.run("PRAGMA synchronous = NORMAL")
  sqlite.run("PRAGMA busy_timeout = 5000")
  sqlite.run("PRAGMA cache_size = -64000")
  sqlite.run("PRAGMA foreign_keys = ON")
  // Cap WAL file size on disk — anything above the limit is truncated at
  // the next checkpoint instead of staying resident.
  sqlite.run("PRAGMA journal_size_limit = 67108864")
  sqlite.run("PRAGMA wal_checkpoint(PASSIVE)")
}

function dropCurrentSchema(sqlite: BunDatabase) {
  const triggers = queryAllFinalized<{ name: string }>(
    sqlite,
    "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND name NOT LIKE 'sqlite_%'",
  )
  for (const trigger of triggers) {
    sqlite.run(`DROP TRIGGER IF EXISTS ${quoteIdentifier(trigger.name)}`)
  }

  const tables = queryAllFinalized<{ name: string }>(
    sqlite,
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY CASE WHEN name = 'memory_fts' THEN 0 ELSE 1 END, name",
  )
  for (const table of tables) {
    sqlite.run(`DROP TABLE IF EXISTS ${quoteIdentifier(table.name)}`)
  }
}

function createCurrentSchema(sqlite: BunDatabase, dbPath: string): BunDatabase {
  let transactionActive = false
  try {
    sqlite.run("BEGIN IMMEDIATE")
    transactionActive = true
    sqlite.exec(SCHEMA_DDL)
    const drift = findSchemaDrift(sqlite)
    if (drift) {
      throw new Error(`OpenCorvus database schema does not match current DDL at ${dbPath}: ${drift}`)
    }
    sqlite.run("COMMIT")
    transactionActive = false
  } catch (err) {
    if (transactionActive) sqlite.run("ROLLBACK")
    const reason = err instanceof Error ? err.message : String(err)
    log.error("database schema apply failed", {
      path: dbPath,
      error: reason,
    })
    throw err
  }
  return sqlite
}

export namespace Database {
  const RESET_EFFECT_INACTIVITY_TIMEOUT_MS = 60_000

  // SQLite state is process-wide and single-source: `<Global.Path.data>/opencorvus.db`.
  // Project-scoped routing (`Instance.directory`) selects which project rows
  // a request operates on; it does NOT select a different SQLite file.
  //
  // Path() stays a function — not a const — so OPENCORVUS_HOME resolves
  // lazily on first DB open, after benchmarks / portable launchers have set
  // their env.
  export function Path() {
    return path.join(Global.Path.data, "opencorvus.db")
  }
  type Schema = typeof schema
  export type Transaction = SQLiteTransaction<"sync", void, Schema>

  type Client = SQLiteBunDatabase<Schema>

  const state = {
    sqlite: undefined as BunDatabase | undefined,
    unavailable: undefined as DatabaseUnavailableErrorData | undefined,
    rollbackRequired: false,
  }

  type EffectOwner = { closed: boolean }
  type LifecycleOwner<T = unknown> = {
    key: string
    label: string
    acceptedEffects: Set<EffectOwner>
    promise: Promise<T>
  }

  const effectOwnerContext = Context.create<EffectOwner>("database-effect-owner")
  const activeEffects = new Map<EffectOwner, Promise<void>>()
  let lifecycleOwner: LifecycleOwner | undefined
  let effectSettlementGate: symbol | undefined
  let effectSettlementAcquiring = false

  function assertEffectAdmission(operation: string): void {
    if (effectSettlementGate) throw new DatabaseEffectAdmissionClosedError(operation)
  }

  function lifecycleConflict(operation: string, owner: LifecycleOwner) {
    return new Error(`${operation} rejected because Database.${owner.label} owns the database lifecycle`)
  }

  function inheritedOwnerFailure(operation: string): Error | undefined {
    const effectOwner = effectOwnerContext.tryUse()
    if (effectOwner?.closed) {
      return new Error(`${operation} rejected because its inherited database effect owner is closed`)
    }
    const databaseOwner = ctx.tryUse()
    if (databaseOwner?.closed) {
      return new Error(`${operation} rejected because its inherited database context owner is closed`)
    }
  }

  function assertInheritedOwnersOpen(operation: string) {
    const failure = inheritedOwnerFailure(operation)
    if (failure) throw failure
  }

  function assertLifecycleUnowned(operation: string) {
    assertInheritedOwnersOpen(operation)
    if (lifecycleOwner) throw lifecycleConflict(operation, lifecycleOwner)
  }

  function assertDatabaseAccess(operation: string) {
    assertInheritedOwnersOpen(operation)
    if (effectSettlementGate) {
      const acceptedEffectOwner = effectOwnerContext.tryUse()
      if (!acceptedEffectOwner || acceptedEffectOwner.closed || !activeEffects.has(acceptedEffectOwner)) {
        throw new DatabaseEffectAdmissionClosedError(operation)
      }
    }
    const owner = lifecycleOwner
    if (!owner) return
    const effectOwner = effectOwnerContext.tryUse()
    if (effectOwner && !effectOwner.closed && owner.acceptedEffects.has(effectOwner)) return
    throw lifecycleConflict(operation, owner)
  }

  function runSharedLifecycle<T>(key: string, label: string, operation: () => Promise<T>): Promise<T> {
    const operationLabel = `Database.${label}`
    const inheritedFailure = inheritedOwnerFailure(operationLabel)
    if (inheritedFailure) return Promise.reject(inheritedFailure)
    const effectOwner = effectOwnerContext.tryUse()
    const databaseOwner = ctx.tryUse()
    if (databaseOwner && !databaseOwner.closed) {
      return Promise.reject(new Error(`${operationLabel} rejected lifecycle entry from an active database context`))
    }

    const current = lifecycleOwner
    if (current) {
      if (current.key === key) {
        const effectOwner = effectOwnerContext.tryUse()
        if (effectOwner && !effectOwner.closed && current.acceptedEffects.has(effectOwner)) {
          return Promise.reject(
            new Error(`Database.${label} rejected recursive lifecycle entry from an accepted post-commit effect`),
          )
        }
        return current.promise as Promise<T>
      }
      return Promise.reject(lifecycleConflict(`Database.${label}`, current))
    }
    if (effectOwner && activeEffects.has(effectOwner)) {
      return Promise.reject(new Error(`${operationLabel} rejected lifecycle entry from an active post-commit effect`))
    }

    const owner: LifecycleOwner<T> = {
      key,
      label,
      acceptedEffects: new Set(activeEffects.keys()),
      promise: undefined as unknown as Promise<T>,
    }
    lifecycleOwner = owner
    owner.promise = operation()
    const clearOwner = () => {
      if (lifecycleOwner === owner) lifecycleOwner = undefined
    }
    void owner.promise.then(clearOwner, clearOwner)
    return owner.promise
  }

  function runSynchronousLifecycle<T>(label: string, operation: () => T): T {
    assertLifecycleUnowned(`Database.${label}`)
    const databaseOwner = ctx.tryUse()
    if (databaseOwner && !databaseOwner.closed) {
      throw new Error(`Database.${label} rejected lifecycle entry from an active database context`)
    }
    if (activeEffects.size > 0) {
      throw new Error(`Database.${label} rejected because ${activeEffects.size} post-commit effect(s) are active`)
    }
    const owner: LifecycleOwner<T> = {
      key: `${label}:sync`,
      label,
      acceptedEffects: new Set(),
      promise: Promise.resolve(undefined as T),
    }
    lifecycleOwner = owner
    try {
      return operation()
    } finally {
      if (lifecycleOwner === owner) lifecycleOwner = undefined
    }
  }

  function unavailableError() {
    return state.unavailable ? new DatabaseUnavailableError(state.unavailable) : undefined
  }

  function releaseOwnedSqlite(input: { clearUnavailable: boolean; checkpoint: boolean }) {
    const sqlite = state.sqlite
    if (!sqlite) {
      state.rollbackRequired = false
      if (input.clearUnavailable) state.unavailable = undefined
      client.reset()
      return
    }

    if (state.rollbackRequired) {
      sqlite.run("ROLLBACK")
      state.rollbackRequired = false
    }
    if (input.checkpoint && state.unavailable === undefined) sqlite.run("PRAGMA wal_checkpoint(TRUNCATE)")
    sqlite.close(true)

    state.sqlite = undefined
    state.rollbackRequired = false
    if (input.clearUnavailable) state.unavailable = undefined
    client.reset()
  }

  function openOwnedSqlite(dbPath: string, options: { configure: boolean } = { configure: true }) {
    const sqlite = new BunDatabase(dbPath, { create: true })
    state.sqlite = sqlite
    state.rollbackRequired = false
    if (options.configure) configureSqlite(sqlite)
    return sqlite
  }

  function schemaMigrationRequired(dbPath: string, reason: string, fingerprint: string) {
    return new DatabaseUnavailableError({
      message:
        `OpenCorvus database schema does not match the current DDL at ${dbPath}: ${reason}. ` +
        `No registered migration starts from schema fingerprint ${fingerprint}. ` +
        "The database was not modified; add and verify the exact migration before using this version.",
      path: dbPath,
      operation: "Database.Client.schemaValidation",
      code: "SCHEMA_MIGRATION_REQUIRED",
    })
  }

  function schemaMigrationUnavailable(dbPath: string, error: SchemaMigrationError) {
    return new DatabaseUnavailableError(
      {
        message: error.message,
        path: dbPath,
        operation: "Database.Client.schemaMigration",
        code: error.code,
      },
      { cause: error },
    )
  }

  function recordUnavailable(error: unknown, operation: string) {
    for (const candidate of errorGraph(error)) {
      if (!DatabaseUnavailableError.isInstance(candidate)) continue
      if (!state.unavailable) state.unavailable = candidate.data
      client.reset()
      return new DatabaseUnavailableError(state.unavailable, { cause: error })
    }
    const data = unavailableDataFromSqlite(error, operation, Path())
    if (!data) return undefined
    if (!state.unavailable) state.unavailable = data
    client.reset()
    return new DatabaseUnavailableError(state.unavailable, error instanceof Error ? { cause: error } : undefined)
  }

  function throwOwnedInitializationFailure(error: unknown, operation: string): never {
    const normalized = recordUnavailable(error, operation) ?? error
    try {
      releaseOwnedSqlite({ clearUnavailable: false, checkpoint: false })
    } catch (closeError) {
      const cleanupFailure = recordUnavailable(closeError, `${operation}.cleanup`) ?? closeError
      throw new AggregateError(
        [normalized, cleanupFailure],
        `${operation} initialization and SQLite close both failed`,
        {
          cause: normalized,
        },
      )
    }
    throw normalized
  }

  export function normalizeError(error: unknown, operation: string): unknown {
    const unavailable = recordUnavailable(error, operation)
    if (!unavailable) return error
    try {
      releaseOwnedSqlite({ clearUnavailable: false, checkpoint: false })
      return unavailable
    } catch (closeError) {
      const cleanupFailure = recordUnavailable(closeError, `${operation}.cleanup`) ?? closeError
      return new AggregateError(
        [unavailable, cleanupFailure],
        `OpenCorvus database became unavailable during ${operation} and its SQLite connection could not be closed`,
        { cause: unavailable },
      )
    }
  }

  export function isUnavailableError(error: unknown): boolean {
    return errorGraph(error).some(
      (candidate) => DatabaseUnavailableError.isInstance(candidate) || sqliteUnavailableSource(candidate) !== undefined,
    )
  }

  export function unavailable() {
    return state.unavailable ? { ...state.unavailable } : undefined
  }

  function throwIfUnavailable(): void {
    const error = unavailableError()
    if (error) throw error
  }

  function throwNormalized(error: unknown, operation: string): never {
    throw normalizeError(error, operation)
  }

  const client = lazy(() => {
    throwIfUnavailable()
    if (state.sqlite) {
      throw new Error("Database.Client cannot replace the SQLite connection retained after an incomplete close")
    }
    const dbPath = Path()
    log.info("opening database", { path: dbPath })
    // Ensure data dir exists — benchmarks create OPENCORVUS_HOME at runtime,
    // so the data subdirectory may not have been created by global/index.ts
    // module-load ensureDirectory calls.
    fsSync.mkdirSync(path.dirname(dbPath), { recursive: true })

    try {
      let sqlite = openOwnedSqlite(dbPath, { configure: false })
      if (hasApplicationSchema(sqlite)) {
        const drift = findSchemaDrift(sqlite)
        if (drift) {
          const fingerprint = schemaObjectFingerprint(sqlite)
          const plan = planSchemaMigration(sqlite)
          if (!plan || plan.migrations.length === 0) {
            throw schemaMigrationRequired(dbPath, drift, fingerprint)
          }
          let backup
          try {
            backup = createSchemaMigrationBackup(dbPath, plan)
          } catch (error) {
            if (error instanceof SchemaMigrationError) throw schemaMigrationUnavailable(dbPath, error)
            throw error
          }
          sqlite.close(true)
          state.sqlite = undefined
          state.rollbackRequired = false
          let result
          try {
            result = migrateDatabaseFile(dbPath, plan, backup)
          } catch (error) {
            if (error instanceof SchemaMigrationError) throw schemaMigrationUnavailable(dbPath, error)
            throw error
          }
          log.info("database schema migrated", {
            path: dbPath,
            fromFingerprint: result.fromFingerprint,
            toFingerprint: result.toFingerprint,
            migrations: result.migrationIDs,
            backupDirectory: result.backupDirectory,
          })
          sqlite = openOwnedSqlite(dbPath, { configure: false })
          const migratedDrift = findSchemaDrift(sqlite)
          if (migratedDrift) {
            throw schemaMigrationRequired(dbPath, migratedDrift, schemaObjectFingerprint(sqlite))
          }
        }
        configureSqlite(sqlite)
        assertCurrentDataIntegrity(sqlite, dbPath)
      } else {
        configureSqlite(sqlite)
        createCurrentSchema(sqlite, dbPath)
      }
      log.info("schema applied")

      const db = drizzle({ client: sqlite, schema })

      return db
    } catch (error) {
      throwOwnedInitializationFailure(error, "Database.Client")
    }
  })

  export function Client() {
    assertDatabaseAccess("Database.Client")
    return client()
  }

  /**
   * Return the durable identity of this logical database instance.
   * The singleton row is created transactionally on first use. Reopening the
   * same database preserves it; resetting or rebuilding the database creates
   * a different identity even when Database.Path() is unchanged.
   */
  export function Identity(): string {
    assertDatabaseAccess("Database.Identity")
    return Client().transaction((db) => {
      db.insert(schema.DatabaseAuthorityTable)
        .values({
          key: "primary",
          instance_id: randomUUID(),
          time_created: Date.now(),
        })
        .onConflictDoNothing({ target: schema.DatabaseAuthorityTable.key })
        .run()
      const row = db
        .select({ instanceID: schema.DatabaseAuthorityTable.instance_id })
        .from(schema.DatabaseAuthorityTable)
        .where(eq(schema.DatabaseAuthorityTable.key, "primary"))
        .get()
      if (!row?.instanceID) throw new Error("Database authority identity was not persisted")
      return row.instanceID
    })
  }

  export function close() {
    return runSynchronousLifecycle("close", () => {
      try {
        releaseOwnedSqlite({ clearUnavailable: true, checkpoint: true })
      } catch (error) {
        throw recordUnavailable(error, "Database.close") ?? error
      }
    })
  }

  export function hasOpenConnection() {
    return !!state.sqlite
  }

  export type ResetTarget = { label: string; path: string; ok: true }
  type ResetTargetInput = { label: string; path: string }

  function databaseFileTargets(databasePath = Path()): ResetTargetInput[] {
    const dbPath = databasePath
    return [
      { label: "db", path: dbPath },
      { label: "db-wal", path: `${dbPath}-wal` },
      { label: "db-shm", path: `${dbPath}-shm` },
    ]
  }

  async function removeTargets(targets: ResetTargetInput[]): Promise<ResetTarget[]> {
    const results: ResetTarget[] = []
    for (const target of targets) {
      try {
        await fsPromises.rm(target.path, { recursive: true, force: true })
        results.push({ ...target, ok: true })
      } catch (err) {
        const cause = err instanceof Error ? err : new Error(String(err))
        throw new DatabaseResetTargetRemovalError(
          {
            message:
              `Database reset stopped after removing ${results.length} of ${targets.length} targets: ` +
              `failed to remove ${target.label} at ${target.path}: ${cause.message}`,
            target,
            completed: results.map(({ label, path }) => ({ label, path })),
          },
          { cause },
        )
      }
    }
    return results
  }

  // Overlay DB reset is a file deletion operation for the current runtime
  // SQLite path reported by /global/health. It must not read SQLite state
  // first, because schema drift or a corrupt DB file is the primary reason the
  // user needs this action.
  export function resetFiles(databasePath: string): Promise<ResetTarget[]> {
    const normalizedDatabasePath = databasePath.trim()
    if (!path.isAbsolute(normalizedDatabasePath)) {
      return Promise.reject(new Error(`Database.resetFiles databasePath must be an absolute path: ${databasePath}`))
    }
    const currentDatabasePath = Path()
    if (normalizedDatabasePath !== currentDatabasePath) {
      return Promise.reject(
        new Error(`Database.resetFiles databasePath must match Database.Path(): expected ${currentDatabasePath}`),
      )
    }
    return runSharedLifecycle(`resetFiles:${normalizedDatabasePath}`, "resetFiles", async () => {
      await awaitEffectIdle(RESET_EFFECT_INACTIVITY_TIMEOUT_MS)
      try {
        releaseOwnedSqlite({ clearUnavailable: true, checkpoint: true })
      } catch (error) {
        throw recordUnavailable(error, "Database.resetFiles.close") ?? error
      }
      return removeTargets(databaseFileTargets(normalizedDatabasePath))
    })
  }

  // Strict sequential wipe used by `opencorvus db reset` CLI. A failed target
  // stops deletion and reports completed work; retrying is safe because missing
  // targets are accepted by fs.rm({ force: true }). The SQLite file itself is
  // global (`Database.Path()`); caller still MUST pass the project directory
  // explicitly so project-scoped scratch under `<projectDir>/.opencorvus/` can
  // be removed alongside the shared DB.
  export function reset(projectDir: string): Promise<ResetTarget[]> {
    const normalizedProjectDir = projectDir.trim()
    if (!path.isAbsolute(normalizedProjectDir)) {
      return Promise.reject(new Error(`Database.reset projectDir must be an absolute path: ${projectDir}`))
    }
    const targets: ResetTargetInput[] = [
      ...databaseFileTargets(),
      { label: "runtime", path: ProjectRuntimePaths.projectRuntimeRoot(normalizedProjectDir) },
      ...ProjectRuntimePaths.legacyRuntimeRelativePaths.map((relative) => ({
        label: `legacy:${relative}`,
        path: path.join(normalizedProjectDir, ...relative.split("/")),
      })),
    ]
    return runSharedLifecycle(`reset:${normalizedProjectDir}`, "reset", async () => {
      await awaitEffectIdle(RESET_EFFECT_INACTIVITY_TIMEOUT_MS)
      try {
        releaseOwnedSqlite({ clearUnavailable: true, checkpoint: true })
      } catch (error) {
        throw recordUnavailable(error, "Database.reset.close") ?? error
      }
      return removeTargets(targets)
    })
  }

  export function rebuildSqlite<T>(
    callback: (sqlite: BunDatabase) => T,
    ..._synchronousOnly: T extends PromiseLike<unknown> ? [never] : []
  ): void {
    return runSynchronousLifecycle("rebuildSqlite", () => {
      try {
        releaseOwnedSqlite({ clearUnavailable: true, checkpoint: true })
      } catch (error) {
        throw recordUnavailable(error, "Database.rebuildSqlite.closeExisting") ?? error
      }
      const dbPath = Path()
      fsSync.mkdirSync(path.dirname(dbPath), { recursive: true })
      let sqlite: BunDatabase
      try {
        sqlite = openOwnedSqlite(dbPath)
      } catch (error) {
        throwOwnedInitializationFailure(error, "Database.rebuildSqlite")
      }

      let operationFailure: unknown
      let rollbackFailure: unknown
      let operationFailed = false
      let rollbackFailed = false
      let transactionOpen = false
      try {
        sqlite.run("PRAGMA foreign_keys = OFF")
        sqlite.run("BEGIN")
        transactionOpen = true
        dropCurrentSchema(sqlite)
        sqlite.exec(SCHEMA_DDL)
        assertSynchronousResult(callback(sqlite), "Database.rebuildSqlite")
        const foreignKeyViolations = queryAllFinalized<{
          table: string
          rowid: number | null
          parent: string
          fkid: number
        }>(sqlite, "PRAGMA foreign_key_check")
        if (foreignKeyViolations.length > 0) {
          const sample = foreignKeyViolations
            .slice(0, 8)
            .map(
              (violation) =>
                `${violation.table}[rowid=${violation.rowid ?? "without-rowid"}] -> ` +
                `${violation.parent}[constraint=${violation.fkid}]`,
            )
            .join(", ")
          throw new Error(
            `Database.rebuildSqlite foreign key check found ${foreignKeyViolations.length} violation(s): ${sample}`,
          )
        }
        sqlite.run("COMMIT")
        transactionOpen = false
        sqlite.run("PRAGMA foreign_keys = ON")
      } catch (error) {
        operationFailed = true
        const failures = [error]
        if (transactionOpen) {
          try {
            sqlite.run("ROLLBACK")
            transactionOpen = false
          } catch (error) {
            rollbackFailed = true
            rollbackFailure = error
            state.rollbackRequired = true
            failures.push(error)
          }
        }
        operationFailure =
          failures.length === 1
            ? error
            : new AggregateError(failures, "Database rebuild failed and its transaction could not be rolled back", {
                cause: error,
              })
      }

      if (operationFailed) {
        const normalized = recordUnavailable(operationFailure, "Database.rebuildSqlite") ?? operationFailure
        if (rollbackFailed) throw normalized
        try {
          releaseOwnedSqlite({ clearUnavailable: false, checkpoint: false })
        } catch (closeError) {
          const cleanupFailure = recordUnavailable(closeError, "Database.rebuildSqlite.cleanup") ?? closeError
          throw new AggregateError([normalized, cleanupFailure], "Database rebuild and SQLite close both failed", {
            cause: normalized,
          })
        }
        throw normalized
      }

      try {
        releaseOwnedSqlite({ clearUnavailable: true, checkpoint: true })
      } catch (error) {
        throw recordUnavailable(error, "Database.rebuildSqlite.close") ?? error
      }
    })
  }

  /**
   * Run `PRAGMA wal_checkpoint(TRUNCATE)` to collapse the WAL back into the
   * main DB file and truncate it on disk. Only meaningful after bulk
   * DELETEs that shift many pages to free-list. Must run outside a
   * transaction — caller is responsible for not holding one.
   */
  export function checkpointTruncate() {
    // Forcing Client() ensures the sqlite handle is initialised; we cannot use
    // `use()` here because checkpoint must not run inside a transaction ctx.
    try {
      Client()
      const sqlite = state.sqlite
      if (!sqlite) return
      sqlite.run("PRAGMA wal_checkpoint(TRUNCATE)")
    } catch (error) {
      throwNormalized(error, "Database.checkpointTruncate")
    }
  }

  /**
   * Run `VACUUM` to rebuild the DB file and reclaim free pages into the
   * filesystem. Expensive; call only after large-scale deletes. Must run
   * outside a transaction.
   */
  export function vacuum() {
    try {
      Client()
      const sqlite = state.sqlite
      if (!sqlite) return
      sqlite.run("VACUUM")
    } catch (error) {
      throwNormalized(error, "Database.vacuum")
    }
  }

  /**
   * Reclaim up to `pages` freelist pages back to the OS. Only effective when
   * the DB was created with `auto_vacuum = INCREMENTAL`. Cheap — O(pages) —
   * so safe to call after every cascading delete. Must run outside a
   * transaction.
   */
  export function incrementalVacuum(pages = 1000) {
    try {
      Client()
      const sqlite = state.sqlite
      if (!sqlite) return
      sqlite.run(`PRAGMA incremental_vacuum(${pages})`)
    } catch (error) {
      throwNormalized(error, "Database.incrementalVacuum")
    }
  }

  export type TxOrDb = Transaction | Client

  const ctx = Context.create<{
    tx: TxOrDb
    effects: (() => void | Promise<void>)[]
    closed: boolean
    transactionDepth: number
  }>("database")

  export class ActiveDatabaseTransactionRequiredError extends Error {
    override readonly name = "ActiveDatabaseTransactionRequiredError"

    constructor(public readonly operation: string) {
      super(`${operation} requires an active Database transaction`)
    }
  }

  const effectLog = Log.create({ service: "db-effect" })
  const EFFECT_FAILURE_SAMPLE_LIMIT = 32
  const effectFailures: unknown[] = []
  let effectFailureCount = 0
  let effectActivityVersion = 0
  let effectIdleOwner: Promise<void> | undefined

  function markEffectActivity() {
    effectActivityVersion++
  }

  function recordEffectFailure(error: unknown) {
    effectFailureCount++
    if (effectFailures.length < EFFECT_FAILURE_SAMPLE_LIMIT) effectFailures.push(error)
    effectLog.warn("post-commit effect failed", {
      error: error instanceof Error ? error.message : String(error),
      pendingFailures: effectFailureCount,
    })
    markEffectActivity()
  }

  function delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
  }

  function registerEffect(owner: EffectOwner) {
    let resolveCompletion!: () => void
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve
    })
    activeEffects.set(owner, completion)
    markEffectActivity()
    return () => {
      owner.closed = true
      activeEffects.delete(owner)
      markEffectActivity()
      resolveCompletion()
    }
  }

  function isPromiseLike(value: unknown): value is Promise<unknown> {
    return (
      (typeof value === "object" || typeof value === "function") &&
      value !== null &&
      "then" in value &&
      typeof value.then === "function"
    )
  }

  function runEffect(fn: () => void | Promise<void>) {
    assertEffectAdmission("Database.effect")
    const owner: EffectOwner = { closed: false }
    const finish = registerEffect(owner)
    let result: void | Promise<void>
    try {
      result = effectOwnerContext.provide(owner, fn)
      if (!isPromiseLike(result)) {
        finish()
        return
      }
    } catch (error) {
      recordEffectFailure(error)
      finish()
      return
    }
    void Promise.resolve(result).then(
      () => finish(),
      (error) => {
        recordEffectFailure(error)
        finish()
      },
    )
  }

  export function runLifecycleActivity<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const normalizedLabel = label.trim()
    if (!normalizedLabel) return Promise.reject(new Error("Database.runLifecycleActivity requires a label"))
    const operationLabel = `Database.runLifecycleActivity(${normalizedLabel})`
    if (effectSettlementGate) return Promise.reject(new DatabaseEffectAdmissionClosedError(operationLabel))
    const inheritedFailure = inheritedOwnerFailure(operationLabel)
    if (inheritedFailure) return Promise.reject(inheritedFailure)
    const databaseOwner = ctx.tryUse()
    if (databaseOwner && !databaseOwner.closed) {
      return Promise.reject(new Error(`${operationLabel} rejected lifecycle activity from an active database context`))
    }
    const inheritedEffect = effectOwnerContext.tryUse()
    if (inheritedEffect && activeEffects.has(inheritedEffect)) {
      return Promise.reject(new Error(`${operationLabel} rejected nested lifecycle activity`))
    }
    if (lifecycleOwner) return Promise.reject(lifecycleConflict(operationLabel, lifecycleOwner))

    const owner: EffectOwner = { closed: false }
    const finish = registerEffect(owner)
    let result: Promise<T>
    try {
      result = effectOwnerContext.provide(owner, operation)
    } catch (error) {
      finish()
      return Promise.reject(error)
    }
    return Promise.resolve(result).finally(finish)
  }

  /** Execute post-commit effects and retain failures for the next idle boundary. */
  function drainEffects(effects: (() => void | Promise<void>)[]) {
    for (const fn of effects) {
      runEffect(fn)
    }
  }

  function provideDatabaseContext<T>(
    owner: { tx: TxOrDb; effects: (() => void | Promise<void>)[]; closed: boolean; transactionDepth: number },
    operation: string,
    callback: () => T,
  ): T {
    try {
      const result = ctx.provide(owner, callback)
      if (isPromiseLike(result)) throw new Error(`${operation} callback must be synchronous`)
      return result
    } finally {
      owner.closed = true
    }
  }

  function assertSynchronousResult<T>(result: T, operation: string): T {
    if (isPromiseLike(result)) throw new Error(`${operation} callback must be synchronous`)
    return result
  }

  export function use<T>(
    callback: (trx: TxOrDb) => T,
    ..._synchronousOnly: T extends PromiseLike<unknown> ? [never] : []
  ): T {
    assertDatabaseAccess("Database.use")
    throwIfUnavailable()
    const active = ctx.tryUse()
    if (active) return assertSynchronousResult(callback(active.tx), "Database.use")

    try {
      throwIfUnavailable()
      const db = Client()
      const owner = { effects: [] as (() => void | Promise<void>)[], tx: db, closed: false, transactionDepth: 0 }
      const result = provideDatabaseContext(owner, "Database.use", () => callback(db))
      drainEffects(owner.effects)
      return result
    } catch (error) {
      throwNormalized(error, "Database.use")
    }
  }

  /**
   * Detach a background operation from the caller's synchronous transaction
   * and post-commit effect ownership. The operation must establish any DB
   * lifecycle it needs after entering this scope.
   */
  export function runOutsideContext<T>(fn: () => T): T {
    return effectOwnerContext.without(() => ctx.without(fn))
  }

  export function effect(fn: () => any | Promise<any>) {
    assertEffectAdmission("Database.effect")
    assertLifecycleUnowned("Database.effect")
    const active = ctx.tryUse()
    if (active) {
      if (active.closed) throw new Error("Database.effect rejected because its database context owner is closed")
      active.effects.push(fn)
      return
    }
    runEffect(fn)
  }

  export class EffectSettlementInactivityError extends Error {
    override readonly name = "DatabaseEffectSettlementInactivityError"

    constructor(
      public readonly activeEffectCount: number,
      public readonly inactivityTimeoutMilliseconds: number,
    ) {
      super(
        `Database effect settlement made no progress for ${inactivityTimeoutMilliseconds}ms; ` +
          `${activeEffectCount} lifecycle effect(s) remain`,
      )
    }
  }

  export function awaitEffectIdle(idleTimeoutMs: number): Promise<void> {
    if (!Number.isInteger(idleTimeoutMs) || idleTimeoutMs <= 0) {
      throw new Error(`Database.awaitEffectIdle: invalid idleTimeoutMs ${idleTimeoutMs}`)
    }
    const currentEffect = effectOwnerContext.tryUse()
    const inheritedFailure = inheritedOwnerFailure("Database.awaitEffectIdle")
    if (inheritedFailure) return Promise.reject(inheritedFailure)
    if (currentEffect && activeEffects.has(currentEffect)) {
      return Promise.reject(new Error("Database.awaitEffectIdle rejected a post-commit effect waiting for itself"))
    }
    const currentDatabase = ctx.tryUse()
    if (currentDatabase && !currentDatabase.closed) {
      return Promise.reject(new Error("Database.awaitEffectIdle rejected a wait from an active database context"))
    }
    if (effectIdleOwner) return effectIdleOwner

    const owner = (async () => {
      let lastActivityVersion = effectActivityVersion
      let idleDeadline = Date.now() + idleTimeoutMs
      while (activeEffects.size > 0) {
        if (effectActivityVersion !== lastActivityVersion) {
          lastActivityVersion = effectActivityVersion
          idleDeadline = Date.now() + idleTimeoutMs
        }

        const remaining = idleDeadline - Date.now()
        if (remaining <= 0) {
          throw new EffectSettlementInactivityError(activeEffects.size, idleTimeoutMs)
        }

        const snapshot = [...activeEffects.values()]
        await Promise.race([Promise.allSettled(snapshot).then(() => undefined), delay(Math.min(50, remaining))])
      }

      const failures = effectFailures.splice(0)
      const failureCount = effectFailureCount
      effectFailureCount = 0
      if (failureCount > failures.length) {
        failures.push(
          new Error(
            `${failureCount - failures.length} additional post-commit database effect failure(s) were logged beyond the retained diagnostic sample limit`,
          ),
        )
      }
      if (failureCount > 0) {
        throw new AggregateError(failures, `${failureCount} post-commit database effect(s) failed`)
      }
    })()

    effectIdleOwner = owner
    const clearOwner = () => {
      if (effectIdleOwner === owner) effectIdleOwner = undefined
    }
    void owner.then(clearOwner, clearOwner)
    return owner
  }

  export async function acquireEffectSettlementGate(idleTimeoutMs: number): Promise<Disposable> {
    if (effectSettlementGate || effectSettlementAcquiring) {
      throw new Error("Database effect settlement is already in progress")
    }
    effectSettlementAcquiring = true
    try {
      for (;;) {
        await awaitEffectIdle(idleTimeoutMs)
        if (activeEffects.size > 0) continue
        const token = Symbol("database-effect-settlement")
        effectSettlementGate = token
        return {
          [Symbol.dispose]() {
            if (effectSettlementGate === token) effectSettlementGate = undefined
          },
        }
      }
    } finally {
      effectSettlementAcquiring = false
    }
  }

  export function hasActiveContext() {
    const active = ctx.tryUse()
    return active !== undefined && !active.closed
  }

  export function hasActiveTransaction() {
    const active = ctx.tryUse()
    return active !== undefined && !active.closed && active.transactionDepth > 0
  }

  export function requireActiveTransaction(operation: string): void {
    if (!hasActiveTransaction()) throw new ActiveDatabaseTransactionRequiredError(operation)
  }

  let savepointSequence = 0

  function runSavepoint<T>(db: TxOrDb, callback: () => T, operation: string): T {
    const active = ctx.tryUse()
    if (!active || active.closed || active.tx !== db) {
      throw new ActiveDatabaseTransactionRequiredError(operation)
    }
    const name = `database_savepoint_${process.pid}_${++savepointSequence}`
    const effectStart = active.effects.length
    db.run(sql.raw(`SAVEPOINT "${name}"`))
    try {
      const result = assertSynchronousResult(
        provideDatabaseContext(
          {
            tx: db,
            effects: active.effects,
            closed: false,
            transactionDepth: active.transactionDepth + 1,
          },
          operation,
          callback,
        ),
        operation,
      )
      db.run(sql.raw(`RELEASE SAVEPOINT "${name}"`))
      return result
    } catch (cause) {
      active.effects.splice(effectStart)
      try {
        db.run(sql.raw(`ROLLBACK TO SAVEPOINT "${name}"`))
      } finally {
        db.run(sql.raw(`RELEASE SAVEPOINT "${name}"`))
      }
      throw cause
    }
  }

  /** Create an exact nested SQLite transaction while preserving the Database
   * context's transaction depth and post-commit effect ownership. */
  export function savepoint<T>(
    db: TxOrDb,
    callback: () => T,
    ..._synchronousOnly: T extends PromiseLike<unknown> ? [never] : []
  ): T {
    return runSavepoint(db, callback, "Database.savepoint")
  }

  export function transaction<T>(
    callback: (tx: TxOrDb) => T,
    ..._synchronousOnly: T extends PromiseLike<unknown> ? [never] : []
  ): T {
    assertDatabaseAccess("Database.transaction")
    throwIfUnavailable()
    const active = ctx.tryUse()
    if (active) return runSavepoint(active.tx, () => callback(active.tx), "Database.transaction")

    try {
      throwIfUnavailable()
      const effects: (() => void | Promise<void>)[] = []
      const result = Client().transaction((tx) => {
        return provideDatabaseContext(
          { tx, effects, closed: false, transactionDepth: 1 },
          "Database.transaction",
          () => callback(tx),
        )
      })
      drainEffects(effects)
      return result
    } catch (error) {
      throwNormalized(error, "Database.transaction")
    }
  }

  /** Acquire SQLite's cross-process writer reservation before the first read.
   * Use for find-or-create authorities whose losing caller must observe the
   * winner instead of racing a deferred read transaction into SQLITE_BUSY. */
  export function immediateTransaction<T>(
    callback: (tx: TxOrDb) => T,
    ..._synchronousOnly: T extends PromiseLike<unknown> ? [never] : []
  ): T {
    assertDatabaseAccess("Database.immediateTransaction")
    throwIfUnavailable()
    const active = ctx.tryUse()
    if (active) return runSavepoint(active.tx, () => callback(active.tx), "Database.immediateTransaction")

    try {
      const effects: (() => void | Promise<void>)[] = []
      const result = Client().transaction(
        (tx) =>
          provideDatabaseContext(
            { tx, effects, closed: false, transactionDepth: 1 },
            "Database.immediateTransaction",
            () => callback(tx),
          ),
        { behavior: "immediate" },
      )
      drainEffects(effects)
      return result
    } catch (error) {
      throwNormalized(error, "Database.immediateTransaction")
    }
  }
}
