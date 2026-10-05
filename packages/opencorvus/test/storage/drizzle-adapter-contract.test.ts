import { describe, expect, test } from "bun:test"
import { Database as NativeDatabase } from "bun:sqlite"
import { createRequire } from "node:module"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import * as esmCore from "drizzle-orm"
import * as esmSqlite from "drizzle-orm/sqlite-core"
import * as esmDriver from "drizzle-orm/bun-sqlite"
import * as esmSession from "drizzle-orm/bun-sqlite/session"

const require = createRequire(import.meta.url)
const adapters = [
  { name: "ESM", core: esmCore, sqlite: esmSqlite, driver: esmDriver, session: esmSession },
  {
    name: "CommonJS",
    core: require("drizzle-orm") as typeof esmCore,
    sqlite: require("drizzle-orm/sqlite-core") as typeof esmSqlite,
    driver: require("drizzle-orm/bun-sqlite") as typeof esmDriver,
    session: require("drizzle-orm/bun-sqlite/session") as typeof esmSession,
  },
]

/** Observe native execution; every recorded method still calls the real SQLite statement. */
function observeStatements(client: NativeDatabase, finalizeFailure?: Error) {
  const events: Array<{ statement: number; method: string }> = []
  const prepare = client.prepare.bind(client)
  let sequence = 0
  Object.defineProperty(client, "prepare", {
    configurable: true,
    value(sql: string) {
      const statement = prepare(sql)
      const id = ++sequence
      events.push({ statement: id, method: "prepare" })
      for (const method of ["run", "all", "get", "values", "finalize"] as const) {
        const original = statement[method].bind(statement) as (...args: unknown[]) => unknown
        Object.defineProperty(statement, method, {
          configurable: true,
          value(...args: unknown[]) {
            events.push({ statement: id, method })
            const result = original(...args)
            // Deliberate fault injection only in the separately named AggregateError case.
            if (method === "finalize" && finalizeFailure) throw finalizeFailure
            return result
          },
        })
      }
      return statement
    },
  })
  return { events, methods: () => events.map((event) => event.method) }
}

