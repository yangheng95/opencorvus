import {
  createIsolatedProjectCheckWorkspace,
  disposeIsolatedProjectCheckWorkspaceAfterFailure,
  type IsolatedProjectCheckWorkspace,
} from "@/project/isolated-check-workspace"
import { Log } from "@/util/log"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { Shell } from "@/shell/shell"

const log = Log.create({ service: "guarded-command" })

export type GuardedCommandInput = {
  command: string
  projectDir: string
  timeoutMs: number
  env?: NodeJS.ProcessEnv
  signal?: AbortSignal
  background?: boolean
}

type GuardedCommandRequest = GuardedCommandInput &
  ({ owner: "host" } | { owner: "task"; taskID: string })
type GuardedExecutionRequest = GuardedCommandRequest & { deadlineAt: number }

export function runGuardedHostCommand(input: GuardedCommandInput): Promise<string> {
  return runGuardedCommand({ ...input, owner: "host" })
}

export function runGuardedTaskCommand(input: GuardedCommandInput & { taskID: string }): Promise<string> {
  return runGuardedCommand({ ...input, owner: "task" })
}

async function runGuardedCommand(input: GuardedCommandRequest): Promise<string> {
  const deadlineAt = Date.now() + Math.max(0, input.timeoutMs)
  const deadline = createGuardedCommandDeadline(deadlineAt, input.signal)
  let isolated: IsolatedProjectCheckWorkspace
  try {
    isolated = await createIsolatedProjectCheckWorkspace({
      projectDir: input.projectDir,
      sourceCwd: input.projectDir,
      taskID: input.owner === "task" ? input.taskID : undefined,
      signal: deadline.signal,
    })
  } catch (error) {
    deadline.dispose()
    throw error
  }
  const scopedInput = { ...input, projectDir: isolated.workspace, signal: deadline.signal, deadlineAt }
  let cleanupTransferred = false
  let deadlineTransferred = false
  let foregroundCleanupAttempted = false
  try {
    const backgroundResult = input.background ? await runBackgroundCommand(scopedInput) : undefined
    const parts = backgroundResult ? backgroundResult.parts : await runForegroundCommand(scopedInput)
    parts.unshift(`source_cwd: ${input.projectDir}`, `execution_cwd: ${isolated.workspace}`)
    if (input.background) {
      scheduleWorkspaceCleanup(isolated, deadlineAt, deadline.signal, backgroundResult!.exited, deadline.dispose)
      cleanupTransferred = true
      deadlineTransferred = true
    } else {
      foregroundCleanupAttempted = true
      await ProcessSupervisor.awaitWithTimeout(
        isolated.dispose(),
        Math.max(1, deadlineAt + ProcessSupervisor.TERMINATION_CLEANUP_TIMEOUT_MS - Date.now()),
        `guarded command isolated workspace cleanup exceeded its absolute cleanup deadline: ${isolated.root}`,
      )
      cleanupTransferred = true
    }
    return parts.join("\n") || "exit_code: 0 (no output)"
  } catch (error) {
    if (cleanupTransferred || foregroundCleanupAttempted) throw error
    return disposeIsolatedProjectCheckWorkspaceAfterFailure(
      isolated,
      error,
      "guarded command execution and cleanup failed",
    )
  } finally {
    if (!deadlineTransferred) deadline.dispose()
  }
}

function createGuardedCommandDeadline(deadlineAt: number, parent?: AbortSignal) {
  const controller = new AbortController()
  const abortFromParent = () => controller.abort(parent?.reason)
  if (parent?.aborted) abortFromParent()
  else parent?.addEventListener("abort", abortFromParent, { once: true })
  const timer = setTimeout(
    () => controller.abort(new DOMException("Guarded command deadline exceeded", "TimeoutError")),
    Math.max(0, deadlineAt - Date.now()),
  )
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      parent?.removeEventListener("abort", abortFromParent)
    },
  }
}

async function runForegroundCommand(input: GuardedExecutionRequest): Promise<string[]> {
  const options = {
    env: input.env,
    timeoutMs: input.timeoutMs,
    abort: input.signal,
    deadlineAt: input.deadlineAt,
  }
  const result = input.owner === "task"
    ? await Shell.runTask({ taskID: input.taskID, cwd: input.projectDir }, input.command, options)
    : await Shell.runHost(input.command, { ...options, cwd: input.projectDir })
  const parts = [`exit_code: ${result.exitCode}`]
  if (typeof result.pid === "number") parts.push(`pid: ${result.pid}`)
  if (result.timedOut) parts.push(`timeout_ms: ${input.timeoutMs}`)
  if (result.aborted) parts.push("aborted: true")
  if (result.stdout.trim()) parts.push(`stdout:\n${result.stdout.slice(0, 8_000)}`)
  if (result.stderr.trim()) parts.push(`stderr:\n${result.stderr.slice(0, 5_000)}`)
  return parts
}

async function runBackgroundCommand(input: GuardedExecutionRequest): Promise<{ parts: string[]; exited: Promise<void> }> {
  const deadlineAt = input.deadlineAt
  const options = {
    env: input.env,
    outputSniffMs: Math.min(Math.max(0, (deadlineAt ?? Date.now() + input.timeoutMs) - Date.now()), 10_000),
    deadlineAt,
    abort: input.signal,
  }
  const result = input.owner === "task"
    ? await Shell.launchTask({ taskID: input.taskID, cwd: input.projectDir }, input.command, options)
    : await Shell.launchHost(input.command, { ...options, cwd: input.projectDir })
  return {
    exited: result.exited,
    parts: [
      "background: true",
      `pid: ${result.pid}`,
      result.address ? `url: ${result.address}` : "",
      `lease_timeout_ms: ${input.timeoutMs}`,
      result.initialOutput.trim() ? `startup_output:\n${result.initialOutput}` : "",
    ].filter((part) => part.length > 0),
  }
}

function scheduleWorkspaceCleanup(
  workspace: IsolatedProjectCheckWorkspace,
  deadlineAt: number,
  signal: AbortSignal | undefined,
  processExited: Promise<void>,
  releaseDeadline: () => void,
): void {
  let cleaned = false
  const cleanupDelayMs = Math.max(deadlineAt - Date.now(), 1) + 1_000
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    clearTimeout(timer)
    signal?.removeEventListener("abort", cleanup)
    void cleanupBackgroundWorkspace(workspace, processExited)
      .catch((error) => {
        log.error("failed to clean isolated background command workspace", {
          workspace: workspace.root,
          error: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(releaseDeadline)
  }
  const timer = setTimeout(cleanup, cleanupDelayMs)
  timer.unref?.()
  processExited.finally(cleanup).catch(cleanup)
  if (signal?.aborted) cleanup()
  else signal?.addEventListener("abort", cleanup, { once: true })
}

async function cleanupBackgroundWorkspace(
  workspace: IsolatedProjectCheckWorkspace,
  processExited: Promise<void>,
): Promise<void> {
  await waitForBackgroundExit(processExited, 5_000)
  await ProcessSupervisor.disposeLiveProcessesUnder(workspace.root)
  let lastError: unknown
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await workspace.dispose()
      return
    } catch (error) {
      lastError = error
      await Bun.sleep(100)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "unknown workspace cleanup failure"))
}

async function waitForBackgroundExit(processExited: Promise<void>, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      processExited,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
