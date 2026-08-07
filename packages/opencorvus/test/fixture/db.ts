import path from "path"
import { Instance } from "../../src/project/instance"
import { Database } from "../../src/storage/db"

export const TEST_DATABASE_LOCK_DIAGNOSTIC_TIMEOUT_MS = 60_000

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
  Database.Client()
  Database.close()
}

export function rebuildTestDatabase() {
  const dbPath = Database.Path()
  assertTestDatabasePath(dbPath)
  Database.rebuildSqlite(() => {})
}
