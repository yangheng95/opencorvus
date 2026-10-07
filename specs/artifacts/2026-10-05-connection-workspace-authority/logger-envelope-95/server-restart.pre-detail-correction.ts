/** Credential-free Windows restart qualification. SERVER_RESTART_RESULT selects evidence.
 * SERVER_RESTART_BINARY explicitly selects a compiled backend and its adjacent helper;
 * omitted input runs the twelve-case source profile. Packaged mode runs six HTTP/SDK cases.
 */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import net from "node:net"
import { NodeProcess } from "@opencorvus-ai/util/process-node"
import { bootstrapIsolatedTestRuntime, applyIsolatedTestUserEnvironment } from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

const resultPath = path.resolve(process.env.SERVER_RESTART_RESULT ?? ".server-restart-result.json")
const binaryInput = process.env.SERVER_RESTART_BINARY
if (binaryInput) assert(path.isAbsolute(binaryInput), "SERVER_RESTART_BINARY must be an absolute executable path")
const binary = binaryInput ? await fs.realpath(binaryInput) : undefined
const helper = binary ? await fs.realpath(path.join(path.dirname(binary), "opencorvus-process-supervisor.exe")) : prepareTestProcessSupervisor()
if (binary) {
  assert.equal((await fs.stat(binary)).isFile(), true)
  assert.equal((await fs.stat(helper!)).isFile(), true)
  const hostKeys = new Set(["path", "systemroot", "windir", "comspec", "pathext", "lang", "lc_all"])
  for (const key of Object.keys(process.env)) if (!hostKeys.has(key.toLowerCase())) delete process.env[key]
}
const isolation = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(isolation)
if (helper) process.env.OPENCORVUS_PROCESS_SUPERVISOR = helper
const { currentRuntimeProcessOccurrence, currentWindowsProcessIsInJob, observeRuntimeProcessOccurrence } = await import("@/runtime/process-occurrence")
const root = path.join(isolation.processRoot, "restart-check")
await fs.mkdir(root, { recursive: true })
const results: any[] = []
let failure: unknown
const provenance: Record<string, unknown> = { profile: binary ? "packaged-http" : "source", executable: binary ?? process.execPath }
provenance.checkerOwner = currentRuntimeProcessOccurrence()
if (binary) provenance.package = JSON.parse(await fs.readFile(path.join(path.dirname(binary), "package.json"), "utf8"))
const entry = path.resolve(import.meta.dir, "../src/index.ts")
type NativeFacts = { requestRoot: string; request: any; ready: any; helper: any }
const wait = async <T>(label: string, read: () => Promise<T | undefined>, milliseconds = 30_000): Promise<T> => {
  const deadline = Date.now() + milliseconds
  for (;;) {
    const value = await read()
    if (value !== undefined) return value
    if (Date.now() >= deadline) throw new Error(`Timed out: ${label}`)
    await Bun.sleep(50)
  }
}
const jsonFile = async (file: string) => {
  try { return JSON.parse(await fs.readFile(file, "utf8")) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error }
}
const launchStandalone = async (command: { executable: string; args: string[]; cwd?: string; env?: NodeJS.ProcessEnv }) => {
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
  const commandLine = [command.executable, ...command.args].map(value => `"${value.replace(/(\\*)"/g, "$1$1\\\"").replace(/(\\+)$/, "$1$1")}"`).join(" ")
  const environment = command.env ? `;CreateFlags=[uint32]1024;EnvironmentVariables=[string[]]@(${Object.entries(command.env).filter((entry): entry is [string,string] => typeof entry[1] === "string").map(([key,value]) => quote(`${key}=${value}`)).join(",")})` : ""
  const code = `$startup=New-CimInstance -CimClass (Get-CimClass Win32_ProcessStartup) -ClientOnly -Property @{ShowWindow=[uint16]0${environment}};Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=${quote(commandLine)};CurrentDirectory=${quote(command.cwd ?? path.dirname(entry))};ProcessStartupInformation=$startup}|Select-Object ReturnValue,ProcessId|ConvertTo-Json -Compress`
  const launched = await NodeProcess.run({ command: { executable: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(code, "utf16le").toString("base64")] }, timeoutMs: 15_000 })
  const receipt = JSON.parse(new TextDecoder().decode(launched.stdout))
  const launches = (provenance.launches ??= []) as unknown[]
  launches.push({ ...receipt, executable: command.executable, args: command.args, cwd: command.cwd,
    environmentKeys: command.env ? Object.keys(command.env).sort() : undefined })
  assert.equal(receipt.ReturnValue, 0)
  const identity = await NodeProcess.run({ command: { executable: helper!, args: ["--process-instance-id", String(receipt.ProcessId)] }, timeoutMs: 5000 })
  return { ...receipt, owner: { pid: receipt.ProcessId as number, processInstanceID: new TextDecoder().decode(identity.stdout).trim(), occurrenceID: "checker-created-host" } }
}
const executableFact = async (owner: {pid:number;processInstanceID:string;occurrenceID?:string}, expected: string) => {
  assert.equal(observeRuntimeProcessOccurrence({ ...owner, occurrenceID: owner.occurrenceID ?? "native-helper" }), "exact_live")
  const code = `Get-CimInstance Win32_Process -Filter 'ProcessId=${owner.pid}'|Select-Object ProcessId,ExecutablePath|ConvertTo-Json -Compress`
  const observed = await NodeProcess.run({ command: { executable: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(code, "utf16le").toString("base64")] }, timeoutMs: 15_000 })
  const fact = JSON.parse(new TextDecoder().decode(observed.stdout))
  assert.equal(fact.ProcessId, owner.pid)
  assert.equal((await fs.realpath(fact.ExecutablePath)).toLowerCase(), (await fs.realpath(expected)).toLowerCase())
  assert.equal(observeRuntimeProcessOccurrence({ ...owner, occurrenceID: owner.occurrenceID ?? "native-helper" }), "exact_live")
  return { ...owner, executable: fact.ExecutablePath }
}
const captureNativeFacts = async (home: string, record: any) => {
  const temporary = path.join(home, "tmp")
  await fs.mkdir(temporary, { recursive: true })
  const stop = new AbortController()
  const observed = new Map<string, any>()
  record.nativeAttempts = []
  record.nativeObservationErrors = []
  let pending: Promise<void> | undefined
  const scan = () => pending ??= (async () => {
    for (const item of await fs.readdir(temporary, { withFileTypes: true })) {
      if (!item.isDirectory() || !item.name.startsWith("supervisor-")) continue
      const requestRoot = path.join(temporary, item.name)
      const request = await jsonFile(path.join(requestRoot, "request.json"))
      if (request?.detached !== true) continue
      let attempt = observed.get(request.request_id)
      if (!attempt) {
        if (observed.size >= 16) throw new Error("Native diagnostic capture exceeded its sixteen-request observation budget")
        attempt = { requestID: request.request_id, root: requestRoot, firstObservedAt: Date.now(), facts: {} }
        observed.set(request.request_id, attempt)
        record.nativeAttempts.push(attempt)
      }
      attempt.facts["request.json"] = request
      for (const name of ["helper.json", "ready.json", "restart-waiting.json", "restart-bind.json", "restart-ready.json", "restart-failed.json", "transfer-request.json", "transfer-receipt.json", "settled.json", "launch-failed.json"]) {
        const value = await jsonFile(path.join(requestRoot, name))
        if (value !== undefined) attempt.facts[name] = value
      }
      attempt.lastObservedAt = Date.now()
    }
  })().finally(() => { pending = undefined })
  const captureError = (error: unknown) => {
    if (record.nativeObservationErrors.length < 16) record.nativeObservationErrors.push({ time: Date.now(), error: String(error) })
  }
  const watcher = fs.watch(temporary, { recursive: true, signal: stop.signal })
  const watching = (async () => {
    try { for await (const _ of watcher) await scan() }
    catch (error) { if (!stop.signal.aborted) captureError(error) }
  })()
  const bounded = setTimeout(() => { record.nativeCaptureStop = "observation_window_elapsed"; stop.abort() }, 120_000)
  try { await scan() } catch (error) { clearTimeout(bounded); stop.abort(); await watching; throw error }
  return { scan, async close() {
    clearTimeout(bounded)
    record.nativeCaptureStop ??= "observer_closed"
    stop.abort()
    await watching
    await scan().catch(captureError)
  } }
}
const readTransfers = async (home: string): Promise<Array<{ root: string; transfer: any; ready: any; applicationReady: any; request: any }>> => {
  const temporary = path.join(home, "tmp")
  const directories = await fs.readdir(temporary, { withFileTypes: true })
  const found: Array<{ root: string; transfer: any; ready: any; applicationReady: any; request: any }> = []
  for (const item of directories) {
    if (!item.isDirectory() || !item.name.startsWith("supervisor-")) continue
    const requestRoot = path.join(temporary, item.name)
    const transfer = await jsonFile(path.join(requestRoot, "transfer-receipt.json"))
    if (transfer) found.push({ root: requestRoot, transfer, ready: await jsonFile(path.join(requestRoot, "ready.json")),
      applicationReady: await jsonFile(path.join(requestRoot, "restart-ready.json")), request: await jsonFile(path.join(requestRoot, "request.json")) })
  }
  return found
}
try {
  assert.equal(process.platform, "win32", "This checker qualifies the Windows physical adapter")
  assert.equal(currentWindowsProcessIsInJob(), false, "Standalone checker launcher must itself be outside a Job")
  const capability = await NodeProcess.run({ command: { executable: helper!, args: ["--detached-capability"] }, ownership: "detached", timeoutMs: 15_000 })
  provenance.capability = JSON.parse(new TextDecoder().decode(capability.stdout))
  assert.deepEqual(provenance.capability, { protocol: 3, containment: "independent" })
  const runCase = async (mode: "standalone" | "standalone-peer" | "managed-parent" | "owned-tree" | "helper-unavailable") => {
    const home = path.join(root, mode, "home")
    const directory = path.join(root, mode, "project")
    await fs.mkdir(directory, { recursive: true })
    await fs.mkdir(home, { recursive: true })
    await fs.writeFile(path.join(directory, "restart.txt"), `before-${mode}\n`)
    const receiptPath = path.join(root, mode, "startup.json")
    const logPath = path.join(root, mode, "stdout.log")
    const environment: NodeJS.ProcessEnv = { ...process.env, OPENCORVUS_HOME: home, OPENCORVUS_TEST_HOME: home,
      OPENCORVUS_TEST_PROCESS_ROOT: root, OPENCORVUS_CONFIG_CONTENT: JSON.stringify({ permission_mode: "full_access" }) }
    if (mode === "helper-unavailable") environment.OPENCORVUS_PROCESS_SUPERVISOR = process.execPath
    for (const name of ["OPENCORVUS_CONFIG", "OPENCORVUS_CONFIG_DIR", "OPENCORVUS_MODELS_PATH", "OPENCORVUS_SERVER_PASSWORD", "OPENCORVUS_SERVER_USERNAME", "OPENCORVUS_PROJECT_DIR"]) delete environment[name]
    const parent = currentRuntimeProcessOccurrence()
    const port = await new Promise<number>((resolve, reject) => {
      const probe = net.createServer()
      probe.once("error", reject)
      probe.listen(0, "127.0.0.1", () => { const port = (probe.address() as net.AddressInfo).port; probe.close(error => error ? reject(error) : resolve(port)) })
    })
    const args = [...(binary ? [] : [entry]), "serve", "--hostname", "127.0.0.1", "--port", String(port), "--project-dir", directory,
      "--startup-receipt", receiptPath, "--startup-occurrence", `restart-${mode}`, "--print-logs",
      ...(mode === "managed-parent" ? ["--parent-pid", String(parent.pid), "--parent-process-instance-id", parent.processInstanceID] : [])]
    const processHandle = mode === "owned-tree" ? await NodeProcess.spawn({ command: { executable: binary ?? process.execPath, args },
      ownership: "owned_tree", env: environment, stdin: "ignore" }) : undefined
    let originalPID = processHandle?.pid
    let launchReceipt: unknown
    if (!processHandle && binary) {
      const parsed = await launchStandalone({ executable: binary, args, cwd: directory, env: environment })
      originalPID = parsed.ProcessId
      launchReceipt = parsed
    } else if (!processHandle) {
      // WMI creates the exact Bun host outside a caller's Job. The bootstrap only establishes its isolated environment.
      const selected = ["OPENCORVUS_HOME", "OPENCORVUS_TEST_HOME", "OPENCORVUS_TEST_PROCESS_ROOT", "OPENCORVUS_PROCESS_SUPERVISOR", "OPENCORVUS_CONFIG_CONTENT",
        "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "OPENCORVUS_TEST_MANAGED_CONFIG_DIR"]
      const launchScript = path.join(root, mode, "launch.mjs")
      const runtimeModule = path.resolve(import.meta.dir, "../src/runtime/process-occurrence.ts").replaceAll("\\", "/")
      await fs.writeFile(launchScript, [
        "import fs from 'node:fs'",
        "for(const key of Object.keys(process.env)) if(key.startsWith('OPENCORVUS_')) delete process.env[key]",
        ...selected.flatMap(key => environment[key] === undefined ? [] : [`process.env[${JSON.stringify(key)}]=${JSON.stringify(environment[key])}`]),
        `process.argv=${JSON.stringify([process.execPath, ...args.filter(value => value !== "--print-logs")])}`,
        `const runtime=await import(${JSON.stringify(runtimeModule)})`,
        "const owner=runtime.currentRuntimeProcessOccurrence()",
        `fs.writeFileSync(${JSON.stringify(path.join(root, mode, "launcher-started.json"))},JSON.stringify({...owner,inJob:runtime.currentWindowsProcessIsInJob()}))`,
        `process.on('exit',code=>fs.writeFileSync(${JSON.stringify(path.join(root, mode, "launcher-terminal.json"))},JSON.stringify({...owner,exitCode:code})))`,
        `await import(${JSON.stringify(entry.replaceAll("\\", "/"))})`,
      ].join("\n"))
      const parsed = await launchStandalone({ executable: process.execPath, args: [launchScript] })
      originalPID = parsed.ProcessId
      launchReceipt = parsed
    }
    let originalOwner = (launchReceipt as { owner: { pid: number; processInstanceID: string; occurrenceID: string } } | undefined)?.owner
    const stderrPath = path.join(root, mode, "stderr.log")
    const drain = async (source: NonNullable<typeof processHandle>["stdout"] | undefined, target: string) => {
      if (source) for await (const chunk of source) await fs.appendFile(target, chunk)
    }
    const output = Promise.all([drain(processHandle?.stdout, logPath), drain(processHandle?.stderr, stderrPath)])
    void output.catch(() => undefined)
    let url: string | undefined
    const record: any = { mode, home, directory, originalPID, originalOwner, launchReceipt, restarts: [] }
    let nativeCapture: Awaited<ReturnType<typeof captureNativeFacts>> | undefined
    results.push(record)
    const request = async (route: string, method = "GET", body?: unknown) => {
      const target = new URL(route, url)
      target.searchParams.set("directory", directory)
      const response = await fetch(target, { method, signal: AbortSignal.timeout(5000),
        headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      return { status: response.status, body: await response.json() }
    }
    try {
      if (!processHandle && !binary) {
        const started = await wait("WMI exact host identity", () => jsonFile(path.join(root, mode, "launcher-started.json")))
        assert.equal(started.pid, originalPID)
        assert.equal(started.inJob, false)
        record.launcherStarted = started
        originalOwner = started
        originalPID = originalOwner!.pid
        record.originalPID = originalPID
        record.originalOwner = originalOwner
      }
      const startup = await wait("server startup", async () => {
        const startup = await jsonFile(receiptPath)
        if (startup) return startup
        const terminal = await jsonFile(path.join(root, mode, "launcher-terminal.json"))
        if (terminal) throw new Error(`Owned server exited before startup: ${JSON.stringify(terminal)}`)
      })
      assert.equal(startup.outcome, "listening")
      if (originalPID) assert.equal(startup.pid, originalPID)
      originalPID = startup.pid
      const identity = await NodeProcess.run({ command: { executable: helper!, args: ["--process-instance-id", String(originalPID)] }, timeoutMs: 5000 })
      originalOwner = { pid: originalPID!, processInstanceID: new TextDecoder().decode(identity.stdout).trim(), occurrenceID: `checker:${mode}` }
      record.originalPID = originalPID
      record.originalOwner = originalOwner
      if (binary) record.executable = await executableFact(originalOwner, binary)
      if (binary && processHandle) {
        const candidates = await fs.readdir(isolation.temporaryRoot, { withFileTypes: true })
        const matched: NativeFacts[] = []
        for (const candidate of candidates) {
          if (!candidate.isDirectory() || !candidate.name.startsWith("opencorvus-node-process-")) continue
          const requestRoot = path.join(isolation.temporaryRoot, candidate.name)
          const ready = await jsonFile(path.join(requestRoot, "ready.json"))
          if (ready?.target_pid !== originalPID || ready.target_process_instance_id !== originalOwner.processInstanceID) continue
          matched.push({ requestRoot, ready, request: await jsonFile(path.join(requestRoot, "request.json")), helper: await jsonFile(path.join(requestRoot, "helper.json")) })
        }
        assert.equal(matched.length, 1, "Owned-tree target has its exact paired native request")
        record.native = matched[0]
        assert.equal(record.native.ready.protocol, 3)
        assert.equal(record.native.ready.detached, false)
        record.helperOwner = { pid: record.native.helper.helper_pid, processInstanceID: record.native.helper.helper_process_instance_id, occurrenceID: record.native.request.request_id }
        record.helperExecutable = await executableFact(record.helperOwner, helper!)
      }
      url = startup.url
      record.startup = startup
      assert.equal((await request("/global/health")).status, 200)
      if (!mode.startsWith("standalone")) {
        const refused = await request("/restart", "POST", {})
        assert.equal(refused.status, 503)
        assert.equal(refused.body.name, "ServerRestartUnavailableError")
        assert.equal(refused.body.data.reason, mode === "managed-parent" ? "managed_parent" : mode === "owned-tree" ? "containing_job" : "helper_protocol_unavailable")
        record.refused = refused
        if (mode === "owned-tree") {
          record.refusalWarning = await wait("actual stderr restart refusal diagnostic", async () => {
            const text = await fs.readFile(stderrPath, "utf8")
            for (const line of text.split(/\r?\n/)) {
              let value: any
              try { value = JSON.parse(line) } catch { continue }
              if (value.level === "warn" && value.service === "server" && value.data?.reason === refused.body.data.reason) return value
            }
          })
          assert.equal(record.refusalWarning.message, "restart unavailable for current process owner")
          assert.equal(record.refusalWarning.data.reason, refused.body.data.reason)
          assert.equal(record.refusalWarning.detail, refused.body.data.message)
          record.stderrPath = stderrPath
        }
        record.continuedHealth = await request("/global/health")
        assert.equal(record.continuedHealth.status, 200)
      } else {
        nativeCapture = await captureNativeFacts(home, record)
        record.lifecycleObservations = []
        let predecessorPID = startup.pid
        for (let turn = 1; turn <= 2; turn++) {
          const accepted = await request("/restart", "POST", {})
          record.lastAdmission = accepted
          assert.equal(accepted.status, 200)
          assert.equal(accepted.body.ok, true)
          const transfer = await wait("committed native transfer", async () => {
            await nativeCapture!.scan()
            const committed = (await readTransfers(home)).find(item => item.transfer.previous_owner.pid === predecessorPID)
            if (committed) return committed
            let lifecycle: any
            try { lifecycle = await request(`/lifecycle/${accepted.body.occurrenceID}`) } catch {}
            if (lifecycle?.status === 200) {
              assert.equal(lifecycle.body.id, accepted.body.occurrenceID)
              record.lifecycleObservations.push(lifecycle.body)
              if (lifecycle.body.state === "failed") {
                await nativeCapture!.scan()
                throw new Error(`Observed restart lifecycle failure: ${lifecycle.body.error}`)
              }
            }
          })
          assert.equal(transfer.ready.protocol, 3)
          assert.equal(transfer.ready.detached, true)
          assert.equal(transfer.transfer.outcome, "committed")
          assert.equal(transfer.transfer.successor.pid, transfer.ready.target_pid)
          assert.equal(transfer.applicationReady.url, url)
          assert.deepEqual(transfer.applicationReady.successor, transfer.transfer.successor)
          assert.equal((await fs.realpath(transfer.request.executable)).toLowerCase(), (await fs.realpath(binary ?? process.execPath)).toLowerCase())
          assert.deepEqual(transfer.request.args, binary ? args : args.filter(value => value !== "--print-logs"), "Replacement preserves the exact executable invocation arguments")
          if (binary) {
            Object.assign(transfer, { targetExecutable: await executableFact(transfer.transfer.successor, binary),
              helperExecutable: await executableFact(transfer.transfer.helper, helper!) })
          }
          await wait("predecessor physical exit", async () => observeRuntimeProcessOccurrence(transfer.transfer.previous_owner) === "dead_or_reused" ? "settled" : undefined)
          const health = await wait("successor HTTP health", async () => {
            try { const value = await request("/global/health"); return value.status === 200 ? value : undefined } catch { return }
          })
          const file = await request("/file/content?path=restart.txt")
          assert.equal(file.status, 200)
          assert.equal(file.body.content, turn === 1 ? `before-${mode}\n` : "saved-after-1\n")
          const saved = await request("/file/content", "PATCH", { path: "restart.txt", content: `saved-after-${turn}\n`, expectedRevision: file.body.revision })
          assert.equal(saved.status, 200)
          assert.equal(await fs.readFile(path.join(directory, "restart.txt"), "utf8"), `saved-after-${turn}\n`)
          record.restarts.push({ accepted, ...transfer, health, read: file, saved, predecessorDisposition: "dead_or_reused" })
          predecessorPID = transfer.transfer.successor.pid
        }
      }
      record.status = "passed"
    } finally {
      try {
      if (url) {
        try { record.shutdown = await request("/shutdown", "POST", {}) }
        catch (error) { record.shutdownError = String(error) }
      }
      if (record.restarts.length) {
        const last = record.restarts.at(-1)
        record.successorSettlement = await wait("successor native physical settlement", () => jsonFile(path.join(last.root, "settled.json")))
        assert.equal(record.successorSettlement.target_pid, last.transfer.successor.pid)
        assert.equal(record.successorSettlement.active_processes, 0)
      }
      if (!url && originalOwner && observeRuntimeProcessOccurrence(originalOwner) === "exact_live") {
        const code = `$child=Get-Process -Id ${originalOwner.pid} -ErrorAction Stop;$null=$child.Handle;$identity='win32:'+$child.StartTime.ToUniversalTime().Ticks;if($identity -ne '${originalOwner.processInstanceID}'){throw 'Owned target identity changed'};$child.Kill();$child.WaitForExit();@{pid=$child.Id;processInstanceID=$identity;exitCode=$child.ExitCode;reason='checker startup failed'}|ConvertTo-Json -Compress`
        const cleanup = await NodeProcess.run({ command: { executable: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(code, "utf16le").toString("base64")] }, timeoutMs: 15_000 })
        record.startupFailureCleanup = JSON.parse(new TextDecoder().decode(cleanup.stdout))
      }
      if (originalOwner) record.originalDisposition = await wait("owned original process physical end", async () =>
        observeRuntimeProcessOccurrence(originalOwner!) === "dead_or_reused" ? "dead_or_reused" : undefined, 15_000)
      if (processHandle) { await processHandle.dispose(); record.launcherTerminal = await processHandle.settled }
      else if (!binary) {
        record.launcherTerminal = await wait("WMI launcher physical child terminal", () => jsonFile(path.join(root, mode, "launcher-terminal.json")), 15_000)
        assert.equal(record.launcherTerminal.pid, originalOwner?.pid)
        assert.equal(record.launcherTerminal.processInstanceID, originalOwner?.processInstanceID)
      }
      if (record.helperOwner) {
        record.helperDisposition = observeRuntimeProcessOccurrence(record.helperOwner)
        assert.equal(record.helperDisposition, "dead_or_reused")
      }
      await output
      } finally { await nativeCapture?.close() }
    }
  }
  const parallel = await Promise.allSettled([runCase("standalone"), runCase("standalone-peer")])
  const failures = parallel.flatMap(result => result.status === "rejected" ? [result.reason] : [])
  if (failures.length) throw new AggregateError(failures, "Parallel isolated restart qualification failed")
  for (const mode of ["managed-parent", "owned-tree", "helper-unavailable"] as const) await runCase(mode)

  const sdkRoot = path.join(root, "sdk-owned-tree")
  await fs.mkdir(sdkRoot, { recursive: true })
  const sdkOwnerPath = path.join(sdkRoot, "owner.json")
  const sdkRecord: any = { mode: "sdk-owned-tree", directory: sdkRoot }
  results.push(sdkRecord)
  if (!binary) await fs.writeFile(path.join(sdkRoot, "serve"), `process.argv.splice(1,1,${JSON.stringify(entry)},'serve');const fs=await import('node:fs');const r=await import(${JSON.stringify(path.resolve(import.meta.dir, "../src/runtime/process-occurrence.ts").replaceAll("\\", "/"))});fs.writeFileSync(${JSON.stringify(sdkOwnerPath)},JSON.stringify({...r.currentRuntimeProcessOccurrence(),inJob:r.currentWindowsProcessIsInJob()}));await import(${JSON.stringify(entry.replaceAll("\\", "/"))})`)
  const sdkTemporary = path.join(sdkRoot, "tmp")
  await fs.mkdir(sdkTemporary, { recursive: true })
  const sdkEnv = { OPENCORVUS_HOME: path.join(sdkRoot, "home"), OPENCORVUS_TEST_HOME: path.join(sdkRoot, "home"), OPENCORVUS_BIN_PATH: binary ?? process.execPath,
    ...(binary ? { TEMP: sdkTemporary, TMP: sdkTemporary, TMPDIR: sdkTemporary } : {}) }
  const previousEnvironment = Object.fromEntries(Object.keys(sdkEnv).map(key => [key, process.env[key]]))
  const previousDirectory = process.cwd()
  let sdkServer: Awaited<ReturnType<typeof import("../../sdk/js/src/server").createOpenCorvusServer>> | undefined
  try {
    Object.assign(process.env, sdkEnv)
    process.chdir(sdkRoot)
    const { createOpenCorvusServer } = await import("../../sdk/js/src/server")
    const probe = net.createServer()
    const sdkPort = await new Promise<number>((resolve, reject) => {
      probe.once("error", reject)
      probe.listen(0, "127.0.0.1", () => { const port = (probe.address() as net.AddressInfo).port; probe.close(error => error ? reject(error) : resolve(port)) })
    })
    sdkServer = await createOpenCorvusServer({ hostname: "127.0.0.1", port: sdkPort, timeout: 30_000 })
    if (binary) {
      const entries = await fs.readdir(sdkTemporary, { withFileTypes: true })
      const matches: NativeFacts[] = []
      const currentOwner = currentRuntimeProcessOccurrence()
      for (const candidate of entries) {
        if (!candidate.isDirectory() || !candidate.name.startsWith("opencorvus-node-process-")) continue
        const requestRoot = path.join(sdkTemporary, candidate.name)
        const request = await jsonFile(path.join(requestRoot, "request.json"))
        if (request?.owner_pid !== process.pid || request.owner_process_instance_id !== currentOwner.processInstanceID
          || request.executable.toLowerCase() !== binary.toLowerCase() || !request.args.includes(`--port=${sdkPort}`)) continue
        matches.push({ requestRoot, request, ready: await jsonFile(path.join(requestRoot, "ready.json")), helper: await jsonFile(path.join(requestRoot, "helper.json")) })
      }
      assert.equal(matches.length, 1, "SDK has one exact native executable/port/owner admission")
      const native = matches[0]!
      assert.equal(native.ready.protocol, 3)
      assert.equal(native.ready.detached, false)
      assert.equal(native.ready.request_id, native.request.request_id)
      const startupArgument = native.request.args.find((arg: string) => arg.startsWith("--startup-occurrence="))
      assert(startupArgument, "SDK native request carries its actual startup occurrence")
      sdkRecord.owner = { pid: native.ready.target_pid, processInstanceID: native.ready.target_process_instance_id,
        occurrenceID: startupArgument.slice("--startup-occurrence=".length), occurrenceKind: "sdk_startup" }
      sdkRecord.native = native
      sdkRecord.executable = await executableFact(sdkRecord.owner, binary)
      sdkRecord.helperOwner = { pid: native.helper.helper_pid, processInstanceID: native.helper.helper_process_instance_id, occurrenceID: native.request.request_id }
      sdkRecord.helperExecutable = await executableFact(sdkRecord.helperOwner, helper!)
    } else {
      sdkRecord.owner = await jsonFile(sdkOwnerPath)
      assert.equal(sdkRecord.owner.inJob, true)
    }
    sdkRecord.url = sdkServer.url
    const refused = await fetch(`${sdkServer.url}/restart`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
    sdkRecord.refused = { status: refused.status, body: await refused.json() }
    assert.equal(sdkRecord.refused.status, 503)
    assert.equal(sdkRecord.refused.body.data.reason, "containing_job")
    const health = await fetch(`${sdkServer.url}/global/health`)
    sdkRecord.health = { status: health.status, body: await health.json() }
    assert.equal(health.status, 200)
    await sdkServer.close()
    sdkRecord.physicalDisposition = observeRuntimeProcessOccurrence(sdkRecord.owner)
    assert.equal(sdkRecord.physicalDisposition, "dead_or_reused")
    if (binary) {
      sdkRecord.helperDisposition = observeRuntimeProcessOccurrence(sdkRecord.helperOwner)
      assert.equal(sdkRecord.helperDisposition, "dead_or_reused")
    }
    sdkRecord.status = "passed"
  } finally {
    await sdkServer?.close()
    process.chdir(previousDirectory)
    for (const [key, value] of Object.entries(previousEnvironment)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  }

  if (!binary) {
  const { beginRestartHandoff } = await import("@/server/restart-handoff")
  const handoffModule = JSON.stringify(path.resolve(import.meta.dir, "../src/server/restart-handoff.ts").replaceAll("\\", "/"))
  const failureParticipant = `const h=await import(${handoffModule});const c=h.childRestartHandoff();await h.waitForRestartBind(c);await h.sendRestartHandoffMessage({type:'failed',error:'actual child startup failure'},c);`
  for (const scenario of [
    { command: [process.execPath, "-e", "process.exit(23)"] },
    { command: [path.join(root, "missing-executable.exe")] },
    { command: [process.execPath, "-e", `${failureParticipant}await new Promise(()=>{});`], expectedError: "Error", expectedMessage: "actual child startup failure" },
    { command: [process.execPath, "-e", `const h=await import(${handoffModule});const c=h.childRestartHandoff();await h.waitForRestartBind(c);const fs=await import('node:fs/promises');const o=JSON.parse(await fs.readFile(c.root+'/restart-waiting.json','utf8'));await fs.writeFile(c.root+'/restart-failed.json',JSON.stringify({protocol:1,request_id:c.requestID,successor:{...o.successor,occurrenceID:'different-child-occurrence'},error:'wrong occurrence'}));await new Promise(()=>{});`], expectedError: "RestartHandoffEvidenceError", expectedMessage: "Restart failure does not match its complete waiting occurrence" },
  ]) {
    const command = scenario.command
    const responseText = `restored:${path.basename(command[0]!)}`
    let listener = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response(responseText) })
    const port = listener.port!
    const fault: any = { mode: "failed-replacement", command, port }
    results.push(fault)
    try {
      try {
        await beginRestartHandoff({ hostname: "127.0.0.1", port, command,
          quiesceListener: async () => { await listener.stop(true) }, settleExecution: async () => {}, releaseRuntimeState: async () => {},
          restoreListener: async () => { listener = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response(responseText) }); fault.restored = true } })
        throw new Error("Fault command unexpectedly transferred")
      } catch (error) { fault.error = { name: (error as Error).name, message: (error as Error).message } }
      if (scenario.expectedError) assert.equal(fault.error.name, scenario.expectedError)
      if (scenario.expectedMessage) assert.equal(fault.error.message, scenario.expectedMessage)
      assert.equal(fault.restored, true)
      assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), responseText)
      fault.status = "passed"
    } finally { await listener.stop(true) }
  }

  const { ProcessSupervisor } = await import("@/shell/process-supervisor")
  const { restartReplacementEnvironment } = await import("@/server/restart-handoff")
  const processEnvironment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
  const context = await ProcessSupervisor.createDetachedCommandContext()
  const primitive: any = { mode: "committed-transfer-control-and-orphan", context }
  results.push(primitive)
  const childCode = `const h=await import(${handoffModule});const c=h.childRestartHandoff();const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(request){if(new URL(request.url).pathname==='/shutdown'){setTimeout(()=>{server.stop(true);process.exit(0)},25);return new Response('ending')}return new Response('committed successor')}});await h.sendRestartHandoffMessage({type:'ready',url:server.url.toString()},c);`
  const child = await ProcessSupervisor.spawnHostCommand({ executable: process.execPath, args: ["-e", childCode], detached: context,
    env: { ...restartReplacementEnvironment(processEnvironment), OPENCORVUS_RESTART_HANDOFF: JSON.stringify({ protocol: 1, requestID: context.requestID, root: context.root, owner: context.owner, hostname: "127.0.0.1", port: 1 }) } })
  let childURL: string | undefined
  try {
    const ready = await wait("primitive application ready", () => jsonFile(path.join(context.root, "restart-ready.json")))
    childURL = ready.url
    primitive.applicationReady = ready
    primitive.release = await child.transferOwnership!(ready.successor)
    primitive.repeatedRelease = await child.transferOwnership!(ready.successor)
    assert.deepEqual(primitive.repeatedRelease, primitive.release)
    primitive.conflict = await child.transferOwnership!({ ...ready.successor, occurrenceID: "different-successor" }).catch(error => ({ name: error.name, message: error.message }))
    assert.equal(primitive.conflict.name, "ProcessOwnershipConflictError")
    primitive.oldController = await child.dispose().catch(error => ({ name: error.name, release: error.release }))
    assert.equal(primitive.oldController.name, "ProcessOwnershipTransferredError")
    assert.deepEqual(primitive.oldController.release, primitive.release)
    await fs.writeFile(path.join(context.root, "cancel"), "late predecessor control")
    primitive.liveRecovery = await ProcessSupervisor.recoverOrphanedWindowsRequests({ currentOccurrenceID: context.owner.occurrenceID })
    assert.equal(primitive.liveRecovery.retainedLive, 1)
    primitive.response = await (await fetch(childURL!)).text()
    assert.equal(primitive.response, "committed successor")
    await fetch(new URL("shutdown", childURL))
    await child.settled
    primitive.settlement = await jsonFile(path.join(context.root, "settled.json"))
    assert.equal(primitive.settlement.target_pid, ready.successor.pid)
    assert.equal(primitive.settlement.active_processes, 0)
    primitive.terminalRecovery = await ProcessSupervisor.recoverOrphanedWindowsRequests({ currentOccurrenceID: context.owner.occurrenceID })
    assert.equal(primitive.terminalRecovery.removed, 1)
    primitive.status = "passed"
  } finally {
    if (childURL) await fetch(new URL("shutdown", childURL)).catch(() => undefined)
    try { await child.dispose() } catch (error) { if (!(error instanceof ProcessSupervisor.ProcessOwnershipTransferredError)) throw error }
    await child.settled
  }

  const crashRoot = path.join(root, "owner-death-before-ready")
  await fs.mkdir(crashRoot, { recursive: true })
  const crashFact = path.join(crashRoot, "admitted.json")
  const crashPhase = path.join(crashRoot, "child-phase.json")
  const crashRelease = path.join(crashRoot, "release-owner")
  const crashScript = path.join(crashRoot, "owner.mjs")
  const supervisorModule = JSON.stringify(path.resolve(import.meta.dir, "../src/shell/process-supervisor.ts").replaceAll("\\", "/"))
  const runtimeModule = JSON.stringify(path.resolve(import.meta.dir, "../src/runtime/process-occurrence.ts").replaceAll("\\", "/"))
  const preReadyChild = `const fs=await import('node:fs');const r=await import(${runtimeModule});fs.writeFileSync(${JSON.stringify(crashPhase)},JSON.stringify({phase:'before_application_ready',owner:r.currentRuntimeProcessOccurrence()}));setInterval(()=>{},1000);`
  await fs.writeFile(crashScript, [
    "import fs from 'node:fs';",
    `process.env.OPENCORVUS_HOME=${JSON.stringify(path.join(crashRoot, "home"))};process.env.OPENCORVUS_TEST_HOME=process.env.OPENCORVUS_HOME;process.env.OPENCORVUS_TEST_PROCESS_ROOT=${JSON.stringify(root)};process.env.OPENCORVUS_PROCESS_SUPERVISOR=${JSON.stringify(helper)};`,
    `const {ProcessSupervisor:p}=await import(${supervisorModule});const r=await import(${runtimeModule});const context=await p.createDetachedCommandContext();`,
    `const child=await p.spawnHostCommand({executable:process.execPath,args:['-e',${JSON.stringify(preReadyChild)}],detached:context});`,
    `while(!fs.existsSync(${JSON.stringify(crashPhase)}))await Bun.sleep(10);fs.writeFileSync(${JSON.stringify(crashFact)},JSON.stringify({context,childPID:child.pid,owner:r.currentRuntimeProcessOccurrence()}));const deadline=Date.now()+15000;while(!fs.existsSync(${JSON.stringify(crashRelease)})&&Date.now()<deadline)await Bun.sleep(10);process.exit(52);`,
  ].join("\n"))
  const crash: any = { mode: "owner-death-before-ready", launch: await launchStandalone({ executable: process.execPath, args: [crashScript] }) }
  results.push(crash)
  crash.admitted = await wait("pre-ready target admission", () => jsonFile(crashFact))
  crash.phase = await jsonFile(crashPhase)
  assert.equal(crash.phase.phase, "before_application_ready")
  await fs.writeFile(crashRelease, "end exact owner before application Ready")
  crash.nativeReady = await jsonFile(path.join(crash.admitted.context.root, "ready.json"))
  assert.equal(crash.nativeReady.target_pid, crash.phase.owner.pid)
  assert.equal(crash.nativeReady.target_process_instance_id, crash.phase.owner.processInstanceID)
  crash.settlement = await wait("owner death native exact target settlement", () => jsonFile(path.join(crash.admitted.context.root, "settled.json")))
  assert.equal(crash.settlement.target_pid, crash.phase.owner.pid)
  assert.equal(crash.settlement.active_processes, 0)
  crash.ownerDisposition = observeRuntimeProcessOccurrence(crash.admitted.owner)
  crash.targetDisposition = observeRuntimeProcessOccurrence(crash.phase.owner)
  assert.equal(crash.ownerDisposition, "dead_or_reused")
  assert.equal(crash.targetDisposition, "dead_or_reused")
  crash.status = "passed"
  }
  assert.equal(results.length, binary ? 6 : 12, "The selected qualification profile ran all of its cases")
} catch (error) { failure = error; process.exitCode = 1 }
finally {
  await fs.mkdir(path.dirname(resultPath), { recursive: true })
  await fs.writeFile(resultPath, JSON.stringify({ status: failure ? "failed" : "passed", ...provenance, root, helper, cases: results,
    error: failure instanceof Error ? { name: failure.name, message: failure.message, stack: failure.stack,
      ...(failure instanceof AggregateError ? { causes: failure.errors.map(error => String(error)) } : {}) } : failure,
    limits: ["Credential-free Windows qualification; POSIX, Docker and GUI unverified",
      ...(binary ? ["Compiled HTTP/SDK profile; source-only primitive fault/crash/orphan cases belong to the separate source profile"] : [])] }, null, 2))
  console.log(`[restart-check] ${failure ? "failed" : "passed"} ${resultPath}`)
}
