import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
const [stage = "outer", mode = "concurrent", worker = "main"] = process.argv.slice(2)
const directory = process.env.EXPERT_PRESERVATION_DIRECTORY ?? path.join(import.meta.dir, `expert-preservation-${mode}`)
const source = path.join(directory, "original")
fs.mkdirSync(directory, { recursive: true })
const settings: Record<string, { cut: string; count: number }> = {
  intent: { cut: "occurrence-published", count: 1 },
  target: { cut: "phase-published", count: 2 },
  backup: { cut: "phase-temp-synced", count: 3 },
  terminal: { cut: "terminal-published", count: 1 },
}
if (stage === "outer") {
  assert(!fs.existsSync(path.join(source, "original.json")), "each actual fault has a fresh original runtime")
  async function run(file: string, args: string[], env: NodeJS.ProcessEnv, name: string, expected: number) {
    const child = Bun.spawn(
      [process.execPath, `--tsconfig-override=${path.resolve("packages/opencorvus/tsconfig.json")}`, file, ...args],
      { env, stdout: "pipe", stderr: "pipe" },
    )
    const [exit, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    fs.writeFileSync(path.join(directory, `${name}.log`), stdout + stderr)
    assert.equal(exit, expected, `${name} actual child exit`)
  }
  const env = { ...process.env, EXPERT_PRESERVATION_DIRECTORY: directory }
  await run(
    path.join(import.meta.dir, "expert-global-journal-probe.ts"),
    ["outer", "retain"],
    {
      ...env,
      EXPERT_AUDIT_OUTPUT_DIRECTORY: source,
      EXPERT_AUDIT_PRESERVE: "1",
      EXPERT_AUDIT_CUT:
        mode === "early" ? "after-target-move" : mode === "backup-restore" ? "after-receipt" : "before-receipt",
      ...(mode === "backup-restore" ? { EXPERT_AUDIT_PRECOMMIT_SNAPSHOT: "1" } : {}),
    },
    "prepare",
    0,
  )
  if (mode === "backup-restore") {
    const original = JSON.parse(fs.readFileSync(path.join(source, "original.json"), "utf8"))
    const prepared = JSON.parse(fs.readFileSync(path.join(source, "result.json"), "utf8"))
    assert.equal(original.receiptRows.length, 1)
    assert.equal(prepared.canonical.length, 1)
    assert(path.resolve(original.databasePath).startsWith(path.resolve(prepared.runtime.processRoot) + path.sep))
    let bytes: Uint8Array
    {
      using raw = new SQLite(path.join(source, "before-actual-receipt.sqlite"), { readonly: true, create: false })
      raw.exec("PRAGMA query_only=ON; BEGIN")
      assert.equal((raw.query("SELECT count(*) AS n FROM expert_squad_mutation_receipt").get() as any).n, 0)
      bytes = raw.serialize()
      raw.exec("ROLLBACK")
    }
    for (const suffix of ["-wal", "-shm"]) fs.rmSync(original.databasePath + suffix, { force: true })
    fs.writeFileSync(original.databasePath, bytes)
    fs.writeFileSync(path.join(directory, "restored-before-recovery.sqlite"), bytes)
  }
  if (mode === "symlink") {
    const original = JSON.parse(fs.readFileSync(path.join(source, "original.json"), "utf8"))
    fs.symlinkSync("README.md", path.join(original.targetRoot, "relative-readme.md"), "file")
    assert.equal(fs.readlinkSync(path.join(original.targetRoot, "relative-readme.md")), "README.md")
    fs.cpSync(original.targetRoot, path.join(directory, "drifted-target"), { recursive: true, verbatimSymlinks: true })
  }
  if (mode === "concurrent")
    await Promise.all(
      ["one", "two"].map((name) => run(import.meta.path, ["recover", mode, name], env, `concurrent-${name}`, 0)),
    )
  else if (settings[mode]) {
    await run(import.meta.path, ["crash", mode], env, "preservation-hard-cut", 24)
    await run(import.meta.path, ["recover", mode], env, "after-hard-cut", 0)
  }
  await run(import.meta.path, ["verify", mode], env, "verify-explicit-recovery", 0)
  if (mode === "backup-restore") {
    const actual = JSON.parse(fs.readFileSync(path.join(directory, "result.json"), "utf8"))
    using committed = new SQLite(path.join(source, "committed-before-exit.sqlite"), { readonly: true, create: false })
    using restored = new SQLite(path.join(directory, "restored-before-recovery.sqlite"), {
      readonly: true,
      create: false,
    })
    const identity = (raw: SQLite) =>
      (raw.query("SELECT instance_id FROM database_authority WHERE key='primary'").get() as any).instance_id
    assert.equal(identity(committed), identity(restored))
    assert.equal((committed.query("SELECT count(*) AS n FROM expert_squad_mutation_receipt").get() as any).n, 1)
    assert.equal((restored.query("SELECT count(*) AS n FROM expert_squad_mutation_receipt").get() as any).n, 0)
    assert.equal(actual.preservation.intent.payload.reason, "receipt_absent")
    fs.writeFileSync(
      path.join(directory, "result.json"),
      JSON.stringify(
        {
          ...actual,
          restoredSameAuthority: true,
          historicalActualCanonicalReceipt: 1,
          restoredCanonicalBeforeRecovery: 0,
        },
        null,
        2,
      ),
    )
  }
  console.log(fs.readFileSync(path.join(directory, "result.json"), "utf8"))
  process.exit(0)
}
const report = JSON.parse(fs.readFileSync(path.join(source, "result.json"), "utf8"))
const original = report.original
const { isolatedTestChildEnvironment } = await import("../../../packages/util/src/test-runtime-environment")
Object.assign(process.env, isolatedTestChildEnvironment(report.runtime))
process.env.OPENCORVUS_HOME = report.runtime.runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = report.runtime.processRoot
for (const key of Object.keys(process.env))
  if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key)) delete process.env[key]
