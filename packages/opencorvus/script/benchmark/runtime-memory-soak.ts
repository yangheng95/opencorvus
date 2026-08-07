import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import {
  classifyProcess,
  directoryBytes,
  fileBytes,
  footprintsAboveControlCeiling,
  parseProcessTable,
  processTree,
  validateConfig,
  type ProcessRow,
} from "./runtime-memory-soak-support"

const CONFIG_PATH = path.join(import.meta.dir, "runtime-memory-soak.config.json")

type AllocatorSnapshot = {
  pid: number
  uptimeMs: number
  process: {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
  }
  providers: Record<string, unknown>
}

type Checkpoint = {
  at: string
  label: string
  servePid: number
  physicalFootprintBytes?: number
  allocator?: AllocatorSnapshot
  processTree: ProcessRow[]
  processBytes: Record<string, { count: number; rssBytes: number }>
  disk: {
    traceBytes: number
    logBytes: number
    databaseBytes: number
    walBytes: number
    runtimeBytes: number
  }
}

type ControlEnvelope = {
  minPhysicalFootprintBytes: number
  maxPhysicalFootprintBytes: number
  reports: string[]
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function flags(name: string): string[] {
  const values: string[] = []
  for (let index = 0; index < process.argv.length; index++) {
    if (process.argv[index] !== name) continue
    const value = process.argv[index + 1]
    if (value) values.push(path.resolve(value))
  }
  return values
}

function requiredFlag(name: string): string {
  const value = flag(name)
  if (!value) throw new Error(`${name} is required`)
  return path.resolve(value)
}

async function readControlEnvelope(reportPaths: string[], expectedRuns: number): Promise<ControlEnvelope> {
  if (reportPaths.length !== expectedRuns) {
    throw new Error(`Exactly ${expectedRuns} --control-report values are required for a workload run`)
  }
  const footprints: number[] = []
  for (const reportPath of reportPaths) {
    const report = JSON.parse(await fs.readFile(reportPath, "utf8")) as {
      mode?: unknown
      accepted?: unknown
      checkpoints?: Array<{ physicalFootprintBytes?: unknown }>
    }
    if (report.mode !== "control" || report.accepted !== true || !Array.isArray(report.checkpoints)) {
      throw new Error(`Control report is not an accepted control run: ${reportPath}`)
    }
    for (const checkpoint of report.checkpoints) {
      if (typeof checkpoint.physicalFootprintBytes === "number") {
        footprints.push(checkpoint.physicalFootprintBytes)
      }
    }
  }
  if (footprints.length === 0) throw new Error("Control reports contain no macOS physical-footprint samples")
  return {
    minPhysicalFootprintBytes: Math.min(...footprints),
    maxPhysicalFootprintBytes: Math.max(...footprints),
    reports: reportPaths,
  }
}

function timer(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function currentProcessRows(): ProcessRow[] {
  const result = Bun.spawnSync(["ps", "-axo", "pid=,ppid=,pgid=,rss=,command="], {
    stdout: "pipe",
    stderr: "pipe",
  })
  if (result.exitCode !== 0) throw new Error(`ps failed: ${result.stderr.toString().trim()}`)
  return parseProcessTable(result.stdout.toString())
}

function physicalFootprintBytes(pid: number): number | undefined {
  if (process.platform !== "darwin") return undefined
  const result = Bun.spawnSync(["footprint", "-p", String(pid)], { stdout: "pipe", stderr: "pipe" })
  if (result.exitCode !== 0) return undefined
  const match = result.stdout.toString().match(/Footprint:\s+([\d.]+)\s+([KMG])B/i)
  if (!match) return undefined
  const scale = match[2]!.toUpperCase() === "G" ? 1024 ** 3 : match[2]!.toUpperCase() === "M" ? 1024 ** 2 : 1024
  return Math.round(Number(match[1]) * scale)
}

function processBytes(rows: readonly ProcessRow[]) {
  const result: Record<string, { count: number; rssBytes: number }> = {}
  for (const row of rows) {
    const kind = classifyProcess(row.command)
    const current = result[kind] ?? { count: 0, rssBytes: 0 }
    current.count++
    current.rssBytes += row.rssBytes
    result[kind] = current
  }
  return result
}

async function scaffoldProject(input: {
  project: string
  typescriptPackage: string
  eslintServer: string
  node: string
  controlEnvelope?: ControlEnvelope
}) {
  const { project, typescriptPackage, eslintServer, node } = input
  await fs.mkdir(path.join(project, ".opencorvus"), { recursive: true })
  await fs.mkdir(path.join(project, "node_modules"), { recursive: true })
  await fs.writeFile(
    path.join(project, "package.json"),
    JSON.stringify(
      {
        name: "opencorvus-runtime-memory-soak",
        private: true,
        type: "module",
        devDependencies: { typescript: "5.8.2" },
      },
      null,
      2,
    ),
  )
  await fs.copyFile(path.resolve(import.meta.dir, "../../../../bun.lock"), path.join(project, "bun.lock"))
  await fs.symlink(typescriptPackage, path.join(project, "node_modules", "typescript"), "dir")
  await fs.writeFile(path.join(project, "index.ts"), "export const runtimeMemorySoakSentinel = 1\n")
  await fs.writeFile(path.join(project, "eslint.config.js"), "export default []\n")
  await fs.writeFile(
    path.join(project, ".opencorvus", "opencorvus.json"),
    JSON.stringify(
      {
        lsp: {
          typescript: {
            command: [process.execPath, "x", "typescript-language-server", "--stdio"],
            extensions: [".ts"],
          },
          eslint: {
            command: [node, eslintServer, "--stdio"],
            extensions: [".ts"],
          },
        },
      },
      null,
      2,
    ),
  )
}

async function waitForServerUrl(lines: string[], exited: Promise<number>): Promise<string> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const joined = lines.join("")
    const match = joined.match(/opencorvus server listening on (http:\/\/[^\s]+)/)
    if (match) return match[1]!
    const outcome = await Promise.race([
      exited.then((code) => ({ type: "exit" as const, code })),
      timer(100).then(() => ({ type: "tick" as const })),
    ])
    if (outcome.type === "exit") throw new Error(`Packaged serve exited before readiness with code ${outcome.code}`)
  }
  throw new Error("Packaged serve did not publish its random-port URL within 15 seconds")
}

