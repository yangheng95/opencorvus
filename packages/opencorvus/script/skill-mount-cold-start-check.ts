/** Real isolated source HTTP timing; no Provider, UI, synthetic delay or alternative Skill owner. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createWriteStream } from "node:fs"
import { finished } from "node:stream/promises"
import path from "node:path"
import net from "node:net"
import { setTimeout as delay } from "node:timers/promises"
import { NodeProcess } from "@opencorvus-ai/util/process-node"
import type { ProcessHandle, ProcessTerminalReceipt, ProcessByteSource } from "@opencorvus-ai/util/process"
import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
  removeIsolatedTestRuntime,
} from "@opencorvus-ai/util/test-runtime-environment"
import { expectedTestProcessSupervisor } from "./test-process-supervisor"
import { transportRequestSignal } from "../../overlay/src/services/host-transport"
import type { SkillMount } from "../src/skill/mounts"

const outputIndex = process.argv.indexOf("--output")
assert(outputIndex >= 0 && process.argv[outputIndex + 1], "--output <new-owned-directory> is required")
const output = path.resolve(process.argv[outputIndex + 1]!)
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.mkdir(output)
const helper = expectedTestProcessSupervisor()
assert(helper && (await fs.stat(helper)).isFile(), "Existing native test supervisor is required; no implicit build")
const hostKeys = new Set(["path", "systemroot", "windir", "comspec", "pathext", "lang", "lc_all"])
for (const key of Object.keys(process.env)) if (!hostKeys.has(key.toLowerCase())) delete process.env[key]
const runtime = await bootstrapIsolatedTestRuntime("test")
process.env.OPENCORVUS_PROCESS_SUPERVISOR = helper
const childEnvironment = isolatedTestChildEnvironment(runtime)
const { currentRuntimeProcessOccurrence, observedProcessOccurrence, observeRuntimeProcessOccurrence } = await import(
  "../src/runtime/process-occurrence"
)
const parent = currentRuntimeProcessOccurrence()
const port = 17947
const packageRoot = path.resolve(import.meta.dir, "..")
const result: Record<string, unknown> = {
  status: "running",
  startedAt: new Date().toISOString(),
  output,
  parent,
  port,
  runtime,
  cases: [],
  qualification:
    "Actual isolated source HTTP and diagnostic phases; no UI/Provider/model or original human Skill-tree reproduction",
}
const cases = result.cases as Array<Record<string, unknown>>
type Row = Record<string, any>

async function portFree() {
  const probe = net.createServer()
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject)
    probe.listen(port, "127.0.0.1", () => probe.close((error) => (error ? reject(error) : resolve())))
  })
}

async function processFact(pid: number) {
  const script = `Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'|Select-Object ProcessId,ParentProcessId,ExecutablePath,CreationDate|ConvertTo-Json -Compress`
  const query = await NodeProcess.run({
    command: {
      executable: "powershell.exe",
      args: ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
    },
    ownership: "owned_tree",
    timeoutMs: 15_000,
  })
  assert.equal(query.receipt.exitCode, 0)
  return JSON.parse(new TextDecoder().decode(query.stdout)) as {
    ProcessId: number
    ParentProcessId: number
    ExecutablePath: string
    CreationDate: string
  }
}

async function fixture(count: number) {
  const root = path.join(runtime.runtimeRoot, "skill-mount-latency", `n${String(count).padStart(2, "0")}`)
  const projects = { a: path.join(root, "project-a"), b: path.join(root, "project-b") }
  const names = { a: [] as string[], b: [] as string[] }
  let bytes = 0
  let files = 0
  for (const side of ["a", "b"] as const) {
    await fs.mkdir(projects[side], { recursive: true })
    for (let i = 0; i < count; i++) {
      const name = `owned-${side}-${String(i).padStart(2, "0")}`
      names[side].push(name)
      const directory = path.join(projects[side], ".opencorvus", "skills", name)
      await fs.mkdir(directory, { recursive: true })
      const text = `---\nname: ${name}\ndescription: Owned ${side} fixture ${i}.\n---\n\nOwned timing fixture.\n`
      await fs.writeFile(path.join(directory, "SKILL.md"), text, { flag: "wx" })
      bytes += Buffer.byteLength(text)
      files++
      for (const part of ["scripts", "agents", "references", "templates"]) {
        await fs.mkdir(path.join(directory, part))
        await fs.writeFile(path.join(directory, part, "owned.txt"), "Owned harmless text.\n", { flag: "wx" })
        bytes += Buffer.byteLength("Owned harmless text.\n")
        files++
      }
    }
  }
  await fs.mkdir(path.join(root, "launch"))
  return { root, projects, names, count, files, bytes }
}

async function occurrence(input: Awaited<ReturnType<typeof fixture>>, mode: "serial" | "restart-parallel") {
  await portFree()
  const occurrenceID = crypto.randomUUID()
  const prefix = `n${input.count}-${mode}`
  const receiptPath = path.join(output, `${prefix}.startup.json`)
  const serverLog = path.join(output, `${prefix}.server.log`)
  const writer = createWriteStream(serverLog, { flags: "wx" })
  const writerFinished = finished(writer)
  const rows: Row[] = []
  const observations: Array<Record<string, unknown>> = []
  const fact: Record<string, unknown> = {
    count: input.count,
    mode,
    occurrenceID,
    files: input.files,
    bytes: input.bytes,
    root: input.root,
    projects: input.projects,
    observations,
    preflight: "loopback port bind/close succeeded",
  }
  cases.push(fact)
  console.log(
    JSON.stringify({
      phase: "owned-preflight",
      count: input.count,
      mode,
      root: input.root,
      port,
      occurrenceID,
      helper,
    }),
  )
  let child: ProcessHandle | undefined
  let terminal: ProcessTerminalReceipt | undefined
  let owner: ReturnType<typeof observedProcessOccurrence>
  let helperOwner: ReturnType<typeof observedProcessOccurrence>
  let drained: Promise<void[]> | undefined
  let settlement: Promise<void> | undefined
  let ready = false
  let baseURL = ""
  const drain = async (source: ProcessByteSource | null) => {
    if (!source) return
    let pending = ""
    const decoder = new TextDecoder()
    for await (const chunk of source) {
      writer.write(chunk)
      pending += decoder.decode(chunk, { stream: true })
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.startsWith("{")) continue
        try {
          rows.push(JSON.parse(line))
        } catch {
          /* CLI also emits non-JSON diagnostics. */
        }
      }
    }
  }
  const projection = (matrix: SkillMount.Matrix, side: "a" | "b") => {
    assert.equal(matrix.scope, "project")
    assert(Array.isArray(matrix.skills) && Array.isArray(matrix.agents) && Array.isArray(matrix.matrix))
    const fixtureNames = new Set([...input.names.a, ...input.names.b])
    const actual = matrix.skills
      .filter((skill) => fixtureNames.has(skill.name))
      .map((skill) => ({ name: skill.name, ref: skill.ref, risk: skill.risk }))
      .sort((a, b) => a.name.localeCompare(b.name))
    assert.deepEqual(
      actual,
      input.names[side].map((name) => ({
        name,
        ref: `default/skill/${name}`,
        risk: { level: "high", has_scripts: true, has_agents: true, has_references: true, has_templates: true },
      })),
    )
    return {
      scope: matrix.scope,
      activeProfile: matrix.active_profile,
      fixtureSkills: actual,
      totalSkills: matrix.skills.length,
      agents: matrix.agents.map((agent) => agent.agent_id),
      grants: matrix.matrix.map((row) => ({ agent: row.agent_id, grants: row.grants.length })),
    }
  }
  const read = async (label: string, side: "a" | "b", signal?: AbortSignal) => {
    const started = performance.now()
    const url = new URL("/skill/mounts", baseURL)
    url.searchParams.set("directory", input.projects[side])
    try {
      const response = await fetch(url, { signal: transportRequestSignal({ signal }) })
      const requestID = response.headers.get("x-opencorvus-request-id")
      const body = (await response.json()) as SkillMount.Matrix
      observations.push({
        label,
        side,
        status: response.status,
        requestID,
        elapsedMilliseconds: performance.now() - started,
      })
      assert.equal(response.status, 200, `${label} HTTP status`)
      assert(requestID, "Actual HTTP request identity")
      const value = projection(body, side)
      Object.assign(observations.at(-1)!, { projection: value })
      return { outcome: "completed" as const, value, requestID }
    } catch (error) {
      if (signal?.aborted && error instanceof DOMException && error.name === "AbortError") {
        observations.push({
          label,
          side,
          outcome: "caller-aborted",
          errorType: "AbortError",
          elapsedMilliseconds: performance.now() - started,
        })
        return { outcome: "caller-aborted" as const }
      }
      throw error
    }
  }
  try {
    const args = [
      path.join(packageRoot, "src/index.ts"),
      "serve",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
      "--startup-receipt",
      receiptPath,
      "--startup-occurrence",
      occurrenceID,
      "--parent-pid",
      String(parent.pid),
      "--parent-process-instance-id",
      parent.processInstanceID,
      "--print-logs",
      "--log-level",
      "DEBUG",
    ]
    fact.command = { executable: process.execPath, args, cwd: path.join(input.root, "launch") }
    await fs.writeFile(path.join(output, `${prefix}.launch.json`), JSON.stringify(fact, null, 2), { flag: "wx" })
    child = await NodeProcess.spawn({
      command: { executable: process.execPath, args },
      cwd: path.join(input.root, "launch"),
      ownership: "owned_tree",
      occurrenceID,
      windowsHide: true,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...childEnvironment,
        OPENCORVUS_HOME: input.root,
        OPENCORVUS_DISABLE_EXTERNAL_SKILLS: "1",
        OPENCORVUS_DISABLE_AUTOUPDATE: "1",
      },
    })
    drained = Promise.all([drain(child.stdout), drain(child.stderr)])
    settlement = child.settled.then((receipt) => {
      terminal = receipt
    })
    owner = observedProcessOccurrence(child.pid)
    assert(owner, "Physical source child fingerprint")
    fact.owner = owner
    fact.actualChild = await processFact(child.pid)
    const actualChild = fact.actualChild as Awaited<ReturnType<typeof processFact>>
    helperOwner = observedProcessOccurrence(actualChild.ParentProcessId)
    assert(helperOwner, "Physical helper fingerprint")
    fact.helperOwner = helperOwner
    const actualHelper = await processFact(helperOwner.pid)
    fact.actualHelper = actualHelper
    assert.equal(
      (await fs.realpath(actualHelper.ExecutablePath)).toLowerCase(),
      (await fs.realpath(helper!)).toLowerCase(),
    )
    const deadline = Date.now() + 35_000
    while (Date.now() < deadline) {
      if (terminal) throw new Error("Owned server exited before startup receipt")
      try {
        const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"))
        assert.equal(receipt.occurrenceID, occurrenceID)
        assert.equal(receipt.pid, child.pid)
        assert.equal(receipt.outcome, "listening")
        baseURL = receipt.url
        assert.equal(new URL(baseURL).origin, `http://127.0.0.1:${port}`)
        fact.startup = receipt
        ready = true
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
      await delay(100)
    }
    assert(ready, "Owned server startup receipt deadline")
    assert.equal(observeRuntimeProcessOccurrence(owner), "exact_live")
    const health = await fetch(`${baseURL}/global/health`, { signal: transportRequestSignal({}) })
    assert.equal(health.status, 200)
    const healthBody = (await health.json()) as { healthy: boolean; paths: { data: string; home: string } }
    assert.equal(healthBody.healthy, true)
    assert.equal(path.resolve(healthBody.paths.data), path.resolve(input.root, "data"))
    assert.equal(path.resolve(healthBody.paths.home), path.join(runtime.processRoot, "home"))
    fact.health = { status: health.status, requestID: health.headers.get("x-opencorvus-request-id"), ...healthBody }
    fact.metadataFiles = Object.fromEntries(
      await Promise.all(
        ["auth.json", "models.json"].map(async (name) => {
          const stat = await fs.stat(path.join(input.root, "data", name)).catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return undefined
            throw error
          })
          return [name, stat ? { present: true, size: stat.size } : { present: false }] as const
        }),
      ),
    )
    if (mode === "serial") {
      const first = await read("first-a", "a")
      const warm = await read("warm-a", "a")
      assert.equal(first.outcome, "completed")
      assert.equal(warm.outcome, "completed")
      assert.deepEqual(warm.value, first.value)
      await read("first-b", "b")
      await Promise.all([read("parallel-a1", "a"), read("parallel-a2", "a"), read("parallel-b", "b")])
    } else if (input.count === 32) {
      const controller = new AbortController()
      const offset = rows.length
      let completed = false
      const first = read("cancel-observation-a", "a", controller.signal).finally(() => {
        completed = true
      })
      const deadline = Date.now() + 15_000
      while (
        !completed &&
        Date.now() < deadline &&
        !rows
          .slice(offset)
          .some(
            (row) =>
              row.service === "skill-read-diagnostics" && row.phase === "state.initialize" && row.status === "started",
          )
      )
        await delay(10)
      const candidates = rows
        .slice(offset)
        .filter((row) => row.service === "server" && row.path === "/skill/mounts" && row.status === "started")
      fact.cancelRequestID = candidates.length === 1 ? candidates[0].requestID : null
      if (!completed) controller.abort(new DOMException("Owned caller cancellation", "AbortError"))
      fact.cancelOutcome = await first
      await Promise.all([read("post-cancel-a", "a"), read("parallel-b", "b")])
      await read("settled-a", "a")
    } else {
      await Promise.all([read("first-parallel-a1", "a"), read("first-parallel-a2", "a"), read("first-parallel-b", "b")])
    }
    fact.status = "http-completed"
  } catch (error) {
    fact.status = "failed"
    fact.failure = {
      type: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    }
    throw error
  } finally {
    try {
      if (child) {
        if (ready && !terminal) {
          const response = await fetch(`${baseURL}/shutdown`, { method: "POST", signal: transportRequestSignal({}) })
          fact.shutdown = { status: response.status, body: await response.json() }
          await Promise.race([settlement, delay(20_000, undefined, { ref: false })])
        }
      }
    } finally {
      try {
        if (child) {
          fact.disposal = await child.dispose()
          terminal = await child.settled
          await drained
        }
      } finally {
        writer.end()
        await writerFinished
      }
      fact.terminal = terminal
      fact.physicalOwner = owner ? observeRuntimeProcessOccurrence(owner) : "unavailable"
      fact.physicalHelper = helperOwner ? observeRuntimeProcessOccurrence(helperOwner) : "unavailable"
      await portFree()
      fact.finalPort = "free"
      const selected = rows
        .filter(
          (row) =>
            row.service === "skill-read-diagnostics" ||
            (row.service === "server" &&
              row.message === "request" &&
              ["/skill/mounts", "/global/health", "/shutdown"].includes(row.path)),
        )
        .map((row) =>
          row.service === "skill-read-diagnostics"
            ? row
            : {
                service: row.service,
                requestID: row.requestID,
                method: row.method,
                path: row.path,
                status: row.status,
                statusCode: row.statusCode,
                duration: row.duration,
                time: row.time,
              },
        )
      await fs.writeFile(path.join(output, `${prefix}.phases.json`), JSON.stringify(selected, null, 2), { flag: "wx" })
      fact.diagnosticRows = selected.length
      const diagnostics = selected.filter((row) => row.service === "skill-read-diagnostics")
      const initializations = diagnostics.filter(
        (row) => row.phase === "state.initialize" && row.status === "completed",
      )
      fact.timing = {
        diagnosticRows: diagnostics.length,
        initializations: initializations.length,
        dispositions: diagnostics
          .filter((row) => row.phase === "state.read" && row.status === "completed")
          .map((row) => row.disposition),
        startupInitializations: initializations.filter((row) => row.http?.requestID === null).length,
      }
      assert(
        initializations.length > 0,
        "Actual initializers must be observed; HTTP success alone is not timing qualification",
      )
      for (const observation of observations.filter((entry) => entry.status === 200)) {
        const requestEvents = diagnostics.filter(
          (row) => row.phase === "request" && row.http?.requestID === observation.requestID,
        )
        assert.deepEqual(
          requestEvents.map((row) => row.status),
          ["started", "completed"],
          "Actual HTTP request identity must correlate with balanced diagnostics",
        )
      }
      const started = diagnostics
        .filter((row) => row.status === "started")
        .map((row) => row.spanID)
        .sort()
      const completed = diagnostics
        .filter((row) => row.status === "completed")
        .map((row) => row.spanID)
        .sort()
      assert.deepEqual(completed, started, "Real diagnostic phases settle exactly their started spans")
      await fs.writeFile(path.join(output, `${prefix}.result.json`), JSON.stringify(fact, null, 2), { flag: "wx" })
      assert.equal(terminal?.exitCode, 0)
      assert.equal(terminal?.reason, "exited")
      assert.equal(fact.physicalOwner, "dead_or_reused")
      assert.equal(fact.physicalHelper, "dead_or_reused")
      console.log(
        JSON.stringify({
          phase: "owned-settled",
          count: input.count,
          mode,
          exitCode: terminal?.exitCode,
          owner: fact.physicalOwner,
          helper: fact.physicalHelper,
          port: fact.finalPort,
        }),
      )
    }
  }
}

try {
  for (const count of [0, 1, 32]) {
    const input = await fixture(count)
    await occurrence(input, "serial")
    await occurrence(input, "restart-parallel")
  }
  result.status = "passed"
} catch (error) {
  result.status = "failed"
  result.error = {
    type: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
  }
  process.exitCode = 1
} finally {
  result.completedAt = new Date().toISOString()
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify(result, null, 2), { flag: "wx" })
  await removeIsolatedTestRuntime(runtime)
}
console.log(JSON.stringify({ status: result.status, output, cases: cases.length }))
