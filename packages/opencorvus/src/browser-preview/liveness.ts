import { LruCache } from "@/util/lru-cache"
import { BrowserNodeSidecarError, runTaskBrowserNodeSidecar } from "@/browser/runtime/node-executor"

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"])
const PREVIEW_TARGET_REACHABILITY_REQUEST_TIMEOUT_MS = 1_000
const PREVIEW_TARGET_REACHABILITY_TIMEOUT_MS = 5_000
/**
 * The supervised Node sidecar bounds process/output inactivity and owns child
 * cleanup. HTTP reachability has the separate one-second request deadline.
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
  }).catch((error) => {
    if (livenessCache.peek(key) === pending) livenessCache.delete(key)
    throw error
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
  const sidecar = await runTaskBrowserNodeSidecar<{ reachable: boolean }>(
    { taskID: task.taskID, cwd: task.cwd },
    {
      script: [
        "const input=JSON.parse(Buffer.from(process.argv[2],'base64').toString('utf8'));",
        "fetch(input.url,{method:'GET',cache:'no-store',signal:AbortSignal.timeout(input.timeoutMs)})",
        ".then(async response=>{await response.body?.cancel();process.stdout.write(JSON.stringify({reachable:response.status>=200&&response.status<400}))},",
        "()=>process.stdout.write(JSON.stringify({reachable:false})));",
      ].join(""),
      payload: { url, timeoutMs: PREVIEW_TARGET_REACHABILITY_REQUEST_TIMEOUT_MS },
      inactivityTimeoutMs: PREVIEW_TARGET_PROBE_DEADLINE_MS,
      label: `Task ${task.taskID} Browser preview liveness`,
    },
  )
  if (sidecar.exitCode !== 0 || typeof sidecar.result?.reachable !== "boolean") {
    throw new BrowserNodeSidecarError("invalid_json", `Task ${task.taskID} Browser preview liveness returned an invalid result (exit=${sidecar.exitCode}). stderr=${sidecar.stderr}`, {
      stderr: sidecar.stderr,
      stdout: JSON.stringify(sidecar.result),
    })
  }
  return sidecar.result.reachable
}