function observeAllocatorLine(text: string, snapshots: AllocatorSnapshot[]) {
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes("runtime.memory.metrics")) continue
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>
      const candidate = (parsed.snapshot ?? parsed) as Partial<AllocatorSnapshot>
      if (
        typeof candidate.pid === "number" &&
        typeof candidate.uptimeMs === "number" &&
        candidate.process &&
        candidate.providers
      ) {
        snapshots.push(candidate as AllocatorSnapshot)
      }
    } catch {}
  }
}

async function runBrowserCycle(
  binary: string,
  project: string,
  env: NodeJS.ProcessEnv,
  sampleActive: () => Promise<void>,
) {
  const transport = new StdioClientTransport({
    command: binary,
    args: ["mcp", "browser"],
    cwd: project,
    env: env as Record<string, string>,
    stderr: "pipe",
  })
  const client = new Client({ name: "runtime-memory-soak", version: "1.0.0" })
  try {
    await client.connect(transport)
    const created = await client.callTool({ name: "session_create", arguments: { virtualCursor: false } })
    const structured = created.structuredContent as { sessionId?: unknown } | undefined
    if (typeof structured?.sessionId !== "string") {
      throw new Error(`Browser MCP session_create did not return sessionId: ${JSON.stringify(created)}`)
    }
    await client.callTool({
      name: "tabs",
      arguments: { sessionId: structured.sessionId, action: "new", url: "about:blank" },
    })
    await sampleActive()
    await client.callTool({
      name: "session_destroy",
      arguments: { sessionId: structured.sessionId },
    })
  } finally {
    await client.close()
  }
}

