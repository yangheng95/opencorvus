import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
} from "../../../packages/util/src/test-runtime-environment"
import { prepareTestProcessSupervisor } from "../../../packages/opencorvus/script/prepare-test-process-supervisor"
const stage = process.argv[2] ?? "outer"
const root =
  process.env.JUDGE_RECEIPT_REAPPEARS_ROOT ??
  path.resolve(".tmp-product-iteration/expert-recovery-continuation-audit/judge", `receipt-reappears-${Date.now()}`)
const originalRoot = path.join(root, "original")
fs.mkdirSync(root, { recursive: true })
const write = (name: string, value: unknown) =>
  fs.writeFileSync(path.join(root, `${name}.json`), JSON.stringify(value, null, 2))
function raw(file: string, destination: string) {
  using db = new SQLite(file, { readonly: true, create: false })
  db.exec("PRAGMA query_only=ON;BEGIN")
  const bytes = db.serialize()
  fs.writeFileSync(destination, bytes)
  db.exec("ROLLBACK")
  return bytes
}
function restore(file: string, bytes: Uint8Array, ownedProcessRoot: string) {
  const relative = path.relative(ownedProcessRoot, file)
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative))
  for (const suffix of ["-wal", "-shm"]) fs.rmSync(file + suffix, { force: true })
  fs.writeFileSync(file, bytes)
}
if (stage === "outer") {
  const runtime = await bootstrapIsolatedTestRuntime("runner")
  const helper = prepareTestProcessSupervisor()
  if (helper) process.env.OPENCORVUS_PROCESS_SUPERVISOR = helper
  const { runHostCommandWithInactivity } = await import("@/shell/command-inactivity")
  const environment = { ...isolatedTestChildEnvironment(runtime), JUDGE_RECEIPT_REAPPEARS_ROOT: root }
  for (const key of Object.keys(environment))
    if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key))
      delete environment[key as keyof typeof environment]
  async function run(file: string, args: string[], name: string, extra: NodeJS.ProcessEnv = {}) {
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: ["--tsconfig-override=packages/opencorvus/tsconfig.json", file, ...args],
      cwd: path.resolve(import.meta.dir, "../../.."),
      env: { ...environment, ...extra },
      inactivityTimeoutMs: 120_000,
      onStdout: (text) => process.stdout.write(text),
      onStderr: (text) => process.stderr.write(text),
    })
    fs.writeFileSync(path.join(root, `${name}.log`), result.stdout + result.stderr)
    write(`${name}-exit`, { exit: result.exitCode, settled: result.settlementConfirmed, failure: result.failure })
    assert.equal(result.settlementConfirmed, true)
    assert.equal(result.failure, undefined)
    return result.exitCode
  }
  assert.equal(
    await run(
      path.resolve("specs/artifacts/2026-10-24-expert-mutation-receipt-recovery/expert-global-journal-probe.ts"),
      ["outer", "retain"],
      "prepare",
      {
        EXPERT_AUDIT_OUTPUT_DIRECTORY: originalRoot,
        EXPERT_AUDIT_PRESERVE: "1",
        EXPERT_AUDIT_CUT: "after-receipt",
        EXPERT_AUDIT_PRECOMMIT_SNAPSHOT: "1",
      },
    ),
    0,
  )
  const report = JSON.parse(fs.readFileSync(path.join(originalRoot, "result.json"), "utf8"))
  const before = raw(
    path.join(originalRoot, "before-actual-receipt.sqlite"),
    path.join(root, "restoration-before.sqlite"),
  )
  const committed = raw(
    path.join(originalRoot, "committed-before-exit.sqlite"),
    path.join(root, "restoration-committed.sqlite"),
  )
  restore(report.original.databasePath, before, report.runtime.processRoot)
  assert.equal(await run(import.meta.path, ["cut"], "pending-target-cut"), 24)
  restore(report.original.databasePath, committed, report.runtime.processRoot)
  raw(report.original.databasePath, path.join(root, "after-success-backup-restored.sqlite"))
  assert.equal(await run(import.meta.path, ["resume"], "first-resume"), 0)
  assert.equal(await run(import.meta.path, ["resume-again"], "second-resume"), 0)
  const first = JSON.parse(fs.readFileSync(path.join(root, "resume.json"), "utf8")),
    second = JSON.parse(fs.readFileSync(path.join(root, "resume-again.json"), "utf8"))
  assert.equal(first.canonical, 1)
  assert.equal(first.terminal?.outcome, "committed")
  assert.equal(first.archivedBefore, true)
  assert.equal(first.occurrence.terminal.payload.resourceEvidence.backup.expectedObservationAvailable, true)
  assert.equal(first.currentJournal, false)
  assert.equal(second.outcome.disposition, "none")
  assert.deepEqual(first.occurrence, second.occurrence)
  console.log(
    JSON.stringify({
      root,
      firstOutcome: first.outcome,
      completeArchive: true,
      archivedBefore: true,
      secondOutcome: second.outcome,
    }),
  )
  process.exit(0)
}
const report = JSON.parse(fs.readFileSync(path.join(originalRoot, "result.json"), "utf8"))
Object.assign(process.env, isolatedTestChildEnvironment(report.runtime))
process.env.OPENCORVUS_HOME = report.runtime.runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = report.runtime.processRoot
const original = report.original,
  journalText = fs.readFileSync(path.join(originalRoot, "after-delete-files/journal.json"), "utf8"),
  journal = JSON.parse(journalText)
