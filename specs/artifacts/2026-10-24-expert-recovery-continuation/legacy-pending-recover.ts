import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
const [stage = "outer", worker = "first"] = process.argv.slice(2)
const source = path.resolve(process.env.PUBLICATION_LEGACY_PENDING_SOURCE!)
const output = path.resolve(
  process.env.PUBLICATION_LEGACY_PENDING_OUTPUT ??
    path.join(
      ".tmp-product-iteration/expert-recovery-continuation-audit/publication",
      `legacy-recovered-${Date.now()}`,
    ),
)
fs.mkdirSync(output, { recursive: true })
const report = JSON.parse(fs.readFileSync(path.join(source, "original", "result.json"), "utf8"))
const original = report.original
const journalText = fs.readFileSync(path.join(source, "original", "after-delete-files", "journal.json"), "utf8")
const journal = JSON.parse(journalText)
function rawSnapshot(file: string) {
  using raw = new SQLite(file, { readonly: true, create: false })
  raw.exec("PRAGMA query_only=ON; BEGIN")
  const tables = raw
    .query<
      any,
      []
    >("SELECT name,wr FROM pragma_table_list WHERE schema='main' AND name NOT LIKE 'sqlite_%' AND type IN ('table','virtual','shadow') ORDER BY name")
    .all()
  const rows = tables.map((table) => ({
    name: table.name,
    rows: raw.query(`SELECT ${table.wr ? "" : "rowid AS __rowid,"}* FROM "${table.name}"`).all(),
  }))
  const bytes = raw.serialize()
  raw.exec("ROLLBACK")
  return { rows, bytes }
}
if (stage === "outer") {
  const relative = path.relative(path.resolve(report.runtime.ownerRoot), path.resolve(report.runtime.processRoot))
  assert(
    relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative),
    "only this probe's original isolated runtime",
  )
  const physicalMaster = path.resolve(
    process.env.PUBLICATION_LEGACY_PENDING_MASTER ?? report.runtime.processRoot + `-original-master-${Date.now()}`,
  )
  const previousWorking = path.resolve(report.runtime.processRoot + `-prior-recovery-${Date.now()}`)
  for (const target of [physicalMaster, previousWorking]) {
    const targetRelative = path.relative(path.resolve(report.runtime.ownerRoot), target)
    assert(
      targetRelative.length > 0 && !targetRelative.startsWith("..") && !path.isAbsolute(targetRelative),
      "every move target remains inside the exact original isolated owner",
    )
  }
  const ownerMarker = JSON.parse(
    fs.readFileSync(path.join(report.runtime.ownerRoot, ".opencorvus-test-owner.json"), "utf8"),
  )
  assert.equal(ownerMarker.schema_version, 1)
  assert.equal(path.dirname(fs.realpathSync(report.runtime.ownerRoot)), fs.realpathSync(ownerMarker.os_temp_root))
  assert(
    path.basename(report.runtime.ownerRoot).startsWith("opencorvus-test-run-"),
    "original managed test owner identity",
  )
  assert.equal(fs.lstatSync(report.runtime.processRoot).isSymbolicLink(), false)
  // Preserve the original physical tree by rename, then restore a working copy
  // to its original logical paths. The immutable journal remains byte-exact.
  fs.renameSync(
    report.runtime.processRoot,
    process.env.PUBLICATION_LEGACY_PENDING_MASTER ? previousWorking : physicalMaster,
  )
  fs.cpSync(physicalMaster, report.runtime.processRoot, {
    recursive: true,
    verbatimSymlinks: true,
    force: false,
    errorOnExist: true,
  })
  fs.writeFileSync(
    path.join(output, "original-and-working-copy.json"),
    JSON.stringify({ source, physicalMaster, workingRoot: report.runtime.processRoot }, null, 2),
  )
  const masterDatabase = path.join(physicalMaster, path.relative(report.runtime.processRoot, original.databasePath))
  const before = rawSnapshot(masterDatabase)
  fs.writeFileSync(path.join(output, "original-master.sqlite"), before.bytes)
  const { bootstrapIsolatedTestRuntime, isolatedTestChildEnvironment } = await import(
    "../../../packages/util/src/test-runtime-environment"
  )
  const runtime = await bootstrapIsolatedTestRuntime("test")
  const { prepareTestProcessSupervisor } = await import(
    "../../../packages/opencorvus/script/prepare-test-process-supervisor"
  )
  process.env.OPENCORVUS_PROCESS_SUPERVISOR = prepareTestProcessSupervisor()
  const { runHostCommandWithInactivity } = await import("../../../packages/opencorvus/src/shell/command-inactivity")
  for (const name of ["first", "second"]) {
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: [
        `--tsconfig-override=${path.resolve("packages/opencorvus/tsconfig.json")}`,
        import.meta.path,
        "recover",
        name,
      ],
      cwd: process.cwd(),
      env: {
        ...isolatedTestChildEnvironment(runtime),
        PUBLICATION_LEGACY_PENDING_SOURCE: source,
        PUBLICATION_LEGACY_PENDING_OUTPUT: output,
      },
      inactivityTimeoutMs: 180_000,
      deadlineAt: Date.now() + 900_000,
    })
    fs.writeFileSync(path.join(output, `${name}.stdout.log`), result.stdout)
    fs.writeFileSync(path.join(output, `${name}.stderr.log`), result.stderr)
    fs.writeFileSync(
      path.join(output, `${name}.exit.json`),
      JSON.stringify(
        { exit: result.exitCode, settlementConfirmed: result.settlementConfirmed, failure: result.failure },
        null,
        2,
      ),
    )
    assert.equal(result.settlementConfirmed, true)
    assert.equal(result.failure, undefined)
    assert.equal(result.exitCode, 0)
  }
  const first = JSON.parse(fs.readFileSync(path.join(output, "first.json"), "utf8"))
  const second = JSON.parse(fs.readFileSync(path.join(output, "second.json"), "utf8"))
  assert.deepEqual(first.outcome.disposition, "commit_receipt_unavailable")
  assert.deepEqual(second.outcome.disposition, "none")
  assert.deepEqual(first.occurrence, second.occurrence)
  assert.equal(first.version, "2026.10.24.3")
  assert.equal(first.occurrence.intent.payload.protocol, "opencorvus/expert-squad-mutation-preservation@1")
  assert.equal(first.occurrence.terminal.payload.resourceEvidence.target.expectedObservationAvailable, false)
  assert.equal(first.occurrence.terminal.payload.resourceEvidence.target.preserved[0].classification, "observed_source")
  const archive = first.occurrence.directory
  const masterArchive = path.join(physicalMaster, path.relative(report.runtime.processRoot, archive))
  assert.deepEqual(
    fs.readFileSync(path.join(masterArchive, "intent.json")),
    fs.readFileSync(path.join(archive, "intent.json")),
  )
  assert.deepEqual(
    fs.readFileSync(path.join(masterArchive, "phases", "000001-retained-journal.json")),
    fs.readFileSync(path.join(archive, "phases", "000001-retained-journal.json")),
  )
  assert.deepEqual(rawSnapshot(original.databasePath).rows, before.rows, "all original SQLite columns/rowid retained")
  assert.deepEqual(rawSnapshot(masterDatabase).rows, before.rows, "physical original master remains read-only")
  fs.writeFileSync(
    path.join(output, "result.json"),
    JSON.stringify(
      {
        outcome: first.outcome,
        repeatedOutcome: second.outcome,
        protocol: first.occurrence.intent.payload.protocol,
        appended: first.occurrence.phases.slice(1).map((phase: any) => phase.name),
        terminal: first.occurrence.terminal,
        currentVersion: first.version,
        oldIntentAndPhaseBytesExact: true,
        originalAndWorkingAllRowsExact: true,
        first,
        second,
      },
      null,
      2,
    ),
  )
  console.log(
    JSON.stringify({
      output,
      phases: first.occurrence.phases.length,
      expectedObservationAvailable: false,
      currentVersion: first.version,
      passed: true,
    }),
  )
  process.exit(0)
}
const { isolatedTestChildEnvironment } = await import("../../../packages/util/src/test-runtime-environment")
Object.assign(process.env, isolatedTestChildEnvironment(report.runtime))
process.env.OPENCORVUS_HOME = report.runtime.runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = report.runtime.processRoot
for (const key of Object.keys(process.env))
  if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key)) delete process.env[key]
