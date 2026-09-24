// Experiment host only: the production server owns Tasks; Inspect owns evaluation.
import fs from "node:fs/promises"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import {
  bootstrapIsolatedTestRuntime,
  applyIsolatedTestUserEnvironment,
} from "../../../packages/util/src/test-runtime-environment"
import { prepareTestProcessSupervisor } from "../../../packages/opencorvus/script/prepare-test-process-supervisor"
import { CredentialRedactor, RealProviderAudit } from "../../../packages/opencorvus/script/real-provider-audit"

const evidence = path.resolve(process.env.INSPECT_LUNA_EVIDENCE!)
const authSource = path.resolve(process.env.INSPECT_LUNA_AUTH_SOURCE!)
const model = "openai/gpt-5.6-luna"
const modelID = "gpt-5.6-luna"
const maxRequests = Number(process.env.INSPECT_LUNA_MAX_REQUESTS ?? "600")
if (!Number.isSafeInteger(maxRequests) || maxRequests < 1) throw new Error("Explicit positive request budget required")
const supervisor = prepareTestProcessSupervisor()
const isolated = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(isolated)
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
  permission_mode: "full_access", model, small_model: model,
})
await fs.mkdir(path.join(isolated.runtimeRoot, "data"), { recursive: true })
await fs.copyFile(authSource, path.join(isolated.runtimeRoot, "data/auth.json"))
await fs.copyFile(path.join(path.dirname(authSource), "models.json"), path.join(isolated.runtimeRoot, "data/models.json"))
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile(authSource, "utf8")))
const auditFile = path.join(evidence, "provider-audit.json")
const receiptFile = path.join(evidence, "host.json")
const receipt: Record<string, unknown> = {
  status: "preparing", model, runtimeRoot: isolated.runtimeRoot, processRoot: isolated.processRoot,
  pid: process.pid, maxRequests, startedAt: new Date().toISOString(), source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
}
const save = () => writeFileSync(receiptFile, JSON.stringify(receipt, null, 2))
save()
let audit!: RealProviderAudit
audit = new RealProviderAudit(modelID, maxRequests, () => {
  writeFileSync(auditFile, JSON.stringify({ model, maxRequests, requests: audit.requests, exhausted: audit.exhausted }, null, 2))
})
let shutdown: (() => Promise<unknown>) | undefined
try {
  const [{ Provider }, { Instance }, { SessionStatus }, serverRuntime, recovery, { Database }] = await Promise.all([
    import("../../../packages/opencorvus/src/provider/provider"),
    import("../../../packages/opencorvus/src/project/instance"),
    import("../../../packages/opencorvus/src/session/status"),
    import("../../../packages/opencorvus/src/cli/server-runtime"),
    import("../../../packages/opencorvus/src/engine/host-recovery"),
    import("../../../packages/opencorvus/src/storage/db"),
  ])
  const project = path.join(isolated.processRoot, "preflight")
  await fs.mkdir(project)
  execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
  await Instance.provide({ directory: project, fn: async () => {
    const resolved = await Provider.getModel("openai", modelID)
    if (resolved.api.id !== modelID) throw new Error("Luna actual model projection mismatch")
    receipt.catalog = { providerID: resolved.providerID, modelID: resolved.id, apiModel: resolved.api.id }
    save()
  } })
  const prepared = await serverRuntime.requireRecoveredServerRuntime(
    await serverRuntime.listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => recovery.assertStartedTaskProjectRecoverySucceeded(await recovery.recoverStartedTaskExecutions()),
      disposeInstances: () => Instance.disposeAll(),
    }),
  )
  const server = prepared.server
  shutdown = async () => { await server.stop(true); await Instance.disposeAll(); Database.close() }
  receipt.url = server.url.toString()
  save()
  receipt.preflight = await audit.preflight({
    serverURL: server.url, model, inactivityMs: 180_000, activity: SessionStatus.getActivity,
  })
  receipt.status = "ready"
  save()
  while (!(await fs.stat(path.join(evidence, "stop-host")).catch(() => undefined))) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  receipt.status = "stopped"
} catch (error) {
  receipt.status = "failed"
  receipt.error = redactor.redact(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await shutdown?.()
  audit[Symbol.dispose]()
  for (const file of ["auth.json", "models.json"]) {
    await fs.rm(path.join(isolated.runtimeRoot, "data", file), { force: true })
  }
  receipt.credentialCopiesRemoved = true
  receipt.finishedAt = new Date().toISOString()
  save()
}
process.exit(process.exitCode ?? 0)