for (const adapter of adapters) {
  describe(`${adapter.name} installed Bun SQLite adapter`, () => {
    const { sql, eq, and, or, not } = adapter.core
    const { sqliteTable, integer, text, SQLiteSyncDialect } = adapter.sqlite
    const { drizzle } = adapter.driver

    test("quoted identifiers and aliases return exact data with the sentinel row retained", () => {
      const client = new NativeDatabase(":memory:")
      try {
        client.exec('CREATE TABLE "contract""table" ("id" integer PRIMARY KEY, "value""payload" text NOT NULL)')
        client.exec(
          "CREATE TABLE sentinel (id integer PRIMARY KEY, value text); INSERT INTO sentinel VALUES (1, 'intact')",
        )
        const table = sqliteTable('contract"table', {
          id: integer().primaryKey(),
          value: text('value"payload').notNull(),
        })
        const db = drizzle({ client })
        db.insert(table).values({ id: 1, value: "bound ' payload" }).run()
        expect(
          db
            .select({ value: sql<string>`${table.value}`.as('value"alias') })
            .from(table)
            .all(),
        ).toEqual([{ value: "bound ' payload" }])
        expect(
          db.all(sql`SELECT ${sql.identifier('value"payload')} AS ${sql.identifier('exact"key')} FROM ${table}`),
        ).toEqual([{ 'exact"key': "bound ' payload" }])
        expect(db.all(sql`SELECT id, value FROM sentinel`)).toEqual([{ id: 1, value: "intact" }])
        expect(db.get<{ total: number }>(sql`SELECT count(*) AS total FROM ${table}`)).toEqual({ total: 1 })
      } finally {
        client.close(true)
      }
    })

    test("compound predicates, bound values and joined aliases select the intended rows", () => {
      const client = new NativeDatabase(":memory:")
      try {
        client.exec("CREATE TABLE truth (id integer PRIMARY KEY, a integer, b integer, c integer)")
        const table = sqliteTable("truth", { id: integer().primaryKey(), a: integer(), b: integer(), c: integer() })
        const db = drizzle({ client })
        db.insert(table)
          .values([
            { id: 1, a: 1, b: 0, c: 0 },
            { id: 2, a: 0, b: 1, c: 1 },
            { id: 3, a: 0, b: 0, c: 1 },
            { id: 4, a: 1, b: 1, c: 0 },
          ])
          .run()
        const grouped = db
          .select({ id: table.id })
          .from(table)
          .where(and(sql`${table.a} = ${1} OR ${table.b} = ${1}`, eq(table.c, 1)))
          .orderBy(table.id)
        expect(grouped.toSQL().params).toEqual([1, 1, 1])
        expect(grouped.all()).toEqual([{ id: 2 }])
        expect(
          db
            .select({ id: table.id })
            .from(table)
            .where(not(sql`${table.a} = ${1} OR ${table.b} = ${1}`))
            .all(),
        ).toEqual([{ id: 3 }])
        expect(
          db
            .select({ id: table.id })
            .from(table)
            .where(or(and(eq(table.a, 1), eq(table.b, 1)), eq(table.id, 3)))
            .orderBy(table.id)
            .all(),
        ).toEqual([{ id: 3 }, { id: 4 }])
        const left = db
          .select({ id: table.id, value: sql<number>`${table.id} + ${10}`.as("value") })
          .from(table)
          .as("left_values")
        const right = db
          .select({ id: table.id, value: sql<number>`${table.id} + ${20}`.as("value") })
          .from(table)
          .as("right_values")
        expect(
          db
            .select({ left: left.value, right: right.value })
            .from(left)
            .innerJoin(right, eq(left.id, right.id))
            .where(eq(left.id, 2))
            .all(),
        ).toEqual([{ left: 12, right: 22 }])
      } finally {
        client.close(true)
      }
    })

    test("ordinary one-time methods finalize their actual native statement before returning", async () => {
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drizzle-native-lifetime-"))
      const file = path.join(directory, "contract.db")
      const client = new NativeDatabase(file)
      try {
        client.exec("CREATE TABLE contract (id integer PRIMARY KEY, value text)")
        const observed = observeStatements(client)
        const db = drizzle({ client })
        db.run(sql`INSERT INTO contract VALUES (${1}, ${"durable"})`)
        expect(db.all(sql`SELECT id, value FROM contract`)).toEqual([{ id: 1, value: "durable" }])
        expect(db.get<{ value: string }>(sql`SELECT value FROM contract WHERE id = ${1}`)).toEqual({ value: "durable" })
        expect(db.values(sql`SELECT id, value FROM contract`)).toEqual([[1, "durable"]])
        expect(observed.events).toEqual([
          ...["prepare", "run", "finalize"].map((method) => ({ statement: 1, method })),
          ...["prepare", "all", "finalize"].map((method) => ({ statement: 2, method })),
          ...["prepare", "get", "finalize"].map((method) => ({ statement: 3, method })),
          ...["prepare", "values", "finalize"].map((method) => ({ statement: 4, method })),
        ])
        client.close(true)
        const reopened = new NativeDatabase(file, { readonly: true })
        try {
          expect(drizzle({ client: reopened }).all(sql`SELECT id, value FROM contract`)).toEqual([
            { id: 1, value: "durable" },
          ])
        } finally {
          reopened.close(true)
        }
      } finally {
        client.close(true)
        await fs.rm(directory, { recursive: true, force: true })
      }
    })

    test("CRUD builders complete their native one-time owners with exact changed rows", () => {
      const client = new NativeDatabase(":memory:")
      try {
        client.exec("CREATE TABLE builder (id integer PRIMARY KEY, value text)")
        const table = sqliteTable("builder", { id: integer().primaryKey(), value: text() })
        const observed = observeStatements(client)
        const db = drizzle({ client })
        expect(db.insert(table).values({ id: 1, value: "created" }).returning().get()).toEqual({
          id: 1,
          value: "created",
        })
        expect(db.select().from(table).all()).toEqual([{ id: 1, value: "created" }])
        expect(db.update(table).set({ value: "updated" }).where(eq(table.id, 1)).returning().get()).toEqual({
          id: 1,
          value: "updated",
        })
        expect(db.delete(table).where(eq(table.id, 1)).returning().all()).toEqual([{ id: 1, value: "updated" }])
        expect(observed.events).toEqual(
          [1, 2, 3, 4].flatMap((statement) =>
            ["prepare", "values", "finalize"].map((method) => ({ statement, method })),
          ),
        )
      } finally {
        client.close(true)
      }
    })

    test("mapped and relational results finish mapping before their single finalization", () => {
      const client = new NativeDatabase(":memory:")
      try {
        const observed = observeStatements(client)
        const session = new adapter.session.SQLiteBunSession(client, new SQLiteSyncDialect(), {}, undefined)
        const mapper = (rows: unknown[][]) => {
          observed.events.push({ statement: 1, method: "map" })
          return rows.map(([value]) => ({ value }))
        }
        expect(
          session
            .prepareOneTimeQuery({ sql: "SELECT ? AS value", params: ["mapped"] }, undefined, "all", true, mapper)
            .all(),
        ).toEqual([{ value: "mapped" }])
        expect(observed.methods()).toEqual(["prepare", "values", "map", "finalize"])
        for (const method of ["all", "get"] as const) {
          observed.events.length = 0
          const prepared = session.prepareOneTimeRelationalQuery(
            { sql: "SELECT ? AS value", params: ["relational"] },
            undefined,
            method,
            (rows) => {
              observed.events.push({ statement: 0, method: "map" })
              return method === "all" ? rows : rows[0]
            },
          )
          expect(prepared[method]()).toEqual(method === "all" ? [{ value: "relational" }] : { value: "relational" })
          expect(observed.methods()).toEqual(["prepare", method, "map", "finalize"])
        }
      } finally {
        client.close(true)
      }
    })

    test("native constraint, missing placeholder and mapper failures retain their error and finalization", () => {
      const client = new NativeDatabase(":memory:")
      try {
        client.exec("CREATE TABLE unique_value (id integer PRIMARY KEY); INSERT INTO unique_value VALUES (1)")
        const observed = observeStatements(client)
        const session = new adapter.session.SQLiteBunSession(client, new SQLiteSyncDialect(), {}, undefined)
        const duplicate = session.prepareOneTimeQuery(
          { sql: "INSERT INTO unique_value VALUES (?)", params: [1] },
          undefined,
          "run",
          false,
        )
        expect(() => duplicate.run()).toThrow("UNIQUE constraint failed: unique_value.id")
        expect(observed.methods()).toEqual(["prepare", "run", "finalize"])
        observed.events.length = 0
        const missing = session.prepareOneTimeQuery(
          { sql: "SELECT ? AS value", params: [sql.placeholder("value")] },
          undefined,
          "get",
          false,
        )
        expect(() => missing.get()).toThrow('No value for placeholder "value" was provided')
        expect(observed.methods()).toEqual(["prepare", "finalize"])
        for (const method of ["all", "get", "values"] as const) {
          observed.events.length = 0
          const overflow = session.prepareOneTimeQuery(
            { sql: "SELECT abs(-9223372036854775808)", params: [] },
            undefined,
            "all",
            false,
          )
          expect(() => overflow[method]()).toThrow("integer overflow")
          expect(observed.methods()).toEqual(["prepare", method, "finalize"])
        }
        for (const method of ["all", "get"] as const) {
          observed.events.length = 0
          const mapperError = new Error(`${method} mapper contract`)
          const mapped = session.prepareOneTimeQuery({ sql: "SELECT 1", params: [] }, undefined, method, true, () => {
            throw mapperError
          })
          expect(() => mapped[method]()).toThrow(mapperError)
          expect(observed.methods()).toEqual(["prepare", "values", "finalize"])
          observed.events.length = 0
          const relational = session.prepareOneTimeRelationalQuery(
            { sql: "SELECT 1", params: [] },
            undefined,
            method,
            () => {
              throw mapperError
            },
          )
          expect(() => relational[method]()).toThrow(mapperError)
          expect(observed.methods()).toEqual(["prepare", method, "finalize"])
        }
        observed.events.length = 0
        const loggerError = new Error("logger contract")
        const withLogger = new adapter.session.SQLiteBunSession(client, new SQLiteSyncDialect(), {}, undefined, {
          logger: {
            logQuery() {
              throw loggerError
            },
          },
        })
        expect(() =>
          withLogger.prepareOneTimeQuery({ sql: "SELECT 1", params: [] }, undefined, "get", false).get(),
        ).toThrow(loggerError)
        expect(observed.methods()).toEqual(["prepare", "finalize"])
      } finally {
        client.close(true)
      }
    })

    test("explicit prepared queries retain two bound executions and expose the finalized-query error", () => {
      const client = new NativeDatabase(":memory:")
      try {
        client.exec(
          "CREATE TABLE reusable (id integer PRIMARY KEY, value text); INSERT INTO reusable VALUES (1,'one'), (2,'two')",
        )
        const observed = observeStatements(client)
        const table = sqliteTable("reusable", { id: integer().primaryKey(), value: text() })
        const query = drizzle({ client })
          .select()
          .from(table)
          .where(eq(table.id, sql.placeholder("id")))
        // The common SQLite builder type omits the Bun adapter's explicit ownership API.
        const prepared = query.prepare() as ReturnType<typeof query.prepare> &
          Pick<esmSession.PreparedQuery, "finalize">
        expect(prepared.get({ id: 1 })).toEqual({ id: 1, value: "one" })
        expect(prepared.get({ id: 2 })).toEqual({ id: 2, value: "two" })
        expect(observed.methods()).toEqual(["prepare", "values", "values"])
        prepared.finalize()
        prepared.finalize()
        expect(observed.methods()).toEqual(["prepare", "values", "values", "finalize"])
        expect(() => prepared.get({ id: 1 })).toThrow("Cannot execute a finalized Bun SQLite prepared query")
      } finally {
        client.close(true)
      }
    })

    test("fault-injected finalization preserves the original mapper cause and both errors", () => {
      const client = new NativeDatabase(":memory:")
      try {
        const finalizationError = new Error("injected after native finalize")
        const mapperError = new Error("mapper failed before cleanup")
        const observed = observeStatements(client, finalizationError)
        const session = new adapter.session.SQLiteBunSession(client, new SQLiteSyncDialect(), {}, undefined)
        const query = session.prepareOneTimeQuery({ sql: "SELECT 1", params: [] }, undefined, "all", true, () => {
          throw mapperError
        })
        let error: unknown
        try {
          query.all()
        } catch (caught) {
          error = caught
        }
        expect(error).toBeInstanceOf(AggregateError)
        expect((error as AggregateError).message).toBe(
          "Bun SQLite query and one-time statement finalization both failed",
        )
        expect((error as AggregateError).cause).toBe(mapperError)
        expect((error as AggregateError).errors).toEqual([mapperError, finalizationError])
        expect(observed.methods()).toEqual(["prepare", "values", "finalize"])
      } finally {
        client.close(true)
      }
    })
  })
}
