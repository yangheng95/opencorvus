import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { createRequire } from "node:module"
import { auditNativeBatchSettlement, auditNativeTerminalEnvelope, parseNativeCaseIndexes } from "./native-run-contract"
import {
  createBenchmarkAdmissionGate,
  createBenchmarkRunnerStopController,
  installBenchmarkTerminationHandlers,
} from "./process-lifecycle"

const values = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith("--") || value === undefined) throw new Error("Expected --name value arguments")
  values.set(key.slice(2), value)
}
const required = (name: string) => {
  const value = values.get(name)
  if (!value) throw new Error(`--${name} is required`)
  return value
}
const runtime = path.resolve(required("runtime"))
const lockfile = createRequire(path.join(import.meta.dir, "../../packages/opencorvus/package.json"))("proper-lockfile") as typeof import("proper-lockfile")
const runtimeRevision = required("runtime-revision")
const runtimeHome = path.resolve(required("runtime-home"))
const python = path.resolve(required("python"))
const harness = path.resolve(required("harness"))
const manifestPath = path.resolve(required("manifest"))
const output = path.resolve(required("output"))
const reasoningEffort = required("reasoning-effort")
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
  selection: { count: number }
  cases: Array<{ case_index: number; domain: string; task: string }>
}
const manifestSHA256 = crypto.createHash("sha256").update(await fs.readFile(manifestPath)).digest("hex")
const manifestIndexes = manifest.cases.map((item) => item.case_index).sort((left, right) => left - right)
const expectedIndexes = Array.from({ length: manifest.selection.count }, (_, index) => index + 1)
if (JSON.stringify(manifestIndexes) !== JSON.stringify(expectedIndexes)) {
  throw new Error("native_manifest_case_identity_mismatch")
}
const selected = parseNativeCaseIndexes(required("case-index"), manifest.selection.count)
const model = "openai/gpt-5.6-luna"
const maxResponseSteps = 50
const inactivityMs = 600_000
const git = (args: string[]) => Bun.spawnSync(["git", "-C", runtime, ...args])
const [runtimeHead, runtimeStatus] = [git(["rev-parse", "HEAD"]), git(["status", "--porcelain"])]
if (
  runtimeHead.exitCode !== 0 ||
  runtimeStatus.exitCode !== 0 ||
  runtimeHead.stdout.toString().trim() !== runtimeRevision ||
  runtimeStatus.stdout.toString().trim() !== ""
) {
  throw new Error("native_batch_runtime_source_identity_mismatch")
}
await fs.mkdir(output, { recursive: true, mode: 0o700 })
const lockPath = path.join(output, "native-batch.lock")
await fs.open(lockPath, "a").then((handle) => handle.close())
const release = await lockfile.lock(lockPath, { realpath: false, stale: 60_000, update: 10_000 })
const progressPath = path.join(output, "native-batch-progress.json")
const admission = createBenchmarkAdmissionGate("Native batch coordinator")
const children = new Set<ReturnType<typeof Bun.spawn>>()
const childStops = createBenchmarkRunnerStopController<ReturnType<typeof Bun.spawn>>({
  isAlive: (child) => {
    try {
      process.kill(child.pid, 0)
      return true
    } catch {
      return false
    }
  },
  signal: (child, signal) => child.kill(signal),
  exited: (child) => child.exited,
})
const removeHandlers = installBenchmarkTerminationHandlers((signal) => {
  admission.request(signal)
  for (const child of children) void childStops.stop(child)
})
const outcomes: Array<{ case_index: number; status: string; exit_code: number; output_directory: string }> = []
const sourceFiles = [
  path.join(import.meta.dir, "run-native-automationbench.ts"),
  path.join(import.meta.dir, "run-native-automationbench-batch.ts"),
  path.join(import.meta.dir, "native-run-contract.ts"),
  path.join(import.meta.dir, "process-lifecycle.ts"),
  path.join(import.meta.dir, "native-automationbench-world.py"),
  path.join(harness, "automationbench_bridge.py"),
  path.join(harness, "verify_automationbench_replay.py"),
]
const expectedSourceFiles = Object.fromEntries(
  await Promise.all(sourceFiles.map(async (file) => [path.basename(file), crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex")])),
)
const readTerminal = async (caseIndex: number, caseOutput: string) => {
  const [start, result, input] = await Promise.all([
    fs.readFile(path.join(caseOutput, "run-start.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(caseOutput, "result.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(caseOutput, "input.json"), "utf8").then(JSON.parse).catch(() => undefined),
  ])
  const identity = {
    case_index: caseIndex,
    runtime_revision: runtimeRevision,
    model,
    reasoning_effort: reasoningEffort,
    manifest_sha256: manifestSHA256,
    max_response_steps: maxResponseSteps,
    inactivity_ms: inactivityMs,
  }
  const fieldsMatch = (record: Record<string, unknown>) =>
    Object.entries(identity).every(([key, value]) => record[key] === value)
  if (
    !auditNativeTerminalEnvelope(start, result).passed ||
    !fieldsMatch(start) ||
    !fieldsMatch(result) ||
    !["scored", "unscored_infrastructure_failure"].includes(result.status)
  ) {
    throw new Error(`native_terminal_identity_mismatch:${caseIndex}`)
  }
  if (input) {
    if (
      !fieldsMatch(input) ||
      input.run_id !== result.run_id ||
      JSON.stringify(input.source_files) !== JSON.stringify(expectedSourceFiles)
    ) {
      throw new Error(`native_terminal_input_identity_mismatch:${caseIndex}`)
    }
  }
  if (result.status === "scored" && (!input || result.replay?.passed !== true)) {
    throw new Error(`native_terminal_replay_mismatch:${caseIndex}`)
  }
  if (
    result.status === "unscored_infrastructure_failure" &&
    (typeof result.error !== "string" ||
      result.error.length === 0 ||
      !["setup", "official_world", "model_execution", "official_scoring", "official_replay"].includes(result.failure_stage) ||
      (result.failure_stage !== "setup" && result.failure_stage !== "official_world" && !input))
  ) {
    throw new Error(`native_terminal_failure_contract:${caseIndex}`)
  }
  if (result.status === "scored") {
    const selectedCase = manifest.cases.find((item) => item.case_index === caseIndex)!
    if (!result.score || typeof result.score !== "object") {
      throw new Error(`native_terminal_score_missing:${caseIndex}`)
    }
    admission.assertOpen()
    const replay = Bun.spawn(
      [
        python,
        path.join(harness, "verify_automationbench_replay.py"),
        "--domain", selectedCase.domain,
        "--task", selectedCase.task,
        "--events", path.join(caseOutput, "world/automationbench-events.jsonl"),
        "--initial-world", path.join(caseOutput, "world/automationbench-initial-world.json"),
        "--final-world", path.join(caseOutput, "world/automationbench-final-world.json"),
      ],
      { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
    )
    children.add(replay)
    replay.stdin.write(JSON.stringify(result.score))
    replay.stdin.end()
    const [exitCode, stdout, stderr] = await Promise.all([
      replay.exited,
      new Response(replay.stdout).text(),
      new Response(replay.stderr).text(),
    ]).finally(() => children.delete(replay))
    const verified = exitCode === 0 ? JSON.parse(stdout) : undefined
    if (exitCode !== 0 || verified?.passed !== true || JSON.stringify(verified) !== JSON.stringify(result.replay)) {
      throw new Error(`native_terminal_replay_mismatch:${caseIndex}:${stderr.trim() || exitCode}`)
    }
  }
  return result
}
const publish = async (status: "running" | "completed" | "interrupted" | "failed") => {
  const body = JSON.stringify(
    {
      schema_version: 1,
      status,
      signal: admission.signal() ?? null,
      selected_cases: selected,
      outcomes,
      settlement: auditNativeBatchSettlement({ selected, outcomes }),
      updated_at: Date.now(),
    },
    null,
    2,
  ) + "\n"
  const temporary = `${progressPath}.${process.pid}.tmp`
  await fs.writeFile(temporary, body, { encoding: "utf8", flag: "wx" })
  await fs.rename(temporary, progressPath)
}

try {
  await publish("running")
  for (const caseIndex of selected) {
    admission.assertOpen()
    const caseOutput = path.join(output, `case-${String(caseIndex).padStart(3, "0")}-attempt-1`)
    const terminalPath = path.join(caseOutput, "result.json")
    const existing = await fs.access(terminalPath).then(() => true).catch(() => false)
    if (existing) {
      const terminal = await readTerminal(caseIndex, caseOutput)
      outcomes.push({
        case_index: caseIndex,
        status: terminal.status,
        exit_code: terminal.status === "scored" ? 0 : 1,
        output_directory: caseOutput,
      })
      await publish("running")
      continue
    }
    if (await fs.access(caseOutput).then(() => true).catch(() => false)) {
      throw new Error(`native_case_unsealed:${caseIndex}`)
    }
    admission.assertOpen()
    const child = Bun.spawn(
      [
        process.execPath,
        path.join(import.meta.dir, "run-native-automationbench.ts"),
        "--runtime", runtime,
        "--runtime-revision", runtimeRevision,
        "--runtime-home", runtimeHome,
        "--python", python,
        "--harness", harness,
        "--manifest", manifestPath,
        "--reasoning-effort", reasoningEffort,
        "--output", caseOutput,
        "--case-index", String(caseIndex),
      ],
      { cwd: runtime, stdout: "inherit", stderr: "inherit" },
    )
    children.add(child)
    const exitCode = await child.exited.finally(() => children.delete(child))
    const terminal = await readTerminal(caseIndex, caseOutput)
    if ((terminal.status === "scored" && exitCode !== 0) || (terminal.status !== "scored" && exitCode === 0)) {
      throw new Error(`native_terminal_exit_mismatch:${caseIndex}`)
    }
    outcomes.push({ case_index: caseIndex, status: terminal.status, exit_code: exitCode, output_directory: caseOutput })
    await publish("running")
  }
  const settlement = auditNativeBatchSettlement({ selected, outcomes })
  if (!settlement.passed) throw new Error(settlement.violations.join(","))
  await publish("completed")
} catch (error) {
  await Promise.all([...children].map((child) => childStops.stop(child)))
  await publish(admission.signal() ? "interrupted" : "failed")
  throw error
} finally {
  removeHandlers()
  await release()
}