async function runLspCycle(
  binary: string,
  project: string,
  env: NodeJS.ProcessEnv,
  sampleActive: (sample: number) => Promise<void>,
) {
  const lsp = await ProcessSupervisor.spawnHostCommand({
    executable: binary,
    args: ["--print-logs", "debug", "lsp", "diagnostics", path.join(project, "index.ts")],
    cwd: project,
    env: {
      ...env,
      OPENCORVUS_RUNTIME_MEMORY_METRICS_INTERVAL_MS: "0",
    },
    owner: "runtime-memory-soak-lsp",
    gracefulTerminationMs: 10_000,
  })
  const stderrTail: Buffer[] = []
  let stderrTailBytes = 0
  const stderrTailLimitBytes = 32 * 1024
  lsp.stderr?.on("data", (chunk: Buffer) => {
    stderrTail.push(chunk)
    stderrTailBytes += chunk.byteLength
    while (stderrTailBytes > stderrTailLimitBytes && stderrTail.length > 1) {
      stderrTailBytes -= stderrTail.shift()!.byteLength
    }
  })
  let settled = false
  const exitOutcome = lsp.exited.then(
    (code) => {
      settled = true
      return code
    },
    (error) => {
      settled = true
      throw error
    },
  )
  for (let sample = 1; sample <= 60 && !settled; sample++) {
    await Promise.race([timer(500), exitOutcome.then(() => undefined)])
    if (!settled) await sampleActive(sample)
  }
  const code = await ProcessSupervisor.awaitWithTimeout(
    exitOutcome,
    120_000,
    "Packaged LSP diagnostics did not exit within 120 seconds",
  )
  await ProcessSupervisor.disposeAndWaitForExit(lsp, "runtime memory soak packaged LSP diagnostics")
  if (code !== 0) {
    const stderr = Buffer.concat(stderrTail)
    const boundedStderr = stderr.subarray(Math.max(0, stderr.byteLength - stderrTailLimitBytes)).toString()
    throw new Error(`Packaged LSP diagnostics failed with code ${code}; stderr tail: ${boundedStderr}`)
  }
}

