import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { Database, eq, inArray } from "../../src/storage/db"
import { ProjectTable } from "../../src/project/project.sql"

afterAll(async () => {
  await Database.awaitEffectIdle(20_000)
  Database.close()
})

for (const mode of ["transaction", "immediateTransaction"] as const) {
  describe(`Database.${mode} synchronous library boundary`, () => {
    const run = Database[mode]
    const row = (id: string) => ({
      id,
      worktree: path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, id),
      generation: crypto.randomUUID(),
      sandboxes: [],
      time_created: 1,
      time_updated: 1,
    })

    test("returns exact scalar, object identity and undefined from the committed callback", () => {
      const value = { marker: `${mode} identity` }
      expect(run(() => 42)).toBe(42)
      expect(run(() => value)).toBe(value)
      expect(run(() => undefined)).toBeUndefined()
    })

    test("nested rollback preserves the committed rows and ordered post-commit effects", async () => {
      const ids = ["outer", "rolled-back", "inner"].map((suffix) => `prj_${mode}_${suffix}`)
      const observed: string[] = []
      const result = { id: ids[0] }
      const query = () =>
        Database.use((db) =>
          db
            .select({ id: ProjectTable.id })
            .from(ProjectTable)
            .where(inArray(ProjectTable.id, ids))
            .orderBy(ProjectTable.id)
            .all(),
        )
      const committed = run((db) => {
        db.insert(ProjectTable).values(row(ids[0]!)).run()
        observed.push("outer-body")
        Database.effect(() => {
          observed.push("outer-effect")
        })
        expect(() =>
          Database.transaction<void>((nested) => {
            nested.insert(ProjectTable).values(row(ids[1]!)).run()
            Database.effect(() => {
              observed.push("rolled-back-effect")
            })
            throw new Error("nested rollback contract")
          }),
        ).toThrow("nested rollback contract")
        const nestedResult = Database.immediateTransaction((nested) => {
          nested.insert(ProjectTable).values(row(ids[2]!)).run()
          Database.effect(() => {
            observed.push("inner-effect")
          })
          return "nested-committed"
        })
        expect(nestedResult).toBe("nested-committed")
        observed.push("after-inner")
        expect(observed).toEqual(["outer-body", "after-inner"])
        return result
      })
      await Database.awaitEffectIdle(20_000)
      expect(committed).toBe(result)
      expect(query()).toEqual([ids[2], ids[0]].sort().map((id) => ({ id })))
      expect(observed).toEqual(["outer-body", "after-inner", "outer-effect", "inner-effect"])
    })

    test("Promise and thenable results return the exact synchronous error with committed state preserved", () => {
      const id = `prj_${mode}_sync-guard`
      run((db) => db.insert(ProjectTable).values(row(id)).run())
      const attempted = [
        Promise.resolve("resolved value"),
        { then: (resolve: (value: string) => void) => resolve("thenable value") },
      ]
      for (const value of attempted) {
        const invoke = () =>
          Reflect.apply(run, undefined, [
            (db: Database.TxOrDb) => {
              db.update(ProjectTable).set({ time_updated: 2 }).where(eq(ProjectTable.id, id)).run()
              return value
            },
          ])
        expect(invoke).toThrow(new Error(`Database.${mode} callback must be synchronous`))
        expect(
          Database.use((db) =>
            db
              .select({ id: ProjectTable.id, updated: ProjectTable.time_updated })
              .from(ProjectTable)
              .where(eq(ProjectTable.id, id))
              .get(),
          ),
        ).toEqual({ id, updated: 1 })
      }
    })
  })
}