const { Database } = await import("@/storage/db")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { DurablePublicationStore, setDurablePublicationTestCutHook } = await import(
  "../../../packages/util/src/durable-publication"
)
const configRoot = path.dirname(path.dirname(original.journalPath))
const store = new DurablePublicationStore(
  path.join(configRoot, "durable-publications", "expert-squad-mutations", original.id),
)
const archive = store.occurrenceDirectory("preservation", journal.operationID)
function capture(name: string) {
  raw(Database.Path(), path.join(root, `${name}.sqlite`))
  const directory = path.join(root, `${name}-files`)
  fs.mkdirSync(directory)
  for (const [key, file] of Object.entries({
    target: journal.target,
    backup: journal.backup,
    staging: journal.staging,
    journal: original.journalPath,
    archive,
  })) {
    if (fs.existsSync(file as string))
      fs.cpSync(file as string, path.join(directory, key), {
        recursive: true,
        force: false,
        errorOnExist: true,
        verbatimSymlinks: true,
      })
  }
}
if (stage === "cut") {
  setDurablePublicationTestCutHook((cut, kind) => {
    if (cut !== "phase-published" || kind !== "preservation") return
    const phases = path.join(archive, "phases")
    const facts = fs
      .readdirSync(phases)
      .filter((name) => !name.startsWith(".tmp-"))
      .map((name) => JSON.parse(fs.readFileSync(path.join(phases, name), "utf8")))
    if (!facts.some((fact) => fact.name === "retained-target")) return
    assert(fs.existsSync(journal.backup))
    assert(fs.existsSync(path.join(archive, "resources/target")))
    capture("at-target-cut")
    write("cut", {
      phase: "retained-target",
      canonical: Database.allFinalized("SELECT * FROM expert_squad_mutation_receipt").length,
      journalPresent: fs.existsSync(original.journalPath),
      backupPresent: fs.existsSync(journal.backup),
    })
    process.exit(24)
  })
  await Manager.reconcileCommittedPackageMutation({
    projectDirectory: original.directory,
    id: original.id,
    installationScope: "global",
  })
  throw new Error("Actual retained-target cut not reached")
}
const outcome = await Manager.reconcileCommittedPackageMutation({
  projectDirectory: original.directory,
  id: original.id,
  installationScope: "global",
})
const occurrence = await store.read("preservation", journal.operationID)
capture(stage)
const result = {
  outcome,
  canonical: Database.allFinalized("SELECT * FROM expert_squad_mutation_receipt").length,
  providerRequests: Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n,
  currentJournal: fs.existsSync(original.journalPath),
  backupPresent: fs.existsSync(journal.backup),
  phases: occurrence.phases.map((x) => x.name),
  terminal: occurrence.terminal ?? null,
  archivedBefore: fs.existsSync(path.join(archive, "resources/backup")),
  archivedAfter: fs.existsSync(path.join(archive, "resources/target")),
  occurrence,
}
write(stage, result)
Database.close()
process.exit(0)
