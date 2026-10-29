/** Owns an isolated development server, not Task scheduling or scoring. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { pathToFileURL } from "node:url"
import { parseHeavyWorkbenchRegistration } from "./heavy-workbench-registration"

const { values } = parseArgs({
  options: {
    registration: { type: "string" },
    "auth-source": { type: "string" },
  },
})
assert(values.registration && values["auth-source"], "registration and authorized auth source required")
const registration = parseHeavyWorkbenchRegistration(
  JSON.parse(await fs.readFile(path.resolve(values.registration), "utf8")),
)
const root = path.resolve(registration.runRoot)
const project = path.resolve(registration.project)
assert(project.startsWith(root + path.sep), "owned project must be under run root")
const home = path.join(root, "runtime")
const evidence = path.join(root, "evidence")
await fs.mkdir(home, { recursive: false })
for (const name of ["data", "config"]) await fs.mkdir(path.join(home, name))
await fs.mkdir(evidence, { recursive: false })
for (const key of [
  "OPENCORVUS_CONFIG",
  "OPENCORVUS_CONFIG_DIR",
  "OPENCORVUS_CONFIG_CONTENT",
  "OPENCORVUS_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENCORVUS_SERVER_PASSWORD",
  "OPENCORVUS_SERVER_USERNAME",
  "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY",
])
  delete process.env[key]
process.env.OPENCORVUS_HOME = home
process.env.OPENCORVUS_TEST_HOME = home
process.env.OPENCORVUS_TEST_PROCESS_ROOT = root
process.env.OPENCORVUS_TEST_MANAGED_CONFIG_DIR = path.join(root, "managed")
process.env.OPENCORVUS_PROJECT_DIR = project
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
process.env.OPENCORVUS_NATIVE_REAL_PROVIDER = "1"
process.env.OPENCORVUS_NATIVE_AUDIT_ROOT = path.join(evidence, "provider-audit")
process.env.OPENCORVUS_NATIVE_AUDIT_MODEL = registration.model.split("/")[1]
process.env.OPENCORVUS_NATIVE_AUDIT_MAX_REQUESTS = "null"
const scriptRoot = path.resolve(import.meta.dir, "../../packages/opencorvus/script")
const { CredentialRedactor, requireProcessProviderAudit } = await import(
  path.join(scriptRoot, "real-provider-audit.ts")
)
const { stageDiagnosticProvider } = await import(path.join(scriptRoot, "evolution-diagnostic-provider.ts"))
const { prepareTestProcessSupervisor } = await import(path.join(scriptRoot, "prepare-test-process-supervisor.ts"))
const { settleEvolutionRuntimeBeforeCredentials } = await import(
  path.join(scriptRoot, "expert-squad-evolution-e2e-support.ts")
)
const nativeAudit = (await import(path.join(scriptRoot, "native-provider-audit-plugin.ts"))).default
const redactor = new CredentialRedactor()
const write = async (name: string, value: unknown) =>
  fs.writeFile(path.join(evidence, name), redactor.redact(JSON.stringify(value, null, 2)) + "\n")
const result: Record<string, any> = {
  registration,
  pid: process.pid,
  startedAt: new Date().toISOString(),
  comparable: false,
}
let server: { url: URL; stop(force?: boolean): Promise<void> } | undefined
let dispose: (() => Promise<void>) | undefined
let credentialsStaged = false
let failed = false
try {
  const supervisor = prepareTestProcessSupervisor()
  if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
  credentialsStaged = true
  const access = await stageDiagnosticProvider({
    authSource: path.resolve(values["auth-source"]),
    dataDirectory: path.join(home, "data"),
    modelID: process.env.OPENCORVUS_NATIVE_AUDIT_MODEL!,
    redactor,
  })
  process.env.OPENCORVUS_NATIVE_AUDIT_COPIED_OAUTH_EXPIRES = String(access.copiedOAuthExpiresAt)
  await nativeAudit({ serverUrl: new URL("http://127.0.0.1:0") })
  await fs.writeFile(
    path.join(home, "config/opencorvus.jsonc"),
    JSON.stringify({
      model: registration.model,
      small_model: registration.model,
      enabled_providers: ["openai"],
      permission_mode: "full_access",
      plugin: [pathToFileURL(path.join(scriptRoot, "native-provider-audit-plugin.ts")).href],
    }),
  )
  const sourceRoot = path.resolve(scriptRoot, "../src")
  const [
    { Server },
    { Instance },
    { Provider },
    { SessionStatus },
    { Database },
    { ProcessSupervisor },
    { ProviderUsageEventTable },
    { EngineTaskTable },
    { sessionBelongsToTask },
  ] = await Promise.all([
    import(path.join(sourceRoot, "server/server.ts")),
    import(path.join(sourceRoot, "project/instance.ts")),
    import(path.join(sourceRoot, "provider/provider.ts")),
    import(path.join(sourceRoot, "session/status.ts")),
    import(path.join(sourceRoot, "storage/db.ts")),
    import(path.join(sourceRoot, "shell/process-supervisor.ts")),
    import(path.join(sourceRoot, "usage/usage.sql.ts")),
    import(path.join(sourceRoot, "engine/engine.sql.ts")),
    import(path.join(sourceRoot, "engine/task-session-lineage.ts")),
  ])
  const measureCaseUsage = (rows: any[]) => {
    const tasks = Database.use((db: any) => db.select({ id: EngineTaskTable.id }).from(EngineTaskTable).all())
    const owned = rows.filter(
      (row: any) => row.session_id && tasks.some((task: any) => sessionBelongsToTask(row.session_id, task.id)),
    )
    return {
      taskIDs: tasks.map((task: any) => task.id),
      taskRecordedTokens: owned.reduce((n: number, row: any) => n + row.total_tokens, 0),
      taskUsageEventIDs: owned.map((row: any) => row.id),
      otherSessionTokens: rows
        .filter((row: any) => row.session_id && !owned.includes(row))
        .reduce((n: number, row: any) => n + row.total_tokens, 0),
      unattributedTokens: rows
        .filter((row: any) => !row.session_id)
        .reduce((n: number, row: any) => n + row.total_tokens, 0),
    }
  }
  dispose = async () => {
    await server?.stop(true)
    await Instance.disposeAll()
    await ProcessSupervisor.disposeLiveProcessesUnder(root)
    const rows = Database.use((db: any) => db.select().from(ProviderUsageEventTable).all())
    await write("usage.json", {
      authority: "provider_usage_event",
      rows,
      totalRecordedTokens: rows.reduce((n: number, row: any) => n + row.total_tokens, 0),
      caseAccounting: measureCaseUsage(rows),
      recordedCostUSD:
        rows.length && rows.every((row: any) => row.billing_status === "priced")
          ? rows.reduce((n: number, row: any) => n + row.cost_usd, 0)
          : null,
      coverage: "Recorded usage including preflight; not an external invoice",
    })
    Database.close()
  }
  const listener = await Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true, mdns: false, cors: [] })
  server = listener
  process.env.OPENCORVUS_SERVER_URL = listener.url.toString()
  const { audit } = requireProcessProviderAudit()
  audit.localOrigins.add(listener.url.origin)
  await Instance.provide({
    directory: project,
    fn: async () => {
      const projected = await Provider.getModel("openai", process.env.OPENCORVUS_NATIVE_AUDIT_MODEL!)
      assert.equal(projected.api.id, process.env.OPENCORVUS_NATIVE_AUDIT_MODEL)
      result.projection = { provider: "openai", model: projected.api.id }
    },
  })
  result.preflight = await audit.preflight({
    serverURL: listener.url,
    model: registration.model,
    inactivityMs: registration.inactivitySeconds * 1000,
    pollIntervalMs: 1000,
    activity: SessionStatus.getActivity,
  })
  await write("preflight.json", result.preflight)
  await write("ready.json", {
    url: listener.url.toString(),
    pid: process.pid,
    registration,
    preflight: result.preflight,
  })
  console.log(
    JSON.stringify({
      status: "ready",
      url: listener.url.toString(),
      model: registration.model,
      case: registration.case,
    }),
  )
  while (!(await fs.stat(path.join(root, "stop")).catch(() => null))) {
    await Bun.sleep(1000)
  }
  result.outcome = "owned_server_stop_requested_after_task_settlement"
} catch (error) {
  failed = true
  result.outcome = "infrastructure_error"
  result.error = redactor.redact(error instanceof Error ? `${error.name}: ${error.message}` : String(error))
} finally {
  try {
    result.cleanup = await settleEvolutionRuntimeBeforeCredentials({
      disposeRuntime: dispose,
      removeCredentials: credentialsStaged
        ? async () => {
            for (const name of ["auth.json", "models.json"]) await fs.rm(path.join(home, "data", name), { force: true })
          }
        : undefined,
    })
  } catch (error) {
    failed = true
    result.cleanupError = redactor.redact(String(error))
  }
  result.endedAt = new Date().toISOString()
  await write("server-result.json", result)
  console.log(
    JSON.stringify({
      status: result.outcome,
      cleanup: result.cleanup,
      error: result.error,
      cleanupError: result.cleanupError,
    }),
  )
  process.exitCode = failed ? 1 : 0
}
