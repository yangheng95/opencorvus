/** Isolated, auditable localhost host for one AutomationBench trial block. */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs/promises"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { CredentialRedactor, RealProviderAudit, assertCopiedOAuthAccess } from "./real-provider-audit"

const runDirectory = path.resolve(process.env.AUTOMATIONBENCH_FACTORIAL_RUN_DIR ?? "")
const authoritySource = path.resolve(process.env.AUTOMATIONBENCH_FACTORIAL_AUTH_SOURCE ?? "")
const model = process.env.AUTOMATIONBENCH_FACTORIAL_MODEL ?? ""
// Optional predeclared known-text probes. Only their identities and outgoing JSON positions are retained.
const inputProbePath = process.env.AUTOMATIONBENCH_FACTORIAL_INPUT_PROBES
assert(path.isAbsolute(runDirectory) && runDirectory.includes(`${path.sep}.tmp${path.sep}`))
const [providerID, modelID, extra] = model.split("/")
assert.equal(providerID, "openai")
assert(modelID && !extra, "Trial requires one exact openai/<model-id> identity")
assert.equal(path.basename(authoritySource), "auth.json")

const runtimeRoot = path.join(runDirectory, "runtime-root")
const processRoot = runDirectory
const controlProject = path.join(runDirectory, "control-project")
const dataDirectory = path.join(runtimeRoot, "data")
await fs.mkdir(dataDirectory, { recursive: true })
await fs.mkdir(processRoot, { recursive: true })
await fs.mkdir(controlProject, { recursive: true })
execFileSync("git", ["init"], { cwd: controlProject, stdio: "ignore" })

const redactor = new CredentialRedactor()
const authority = JSON.parse(await fs.readFile(authoritySource, "utf8"))
redactor.collect(authority)
const openai = authority.openai?.info
assert.equal(openai?.type, "oauth")
assertCopiedOAuthAccess(openai.expires)
const catalogSource = path.join(path.dirname(authoritySource), "models.json")
const catalog = JSON.parse(await fs.readFile(catalogSource, "utf8"))
assert(catalog.openai?.models?.[modelID], `Model ${modelID} is not projected in the paired catalog`)

for (const key of [
  "OPENCORVUS_API_KEY",
  "OPENCORVUS_CONFIG",
  "OPENCORVUS_CONFIG_DIR",
  "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY",
  "OPENCORVUS_TEST_MANAGED_CONFIG_DIR",
]) delete process.env[key]
process.env.OPENCORVUS_HOME = runtimeRoot
process.env.OPENCORVUS_TEST_HOME = runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = processRoot
process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
  permission_mode: "full_access",
  model,
  small_model: model,
})
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"

let audit: RealProviderAudit | undefined
let server: { url: URL; stop: (force?: boolean) => Promise<void> } | undefined
let stopped = false
const receiptPath = path.join(runDirectory, "host.json")
const auditPath = path.join(runDirectory, "provider-audit.json")
const sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: path.resolve(import.meta.dir, "../../.."),
  encoding: "utf8",
}).trim()

async function receipt(status: "starting" | "running" | "stopped" | "failed", error?: unknown) {
  const safeError = error instanceof Error ? redactor.redact(error.message) : undefined
  await fs.writeFile(receiptPath, JSON.stringify({
    status, model, sourceSHA, runtimeRoot, processRoot, pid: process.pid,
    url: server?.url.toString() ?? null,
    requests: audit?.requests.length ?? 0,
    credentialCopiesRemoved: stopped,
    ...(safeError ? { error: safeError } : {}),
  }, null, 2))
}

try {
  await fs.copyFile(authoritySource, path.join(dataDirectory, "auth.json"))
  await fs.copyFile(catalogSource, path.join(dataDirectory, "models.json"))
  await receipt("starting")
  audit = new RealProviderAudit(
    modelID,
    Number.MAX_SAFE_INTEGER,
    () => writeFileSync(auditPath, JSON.stringify({ model, requests: audit?.requests ?? [],
      ...(inputProbePath ? { inputEvidenceEnabled: true } : {}) }, null, 2)),
    { copiedOAuthExpiresAt: openai.expires },
    inputProbePath ? { probes: JSON.parse(await fs.readFile(inputProbePath, "utf8")), redactor } : undefined,
  )
  const [
    { listenWithRecoveredServerRuntime, requireRecoveredServerRuntime },
    { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded },
    { Instance },
    { Provider },
    { SessionStatus },
  ] = await Promise.all([
    import("@/cli/server-runtime"),
    import("@/engine/host-recovery"),
    import("@/project/instance"),
    import("@/provider/provider"),
    import("@/session/status"),
  ])
  await Instance.provide({ directory: controlProject, fn: async () => {
    const projected = await Provider.getModel("openai", modelID)
    assert.equal(projected.api.id, modelID)
  } })
  const prepared = await requireRecoveredServerRuntime(await listenWithRecoveredServerRuntime({
    options: { hostname: "127.0.0.1", port: 0, randomPort: true },
    recover: async () => {
      assertStartedTaskProjectRecoverySucceeded(await recoverStartedTaskExecutions())
    },
    disposeInstances: () => Instance.disposeAll(),
  }))
  server = prepared.server
  audit.localOrigins.add(server.url.origin)
  const preflight = await audit.preflight({
    serverURL: server.url,
    model,
    inactivityMs: 60_000,
    activity: SessionStatus.getActivity,
  })
  await fs.writeFile(path.join(runDirectory, "preflight.json"), JSON.stringify(preflight, null, 2))
  await receipt("running")
  while (!(await fs.stat(path.join(runDirectory, "stop-host")).catch(() => undefined))) {
    await Bun.sleep(1000)
  }
  await server.stop(true)
  await Instance.disposeAll()
  server = undefined
  stopped = true
  await receipt("stopped")
} catch (error) {
  if (server) await server.stop(true).catch(() => undefined)
  stopped = true
  await receipt("failed", error)
  process.exitCode = 1
} finally {
  audit?.[Symbol.dispose]()
  for (const name of ["auth.json", "models.json"]) {
    await fs.rm(path.join(dataDirectory, name), { force: true })
  }
  stopped = true
  const state = JSON.parse(await fs.readFile(receiptPath, "utf8"))
  await fs.writeFile(receiptPath, JSON.stringify({ ...state, credentialCopiesRemoved: true }, null, 2))
}
