import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import lockfile from "proper-lockfile"
import { ProviderError } from "../../../src/provider/error"
import {
  auditBenchmarkBunRuntime,
  automationBenchCoordinatorBatchIndexes,
  createRestartableDrain,
  mapSettledWithBoundedConcurrency,
  reconcileAutomationBenchBatchCandidates,
  reusableProfileRuns,
  rollingDashboardPlanPaths,
} from "./contract"

type FrozenCase = {
  case_index: number
  batch_index: number
  domain: string
  task: string
  example_id: string | number
  task_contract_sha256: string
}
type Profile = "base" | "advanced"

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
const rootPackage = JSON.parse(
  await fs.readFile(path.resolve(import.meta.dir, "../../../../../package.json"), "utf8"),
) as { packageManager?: unknown }
const runtimeAudit = auditBenchmarkBunRuntime(rootPackage.packageManager, process.versions.bun)
if (!runtimeAudit.passed) {
  throw new Error(
    `Benchmark Bun runtime mismatch: expected ${runtimeAudit.expected_version || "bun@<version>"}, ` +
      `received ${runtimeAudit.actual_version || "unavailable"}`,
  )
}
const python = required("python")
const sourceData = required("source-data")
const output = required("output")
const restrictedShell = required("restricted-shell")
const controlRoot = required("control-root")
const dashboard = values.get("dashboard") ? path.resolve(values.get("dashboard")!) : undefined
const evaluatorRoot = path.dirname(path.dirname(python))
const batchIndexes = automationBenchCoordinatorBatchIndexes(values.get("batch-index") ?? "")
const caseSet = path.resolve(values.get("case-set") ?? path.join(import.meta.dir, "automationbench-case-set.json"))
const model =
  values.get("model") ??
  (() => {
    throw new Error("--model is required")
  })()
const inactivityMs = values.get("inactivity-ms") ?? "600000"
const queueConcurrency = Number(values.get("queue-concurrency") ?? "10")
if (!Number.isSafeInteger(queueConcurrency) || queueConcurrency < 1 || queueConcurrency > 10) {
  throw new Error("--queue-concurrency must be a positive integer no greater than ten")
}
const profile = values.get("profiles")
if (profile !== "base" && profile !== "advanced") {
  throw new Error("--profiles must name exactly one execution profile: base or advanced")
}
const profiles: Profile[] = [profile]
const manifest = JSON.parse(await fs.readFile(caseSet, "utf8")) as { selection: { count: number }; cases: FrozenCase[] }
if (
  !Number.isInteger(manifest.selection?.count) ||
  manifest.selection.count < 5 ||
  manifest.selection.count % 5 !== 0 ||
  manifest.cases.length !== manifest.selection.count ||
  batchIndexes.some((batchIndex) => batchIndex > manifest.selection.count / 5)
) {
  throw new Error(`Frozen batches ${batchIndexes.join(",")} must exist inside the selected manifest`)
}
type BatchSlot = { case_index: number; profile: Profile }
const selectedBatches = batchIndexes.map((batchIndex) => {
  const cases = manifest.cases
    .filter((item) => item.batch_index === batchIndex)
    .sort((left, right) => left.case_index - right.case_index)
  if (cases.length !== 5) throw new Error(`Frozen batch ${batchIndex} must contain five cases inside the selected manifest`)
  return {
    batchIndex,
    cases,
    waves: [cases.map((item) => ({ case_index: item.case_index, profile }))] as BatchSlot[][],
  }
})

