import assert from "node:assert/strict"
import { isDeepStrictEqual } from "node:util"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
const mode = process.argv[2]
assert(["settled", "gap", "question", "permission"].includes(mode))
const outputRoot =
  process.env.CHANNEL_AUDIT_OUTPUT_DIRECTORY ??
  path.resolve(".tmp-product-iteration/durable-effect-receipt-audit/channel/v8")
fs.mkdirSync(outputRoot, { recursive: true })
const metadata = JSON.parse(
  fs.readFileSync(
    process.argv[3] ??
      path.join(
        import.meta.dir,
        mode === "question" || mode === "permission" ? `restart-${mode}.json` : `delete-${mode}.json`,
      ),
    "utf8",
  ),
)
const sourcePath = metadata.databasePath
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
      rows: db.query(`SELECT ${table.wr ? "" : "rowid AS __rowid,"}* FROM "${table.name}"`).all() as Record<
        string,
        unknown
      >[],
    })),
  }
}
const { bootstrapIsolatedTestRuntime } = await import("../../../packages/util/src/test-runtime-environment")
const runtime = await bootstrapIsolatedTestRuntime("test")
const { Database } = await import("@/storage/db")
fs.mkdirSync(path.dirname(Database.Path()), { recursive: true })
let before: ReturnType<typeof snapshot>
{
  using original = new SQLite(sourcePath, { readonly: true, create: false })
  original.exec("PRAGMA query_only=ON; BEGIN")
  before = snapshot(original)
  assert.equal((before.version as any).user_version, 6)
  fs.writeFileSync(Database.Path(), original.serialize())
  original.exec("ROLLBACK")
}
const identity = Database.Identity()
assert.equal(Database.allFinalized<any>("PRAGMA user_version")[0].user_version, 8)
let after: ReturnType<typeof snapshot>
{
  using actual = new SQLite(Database.Path(), { readonly: true, create: false })
  actual.exec("PRAGMA query_only=ON; BEGIN")
  after = snapshot(actual)
  fs.writeFileSync(path.join(outputRoot, `upgrade-${mode}-after-opener.sqlite`), actual.serialize())
  actual.exec("ROLLBACK")
}
let retainedRows = 0
for (const table of before.tables) {
  const current = after.tables.find((item) => item.name === table.name)
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
  assert(
    isDeepStrictEqual(snapshot(backup), before),
    "original pre-upgrade backup preserves all rows/schema version exactly",
  )
}
const accepted = Database.allFinalized<any>("SELECT * FROM channel_ingress_accepted")[0]
assert.equal(accepted.project_generation, null)
assert.equal(accepted.effect, null)
const originalAccepted = before.tables.find((item) => item.name === "channel_ingress_accepted")!.rows[0]!
const { Instance } = await import("@/project/instance")
const { ChannelIngress } = await import("@/channel/ingress")
const directory = metadata.directory ?? metadata.owner.project.worktree
let diagnostic: any, fresh: any
await Instance.provide({
  directory,
  fn: async () => {
    const input = { platform: accepted.platform, request_id: accepted.request_id, ...JSON.parse(accepted.input) }
    try {
      await ChannelIngress.message(input as any)
    } catch (error) {
      diagnostic = error.toObject()
    }
    assert.equal(diagnostic.data.code, "CHANNEL_INGRESS_OUTCOME_UNKNOWN")
    assert.equal(diagnostic.data.diagnostic.owner, "unknown")
    assert.equal(diagnostic.data.diagnostic.acceptedID, originalAccepted.id)
    fresh = await ChannelIngress.message({
      platform: "slack",
      channel: "upgrade-fresh-channel",
      thread: "upgrade-fresh-thread",
      request_id: `new-after-v6-${mode}`,
      text: "fresh local request",
      allow_create: false,
    })
    assert.equal(fresh.kind, "panel_response")
  },
})
await Instance.disposeAll()
Database.close()
assert.equal(Database.Identity(), identity)
Database.close()
const report = {
  mode,
  originalVersion: 6,
  upgradedVersion: 8,
  originalTables: before.tables.length,
  retainedRows,
  originalRowsAndRowIDsPreserved: true,
  originalBackupExact: true,
  identityPreservedOnRestart: true,
  legacyUnknownEvidence: {
    code: diagnostic.data.code,
    owner: diagnostic.data.diagnostic.owner,
    acceptedID: accepted.id,
  },
  freshRequestResult: fresh.kind,
  isolatedDatabase: Database.Path(),
  originalDatabase: sourcePath,
  runtime,
}
fs.writeFileSync(path.join(outputRoot, `upgrade-${mode}.json`), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
