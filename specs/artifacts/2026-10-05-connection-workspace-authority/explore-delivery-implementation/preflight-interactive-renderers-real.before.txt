/** Real message-owned renderer qualification; browser review is performed manually.
 * INTERACTIVE_RENDERERS_REAL_ALLOW_REAL_PROVIDER=1, AUTH_SOURCE and
 * MODEL=openai/gpt-6.1-sol are required. RESULT selects the evidence file.
 * After qualification, inspect the returned /ui and create reviewStop to exit.
 */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { bootstrapIsolatedTestRuntime, applyIsolatedTestUserEnvironment } from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"
import { assertCopiedOAuthAccess, CredentialRedactor, RealProviderAudit } from "./real-provider-audit"

const prefix = "INTERACTIVE_RENDERERS_REAL_"
assert.equal(process.env[`${prefix}ALLOW_REAL_PROVIDER`], "1", "Explicit real Provider authorization is required")
const authSource = process.env[`${prefix}AUTH_SOURCE`]
const model = process.env[`${prefix}MODEL`]
assert(authSource, "Canonical paired auth/models source is required")
assert.equal(model, "openai/gpt-6.1-sol")
const resultTarget = process.env[`${prefix}RESULT`]
const supervisor = prepareTestProcessSupervisor()
applyIsolatedTestUserEnvironment(await bootstrapIsolatedTestRuntime("runner"))
const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-renderers-real-"))
const runtime = path.join(root, "home")
const resultPath = resultTarget ? path.resolve(resultTarget) : path.join(root, "result.json")
const reviewStop = path.join(root, "review.stop")
for (const key of ["OPENCORVUS_API_KEY", "OPENCORVUS_CONFIG", "OPENCORVUS_CONFIG_DIR", "OPENCORVUS_DISABLE_PROJECT_CONFIG",
  "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY", "OPENCORVUS_MODELS_PATH", "OPENCORVUS_MODELS_URL", "OPENCORVUS_SERVER_PASSWORD",
  "OPENCORVUS_SERVER_USERNAME", "OPENCORVUS_TEST_MANAGED_CONFIG_DIR"]) delete process.env[key]
