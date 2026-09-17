#!/usr/bin/env bun

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { fileURLToPath, pathToFileURL } from "node:url"
import { setTimeout as sleep } from "node:timers/promises"
import { CredentialRedactor } from "../packages/opencorvus/script/real-provider-audit"
import { latestAuditSnapshotFiles } from "../packages/opencorvus/script/audit-snapshot"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

// Run as a separate process: the SDK launches with this process's environment.
// Only host execution variables cross into the empty, credential-free runtime.
const executable = path.resolve(process.argv[2] ?? "")
if (!process.argv[2] || !(await fs.stat(executable)).isFile()) {
  throw new Error("Usage: bun script/check-packaged-first-run.ts <native-opencorvus-executable>")
}
const realProvider = process.env.OPENCORVUS_NATIVE_REAL_PROVIDER === "1"
const authSource = process.env.OPENCORVUS_NATIVE_AUTH_SOURCE
const model = "openai/gpt-5.6-luna"
const maxRequests = Number(process.env.OPENCORVUS_NATIVE_MAX_REQUESTS ?? "96")
if (realProvider) {
  assert(authSource, "Real native acceptance requires an explicit authorized credential source")
  assert(Number.isSafeInteger(maxRequests) && maxRequests > 0, "Native request budget must be a positive integer")
}
const redactor = new CredentialRedactor()
redactor.collect(process.env)
const auditPlugin = fileURLToPath(new URL("../packages/opencorvus/script/native-provider-audit-plugin.ts", import.meta.url))
const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-first-run-")))
const hostKeys = new Set(["path", "systemroot", "windir", "comspec", "pathext", "lang", "lc_all"])
for (const key of Object.keys(process.env)) {
  if (!hostKeys.has(key.toLowerCase())) delete process.env[key]
}
Object.assign(process.env, {
  HOME: root,
  USERPROFILE: root,
  LOCALAPPDATA: root,
  APPDATA: root,
  TEMP: root,
  TMP: root,
  TMPDIR: root,
  OPENCORVUS_HOME: path.join(root, "runtime"),
  OPENCORVUS_BIN_PATH: executable,
  ...(process.platform === "win32"
    ? { OPENCORVUS_PROCESS_SUPERVISOR: path.join(path.dirname(executable), "opencorvus-process-supervisor.exe") }
    : {}),
})
process.chdir(root)

