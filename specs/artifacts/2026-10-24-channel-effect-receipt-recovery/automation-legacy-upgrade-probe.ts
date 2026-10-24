import assert from "node:assert/strict"
import { isDeepStrictEqual } from "node:util"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
const mode = process.argv[2]
assert(["before", "deleted", "recreated", "resumed"].includes(mode))
const evidenceRoot = path.resolve(".tmp-product-iteration/durable-effect-receipt-audit/automation/message-case")
const sourcePath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(evidenceRoot, `${mode}.sqlite`)
const destination =
  process.env.CHANNEL_AUDIT_OUTPUT_DIRECTORY ??
  path.resolve(".tmp-product-iteration/durable-effect-receipt-audit/channel/automation-upgrade", mode)
fs.mkdirSync(destination, { recursive: true })
function snapshot(db: SQLite) {
  const tables = db
    .query(
      "SELECT name,wr FROM pragma_table_list WHERE schema='main' AND name NOT LIKE 'sqlite_%' AND type IN ('table','virtual','shadow') ORDER BY name",
    )
    .all() as { name: string; wr: number }[]
  return {
    version: db.query("PRAGMA user_version").get(),
    tables: tables.map((table) => ({
      name: table.name,
      rows: db.query(`SELECT ${table.wr ? "" : "rowid AS __rowid,"}* FROM "${table.name}"`).all() as any[],
    })),
  }
}
const { bootstrapIsolatedTestRuntime } = await import("../../../packages/util/src/test-runtime-environment")
const runtime = await bootstrapIsolatedTestRuntime("test")
for (const key of Object.keys(process.env))
  if (
    /(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key) ||
    ["AWS_PROFILE", "AWS_ACCESS_KEY_ID"].includes(key)
  )
    delete process.env[key]
const { Database } = await import("@/storage/db")
fs.mkdirSync(path.dirname(Database.Path()), { recursive: true })
let before: ReturnType<typeof snapshot>
let sourceWithoutDelivery: any
{
  using original = new SQLite(sourcePath, { readonly: true, create: false })
  original.exec("PRAGMA query_only=ON; BEGIN")
  before = snapshot(original)
  assert.equal((before.version as any).user_version, 6)
  sourceWithoutDelivery = original
    .query(
      `SELECT p.* FROM bus_publication_outbox p WHERE NOT EXISTS (SELECT 1 FROM bus_publication_delivery d WHERE d.occurrence_id=p.occurrence_id) AND (SELECT count(DISTINCT phase) FROM bus_publication_phase_receipt r WHERE r.occurrence_id=p.occurrence_id)=3 ORDER BY p.occurrence_id LIMIT 1`,
    )
    .get()
  assert(sourceWithoutDelivery, "the real old snapshot contains a completed source with no delivery rows")
  fs.writeFileSync(Database.Path(), original.serialize())
  original.exec("ROLLBACK")
}
const authority = Database.Identity()
assert.equal(Database.allFinalized<any>("PRAGMA user_version")[0].user_version, 8)
let upgraded: ReturnType<typeof snapshot>
{
  using db = new SQLite(Database.Path(), { readonly: true, create: false })
  db.exec("PRAGMA query_only=ON; BEGIN")
  upgraded = snapshot(db)
  fs.writeFileSync(path.join(destination, "after-upgrade.sqlite"), db.serialize())
  db.exec("ROLLBACK")
}
let retainedRows = 0
for (const table of before.tables) {
  const current = upgraded.tables.find((candidate) => candidate.name === table.name)
  assert(current, `original table ${table.name} retained`)
  for (const row of table.rows) {
    assert(
      current.rows.some((candidate) =>
        isDeepStrictEqual(Object.fromEntries(Object.keys(row).map((key) => [key, candidate[key]])), row),
      ),
      `original row/rowid preserved in ${table.name}`,
    )
    retainedRows++
  }
}
const backupRoot = path.join(path.dirname(Database.Path()), "migration-backups")
const backups = fs.readdirSync(backupRoot).filter((name) => name.endsWith(".sqlite"))
assert.equal(backups.length, 1)
{
  using backup = new SQLite(path.join(backupRoot, backups[0]!), { readonly: true, create: false })
  assert(isDeepStrictEqual(snapshot(backup), before), "whole original backup equals the v6 source")
}
const run = Database.allFinalized<any>("SELECT * FROM automation_run")[0]
assert.equal(run.target_project_generation, null)
const originalRuns = Database.allFinalized<any>("SELECT rowid AS __rowid,* FROM automation_run")
const originalFires = Database.allFinalized<any>("SELECT rowid AS __rowid,* FROM automation_fire")
const originalMessages = Database.allFinalized<any>("SELECT rowid AS __rowid,* FROM message")
const originalSessions = Database.allFinalized<any>("SELECT rowid AS __rowid,* FROM session")
const { PublicationRead } = await import("@/bus/publication-read")
let after: string | undefined,
  found = false