await Promise.all([
  fs.mkdir(output, { recursive: true, mode: 0o700 }),
  fs.mkdir(controlRoot, { recursive: true, mode: 0o700 }),
])
if (output === controlRoot || output.startsWith(`${controlRoot}${path.sep}`) || controlRoot.startsWith(`${output}${path.sep}`)) {
  throw new Error("Evidence and control roots must be distinct non-nested private directories")
}
if (dashboard) {
  const dashboardParent = path.dirname(dashboard)
  await fs.mkdir(dashboardParent, { recursive: true })
  const [dashboardParentRealpath, ...protectedRealpaths] = await Promise.all([
    fs.realpath(dashboardParent),
    ...[output, controlRoot, sourceData, evaluatorRoot].map((target) => fs.realpath(target)),
  ])
  const dashboardRealpath = path.join(dashboardParentRealpath, path.basename(dashboard))
  if (
    protectedRealpaths.some(
      (protectedRoot) =>
        dashboardRealpath === protectedRoot ||
        dashboardRealpath.startsWith(`${protectedRoot}${path.sep}`) ||
        protectedRoot.startsWith(`${dashboardRealpath}${path.sep}`),
    )
  ) {
    throw new Error("External dashboard must be outside evaluator, evidence, control, and Provider-data roots")
  }
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
const evidenceCaseSetPath = path.join(
  output,
  manifest.selection.count === 50
    ? "automationbench-case-set.json"
    : `automationbench-case-set-${manifest.selection.count}.json`,
)
await fs.writeFile(evidenceCaseSetPath, caseSetBytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
  if (error.code !== "EEXIST") throw error
  const existing = await fs.readFile(evidenceCaseSetPath)
  if (!existing.equals(caseSetBytes)) throw new Error("Evidence root contains a different frozen AutomationBench case set")
})
const catalogLockPath = path.join(controlRoot, "catalog.lock")
await fs.open(catalogLockPath, "a").then((handle) => handle.close())
const planDirectory = path.join(output, "batch-plans")
type BatchContext = (typeof selectedBatches)[number] & {
  batchRunID: string
  planPath: string
  planSHA256?: string
  receiptPath: string
  activeAuthorizationPath: string
  authorizationPromise?: Promise<void>
  receiptWritten: boolean
  receiptPublished?: boolean
  remainingSlots?: number
  launchedByWave?: Array<Array<Awaited<ReturnType<typeof runTrial>>>>
  complete?: boolean
  preexistingByProfile?: Record<Profile, Map<number, Record<string, any>>>
  batchOutcomes?: Array<{
    launched: Array<Awaited<ReturnType<typeof runTrial>>>
    eligible: Array<{ case_index: number; profile: Profile; run_id: string }>
  }>
}
const releaseCoordinators: Array<() => Promise<void>> = []
for (const batchIndex of batchIndexes) {
  const coordinatorLockPath = path.join(controlRoot, `coordinator-batch-${batchIndex}.lock`)
  await fs.open(coordinatorLockPath, "a").then((handle) => handle.close())
  try {
    releaseCoordinators.push(
      await lockfile.lock(coordinatorLockPath, { realpath: false, stale: 60_000, update: 10_000 }),
    )
  } catch (error) {
    await Promise.all(releaseCoordinators.toReversed().map((release) => release()))
    throw error
  }
}
const contexts: BatchContext[] = []
try {
  for (const selected of selectedBatches) {
    const activeAuthorizationPath = path.join(controlRoot, `active-batch-${selected.batchIndex}.json`)
    const staleAuthorization = (await fs
      .readFile(activeAuthorizationPath, "utf8")
      .then(JSON.parse)
      .catch(() => undefined)) as { coordinator_pid?: number } | undefined
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
    contexts.push({
      ...selected,
      batchRunID,
      planPath: path.join(planDirectory, `batch-${String(selected.batchIndex).padStart(2, "0")}-${batchRunID}-plan.json`),
      receiptPath: path.join(planDirectory, `batch-${String(selected.batchIndex).padStart(2, "0")}-${batchRunID}-receipt.json`),
      activeAuthorizationPath,
      receiptWritten: false,
    })
  }
} catch (error) {
  await Promise.all(releaseCoordinators.toReversed().map((release) => release()))
  throw error
}
const activeChildren = new Set<ReturnType<typeof Bun.spawn>>()
let dashboardFailure: Error | undefined
let dashboardQueue = Promise.resolve()
let dashboardWriteRequested = false
let dashboardWriterRunning = false
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

