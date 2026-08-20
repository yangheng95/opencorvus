import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import lockfile from "proper-lockfile"
import { executeRollingBatchChains, rollingBatchChains } from "./contract"

type FrozenCase = {
  case_index: number
  batch_index: number
  domain: string
  task: string
  example_id: string | number
  task_contract_sha256: string
}

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
  return path.resolve(value)
}
if (process.platform !== "linux" || process.getuid?.() !== 0) throw new Error("Batch coordinator requires the WSL2 root boundary")
const python = required("python")
const sourceData = required("source-data")
const output = required("output")
const restrictedShell = required("restricted-shell")
const controlRoot = required("control-root")
const batchIndex = Number(values.get("batch-index"))
if (!Number.isInteger(batchIndex) || batchIndex < 1 || batchIndex > 10) throw new Error("--batch-index must be 1 through 10")
const caseSet = path.resolve(values.get("case-set") ?? path.join(import.meta.dir, "automationbench-case-set.json"))
const model = values.get("model") ?? "openai/gpt-5.6-luna"
const inactivityMs = values.get("inactivity-ms") ?? "600000"
const manifest = JSON.parse(await fs.readFile(caseSet, "utf8")) as { selection: { count: number }; cases: FrozenCase[] }
const cases = manifest.cases.filter((item) => item.batch_index === batchIndex).sort((left, right) => left.case_index - right.case_index)
if (manifest.selection?.count !== 50 || cases.length !== 5) throw new Error(`Frozen batch ${batchIndex} must contain five of 50 cases`)
const wave1 = cases.map((item) => ({ case_index: item.case_index, profile: item.case_index % 2 === 1 ? "base" : "advanced" })) as Array<{
  case_index: number
  profile: "base" | "advanced"
}>
const wave2 = wave1.map((item) => ({ case_index: item.case_index, profile: item.profile === "base" ? "advanced" : "base" }))
const waves = [wave1, wave2]

await Promise.all([
  fs.mkdir(output, { recursive: true, mode: 0o700 }),
  fs.mkdir(controlRoot, { recursive: true, mode: 0o700 }),
])
if (output === controlRoot || output.startsWith(`${controlRoot}${path.sep}`) || controlRoot.startsWith(`${output}${path.sep}`)) {
  throw new Error("Evidence and control roots must be distinct non-nested private directories")
}
const protectedRootAudits = await Promise.all(
  [output, controlRoot].map(async (target) => {
    const [lstat, realpath, stat] = await Promise.all([fs.lstat(target), fs.realpath(target), fs.stat(target)])
    if (!lstat.isDirectory() || realpath !== target || stat.uid !== 0) throw new Error(`Benchmark protected root is unsafe: ${target}`)
    await fs.chmod(target, 0o700)
    return { path: target, realpath, uid: stat.uid, mode: "700", passed: true }
  }),
)
const caseSetBytes = await fs.readFile(caseSet)
const evidenceCaseSetPath = path.join(output, "automationbench-case-set.json")
await fs.writeFile(evidenceCaseSetPath, caseSetBytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
  if (error.code !== "EEXIST") throw error
  const existing = await fs.readFile(evidenceCaseSetPath)
  if (!existing.equals(caseSetBytes)) throw new Error("Evidence root contains a different frozen AutomationBench case set")
})
const coordinatorLockPath = "/run/lock/opencorvus-automationbench-coordinator.lock"
await fs.open(coordinatorLockPath, "a").then((handle) => handle.close())
const releaseCoordinator = await lockfile.lock(coordinatorLockPath, { realpath: false, stale: 60_000, update: 10_000 })
const activeAuthorizationPath = path.join(controlRoot, "active-batch.json")
const staleAuthorization = await fs.readFile(activeAuthorizationPath, "utf8").then(JSON.parse).catch(() => undefined) as
  | { coordinator_pid?: number }
  | undefined
