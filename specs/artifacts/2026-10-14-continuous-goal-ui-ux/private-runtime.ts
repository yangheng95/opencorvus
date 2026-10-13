import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { bootstrapIsolatedTestRuntime, applyIsolatedTestUserEnvironment } from "../../../packages/util/src/test-runtime-environment"
import { CredentialRedactor } from "../../../packages/opencorvus/script/real-provider-audit"
import { latestAuditSnapshotFiles } from "../../../packages/opencorvus/script/audit-snapshot"
import { prepareTestProcessSupervisor } from "../../../packages/opencorvus/script/prepare-test-process-supervisor"

// Private development service only. Browser operation and visual review belong to the parent agent.
const repo = path.resolve(import.meta.dir, "../../..")
const runNumber = Number(process.env.GOAL_UI_RUNTIME_RUN ?? "1")
assert(Number.isSafeInteger(runNumber) && runNumber > 0)
const evidenceRoot = path.join(import.meta.dir, `runtime-${runNumber}`)
const sourceModel = "openai/gpt-6.1-sol"
const maxRequests = 96
const inactivityMs = 180_000
const operationMs = 30_000
const authSource = "C:/Users/hengu/AppData/Local/opencorvus/data/auth.json"
const modelsSource = path.join(path.dirname(authSource), "models.json")
const runtime = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(runtime)
const project = path.join(runtime.processRoot, "project")
const authTarget = path.join(runtime.runtimeRoot, "data/auth.json")
const modelsTarget = path.join(runtime.runtimeRoot, "data/models.json")
const redactor = new CredentialRedactor()
const children: Array<ReturnType<typeof start>> = []
let current: ReturnType<typeof start> | undefined
let failure: unknown
let totalPriorRequests = runNumber === 1 ? 0 : JSON.parse(await fs.readFile(path.join(import.meta.dir, `runtime-${runNumber - 1}/result.json`), "utf8")).totalRequests as number
assert(Number.isSafeInteger(totalPriorRequests) && totalPriorRequests >= 0 && totalPriorRequests < maxRequests)
let controlID = ""
let shutdownRequested = false
const manifest = { baseline: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(), sourceModel, actualModel: "gpt-6.1-sol", maxRequests, previousRunRequests: totalPriorRequests, inactivityMs, operationMs, preflightInput: "Reply with OK.", runtimeRoot: runtime.runtimeRoot, databasePath: path.join(runtime.runtimeRoot, "data/opencorvus.db"), project, supervisorPID: process.pid, startedAt: Date.now() }
await fs.mkdir(evidenceRoot, { recursive: false })
const save = (name: string, data: unknown) => fs.writeFile(path.join(evidenceRoot, name), redactor.redact(JSON.stringify(data, null, 2)))
await save("manifest.json", manifest)
process.once("SIGTERM", () => { shutdownRequested = true })
process.once("SIGINT", () => { shutdownRequested = true })

function start() {
  const generation = children.length + 1
  const receipt = path.join(evidenceRoot, `generation-${generation}-startup.json`)
  const auditRoot = path.join(evidenceRoot, `generation-${generation}-audit`)
  const occurrence = crypto.randomUUID()
  const child = Bun.spawn([
    process.execPath, "--preload", path.join(repo, "packages/opencorvus/script/continuous-goal-crash-preload.ts"),
    path.join(repo, "packages/opencorvus/src/index.ts"), "serve", "--hostname", "127.0.0.1", "--port", "0",
    "--project-dir", project, "--startup-receipt", receipt, "--startup-occurrence", occurrence,
  ], { cwd: path.join(repo, "packages/opencorvus"), env: { ...process.env, GOAL_CRASH_ALLOW_REAL_PROVIDER: "1", GOAL_CRASH_MODEL: sourceModel, GOAL_CRASH_AUDIT_ROOT: auditRoot, GOAL_CRASH_REMAINING_REQUESTS: String(maxRequests - totalPriorRequests) }, stdout: "pipe", stderr: "pipe" })
  const read = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder()
    let text = ""
    for await (const chunk of stream) text += decoder.decode(chunk, { stream: true })
    return redactor.redact(text + decoder.decode())
  }
  return { child, generation, receipt, auditRoot, occurrence, startedAt: Date.now(), url: "", stdout: read(child.stdout), stderr: read(child.stderr), settled: false }
}

async function auditAt(server: ReturnType<typeof start>) {
  const files = await latestAuditSnapshotFiles(server.auditRoot, "provider")
  assert(files.length <= 1, "One physical formal server owns its Provider audit")
  return files.length ? JSON.parse(await fs.readFile(files[0]!, "utf8")) : { requests: [], exhausted: false }
}

