import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { isDeepStrictEqual } from "node:util"
import { pathToFileURL } from "node:url"
import { Database as SQLite } from "bun:sqlite"
const root = process.cwd()
const [stage = "outer", mode = "upgrade", label = "main"] = process.argv.slice(2)
const output = path.resolve(
  process.env.EXPERT_CONTINUATION_OUTPUT ??
    path.join(root, ".tmp-product-iteration/expert-recovery-continuation-audit/root", `${mode}-${Date.now()}`),
)
fs.mkdirSync(output, { recursive: true })
const load = (relative: string) => import(pathToFileURL(path.join(root, relative)).href)
function snapshot(file: string) {
  using db = new SQLite(file, { readonly: true, create: false })
  db.exec("PRAGMA query_only=ON; BEGIN")
  const tables = db
    .query<
      any,
      []
    >("SELECT name,wr FROM pragma_table_list WHERE schema='main' AND name NOT LIKE 'sqlite_%' AND type IN ('table','virtual','shadow') ORDER BY name")
    .all()
  const result = {
    version: db.query<any, []>("PRAGMA user_version").get()!.user_version,
    tables: tables.map((t) => ({
      name: t.name,
      rows: db.query<any, []>(`SELECT ${t.wr ? "" : "rowid AS __rowid,"}* FROM "${t.name}"`).all(),
    })),
  }
  const bytes = db.serialize()
  db.exec("ROLLBACK")
  return { result, bytes }
}
function restore(file: string, bytes: Uint8Array, processRoot: string) {
  const relative = path.relative(path.resolve(processRoot), path.resolve(file))
  assert(
    relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative),
    "restore is within exact owned process root",
  )
  fs.mkdirSync(path.dirname(file), { recursive: true })
  for (const suffix of ["-wal", "-shm"]) fs.rmSync(file + suffix, { force: true })
  fs.writeFileSync(file, bytes)
}
if (stage === "outer") {
  assert.equal(fs.existsSync(path.join(output, "runtime.json")), false, "fresh evidence directory")
  const { bootstrapIsolatedTestRuntime, isolatedTestChildEnvironment } = await load(
    "packages/util/src/test-runtime-environment.ts",
  )
  const runtime = await bootstrapIsolatedTestRuntime("test")
  fs.writeFileSync(path.join(output, "runtime.json"), JSON.stringify(runtime, null, 2))
  const { prepareTestProcessSupervisor } = await load("packages/opencorvus/script/prepare-test-process-supervisor.ts")
  process.env.OPENCORVUS_PROCESS_SUPERVISOR = prepareTestProcessSupervisor()
  const { runHostCommandWithInactivity } = await load("packages/opencorvus/src/shell/command-inactivity.ts")
  async function run(file: string, args: string[], extra: Record<string, string>, name: string) {
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: [`--tsconfig-override=${path.join(root, "packages/opencorvus/tsconfig.json")}`, file, ...args],
      cwd: root,
      env: { ...isolatedTestChildEnvironment(runtime), EXPERT_CONTINUATION_OUTPUT: output, ...extra },
      inactivityTimeoutMs: 180_000,
      deadlineAt: Date.now() + 900_000,
    })
    fs.writeFileSync(path.join(output, `${name}.log`), result.stdout + result.stderr)
    fs.writeFileSync(
      path.join(output, `${name}-exit.json`),
      JSON.stringify(
        { exit: result.exitCode, settlementConfirmed: result.settlementConfirmed, failure: result.failure },
        null,
        2,
      ),
    )
    assert.equal(result.settlementConfirmed, true, `${name} actual physical/output settlement`)
    assert.equal(result.failure, undefined, `${name} process contract`)
    console.log(JSON.stringify({ name, exit: result.exitCode }))
    return result.exitCode
  }
  const ownDB = path.join(runtime.runtimeRoot, "data", "opencorvus.db")
  if (mode === "upgrade") {
    const source = process.env.EXPERT_CONTINUATION_LEGACY_DB
    assert(source, "EXPERT_CONTINUATION_LEGACY_DB must name a genuine original v7 database")
    const original = snapshot(source)
    assert.equal(original.result.version, 7)
    fs.writeFileSync(path.join(output, "original-v7.sqlite"), original.bytes)
    const roundResults: any[] = []
    for (const round of [1, 2]) {
      restore(ownDB, original.bytes, runtime.processRoot)
      const pending = ["one", "two"].map((worker) =>
        run(import.meta.path, ["open", mode, `round-${round}-${worker}`], {}, `round-${round}-${worker}`),
      )
      const readyDeadline = Date.now() + 60_000
      while (
        !["one", "two"].every((worker) => fs.existsSync(path.join(output, `round-${round}-${worker}-ready.json`)))
      ) {
        assert(Date.now() < readyDeadline, "both actual upgrade processes reach barrier")
        await Bun.sleep(25)
      }
      for (const worker of ["one", "two"])
        assert.equal(
          JSON.parse(fs.readFileSync(path.join(output, `round-${round}-${worker}-ready.json`), "utf8")).version,
          7,
        )
      fs.writeFileSync(path.join(output, `round-${round}-go`), "both real processes observed original v7\n")
      const codes = await Promise.all(pending)
      for (const code of codes) assert([0, 17].includes(code!), "opener succeeds or exposes actual SQLite busy")
      assert(codes.includes(0), "one actual concurrent migration commits")
      assert.equal(await run(import.meta.path, ["open", mode, `round-${round}-after`], {}, `round-${round}-after`), 0)
      const current = snapshot(ownDB)
      assert.equal(current.result.version, 8)
      const receiptID = process.env.EXPERT_CONTINUATION_RECEIPT_ARTIFACT
      if (receiptID) {
        const originalReport = original.result.tables
          .find((t) => t.name === "engine_artifact")!
          .rows.find((row) => row.id === receiptID)
        assert(originalReport, "selected original successful report exists in genuine v7")
        const canonical = current.result.tables
          .find((t) => t.name === "expert_squad_mutation_receipt")!
          .rows.find((row) => row.artifact_id === receiptID)
        assert.deepEqual(
          canonical && { taskID: canonical.task_id, envelope: canonical.envelope, timeCreated: canonical.time_created },
          {
            taskID: originalReport.task_id,
            envelope: originalReport.payload,
            timeCreated: originalReport.time_created,
          },
          "repeated migration preserves the exact original success bytes/time/source",
        )
      }
      let retained = 0
      for (const table of original.result.tables) {
        const rows = current.result.tables.find((t) => t.name === table.name)!.rows
        for (const row of table.rows) {
          assert(
            rows.some((candidate) =>
              isDeepStrictEqual(Object.fromEntries(Object.keys(row).map((key) => [key, candidate[key]])), row),
            ),
            `${table.name} original columns/rowid retained`,
          )
          retained++
        }
      }
      const backups = fs
        .readdirSync(path.join(path.dirname(ownDB), "migration-backups"))
        .filter((n) => n.endsWith(".sqlite"))
      for (const file of backups)
        assert.deepEqual(snapshot(path.join(path.dirname(ownDB), "migration-backups", file)).result, original.result)
      fs.writeFileSync(path.join(output, `round-${round}-after.sqlite`), current.bytes)
      roundResults.push({
        round,
        codes,
        retainedRows: retained,
        originalTables: original.result.tables.length,
        backups: backups.length,
        receiptArtifactID: receiptID ?? null,
        canonicalReceipts: current.result.tables.find((t) => t.name === "expert_squad_mutation_receipt")!.rows.length,
      })
    }
    fs.writeFileSync(
      path.join(output, "result.json"),
      JSON.stringify({ mode, roundResults, originalSource: source, runtime }, null, 2),
    )
  } else {
    assert(["same-authority", "foreign-authority"].includes(mode))
    const source = path.join(output, "original")
    assert.equal(
      await run(
        path.join(root, "specs/artifacts/2026-10-24-expert-mutation-receipt-recovery/expert-global-journal-probe.ts"),
        ["outer", "retain"],
        {
          EXPERT_AUDIT_OUTPUT_DIRECTORY: source,
          EXPERT_AUDIT_PRESERVE: "1",
          EXPERT_AUDIT_CUT: "after-receipt",
          EXPERT_AUDIT_PRECOMMIT_SNAPSHOT: "1",
        },
        "prepare-original",
      ),
      0,
    )
    const report = JSON.parse(fs.readFileSync(path.join(source, "result.json"), "utf8"))
    const original = report.original
    assert.equal(original.receiptRows.length, 1)
    let replacement: ReturnType<typeof snapshot>
    if (mode === "same-authority") replacement = snapshot(path.join(source, "before-actual-receipt.sqlite"))
    else {
      assert.equal(await run(import.meta.path, ["open", mode, "foreign-create"], {}, "foreign-create"), 0)
      replacement = snapshot(ownDB)
    }
    fs.writeFileSync(path.join(output, "restoration-source.sqlite"), replacement.bytes)
    const committed = snapshot(path.join(source, "committed-before-exit.sqlite"))
    const authority = (s: ReturnType<typeof snapshot>) =>
      s.result.tables.find((t) => t.name === "database_authority")!.rows[0].instance_id
    assert.equal(authority(committed) === authority(replacement), mode === "same-authority")
    const journalBytes = fs.readFileSync(path.join(source, "after-delete-files", "journal.json"))
    for (const round of [1, 2]) {
      restore(original.databasePath, replacement.bytes, report.runtime.processRoot)
      fs.mkdirSync(path.dirname(original.journalPath), { recursive: true })
      fs.writeFileSync(original.journalPath, journalBytes)
      assert.equal(await run(import.meta.path, ["recover", mode, `round-${round}`], {}, `round-${round}`), 0)
    }
    const results = [1, 2].map((n) => JSON.parse(fs.readFileSync(path.join(output, `round-${n}.json`), "utf8")))
    assert.equal(
      results[0].preservation.intent.payload.reason,
      mode === "same-authority" ? "receipt_absent" : "database_authority_mismatch",
    )
    assert.deepEqual(results[0].preservation, results[1].preservation)
    fs.writeFileSync(
      path.join(output, "result.json"),
      JSON.stringify(
        { mode, results, runtime, originalAuthority: authority(committed), restoredAuthority: authority(replacement) },
        null,
        2,
      ),
    )
  }
  console.log(JSON.stringify({ mode, output, passed: true }))
  process.exit(0)
}
const runtime = JSON.parse(fs.readFileSync(path.join(output, "runtime.json"), "utf8"))
const { isolatedTestChildEnvironment } = await load("packages/util/src/test-runtime-environment.ts")
let report: any
if (stage === "recover") report = JSON.parse(fs.readFileSync(path.join(output, "original", "result.json"), "utf8"))
const selected = report?.runtime ?? runtime
Object.assign(process.env, isolatedTestChildEnvironment(selected))
process.env.OPENCORVUS_HOME = selected.runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = selected.processRoot
for (const key of Object.keys(process.env))
  if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key)) delete process.env[key]