function cancellableDelay<T>(timeoutMs: number, value: T) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    promise: new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(value), timeoutMs)
    }),
    cancel: () => {
      if (timer) clearTimeout(timer)
    },
  }
}

async function stopChild(child: ReturnType<typeof Bun.spawn>) {
  if (!processIsAlive(child.pid)) return child.exited.catch(() => undefined)
  child.kill("SIGTERM")
  const deadline = cancellableDelay(5_000, false)
  const exited = await Promise.race([child.exited.then(() => true).catch(() => true), deadline.promise])
  deadline.cancel()
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
    const deadline = cancellableDelay(timeoutMs, { timeout: true as const })
    const next = await Promise.race([reader.read(), deadline.promise]).finally(deadline.cancel)
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
  const releaseCatalog = await lockfile.lock(catalogLockPath, {
    realpath: false,
    stale: 60_000,
    update: 10_000,
    retries: { retries: 900, factor: 1, minTimeout: 1_000, maxTimeout: 1_000 },
  })
  try {
    if (terminationSignal) throw new Error(`Batch coordinator received ${terminationSignal}`)
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
        "--model",
        model,
        "--profiles",
        profiles.join(","),
      ],
      { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
    )
    activeChildren.add(child)
    try {
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
    } finally {
      activeChildren.delete(child)
    }
  } finally {
    await releaseCatalog()
  }
}

async function writeDashboard() {
  if (!dashboard) return
  const anchoredPlans = rollingDashboardPlanPaths(
    contexts.map((context) => ({
      planPath: context.planPath,
      authorizationStarted: Boolean(context.authorizationPromise),
      receiptWritten: context.receiptWritten,
      receiptPublished: context.receiptPublished === true,
    })),
  )
  const args = [
    process.execPath,
    path.join(import.meta.dir, "write-automationbench-dashboard.ts"),
    "--root",
    output,
    "--dashboard",
    dashboard,
    "--model",
    model,
    "--profiles",
    profiles.join(","),
  ]
  if (anchoredPlans.length > 0) args.push("--batch-plan", anchoredPlans.join(","))
  const child = Bun.spawn(args, { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" })
  let timedOut = false
  const terminateTimer = setTimeout(() => {
    timedOut = true
    child.kill("SIGTERM")
  }, 10_000)
  const killTimer = setTimeout(() => child.kill("SIGKILL"), 12_000)
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]).finally(() => {
    clearTimeout(terminateTimer)
    clearTimeout(killTimer)
  })
  if (timedOut) throw new Error("External dashboard refresh exceeded 10 seconds")
  if (exitCode !== 0) throw new Error(`External dashboard refresh failed: ${stderr.trim() || exitCode}`)
}

function queueDashboardWrite() {
  if (!dashboard) return dashboardQueue
  dashboardWriteRequested = true
  if (dashboardWriterRunning) return dashboardQueue
  dashboardWriterRunning = true
  dashboardQueue = (async () => {
    try {
      while (dashboardWriteRequested) {
        dashboardWriteRequested = false
        try {
          await writeDashboard()
          dashboardFailure = undefined
        } catch (error) {
          dashboardFailure = error instanceof Error ? error : new Error(String(error))
        }
      }
    } finally {
      dashboardWriterRunning = false
    }
  })()
  return dashboardQueue
}

async function queueDashboardWhenLeaseActive(context: BatchContext, item: FrozenCase, profile: Profile) {
  if (!dashboard) return
  const caseID = `${item.domain}:${item.task}`
  for (let attempt = 0; attempt < 40 && !terminationSignal; attempt += 1) {
    const leases = (await fs
      .readFile(path.join(output, ".automationbench-active-leases.json"), "utf8")
      .then(JSON.parse)
      .catch(() => ({ active: [] }))) as {
      active?: Array<{ case_id?: string; profile?: string; batch_run_id?: string }>
    }
    if (
      leases.active?.some(
        (lease) => lease.case_id === caseID && lease.profile === profile && lease.batch_run_id === context.batchRunID,
      )
    ) {
      await queueDashboardWrite()
      return
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 250)
      timer.unref()
    })
  }
}