if (staleAuthorization?.coordinator_pid) {
  try {
    process.kill(staleAuthorization.coordinator_pid, 0)
    throw new Error("A live batch authorization exists while acquiring the coordinator lock")
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("A live batch authorization")) throw error
  }
}
await fs.rm(activeAuthorizationPath, { force: true })
const batchRunID = crypto.randomUUID()
const planDirectory = path.join(output, "batch-plans")
const planPath = path.join(planDirectory, `batch-${String(batchIndex).padStart(2, "0")}-${batchRunID}-plan.json`)
const receiptPath = path.join(planDirectory, `batch-${String(batchIndex).padStart(2, "0")}-${batchRunID}-receipt.json`)
const activeChildren = new Set<ReturnType<typeof Bun.spawn>>()
let terminationSignal: "SIGINT" | "SIGTERM" | undefined
let forcedTerminationTimer: ReturnType<typeof setTimeout> | undefined
const terminate = (signal: "SIGINT" | "SIGTERM") => {
  terminationSignal = signal
  for (const child of activeChildren) child.kill("SIGTERM")
  forcedTerminationTimer ??= setTimeout(() => {
    for (const child of activeChildren) child.kill("SIGKILL")
  }, 10_000)
}
const onSIGINT = () => terminate("SIGINT")
const onSIGTERM = () => terminate("SIGTERM")
process.once("SIGINT", onSIGINT)
process.once("SIGTERM", onSIGTERM)

function processIsAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function stopChild(child: ReturnType<typeof Bun.spawn>) {
  if (!processIsAlive(child.pid)) return child.exited.catch(() => undefined)
  child.kill("SIGTERM")
  const exited = await Promise.race([child.exited.then(() => true).catch(() => true), Bun.sleep(5_000).then(() => false)])
  if (!exited) {
    child.kill("SIGKILL")
    await child.exited.catch(() => undefined)
  }
}

async function readWithInactivity(
  stream: ReadableStream<Uint8Array>,
  child: ReturnType<typeof Bun.spawn>,
  timeoutMs: number,
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let output = ""
  while (true) {
    const next = await Promise.race([
      reader.read(),
      Bun.sleep(timeoutMs).then(() => ({ timeout: true as const })),
    ])
    if ("timeout" in next) {
      child.kill("SIGTERM")
      await stopChild(child)
      throw new Error(`Trial emitted no runner activity for ${timeoutMs}ms`)
    }
    if (next.done) return output + decoder.decode()
    output += decoder.decode(next.value, { stream: true })
  }
}

