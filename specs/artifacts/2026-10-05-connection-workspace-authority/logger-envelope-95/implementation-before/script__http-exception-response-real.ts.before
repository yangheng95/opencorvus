/** Actual isolated HTTP authentication/error-response qualification.
 * HTTP_EXCEPTION_RESPONSE_RESULT selects a new immutable evidence file.
 * HTTP_EXCEPTION_RESPONSE_BINARY explicitly selects an absolute compiled server and adjacent helper;
 * omitted input runs the source entrypoint. Packaged Windows mode verifies both actual executable identities.
 * HTTP_EXCEPTION_RESPONSE_STARTUP_TIMEOUT_MS bounds startup (1..120000; default 35000).
 * Only fresh in-memory local Basic Auth credentials are used; no Provider/model access.
 */
import fs from "node:fs/promises"
import { openSync, closeSync, writeSync } from "node:fs"
import path from "node:path"
import net from "node:net"
import { setTimeout as delay } from "node:timers/promises"
import assert from "node:assert/strict"
import { NodeProcess } from "@opencorvus-ai/util/process-node"
import type { ProcessByteSource, ProcessHandle, ProcessTerminalReceipt } from "@opencorvus-ai/util/process"
import {
  bootstrapIsolatedTestRuntime,
  applyIsolatedTestUserEnvironment,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

const resultPath = path.resolve(process.env.HTTP_EXCEPTION_RESPONSE_RESULT ?? ".http-exception-response-result.json")
const binaryInput = process.env.HTTP_EXCEPTION_RESPONSE_BINARY
if (binaryInput !== undefined)
  assert(path.isAbsolute(binaryInput), "HTTP_EXCEPTION_RESPONSE_BINARY must be an absolute executable path")
const binary = binaryInput === undefined ? undefined : await fs.realpath(binaryInput)
const startupTimeoutMs = Number(process.env.HTTP_EXCEPTION_RESPONSE_STARTUP_TIMEOUT_MS ?? 35_000)
assert(
  Number.isSafeInteger(startupTimeoutMs) && startupTimeoutMs >= 1 && startupTimeoutMs <= 120_000,
  "HTTP_EXCEPTION_RESPONSE_STARTUP_TIMEOUT_MS must be an integer from 1 to 120000",
)
class HTTPExceptionProbeStartupTimeoutError extends Error {
  override readonly name = "HTTPExceptionProbeStartupTimeoutError"
  readonly code = "HTTP_EXCEPTION_PROBE_STARTUP_TIMEOUT"
  constructor(readonly timeoutMilliseconds: number) {
    super(`Owned development server did not publish its startup receipt within ${timeoutMilliseconds}ms`)
  }
}
const errorFact = (error: unknown) =>
  error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        ...(error instanceof HTTPExceptionProbeStartupTimeoutError
          ? { code: error.code, timeoutMilliseconds: error.timeoutMilliseconds }
          : {}),
      }
    : { name: "UnknownError", message: String(error) }
const outputDirectory = path.dirname(resultPath)
const caseID = crypto.randomUUID()
await fs.mkdir(outputDirectory, { recursive: true })
const packageRoot = path.resolve(import.meta.dir, "..")
const helper = binary
  ? await fs.realpath(path.join(path.dirname(binary), "opencorvus-process-supervisor.exe"))
  : prepareTestProcessSupervisor()