type Created = { id: string; projectID: string; directory: string; metadata: Record<string, unknown> }
const created: Created[] = []
const auditRoot = path.join(root, "provider-audit")
const resultPath = path.join(root, "result.json")
const result: Record<string, any> = { executable, realProvider, maxRequests: realProvider ? maxRequests : undefined, status: "running", evidenceRoot: root }
let failure: unknown
let taskID: string | undefined
let taskDirectory: string | undefined
async function audits(): Promise<Array<{ pid: number; executable: string; model: string; requests: Array<{ model: string; streaming: boolean; status?: number }>; exhausted: boolean }>> {
  const files = await latestAuditSnapshotFiles(auditRoot, "provider")
  return Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(file, "utf8"))))
}
try {
  const pluginProbes = await Promise.all(["first", "second"].map(async (name) => {
    const entry = path.join(root, `plugin-${name}.mjs`)
    await fs.writeFile(entry, [
      'import fs from "node:fs/promises"',
      'import path from "node:path"',
      `export default async function () { await fs.writeFile(path.join(${JSON.stringify(root)}, ${JSON.stringify(`plugin-${name}-`)} + process.pid + '.json'), JSON.stringify({ name: ${JSON.stringify(name)}, pid: process.pid })); return {} }`,
    ].join("\n"))
    return pathToFileURL(entry).href
  }))
  process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({ plugin: pluginProbes })
  if (realProvider) {
    result.binarySHA256 = createHash("sha256").update(await fs.readFile(executable)).digest("hex")
    result.auditPluginSHA256 = createHash("sha256").update(await fs.readFile(auditPlugin)).digest("hex")
    result.auditHelperSHA256 = createHash("sha256").update(await fs.readFile(path.join(path.dirname(auditPlugin), "real-provider-audit.ts"))).digest("hex")
    result.auditSnapshotHelperSHA256 = createHash("sha256").update(await fs.readFile(path.join(path.dirname(auditPlugin), "audit-snapshot.ts"))).digest("hex")
    const auth = JSON.parse(await fs.readFile(authSource!, "utf8"))
    redactor.collect(auth)
    const modelSource = path.join(path.dirname(authSource!), "models.json")
    const catalog = JSON.parse(await fs.readFile(modelSource, "utf8"))
    assert(catalog.openai?.models?.["gpt-5.6-luna"], "Authorized model catalog entry must be transferred")
    await fs.mkdir(path.join(root, "runtime/data"), { recursive: true })
    await fs.copyFile(authSource!, path.join(root, "runtime/data/auth.json"))
    await fs.copyFile(modelSource, path.join(root, "runtime/data/models.json"))
    Object.assign(process.env, { OPENCORVUS_NATIVE_REAL_PROVIDER: "1", OPENCORVUS_NATIVE_AUDIT_ROOT: auditRoot,
      OPENCORVUS_NATIVE_AUDIT_MODEL: "gpt-5.6-luna", OPENCORVUS_NATIVE_AUDIT_MAX_REQUESTS: String(maxRequests),
      OPENCORVUS_CONFIG_CONTENT: JSON.stringify({ model, small_model: model, permission_mode: "full_access", plugin: [...pluginProbes, pathToFileURL(auditPlugin).href] }) })
    console.log(`[native-real] evidence=${resultPath}`)
  }
  const { createOpenCorvusServer } = await import("../packages/sdk/js/src/server")
  for (let occurrence = 0; occurrence < 2; occurrence++) {
    if (realProvider) process.env.OPENCORVUS_NATIVE_AUDIT_MAX_REQUESTS = String(maxRequests - (await audits()).reduce((sum, entry) => sum + entry.requests.length, 0))
    const server = await createOpenCorvusServer({ hostname: "127.0.0.1", port: 0, timeout: 60_000 })
    result.serverURL = server.url
    try {
      const request = async (route: string, status: number, init?: RequestInit) => {
        const response = await fetch(new URL(route, server.url), {
          ...init,
          signal: AbortSignal.timeout(30_000),
        })
        const body = await response.json()
        assert.equal(response.status, status, `${route}: ${JSON.stringify(body)}`)
        return body
      }
      const config = await request("/global/config", 200)
      assert.deepEqual(config.prompt_profile, { active: "base" })
      for (const prior of created) {
        const stored = await request(`/session/${prior.id}?directory=${encodeURIComponent(prior.directory)}`, 200)
        assert.equal(stored.id, prior.id)
        assert.equal(stored.projectID, prior.projectID)
        assert.deepEqual(stored.metadata, prior.metadata)
      }
      if (realProvider && taskID && taskDirectory) {
        const board = await request(`/task/${taskID}/board?directory=${encodeURIComponent(taskDirectory)}`, 200)
        assert.equal(board.task.status, "completed", "Native Task terminality must survive restart")
        result.taskRestart = "passed"
      }
      for (const experience of ["work", "chat"]) {
        const { session } = await request(`/global/${experience}`, 201, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
        assert.equal(typeof session.id, "string")
        assert.equal(typeof session.projectID, "string")
        assert.deepEqual(session.metadata.conversation, { experience, surface: "right-sidebar" })
        assert.deepEqual(session.metadata.configOverlay.prompt_profile, { active: "base" })
        const relative = path.relative(root, await fs.realpath(session.directory))
        assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Project belongs to test runtime")
        created.push(session)
      }
      const probeNames = await fs.readdir(root)
      const receipts = await Promise.all(probeNames.filter((name) => /^plugin-(first|second)-\d+\.json$/.test(name)).map(async (name) => JSON.parse(await fs.readFile(path.join(root, name), "utf8"))))
      const probeProcesses = [...new Set(receipts.map((receipt) => receipt.pid))]
      assert.equal(probeProcesses.length, occurrence + 1, "Each physical native start must load the local plugins")
      for (const pid of probeProcesses) {
        assert.deepEqual(receipts.filter((receipt) => receipt.pid === pid).map((receipt) => receipt.name).sort(), ["first", "second"], "Both sequentially published native plugin factories must execute")
      }
      result.pluginLoading = { status: "passed", physicalProcesses: probeProcesses.length }
      if (realProvider && occurrence === 0) {
        const providers = await request(`/provider?directory=${encodeURIComponent(created[0]!.directory)}`, 200)
        const projected = providers.all.find((provider: any) => provider.id === "openai")?.models?.["gpt-5.6-luna"]
        assert.equal(projected?.api?.id, "gpt-5.6-luna", "Native Provider must project the exact authorized API model")
        const chat = await request("/global/chat/start", 202, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestID: crypto.randomUUID(), text: "Reply with OK.", model }) })
        let signature = ""
        let lastActivity = Date.now()
        for (;;) {
          const messages = await request(`/session/${chat.session.id}/message?directory=${encodeURIComponent(chat.session.directory)}`, 200)
          const next = JSON.stringify(messages)
          if (next !== signature) { signature = next; lastActivity = Date.now() }
          const assistant = messages.find((item: any) => item.info.role === "assistant" && item.info.parentID === chat.messageID)
          if (assistant?.info.error) throw new Error(`Native preflight: ${JSON.stringify(assistant.info.error)}`)
          if (assistant?.info.time.completed) {
            assert(assistant.parts.some((part: any) => part.type === "text" && part.text.trim()), "Native preflight requires a real persisted reply")
            const observed = await audits()
            assert(observed.some((entry) => path.resolve(entry.executable) === executable && entry.requests.some((request) => request.model === "gpt-5.6-luna" && request.streaming && request.status === 200)), "Native outgoing streaming model request must be observed")
            result.preflight = { status: "passed", sessionID: chat.session.id, model, actualModel: "gpt-5.6-luna", streaming: true }
            break
          }
          if (Date.now() - lastActivity > 180_000) throw new Error("Native preflight meaningful inactivity")
          await sleep(500)
        }
        taskDirectory = created[0]!.directory
        await fs.writeFile(path.join(taskDirectory, "fixture.txt"), "LOCAL-NATIVE-CHECK: 17\n")
        const accepted = await request(`/task?directory=${encodeURIComponent(taskDirectory)}&init-git=true`, 202, { method: "POST", headers: { "content-type": "application/json", "x-opencorvus-request-id": crypto.randomUUID() }, body: JSON.stringify({ title: "Native worker acceptance", request: "Have the appropriate read-only worker directly inspect the local fixture.txt in this Task directory using the read Tool, then report its exact LOCAL-NATIVE-CHECK value. Do not modify files. Read the real worker result and complete this Task.", productPillar: "code", promptProfile: "base", model, source: "native-real-acceptance" }) })
        taskID = accepted.task_id
        result.taskID = taskID
        result.taskDirectory = taskDirectory
        const controller = new AbortController()
        const headerTimer = setTimeout(() => controller.abort(new Error("Native Task event headers transport timeout")), 30_000)
        const events = await fetch(new URL(`/task/${taskID}/events?directory=${encodeURIComponent(taskDirectory)}`, server.url), { signal: controller.signal }).finally(() => clearTimeout(headerTimer))
        assert(events.ok && events.body, "Native Task event stream must open")
        lastActivity = Date.now()
        let streamFailure: unknown
        const consume = (async () => {
          const decoder = new TextDecoder()
          let buffered = ""
          for await (const chunk of events.body!) {
            buffered += decoder.decode(chunk, { stream: true })
            let match = /\r?\n\r?\n/.exec(buffered)
            while (match) {
              const frame = buffered.slice(0, match.index)
              buffered = buffered.slice(match.index + match[0].length)
              for (const line of frame.split(/\r?\n/)) {
                if (!line.startsWith("data:")) continue
                const event = JSON.parse(line.slice(5).trim())
                if (!["task.heartbeat", "task.connected"].includes(event.type) &&
                  (event.type !== "message.part.delta" ||
                    (typeof event.payload?.delta === "string" && event.payload.delta.trim().length > 0))) lastActivity = Date.now()
              }
              match = /\r?\n\r?\n/.exec(buffered)
            }
          }
        })().catch((error) => { if (!controller.signal.aborted) streamFailure = error })
        try {
          for (;;) {
            if (streamFailure) throw streamFailure
            if ((await audits()).some((entry) => entry.exhausted)) throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
            const board = await request(`/task/${taskID}/board?directory=${encodeURIComponent(taskDirectory)}`, 200)
            if (board.task.status === "completed") {
              const lineages = board.artifacts.filter((artifact: any) => artifact.kind === "dispatch_lineage")
              assert(lineages.length > 0, "Native Task requires an actual worker dispatch")
              const workers = []
              const fixtureReads: Array<{ sessionID: string; messageID: string; toolPartID: string }> = []
              for (const lineage of lineages) {
                const settlement = board.artifacts.find((artifact: any) => artifact.kind === "dispatch_settlement" && artifact.payload.dispatch_id === lineage.payload.dispatch_id)
                assert.equal(settlement?.payload?.outcome?.kind, "terminal_success")
                const outcome = settlement.payload.outcome
                const child = await request(`/session/${outcome.session_id}?directory=${encodeURIComponent(taskDirectory)}`, 200)
                const messages = await request(`/session/${child.id}/message?directory=${encodeURIComponent(child.directory)}`, 200)
                const final = messages.find((message: any) => message.info.id === outcome.final_message_id)
                assert(final?.info?.time?.completed && final.info.role === "assistant", "Native worker must have an exact completed final reply")
                for (const message of messages) {
                  for (const part of message.parts) {
                    if (part.type !== "tool" || part.tool !== "read" || part.state.status !== "completed") continue
                    const file = part.state.input?.filePath
                    if (typeof file !== "string" || path.resolve(child.directory, file) !== path.join(taskDirectory!, "fixture.txt")) continue
                    if (typeof part.state.output !== "string" || !/LOCAL-NATIVE-CHECK: 17(?:\r?\n|<|$)/.test(part.state.output)) continue
                    assert(final.parts.some((part: any) => part.type === "text" && /\b17\b/.test(part.text)), "Reading worker final must report the observed exact fixture value")
                    fixtureReads.push({ sessionID: child.id, messageID: message.info.id, toolPartID: part.id })
                  }
                }
                workers.push({ sessionID: child.id, dispatchID: lineage.payload.dispatch_id, adapter: lineage.payload.projected_worker_identity.dispatchAdapterID, finalMessageID: outcome.final_message_id })
              }
              assert(fixtureReads.length > 0, "Native acceptance requires an actual worker read of the exact fixture and its reported value")
              assert.equal(await fs.readFile(path.join(taskDirectory!, "fixture.txt"), "utf8"), "LOCAL-NATIVE-CHECK: 17\n")
              result.fixtureReads = fixtureReads
              result.workers = workers
              result.taskExecution = "passed"
              break
            }
            if (["failed", "cancelled"].includes(board.task.status)) throw new Error(`Native Task reached ${board.task.status}`)
            if (Date.now() - lastActivity > 180_000) throw new Error("Native Task meaningful inactivity")
            await fs.writeFile(resultPath, JSON.stringify({ ...result, audits: await audits() }, null, 2))
            await sleep(500)
          }
        } finally { controller.abort(); await consume }
      }
    } finally {
      await server.close()
    }
  }
  assert.equal(new Set(created.map((session) => session.id)).size, 4)
  assert.equal(new Set(created.map((session) => session.projectID)).size, 4)
  result.status = "passed"
  console.log(JSON.stringify({ firstRun: "passed", sessionsCreated: 4, persistedAcrossRestart: 2, realProvider }))
} catch (error) {
  failure = error
  result.status = "failed"
  result.error = redactor.redact(error instanceof Error ? error.message : String(error))
} finally {
  process.chdir(path.dirname(root))
  if (realProvider) {
    try { redactor.collect(JSON.parse(await fs.readFile(path.join(root, "runtime/data/auth.json"), "utf8"))) } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") { failure ??= error; result.status = "failed" } }
    const cleanupErrors: string[] = []
    for (const name of ["auth.json", "models.json"]) {
      try { await fs.rm(path.join(root, "runtime/data", name), { force: true }) } catch (error) { cleanupErrors.push(String(error)) }
    }
    result.credentialCleanup = cleanupErrors.length ? "failed" : "passed"
    result.cleanupErrors = cleanupErrors
    try { result.audits = await audits() } catch (error) { failure ??= error; result.auditError = String(error); result.audits = null; result.status = "failed" }
    if (result.audits?.some((entry: any) => entry.exhausted)) result.status = "budget_exhausted"
    if (failure) result.error = failure instanceof Error ? failure.message : String(failure)
    if (cleanupErrors.length) result.status = "failed"
    await fs.writeFile(resultPath, redactor.redact(JSON.stringify(result, null, 2)))
    console.log(`[native-real] ${result.status} evidence=${resultPath}`)
    if (result.status !== "passed") process.exitCode = 1
  } else {
    if (failure) {
      result.status = "failed"
      result.error = failure instanceof Error ? failure.message : String(failure)
      await fs.writeFile(resultPath, redactor.redact(JSON.stringify(result, null, 2)))
      console.error(`[native-first-run] failed evidence=${resultPath}`)
      throw failure
    }
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
}