const { Database } = await import("@/storage/db")
if (stage === "open") {
  if (mode === "upgrade" && /-(?:one|two)$/.test(label)) {
    const version = snapshot(Database.Path()).result.version
    fs.writeFileSync(path.join(output, `${label}-ready.json`), JSON.stringify({ version, pid: process.pid }, null, 2))
    const deadline = Date.now() + 60_000
    while (!fs.existsSync(path.join(output, label.replace(/-(?:one|two)$/, "-go")))) {
      assert(Date.now() < deadline, "actual upgrade barrier released")
      await Bun.sleep(25)
    }
  }
  try {
    const authority = Database.Identity()
    const actual = snapshot(Database.Path())
    assert.equal(actual.result.version, 8)
    fs.writeFileSync(path.join(output, `${label}.sqlite`), actual.bytes)
    fs.writeFileSync(
      path.join(output, `${label}.json`),
      JSON.stringify({ version: actual.result.version, authority }, null, 2),
    )
    Database.close()
    process.exit(0)
  } catch (error: any) {
    fs.writeFileSync(
      path.join(output, `${label}-error.json`),
      JSON.stringify({ name: error.name, message: error.message, code: error.code, data: error.data }, null, 2),
    )
    if (/SQLITE_(BUSY|LOCKED)/.test(String(error.code ?? error.data?.code ?? error.message))) process.exit(17)
    throw error
  }
}
assert.equal(stage, "recover")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { ExpertSquadRegistry: Registry } = await import("@/expert-squad/registry")
const { digestFilesystemTree } = await load("packages/util/src/durable-publication.ts")
const original = report.original
const journal = JSON.parse(fs.readFileSync(path.join(output, "original", "after-delete-files", "journal.json"), "utf8"))
const outcome = await Manager.reconcileCommittedPackageMutation({
  projectDirectory: original.directory,
  id: original.id,
  installationScope: "global",
})
assert.equal(outcome.disposition, "commit_receipt_unavailable")
const chunks: Buffer[] = []
let offset: number | undefined = 0
while (offset !== undefined) {
  const page = await Manager.inspectMutationRecovery({
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
const preservation = JSON.parse(Buffer.concat(chunks).toString("utf8"))
const resources = preservation.terminal.payload.resources
for (const key of ["target", "backup"])
  assert.equal(
    await digestFilesystemTree(path.join(resources, key)),
    await digestFilesystemTree(path.join(output, "original", "after-delete-files", key)),
  )
assert.equal(
  fs.readFileSync(path.join(resources, "original-journal.json"), "utf8"),
  fs.readFileSync(path.join(output, "original", "after-delete-files", "journal.json"), "utf8"),
)
let subsequent: any
if (label === "round-1")
  subsequent = await Manager.importDirectory({
    projectDirectory: original.directory,
    sourceDirectory: path.join(resources, "backup"),
    installationScope: "global",
    expectedCurrentPackageDigest: (await Registry.loadPackage(original.targetRoot)).packageDigest,
  })
assert.equal((await Registry.loadPackage(original.targetRoot)).manifest.version, "2026.10.24.1")
const receiptCount = Database.allFinalized<any>("SELECT count(*) AS n FROM expert_squad_mutation_receipt")[0].n
assert.equal(receiptCount, 0)
assert.equal(Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n, 0)
fs.writeFileSync(path.join(output, `${label}.sqlite`), snapshot(Database.Path()).bytes)
fs.writeFileSync(
  path.join(output, `${label}.json`),
  JSON.stringify({ outcome, preservation, subsequent, receiptCount, version: "2026.10.24.1" }, null, 2),
)
Database.close()
process.exit(0)
