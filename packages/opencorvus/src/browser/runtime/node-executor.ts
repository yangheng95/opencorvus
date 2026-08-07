import { ProcessSupervisor } from "@/shell/process-supervisor"
import { activeExecutionCapsuleRuntimeFact } from "@/execution-capsule/runtime"
import { type BrowserNodeSidecarRuntime, resolveBrowserNodeSidecarRuntime } from "./node-sidecar"
import { resolveTaskProcessExecution } from "@/engine/task-execution-capsule-binding"

export interface BrowserNodeSidecarRunResult<TResult> {
  result: TResult
  stderr: string
  exitCode: number | null
  signal: NodeJS.Signals | null
}

export class BrowserNodeSidecarError extends Error {
  constructor(
    readonly kind: "aborted" | "invalid_json" | "spawn" | "timeout",
    message: string,
    readonly detail: {
      stderr?: string
      stdout?: string
    } = {},
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "BrowserNodeSidecarError"
  }
}

const CHILD_CLEANUP_TIMEOUT_MS = 5_000

async function terminateChildTree(child: ProcessSupervisor.Handle, timeoutMs = CHILD_CLEANUP_TIMEOUT_MS): Promise<boolean> {
  try {
    await ProcessSupervisor.terminateAndWaitForExit(child, `browser node sidecar process tree ${child.pid}`, {
      cleanupTimeoutMs: timeoutMs,
      exitTimeoutMs: timeoutMs,
    })
    return true
  } catch {
    return false
  }
}

type BrowserNodeSidecarInput = {
  runtime?: BrowserNodeSidecarRuntime
  script: string
  payload: unknown
  inactivityTimeoutMs: number
  signal?: AbortSignal
  label: string
}

export type BrowserNodeSidecarAuthority =
  | Readonly<{ kind: "host"; cwd: string }>
  | Readonly<{ kind: "task"; taskID: string; cwd: string }>

type BrowserNodeSpawner = (
  runtime: BrowserNodeSidecarRuntime,
  payload: unknown,
) => Promise<ProcessSupervisor.Handle>

async function runBrowserNodeSidecar<TResult>(
  input: BrowserNodeSidecarInput,
  runtime: BrowserNodeSidecarRuntime,
  payloadInput: unknown,
  spawnSidecar: BrowserNodeSpawner,
): Promise<BrowserNodeSidecarRunResult<TResult>> {
  if (input.signal?.aborted) {
    throw new BrowserNodeSidecarError(
      "aborted",
      input.signal.reason instanceof Error ? input.signal.reason.message : `${input.label} aborted`,
    )
  }
  const payload = Buffer.from(JSON.stringify(payloadInput), "utf8").toString("base64")
  const child = await spawnSidecar(runtime, payload)
  if (!child.stdin || !child.stdout || !child.stderr) {
    await child.dispose()
    throw new BrowserNodeSidecarError("spawn", `${input.label} supervisor did not expose stdio pipes`)
  }
  try {
    ;(child.stdin as NodeJS.WritableStream & { end(value: string): void }).end(input.script)

  let stdout = ""
  let stderr = ""
  let lastActivity = "start"
  let rejectRun: ((error: unknown) => void) | undefined
  child.stdout.setEncoding?.("utf8")
  child.stderr.setEncoding?.("utf8")
  child.stdout.on("data", (chunk) => {
    stdout += chunk
    resetInactivityTimer("stdout")
  })
  child.stderr.on("data", (chunk) => {
    stderr += chunk
    resetInactivityTimer("stderr")
  })

  let aborted = false
  let abortError: BrowserNodeSidecarError | undefined
  const abortHandler = () => {
    aborted = true
    abortError = new BrowserNodeSidecarError(
      "aborted",
      input.signal?.reason instanceof Error ? input.signal.reason.message : `${input.label} aborted`,
      { stderr, stdout },
    )
    void terminateChildTree(child).then((terminated) => {
      if (terminated) return
      abortError = new BrowserNodeSidecarError(
        "aborted",
        `${abortError?.message ?? `${input.label} aborted`}; child process did not exit within ${CHILD_CLEANUP_TIMEOUT_MS}ms after cleanup signal.`,
        { stderr, stdout },
      )
      rejectRun?.(abortError)
    })
  }
  input.signal?.addEventListener("abort", abortHandler, { once: true })
  let timeoutError: BrowserNodeSidecarError | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const clearInactivityTimer = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = undefined
  }
  const resetInactivityTimer = (source: string) => {
    lastActivity = source
    clearInactivityTimer()
    timer = setTimeout(() => {
      const baseTimeoutError = new BrowserNodeSidecarError(
        "timeout",
        `${input.label} inactive for ${input.inactivityTimeoutMs}ms after ${lastActivity}. stderr=${stderr.slice(-2000)}`,
        { stderr, stdout },
      )
      timeoutError = baseTimeoutError
      void terminateChildTree(child).then((terminated) => {
        if (!terminated) {
          timeoutError = new BrowserNodeSidecarError(
            "timeout",
            `${baseTimeoutError.message}; child process did not exit within ${CHILD_CLEANUP_TIMEOUT_MS}ms after cleanup signal.`,
            { stderr, stdout },
            { cause: baseTimeoutError },
          )
        }
        rejectRun?.(timeoutError)
      })
    }, input.inactivityTimeoutMs)
  }
  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    rejectRun = reject
    resetInactivityTimer("start")
    child.exited.then((code) => {
      clearInactivityTimer()
      resolve({ code, signal: null })
    }, reject)
  })
    .catch((error) => ({
      code: 1,
      signal: null,
      error,
    }))
    .finally(() => {
      rejectRun = undefined
      input.signal?.removeEventListener("abort", abortHandler)
      clearInactivityTimer()
    })

  if ("error" in exit) {
    const error = exit.error
    if (error instanceof BrowserNodeSidecarError) throw error
    throw new BrowserNodeSidecarError(
      "spawn",
      error instanceof Error ? error.message : String(error),
      { stderr },
      { cause: error },
    )
  }
  if (aborted) {
    throw abortError ?? new BrowserNodeSidecarError("aborted", `${input.label} aborted`, { stderr, stdout })
  }
  if (timeoutError) throw timeoutError

  let result: TResult
  try {
    result = JSON.parse(stdout) as TResult
  } catch (error) {
    throw new BrowserNodeSidecarError(
      "invalid_json",
      `${input.label} returned invalid JSON. stderr=${stderr.trim()} stdout=${stdout.slice(0, 500)}`,
      { stderr, stdout },
      { cause: error },
    )
  }

    return {
      result,
      stderr,
      exitCode: exit.code,
      signal: exit.signal,
    }
  } finally {
    await child.dispose()
  }
}

