import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
} from "../../../packages/util/src/test-runtime-environment"
import { prepareTestProcessSupervisor } from "../../../packages/opencorvus/script/prepare-test-process-supervisor"
const stage = process.argv[2] ?? "outer",
  label = process.argv[3] ?? "current"
const root = path.resolve(
  process.env.JUDGE_KNOWN_ARCHIVE_ROOT ??
    path.join(".tmp-product-iteration/expert-recovery-continuation-audit/judge", `known-archive-${Date.now()}`),
)
const originalRoot = path.join(root, "original")
fs.mkdirSync(root, { recursive: true })
const write = (name: string, value: unknown) =>
  fs.writeFileSync(path.join(root, `${name}.json`), JSON.stringify(value, null, 2))
function snapshot(file: string, destination: string) {
  using db = new SQLite(file, { readonly: true, create: false })
  db.exec("PRAGMA query_only=ON;BEGIN")
  const bytes = db.serialize()
  fs.writeFileSync(destination, bytes)
  db.exec("ROLLBACK")
  return bytes
}
function restore(report: any) {
  const file = report.original.databasePath,
    relative = path.relative(report.runtime.processRoot, file)
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative))
  const bytes = snapshot(
    path.join(originalRoot, "before-actual-receipt.sqlite"),
    path.join(root, `restoration-${label}.sqlite`),
  )
  for (const suffix of ["-wal", "-shm"]) fs.rmSync(file + suffix, { force: true })
  fs.writeFileSync(file, bytes)
}
if (stage === "outer" || stage === "retry-outer") {
  const runtime = await bootstrapIsolatedTestRuntime("runner")
  const helper = prepareTestProcessSupervisor()
  if (helper) process.env.OPENCORVUS_PROCESS_SUPERVISOR = helper
  const { runHostCommandWithInactivity } = await import("@/shell/command-inactivity")
  const environment = { ...isolatedTestChildEnvironment(runtime), JUDGE_KNOWN_ARCHIVE_ROOT: root }
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
    })
    fs.writeFileSync(path.join(root, `${name}.log`), result.stdout + result.stderr)
    write(`${name}-exit`, { exit: result.exitCode, settled: result.settlementConfirmed, failure: result.failure })
    assert.equal(result.settlementConfirmed, true)
    assert.equal(result.failure, undefined)
    assert.equal(result.exitCode, 0)
  }
  if (stage === "outer") {
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
    )
    await run(import.meta.path, ["make-known"], "make-known")
  }
  const report = JSON.parse(fs.readFileSync(path.join(originalRoot, "result.json"), "utf8"))
  restore(report)
  fs.writeFileSync(
    report.original.journalPath,
    fs.readFileSync(path.join(originalRoot, "after-delete-files/journal.json")),
  )
  await run(import.meta.path, ["replay", label], `replay-${label}`)
  const result = JSON.parse(fs.readFileSync(path.join(root, `replay-${label}.json`), "utf8"))
  console.log(
    JSON.stringify({
      root,
      outcome: result.outcome,
      canonicalCount: result.canonicalCount,
      archiveHistoricalDisposition: result.archiveHistoricalDisposition,
      archiveBytesExact: result.archiveBytesExact,
    }),
  )
  assert.equal(result.canonicalCount, 0)
  assert.equal(result.archiveHistoricalDisposition, "committed_revision_changed")
  assert.equal(
    result.outcome.disposition,
    "commit_receipt_unavailable",
    "Current business result must use the restored current canonical authority, while archive keeps its historical observation",
  )
  process.exit(0)
}
const report = JSON.parse(fs.readFileSync(path.join(originalRoot, "result.json"), "utf8")),
  original = report.original
Object.assign(process.env, isolatedTestChildEnvironment(report.runtime))
process.env.OPENCORVUS_HOME = report.runtime.runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = report.runtime.processRoot
const { Database } = await import("@/storage/db")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { ExpertSquadRegistry: Registry } = await import("@/expert-squad/registry")
const { DurablePublicationStore } = await import("../../../packages/util/src/durable-publication")
const journalText = fs.readFileSync(path.join(originalRoot, "after-delete-files/journal.json"), "utf8"),
  journal = JSON.parse(journalText)
const store = new DurablePublicationStore(
  path.join(
    path.dirname(path.dirname(original.journalPath)),
    "durable-publications/expert-squad-mutations",
    original.id,
  ),
)
const target = { projectDirectory: original.directory, id: original.id, installationScope: "global" as const }
function tree(directory: string): Record<string, string> {
  const result: Record<string, string> = {}
  const visit = (file: string) => {
    const stat = fs.lstatSync(file),
      relative = path.relative(directory, file)
    if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(path.join(file, name))
    else
      result[relative] = stat.isSymbolicLink()
        ? `link:${fs.readlinkSync(file)}`
        : fs.readFileSync(file).toString("base64")
  }
  visit(directory)
  return result
}
if (stage === "make-known") {
  const current = await Registry.readInstalledPackageRevision(original.targetRoot)
  const imported = await Manager.importDirectory({
    ...target,
    sourceDirectory: path.join(originalRoot, "after-delete-files/backup"),
    expectedCurrentPackageDigest: current.packageDigest,
  })
  assert.equal(imported.after.version, "2026.10.24.1")
  assert.equal(fs.existsSync(original.journalPath), false)
  fs.writeFileSync(original.journalPath, journalText)
  const outcome = await Manager.reconcileCommittedPackageMutation(target)
  assert.equal(outcome.disposition, "committed_revision_changed")
  const occurrence = await store.read("preservation", journal.operationID)
  assert.equal(occurrence.terminal!.payload.disposition, "committed_revision_changed")
  fs.cpSync(occurrence.directory, path.join(root, "known-archive-before-db-rollback"), {
    recursive: true,
    force: false,
    errorOnExist: true,
  })
  snapshot(Database.Path(), path.join(root, "known-before-db-rollback.sqlite"))
  write("known", {
    outcome,
    occurrence,
    imported,
    canonical: Database.allFinalized("SELECT * FROM expert_squad_mutation_receipt"),
  })
} else {
  snapshot(Database.Path(), path.join(root, `before-replay-${label}.sqlite`))
  const known = JSON.parse(fs.readFileSync(path.join(root, "known.json"), "utf8"))
  const outcome = await Manager.reconcileCommittedPackageMutation(target)
  const occurrence = await store.read("preservation", journal.operationID)
  assert.deepEqual(occurrence, known.occurrence)
  assert.deepEqual(tree(occurrence.directory), tree(path.join(root, "known-archive-before-db-rollback")))
  snapshot(Database.Path(), path.join(root, `after-replay-${label}.sqlite`))
  write(`replay-${label}`, {
    outcome,
    canonicalCount: Database.allFinalized("SELECT * FROM expert_squad_mutation_receipt").length,
    archiveHistoricalDisposition: occurrence.terminal!.payload.disposition,
    archiveBytesExact: true,
    occurrence,
    providerRequests: Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n,
  })
}
Database.close()
process.exit(0)