async function runOnce(input: {
  binary: string
  evidenceRoot: string
  config: ReturnType<typeof validateConfig>
  overnight: boolean
  control: boolean
  runIndex: number
  typescriptPackage: string
  eslintServer: string
  node: string
}) {
  const {
    binary,
    evidenceRoot,
    config,
    overnight,
    control,
    runIndex,
    typescriptPackage,
    eslintServer,
    node,
    controlEnvelope,
  } = input
  const durationMs = overnight
    ? config.overnightDurationMs
    : control
      ? config.controlDurationMs
      : config.shortSoakDurationMs
  const runRoot = path.join(
    evidenceRoot,
    `${new Date().toISOString().replaceAll(":", "-")}-${process.pid}-run-${runIndex}`,
  )
  const project = path.join(runRoot, "project")
  const portableHome = path.join(runRoot, "home")
  const temp = path.join(runRoot, "tmp")
  const logs = path.join(runRoot, "serve.log")
  const reportPath = path.join(runRoot, "report.json")
  await Promise.all([
    fs.mkdir(portableHome, { recursive: true }),
    fs.mkdir(temp, { recursive: true }),
    scaffoldProject({ project, typescriptPackage, eslintServer, node }),
  ])

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OPENCORVUS_HOME: portableHome,
    OPENCORVUS_PROJECT_DIR: project,
    OPENCORVUS_RUNTIME_MEMORY_METRICS_INTERVAL_MS: String(config.snapshotCadenceMs),
    TMPDIR: temp,
  }
  const output: string[] = []
  const allocatorSnapshots: AllocatorSnapshot[] = []
  const discoveredPids = new Set<number>()
  const checkpoints: Checkpoint[] = []
  const errors: string[] = []
  const serve = await ProcessSupervisor.spawnHostCommand({
    executable: binary,
    args: ["serve", "--hostname", "127.0.0.1", "--port", "0", "--project-dir", project, "--print-logs"],
    cwd: project,
    env,
    owner: "runtime-memory-soak-serve",
    gracefulTerminationMs: 10_000,
  })
  const capture = (chunk: Buffer | string) => {
    const text = chunk.toString()
    output.push(text)
    observeAllocatorLine(text, allocatorSnapshots)
  }
  serve.stdout?.on("data", capture)
  serve.stderr?.on("data", capture)

  const sample = async (label: string) => {
    const allRows = currentProcessRows()
    const tree = processTree(allRows, [serve.pid, process.pid]).filter(
      (row) => row.pid !== process.pid && !/^ps\s+-axo\s/.test(row.command),
    )
    for (const row of tree) discoveredPids.add(row.pid)
    const database = path.join(portableHome, "data", "opencorvus.db")
    const checkpoint: Checkpoint = {
      at: new Date().toISOString(),
      label,
      servePid: serve.pid,
      physicalFootprintBytes: physicalFootprintBytes(serve.pid),
      allocator: allocatorSnapshots.at(-1),
      processTree: tree,
      processBytes: processBytes(tree),
      disk: {
        traceBytes: await directoryBytes(path.join(project, ".opencorvus", ".r")),
        logBytes: await directoryBytes(path.join(portableHome, "data", "log")),
        databaseBytes: await fileBytes(database),
        walBytes: await fileBytes(`${database}-wal`),
        runtimeBytes: await directoryBytes(runRoot),
      },
    }
    checkpoints.push(checkpoint)
  }

  try {
    await waitForServerUrl(output, serve.exited)
    await sample("ready")
    await timer(config.warmupMs)
    await sample("warm")
    if (!control) {
      for (let cycle = 0; cycle < config.browserCycles; cycle++) {
        await runBrowserCycle(binary, project, env, () => sample(`browser-cycle-${cycle + 1}-active`))
        await sample(`browser-cycle-${cycle + 1}-settled`)
      }
      for (let cycle = 0; cycle < config.lspQueries; cycle++) {
        await runLspCycle(binary, project, env, (activeSample) =>
          sample(`lsp-cycle-${cycle + 1}-active-${activeSample}`),
        )
        await sample(`lsp-cycle-${cycle + 1}-settled`)
      }
    }
    const soakDeadline = Date.now() + durationMs
    let snapshot = 0
    while (Date.now() < soakDeadline) {
      await timer(Math.min(config.snapshotCadenceMs, soakDeadline - Date.now()))
      await sample(`soak-${++snapshot}`)
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.stack ?? error.message : String(error))
  } finally {
    try {
      await ProcessSupervisor.terminateAndWaitForExit(serve, "runtime memory soak serve", {
        cleanupTimeoutMs: 15_000,
        exitTimeoutMs: 5_000,
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.stack ?? error.message : String(error))
    }
    await timer(config.idleSettleMs)
    await fs.writeFile(logs, output.join(""), "utf8")
  }

  const finalRows = currentProcessRows()
  const remaining = finalRows.filter((row) => discoveredPids.has(row.pid))
  if (remaining.length > 0) {
    errors.push(`Attributable processes remained after settle: ${JSON.stringify(remaining)}`)
  }
  if (controlEnvelope) {
    const steadySamples = checkpoints
      .filter((checkpoint) => checkpoint.label.startsWith("soak-"))
      .map((checkpoint) => checkpoint.physicalFootprintBytes)
    if (steadySamples.length === 0 || steadySamples.some((sample) => sample === undefined)) {
      errors.push("Workload run did not produce a complete macOS steady-state physical-footprint series")
    } else {
      const aboveControlCeiling = footprintsAboveControlCeiling(
        steadySamples.filter((sample): sample is number => typeof sample === "number"),
        controlEnvelope.maxPhysicalFootprintBytes,
      )
      if (aboveControlCeiling.length > 0) {
        errors.push(
          `Steady-state physical footprint exceeded the immutable control ceiling ` +
            `${controlEnvelope.maxPhysicalFootprintBytes}: ${aboveControlCeiling.join(", ")}`,
        )
      }
    }
  }
  const report = {
    schemaVersion: 1,
    mode: overnight ? "overnight" : control ? "control" : "repair",
    binary,
    runRoot,
    config,
    controlEnvelope,
    host: { platform: process.platform, arch: process.arch, release: os.release() },
    checkpoints,
    allocatorSnapshots,
    discoveredPids: [...discoveredPids].sort((a, b) => a - b),
    remaining,
    errors,
    accepted: errors.length === 0,
  }
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  console.log(reportPath)
  if (errors.length > 0) process.exitCode = 1
}

async function main() {
  const binary = requiredFlag("--binary")
  const evidenceRoot = requiredFlag("--evidence-dir")
  const typescriptPackage = requiredFlag("--typescript-package")
  const eslintServer = requiredFlag("--eslint-server")
  const node = requiredFlag("--node")
  const config = validateConfig(JSON.parse(await fs.readFile(CONFIG_PATH, "utf8")))
  const overnight = process.argv.includes("--overnight")
  const control = process.argv.includes("--control")
  const controlEnvelope = control
    ? undefined
    : await readControlEnvelope(flags("--control-report"), config.controlRuns)
  const runs = control ? config.controlRuns : 1
  for (let runIndex = 1; runIndex <= runs; runIndex++) {
    await runOnce({
      binary,
      evidenceRoot,
      config,
      overnight,
      control,
      runIndex,
      typescriptPackage,
      eslintServer,
      node,
      controlEnvelope,
    })
  }
}

await main()
