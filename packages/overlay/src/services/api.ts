// ── API Client ──
// Provides server URL detection, auth headers,
// and typed helpers for the OpenCorvus overlay.
//
// Internally everything HTTP-shaped routes through `HostTransport.request`
// so this module stays identical under the Tauri overlay and standalone
// browser/Vite host. Public callers stay on the same chokepoint.

import { DEFAULT_SERVER } from "./default-server"
import { getHostTransport } from "./host-transport-runtime"
import type { ResponseKind, TransportResponse } from "./host-transport"
import { bytesToArrayBuffer } from "../utils/binary"
import { getServerUrl, requestTarget, splitPathQuery } from "./api-state"

export { DEFAULT_SERVER }
export {
  ProjectDirectoryRequiredError,
  apiHeaders,
  apiUrl,
  configure,
  getServerUrl,
  onAuthChange,
  queryWithDirectory,
} from "./api-state"

/**
 * Build a TransportRequest body from a legacy RequestInit.body. Most callers
 * pass JSON.stringify(...) bodies + Content-Type header, so we detect that
 * and forward the parsed value to keep host transports JSON-aware.
 */
function bodyFromInit(init?: RequestInit) {
  if (!init?.body) return undefined as undefined
  if (typeof init.body === "string") {
    const ct = pickHeader(init.headers, "Content-Type") || pickHeader(init.headers, "content-type") || ""
    if (ct.toLowerCase().startsWith("application/json")) {
      try {
        return { kind: "json" as const, value: JSON.parse(init.body) }
      } catch {
        // Fall through to text — non-JSON content typed as JSON is a caller bug,
        // surface as text rather than swallowing.
      }
    }
    return { kind: "text" as const, value: init.body }
  }
  if (init.body instanceof FormData) return { kind: "form" as const, value: init.body }
  if (init.body instanceof Uint8Array) return { kind: "binary" as const, value: init.body }
  if (init.body instanceof ArrayBuffer) return { kind: "binary" as const, value: new Uint8Array(init.body) }
  // Other BodyInit shapes (Blob, ReadableStream) are not used by the
  // overlay today; throw rather than silently dropping them.
  throw new Error(`apiJson: unsupported body type ${(init.body as object)?.constructor?.name ?? typeof init.body}`)
}

function pickHeader(h: HeadersInit | undefined, name: string): string | undefined {
  if (!h) return undefined
  if (h instanceof Headers) return h.get(name) ?? undefined
  if (Array.isArray(h)) {
    const found = h.find(([k]) => k.toLowerCase() === name.toLowerCase())
    return found?.[1]
  }
  const obj = h as Record<string, string>
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase() === name.toLowerCase()) return v
  }
  return undefined
}