const { setDurablePublicationTestCutHook, digestFilesystemTree } = await import(
  "../../../packages/util/src/durable-publication"
)
if (stage === "crash") {
  const setting = settings[mode]!
  let count = 0
  setDurablePublicationTestCutHook((cut, kind) => {
    if (kind === "preservation" && cut === setting.cut && ++count === setting.count) {
      {
        using raw = new SQLite(original.databasePath, { readonly: true, create: false })
        raw.exec("PRAGMA query_only=ON; BEGIN")
        fs.writeFileSync(path.join(directory, "at-preservation-cut.sqlite"), raw.serialize())
        raw.exec("ROLLBACK")
      }
      fs.writeFileSync(
        path.join(directory, "cut.json"),
        JSON.stringify({ cut, kind, count, journalPresent: fs.existsSync(original.journalPath) }, null, 2),
      )
      process.exit(24)
    }
  })
}
const { Database } = await import("@/storage/db")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { ExpertSquadRegistry: Registry } = await import("@/expert-squad/registry")
const journal = JSON.parse(fs.readFileSync(path.join(source, "after-delete-files", "journal.json"), "utf8"))
const outcome = await Manager.reconcileCommittedPackageMutation({
  projectDirectory: original.directory,
  id: original.id,
  installationScope: "global",
})
const list: any = await Manager.inspectMutationRecovery({
  projectDirectory: original.directory,
  id: original.id,
  installationScope: "global",
})
assert.equal(list.entries.length, 1)
assert.equal(list.entries[0].preservation, "complete")
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
  chunks.push(Buffer.from(page.dataBase64, "base64"))
  assert(chunks.at(-1)!.length <= 4096)
  offset = page.nextByteOffset ?? undefined
}
const preservation = JSON.parse(Buffer.concat(chunks).toString("utf8"))
const resources = preservation.terminal.payload.resources
assert.equal(
  preservation.intent.payload.journalText,
  fs.readFileSync(path.join(source, "after-delete-files", "journal.json"), "utf8"),
)
assert.equal(
  fs.readFileSync(path.join(resources, "original-journal.json"), "utf8"),
  preservation.intent.payload.journalText,
)
for (const resource of mode === "early" ? ["backup", "staging"] : ["backup", "target"]) {
  assert.equal(
    await digestFilesystemTree(path.join(resources, resource)),
    await digestFilesystemTree(
      mode === "symlink" && resource === "target"
        ? path.join(directory, "drifted-target")
        : path.join(source, "after-delete-files", resource),
    ),
  )
}
let explicit: any
if (stage === "verify") {
  if (mode === "early") assert.equal(preservation.intent.payload.observations.target.kind, "absent")
  else if (mode === "symlink") {
    assert.equal(fs.readlinkSync(path.join(resources, "target", "relative-readme.md")), "README.md")
    assert.equal(
      fs.readFileSync(path.join(resources, "target", "relative-readme.md"), "utf8"),
      fs.readFileSync(path.join(original.targetRoot, "relative-readme.md"), "utf8"),
    )
    fs.unlinkSync(path.join(original.targetRoot, "relative-readme.md"))
  } else assert.equal((await Registry.loadPackage(original.targetRoot)).manifest.version, "2026.10.24.2")
  explicit = await Manager.importDirectory({
    projectDirectory: original.directory,
    sourceDirectory: path.join(resources, "backup"),
    installationScope: "global",
    ...(mode === "early"
      ? {}
      : { expectedCurrentPackageDigest: (await Registry.loadPackage(original.targetRoot)).packageDigest }),
  })
  assert.equal(explicit.after.version, "2026.10.24.1")
  for (const resource of mode === "early" ? ["backup", "staging"] : ["backup", "target"])
    assert.equal(
      await digestFilesystemTree(path.join(resources, resource)),
      await digestFilesystemTree(
        mode === "symlink" && resource === "target"
          ? path.join(directory, "drifted-target")
          : path.join(source, "after-delete-files", resource),
      ),
    )
  const canonicalRows = Database.allFinalized<any>("SELECT count(*) AS n FROM expert_squad_mutation_receipt")[0].n
  assert.equal(canonicalRows, 0)
  const providerRequests = Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n
  assert.equal(providerRequests, 0)
  {
    using raw = new SQLite(Database.Path(), { readonly: true, create: false })
    raw.exec("PRAGMA query_only=ON; BEGIN")
    fs.writeFileSync(path.join(directory, "final.sqlite"), raw.serialize())
    raw.exec("ROLLBACK")
  }
  fs.writeFileSync(
    path.join(directory, "result.json"),
    JSON.stringify(
      {
        mode,
        outcome,
        preservation,
        explicit,
        canonicalRows,
        providerRequests,
        physicalSnapshotRetained: true,
        ...(mode === "symlink"
          ? {
              driftCorrection:
                "The test driver explicitly removed the added target symlink before a new formal import; archived relative symlink remains exact",
            }
          : {}),
        databasePath: Database.Path(),
      },
      null,
      2,
    ),
  )
}
fs.writeFileSync(
  path.join(directory, `worker-${stage}-${worker}.json`),
  JSON.stringify({ outcome, summaries: list, preservation }, null, 2),
)
Database.close()
process.exit(0)
