import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const ALLOW_REAL_PROVIDER = "TASK_CONTROL_CHECK_ALLOW_REAL_PROVIDER"
const AUTH_SOURCE = "TASK_CONTROL_CHECK_AUTH_SOURCE"
const CONFIG_SOURCE = "TASK_CONTROL_CHECK_CONFIG_SOURCE"
const MODEL = "TASK_CONTROL_CHECK_MODEL"
const RUNTIME_ROOT = "TASK_CONTROL_CHECK_RUNTIME_ROOT"
const PHASE = "TASK_CONTROL_CHECK_PHASE"
const INACTIVITY_MS = 180_000
const CHECKPOINT_FILE = "task-control-checkpoint.json"

type StreamEvent = {
  type?: string
  sequence?: number
  payload?: Record<string, unknown>
  event_id?: string
  emittedAt?: number
}

type BoardArtifact = { id: string; kind: string; label: string; payload?: Record<string, unknown> }
type Board = {
  task: { status: string; cancellation?: { requestEventID?: string } }
  artifacts: BoardArtifact[]
  executionProjection: {
    occurrences: Array<{ sessionID: string; latest?: { status?: { type?: string } } }>
  }
}

type Checkpoint = {
  taskID: string
  progressIngressID: string
  recoveryIngressIDs: [string, string]
  childSessionID: string
  progressRunningWithinMs: number
  lspProcess: { count: number; pids: number[] }
  cancellationAcceptedWithinMs?: number
  cancellationRequestEventID?: string
  cancellationRequestEventEmittedAt?: number
  cancellationRequestedAt?: number
  recoveryCompletionTimes?: number[]
  cancellationLspProcess?: { count: number; pids: number[] }
  inheritedProcessPIDs?: number[]
}

class ActivityStream {
  readonly events: StreamEvent[] = []
  private meaningfulEventCount = 0
  private lastMeaningfulActivity = Date.now()
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
            process.stdout.write(`[task-control activity] ${event.type ?? "unknown"}\n`)
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
      await Bun.sleep(25)
    }
    throw new Error(`${label} produced no meaningful activity for ${inactivityMs}ms`)
  }
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

async function runPhaseProcess(phase: string, runtimeRoot: string): Promise<string> {
  const child = Bun.spawn([process.execPath, import.meta.path], {
    env: { ...process.env, [RUNTIME_ROOT]: runtimeRoot, [PHASE]: phase },
    stdout: "pipe",
    stderr: "pipe",
  })
  let stdout = ""
  let stderr = ""
  let lastActivity = Date.now()
  const collect = async (stream: ReadableStream<Uint8Array>, append: (text: string) => void) => {
    const decoder = new TextDecoder()
    for await (const chunk of stream) {
      lastActivity = Date.now()
      append(decoder.decode(chunk, { stream: true }))
    }
  }
  const readers = [collect(child.stdout, (text) => (stdout += text)), collect(child.stderr, (text) => (stderr += text))]
  let exitCode: number | undefined
  void child.exited.then((code) => (exitCode = code))
  while (exitCode === undefined) {
    if (Date.now() - lastActivity > INACTIVITY_MS) {
      child.kill()
      throw new Error(`Task-control ${phase} phase was inactive for ${INACTIVITY_MS}ms`)
    }
    await Bun.sleep(100)
  }
  await Promise.all(readers)
  if (exitCode !== 0) throw new Error(`Task-control ${phase} phase failed (${exitCode}): ${stderr || stdout}`)
  return stdout
}

async function runDriver() {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-task-control-"))
  try {
    await initRepository(path.join(runtimeRoot, "project"))
    await copyAuthorityFile(process.env[AUTH_SOURCE], path.join(runtimeRoot, "data", "auth.json"))
    await runPhaseProcess("seed-ingress", runtimeRoot)
    await runPhaseProcess("seed-cancellation", runtimeRoot)
    const evidence = await runPhaseProcess("verify", runtimeRoot)
    process.stdout.write(evidence)
  } finally {
    await fs.rm(assertTemporaryRoot(runtimeRoot), { recursive: true, force: true })
  }
}