Object.assign(process.env, {
  OPENCORVUS_HOME: runtime, OPENCORVUS_TEST_HOME: runtime, OPENCORVUS_TEST_PROCESS_ROOT: root,
  OPENCORVUS_CONFIG_CONTENT: JSON.stringify({ permission_mode: "full_access", model, small_model: model }),
  OPENCORVUS_TASK_PROCESS_MODE: "native",
  ...(supervisor ? { OPENCORVUS_PROCESS_SUPERVISOR: supervisor } : {}),
})
const redactor = new CredentialRedactor()
redactor.collect(process.env)
let audit: RealProviderAudit | undefined
let cleanup: (() => Promise<void>) | undefined
let failure: unknown
const evidence: Record<string, unknown> = { root, pid: process.pid, model, reviewStop, maxRequests: 12, inactivityMs: 180_000 }
const persist = async (status: string) => {
  await fs.mkdir(path.dirname(resultPath), { recursive: true })
  await fs.writeFile(resultPath, redactor.redact(JSON.stringify({ ...evidence, status, requests: audit?.requests ?? [] }, null, 2)))
}
using auditLifetime = new DisposableStack()
try {
  const source = JSON.parse(await fs.readFile(authSource, "utf8"))
  const entry = source.openai
  assert(entry?.generation && entry.info, "Canonical OpenAI generation/info entry is required")
  redactor.collect(entry)
  await fs.mkdir(path.join(runtime, "data"), { recursive: true })
  await fs.writeFile(path.join(runtime, "data/auth.json"), JSON.stringify({ openai: entry }))
  await fs.copyFile(path.join(path.dirname(authSource), "models.json"), path.join(runtime, "data/models.json"))
  const { Auth } = await import("@/auth")
  const credential = await Auth.get("openai")
  assert(credential, "Copied Provider credential is available")
  const authority = credential.type === "oauth" ? { copiedOAuthExpiresAt: credential.expires } : undefined
  if (authority) assertCopiedOAuthAccess(authority.copiedOAuthExpiresAt)
  audit = auditLifetime.use(new RealProviderAudit("gpt-6.1-sol", 12, undefined, authority))
  const [{ Instance }, { Database }, { Provider }, { SessionStatus }, { SessionPromptState }, serverRuntime, recovery, { InteractiveArtifactPayload }] = await Promise.all([
    import("@/project/instance"), import("@/storage/db"), import("@/provider/provider"), import("@/session/status"),
    import("@/session/prompt/state"), import("@/cli/server-runtime"), import("@/engine/host-recovery"), import("@/interactive-artifact/schema"),
  ])
  cleanup = async () => { await Instance.disposeAll(); Database.close() }
  const directory = path.join(root, "projection-project")
  await fs.mkdir(directory, { recursive: true })
  const projected = await Instance.provide({ directory, fn: () => Provider.getModel("openai", "gpt-6.1-sol") })
  assert.equal(projected.api.id, "gpt-6.1-sol")
  evidence.authority = { credential: "available", projectedModel: projected.api.id, pairedModels: true }
  const { server } = await serverRuntime.requireRecoveredServerRuntime(await serverRuntime.listenWithRecoveredServerRuntime({
    options: { hostname: "127.0.0.1", port: 0, randomPort: true },
    recover: async () => { recovery.assertStartedTaskProjectRecoverySucceeded(await recovery.recoverStartedTaskExecutions()) },
    disposeInstances: () => Instance.disposeAll(),
  }))
  cleanup = async () => { await server.stop(true); await Instance.disposeAll(); Database.close() }
  audit.localOrigins.add(server.url.origin)
  evidence.pageURL = new URL("/ui/", server.url).href
  evidence.preflight = await audit.preflight({ serverURL: server.url, model, inactivityMs: 180_000, activity: SessionStatus.getActivity })
  const request = async (route: string, body?: unknown, projectDirectory?: string): Promise<any> => {
    const url = new URL(route, server.url)
    if (projectDirectory) url.searchParams.set("directory", projectDirectory)
    const response = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15_000) })
    const decoded = await response.json()
    assert(response.ok, `${route}: HTTP${response.status} ${JSON.stringify(decoded)}`)
    return decoded
  }
  const chat = await request("/global/chat/start", { requestID: randomUUID(), model, text:
    "请为依赖升级的真实视觉验收发布两个交互产物。通过实际 publish_interactive_artifact 工具分别发布：" +
    "1) diagram@1，标题『依赖升级流程』，Mermaid flowchart LR：基线检查→升级依赖→真实验收；使用中文节点。" +
    "2) timeline@1，标题『验收时间线』，三个 point 项：2026-10-05T01:00:00Z 基线检查、02:00:00Z 升级依赖、03:00:00Z 真实验收。" +
    "均用 schemaVersion 1。完成两次发布后用一句话回复，正常结束本次 Chat。只发布这两个产物，不启动 Task 或 Mission。" })
  evidence.chat = chat
  await persist("running_actual_chat")
  let previous = ""
  let lastActivity = Date.now()
  for (;;) {
    const messages = await request(`/session/${chat.session.id}/message`, undefined, chat.session.directory)
    const status = SessionStatus.getActivity(chat.session.id)
    const execution = SessionStatus.getExecution(chat.session.id, chat.messageID)
    const next = JSON.stringify({ messages, status, execution })
    if (next !== previous) { previous = next; lastActivity = Date.now() }
    assert(!audit.exhausted, "Actual request budget exhausted")
    const assistants = messages.filter((message: any) => message.info.role === "assistant" && message.info.parentID === chat.messageID)
    const error = assistants.find((message: any) => message.info.error)?.info.error
    if (error) throw new Error(`RENDERER_CHAT_ERROR: ${JSON.stringify(error)}`)
    const refs = assistants.flatMap((message: any) => message.parts.filter((part: any) => part.type === "interactive-artifact")
      .map((part: any) => ({ artifactID: part.artifactID, messageID: message.info.id, part })))
    if (assistants.some((message: any) => message.info.time.completed && message.info.finish === "stop") && refs.length >= 2) {
      const owner = SessionPromptState.capturePromptOwner(chat.session.id, chat.session.directory)
      assert(owner, "Persistent Chat retains its physical controller owner")
      assert.equal(SessionStatus.executionOccurrence(chat.session.id)?.inputMessageID, chat.messageID)
      assert.equal(SessionStatus.executionOccurrence(chat.session.id)?.owner, owner)
      for (const assistant of assistants) assert(assistant.info.acceptedInputMessageIDs.includes(chat.messageID), "Reply owns the accepted input")
      await Instance.provide({ directory: chat.session.directory, fn: () =>
        SessionStatus.waitForExecutionSettlement({ sessionID: chat.session.id, inputMessageID: chat.messageID, owner }) })
      const artifacts = await Promise.all(refs.map(async (ref: any) => {
        const artifact = await request(`/session/${chat.session.id}/interactive-artifact/${ref.artifactID}`, undefined, chat.session.directory)
        assert.equal(artifact.messageID, ref.messageID, "Artifact belongs to the actual producing message")
        assert.equal(artifact.sessionID, chat.session.id, "Artifact belongs to the accepted Chat")
        const payload = InteractiveArtifactPayload.parse(artifact.payload)
        return { ...ref, artifact, payload }
      }))
      assert.deepEqual(artifacts.map((item) => item.payload.renderer).sort(), ["diagram@1", "timeline@1"])
      evidence.messages = messages
      evidence.artifacts = artifacts
      evidence.execution = { inputMessageID: chat.messageID, status: SessionStatus.getExecution(chat.session.id, chat.messageID),
        disposition: "reply_settled_persistent_standby" }
      evidence.backendQualification = "passed"
      break
    }
    if (Date.now() - lastActivity > 180_000) throw new Error("RENDERER_CHAT_INACTIVITY")
    await Bun.sleep(500)
  }
  await persist("awaiting_manual_visual_review")
  process.stdout.write(`[renderers] awaiting manual review result=${resultPath}\n`)
  const reviewDeadline = Date.now() + 15 * 60_000
  for (;;) {
    try { await fs.stat(reviewStop); break }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
    if (Date.now() > reviewDeadline) throw new Error("MANUAL_REVIEW_WAIT_EXPIRED")
    await Bun.sleep(500)
  }
  evidence.reviewDisposition = "root_requested_cleanup"
} catch (error) { failure = error }
finally {
  const cleanupErrors: string[] = []
  try { await cleanup?.() } catch (error) { cleanupErrors.push(String(error)) }
  for (const name of ["auth.json", "models.json"]) {
    try { await fs.rm(path.join(runtime, "data", name), { force: true }) } catch (error) { cleanupErrors.push(String(error)) }
  }
  Object.assign(evidence, { credentialCleanup: cleanupErrors.length ? "failed" : "passed", cleanupErrors,
    error: failure instanceof Error ? { name: failure.name, message: failure.message, stack: failure.stack } : failure })
  await persist(failure || cleanupErrors.length ? "failed" : "backend_passed_manual_review_separate")
  process.stdout.write(`[renderers] finished result=${resultPath}\n`)
  if (failure || cleanupErrors.length) process.exitCode = 1
}
