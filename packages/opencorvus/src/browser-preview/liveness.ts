import { LruCache } from "@/util/lru-cache"
import {
  resolveTaskProcessExecution,
} from "@/engine/task-execution-capsule-binding"
import { activeExecutionCapsuleRuntimeFact } from "@/execution-capsule/runtime"
import { ProcessSupervisor } from "@/shell/process-supervisor"

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"])
const PREVIEW_TARGET_REACHABILITY_REQUEST_TIMEOUT_MS = 1_000
const PREVIEW_TARGET_REACHABILITY_TIMEOUT_MS = 5_000
/**
 * Hard ceiling on one task-scoped probe.
 *
 * The task path answers a one-second question by spawning a supervised child
 * process, and every step around that fetch — capsule resolution, spawn, exit,
 * output settlement, disposal — is unbounded. Read paths await this: resolving
 * a Task's preview target is what the UI calls when opening a Task, so an
 * unbounded probe presents as a Task that will not open. A probe that cannot
 * answer within its own budget has answered: not reachable.
 */
const PREVIEW_TARGET_PROBE_DEADLINE_MS = 10_000
const PREVIEW_TARGET_REACHABILITY_INTERVAL_MS = 250
const PREVIEW_TARGET_LIVENESS_CACHE_TTL_MS = 3_000
export const PREVIEW_TARGET_LIVENESS_CACHE_MAX_ENTRIES = 256

type LivenessCacheEntry =
  | { state: "pending"; promise: Promise<boolean> }
  | { state: "settled"; reachable: boolean; checkedAt: number }

const livenessCache = new LruCache<string, LivenessCacheEntry>(PREVIEW_TARGET_LIVENESS_CACHE_MAX_ENTRIES)

function canonicalProbeUrl(raw: string): string {
  const url = new URL(raw)
  url.hash = ""
  return url.href
}

export function isLoopbackBrowserPreviewUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return LOOPBACK_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export async function isBrowserPreviewTargetVisible(input: {
  url: string
  now?: number
  taskID?: string
  cwd?: string
}): Promise<boolean> {
  if (!isLoopbackBrowserPreviewUrl(input.url)) return true
  const now = input.now ?? Date.now()
  const url = canonicalProbeUrl(input.url)
  const key = input.taskID ? `${input.taskID}:${url}` : `host:${url}`
  const cached = livenessCache.get(key)
  if (cached?.state === "pending") return cached.promise
  if (cached?.state === "settled") {
    if (now - cached.checkedAt <= PREVIEW_TARGET_LIVENESS_CACHE_TTL_MS) return cached.reachable
    livenessCache.delete(key)
  }

  let pending: Extract<LivenessCacheEntry, { state: "pending" }>
  const promise = probeBrowserPreviewUrl(url, { taskID: input.taskID, cwd: input.cwd }).then((reachable) => {
    if (livenessCache.peek(key) === pending) {
      livenessCache.set(key, { state: "settled", reachable, checkedAt: input.now ?? Date.now() })
    }
    return reachable
  })
  pending = { state: "pending", promise }
  livenessCache.set(key, pending)
  return promise
}

export async function waitForBrowserPreviewUrlReachable(
  url: string,
  input: {
    timeoutMs?: number
    intervalMs?: number
    taskID?: string
    cwd?: string
  } = {},
): Promise<boolean> {
  const timeoutMs = input.timeoutMs ?? PREVIEW_TARGET_REACHABILITY_TIMEOUT_MS
  const intervalMs = input.intervalMs ?? PREVIEW_TARGET_REACHABILITY_INTERVAL_MS
  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    if (await probeBrowserPreviewUrl(url, { taskID: input.taskID, cwd: input.cwd })) return true
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

async function probeBrowserPreviewUrl(url: string, task: { taskID?: string; cwd?: string }): Promise<boolean> {
  if (!task.taskID) return probeBrowserPreviewUrlDirect(url)
  return probeBrowserPreviewUrlInTask(url, { taskID: task.taskID, cwd: task.cwd })
}

/** Resolve `false` once the deadline passes, leaving the winner to the caller. */
function probeDeadline(): { expired: Promise<void>; cancel: () => void } {
  let cancel = () => {}
  const expired = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, PREVIEW_TARGET_PROBE_DEADLINE_MS)
    ;(timer as { unref?: () => void }).unref?.()
    cancel = () => clearTimeout(timer)
  })
  return { expired, cancel }
}

async function probeBrowserPreviewUrlDirect(url: string): Promise<boolean> {
  const signal = AbortSignal.timeout(PREVIEW_TARGET_REACHABILITY_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { method: "GET", cache: "no-store", signal })
    await response.body?.cancel().catch(() => undefined)
    return response.status >= 200 && response.status < 400
  } catch {
    return false
  }
}

async function probeBrowserPreviewUrlInTask(url: string, task: { taskID: string; cwd?: string }): Promise<boolean> {
  if (!task.cwd) throw new Error(`Task ${task.taskID} Browser preview liveness requires an exact cwd`)
  const identity = { taskID: task.taskID, cwd: task.cwd }
  const execution = await resolveTaskProcessExecution(identity)
  const runtime = execution.kind === "task_capsule" ? await activeExecutionCapsuleRuntimeFact() : undefined
  if (execution.kind === "task_capsule" && !runtime) {
    throw new Error(`Task ${task.taskID} Browser preview Capsule runtime is unavailable`)
  }
  const handle = await ProcessSupervisor.spawnTaskCommand(identity, {
    executable: runtime?.nodePath ?? process.execPath,
    args: [
      "-e",
      "fetch(process.argv[1],{signal:AbortSignal.timeout(1000)}).then(async response=>{await response.body?.cancel();process.stdout.write(response.status>=200&&response.status<400?'reachable':'unreachable')},()=>process.stdout.write('unreachable'))",
      url,
    ],
    env: {},
    owner: "browser-preview-liveness",
  })
  let stdout = ""
  handle.stdout?.setEncoding?.("utf8")
  handle.stdout?.on("data", (chunk) => (stdout += String(chunk)))
  const deadline = probeDeadline()
  try {
    // `exited` and `outputSettled` are both unbounded, and output settlement in
    // particular has stranded this runtime on Windows before. The deadline is
    // raced here, where the handle is still in scope, so an expired probe is
    // disposed rather than abandoned to finish minutes later.
    const settled = await Promise.race([
      (async () => {
        const code = await handle.exited
        await handle.outputSettled
        return { code }
      })(),
      deadline.expired.then(() => undefined),
    ])
    if (!settled) return false
    if (settled.code !== 0) throw new Error(`Task ${task.taskID} Browser preview liveness exited ${settled.code}`)
    return stdout === "reachable"
  } finally {
    deadline.cancel()
    await ProcessSupervisor.disposeAndWaitForExit(handle, "browser preview liveness").catch(() => undefined)
  }
}
