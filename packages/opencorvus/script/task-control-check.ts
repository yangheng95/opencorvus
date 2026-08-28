import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  applyIsolatedTestUserEnvironment,
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
  removeIsolatedTestRuntime,
  type IsolatedTestRuntime,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

const ALLOW_REAL_PROVIDER = "TASK_CONTROL_CHECK_ALLOW_REAL_PROVIDER"
const AUTH_SOURCE = "TASK_CONTROL_CHECK_AUTH_SOURCE"
const CONFIG_SOURCE = "TASK_CONTROL_CHECK_CONFIG_SOURCE"
const MODEL = "TASK_CONTROL_CHECK_MODEL"
const RUNTIME_ROOT = "TASK_CONTROL_CHECK_RUNTIME_ROOT"
const PHASE = "TASK_CONTROL_CHECK_PHASE"
const OPENCORVUS_HOME = "OPENCORVUS_HOME"
const TASK_PROCESS_MODE = "OPENCORVUS_TASK_PROCESS_MODE"
const INACTIVITY_MS = 180_000
const POLL_INTERVAL_MS = 200
const CHECKPOINT_FILE = "task-control-checkpoint.json"

function checkerInlineConfig(): string {
  const configured = process.env.OPENCORVUS_CONFIG_CONTENT?.trim()
  if (!configured) return JSON.stringify({ permission_mode: "full_access" })
  const parsed = JSON.parse(configured) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OPENCORVUS_CONFIG_CONTENT must be a JSON object for the Task-control checker")
  }
  return JSON.stringify({ ...(parsed as Record<string, unknown>), permission_mode: "full_access" })
}

type StreamEvent = {
  type?: string
  sequence?: number
  payload?: Record<string, unknown>
  event_id?: string
  emittedAt?: number
}

type BoardArtifact = { id: string; kind: string; label: string; payload?: Record<string, unknown> }
type TaskRootIngress = {
  ingressID: string
  sourceID: string
  sequence: number
  activations: Array<{ activationID: string; activatedAt: number }>
  decisions: Array<{ receiptID: string; command: string }>
  projection: { state: string }
}
type Board = {
  task: { status: string; cancellation?: { requestEventID?: string } }
  artifacts: BoardArtifact[]
  executionProjection: {
    occurrences: Array<{ sessionID: string; agent?: string; kind?: string; latest?: { status?: { type?: string } } }>
  }
}

function activeTaskRootIngresses(ingresses: TaskRootIngress[]): TaskRootIngress[] {
  return ingresses.filter((ingress) =>
    ["ready", "leased", "reconcile_required", "waiting", "cancelling", "closing"].includes(ingress.projection.state),
  )
}

type Checkpoint = {
  taskID: string
  lifecycleConvergence: {
    taskID: string
    childSessionID: string
    lifecycleEventID: string
    wakeID: string
    lifecycleEmittedAt: number
    taskCompletedAt: number
  }
  progressIngressID: string
  recoveryIngressIDs: [string, string]
  childSessionID: string
  progressRunningWithinMs: number
  workerProcess: { live: number; owners: Record<string, { count: number; pids: number[] }> }
  cancellationAcceptedWithinMs?: number
  cancellationRequestEventID?: string
  cancellationRequestEventEmittedAt?: number
  cancellationRequestedAt?: number
  recoveryActivationTimes?: number[]
  cancellationWorkerProcess?: { live: number; owners: Record<string, { count: number; pids: number[] }> }
  inheritedProcessPIDs?: number[]
}

class ActivityStream {
  readonly events: StreamEvent[] = []
  private meaningfulEventCount = 0
  private lastMeaningfulActivity = Date.now()
  private lastDeltaReport = 0
  private failure: unknown

  constructor(private readonly response: Response) {}

  start() {
    void this.consume().catch((error) => (this.failure = error))
  }

  private async consume() {
    if (!this.response.body) throw new Error("Task event stream has no response body")
    const decoder = new TextDecoder()
    let buffered = ""
    for await (const chunk of this.response.body) {
      buffered += decoder.decode(chunk, { stream: true })
      let separator = /\r?\n\r?\n/.exec(buffered)
      while (separator) {
        const frame = buffered.slice(0, separator.index)
        buffered = buffered.slice(separator.index + separator[0].length)
        for (const line of frame.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue
          const event = JSON.parse(line.slice(5).trim()) as StreamEvent
          this.events.push(event)
          if (event.type !== "task.heartbeat" && event.type !== "task.connected") {
            this.meaningfulEventCount++
            this.lastMeaningfulActivity = Date.now()
            const now = Date.now()
            if (event.type !== "message.part.delta" || now - this.lastDeltaReport >= 5_000) {
              if (event.type === "message.part.delta") this.lastDeltaReport = now
              process.stdout.write(`[task-control activity] ${event.type ?? "unknown"}\n`)
            }
          }
        }
        separator = /\r?\n\r?\n/.exec(buffered)
      }
    }
  }