async function request(server: ReturnType<typeof start>, route: string, body?: unknown, directory = project) {
  const url = new URL(route, server.url)
  url.searchParams.set("directory", directory)
  const response = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(operationMs) })
  assert(response.ok, `${route}: HTTP ${response.status} ${response.ok ? "" : await response.text()}`)
  return await response.json() as any
}

async function ready(server: ReturnType<typeof start>) {
  const deadline = Date.now() + operationMs
  for (;;) {
    assert(server.child.exitCode === null && server.child.signalCode == null, "Formal server remains alive during startup")
    const receipt = await fs.readFile(server.receipt, "utf8").then(JSON.parse).catch(() => undefined)
    if (receipt) {
      assert.equal(receipt.outcome, "listening")
      assert.equal(receipt.pid, server.child.pid)
      assert.equal(receipt.occurrenceID, server.occurrence)
      server.url = receipt.url
      break
    }
    if (Date.now() >= deadline) throw new Error("FORMAL_SERVER_STARTUP_TIMEOUT")
    await Bun.sleep(100)
  }
  const catalog = await request(server, "/provider")
  const projected = catalog.all.find((entry: any) => entry.id === "openai")?.models["gpt-6.1-sol"]
  assert.equal(projected?.api?.id, "gpt-6.1-sol", "Exact target model projection")
  const page = await fetch(new URL("/ui/", server.url), { signal: AbortSignal.timeout(operationMs) })
  assert.equal(page.status, 200)
  assert.match(page.headers.get("content-type") ?? "", /text\/html/)
  await save(`generation-${server.generation}-ui.json`, { url: page.url, status: page.status, contentType: page.headers.get("content-type"), headers: Object.fromEntries([...page.headers].filter(([key]) => key.startsWith("x-opencorvus"))), bodyBytes: Buffer.byteLength(await page.text()), projectedModel: projected.api.id })
}

async function stop(server: ReturnType<typeof start>) {
  if (server.settled) return
  if (server.child.exitCode === null && server.child.signalCode == null) server.child.kill("SIGTERM")
  const exited = await Promise.race([server.child.exited.then(() => true), Bun.sleep(operationMs).then(() => false)])
  if (!exited) {
    server.child.kill("SIGKILL")
    await server.child.exited
  }
  const audit = await auditAt(server)
  totalPriorRequests += audit.requests.length
  await save(`generation-${server.generation}-provider.json`, audit)
  await save(`generation-${server.generation}-exit.json`, { pid: server.child.pid, generation: server.generation, startedAt: server.startedAt, endedAt: Date.now(), exited: true, exitCode: server.child.exitCode, signalCode: server.child.signalCode, forcedCleanup: !exited, requests: audit.requests.length, cumulativeRequests: totalPriorRequests })
  await fs.writeFile(path.join(evidenceRoot, `generation-${server.generation}-stdout.log`), await server.stdout)
  await fs.writeFile(path.join(evidenceRoot, `generation-${server.generation}-stderr.log`), await server.stderr)
  server.settled = true
}

