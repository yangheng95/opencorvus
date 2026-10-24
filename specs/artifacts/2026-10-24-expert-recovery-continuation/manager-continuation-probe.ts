import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"

const [stage = "outer", mode = "committed"] = process.argv.slice(2)
assert(["committed", "unknown"].includes(mode))
const evidence =
  process.env.CONTINUATION_EVIDENCE ??
  path.resolve(".tmp-product-iteration/expert-recovery-continuation-audit/channel", `${mode}-${Date.now()}`)
const originalDirectory = path.join(evidence, "original")
fs.mkdirSync(evidence, { recursive: true })

function errorFact(value: any): unknown {
  return (
    value && {
      name: value.name,
      message: value.message,
      data: value.data,
      errors: Array.isArray(value.errors) ? value.errors.map(errorFact) : undefined,
    }
  )
}

if (stage === "outer") {
  assert.equal(fs.existsSync(path.join(originalDirectory, "original.json")), false)
  const { bootstrapIsolatedTestRuntime } = await import("../../../packages/util/src/test-runtime-environment")
  await bootstrapIsolatedTestRuntime("test")
  const { prepareTestProcessSupervisor } = await import(
    "../../../packages/opencorvus/script/prepare-test-process-supervisor"
  )
  process.env.OPENCORVUS_PROCESS_SUPERVISOR = prepareTestProcessSupervisor()
  const { runHostCommandWithInactivity } = await import("@/shell/command-inactivity")
  async function run(file: string, args: string[], env: NodeJS.ProcessEnv, label: string) {
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: [`--tsconfig-override=${path.resolve("packages/opencorvus/tsconfig.json")}`, file, ...args],
      cwd: process.cwd(),
      env,
      inactivityTimeoutMs: 180_000,
      deadlineAt: Date.now() + 900_000,
    })
    fs.writeFileSync(path.join(evidence, `${label}.log`), result.stdout + result.stderr)
    fs.writeFileSync(
      path.join(evidence, `${label}-exit.json`),
      JSON.stringify({
        exit: result.exitCode,
        settlementConfirmed: result.settlementConfirmed,
        failure: result.failure,
      }),
    )
    assert.equal(result.settlementConfirmed, true, `${label} actual physical/output settlement`)
    assert.equal(result.failure, undefined, `${label} process contract`)
    assert.equal(result.exitCode, 0, `${label}: see complete original log`)
  }
  const base = { ...process.env, CONTINUATION_EVIDENCE: evidence }
  await run(
    path.resolve("specs/artifacts/2026-10-24-expert-mutation-receipt-recovery/expert-global-journal-probe.ts"),
    ["outer", "retain"],
    {
      ...base,
      EXPERT_AUDIT_OUTPUT_DIRECTORY: originalDirectory,
      EXPERT_AUDIT_PRESERVE: "1",
      EXPERT_AUDIT_CUT: mode === "committed" ? "after-receipt" : "before-receipt",
    },
    "prepare",
  )
  await run(import.meta.path, ["continue", mode], base, "ordinary-import-before-recovery")
  await run(import.meta.path, ["reopen", mode], base, "cold-retry")
  const result = JSON.parse(fs.readFileSync(path.join(evidence, "result.json"), "utf8"))
  assert.deepEqual(
    {
      operation: result.imported?.operation,
      before: result.imported?.before.version,
      after: result.imported?.after.version,
    },
    { operation: "replaced", before: "2026.10.24.2", after: "2026.10.24.1" },
  )
  assert.deepEqual(result.recovery, { disposition: "none" })
  assert.deepEqual(result.coldRetry.recovery, { disposition: "none" })
  assert.equal(result.afterRecovery.version, "2026.10.24.1")
  assert.equal(result.coldRetry.after.version, "2026.10.24.1")
  assert.deepEqual(result.afterRecovery.canonical, result.before.canonical)
  assert.deepEqual(result.coldRetry.after.canonical, result.before.canonical)
  if (mode === "unknown") {
    assert.equal(result.originalAfterPreserved, true)
    assert.equal(result.preservation.terminal.payload.disposition, "commit_receipt_unavailable")
    assert.equal(result.preservation.terminal.payload.resourceEvidence.target.expectedObservationAvailable, true)
  }
  console.log(
    JSON.stringify({
      mode,
      evidence,
      replacement: result.imported?.after.version,
      recovery: result.recovery,
      error: result.recoveryError,
      originalAfterPreserved: result.originalAfterPreserved,
      coldRetry: result.coldRetry.recovery,
      coldError: result.coldRetry.error,
    }),
  )
  process.exit(0)
}

const report = JSON.parse(fs.readFileSync(path.join(originalDirectory, "result.json"), "utf8"))
const original = report.original
const { isolatedTestChildEnvironment } = await import("../../../packages/util/src/test-runtime-environment")
Object.assign(process.env, isolatedTestChildEnvironment(report.runtime))
process.env.OPENCORVUS_HOME = report.runtime.runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = report.runtime.processRoot
for (const key of Object.keys(process.env))
  if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key)) delete process.env[key]