  async waitFor<T>(label: string, observe: () => Promise<T | undefined>, inactivityMs = INACTIVITY_MS): Promise<T> {
    let observedEvents = this.meaningfulEventCount
    let observedActivity = this.lastMeaningfulActivity
    let deadline = Date.now() + inactivityMs
    while (Date.now() < deadline) {
      if (this.failure) throw this.failure
      const value = await observe()
      if (value !== undefined) return value
      if (this.meaningfulEventCount !== observedEvents || this.lastMeaningfulActivity > observedActivity) {
        observedEvents = this.meaningfulEventCount
        observedActivity = this.lastMeaningfulActivity
        deadline = Date.now() + inactivityMs
      }
      await Bun.sleep(POLL_INTERVAL_MS)
    }
    throw new Error(`${label} produced no meaningful activity for ${inactivityMs}ms`)
  }
}

async function waitForPolling<T>(
  label: string,
  observe: () => Promise<T | undefined>,
  inactivityMs: number,
  activity?: () => Promise<string | undefined>,
): Promise<T> {
  let activityKey = await activity?.()
  let deadline = Date.now() + inactivityMs
  while (Date.now() < deadline) {
    const value = await observe()
    if (value !== undefined) return value
    const currentActivityKey = await activity?.()
    if (currentActivityKey !== undefined && currentActivityKey !== activityKey) {
      activityKey = currentActivityKey
      deadline = Date.now() + inactivityMs
      process.stdout.write(`[task-control activity] ${label}: ${currentActivityKey}\n`)
    }
    await Bun.sleep(POLL_INTERVAL_MS)
  }
  throw new Error(`${label} produced no durable activity for ${inactivityMs}ms`)
}

function requiredOptIn() {
  if (process.env[ALLOW_REAL_PROVIDER] !== "1") {
    throw new Error(`${ALLOW_REAL_PROVIDER}=1 is required because this checker performs real model calls.`)
  }
}