async function runServerPhase(phase: string, runtimeRoot: string) {
  const projectDirectory = path.join(runtimeRoot, "project")
  const checkpointPath = path.join(runtimeRoot, CHECKPOINT_FILE)
  process.env.OPENCORVUS_TEST_HOME = runtimeRoot
  if (process.env[CONFIG_SOURCE]?.trim()) process.env.OPENCORVUS_CONFIG = path.resolve(process.env[CONFIG_SOURCE]!)

  const [{ Server }, { Database }, { Instance }, { ProcessSupervisor }, { ProtocolStore }] = await Promise.all([
    import("@/server/server"),
    import("@/storage/db"),
    import("@/project/instance"),
    import("@/shell/process-supervisor"),
    import("@/protocol/store"),
  ])
  const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  const base = server.url.toString().replace(/\/$/, "")
  const abortStream = new AbortController()
  let taskID = ""

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

  try {
    if (phase === "seed-ingress") {
      const createUrl = new URL(`${base}/task`)
      createUrl.searchParams.set("directory", projectDirectory)
      createUrl.searchParams.set("init-git", "false")
      const accepted = await json<{ task_id: string }>(createUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-opencorvus-request-id": `task-control-${Date.now()}` },
        body: JSON.stringify({
          productPillar: "code",
          source: "task-control-check",
          title: "Real task control convergence",
          request: [
            "Immediately dispatch one implementation worker to inspect task-control-fixture.ts with the TypeScript language server.",
            "Keep the worker performing useful read-only inspection and do not complete the Task until cancellation.",
            "Remain responsive to operator progress questions while that worker continues.",
          ].join(" "),
          ...(process.env[MODEL]?.trim() ? { model: process.env[MODEL]!.trim() } : {}),
          queue: false,
        }),
      })
      taskID = accepted.task_id
      const stream = await openStream()
      const lspObserved = stream.waitFor("real TypeScript language server process", async () => {
        const metrics = ProcessSupervisor.metricsSnapshot()
        return metrics.owners.lsp?.count ? metrics.owners.lsp : undefined
      })
      const dispatched = await stream.waitFor("detached live worker with idle root ingress owner", async () => {
        const current = await board()
        const lineage = current.artifacts.find((artifact) => artifact.kind === "dispatch_lineage")
        const childSessionID =
          typeof lineage?.payload?.child_session_id === "string" ? lineage.payload.child_session_id : undefined
        const child = current.executionProjection.occurrences.find(
          (occurrence) => occurrence.sessionID === childSessionID,
        )
        const activeIngress = current.artifacts.some(
          (artifact) => artifact.kind === "queued_operator_wake" && ["pending", "running"].includes(artifact.label),
        )
        return lineage && child && child.latest?.status?.type !== "terminal" && !activeIngress
          ? { childSessionID: childSessionID! }
          : undefined
      })
      const lspProcess = await lspObserved

      const progressStartedAt = performance.now()
      const progress = await sendMessage("What is running right now? Answer without stopping the worker.")
      const progressRunning = await stream.waitFor(
        "operator ingress running projection",
        async () => {
          const ingress = (await board()).artifacts.find((artifact) => artifact.id === progress.ingress_id)
          return ingress?.label === "running" || ingress?.label === "drained" ? ingress : undefined
        },
        2_000,
      )
      const progressRunningWithinMs = performance.now() - progressStartedAt
      await stream.waitFor("progress response while child remains live", async () => {
        const current = await board()
        const ingress = current.artifacts.find(
          (artifact) => artifact.id === progress.ingress_id && artifact.label === "drained",
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
      if (firstRecovery.wake_status !== "accepted" || secondRecovery.wake_status !== "queued") {
        throw new Error(`FIFO recovery seed failed: ${JSON.stringify({ firstRecovery, secondRecovery })}`)
      }
      await stream.waitFor("running ingress before abrupt restart", async () => {
        const ingress = (await board()).artifacts.find((artifact) => artifact.id === firstRecovery.ingress_id)
        return ingress?.label === "running" ? ingress : undefined
      })
      const checkpoint: Checkpoint = {
        taskID,
        progressIngressID: progress.ingress_id,
        recoveryIngressIDs: [firstRecovery.ingress_id, secondRecovery.ingress_id],
        childSessionID: dispatched.childSessionID,
        progressRunningWithinMs,
        lspProcess,
      }
      await fs.writeFile(checkpointPath, JSON.stringify(checkpoint), "utf8")
      void progressRunning
      process.exit(0)
    }

    const checkpoint = JSON.parse(await fs.readFile(checkpointPath, "utf8")) as Checkpoint
    taskID = checkpoint.taskID
    const stream = await openStream()

    if (phase === "seed-cancellation") {
      const recovered = await stream.waitFor("FIFO ingress recovery after backend restart", async () => {
        const current = await board()
        const ingresses = checkpoint.recoveryIngressIDs.map((id) =>
          current.artifacts.find((artifact) => artifact.id === id),
        )
        if (!ingresses.every((ingress) => ingress?.label === "drained")) return undefined
        const completionTimes = ingresses.map((ingress) =>
          Number(ingress?.payload?.delivery_result?.time_completed ?? 0),
        )
        return completionTimes[0]! > 0 && completionTimes[0]! <= completionTimes[1]! ? completionTimes : undefined
      })
      await sendMessage(
        "Before cancellation, inspect task-control-fixture.ts again with the TypeScript language server and report its type.",
      )
      const cancellationLspProcess = await stream.waitFor(
        "live TypeScript LSP immediately before cancellation",
        async () => {
          const metrics = ProcessSupervisor.metricsSnapshot()
          return metrics.owners.lsp?.count ? metrics.owners.lsp : undefined
        },
      )
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
          recoveryCompletionTimes: recovered,
          cancellationAcceptedWithinMs,
          cancellationRequestEventID: receipt.requestEventID,
          cancellationRequestEventEmittedAt,
          cancellationRequestedAt,
          cancellationLspProcess,
          inheritedProcessPIDs: [inherited.pid, inheritedChildPID],
        }),
        "utf8",
      )
      process.exit(0)
    }

    if (phase !== "verify") throw new Error(`Unknown task-control checker phase: ${phase}`)
    await stream.waitFor(
      "terminal cancellation after backend restart",
      async () => ((await board()).task.status === "cancelled" ? true : undefined),
      15_000,
    )
    const cancellationTerminalWithinMs = Date.now() - (checkpoint.cancellationRequestedAt ?? Date.now())
    if (cancellationTerminalWithinMs >= 15_000) {
      throw new Error(`Cancellation terminal convergence took ${cancellationTerminalWithinMs}ms across restart`)
    }
    const settlements = await stream.waitFor("post-terminal checkpoint and auxiliary settlement", async () => {
      const artifacts = (await board()).artifacts.filter((artifact) =>
        ["task_checkpoint_settlement", "task_auxiliary_settlement"].includes(artifact.kind),
      )
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
    })
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
      .filter((artifact) => artifact.kind === "queued_operator_wake")
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
      ...(checkpoint.lspProcess?.pids ?? []),
      ...(checkpoint.cancellationLspProcess?.pids ?? []),
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
    console.log(
      JSON.stringify(
        {
          status: "passed",
          taskID,
          progressIngressID: checkpoint.progressIngressID,
          recoveryIngressIDs: checkpoint.recoveryIngressIDs,
          recoveryCompletionTimes: checkpoint.recoveryCompletionTimes,
          childSessionID: checkpoint.childSessionID,
          progressRunningWithinMs: checkpoint.progressRunningWithinMs,
          lspProcess: checkpoint.lspProcess,
          cancellationLspProcess: checkpoint.cancellationLspProcess,
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
        },
        null,
        2,
      ),
    )
  } finally {
    abortStream.abort()
    await server.stop(true)
    await Instance.disposeAll().catch(() => {})
    Database.close()
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