function methodFromInit(init?: RequestInit): "GET" | "POST" | "PUT" | "PATCH" | "DELETE" {
  const m = (init?.method ?? "GET").toUpperCase()
  if (m === "GET" || m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") return m
  throw new Error(`apiJson: unsupported HTTP method ${m}`)
}

function headersFromInit(init?: RequestInit): Record<string, string> | undefined {
  const h = init?.headers
  if (!h) return undefined
  if (h instanceof Headers) {
    const out: Record<string, string> = {}
    h.forEach((v, k) => {
      out[k] = v
    })
    return out
  }
  if (Array.isArray(h)) return Object.fromEntries(h)
  return { ...(h as Record<string, string>) }
}

/**
 * Lower-level companion to `apiJson`: returns the full TransportResponse
 * (status, headers, parsed body) so callers that need 304 / 409 / ETag /
 * raw bytes can stay on the HostTransport chokepoint without falling
 * back to direct `fetch`. Use this only when you need status or headers;
 * `apiJson` is still the preferred surface for plain JSON.
 */
export interface ApiRequestInit extends RequestInit {
  responseKind?: ResponseKind
  timeoutMilliseconds?: number | null
}

export async function apiRequest<T = unknown>(path: string, init?: ApiRequestInit): Promise<TransportResponse<T>> {
  const transport = getHostTransport()
  const method = methodFromInit(init)
  const { pathOnly, query } = requestTarget(path, method)
  return transport.request<T>({
    path: pathOnly,
    query,
    method,
    body: bodyFromInit(init),
    headers: headersFromInit(init),
    signal: init?.signal ?? undefined,
    timeoutMilliseconds: init?.timeoutMilliseconds,
    responseKind: init?.responseKind ?? "json",
  })
}

/**
 * Thrown by `apiJson` whenever the host transport returns a non-2xx
 * response. Carries the raw status, the request path, and the parsed
 * response body so callers that need the original failure detail can
 * pattern-match (`err instanceof ApiError && err.status === 400 → form
 * field error`). The `message` is pre-rendered for `console.error` /
 * direct toast use, prefering common server-error fields (message,
 * error, detail) before falling back to JSON.stringify, so the previous
 * "API 400: config" stub never re-occurs.
 */
export class ApiError extends Error {
  readonly status: number
  readonly path: string
  readonly body: unknown
  constructor(status: number, path: string, body: unknown) {
    super(formatApiErrorMessage(status, path, body))
    this.name = "ApiError"
    this.status = status
    this.path = path
    this.body = body
  }
}

function formatApiErrorMessage(status: number, path: string, body: unknown): string {
  const detail = pickServerErrorDetail(body)
  return detail ? `API ${status} ${path}: ${detail}` : `API ${status} ${path}`
}

function pickServerErrorDetail(body: unknown): string {
  if (body == null) return ""
  if (typeof body === "string") return body.trim()
  if (typeof body !== "object") return String(body)
  const obj = body as Record<string, unknown>
  // Hono / OpenAPI helpers tend to use one of these. Order matters: hono's
  // HTTPException default uses `message`, our errors() helper sometimes
  // uses `error`, RFC 7807 / generic frameworks use `detail`.
  for (const key of ["message", "error", "detail"]) {
    const v = obj[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  const namedErrorData = obj.data
  if (namedErrorData && typeof namedErrorData === "object" && !Array.isArray(namedErrorData)) {
    const message = (namedErrorData as Record<string, unknown>).message
    if (typeof message === "string" && message.trim()) return message.trim()
  }
  try {
    return JSON.stringify(body)
  } catch {
    return ""
  }
}

export interface ApiJsonInit extends RequestInit {
  timeoutMilliseconds?: number | null
}

/**
 * Opt one lifecycle mutation into server-owned request settlement. The server
 * response, or an explicit caller signal, is the only truthful completion
 * boundary for operations that stop live execution before committing data.
 */
export function serverSettledRequest(init: ApiJsonInit): ApiJsonInit {
  return { ...init, timeoutMilliseconds: null }
}

// The default keeps existing untyped callers source-compatible while typed
// service wrappers bind generated API response contracts at the request edge.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiJson<T = any>(path: string, init?: ApiJsonInit): Promise<T> {
  const transport = getHostTransport()
  const method = methodFromInit(init)
  const { pathOnly, query } = requestTarget(path, method)
  const res = await transport.request<T>({
    path: pathOnly,
    query,
    method,
    body: bodyFromInit(init),
    headers: headersFromInit(init),
    signal: init?.signal ?? undefined,
    timeoutMilliseconds: init?.timeoutMilliseconds,
    responseKind: "json",
  })
  if (!res.ok) throw new ApiError(res.status, path, res.body)
  return res.body
}

function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a
  if (b.aborted) return b
  const controller = new AbortController()
  const abort = () => controller.abort()
  a.addEventListener("abort", abort, { once: true })
  b.addEventListener("abort", abort, { once: true })
  return controller.signal
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

export async function apiJsonWithTimeout<T = unknown>(
  path: string,
  timeoutMilliseconds: number,
  init?: ApiJsonInit,
): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds)
  const signal = init?.signal ? mergeAbortSignals(init.signal, timeoutSignal) : timeoutSignal
  try {
    return (await apiJson(path, { ...init, signal })) as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new Error(`${path}: ${errorMessage(error)}`, {
      cause: error instanceof Error ? error : undefined,
    })
  }
}

// ── Resource URL resolution ──
// Server-side writers (AttachmentStore, etc.) persist URLs as
// server-relative paths like "/attachment/<projectID>/<sha>.<ext>". These
// cannot be dropped into <img src> / <a href> as-is: the browser resolves
// them against window.location.origin, which differs from the API server
// origin under Tauri (tauri://localhost) or any non-/ui deployment. Below
// is the single entry point for converting persisted resource URLs into
// something the webview can actually fetch.

/**
 * Resolve a persisted resource URL to an absolute URL the webview can load.
 *
 * - data: / blob: / http(s): / file: URLs are returned unchanged.
 * - Server-relative paths (leading "/") are prefixed with the configured
 *   serverUrl. The `directory` query parameter is deliberately NOT injected —
 *   attachment URLs carry `projectID` in their path and do not need Instance
 *   context; other resource routes are expected to follow the same discipline.
 * - Anything else is returned unchanged so callers can detect bare names.
 */
