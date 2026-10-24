import assert from "node:assert/strict"
import { isDeepStrictEqual } from "node:util"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
const mode = process.argv[2]
assert(["positive", "deleted", "before"].includes(mode))
const source = process.env.EXPERT_LEGACY_SOURCE_DIRECTORY ?? path.join(import.meta.dir, `expert-v7-${mode}-preserved-2`)
const original = JSON.parse(fs.readFileSync(path.join(source, "original.json"), "utf8"))
const report = JSON.parse(fs.readFileSync(path.join(source, "result.json"), "utf8"))
const output = process.env.EXPERT_LEGACY_OUTPUT_DIRECTORY ?? path.join(import.meta.dir, `expert-upgrade-${mode}`)
fs.mkdirSync(output, { recursive: true })
const { isolatedTestChildEnvironment } = await import("../../../packages/util/src/test-runtime-environment")
Object.assign(process.env, isolatedTestChildEnvironment(report.runtime))
process.env.OPENCORVUS_HOME = report.runtime.runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = report.runtime.processRoot
for (const key of Object.keys(process.env))
  if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key)) delete process.env[key]
function snapshot(db: SQLite) {
  const tables = db
    .query(
      "SELECT name,wr FROM pragma_table_list WHERE schema='main' AND name NOT LIKE 'sqlite_%' AND type IN ('table','virtual','shadow') ORDER BY name",
    )
    .all() as any[]
  return {
    version: (db.query("PRAGMA user_version").get() as any).user_version,
    tables: tables.map((table) => ({
      name: table.name,
      rows: db.query(`SELECT ${table.wr ? "" : "rowid AS __rowid,"}* FROM "${table.name}"`).all() as Record<
        string,
        unknown
      >[],
    })),
  }
}
let before: ReturnType<typeof snapshot>
{
  using raw = new SQLite(path.join(source, "after-delete-before-reconcile.sqlite"), { readonly: true, create: false })
  before = snapshot(raw)
}
assert.equal(before.version, 7)
const { Database } = await import("@/storage/db")
assert.equal(Database.Path(), original.databasePath)
const authority = Database.Identity()
let upgraded: ReturnType<typeof snapshot>
{
  using raw = new SQLite(Database.Path(), { readonly: true, create: false })
  raw.exec("PRAGMA query_only=ON; BEGIN")
  upgraded = snapshot(raw)
  fs.writeFileSync(path.join(output, "after-upgrade-before-reconcile.sqlite"), raw.serialize())
  raw.exec("ROLLBACK")
}
assert.equal(upgraded.version, 8)
let retainedRows = 0
for (const table of before.tables) {
  const current = upgraded.tables.find((row) => row.name === table.name)!
  for (const row of table.rows) {
    assert(
      current.rows.some((candidate) =>
        isDeepStrictEqual(Object.fromEntries(Object.keys(row).map((key) => [key, candidate[key]])), row),
      ),
      `${table.name} original row/rowid retained`,
    )
    retainedRows++
  }
}
const backupRoot = path.join(path.dirname(Database.Path()), "migration-backups")
const backupFiles = fs.readdirSync(backupRoot).filter((name) => name.endsWith(".sqlite"))
const exactBackup = backupFiles.find((file) => {
  using raw = new SQLite(path.join(backupRoot, file), { readonly: true, create: false })
  return isDeepStrictEqual(snapshot(raw), before)
})
assert(exactBackup, "formal migration preserves full original schema/rows backup")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { digestFilesystemTree } = await import("../../../packages/util/src/durable-publication")
const journal = JSON.parse(fs.readFileSync(path.join(source, "after-delete-files", "journal.json"), "utf8"))
const outcome = await Manager.reconcileCommittedPackageMutation({
  projectDirectory: original.directory,
  id: original.id,
  installationScope: "global",
})
assert.equal(
  JSON.parse(fs.readFileSync(path.join(original.targetRoot, "expert-squad.jsonc"), "utf8")).version,
  "2026.10.24.2",
)
let preservation: any, subsequent: any
if (mode === "positive") {
  assert.equal(outcome.disposition, "committed")
  const receipt = Database.allFinalized<any>("SELECT * FROM expert_squad_mutation_receipt")[0]
  const projection = before.tables
    .find((table) => table.name === "engine_artifact")!
    .rows.find((row) => row.id === original.artifactID)!
  assert.equal(receipt.envelope, projection.payload)
  assert.equal(receipt.time_created, projection.time_created)
} else {
  assert.equal(outcome.disposition, "commit_receipt_unavailable")
  let offset: number | undefined = 0
  const chunks: Buffer[] = []
  while (offset !== undefined) {
    const page: any = await Manager.inspectMutationRecovery({
      projectDirectory: original.directory,
      id: original.id,
      installationScope: "global",
      occurrenceID: journal.operationID,
      byteOffset: offset,
    })
    assert(Buffer.from(page.dataBase64, "base64").length <= 4096)
    chunks.push(Buffer.from(page.dataBase64, "base64"))
    offset = page.nextByteOffset ?? undefined
  }
  preservation = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  assert.equal(preservation.terminal.payload.disposition, "commit_receipt_unavailable")
  const resources = preservation.terminal.payload.resources
  assert.equal(
    fs.readFileSync(path.join(resources, "original-journal.json"), "utf8"),
    fs.readFileSync(path.join(source, "after-delete-files", "journal.json"), "utf8"),
  )
  for (const resource of ["target", "backup"])
    assert.equal(
      await digestFilesystemTree(path.join(resources, resource)),
      await digestFilesystemTree(path.join(source, "after-delete-files", resource)),
    )
  const { ExpertSquadRegistry: Registry } = await import("@/expert-squad/registry")
  const loaded = await Registry.loadPackage(original.targetRoot)
  subsequent = await Manager.importDirectory({
    projectDirectory: original.directory,
    sourceDirectory: path.join(resources, "backup"),
    installationScope: "global",
    expectedCurrentPackageDigest: loaded.packageDigest,
  })
  assert.equal(subsequent.after.version, "2026.10.24.1")
  for (const resource of ["target", "backup"])
    assert.equal(
      await digestFilesystemTree(path.join(resources, resource)),
      await digestFilesystemTree(path.join(source, "after-delete-files", resource)),
    )
}
const requestCount = Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n
assert.equal(requestCount, 0)
Database.close()
assert.equal(Database.Identity(), authority)
Database.close()
const result = {
  mode,
  originalVersion: 7,
  upgradedVersion: 8,
  originalTables: before.tables.length,
  retainedRows,
  migrationStageAllRowsAndRowIDsPreserved: true,
  originalBackupExact: true,
  exactBackup: path.join(backupRoot, exactBackup),
  outcome,
  preservation,
  subsequent,
  requestCount,
  original,
  isolatedDatabase: Database.Path(),
}
fs.writeFileSync(path.join(output, "result.json"), JSON.stringify(result, null, 2))
console.log(
  JSON.stringify({ mode, retainedRows, outcome, requestCount, afterExplicitVersion: subsequent?.after.version }),
)
process.exit(0)