if (binary) {
  assert.equal((await fs.stat(binary)).isFile(), true)
  assert.equal((await fs.stat(helper!)).isFile(), true)
}
const executable = binary ?? process.execPath
const hostKeys = new Set(["path", "systemroot", "windir", "comspec", "pathext", "lang", "lc_all"])
for (const key of Object.keys(process.env)) if (!hostKeys.has(key.toLowerCase())) delete process.env[key]
const isolation = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(isolation)
if (helper) process.env.OPENCORVUS_PROCESS_SUPERVISOR = helper
const { currentRuntimeProcessOccurrence, observedProcessOccurrence, observeRuntimeProcessOccurrence } = await import(
  "../src/runtime/process-occurrence"
)
const parent = currentRuntimeProcessOccurrence()
const home = path.join(isolation.processRoot, "auth-server")
const project = path.join(home, "project")
await fs.mkdir(project, { recursive: true })
const portProbe = net.createServer()
const port = await new Promise<number>((resolve, reject) => {
  portProbe.once("error", reject)
  portProbe.listen(0, "127.0.0.1", () => {
    const selected = (portProbe.address() as net.AddressInfo).port
    portProbe.close((error) => (error ? reject(error) : resolve(selected)))
  })
})
let baseURL = ""
const password = crypto.randomUUID()
const username = "owned-auth-probe"
const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
const logPath = `${resultPath}.server.log`
let descriptor: number | undefined
const receiptPath = `${resultPath}.startup.json`
const entry = path.join(packageRoot, "src/index.ts")
const args = [
  ...(binary ? [] : [entry]),
  "serve",
  "--hostname",
  "127.0.0.1",
  "--port",
  String(port),
  "--startup-receipt",
  receiptPath,
  "--startup-occurrence",
  caseID,
  "--parent-pid",
  String(parent.pid),
  "--parent-process-instance-id",
  parent.processInstanceID,
  "--print-logs",
]
let child: ProcessHandle | undefined
let exited: ProcessTerminalReceipt | undefined
let processError: unknown
let exit: Promise<void> | undefined
let output: Promise<void[]> | undefined
const outputErrors: unknown[] = []
const drain = async (source: ProcessByteSource | null) => {
  if (!source) return
  try {
    for await (const chunk of source) {
      try {
        writeSync(descriptor!, chunk)
      } catch (error) {
        outputErrors.push(errorFact(error))
      }
    }
  } catch (error) {
    outputErrors.push(errorFact(error))
  }
}
const fact: Record<string, unknown> = {
  phase: "real_http_contract",
  profile: binary ? "packaged-http" : "source",
  caseID,
  port,
  parent,
  home,
  project,
  executable,
  helper,
  args,
  startupTimeoutMs,
  credentialSource: "fresh disposable in-memory test pair",
  providerUse: "none",
  logPath,
}
if (binary) {
  fact.package = JSON.parse(await fs.readFile(path.join(path.dirname(binary), "package.json"), "utf8"))
  const manifestPath = path.join(path.dirname(binary), "work-artifact-target-package-manifest.json")
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"))
  fact.packageManifest = { path: manifestPath, phase: manifest.phase, target: manifest.target }
}
const executableFact = async (
  identity: { pid: number; processInstanceID: string; occurrenceID: string },
  expected: string,
) => {
  assert.equal(observeRuntimeProcessOccurrence(identity), "exact_live")
  const script = `Get-CimInstance Win32_Process -Filter 'ProcessId=${identity.pid}'|Select-Object ProcessId,ParentProcessId,ExecutablePath,CreationDate|ConvertTo-Json -Compress`
  const observation = await NodeProcess.run({
    command: {
      executable: "powershell.exe",
      args: ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
    },
    ownership: "owned_tree",
    timeoutMs: 15_000,
  })
  const actual = JSON.parse(new TextDecoder().decode(observation.stdout))
  assert.equal(actual.ProcessId, identity.pid)
  assert.equal((await fs.realpath(actual.ExecutablePath)).toLowerCase(), expected.toLowerCase())
  assert.equal(observeRuntimeProcessOccurrence(identity), "exact_live")
  return { ...actual, identity }
}
const selectedHeaders = (response: Response) =>
  Object.fromEntries(
    [
      "content-type",
      "www-authenticate",
      "x-opencorvus-request-id",
      "access-control-allow-origin",
      "access-control-expose-headers",
      "access-control-allow-methods",
      "access-control-allow-headers",
    ].map((key) => [key, response.headers.get(key)]),
  )
