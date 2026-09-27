/** Single registered read-only review; reuses existing production transport. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"
import { CredentialRedactor, requireProcessProviderAudit } from "../../../packages/opencorvus/script/real-provider-audit"
import nativeProviderAudit from "../../../packages/opencorvus/script/native-provider-audit-plugin"
import { settleEvolutionRuntimeBeforeCredentials } from "../../../packages/opencorvus/script/expert-squad-evolution-e2e-support"
import { latestAuditSnapshotFiles } from "../../../packages/opencorvus/script/audit-snapshot"

const { values } = parseArgs({ args: process.argv.slice(2), options: {
  run: { type: "boolean" }, "prepare-root": { type: "string" }, "auth-source": { type: "string" },
} })
assert(Boolean(values.run) !== Boolean(values["prepare-root"]), "Choose run or credential-free preparation")
assert(values.run ? values["auth-source"] : !values["auth-source"], "Only run accepts its authorized auth source")
const repo = path.resolve(import.meta.dir, "../../..")
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim()
const source = git("rev-parse", "HEAD")
if (values.run) assert.equal(git("status", "--porcelain"), "", "Review requires clean committed source")
const root = values.run ? path.join(repo, ".tmp/supervision-review-g64/review-01") : path.resolve(values["prepare-root"]!)
assert(values.run || root !== path.join(repo, ".tmp/supervision-review-g64/review-01"), "Real root is reserved")
await fs.mkdir(path.dirname(root), { recursive: true })
await fs.mkdir(root)
const redactor = new CredentialRedactor()
const save = async (name: string, value: unknown) => fs.writeFile(path.join(root, name), redactor.redact(JSON.stringify(value, null, 2)) + "\n")
const result: Record<string, any> = { source, mode: values.run ? "run" : "prepare", startedAt: new Date().toISOString(), pid: process.pid,
  model: "openai/gpt-5.6-luna", semanticVerdict: "not_evaluated", requestCeiling: null }
await save("claim.json", result)
let disposeRuntime: (() => Promise<void>) | undefined
let credentialsStarted = false
let failed = false
const home = path.join(root, "home")
const project = path.join(root, "project")
const auditRoot = path.join(root, "provider-audit")
try {
  const packet = JSON.parse(await fs.readFile(path.join(import.meta.dir, "packet.json"), "utf8")) as { files: { path: string; bytes: number; sha256: string }[] }
  const chunks = [await fs.readFile(path.join(import.meta.dir, "request.md"), "utf8")]
  for (const file of packet.files) {
    assert.equal(path.basename(file.path), file.path)
    const bytes = await fs.readFile(path.join(import.meta.dir, file.path))
    assert.equal(bytes.length, file.bytes)
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256)
    chunks.push(`\n<retained-evidence file="${file.path}">\n${bytes.toString("utf8")}\n</retained-evidence>`)
  }
  const text = chunks.join("\n")
  await fs.writeFile(path.join(root, "visible-request.md"), text)
  result.input = packet
  result.visibleRequestBytes = Buffer.byteLength(text)
  for (const dir of [path.join(home, "data"), path.join(home, "config"), project, path.join(root, "managed")]) await fs.mkdir(dir, { recursive: true })
  for (const key of ["OPENCORVUS_CONFIG", "OPENCORVUS_CONFIG_DIR", "OPENCORVUS_CONFIG_CONTENT", "OPENCORVUS_API_KEY", "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENCORVUS_SERVER_PASSWORD", "OPENCORVUS_SERVER_USERNAME", "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY"]) delete process.env[key]
  Object.assign(process.env, { OPENCORVUS_HOME: home, OPENCORVUS_TEST_HOME: home, OPENCORVUS_TEST_PROCESS_ROOT: root,
    OPENCORVUS_TEST_MANAGED_CONFIG_DIR: path.join(root, "managed"), OPENCORVUS_PROJECT_DIR: project, OPENCORVUS_TASK_PROCESS_MODE: "native",
    OPENCORVUS_NATIVE_REAL_PROVIDER: "1", OPENCORVUS_NATIVE_AUDIT_ROOT: auditRoot, OPENCORVUS_NATIVE_AUDIT_MODEL: "gpt-5.6-luna", OPENCORVUS_NATIVE_AUDIT_MAX_REQUESTS: "null" })
  delete process.env.OPENCORVUS_NATIVE_AUDIT_COPIED_OAUTH_EXPIRES
  const plugin = path.join(repo, "packages/opencorvus/script/native-provider-audit-plugin.ts")
  await fs.writeFile(path.join(home, "config/opencorvus.jsonc"), JSON.stringify({ permission_mode: "full_access",
    ...(values.run ? { model: result.model, small_model: result.model, plugin: [pathToFileURL(plugin).href] } : {}), enabled_providers: values.run ? ["openai"] : [] }))
  if (values.run) {
    credentialsStarted = true
    const { stageDiagnosticProvider } = await import("../../../packages/opencorvus/script/evolution-diagnostic-provider")
    const access = await stageDiagnosticProvider({ authSource: path.resolve(values["auth-source"]!), dataDirectory: path.join(home, "data"), modelID: "gpt-5.6-luna", redactor })
    process.env.OPENCORVUS_NATIVE_AUDIT_COPIED_OAUTH_EXPIRES = String(access.copiedOAuthExpiresAt)
    await nativeProviderAudit({ serverUrl: new URL("http://127.0.0.1:0") })
  }
  const [{ listenWithRecoveredServerRuntime, requireRecoveredServerRuntime }, { Instance }, { Database }, { ProviderUsageEventTable }, { Provider }, { SessionStatus },
    { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded },
    { missionFinalReplyState, missionCompletionExecution }] = await Promise.all([
    import("../../../packages/opencorvus/src/cli/server-runtime"), import("../../../packages/opencorvus/src/project/instance"), import("../../../packages/opencorvus/src/storage/db"),
    import("../../../packages/opencorvus/src/usage/usage.sql"), import("../../../packages/opencorvus/src/provider/provider"), import("../../../packages/opencorvus/src/session/status"),
    import("../../../packages/opencorvus/src/engine/host-recovery"),
    import("../../../packages/opencorvus/script/mission-settlement"),
  ])
  const { server } = await requireRecoveredServerRuntime(await listenWithRecoveredServerRuntime({
    options: { hostname: "127.0.0.1", port: 0, randomPort: true },
    recover: async () => { assertStartedTaskProjectRecoverySucceeded(await recoverStartedTaskExecutions()) },
    disposeInstances: () => Instance.disposeAll(),
  }))
  disposeRuntime = async () => {
    await server.stop(true)
    await Instance.disposeAll()
    const rows = Database.use(db => db.select().from(ProviderUsageEventTable).all())
    await save("usage.json", { authority: "original provider_usage_event; not an invoice", rows })
    Database.close()
  }
  const request = async (route: string, body?: unknown, directory?: string) => {
    const url = new URL(route, server.url)
    if (directory) url.searchParams.set("directory", directory)
    const response = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000) })
    assert(response.ok, `Review HTTP ${response.status}: ${route}`)
    return response.json() as Promise<any>
  }
  result.health = await request("/global/health")
  result.outcome = "prepared"
  if (values.run) {
    await nativeProviderAudit({ serverUrl: server.url })
    const { audit } = requireProcessProviderAudit()
    await Instance.provide({ directory: project, fn: async () => assert.equal((await Provider.getModel("openai", "gpt-5.6-luna")).api.id, "gpt-5.6-luna") })
    await fs.writeFile(path.join(root, "launch.json"), JSON.stringify({ ...result, launchedAt: new Date().toISOString() }), { flag: "wx" })
    result.preflight = await audit.preflight({ serverURL: server.url, model: result.model, inactivityMs: 300_000, pollIntervalMs: 2_000, activity: SessionStatus.getActivity })
    await save("preflight.json", result.preflight)
    const chat = await request("/global/chat/start", { requestID: crypto.randomUUID(), text, model: result.model })
    result.chat = chat
    await save("chat.json", chat)
    let signature = ""
    let lastActivity = Date.now()
    for (;;) {
      const messages = await request(`/session/${chat.session.id}/message`, undefined, chat.session.directory) as any[]
      const next = JSON.stringify([messages, SessionStatus.getActivity(chat.session.id)])
      if (next !== signature) { signature = next; lastActivity = Date.now() }
      await save("transcript.json", messages)
      const replies = messages.filter(m => m.info.role === "assistant" && m.info.parentID === chat.messageID)
      const first = replies[0]
      const settlement = missionFinalReplyState({ missionSessionID: chat.session.id, completionMessageID: first?.info.id, completionParentMessageID: chat.messageID,
        execution: missionCompletionExecution(chat.session.id, chat.messageID), messages: messages.map(m => ({ id: m.info.id, sessionID: m.info.sessionID, role: m.info.role,
          parentMessageID: m.info.parentID, completedAtMs: m.info.time.completed, finish: m.info.finish, error: m.info.error })) })
      await save("reply-settlement.json", settlement)
      const snapshots = await Promise.all((await latestAuditSnapshotFiles(auditRoot, "provider")).map(async p => JSON.parse(await fs.readFile(p, "utf8"))))
      assert(!snapshots.some(s => s.requests.some((r: any) => (r.status ?? 0) >= 400)), "Provider request failed; preserve this single review")
      assert.equal(replies.flatMap(m => m.parts).filter(p => p.type === "tool").length, 0, "Read-only review unexpectedly invoked a Tool")
      assert.notEqual(settlement.status, "failed", "Review execution failed")
      if (settlement.status === "settled") {
        result.outcome = "review_settled"
        await fs.writeFile(path.join(root, "review.md"), replies.flatMap(m => m.parts.filter((p: any) => p.type === "text").map((p: any) => p.text)).join("\n\n"))
        break
      }
      assert(Date.now() - lastActivity < 300_000, "Review produced no real activity for 300 seconds")
      assert(!(await fs.stat(path.join(root, "stop")).catch(() => null)), "Review stopped by operator marker")
      await Bun.sleep(2_000)
    }
  }
} catch (error) {
  failed = true
  result.outcome = "failed"
  result.error = redactor.redact(String(error))
} finally {
  try { result.cleanup = await settleEvolutionRuntimeBeforeCredentials({ disposeRuntime,
    removeCredentials: credentialsStarted ? async () => { for (const name of ["auth.json", "models.json"]) await fs.rm(path.join(home, "data", name), { force: true }) } : undefined }) }
  catch (error) { failed = true; result.executionOutcome = result.outcome; result.outcome = "cleanup_failed"; result.cleanupError = redactor.redact(String(error)) }
  result.finishedAt = new Date().toISOString()
  await save("result.json", result)
  console.log(JSON.stringify({ outcome: result.outcome, root, error: result.error, cleanup: result.cleanup }))
  process.exitCode = failed ? 1 : 0
}
