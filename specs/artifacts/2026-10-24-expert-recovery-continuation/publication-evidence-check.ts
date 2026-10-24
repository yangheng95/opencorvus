import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
const evidenceRoot = path.resolve(
  process.env.PUBLICATION_EVIDENCE_ROOT ?? ".tmp-product-iteration/expert-recovery-continuation-audit/publication",
)
const names = process.argv.slice(2)
assert(names.length > 0, "provide actual fresh case directory names")
function tree(file: string): unknown {
  const state = fs.lstatSync(file)
  if (state.isSymbolicLink()) return { symlink: fs.readlinkSync(file) }
  if (state.isDirectory())
    return Object.fromEntries(
      fs
        .readdirSync(file)
        .sort()
        .map((name) => [name, tree(path.join(file, name))]),
    )
  return { bytes: fs.readFileSync(file).toString("base64") }
}
function rows(file: string) {
  using db = new SQLite(file, { readonly: true, create: false })
  db.exec("PRAGMA query_only=ON; BEGIN")
  const tables = db
    .query<
      any,
      []
    >("SELECT name,wr FROM pragma_table_list WHERE schema='main' AND name NOT LIKE 'sqlite_%' AND type IN ('table','virtual','shadow') ORDER BY name")
    .all()
  const result = tables.map((table) => ({
    name: table.name,
    rows: db.query(`SELECT ${table.wr ? "" : "rowid AS __rowid,"}* FROM "${table.name}"`).all(),
  }))
  db.exec("ROLLBACK")
  return result
}
const results = []
for (const name of names) {
  assert.equal(path.basename(name), name, "one case directory identity")
  const root = path.join(evidenceRoot, name)
  const final = JSON.parse(fs.readFileSync(path.join(root, "final.json"), "utf8"))
  const occurrence = final.occurrence
  const payload = occurrence.terminal.payload
  assert.equal(occurrence.terminal.outcome, "committed")
  assert.equal(payload.disposition, "commit_receipt_unavailable")
  assert.equal(final.currentJournal, null)
  assert.equal(final.providerRequests, 0)
  assert.equal(final.canonicalReceipts, 0)
  const exits: Record<string, number> = {}
  for (const file of fs.readdirSync(root).filter((file) => file.endsWith(".exit.json"))) {
    const exit = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))
    assert.equal(exit.settlementConfirmed, true, `${file} exact physical/output receipt`)
    assert.equal(exit.failure, undefined)
    assert.equal(exit.exit, file === "hard-cut.exit.json" ? 24 : 0)
    exits[file] = exit.exit
  }
  const original = path.join(root, "original", "after-delete-files")
  const atCut = path.join(root, "at-cut-files", "archive")
  const end = path.join(root, "final-files", "archive")
  assert.deepEqual(fs.readFileSync(path.join(atCut, "intent.json")), fs.readFileSync(path.join(end, "intent.json")))
  for (const file of fs
    .readdirSync(path.join(atCut, "phases"))
    .filter((file) => file.endsWith(".json") && !file.startsWith(".tmp-")))
    assert.deepEqual(fs.readFileSync(path.join(atCut, "phases", file)), fs.readFileSync(path.join(end, "phases", file)))
  assert.deepEqual(
    fs.readFileSync(path.join(original, "journal.json")),
    fs.readFileSync(path.join(payload.resources, "original-journal.json")),
  )
  for (const key of ["target", "backup"]) {
    const asset = payload.resourceEvidence[key].preserved.find((item: any) => item.classification === "expected")
    assert.equal(payload.resourceEvidence[key].expectedObservationAvailable, true)
    assert.deepEqual(tree(path.join(original, key)), tree(asset.resource))
  }
  assert.deepEqual(
    rows(path.join(root, "at-cut.sqlite")),
    rows(path.join(root, "final.sqlite")),
    "all original SQLite columns and rowid remain exact",
  )
  assert.equal(occurrence.phases.filter((item: any) => item.name.startsWith("retained-")).length, 5)
  if (name.startsWith("target-")) {
    const asset = payload.resourceEvidence.target.preserved.find(
      (item: any) => item.classification === "observed_source",
    )
    assert.deepEqual(tree(asset.resource), tree(path.join(root, "actual-newer-target-backup")))
    assert.equal(occurrence.phases.filter((item: any) => item.name === "resource-observation-v2").length, 1)
  }
  results.push({
    case: name,
    version: final.version,
    phases: occurrence.phases.length,
    originalIntentAndExistingPhasesExact: true,
    expectedBeforeAndAfterTreesExact: true,
    allOriginalDatabaseRowsAndRowidExact: true,
    physicalAndOutputSettlementsConfirmed: true,
    exits,
  })
}
fs.writeFileSync(
  process.env.PUBLICATION_CHECK_OUTPUT ?? path.join(evidenceRoot, "final-evidence-check.json"),
  JSON.stringify(results, null, 2),
)
console.log(JSON.stringify(results, null, 2))