const request = async (method: string, pathname: string, headers: Record<string, string> = {}) => {
  const response = await fetch(`${baseURL}${pathname}`, {
    method,
    headers,
    signal: AbortSignal.timeout(5000),
  })
  return { method, pathname, status: response.status, headers: selectedHeaders(response), body: await response.text() }
}
let ready = false
let owner: { pid: number; processInstanceID: string; occurrenceID: string } | undefined
let helperOwner: typeof owner
let diagnosticID: string | null = null
try {
  descriptor = openSync(logPath, "wx")
  const deadline = Date.now() + startupTimeoutMs
  child = await NodeProcess.spawn({
    command: { executable, args },
    cwd: project,
    windowsHide: true,
    ownership: "owned_tree",
    occurrenceID: caseID,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      OPENCORVUS_HOME: home,
      OPENCORVUS_TEST_HOME: home,
      OPENCORVUS_TEST_PROCESS_ROOT: isolation.processRoot,
      OPENCORVUS_SERVER_PASSWORD: password,
      OPENCORVUS_SERVER_USERNAME: username,
      OPENCORVUS_DISABLE_AUTOUPDATE: "1",
      OPENCORVUS_DISABLE_PROJECT_CONFIG: "1",
      OPENCORVUS_DISABLE_EXTERNAL_SKILLS: "1",
    },
  })
  fact.childPID = child.pid
  output = Promise.all([drain(child.stdout), drain(child.stderr)])
  exit = child.settled.then(
    (receipt) => {
      exited = receipt
    },
    (error) => {
      processError = error
    },
  )
  owner = observedProcessOccurrence(child.pid)
  assert(owner, "Actual runtime process fingerprint must be observable")
  assert.equal(observeRuntimeProcessOccurrence(owner), "exact_live")
  fact.owner = owner
  while (Date.now() < deadline) {
    if (processError) throw processError
    if (exited) throw new Error(`Owned development server exited during startup: ${JSON.stringify(exited)}`)
    try {
      const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"))
      assert.equal(receipt.outcome, "listening")
      assert.equal(receipt.pid, child.pid)
      fact.startupReceipt = receipt
      assert.equal(receipt.occurrenceID, caseID)
      baseURL = receipt.url
      assert.equal(new URL(baseURL).hostname, "127.0.0.1")
      assert.equal(Number(new URL(baseURL).port), port)
      fact.baseURL = baseURL
      ready = true
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    await delay(100)
  }
  if (!ready) throw new HTTPExceptionProbeStartupTimeoutError(startupTimeoutMs)
  if (binary && process.platform === "win32") {
    const actual = await executableFact(owner, binary)
    fact.actualExecutable = actual
    helperOwner = observedProcessOccurrence(actual.ParentProcessId)
    assert(helperOwner, "Actual owning native helper fingerprint must be observable")
    fact.actualHelper = await executableFact(helperOwner, helper!)
  }
  const unauthenticated = await request("GET", "/global/health")
  fact.unauthenticated = unauthenticated
  assert.equal(unauthenticated.status, 401)
  assert.equal(unauthenticated.body, "Unauthorized")
  assert.equal(unauthenticated.headers["www-authenticate"], 'Basic realm="Secure Area"')
  diagnosticID = unauthenticated.headers["x-opencorvus-request-id"]
  assert.match(diagnosticID ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  fact.authenticated = await request("GET", "/global/health", { Authorization: authorization })
  const authenticated = fact.authenticated as { status: number; body: string }
  assert.equal(authenticated.status, 200)
  const health = JSON.parse(authenticated.body)
  assert.equal(health.healthy, true)
  assert.equal(path.resolve(health.paths.home), path.resolve(home))
  if (binary) {
    const ui = await request("GET", "/ui/", { Authorization: authorization })
    assert.equal(ui.status, 200)
    const asset = ui.body.match(/src="\.\/assets\/(main-[^"]+\.js)"/)?.[1]
    assert(asset, "Packaged /ui must serve its embedded frontend entry asset")
    fact.embeddedUI = { status: ui.status, contentType: ui.headers["content-type"], asset }
  }
  fact.options = await request("OPTIONS", "/global/health", {
    Origin: "http://127.0.0.1:17885",
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "authorization",
  })
  assert.equal((fact.options as { status: number }).status, 204)
  fact.status = "http_assertions_passed"
} catch (error) {
  fact.status = "failed"
  fact.error = errorFact(error)
} finally {
  const cleanupErrors: unknown[] = []
  try {
    if (child) {
      if (ready && !exited) {
        fact.shutdown = await request("POST", "/shutdown", { Authorization: authorization }).catch((error) => ({
          error: errorFact(error),
        }))
        await Promise.race([exit!, delay(20_000, undefined, { ref: false })])
      }
      try {
        fact.disposal = await child.dispose()
      } catch (error) {
        cleanupErrors.push(errorFact(error))
      }
      try {
        fact.settlement = exited = await child.settled
      } catch (error) {
        cleanupErrors.push(errorFact(error))
      }
      await output
    }
  } catch (error) {
    cleanupErrors.push(errorFact(error))
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor)
        fact.logFile = "closed"
      } catch (error) {
        cleanupErrors.push(errorFact(error))
      }
    }
    fact.exit = exited ? { code: exited.exitCode, signal: exited.signal } : { outcome: "not_observed" }
    fact.finalPhysicalOwner = owner ? observeRuntimeProcessOccurrence(owner) : "unavailable"
    if (helperOwner) fact.finalPhysicalHelper = observeRuntimeProcessOccurrence(helperOwner)
    fact.cleanup = {
      outcome: child && exited && cleanupErrors.length === 0 ? "settled" : "unavailable",
      errors: cleanupErrors,
    }
    fact.output = { outcome: outputErrors.length ? "failed" : output ? "drained" : "not_started", errors: outputErrors }
  }
  if (
    !exited ||
    exited.exitCode !== 0 ||
    exited.reason !== "exited" ||
    fact.finalPhysicalOwner !== "dead_or_reused" ||
    cleanupErrors.length ||
    outputErrors.length
  )
    fact.status = "failed"
  if (fact.status === "http_assertions_passed") {
    try {
      if (helperOwner) assert.equal(fact.finalPhysicalHelper, "dead_or_reused")
      const entries = (await fs.readFile(logPath, "utf8"))
        .split(/\r?\n/)
        .filter((line) => line.startsWith("{"))
        .map((line) => JSON.parse(line))
      const errorReceipt = entries.find(
        (entry) => entry.service === "server" && entry.message === "request failed" && entry.requestID === diagnosticID,
      )
      assert(errorReceipt, "Same actual unauthorized response must correlate to its settled server error log")
      assert.equal(errorReceipt.method, "GET")
      assert.equal(errorReceipt.path, "/global/health")
      assert.equal(errorReceipt.statusCode, 401)
      fact.errorLogReceipt = errorReceipt
      fact.status = "passed"
    } catch (error) {
      fact.status = "failed"
      fact.error = errorFact(error)
    }
  }
  await fs.writeFile(resultPath, JSON.stringify(fact, null, 2), { flag: "wx" })
}
console.log(
  JSON.stringify({ status: fact.status, resultPath, exit: fact.exit, finalPhysicalOwner: fact.finalPhysicalOwner }),
)
if (fact.status === "failed" || !exited || exited.exitCode !== 0) process.exitCode = 1