const { Database } = await import("@/storage/db")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { DurablePublicationStore, digestFilesystemTree } = await import("../../../packages/util/src/durable-publication")
const outcome = await Manager.reconcileCommittedPackageMutation({
  projectDirectory: original.directory,
  id: original.id,
  installationScope: "global",
})
const store = new DurablePublicationStore(
  path.join(
    path.dirname(path.dirname(original.journalPath)),
    "durable-publications",
    "expert-squad-mutations",
    original.id,
  ),
)
const occurrence = await store.read("preservation", journal.operationID)
const resources = occurrence.terminal!.payload.resources as string
const target = occurrence.terminal!.payload.resourceEvidence as any
assert.equal(target.target.expectedObservationAvailable, false)
for (const resource of ["target", "backup"])
  assert.equal(
    await digestFilesystemTree(target[resource].preserved[0].resource),
    await digestFilesystemTree(path.join(source, "final-files", resource)),
  )
assert.equal(fs.readFileSync(path.join(resources, "original-journal.json"), "utf8"), journalText)
assert.equal(Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n, 0)
const version = JSON.parse(fs.readFileSync(path.join(original.targetRoot, "expert-squad.jsonc"), "utf8")).version
fs.writeFileSync(path.join(output, `${worker}.json`), JSON.stringify({ outcome, occurrence, version }, null, 2))
fs.writeFileSync(path.join(output, `${worker}.sqlite`), rawSnapshot(original.databasePath).bytes)
Database.close()
process.exit(0)