export function resolveResourceUrl(raw: string): string {
  if (!raw) return raw
  if (/^(?:data|blob|https?|file):/i.test(raw)) return raw
  if (raw.startsWith("/")) {
    const base = getServerUrl().replace(/\/+$/, "")
    return `${base}${raw}`
  }
  return raw
}

// ── Blob object URL cache ──
//
// The naive implementation of `fetchResourceAsObjectUrl` coupled the blob
// URL's lifetime to the lifetime of the rendering component (via
// `URL.revokeObjectURL` in an onCleanup). In practice overlay components
// remount often — the Conversation tree is re-derived whenever upstream
// state flushes — and each remount forced a full re-fetch of an
// already-loaded image while the stale blob URL was revoked, producing
// visible flicker.
//
// Decoupling: keep a module-level map from the raw persisted URL to the
// blob object URL. The cache owns the blob's lifetime; component mounts
// only read from it. When the cache grows past its cap, it evicts the
// least-recently-used entry and revokes its blob URL at eviction time —
// no per-component cleanup needed.
//
// `Map` iteration order equals insertion order, so "touch-on-read" + eviction
// of the first key gives LRU behaviour without an extra data structure.

const BLOB_CACHE_MAX = 256
// audit-2026-04-29 W2-P4 — limit concurrent in-flight fetches so a component
// mounting 1000 thumbnails doesn't queue 1000 promises, each holding megabytes
// of image-binary closure state. 64 is twice the typical viewport thumbnail
// count.
const BLOB_INFLIGHT_MAX = 64
const blobCache = new Map<string, string>()
interface BlobInFlightEntry {
  readonly controller: AbortController
  readonly promise: Promise<string>
  consumers: number
  settled: boolean
}

const blobInFlight = new Map<string, BlobInFlightEntry>()
const blobInFlightWaiters: Array<() => void> = []

function touchCache(raw: string, url: string): void {
  blobCache.delete(raw)
  blobCache.set(raw, url)
}

/**
 * audit-2026-04-29 W2-P4 — evict BEFORE inserting, never after. The
 * pre-fix `set; evictIfNeeded()` pattern allowed the cache to reach
 * size 257 between the two statements. Concurrent resolve-and-set
 * across many promises could push it transiently much higher.
 */
function evictToFitOne(): void {
  while (blobCache.size >= BLOB_CACHE_MAX) {
    const oldest = blobCache.keys().next().value
    if (oldest === undefined) return
    const url = blobCache.get(oldest)
    blobCache.delete(oldest)
    if (url) URL.revokeObjectURL(url)
  }
}

function resourceAbortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Resource request aborted", "AbortError")
}

function resourceAbandonedReason(): DOMException {
  return new DOMException("Resource request has no active consumers", "AbortError")
}

async function reserveInFlightSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw resourceAbortReason(signal)
  if (blobInFlight.size < BLOB_INFLIGHT_MAX) return
  return new Promise<void>((resolve, reject) => {
    let settled = false
    let onAbort: (() => void) | undefined
    const cleanup = () => {
      if (signal && onAbort) signal.removeEventListener("abort", onAbort)
    }
    const complete = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    if (signal) {
      onAbort = () => {
        if (settled) return
        settled = true
        const index = blobInFlightWaiters.indexOf(complete)
        if (index >= 0) blobInFlightWaiters.splice(index, 1)
        cleanup()
        reject(resourceAbortReason(signal))
      }
      signal.addEventListener("abort", onAbort, { once: true })
    }
    blobInFlightWaiters.push(complete)
  })
}

function releaseInFlightSlot(): void {
  const next = blobInFlightWaiters.shift()
  if (next) next()
}

/**
 * Synchronous cache peek. Returns the blob object URL already materialised
 * for this raw resource URL, or `undefined` if nothing is cached. Callers
 * that are allowed to render cached media immediately can pass this to
 * `createResource`'s `initialValue`; staged or lazy renderers must peek only
 * after their reveal gate opens, so a warm cache cannot bypass their frame
 * budget.
 */
export function peekResourceObjectUrl(raw: string): string | undefined {
  if (!raw) return undefined
  const cached = blobCache.get(raw)
  if (cached) touchCache(raw, cached)
  return cached
}

