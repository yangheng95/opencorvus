import path from "path"
import { Database as BunDatabase } from "bun:sqlite"
import { Instance } from "../../src/project/instance"
import { Database } from "../../src/storage/db"

function inside(parent: string, child: string) {
  const relative = path.relative(path.resolve(parent), path.resolve(child))
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative))
}

function assertTestDatabasePath(dbPath: string) {
  const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT?.trim()
  if (processRoot && inside(processRoot, dbPath)) return
  throw new Error(
    `Refusing to reset non-test opencorvus database at ${dbPath}. ` +
      "Run tests with the package bunfig preload so OPENCORVUS_TEST_PROCESS_ROOT owns the database.",
  )
}

export async function resetDatabase() {
  await Instance.disposeAll()
  const dbPath = Database.Path()
  assertTestDatabasePath(dbPath)
  await Database.resetFiles(dbPath)
}

export async function createTestDatabase() {
  await resetDatabase()
  Database.Client()
  Database.close()
}

/** Introduce schema drift only in the isolated test database. */
export function editTestDatabase(edit: (sqlite: BunDatabase) => unknown) {
  const dbPath = Database.Path()
  assertTestDatabasePath(dbPath)
  Database.close()
  const sqlite = new BunDatabase(dbPath)
  try {
    edit(sqlite)
  } finally {
    sqlite.close(true)
  }
}
