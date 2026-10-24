import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"
import { isDeepStrictEqual } from "node:util"
import { Database as SQLite } from "bun:sqlite"
const [stage = "outer", kind = "question", workerID = "0"] = process.argv.slice(2)
const root =
  process.env.CHANNEL_AUDIT_OUTPUT_DIRECTORY ??
  path.resolve(`.tmp-product-iteration/durable-effect-receipt-audit/channel/v7/concurrent-${kind}`)
const metadataPath = path.join(root, `restart-${kind}.json`)
if (stage === "outer") {
  fs.mkdirSync(root, { recursive: true })
  const { bootstrapIsolatedTestRuntime } = await import("../../../packages/util/src/test-runtime-environment")
  const runtime = await bootstrapIsolatedTestRuntime("test")
  for (const key of Object.keys(process.env))
    if (/(?:API_KEY|BEARER_TOKEN|ACCESS_TOKEN|AWS_PROFILE|AWS_REGION)/.test(key)) delete process.env[key]
  const env = { ...process.env, CHANNEL_AUDIT_OUTPUT_DIRECTORY: root }
  const flags = `--tsconfig-override=${path.resolve("packages/opencorvus/tsconfig.json")}`
  async function child(script: string, args: string[], name: string) {
    const process = Bun.spawn([Bun.which("bun")!, flags, script, ...args], { env, stdout: "pipe", stderr: "pipe" })
    const [code, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])
    fs.writeFileSync(path.join(root, `${name}.log`), stdout + stderr)
    return code
  }
  assert.equal(await child(path.join(import.meta.dir, "channel-restart-v7-probe.ts"), ["create", kind], "create"), 23)
  const initial = await Promise.all(
    [0, 1, 2].map((id) => child(import.meta.path, ["worker", kind, String(id)], `worker-${id}`)),
  )
  assert(
    initial.every((code) => code === 0),
    "all worker processes return their actual result contract",
  )
  const attempts = [0, 1, 2].map((id) => JSON.parse(fs.readFileSync(path.join(root, `worker-${id}.json`), "utf8")))
  for (const attempt of attempts)
    if (attempt.status !== "recovered")
      assert(
        attempt.error.name === "ChannelIngressProcessingError" ||
          attempt.error.data?.code === "SQLITE_BUSY" ||
          attempt.error.data?.code === "SCHEMA_MIGRATION_BUSY" ||
          attempt.error.causeCode === "SQLITE_BUSY",
        "initial contention must have the explicit processing or SQLite busy contract",
      )
  const retries: any[] = []
  for (const attempt of attempts.filter((row) => row.status !== "recovered")) {
    const id = `${attempt.workerID}-retry`
    assert.equal(await child(import.meta.path, ["worker", kind, id], `worker-${id}`), 0)
    const retry = JSON.parse(fs.readFileSync(path.join(root, `worker-${id}.json`), "utf8"))
    assert.equal(
      retry.status,
      "recovered",
      "a fresh process reads the exact terminal receipt after initial contention has settled",
    )
    retries.push(retry)
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"))
  using db = new SQLite(metadata.databasePath, { readonly: true, create: false })
  db.exec("PRAGMA query_only=ON; BEGIN")
  const accepted = db.query("SELECT * FROM channel_ingress_accepted").all()
  const outcomes = db.query("SELECT * FROM channel_ingress_outcome").all() as any[]
  assert.equal(outcomes.length, 1)
  for (const recovered of [...attempts, ...retries].filter((row) => row.status === "recovered"))
    assert(
      isDeepStrictEqual(recovered.response, JSON.parse(outcomes[0].result)),
      "every worker returns the same real terminal receipt",
    )
  assert(
    isDeepStrictEqual(accepted, metadata.before.accepted),
    "concurrent recovery preserves the exact accepted source",
  )
  for (const [key, table] of [
    ["permission", "permission_ledger"],
    ["interactions", "engine_interaction_request"],
    ["interactionOutcomes", "engine_interaction_outcome"],
  ])
    assert(
      isDeepStrictEqual(db.query(`SELECT * FROM ${table}`).all(), metadata.before[key]),
      `original ${key} facts remain exact under concurrency`,
    )
  db.exec("ROLLBACK")
  const result = {
    kind,
    hardExit: 23,
    actualEffectCount: metadata.executions,
    workers: 3,
    initial: attempts,
    retries,
    receiptCount: 1,
    originalAcceptedPreserved: true,
    originalDomainFactsPreserved: true,
    runtime,
  }
  assert.equal(result.actualEffectCount, 1)
  fs.writeFileSync(path.join(root, "result.json"), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
  process.exit(0)
}
const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"))
const { Instance } = await import("@/project/instance")
const { Database } = await import("@/storage/db")
const { ChannelIngress } = await import("@/channel/ingress")
const { EngineService } = await import("@/task-api")
let result: any
try {
  const response = await Instance.provide({
    directory: metadata.directory,
    fn: async () => {
      EngineService.init()
      return ChannelIngress.message(metadata.input)
    },
  })
  result = { workerID, status: "recovered", response }
} catch (error) {
  result = {
    workerID,
    status: "error",
    error: { name: error?.constructor?.name, message: String(error), data: error?.data, causeCode: error?.cause?.code },
  }
}
try {
  await Instance.disposeAll()
  Database.close()
} catch (error) {
  result.cleanupError = String(error)
}
fs.writeFileSync(path.join(root, `worker-${workerID}.json`), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
process.exit(0)