/**
 * Fetch a persisted resource and return a blob object URL. Used when the
 * webview needs to display a resource via <img src> / <a href>: a raw
 * server-relative URL cannot carry Authorization headers on native-element
 * loads, and in cross-origin webview contexts (Tauri) it would resolve to
 * the wrong origin. Routing through `fetch` with `apiHeaders()` gets both.
 *
 * The returned URL is owned by the module-level cache — callers MUST NOT
 * `URL.revokeObjectURL` it. Blobs are revoked on LRU eviction.
 *
 * Concurrent calls for the same raw URL share a single in-flight fetch, so
 * two components mounting at the same moment don't double the network
 * traffic. Throws on network / HTTP errors — no fallback to the raw URL,
 * since that would silently mask origin / auth mistakes.
 */
export async function fetchResourceAsObjectUrl(raw: string, options: { signal?: AbortSignal } = {}): Promise<string> {
  const signal = options.signal
  if (signal?.aborted) throw resourceAbortReason(signal)
  const cached = blobCache.get(raw)
  if (cached) {
    touchCache(raw, cached)
    return cached
  }
  let inFlight = blobInFlight.get(raw)
  if (!inFlight) {
    inFlight = createBlobInFlightEntry(raw)
    blobInFlight.set(raw, inFlight)
  }
  return consumeBlobInFlightEntry(inFlight, signal)
}

function createBlobInFlightEntry(raw: string): BlobInFlightEntry {
  const controller = new AbortController()
  let slotReserved = false
  const pending = (async () => {
    // audit-2026-04-29 W2-P4 — bound concurrent fetches so a render
    // burst of 1000 thumbnails doesn't queue 1000 in-flight promises
    // each holding a closure over the transport request.
    await reserveInFlightSlot(controller.signal)
    slotReserved = true
    const transport = getHostTransport()
    try {
      // Resource URLs may already be absolute (server-relative paths
      // start with "/" — those go through transport; data:/blob:/http(s)/
      // file: URLs short-circuit to plain fetch since transport can't
      // proxy arbitrary external schemes).
      if (/^(?:data|blob|file):/i.test(raw)) {
        const res = await fetch(raw, { signal: controller.signal })
        if (!res.ok) throw new Error(`resource ${res.status}: ${raw}`)
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        evictToFitOne()
        blobCache.set(raw, objectUrl)
        return objectUrl
      }
      if (/^https?:/i.test(raw)) {
        // External web image — webview CSP already restricts these
        // sources (plan §19.2.1); plain fetch is the right path.
        const res = await fetch(raw, { signal: controller.signal })
        if (!res.ok) throw new Error(`resource ${res.status}: ${raw}`)
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        evictToFitOne()
        blobCache.set(raw, objectUrl)
        return objectUrl
      }
      const { pathOnly, query } = splitPathQuery(raw.replace(/^\/+/, ""))
      const res = await transport.request<Uint8Array>({
        path: pathOnly,
        query,
        method: "GET",
        responseKind: "binary",
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`resource ${res.status}: ${raw}`)
      const ct = res.headers["content-type"] || res.headers["Content-Type"] || "application/octet-stream"
      const blob = new Blob([bytesToArrayBuffer(res.body as Uint8Array)], { type: ct })
      const objectUrl = URL.createObjectURL(blob)
      evictToFitOne()
      blobCache.set(raw, objectUrl)
      return objectUrl
    } finally {
      if (slotReserved) releaseInFlightSlot()
    }
  })()

  const entry: BlobInFlightEntry = { controller, promise: pending, consumers: 0, settled: false }
  pending.then(
    () => {
      entry.settled = true
      blobInFlight.delete(raw)
    },
    () => {
      entry.settled = true
      blobInFlight.delete(raw)
    },
  )
  return entry
}

function consumeBlobInFlightEntry(entry: BlobInFlightEntry, signal: AbortSignal | undefined): Promise<string> {
  if (signal?.aborted) return Promise.reject(resourceAbortReason(signal))
  entry.consumers += 1
  let released = false
  const releaseConsumer = () => {
    if (released) return
    released = true
    entry.consumers = Math.max(0, entry.consumers - 1)
    if (entry.consumers === 0 && !entry.settled && !entry.controller.signal.aborted) {
      entry.controller.abort(resourceAbandonedReason())
    }
  }

  if (!signal) {
    return entry.promise.finally(releaseConsumer)
  }

  return new Promise<string>((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort)
    }
    const onAbort = () => {
      cleanup()
      releaseConsumer()
      reject(resourceAbortReason(signal))
    }
    signal.addEventListener("abort", onAbort, { once: true })
    entry.promise.then(
      (value) => {
        cleanup()
        releaseConsumer()
        resolve(value)
      },
      (error) => {
        cleanup()
        releaseConsumer()
        reject(error)
      },
    )
  })
}