function command(runtime: BrowserNodeSidecarRuntime, payload: unknown, env: NodeJS.ProcessEnv) {
  return {
    executable: runtime.nodeExecutable,
    args: ["-", String(payload), runtime.playwrightRequirePath],
    env,
    stdin: "pipe" as const,
    owner: "browser-node-sidecar",
    gracefulTerminationMs: CHILD_CLEANUP_TIMEOUT_MS,
  }
}

export async function runHostBrowserNodeSidecar<TResult>(
  cwd: string,
  input: BrowserNodeSidecarInput,
): Promise<BrowserNodeSidecarRunResult<TResult>> {
  const runtime = input.runtime ?? (await resolveBrowserNodeSidecarRuntime())
  return runBrowserNodeSidecar(input, runtime, input.payload, (selectedRuntime, payload) =>
    ProcessSupervisor.spawnHostCommand({ ...command(selectedRuntime, payload, process.env), cwd }),
  )
}

export async function runTaskBrowserNodeSidecar<TResult>(
  identity: ProcessSupervisor.TaskProcessIdentity,
  input: BrowserNodeSidecarInput,
): Promise<BrowserNodeSidecarRunResult<TResult>> {
  const execution = await resolveTaskProcessExecution(identity)
  let runtime = input.runtime ?? (await resolveBrowserNodeSidecarRuntime())
  let payloadInput = input.payload
  if (execution.kind === "task_capsule") {
    const capsuleRuntime = await activeExecutionCapsuleRuntimeFact()
    if (!capsuleRuntime) throw new BrowserNodeSidecarError("spawn", "Browser Capsule runtime is unavailable")
    runtime = {
      nodeExecutable: capsuleRuntime.nodePath,
      playwrightRequirePath: capsuleRuntime.browserPlaywrightRequirePath,
      packaged: true,
    }
    if (payloadInput && typeof payloadInput === "object" && "executablePath" in payloadInput) {
      payloadInput = { ...payloadInput, executablePath: capsuleRuntime.browserExecutablePath }
    }
  }
  return runBrowserNodeSidecar(input, runtime, payloadInput, (selectedRuntime, payload) =>
    ProcessSupervisor.spawnTaskCommand(
      identity,
      command(selectedRuntime, payload, execution.kind === "task_capsule" ? {} : process.env),
    ),
  )
}

export function runExplicitBrowserNodeSidecar<TResult>(
  authority: BrowserNodeSidecarAuthority,
  input: BrowserNodeSidecarInput,
): Promise<BrowserNodeSidecarRunResult<TResult>> {
  return authority.kind === "task"
    ? runTaskBrowserNodeSidecar({ taskID: authority.taskID, cwd: authority.cwd }, input)
    : runHostBrowserNodeSidecar(authority.cwd, input)
}