async function refreshCatalog() {
  const child = Bun.spawn(
    [
      process.execPath,
      path.join(import.meta.dir, "catalog-automationbench-evidence.ts"),
      "--root",
      output,
      "--source-data",
      sourceData,
      "--python",
      python,
      "--restricted-shell",
      restrictedShell,
      "--case-set",
      caseSet,
    ],
    { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
  )
  const [exitCode, stderr] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  if (exitCode !== 0) throw new Error(`Evidence catalog refresh failed: ${stderr.trim() || exitCode}`)
  return JSON.parse(await fs.readFile(path.join(output, "evidence-catalog.json"), "utf8")) as {
    attempts: Array<Record<string, any>>
    candidates: Array<Record<string, any>>
    leaderboard: Array<Record<string, any>>
  }
}

function eligibleByCase(catalog: { leaderboard: Array<Record<string, any>> }, profile: "base" | "advanced") {
  return new Map(
    catalog.leaderboard
      .filter((record) => record.opencorvus?.profile === profile && record.benchmark?.repetition === 1)
      .map((record) => [Number(record.benchmark.case_index), record]),
  )
}

function candidateByCase(catalog: { candidates: Array<Record<string, any>> }, profile: "base" | "advanced") {
  return new Map(
    catalog.candidates
      .filter((record) => record.opencorvus?.profile === profile && record.benchmark?.repetition === 1)
      .map((record) => [Number(record.benchmark.case_index), record]),
  )
}

function waveCandidateByCase(
  catalog: { attempts: Array<Record<string, any>>; candidates: Array<Record<string, any>> },
  profile: "base" | "advanced",
) {
  const records = [
    ...catalog.candidates.filter((record) => record.opencorvus?.profile === profile && record.benchmark?.repetition === 1),
    ...catalog.attempts.filter(
      (record) =>
        record.raw_leaderboard_eligible === true &&
        record.benchmark?.batch_run_id === batchRunID &&
        record.opencorvus?.profile === profile &&
        record.benchmark?.repetition === 1,
    ),
  ]
  const candidates = new Map<number, Record<string, any>>()
  for (const record of records) {
    const caseIndex = Number(record.benchmark.case_index)
    const existing = candidates.get(caseIndex)
    if (existing && existing.run_id !== record.run_id) throw new Error(`Multiple eligible candidates exist for ${profile} case ${caseIndex}`)
    candidates.set(caseIndex, record)
  }
  return candidates
}

async function runTrial(item: FrozenCase, profile: "base" | "advanced", waveIndex: number) {
  const args = [
    process.execPath,
    path.join(import.meta.dir, "run-automationbench.ts"),
    "--profile",
    profile,
    "--domain",
    item.domain,
    "--task",
    item.task,
    "--model",
    model,
    "--python",
    python,
    "--source-data",
    sourceData,
    "--output",
    output,
    "--case-set",
    caseSet,
    "--repetition",
    "1",
    "--inactivity-ms",
    inactivityMs,
    "--batch-plan",
    planPath,
    "--batch-run-id",
    batchRunID,
    "--batch-index",
    String(batchIndex),
    "--batch-authorization",
    activeAuthorizationPath,
    "--restricted-shell",
    restrictedShell,
    "--wave-index",
    String(waveIndex),
  ]
  const child = Bun.spawn(args, { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" })
  activeChildren.add(child)
  try {
    const stdoutPromise = readWithInactivity(child.stdout, child, Number(inactivityMs) + 60_000)
    const stderrPromise = new Response(child.stderr).text()
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      stdoutPromise,
      stderrPromise,
    ])
    const terminalEvent = stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .toReversed()
      .flatMap((line) => {
        try {
          return [JSON.parse(line)]
        } catch {
          return []
        }
      })
      .find((event) => event.event === "result" || event.event === "failure")
    return {
      case_index: item.case_index,
      profile,
      exit_code: exitCode,
      run_id: terminalEvent?.result?.run?.id ?? terminalEvent?.failure?.run?.id ?? null,
      run_status: terminalEvent?.result?.run?.status ?? terminalEvent?.failure?.run?.status ?? null,
      stderr_tail: stderr.slice(-2000),
    }
  } finally {
    activeChildren.delete(child)
  }
}

async function runRollingBatch(catalogBefore: Awaited<ReturnType<typeof refreshCatalog>>) {
  if (terminationSignal) throw new Error(`Batch coordinator received ${terminationSignal}`)
  const existing = {
    base: candidateByCase(catalogBefore, "base"),
    advanced: candidateByCase(catalogBefore, "advanced"),
  }
  const launchedByWave: Array<Array<Awaited<ReturnType<typeof runTrial>>>> = [[], []]
  await executeRollingBatchChains({
    chains: rollingBatchChains(waves),
    shouldRun: (slot) => !existing[slot.profile].has(slot.case_index),
    run: async (slot, waveIndex) => {
        if (terminationSignal) throw new Error(`Batch coordinator received ${terminationSignal}`)
        const outcome = await runTrial(
          cases.find((item) => item.case_index === slot.case_index)!,
          slot.profile,
          waveIndex,
        ).catch((error) => ({
          case_index: slot.case_index,
          profile: slot.profile,
          exit_code: -1,
          run_id: null,
          run_status: "coordinator_failed",
          stderr_tail: error instanceof Error ? error.message : String(error),
        }))
        launchedByWave[waveIndex - 1]!.push(outcome)
        return outcome
    },
  })
  const catalogAfter = await refreshCatalog()
  const outcomes = waves.map((slots, offset) => {
    const eligible = slots
      .map((slot) => waveCandidateByCase(catalogAfter, slot.profile).get(slot.case_index))
      .filter(Boolean)
      .map((record) => ({
        case_index: record!.benchmark.case_index,
        profile: record!.opencorvus.profile,
        run_id: record!.run_id,
      }))
    return {
      launched: launchedByWave[offset]!.sort((left, right) => left.case_index - right.case_index),
      eligible,
    }
  })
  return {
    complete:
      launchedByWave.flat().every((item) => item.exit_code === 0 && item.run_status === "scored") &&
      outcomes.every((outcome) => outcome.eligible.length === 5),
    wave_1: outcomes[0]!,
    wave_2: outcomes[1]!,
  }
}

let receiptWritten = false
type BatchWaveOutcome = Awaited<ReturnType<typeof runRollingBatch>>["wave_1"]
let wave1Outcome: BatchWaveOutcome | undefined
let wave2Outcome: BatchWaveOutcome | undefined
try {
  await fs.mkdir(planDirectory, { recursive: true })
  const preexistingCatalog = await refreshCatalog()
  const plan = {
    schema_version: 1,
    batch_run_id: batchRunID,
    batch_index: batchIndex,
    started_at: Date.now(),
    model,
    profiles: ["base", "advanced"],
    trial_concurrency: 5,
    schedule_mode: "rolling_case_slots_v1",
    protected_roots: {
      evidence: protectedRootAudits[0],
      control: protectedRootAudits[1],
    },
    cases,
    waves,
    preexisting_eligible: {
      base: [...candidateByCase(preexistingCatalog, "base").values()]
        .filter((record) => cases.some((item) => item.case_index === record.benchmark.case_index))
        .map((record) => ({ run_id: record.run_id, case_index: record.benchmark.case_index, profile: "base" })),
      advanced: [...candidateByCase(preexistingCatalog, "advanced").values()]
        .filter((record) => cases.some((item) => item.case_index === record.benchmark.case_index))
        .map((record) => ({ run_id: record.run_id, case_index: record.benchmark.case_index, profile: "advanced" })),
    },
  }
  const planBytes = JSON.stringify(plan, null, 2) + "\n"
  await fs.writeFile(planPath, planBytes, { encoding: "utf8", flag: "wx" })
  await fs.writeFile(
    activeAuthorizationPath,
    JSON.stringify(
      {
        batch_run_id: batchRunID,
        batch_index: batchIndex,
        output_root: output,
        batch_plan: planPath,
        batch_plan_sha256: crypto.createHash("sha256").update(planBytes).digest("hex"),
        coordinator_pid: process.pid,
      },
      null,
      2,
    ) + "\n",
    { encoding: "utf8", flag: "wx" },
  )
  const rolling = await runRollingBatch(preexistingCatalog)
  wave1Outcome = rolling.wave_1
  wave2Outcome = rolling.wave_2
  if (!rolling.complete) throw new Error("Rolling batch contains a failed, invalid, or unsealed trial")
  await fs.writeFile(
    receiptPath,
    JSON.stringify(
      {
        schema_version: 1,
        batch_run_id: batchRunID,
        batch_index: batchIndex,
        status: "completed",
        finished_at: Date.now(),
        wave_1: rolling.wave_1,
        wave_2: rolling.wave_2,
      },
      null,
      2,
    ) + "\n",
    { encoding: "utf8", flag: "wx" },
  )
  receiptWritten = true
  const finalCatalog = await refreshCatalog()
  const finalizedSlots = [...wave1, ...wave2].filter((slot) => eligibleByCase(finalCatalog, slot.profile).has(slot.case_index))
  if (finalizedSlots.length !== 10) throw new Error("Completed receipt did not finalize all ten paired batch slots")
  process.stdout.write(JSON.stringify({ ok: true, batch_index: batchIndex, receipt: receiptPath }) + "\n")
} catch (error) {
  if (!receiptWritten) {
    await fs.mkdir(planDirectory, { recursive: true }).catch(() => undefined)
    await fs
      .writeFile(
        receiptPath,
        JSON.stringify(
          {
            schema_version: 1,
            batch_run_id: batchRunID,
            batch_index: batchIndex,
            status: "failed",
            finished_at: Date.now(),
            signal: terminationSignal ?? null,
            wave_1: wave1Outcome ?? null,
            wave_2: wave2Outcome ?? null,
            error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" },
          },
          null,
          2,
        ) + "\n",
        { encoding: "utf8", flag: "wx" },
      )
      .catch((writeError: NodeJS.ErrnoException) => {
        if (writeError.code !== "EEXIST") throw writeError
      })
  }
  throw error
} finally {
  for (const child of activeChildren) child.kill("SIGTERM")
  await Promise.all([...activeChildren].map((child) => stopChild(child)))
  if (forcedTerminationTimer) clearTimeout(forcedTerminationTimer)
  await fs.rm(activeAuthorizationPath, { force: true })
  process.removeListener("SIGINT", onSIGINT)
  process.removeListener("SIGTERM", onSIGTERM)
  await releaseCoordinator()
}