async function initRepository(directory: string) {
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(
    path.join(directory, "task-control-fixture.ts"),
    "export const taskControlFixture: string = 'ready'\n",
    "utf8",
  )
  for (const args of [
    ["init"],
    ["config", "user.email", "task-control-check@opencorvus.local"],
    ["config", "user.name", "OpenCorvus Task Control Checker"],
    ["add", "task-control-fixture.ts"],
    ["commit", "-m", "task-control checker fixture"],
  ]) {
    const result = Bun.spawnSync(["git", ...args], { cwd: directory, stdout: "pipe", stderr: "pipe" })
    if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`)
  }
}

async function copyAuthorityFile(source: string | undefined, target: string) {
  if (!source?.trim()) return
  const resolved = path.resolve(source)
  const stat = await fs.stat(resolved)
  if (!stat.isFile()) throw new Error(`Authority source is not a file: ${resolved}`)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(resolved, target)
}

function assertTemporaryRoot(runtimeRoot: string) {
  const resolvedTemp = path.resolve(os.tmpdir())
  const resolvedRoot = path.resolve(runtimeRoot)
  if (
    path.dirname(resolvedRoot) !== resolvedTemp ||
    !path.basename(resolvedRoot).startsWith("opencorvus-task-control-")
  ) {
    throw new Error(`Refusing to remove unexpected checker directory ${resolvedRoot}`)
  }
  return resolvedRoot
}

async function runPhaseProcess(
  phase: string,
  runtimeRoot: string,
  isolatedRuntime: IsolatedTestRuntime,
): Promise<string> {
  const openCorvusRuntimeRoot = path.join(runtimeRoot, "runtime")
  const child = Bun.spawn([process.execPath, import.meta.path], {
    env: {
      ...isolatedTestChildEnvironment(isolatedRuntime),
      [OPENCORVUS_HOME]: openCorvusRuntimeRoot,
      OPENCORVUS_TEST_HOME: openCorvusRuntimeRoot,
      OPENCORVUS_TEST_PROCESS_ROOT: runtimeRoot,
      OPENCORVUS_CONFIG_CONTENT: checkerInlineConfig(),
      [TASK_PROCESS_MODE]: "native",
      [RUNTIME_ROOT]: runtimeRoot,
      [PHASE]: phase,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  let stdout = ""
  let stderr = ""
  let mirroredStdoutRemainder = ""
  const mirrorTaskControlLines = (text: string) => {
    const lines = (mirroredStdoutRemainder + text).split(/\r?\n/)
    mirroredStdoutRemainder = lines.pop() ?? ""
    for (const line of lines) {
      if (line.startsWith("[task-control")) process.stdout.write(`${line}\n`)
    }
  }
  const collect = async (
    stream: ReadableStream<Uint8Array>,
    append: (text: string) => void,
    mirror: (text: string) => unknown,
  ) => {
    const decoder = new TextDecoder()
    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true })
      append(text)
      mirror(text)
    }
  }
  const readers = [
    collect(child.stdout, (text) => (stdout += text), mirrorTaskControlLines),
    collect(
      child.stderr,
      (text) => (stderr += text),
      () => undefined,
    ),
  ]
  const exitCode = await child.exited
  await Promise.all(readers)
  if (exitCode !== 0) {
    const output = [`[task-control ${phase} stdout]`, stdout, `[task-control ${phase} stderr]`, stderr].join("\n")
    const evidenceMarker = output.lastIndexOf("[task-control failure evidence]")
    const recoveryLines = output
      .split(/\r?\n/)
      .filter((line) =>
        /bootstrapping|recover-interrupted|recover-interrupted|drain-persisted|interrupted Task|Task root ingress failed|task loop failed/i.test(
          line,
        ),
      )
      .slice(-80)
      .join("\n")
    const evidence = evidenceMarker >= 0 ? output.slice(evidenceMarker) : output.slice(-65_536)
    const excerpt = [recoveryLines, evidence].filter(Boolean).join("\n").trim()
    throw new Error(`Task-control ${phase} phase failed (${exitCode}): ${excerpt}`)
  }
  return stdout
}

async function runDriver() {
  const testProcessSupervisor = prepareTestProcessSupervisor()
  const isolatedRuntime = await bootstrapIsolatedTestRuntime("runner")
  applyIsolatedTestUserEnvironment(isolatedRuntime)
  if (testProcessSupervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = testProcessSupervisor
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-task-control-"))
  let primaryFailure: unknown
  try {
    await initRepository(path.join(runtimeRoot, "project"))
    await copyAuthorityFile(process.env[AUTH_SOURCE], path.join(runtimeRoot, "runtime", "data", "auth.json"))
    await runPhaseProcess("seed-ingress", runtimeRoot, isolatedRuntime)
    await runPhaseProcess("seed-cancellation", runtimeRoot, isolatedRuntime)
    await runPhaseProcess("verify", runtimeRoot, isolatedRuntime)
  } catch (error) {
    primaryFailure = error
  } finally {
    let cleanupFailure: unknown
    const validatedRoot = assertTemporaryRoot(runtimeRoot)
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await fs.rm(validatedRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 })
        cleanupFailure = undefined
        break
      } catch (error) {
        cleanupFailure = error
        if (attempt < 5) await Bun.sleep(attempt * 100)
      }
    }
    let isolationCleanupFailure: unknown
    try {
      await removeIsolatedTestRuntime(isolatedRuntime)
    } catch (error) {
      isolationCleanupFailure = error
    }
    const cleanupFailures = [cleanupFailure, isolationCleanupFailure].filter((value) => value !== undefined)
    if (primaryFailure && cleanupFailures.length > 0) {
      throw new AggregateError(
        [primaryFailure, ...cleanupFailures],
        "Task-control checker failed and cleanup left residue",
      )
    }
    if (primaryFailure) throw primaryFailure
    if (cleanupFailures.length === 1) throw cleanupFailures[0]
    if (cleanupFailures.length > 1)
      throw new AggregateError(cleanupFailures, "Task-control checker cleanup left residue")
  }
}

async function runServerPhase(phase: string, runtimeRoot: string) {
  const projectDirectory = path.join(runtimeRoot, "project")
  const checkpointPath = path.join(runtimeRoot, CHECKPOINT_FILE)
  const openCorvusRuntimeRoot = path.join(runtimeRoot, "runtime")
  process.env[OPENCORVUS_HOME] = openCorvusRuntimeRoot
  process.env.OPENCORVUS_TEST_HOME = openCorvusRuntimeRoot
  process.env.OPENCORVUS_TEST_PROCESS_ROOT = runtimeRoot
  process.env[TASK_PROCESS_MODE] = "native"
  if (process.env[CONFIG_SOURCE]?.trim()) process.env.OPENCORVUS_CONFIG = path.resolve(process.env[CONFIG_SOURCE]!)

  const [
    { listenWithRecoveredServerRuntime, requireRecoveredServerRuntime },
    { assertStartedTaskProjectRecoverySucceeded, recoverStartedTaskExecutions },
    { Database },
    { Instance },
    { ProcessSupervisor },
    { ProtocolStore },
    { Session },
    { listOwnedPromptSessionsForTask },
    { listStartedIncompleteTaskIDs },
  ] = await Promise.all([
    import("@/cli/server-runtime"),
    import("@/engine/host-recovery"),
    import("@/storage/db"),
    import("@/project/instance"),
    import("@/shell/process-supervisor"),
    import("@/protocol/store"),
    import("@/session"),
    import("@/engine/runtime"),
    import("@/engine/store"),
  ])
  const preparedServer = await requireRecoveredServerRuntime(
    await listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => {
        assertStartedTaskProjectRecoverySucceeded(await recoverStartedTaskExecutions())
      },
      disposeInstances: () => Instance.disposeAll(),
    }),
  )
  process.stdout.write(`[task-control phase] ${phase} production recovery ready\n`)
  const server = preparedServer.server
  const base = server.url.toString().replace(/\/$/, "")
  const abortStream = new AbortController()
  let taskID = ""
  let primaryFailure: unknown

  const taskUrl = (suffix = "") => {
    if (!taskID) throw new Error("Task identity is not available")
    const url = new URL(`${base}/task/${taskID}${suffix}`)
    url.searchParams.set("directory", projectDirectory)
    return url
  }
  const json = async <T>(url: URL, init?: RequestInit, expectedStatus?: number): Promise<T> => {
    const response = await fetch(url, init)
    if (!response.ok) {
      throw new Error(`${init?.method ?? "GET"} ${url.pathname} failed ${response.status}: ${await response.text()}`)
    }
    if (expectedStatus !== undefined && response.status !== expectedStatus) {
      throw new Error(
        `${init?.method ?? "GET"} ${url.pathname} returned ${response.status}, expected ${expectedStatus}`,
      )
    }
    return (await response.json()) as T
  }
  const board = () => json<Board>(taskUrl("/board"))
  const debugProjection = async () => {
    const projection = await json<
      { status: "available"; entries: TaskRootIngress[] } | { status: "unavailable"; error: string }
    >(taskUrl("/debug/task-root-ingresses"))
    if (projection.status !== "available") {
      throw new Error(`Task-root ingress debug projection unavailable: ${projection.error}`)
    }
    return projection.entries
  }
  const openStream = async () => {
    const response = await fetch(taskUrl("/events"), { signal: abortStream.signal })
    if (!response.ok) throw new Error(`Task SSE connection failed ${response.status}`)
    const stream = new ActivityStream(response)
    stream.start()
    return stream
  }
  const sendMessage = (text: string) =>
    json<{ wake_status: string; ingress_id: string; user_message?: { info?: { id?: string } } }>(
      taskUrl("/message"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, source: "operator.check" }),
      },
      202,
    )
  const cancel = (requestID: string) =>
    json<{ status: string; requestEventID: string }>(
      taskUrl("/cancel"),
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-opencorvus-request-id": requestID },
        body: JSON.stringify({ surface: "api", reason: "real task-control checker cancellation" }),
      },
      202,
    )
  const createTask = async (input: { title: string; request: string }) => {
    const createUrl = new URL(`${base}/task`)
    createUrl.searchParams.set("directory", projectDirectory)
    createUrl.searchParams.set("init-git", "false")
    return await json<{ task_id: string }>(createUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-opencorvus-request-id": `task-control-${Date.now()}` },
      body: JSON.stringify({
        productPillar: "code",
        source: "task-control-check",
        title: input.title,
        request: input.request,
        ...(process.env[MODEL]?.trim() ? { model: process.env[MODEL]!.trim() } : {}),
      }),
    })
  }

  try {
    if (phase === "seed-ingress") {
      const lifecycleAccepted = await createTask({
        title: "Real terminal lifecycle convergence",
        request: [
          "Dispatch the current workflow's appropriate implementation worker to inspect task-control-fixture.ts with the current projected production tools.",
          "When that worker reaches its exact terminal completed lifecycle, use that current result and complete this Task in the same control wake.",
          "Do not leave the Task active, wait for another message, or describe a terminal worker as still running.",
        ].join(" "),
      })
      taskID = lifecycleAccepted.task_id
      const lifecycleStream = await openStream()
      const lifecycleConvergence = await lifecycleStream.waitFor(
        "terminal worker lifecycle control convergence",
        async () => {
          const current = await board()
          const lineage = current.artifacts.find((artifact) => artifact.kind === "dispatch_lineage")
          const childSessionID =
            typeof lineage?.payload?.child_session_id === "string" ? lineage.payload.child_session_id : undefined
          if (!childSessionID) return undefined
          const lifecycle = ProtocolStore.listTaskEvents(taskID).find(
            (event) =>
              event.type === "agent.execution.lifecycle" &&
              event.sessionID === childSessionID &&
              event.payload?.status &&
              typeof event.payload.status === "object" &&
              (event.payload.status as { type?: unknown; reason?: unknown }).type === "terminal" &&
              (event.payload.status as { type?: unknown; reason?: unknown }).reason === "completed",
          )
          if (!lifecycle) return undefined
          const ingresses = await debugProjection()
          const wake = ingresses.find(
            (ingress) => ingress.sourceID === lifecycle.id && ingress.projection.state === "resolved",
          )
          if (!wake) return undefined
          if (current.task.status !== "completed") {
            const root = current.executionProjection.occurrences.find(
              (occurrence) => occurrence.sessionID !== childSessionID && occurrence.kind === "orchestrator",
            )
            const pendingWake = activeTaskRootIngresses(ingresses).length > 0
            const allWorkersTerminal = current.executionProjection.occurrences
              .filter((occurrence) => occurrence.kind !== "orchestrator")
              .every((occurrence) => occurrence.latest?.status?.type === "terminal")
            if (
              current.task.status === "active" &&
              root?.latest?.status?.type === "idle" &&
              allWorkersTerminal &&
              !pendingWake
            ) {
              throw new Error(
                `Terminal lifecycle ingress ${wake.ingressID} resolved while Task ${taskID} remained active with an idle Orchestrator`,
              )
            }
            return undefined
          }
          const completed = ProtocolStore.listTaskEvents(taskID).find((event) => event.type === "task.completed")
          if (!completed || completed.time.emitted < lifecycle.time.emitted) return undefined
          return {
            taskID,
            childSessionID,
            lifecycleEventID: lifecycle.id,
            wakeID: wake.ingressID,
            lifecycleEmittedAt: lifecycle.time.emitted,
            taskCompletedAt: completed.time.emitted,
          }
        },
      )

      const accepted = await createTask({
        title: "Real task control convergence",
        request: [
          "Immediately dispatch one implementation worker to inspect task-control-fixture.ts with the current projected production tools.",
          "Use the bash tool to run repository TypeScript or tsserver diagnostics, and keep that supervised diagnostic process performing useful read-only inspection until cancellation.",
          "Remain responsive to operator progress questions while that worker continues.",
        ].join(" "),
      })
      taskID = accepted.task_id
      const stream = await openStream()
      const workerProcessObserved = stream.waitFor("real Task-owned worker tool process", async () => {
        const metrics = ProcessSupervisor.taskMetricsSnapshot(taskID)
        return metrics.live > 0 ? metrics : undefined
      })
      const dispatched = await stream.waitFor("detached live worker with idle root ingress owner", async () => {
        const current = await board()
        const lineage = current.artifacts.find((artifact) => artifact.kind === "dispatch_lineage")
        const childSessionID =
          typeof lineage?.payload?.child_session_id === "string" ? lineage.payload.child_session_id : undefined
        const child = current.executionProjection.occurrences.find(
          (occurrence) => occurrence.sessionID === childSessionID,
        )
        const activeIngress = activeTaskRootIngresses(await debugProjection()).length > 0
        return lineage && child && child.latest?.status?.type !== "terminal" && !activeIngress
          ? { childSessionID: childSessionID! }
          : undefined
      })
      const workerProcess = await workerProcessObserved

      const progressStartedAt = performance.now()
      const progress = await sendMessage("What is running right now? Answer without stopping the worker.")
      const progressRunning = await stream.waitFor(
        "operator ingress running projection",
        async () => {
          const ingress = (await debugProjection()).find((entry) => entry.ingressID === progress.ingress_id)
          return ingress && ["leased", "resolved"].includes(ingress.projection.state) ? ingress : undefined
        },
        2_000,
      )
      const progressRunningWithinMs = performance.now() - progressStartedAt
      await stream.waitFor("progress response while child remains live", async () => {
        const current = await board()
        const ingress = (await debugProjection()).find(
          (entry) =>
            entry.ingressID === progress.ingress_id &&
            entry.projection.state === "resolved" &&
            entry.activations.length === 1 &&
            entry.decisions.length === 1 &&
            entry.decisions[0]?.command === "no_action",
        )
        const child = current.executionProjection.occurrences.find(
          (occurrence) => occurrence.sessionID === dispatched.childSessionID,
        )
        return ingress && child?.latest?.status?.type !== "terminal" ? ingress : undefined
      })
      if (progressRunningWithinMs >= 2_000) {
        throw new Error(`Operator ingress running projection took ${progressRunningWithinMs.toFixed(1)}ms`)
      }

      const firstRecovery = await sendMessage("Recovery message one: answer this before recovery message two.")
      const secondRecovery = await sendMessage("Recovery message two: answer only after recovery message one.")
      if (firstRecovery.wake_status !== "accepted" || secondRecovery.wake_status !== "accepted") {
        throw new Error(`FIFO recovery seed failed: ${JSON.stringify({ firstRecovery, secondRecovery })}`)
      }
      await stream.waitFor("running ingress before abrupt restart", async () => {
        const ingress = (await debugProjection()).find((entry) => entry.ingressID === firstRecovery.ingress_id)
        return ingress?.projection.state === "leased" ? ingress : undefined
      })
      const checkpoint: Checkpoint = {
        taskID,
        lifecycleConvergence,
        progressIngressID: progress.ingress_id,
        recoveryIngressIDs: [firstRecovery.ingress_id, secondRecovery.ingress_id],
        childSessionID: dispatched.childSessionID,
        progressRunningWithinMs,
        workerProcess,
      }
      await fs.writeFile(checkpointPath, JSON.stringify(checkpoint), "utf8")
      void progressRunning
      process.exit(0)
    }

    const checkpoint = JSON.parse(await fs.readFile(checkpointPath, "utf8")) as Checkpoint
    taskID = checkpoint.taskID
    process.stdout.write(`[task-control phase] ${phase} checkpoint loaded for ${taskID}\n`)
    const stream = phase === "verify" ? undefined : await openStream()
    if (stream) process.stdout.write(`[task-control phase] ${phase} event stream connected\n`)

    if (phase === "seed-cancellation") {
      if (!stream) throw new Error("Cancellation seed requires the real Task event stream")
      const recovered = await stream.waitFor("FIFO ingress recovery after backend restart", async () => {
        await board()
        const debug = await debugProjection()
        const ingresses = checkpoint.recoveryIngressIDs.map((id) => debug.find((ingress) => ingress.ingressID === id))
        if (!ingresses.every((ingress) => ingress?.projection.state === "resolved")) return undefined
        const activationTimes = ingresses.map((ingress) => ingress?.activations.at(-1)?.activatedAt ?? 0)
        return activationTimes[0]! > 0 && activationTimes[0]! <= activationTimes[1]! ? activationTimes : undefined
      })
      const inherited = await ProcessSupervisor.spawnTaskCommand(
        { taskID, cwd: projectDirectory },
        {
          executable: process.execPath,
          args: [
            "-e",
            "const {spawn}=require('node:child_process'); const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','inherit','inherit']}); process.stdout.write(String(c.pid)+'\\n'); setInterval(()=>{},1000)",
          ],
          owner: "task-control-inherited-stream",
        },
      )
      let inheritedOutput = ""
      inherited.stdout?.setEncoding("utf8")
      inherited.stdout?.on("data", (chunk) => (inheritedOutput += String(chunk)))
      const inheritedChildPID = await stream.waitFor("inherited-stream descendant PID", async () => {
        const pid = Number(inheritedOutput.trim().split(/\s+/)[0])
        return Number.isInteger(pid) && pid > 0 ? pid : undefined
      })
      const cancellationWorkerProcess = await stream.waitFor(
        "live Task-owned supervised process tree immediately before cancellation",
        async () => {
          const metrics = ProcessSupervisor.taskMetricsSnapshot(taskID)
          return metrics.owners["task-control-inherited-stream"]?.count ? metrics : undefined
        },
      )
      const cancellationStartedAt = performance.now()
      const cancellationRequestedAt = Date.now()
      const receipt = await cancel("task-control-cancel-first")
      const cancellationAcceptedWithinMs = performance.now() - cancellationStartedAt
      if (cancellationAcceptedWithinMs >= 1_000) {
        throw new Error(`Cancellation receipt took ${cancellationAcceptedWithinMs.toFixed(1)}ms`)
      }
      if (receipt.status !== "cancelling") {
        throw new Error(
          `Cancellation restart seed reached ${receipt.status} before a durable pending checkpoint existed`,
        )
      }
      const cancellationRequestEventEmittedAt = ProtocolStore.requireEvent(receipt.requestEventID).time.emitted
      await fs.writeFile(
        checkpointPath,
        JSON.stringify({
          ...checkpoint,
          recoveryActivationTimes: recovered,
          cancellationAcceptedWithinMs,
          cancellationRequestEventID: receipt.requestEventID,
          cancellationRequestEventEmittedAt,
          cancellationRequestedAt,
          cancellationWorkerProcess,
          inheritedProcessPIDs: [inherited.pid, inheritedChildPID],
        }),
        "utf8",
      )
      process.exit(0)
    }

    if (phase !== "verify") throw new Error(`Unknown task-control checker phase: ${phase}`)
    process.stdout.write(`[task-control phase] ${phase} awaiting terminal cancellation\n`)
    await waitForPolling(
      "terminal cancellation after backend restart",
      async () => ((await board()).task.status === "cancelled" ? true : undefined),
      15_000,
    )
    const cancellationTerminalWithinMs = Date.now() - (checkpoint.cancellationRequestedAt ?? Date.now())
    if (cancellationTerminalWithinMs >= 15_000) {
      throw new Error(`Cancellation terminal convergence took ${cancellationTerminalWithinMs}ms across restart`)
    }
    process.stdout.write(`[task-control phase] ${phase} awaiting terminal settlements\n`)
    let settlementActivityKey: string | undefined
    const settlements = await waitForPolling(
      "post-terminal checkpoint and auxiliary settlement",
      async () => {
        const artifacts = (await board()).artifacts.filter((artifact) =>
          ["task_checkpoint_settlement", "task_auxiliary_settlement"].includes(artifact.kind),
        )
        settlementActivityKey = artifacts
          .map(
            (artifact) =>
              `${artifact.id}:${["completed", "failed"].includes(artifact.label) ? artifact.label : "active"}`,
          )
          .sort()
          .join("|")
        if (artifacts.length !== 2 || artifacts.some((artifact) => !["completed", "failed"].includes(artifact.label))) {
          return undefined
        }
        for (const artifact of artifacts) {
          if (
            artifact.payload?.cancellation_request_event_id !== checkpoint.cancellationRequestEventID ||
            artifact.payload?.time_requested !== checkpoint.cancellationRequestEventEmittedAt
          ) {
            throw new Error(`Settlement ${artifact.id} lost cancellation request identity or request time`)
          }
        }
        return artifacts
      },
      INACTIVITY_MS,
      async () => settlementActivityKey,
    )
    const duplicate = await cancel("task-control-cancel-duplicate")
    if (duplicate.requestEventID !== checkpoint.cancellationRequestEventID) {
      throw new Error("Duplicate cancellation did not reuse the canonical request occurrence")
    }
    const events = ProtocolStore.listTaskEvents(taskID)
    const requestEvents = events.filter((event) => event.type === "task.cancellation.requested")
    const terminalEvents = events.filter((event) => event.type === "task.cancelled")
    if (requestEvents.length !== 1 || terminalEvents.length !== 1) {
      throw new Error(
        `Cancellation cardinality mismatch: requests=${requestEvents.length}, terminals=${terminalEvents.length}`,
      )
    }
    const finalBoard = await board()
    const ingressDispositions = finalBoard.artifacts
      .filter((artifact) => artifact.kind === "task_root_ingress")
      .map((artifact) => ({ id: artifact.id, label: artifact.label }))
    const unsettledIngresses = ingressDispositions.filter(
      (ingress) => !["drained", "delivery_failed", "terminal_inapplicable"].includes(ingress.label),
    )
    if (unsettledIngresses.length > 0) {
      throw new Error(`Cancellation left nonterminal ingress: ${JSON.stringify(unsettledIngresses)}`)
    }
    const processMetrics = ProcessSupervisor.metricsSnapshot()
    if (processMetrics.live !== 0)
      throw new Error(`Cancellation left ${processMetrics.live} supervised process(es) live`)
    const oldProcessPIDs = [
      ...Object.values(checkpoint.workerProcess?.owners ?? {}).flatMap((owner) => owner.pids),
      ...Object.values(checkpoint.cancellationWorkerProcess?.owners ?? {}).flatMap((owner) => owner.pids),
      ...(checkpoint.inheritedProcessPIDs ?? []),
    ]
    const survivingOldPIDs = oldProcessPIDs.filter((pid) => {
      try {
        process.kill(pid, 0)
        return true
      } catch {
        return false
      }
    })
    if (survivingOldPIDs.length > 0) {
      throw new Error(`Cancellation/restart left prior-process PID(s) live: ${survivingOldPIDs.join(", ")}`)
    }
    process.stdout.write(
      `[task-control result] ${JSON.stringify({
        status: "passed",
        taskID,
        lifecycleConvergence: checkpoint.lifecycleConvergence,
        progressIngressID: checkpoint.progressIngressID,
        recoveryIngressIDs: checkpoint.recoveryIngressIDs,
        recoveryActivationTimes: checkpoint.recoveryActivationTimes,
        childSessionID: checkpoint.childSessionID,
        progressRunningWithinMs: checkpoint.progressRunningWithinMs,
        workerProcess: checkpoint.workerProcess,
        cancellationWorkerProcess: checkpoint.cancellationWorkerProcess,
        inheritedProcessPIDs: checkpoint.inheritedProcessPIDs,
        survivingOldPIDs,
        workerRemainedLiveThroughProgress: true,
        cancellationRequestEventID: checkpoint.cancellationRequestEventID,
        cancellationRequestEventEmittedAt: checkpoint.cancellationRequestEventEmittedAt,
        cancellationAcceptedWithinMs: checkpoint.cancellationAcceptedWithinMs,
        cancellationTerminalWithinMs,
        cancellationTerminalEvents: terminalEvents.length,
        ingressDispositions,
        checkpointSettlement: settlements.find((artifact) => artifact.kind === "task_checkpoint_settlement"),
        auxiliarySettlement: settlements.find((artifact) => artifact.kind === "task_auxiliary_settlement"),
        processMetrics,
        restartPhases: ["pending_ingress", "pending_cancellation"],
      })}\n`,
    )
  } catch (error) {
    primaryFailure = error
    if (taskID) {
      try {
        await Instance.provide({
          directory: projectDirectory,
          fn: async () => {
            const current = await board()
            const assistantMessages = (
              await Promise.all(
                current.executionProjection.occurrences.map(async (occurrence) => ({
                  sessionID: occurrence.sessionID,
                  messages: (await Session.messages({ sessionID: occurrence.sessionID }))
                    .filter((message) => message.info.role === "assistant")
                    .slice(-3)
                    .map((message) => ({
                      id: message.info.id,
                      parts: message.parts.map((part) => {
                        if (part.type === "text" || part.type === "reasoning") {
                          return { type: part.type, characterCount: part.text.length }
                        }
                        if (part.type === "tool") {
                          return {
                            type: part.type,
                            tool: part.tool,
                            callID: part.callID,
                            status: part.state.status,
                          }
                        }
                        return { type: part.type }
                      }),
                    })),
                })),
              )
            ).filter((session) => session.messages.length > 0)
            const rootSessionID = current.artifacts
              .filter((artifact) => artifact.kind === "task_root_ingress")
              .map((artifact) => artifact.payload?.root_session_id)
              .find((value): value is string => typeof value === "string")
            const ownedPromptSessions = listOwnedPromptSessionsForTask(taskID)
            const evidence = {
              phase,
              taskID,
              currentProjectID: Instance.project.id,
              taskStatus: current.task.status,
              startedIncompleteTaskIDs: listStartedIncompleteTaskIDs({ projectID: Instance.project.id }),
              ownedPromptSessions,
              // `interruptedSessionEvidence` came from a projection removed in 627146cc when
              // execution state converged on immutable facts. The dynamic destructure kept
              // resolving to `undefined`, so this diagnostic threw for every task that had a
              // root session. Interrupted execution is now observable through the process
              // recovery facts this check already reports below.
              wakes: current.artifacts
                .filter((artifact) => artifact.kind === "task_root_ingress")
                .map((artifact) => ({ id: artifact.id, status: artifact.label })),
              lineages: current.artifacts
                .filter((artifact) => artifact.kind === "dispatch_lineage")
                .map((artifact) => ({ id: artifact.id, status: artifact.label })),
              recoveryArtifacts: current.artifacts
                .filter((artifact) => ["task-infrastructure-error", "task_wait_job"].includes(artifact.kind))
                .map((artifact) => ({ id: artifact.id, kind: artifact.kind, status: artifact.label })),
              executionCount: current.executionProjection.occurrences.length,
              assistantMessages,
              recentProtocolEvents: ProtocolStore.listTaskEvents(taskID)
                .slice(-20)
                .map((event) => ({
                  id: event.id,
                  type: event.type,
                  sessionID: event.sessionID,
                  emittedAt: event.time.emitted,
                })),
            }
            process.stderr.write(`[task-control failure evidence] ${JSON.stringify(evidence)}\n`)
          },
        })
      } catch (diagnosticError) {
        process.stderr.write(
          `[task-control failure evidence unavailable] ${
            diagnosticError instanceof Error ? diagnosticError.name : "UnknownDiagnosticError"
          }\n`,
        )
      }
    }
  } finally {
    abortStream.abort()
    const cleanupFailures: unknown[] = []
    try {
      await server.stop(true)
    } catch (error) {
      cleanupFailures.push(error)
      try {
        await Instance.disposeAll()
      } catch (disposeError) {
        cleanupFailures.push(disposeError)
      }
    }
    try {
      Database.close()
    } catch (error) {
      cleanupFailures.push(error)
    }
    if (primaryFailure && cleanupFailures.length > 0) {
      throw new AggregateError([primaryFailure, ...cleanupFailures], "Task-control phase failed during cleanup")
    }
    if (primaryFailure) throw primaryFailure
    if (cleanupFailures.length === 1) throw cleanupFailures[0]
    if (cleanupFailures.length > 1) throw new AggregateError(cleanupFailures, "Task-control phase cleanup failed")
  }
}

requiredOptIn()
const phase = process.env[PHASE]?.trim()
const runtimeRoot = process.env[RUNTIME_ROOT]?.trim()
if (!phase && !runtimeRoot) {
  await runDriver()
} else if (phase && runtimeRoot) {
  await runServerPhase(phase, assertTemporaryRoot(runtimeRoot))
} else {
  throw new Error(`${PHASE} and ${RUNTIME_ROOT} must be provided together`)
}