do {
  const page = PublicationRead.list({ projectID: sourceWithoutDelivery.project_id, after, limit: 1 })
  if (page.sources.some((source) => source.occurrenceID === sourceWithoutDelivery.occurrence_id)) found = true
  after = page.next ?? undefined
} while (after)
assert(found, "completed source remains in the actual bounded production history")
const buffers: Buffer[] = []
let byteOffset: number | null = 0
while (byteOffset !== null) {
  const page = PublicationRead.read({
    projectID: sourceWithoutDelivery.project_id,
    occurrenceID: sourceWithoutDelivery.occurrence_id,
    byteOffset,
    section: "phases",
    limit: 1,
  })
  assert.equal(page.source.generation, null)
  assert(Buffer.byteLength(JSON.stringify(page)) <= 32768, "bounded source page fits the actual output budget")
  buffers.push(Buffer.from(page.body.data, "base64"))
  byteOffset = page.body.nextByteOffset
}
assert.equal(Buffer.concat(buffers).toString("utf8"), sourceWithoutDelivery.properties)
const phases: string[] = []
let offset: number | null = 0
while (offset !== null) {
  const page = PublicationRead.read({
    projectID: sourceWithoutDelivery.project_id,
    occurrenceID: sourceWithoutDelivery.occurrence_id,
    section: "phases",
    offset,
    limit: 1,
  })
  phases.push(...page.facts.map((fact: any) => fact.phase))
  offset = page.nextOffset
}
assert.deepEqual(phases, ["exact", "global", "wildcard"])
const { AutomationService } = await import("@/scheduler/automation-service")
const deadline = Date.now() + 30_000
let receipt: any
do {
  await AutomationService.runDueNow()
  receipt = Database.allFinalized<any>("SELECT * FROM automation_run_receipt").find(
    (row) => row.run_id === run.id && row.outcome === "disposition",
  )
  if (receipt) break
  assert(Date.now() < deadline, "formal production poll must settle the original unresolved Run")
  await Bun.sleep(50)
} while (true)
assert.equal(receipt.disposition, "owner_unresolved")
assert(
  isDeepStrictEqual(Database.allFinalized("SELECT rowid AS __rowid,* FROM automation_run"), originalRuns),
  "the original Run remains byte/rowid exact",
)
assert(
  isDeepStrictEqual(Database.allFinalized("SELECT rowid AS __rowid,* FROM automation_fire"), originalFires),
  "the original Fire remains byte/rowid exact",
)
assert(
  isDeepStrictEqual(Database.allFinalized("SELECT rowid AS __rowid,* FROM message"), originalMessages),
  "original wake Message effects remain exact",
)
assert(
  isDeepStrictEqual(Database.allFinalized("SELECT rowid AS __rowid,* FROM session"), originalSessions),
  "original Session effects remain exact",
)
assert.equal(Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n, 0)
await Database.awaitEffectIdle(60_000)
Database.close()
assert.equal(Database.Identity(), authority)
assert.equal(
  Database.allFinalized<any>("SELECT * FROM automation_run_receipt").find((row) => row.id === receipt.id)?.disposition,
  "owner_unresolved",
)
Database.close()
const report = {
  mode,
  sourceVersion: 6,
  targetVersion: 8,
  originalTables: before.tables.length,
  retainedRows,
  migrationStage: {
    allOriginalRowsAndRowIDsPreserved: true,
    snapshot: path.join(destination, "after-upgrade.sqlite"),
    originalBackupExact: true,
  },
  legacyGeneration: null,
  actualRecovery: "AutomationService.runDueNow",
  disposition: "owner_unresolved",
  recoveryStage: { originalRunFireMessageSessionExact: true },
  historySourceReadableWithoutDeliveries: true,
  historySourcePhases: phases,
  sourcePropertiesExactBytes: true,
  authorityStableOnRestart: true,
  providerRequestCount: 0,
  databasePath: Database.Path(),
  runtime,
}
fs.writeFileSync(path.join(destination, "result.json"), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
process.exit(0)