const { Database } = await import("@/storage/db")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { digestFilesystemTree } = await import("../../../packages/util/src/durable-publication")
const call = { projectDirectory: original.directory, id: original.id, installationScope: "global" as const }

async function snapshot(label: string) {
  const folder = path.join(evidence, label)
  fs.mkdirSync(folder, { recursive: true })
  const paths = {
    target: original.targetRoot,
    backup: original.backupPath,
    staging: original.stagingPath,
    journal: original.journalPath,
  }
  const state: Record<string, any> = {}
  for (const [name, source] of Object.entries(paths)) {
    if (!source || !fs.existsSync(source)) {
      state[name] = { kind: "absent" }
      continue
    }
    fs.cpSync(source, path.join(folder, name), {
      recursive: true,
      verbatimSymlinks: true,
      errorOnExist: true,
      force: false,
    })
    state[name] = fs.statSync(source).isDirectory()
      ? { kind: "tree", digest: await digestFilesystemTree(source) }
      : { kind: "file", text: fs.readFileSync(source, "utf8") }
  }
  if (fs.existsSync(original.targetRoot)) {
    state.version = JSON.parse(fs.readFileSync(path.join(original.targetRoot, "expert-squad.jsonc"), "utf8")).version
    state.readme = fs.readFileSync(path.join(original.targetRoot, "README.md"), "utf8")
  }
  state.canonical = Database.allFinalized("SELECT * FROM expert_squad_mutation_receipt")
  state.providerRequests = Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n
  assert.equal(state.providerRequests, 0)
  {
    using raw = new SQLite(Database.Path(), { readonly: true, create: false })
    raw.exec("PRAGMA query_only=ON; BEGIN")
    fs.writeFileSync(path.join(folder, "database.sqlite"), raw.serialize())
    raw.exec("ROLLBACK")
  }
  fs.writeFileSync(path.join(folder, "state.json"), JSON.stringify(state, null, 2))
  return state
}

if (stage === "continue") {
  const before = await snapshot("00-before-ordinary-import")
  assert.equal(before.version, "2026.10.24.2")
  assert.equal(before.journal.kind, "file")
  const journal = JSON.parse(before.journal.text)
  assert.equal(before.canonical.length, mode === "committed" ? 1 : 0)
  let imported: any, importError: any
  try {
    imported = await Manager.importDirectory({
      ...call,
      sourceDirectory: path.join(originalDirectory, "after-delete-files", "backup"),
      expectedCurrentPackageDigest: journal.afterPackageDigest,
    })
  } catch (error) {
    importError = errorFact(error)
  }
  const afterImport = await snapshot("01-after-ordinary-import-before-recovery")
  let recovery: any, recoveryError: any
  try {
    recovery = await Manager.reconcileCommittedPackageMutation(call)
  } catch (error) {
    recoveryError = errorFact(error)
  }
  const afterRecovery = await snapshot("02-after-old-recovery")
  const list = await Manager.inspectMutationRecovery(call)
  const originalTargetDigest = await digestFilesystemTree(path.join(originalDirectory, "after-delete-files", "target"))
  let preservation: any, archivedTargetDigest: string | undefined
  if (list.entries.length) {
    const chunks: Buffer[] = []
    let byteOffset: number | null = 0
    while (byteOffset !== null) {
      const page = (await Manager.inspectMutationRecovery({
        ...call,
        occurrenceID: list.entries[0]!.occurrenceID,
        byteOffset,
      })) as any
      chunks.push(Buffer.from(page.dataBase64, "base64"))
      byteOffset = page.nextByteOffset
    }
    preservation = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    archivedTargetDigest = await digestFilesystemTree(path.join(preservation.terminal.payload.resources, "target"))
  }
  const result = {
    mode,
    evidence,
    runtime: report.runtime,
    before,
    imported,
    importError,
    afterImport,
    recovery,
    recoveryError,
    afterRecovery,
    list,
    preservation,
    originalTargetDigest,
    archivedTargetDigest,
    originalAfterPreserved: archivedTargetDigest === originalTargetDigest,
  }
  fs.writeFileSync(path.join(evidence, "result.json"), JSON.stringify(result, null, 2))
  console.log(
    JSON.stringify({
      mode,
      imported: imported?.after.version,
      importError,
      oldJournalAfterImport: afterImport.journal.kind,
      recovery,
      recoveryError,
      currentVersion: afterRecovery.version,
      originalTargetDigest,
      archivedTargetDigest,
      originalAfterPreserved: result.originalAfterPreserved,
    }),
  )
} else {
  const before = await snapshot("03-cold-retry-before")
  let recovery: any, error: any
  try {
    recovery = await Manager.reconcileCommittedPackageMutation(call)
  } catch (value) {
    error = errorFact(value)
  }
  const after = await snapshot("04-cold-retry-after")
  const result = JSON.parse(fs.readFileSync(path.join(evidence, "result.json"), "utf8"))
  result.coldRetry = { before, recovery, error, after }
  fs.writeFileSync(path.join(evidence, "result.json"), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ mode, recovery, error, currentVersion: after.version }))
}
await Database.awaitEffectIdle(60_000)
Database.close()
process.exit(0)
