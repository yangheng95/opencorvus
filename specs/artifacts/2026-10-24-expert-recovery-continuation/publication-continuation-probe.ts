import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"

const [stage = "outer", mode = "pending", actor = "main"] = process.argv.slice(2)
assert(["pending", "terminal", "backup", "target"].includes(mode))
const root =
  process.env.PUBLICATION_CONTINUATION_ROOT ??
  path.resolve(".tmp-product-iteration/expert-recovery-continuation-audit/publication", `${mode}-${Date.now()}`)
const originalRoot = path.join(root, "original")
fs.mkdirSync(root, { recursive: true })
function record(event: string, detail: unknown = {}) {
  fs.appendFileSync(
    path.join(root, `events-${stage}-${actor}.jsonl`),
    JSON.stringify({ event, time: Date.now(), pid: process.pid, detail }) + "\n",
  )
}
function rawSnapshot(file: string, label: string) {
  using raw = new SQLite(file, { readonly: true, create: false })
  raw.exec("PRAGMA query_only=ON; BEGIN")
  fs.writeFileSync(path.join(root, `${label}.sqlite`), raw.serialize())
  raw.exec("ROLLBACK")
}
async function waitFor(file: string, timeout = 45000) {
  const deadline = Date.now() + timeout
  while (!fs.existsSync(file)) {
    assert(Date.now() < deadline, `bounded control marker timeout: ${path.basename(file)}`)
    await Bun.sleep(25)
  }
}
if (stage === "outer") {
  assert.equal(fs.existsSync(path.join(originalRoot, "original.json")), false, "fresh original runtime")
  const { bootstrapIsolatedTestRuntime, isolatedTestChildEnvironment } = await import(
    "../../../packages/util/src/test-runtime-environment"
  )
  const runtime = await bootstrapIsolatedTestRuntime("test")
  fs.writeFileSync(path.join(root, "runtime.json"), JSON.stringify(runtime, null, 2))
  const { prepareTestProcessSupervisor } = await import(
    "../../../packages/opencorvus/script/prepare-test-process-supervisor"
  )
  process.env.OPENCORVUS_PROCESS_SUPERVISOR = prepareTestProcessSupervisor()
  const { runHostCommandWithInactivity } = await import("../../../packages/opencorvus/src/shell/command-inactivity")
  const base = { ...isolatedTestChildEnvironment(runtime), PUBLICATION_CONTINUATION_ROOT: root }
  for (const key of Object.keys(base))
    if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key)) delete base[key]
  async function run(file: string, args: string[], name: string, extra: NodeJS.ProcessEnv = {}) {
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: [`--tsconfig-override=${path.resolve("packages/opencorvus/tsconfig.json")}`, file, ...args],
      cwd: process.cwd(),
      env: { ...base, ...extra },
      inactivityTimeoutMs: 180_000,
      deadlineAt: Date.now() + 900_000,
    })
    fs.writeFileSync(path.join(root, `${name}.stdout.log`), result.stdout)
    fs.writeFileSync(path.join(root, `${name}.stderr.log`), result.stderr)
    fs.writeFileSync(
      path.join(root, `${name}.exit.json`),
      JSON.stringify({
        exit: result.exitCode,
        settlementConfirmed: result.settlementConfirmed,
        failure: result.failure,
      }),
    )
    assert.equal(result.settlementConfirmed, true, `${name} actual physical/output settlement`)
    assert.equal(result.failure, undefined, `${name} process contract`)
    return result.exitCode
  }
  const prepare = await run(
    path.resolve("specs/artifacts/2026-10-24-expert-mutation-receipt-recovery/expert-global-journal-probe.ts"),
    ["outer", "retain"],
    "prepare",
    {
      EXPERT_AUDIT_OUTPUT_DIRECTORY: originalRoot,
      EXPERT_AUDIT_PRESERVE: "1",
      EXPERT_AUDIT_CUT: "before-receipt",
    },
  )
  assert.equal(prepare, 0, "mature actual Manager producer")
  assert.equal(await run(import.meta.path, ["cut", mode], "hard-cut"), 24)
  const report = JSON.parse(fs.readFileSync(path.join(originalRoot, "result.json"), "utf8"))
  if (mode === "target") {
    const journal = JSON.parse(fs.readFileSync(path.join(originalRoot, "after-delete-files", "journal.json"), "utf8"))
    const observedBackup = path.resolve(process.env.PUBLICATION_CURRENT_TARGET_BACKUP!)
    const relative = path.relative(path.resolve(report.runtime.processRoot), path.resolve(journal.target))
    assert(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
      "restore only the exact isolated target",
    )
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(observedBackup, "expert-squad.jsonc"), "utf8")).version,
      "2026.10.24.3",
    )
    fs.cpSync(observedBackup, path.join(root, "actual-newer-target-backup"), {
      recursive: true,
      verbatimSymlinks: true,
      force: false,
      errorOnExist: true,
    })
    fs.renameSync(journal.target, path.join(report.runtime.processRoot, "target-before-backup-restore"))
    fs.cpSync(observedBackup, journal.target, {
      recursive: true,
      verbatimSymlinks: true,
      force: false,
      errorOnExist: true,
    })
    fs.writeFileSync(
      path.join(root, "target-backup-restore.json"),
      JSON.stringify(
        { actualBackupSource: observedBackup, target: journal.target, rawSourceWasActualManagerVersion3: true },
        null,
        2,
      ),
    )
    const recovered = await run(import.meta.path, ["recover", mode, "after-restoration"], "restored-target-recover")
    fs.writeFileSync(path.join(root, "restored-target-exit.json"), JSON.stringify({ exit: recovered }))
  } else if (mode === "backup") {
    // Restore the actual same-authority database saved before preservation,
    // leaving the independently persisted files exactly at the physical cut.
    let bytes: Uint8Array
    {
      using saved = new SQLite(path.join(originalRoot, "after-delete-before-reconcile.sqlite"), {
        readonly: true,
        create: false,
      })
      saved.exec("PRAGMA query_only=ON; BEGIN")
      bytes = saved.serialize()
      saved.exec("ROLLBACK")
    }
    for (const suffix of ["-wal", "-shm"]) fs.rmSync(report.original.databasePath + suffix, { force: true })
    fs.writeFileSync(report.original.databasePath, bytes)
    fs.writeFileSync(path.join(root, "restored-before-recovery.sqlite"), bytes)
    assert.equal(await run(import.meta.path, ["recover", mode, "first"], "restored-first-recover"), 0)
    assert.equal(await run(import.meta.path, ["recover", mode, "second"], "restored-second-recover"), 0)
  } else {
    const installing = run(import.meta.path, ["import", mode], "new-import")
    await waitFor(path.join(root, "new-target-installed.json"))
    const recovering = ["one", "two"].map((name) =>
      run(import.meta.path, ["recover", mode, name], `old-recovery-${name}`),
    )
    await waitFor(path.join(root, "recovery-one-started"))
    await waitFor(path.join(root, "recovery-two-started"))
    // Both real recoverers have entered the public API while the publisher's
    // original TestHook is still inside the actual installation owner.
    await Bun.sleep(150)
    fs.writeFileSync(path.join(root, "release-new-publisher"), "release\n")
    assert.equal(await installing, 0)
    const exits = await Promise.all(recovering)
    fs.writeFileSync(path.join(root, "recoverer-exits.json"), JSON.stringify(exits))
    assert.deepEqual(exits, [0, 0], "both real recoverers complete the exact operation")
  }
  assert.equal(await run(import.meta.path, ["inspect", mode], "final-inspect"), 0)
  assert.equal(
    await run(
      path.join(import.meta.dir, "publication-evidence-check.ts"),
      [path.basename(root)],
      "public-evidence-check",
      {
        PUBLICATION_EVIDENCE_ROOT: path.dirname(root),
        PUBLICATION_CHECK_OUTPUT: path.join(root, "public-evidence-result.json"),
      },
    ),
    0,
    "the real checker verifies original rows, file trees, receipts and process settlements",
  )
  const final = JSON.parse(fs.readFileSync(path.join(root, "final.json"), "utf8"))
  console.log(
    JSON.stringify({
      root,
      mode,
      prepare,
      hardCut: 24,
      currentVersion: final.version,
      archiveDisposition: final.occurrence.terminal.payload.disposition,
      phases: final.occurrence.phases.length,
      originalRowsAndTreesVerified: true,
    }),
  )
  process.exit(0)
}