function eligibleByCase(catalog: { leaderboard: Array<Record<string, any>> }, profile: Profile) {
  return new Map(
    catalog.leaderboard
      .filter((record) => record.opencorvus?.profile === profile && record.benchmark?.repetition === 1)
      .map((record) => [Number(record.benchmark.case_index), record]),
  )
}

function waveCandidateByCase(
  catalog: {
    attempts: Array<Record<string, any>>
    candidates: Array<Record<string, any>>
    leaderboard: Array<Record<string, any>>
  },
  profile: Profile,
  context: BatchContext,
) {
  const preexisting = [...(context.preexistingByProfile?.[profile]?.values() ?? [])]
  return reconcileAutomationBenchBatchCandidates({
    profile,
    preexisting,
    current: catalog.attempts.filter(
      (record) =>
        record.raw_leaderboard_eligible === true &&
        record.benchmark?.batch_run_id === context.batchRunID &&
        record.opencorvus?.profile === profile &&
        record.benchmark?.repetition === 1,
    ),
  })
}

async function ensureBatchAuthorization(context: BatchContext) {
  if (!context.planSHA256) throw new Error(`Batch ${context.batchIndex} plan identity is unavailable`)
  context.authorizationPromise ??= fs.writeFile(
    context.activeAuthorizationPath,
    JSON.stringify(
      {
        batch_run_id: context.batchRunID,
        batch_index: context.batchIndex,
        output_root: output,
        batch_plan: context.planPath,
        batch_plan_sha256: context.planSHA256,
        coordinator_pid: process.pid,
      },
      null,
      2,
    ) + "\n",
    { encoding: "utf8", flag: "wx" },
  )
  await context.authorizationPromise
}

async function runTrial(context: BatchContext, item: FrozenCase, profile: Profile, waveIndex: number) {
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
    context.planPath,
    "--batch-run-id",
    context.batchRunID,
    "--batch-index",
    String(context.batchIndex),
    "--batch-authorization",
    context.activeAuthorizationPath,
    "--restricted-shell",
    restrictedShell,
    "--wave-index",
    String(waveIndex),
  ]
  const child = Bun.spawn(args, { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" })
  activeChildren.add(child)
  void queueDashboardWhenLeaseActive(context, item, profile)
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
      stderr_tail: ProviderError.redactSensitiveProviderText(stderr).slice(-2000),
    }
  } finally {
    activeChildren.delete(child)
  }
}