try {
  await fs.mkdir(project)
  for (const args of [["init"], ["config", "user.name", "Goal UI Acceptance"], ["config", "user.email", "goal-ui@example.invalid"], ["commit", "--allow-empty", "-m", "Private UI acceptance project"]]) execFileSync("git", args, { cwd: project, stdio: "ignore" })
  process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
  process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({ model: sourceModel, small_model: sourceModel, permission_mode: "full_access" })
  const supervisor = prepareTestProcessSupervisor()
  if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
  await fs.mkdir(path.dirname(authTarget), { recursive: true })
  redactor.collect(JSON.parse(await fs.readFile(authSource, "utf8")))
  await fs.copyFile(authSource, authTarget)
  await fs.copyFile(modelsSource, modelsTarget)
  current = start()
  children.push(current)
  await ready(current)
  const preflight = await request(current, "/global/chat/start", { requestID: crypto.randomUUID(), model: sourceModel, text: manifest.preflightInput })
  let signature = ""
  let lastActivity = Date.now()
  for (;;) {
    const messages = await request(current, `/session/${preflight.session.id}/message`, undefined, preflight.session.directory)
    const audit = await auditAt(current)
    assert.equal(audit.exhausted, false)
    const next = JSON.stringify({ messages, requests: audit.requests })
    if (next !== signature) { signature = next; lastActivity = Date.now() }
    const reply = messages.find((entry: any) => entry.info.role === "assistant" && entry.info.parentID === preflight.messageID && entry.info.time.completed)
    if (reply?.info.error) throw new Error(`PREFLIGHT_FAILED: ${JSON.stringify(reply.info.error)}`)
    const replyReader = reply && audit.requests.find((entry: any) => entry.response_reader.requestContext?.activity?.assistantMessageID === reply.info.id)
    const pendingReaders = audit.requests.some((entry: any) => ["awaiting_response", "awaiting_binding", "reading"].includes(entry.response_reader.state))
    if (reply?.parts.some((part: any) => part.type === "text" && part.text.trim()) && replyReader?.response_reader.terminal?.kind === "eof" && !pendingReaders) {
      assert(audit.requests.length > 0)
      assert(audit.requests.every((entry: any) => entry.model === "gpt-6.1-sol" && entry.streaming && entry.status === 200))
      await save("preflight.json", { credential: "usable", catalog: "projected", sourceModel, actualModel: "gpt-6.1-sol", streaming: true, requests: audit.requests.length, session: preflight.session, messageID: preflight.messageID, reply, audit })
      break
    }
    if (Date.now() - lastActivity > inactivityMs) throw new Error("PREFLIGHT_INACTIVITY_TIMEOUT")
    await Bun.sleep(500)
  }
  await save("ready.json", { ...manifest, status: "ready", url: new URL("/ui/", current.url).toString(), pid: current.child.pid, generation: current.generation, controlPath: path.join(evidenceRoot, "control.json") })
  console.log(JSON.stringify({ stage: "ready", url: new URL("/ui/", current.url).toString(), pid: current.child.pid, project, evidenceRoot }))
  while (!shutdownRequested) {
    assert(current.child.exitCode === null && current.child.signalCode == null, "Owned development service remains alive")
    const audit = await auditAt(current)
    await save("status.json", { state: "ready", observedAt: Date.now(), generation: current.generation, pid: current.child.pid, url: current.url, totalRequests: totalPriorRequests + audit.requests.length, maxRequests, exhausted: audit.exhausted, pendingReaders: audit.requests.filter((entry: any) => ["awaiting_response", "awaiting_binding", "reading"].includes(entry.response_reader.state)).length })
    if (audit.exhausted) throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
    const control = await fs.readFile(path.join(evidenceRoot, "control.json"), "utf8").then(JSON.parse).catch(() => undefined)
    if (control?.id && control.id !== controlID) {
      assert(["restart", "finish"].includes(control.action), "Explicit owned-runtime control action")
      controlID = control.id
      await save(`control-${controlID}.json`, { ...control, receivedAt: Date.now(), previousGeneration: current.generation })
      if (control.action === "finish") break
      await stop(current)
      assert(totalPriorRequests < maxRequests, "A new generation receives only the remaining cumulative budget")
      current = start()
      children.push(current)
      await ready(current)
      await save("ready.json", { ...manifest, status: "ready", url: new URL("/ui/", current.url).toString(), pid: current.child.pid, generation: current.generation, controlPath: path.join(evidenceRoot, "control.json") })
      console.log(JSON.stringify({ stage: "restarted", generation: current.generation, pid: current.child.pid, url: current.url, cumulativeRequests: totalPriorRequests }))
    }
    await Bun.sleep(2_000)
  }
} catch (error) {
  failure = error
  await save("failure.json", { error: redactor.redact(error instanceof Error ? error.stack ?? error.message : String(error)), at: Date.now() })
  console.error(redactor.redact(String(error)))
} finally {
  const cleanupErrors: string[] = []
  for (const child of children) try { await stop(child) } catch (error) { cleanupErrors.push(redactor.redact(String(error))) }
  const ports = await Promise.all([...new Set(children.map((entry) => entry.url).filter(Boolean))].map(async (url) => ({ url, reachable: await fetch(url, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false) })))
  for (const target of [authTarget, modelsTarget]) try { await fs.rm(target, { force: true }) } catch (error) { cleanupErrors.push(redactor.redact(String(error))) }
  const pairRemoved = (await Promise.all([authTarget, modelsTarget].map((target) => fs.stat(target).then(() => false, () => true)))).every(Boolean)
  await save("settlement.json", { endedAt: Date.now(), totalRequests: totalPriorRequests, processes: children.map((entry) => ({ pid: entry.child.pid, exited: entry.child.exitCode !== null || entry.child.signalCode != null, exitCode: entry.child.exitCode, signalCode: entry.child.signalCode })), ports, credentialPairRemoved: pairRemoved, cleanupErrors })
  await save("result.json", { ...manifest, status: failure ? "failed" : "closed", totalRequests: totalPriorRequests, endedAt: Date.now(), uiAcceptance: "Parent-owned manual visual review; this harness does not automate the UI" })
  if (failure || cleanupErrors.length || !pairRemoved || ports.some((entry) => entry.reachable)) process.exitCode = 1
}