const report = JSON.parse(fs.readFileSync(path.join(originalRoot, "result.json"), "utf8"))
const original = report.original
const { isolatedTestChildEnvironment } = await import("../../../packages/util/src/test-runtime-environment")
Object.assign(process.env, isolatedTestChildEnvironment(report.runtime))
process.env.OPENCORVUS_HOME = report.runtime.runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = report.runtime.processRoot
for (const key of Object.keys(process.env))
  if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key)) delete process.env[key]
const journalText = fs.readFileSync(path.join(originalRoot, "after-delete-files", "journal.json"), "utf8")
const journal = JSON.parse(journalText)
const { setDurablePublicationTestCutHook, DurablePublicationStore, digestFilesystemTree } = await import(
  "../../../packages/util/src/durable-publication"
)
const configRoot = path.dirname(path.dirname(original.journalPath))
const store = new DurablePublicationStore(
  path.join(configRoot, "durable-publications", "expert-squad-mutations", original.id),
)
const archive = store.occurrenceDirectory("preservation", journal.operationID)
function saveFiles(label: string) {
  const destination = path.join(root, label)
  fs.mkdirSync(destination, { recursive: true })
  for (const [key, file] of Object.entries({
    target: journal.target,
    backup: journal.backup,
    staging: journal.staging,
    discard: journal.discard,
    currentJournal: original.journalPath,
    archive,
  })) {
    if (fs.existsSync(file as string))
      fs.cpSync(file as string, path.join(destination, key), {
        recursive: true,
        verbatimSymlinks: true,
        errorOnExist: true,
        force: false,
      })
  }
}
if (stage === "cut") {
  let count = 0
  const setting =
    mode === "pending"
      ? { name: "phase-published", count: 1 }
      : mode === "terminal"
        ? { name: "terminal-published", count: 1 }
        : { name: "phase-temp-synced", count: 1 }
  setDurablePublicationTestCutHook((cut, kind) => {
    if (kind !== "preservation" || cut !== setting.name) return
    if (mode === "backup" || mode === "target") {
      const phases = path.join(archive, "phases")
      if (
        !fs.existsSync(phases) ||
        !fs
          .readdirSync(phases)
          .some(
            (name) =>
              name.startsWith(".tmp-") && name.includes(mode === "backup" ? "retained-backup" : "retained-target"),
          )
      )
        return
    }
    if (++count !== setting.count) return
    record("physical-cut", { cut, kind, count })
    rawSnapshot(original.databasePath, "at-cut")
    saveFiles("at-cut-files")
    process.exit(24)
  })
}
const { Database } = await import("@/storage/db")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { ExpertSquadRegistry: Registry } = await import("@/expert-squad/registry")
if (stage === "import") {
  const { writeExpertSquadPackage } = await import("@opencorvus-ai/sdk/expert-squad-authoring")
  const fresh = path.join(root, "source-version3", journal.namespace, original.id)
  const manifest = JSON.parse(fs.readFileSync(path.join(journal.target, "expert-squad.jsonc"), "utf8"))
  manifest.version = "2026.10.24.3"
  await writeExpertSquadPackage({
    directory: fresh,
    definition: {
      manifest,
      files: {
        "README.md": "# Actual new explicit version 3\n",
        "selector.md": "# Isolated audit selector\n",
        "agents/audit-worker/system.md": "# Actual new explicit version 3 instructions\n",
      },
    },
  })
  Manager.TestHooks.afterTargetInstallBeforeReceiptOnce(async () => {
    record("publisher-target-installed-under-owner")
    fs.writeFileSync(
      path.join(root, "new-target-installed.json"),
      JSON.stringify({
        version: JSON.parse(fs.readFileSync(path.join(journal.target, "expert-squad.jsonc"), "utf8")).version,
        archiveExists: fs.existsSync(archive),
        journalText: fs.existsSync(original.journalPath) ? fs.readFileSync(original.journalPath, "utf8") : null,
      }),
    )
    rawSnapshot(original.databasePath, "during-new-publication")
    saveFiles("during-new-publication-files")
    await waitFor(path.join(root, "release-new-publisher"))
  })
  record("publisher-api-enter")
  const receipt = await Manager.importDirectory({
    projectDirectory: original.directory,
    installationScope: "global",
    sourceDirectory: fresh,
    expectedCurrentPackageDigest: journal.afterPackageDigest,
  })
  record("publisher-api-success", receipt)
  fs.writeFileSync(path.join(root, "new-import-receipt.json"), JSON.stringify(receipt, null, 2))
} else if (stage === "recover" || stage === "cut") {
  record("recover-api-enter")
  fs.writeFileSync(path.join(root, `recovery-${actor}-started`), "started\n")
  rawSnapshot(original.databasePath, `before-open-${stage}-${actor}`)
  try {
    const outcome = await Manager.reconcileCommittedPackageMutation({
      projectDirectory: original.directory,
      id: original.id,
      installationScope: "global",
    })
    record("recover-api-success", outcome)
    fs.writeFileSync(
      path.join(root, `recovery-${actor}.json`),
      JSON.stringify(
        {
          outcome,
          schemaVersion: Database.allFinalized<any>("PRAGMA user_version")[0].user_version,
          authority: Database.Identity(),
          occurrence: await store.read("preservation", journal.operationID),
        },
        null,
        2,
      ),
    )
    saveFiles(`after-recovery-${actor}-files`)
    rawSnapshot(original.databasePath, `after-recovery-${actor}`)
  } catch (error: any) {
    record("recover-api-error", { name: error.name, message: error.message })
    fs.writeFileSync(
      path.join(root, `recovery-${actor}-error.json`),
      JSON.stringify({ name: error.name, message: error.message, stack: error.stack }, null, 2),
    )
    saveFiles(`after-recovery-${actor}-error-files`)
    rawSnapshot(original.databasePath, `after-recovery-${actor}-error`)
    Database.close()
    process.exit(1)
  }
} else if (stage === "inspect") {
  const occurrence = await store.read("preservation", journal.operationID)
  const currentJournal = fs.existsSync(original.journalPath) ? fs.readFileSync(original.journalPath, "utf8") : null
  const version = fs.existsSync(journal.target) ? (await Registry.loadPackage(journal.target)).manifest.version : null
  const resources = path.join(archive, "resources")
  const observed: Record<string, unknown> = {}
  for (const key of ["target", "backup", "staging", "discard"]) {
    const file = path.join(resources, key)
    if (fs.existsSync(file))
      observed[key] = {
        treeDigest: await digestFilesystemTree(file),
        version: fs.existsSync(path.join(file, "expert-squad.jsonc"))
          ? JSON.parse(fs.readFileSync(path.join(file, "expert-squad.jsonc"), "utf8")).version
          : null,
      }
  }
  const result = {
    version,
    currentJournal,
    occurrence,
    archived: observed,
    schemaVersion: Database.allFinalized<any>("PRAGMA user_version")[0].user_version,
    authority: Database.Identity(),
    providerRequests: Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n,
    canonicalReceipts: Database.allFinalized<any>("SELECT count(*) AS n FROM expert_squad_mutation_receipt")[0].n,
  }
  assert.equal(result.providerRequests, 0)
  saveFiles("final-files")
  rawSnapshot(original.databasePath, "final")
  fs.writeFileSync(path.join(root, "final.json"), JSON.stringify(result, null, 2))
}
Database.close()
process.exit(0)