function batchOutcomes(
  context: BatchContext,
  launchedByWave: Array<Array<Awaited<ReturnType<typeof runTrial>>>>,
  catalogAfter: Awaited<ReturnType<typeof refreshCatalog>>,
) {
  const outcomes = context.waves.map((slots, offset) => {
    const eligible = slots
      .map((slot) => waveCandidateByCase(catalogAfter, slot.profile, context).get(slot.case_index))
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
    outcomes,
  }
}

const settlementRequests = new Set<BatchContext>()
const receiptPublicationPending = new Set<BatchContext>()

async function writeBatchReceipt(
  context: BatchContext,
  rolling: ReturnType<typeof batchOutcomes>,
) {
  context.batchOutcomes = rolling.outcomes
  context.complete = rolling.complete
  await fs.writeFile(
    context.receiptPath,
    JSON.stringify(
      {
        schema_version: 1,
        batch_run_id: context.batchRunID,
        batch_index: context.batchIndex,
        status: rolling.complete ? "completed" : "failed",
        finished_at: Date.now(),
        signal: rolling.complete ? undefined : terminationSignal ?? null,
        ...Object.fromEntries(rolling.outcomes.map((outcome, index) => [`wave_${index + 1}`, outcome])),
        error: rolling.complete
          ? undefined
          : { name: "Error", message: `Rolling batch ${context.batchIndex} contains a failed, invalid, or unsealed trial` },
      },
      null,
      2,
    ) + "\n",
    { encoding: "utf8", flag: "wx" },
  )
  context.receiptWritten = true
  await fs.rm(context.activeAuthorizationPath, { force: true })
  receiptPublicationPending.add(context)
}

const settlementDrain = createRestartableDrain({
  hasWork: () => settlementRequests.size > 0 || receiptPublicationPending.size > 0,
  drain: async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 250)
    })
    const catalog = await refreshCatalog()
    for (const published of receiptPublicationPending) {
      if (published.complete) {
        const finalizedSlots = published.waves
          .flat()
          .filter((slot) => eligibleByCase(catalog, slot.profile).has(slot.case_index))
        if (finalizedSlots.length !== published.waves.flat().length) {
          throw new Error(`Completed receipt did not finalize every selected batch ${published.batchIndex} slot`)
        }
      }
      published.receiptPublished = true
      receiptPublicationPending.delete(published)
    }
    const ready = [...settlementRequests].filter((candidate) => !candidate.receiptWritten)
    for (const candidate of ready) settlementRequests.delete(candidate)
    for (const candidate of ready) {
      if (!candidate.launchedByWave) {
        throw new Error(`Batch ${candidate.batchIndex} launch outcomes are unavailable at settlement`)
      }
      await writeBatchReceipt(candidate, batchOutcomes(candidate, candidate.launchedByWave, catalog))
    }
    await queueDashboardWrite()
  },
})

function queueBatchSettlement(context: BatchContext) {
  settlementRequests.add(context)
  settlementDrain.wake()
}

try {
  await fs.mkdir(planDirectory, { recursive: true })
  const preexistingCatalog = await refreshCatalog()
  for (const context of contexts) {
    context.preexistingByProfile = {
      base: reusableProfileRuns(preexistingCatalog, "base", model, "mission"),
      advanced: reusableProfileRuns(preexistingCatalog, "advanced", model, "mission"),
    }
    const plan = {
      schema_version: 2,
      launch_mode: "mission",
      batch_run_id: context.batchRunID,
      batch_index: context.batchIndex,
      repetition: 1,
      started_at: Date.now(),
      model,
      profiles,
      trial_concurrency: 5,
      schedule_mode: "rolling_case_slots_v1",
      protected_roots: {
        evidence: protectedRootAudits[0],
        control: protectedRootAudits[1],
      },
      cases: context.cases,
      waves: context.waves,
      preexisting_eligible: {
        base: [...context.preexistingByProfile.base.values()]
          .filter((record) => context.cases.some((item) => item.case_index === record.benchmark.case_index))
          .map((record) => ({ run_id: record.run_id, case_index: record.benchmark.case_index, profile: "base" })),
        advanced: [...context.preexistingByProfile.advanced.values()]
          .filter((record) => context.cases.some((item) => item.case_index === record.benchmark.case_index))
          .map((record) => ({ run_id: record.run_id, case_index: record.benchmark.case_index, profile: "advanced" })),
      },
    }
    const planBytes = JSON.stringify(plan, null, 2) + "\n"
    await fs.writeFile(context.planPath, planBytes, { encoding: "utf8", flag: "wx" })
    context.planSHA256 = crypto.createHash("sha256").update(planBytes).digest("hex")
    context.launchedByWave = context.waves.map(() => [])
  }
  const queuedTrials = contexts.flatMap((context) => {
    const existing = context.preexistingByProfile
    if (!existing) throw new Error(`Batch ${context.batchIndex} preexisting candidate selection is unavailable`)
    const missing = context.waves.flatMap((wave, waveOffset) =>
      wave
        .filter((slot) => !existing[slot.profile].has(slot.case_index))
        .map((slot) => ({
          context,
          item: context.cases.find((item) => item.case_index === slot.case_index)!,
          profile: slot.profile,
          waveIndex: waveOffset + 1,
        })),
    )
    context.remainingSlots = missing.length
    if (missing.length === 0) void queueBatchSettlement(context)
    return missing
  })
  await queueDashboardWrite()
  let schedulingFailure: Error | undefined
  const scheduled = await mapSettledWithBoundedConcurrency(
    queuedTrials,
    queueConcurrency,
    async ({ context, item, profile, waveIndex }) => {
      if (terminationSignal) throw new Error(`Batch coordinator received ${terminationSignal}`)
      try {
        await ensureBatchAuthorization(context)
      } catch (error) {
        schedulingFailure = error instanceof Error ? error : new Error(String(error))
        throw schedulingFailure
      }
      const outcome = await runTrial(context, item, profile, waveIndex).catch((error) => ({
        case_index: item.case_index,
        profile,
        exit_code: -1,
        run_id: null,
        run_status: "coordinator_failed",
        stderr_tail: ProviderError.redactSensitiveProviderText(error instanceof Error ? error.message : String(error)).slice(-2000),
      }))
      context.launchedByWave![waveIndex - 1]!.push(outcome)
      context.remainingSlots = (context.remainingSlots ?? 1) - 1
      if (context.remainingSlots === 0) void queueBatchSettlement(context)
      void queueDashboardWrite()
      return outcome
    },
    { shouldStart: () => !terminationSignal && !schedulingFailure && !settlementDrain.failure() },
  )
  await settlementDrain.waitForIdle()
  const unstarted = scheduled.filter((outcome) => outcome.status === "rejected").length
  if (schedulingFailure || settlementDrain.failure() || unstarted > 0) {
    throw schedulingFailure ?? settlementDrain.failure() ?? new Error(`${unstarted} queued AutomationBench trials were not started`)
  }
  const failedBatchIndexes = contexts.filter((context) => context.complete !== true).map((context) => context.batchIndex)
  if (failedBatchIndexes.length > 0) {
    throw new Error(`Rolling batches ${failedBatchIndexes.join(",")} contain failed, invalid, or unsealed trials`)
  }
  process.stdout.write(
    JSON.stringify({
      ok: true,
      batch_indices: contexts.map((context) => context.batchIndex),
      queue_concurrency: queueConcurrency,
      receipts: contexts.map((context) => context.receiptPath),
      dashboard_warning: dashboardFailure?.message,
    }) + "\n",
  )
} catch (error) {
  for (const context of contexts.filter((item) => !item.receiptWritten)) {
    await fs.mkdir(planDirectory, { recursive: true }).catch(() => undefined)
    await fs
      .writeFile(
        context.receiptPath,
        JSON.stringify(
          {
            schema_version: 1,
            batch_run_id: context.batchRunID,
            batch_index: context.batchIndex,
            status: "failed",
            finished_at: Date.now(),
            signal: terminationSignal ?? null,
            ...(context.batchOutcomes
              ? Object.fromEntries(context.batchOutcomes.map((outcome, index) => [`wave_${index + 1}`, outcome]))
              : {}),
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
    context.receiptWritten = true
    context.receiptPublished = true
  }
  throw error
} finally {
  for (const child of activeChildren) child.kill("SIGTERM")
  await Promise.all([...activeChildren].map((child) => stopChild(child)))
  if (forcedTerminationTimer) clearTimeout(forcedTerminationTimer)
  await Promise.all(contexts.map((context) => fs.rm(context.activeAuthorizationPath, { force: true })))
  for (const context of contexts) context.receiptPublished = true
  await queueDashboardWrite()
  process.removeListener("SIGINT", onSIGINT)
  process.removeListener("SIGTERM", onSIGTERM)
  await Promise.all(releaseCoordinators.toReversed().map((release) => release()))
}
