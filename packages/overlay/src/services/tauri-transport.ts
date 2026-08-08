import {
  isPermissionGranted as tauriIsNotificationPermissionGranted,
  requestPermission as tauriRequestNotificationPermission,
} from "@tauri-apps/plugin-notification"

/**
 * tauri-transport — HostTransport implementation for the Tauri overlay
 * window. This is essentially the historical direct-fetch + EventSource
 * + Tauri invoke logic, refactored behind the HostTransport interface so
 * the overlay's services layer never sees the host details.
 *
 * Reads URL / auth state from `services/api.ts` to keep behaviour
 * identical to the pre-M3 codebase. The api module remains the single
 * configuration surface (configure(), getServerUrl(), apiHeaders()),
 * which lets settings panels keep working unchanged in M3.A.
 */

import {
  STREAM_INSTANCE_QUERY_KEY,
  STREAM_FAILURE_PROVENANCE,
  STREAM_LIFECYCLE_EVENT_NAME,
  STREAM_LIFECYCLE_PROTOCOL,
} from "@opencorvus-ai/transport-protocol"
import type { StreamCloseInitiator, StreamLifecycleEvent } from "@opencorvus-ai/transport-protocol"
import { apiHeaders as apiHeadersFromState, apiUrl as apiUrlFromState, onAuthChange } from "./api-state"
import type {
  HostTransport,
  NativeCommand,
  RequestBody,
  ResponseKind,
  StreamHandle,
  StreamHandlers,
  StreamOpenRequest,
  TransportRequest,
  TransportResponse,
} from "./host-transport"
import { HOST_CAPABILITIES, nativeUnsupported, transportRequestSignal } from "./host-transport"
import type { HostKind } from "./host-transport"
import { loadBrowserOverlaySettings, saveBrowserOverlaySettings } from "./overlay-settings-storage"

/**
 * Tauri window-handle accessor — the ONE place in the overlay that touches
 * `window.__TAURI__.window`. The native close lifecycle and the mutually
 * exclusive Windows/Linux application controls share this boundary so host
 * internals do not leak across UI components. Returns null when the Tauri
 * runtime is not present.
 */
export function getTauriWindowHandle(): any | null {
  if (typeof globalThis === "undefined") return null
  const w = (globalThis as any).window
  if (!w) return null
  const getCurrent = w.__TAURI__?.window?.getCurrentWindow
  if (typeof getCurrent !== "function") return null
  try {
    return getCurrent() ?? null
  } catch {
    return null
  }
}

export interface TauriEvent<T> {
  payload: T
}

export function tauriEventApiAvailable(): boolean {
  const w = (typeof globalThis !== "undefined" ? (globalThis as any).window : undefined) as any
  return typeof w?.__TAURI__?.event?.listen === "function"
}

/**
 * Typed event-listener boundary for messages emitted by the Rust host. Like
 * `getTauriWindowHandle` and `invokeTauri`, this keeps global Tauri internals
 * out of application components.
 */
export async function listenTauriEvent<T>(
  eventName: string,
  handler: (event: TauriEvent<T>) => void,
): Promise<() => void> {
  const w = (typeof globalThis !== "undefined" ? (globalThis as any).window : undefined) as any
  const eventApi = w?.__TAURI__?.event
  if (!tauriEventApiAvailable()) {
    throw new Error(`Tauri event API unavailable for ${eventName}`)
  }
  return eventApi.listen(eventName, handler)
}

/**
 * Wrapper for `window.__TAURI__.core.invoke`. This is now the SOLE
 * place in the entire overlay codebase that calls a Tauri invoke —
 * all business code goes through `host.native(...)` (CLAUDE.md §二-7,
 * §二-8). Throws if the runtime is missing so the caller surface
 * reports unsupported native commands explicitly.
 */
function invokeTauri(command: string, args?: Record<string, unknown>): Promise<unknown> {
  const w = (typeof globalThis !== "undefined" ? (globalThis as any).window : undefined) as any
  const fn = w?.__TAURI__?.core?.invoke
  if (typeof fn !== "function") {
    throw new Error(`Tauri runtime unavailable for ${command}`)
  }
  return fn(command, args)
}

function webNotificationApiAvailable(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

function webNotificationPermission(): "granted" | "denied" | "default" | "unsupported" {
  if (!webNotificationApiAvailable()) return "unsupported"
  return Notification.permission
}

async function webRequestNotificationPermission(): Promise<"granted" | "denied" | "default"> {
  if (!webNotificationApiAvailable()) return "denied"
  return Notification.requestPermission()
}

function webSendNotification(title: string, body?: string, tag?: string): boolean {
  if (!webNotificationApiAvailable() || Notification.permission !== "granted") return false
  new Notification(title, { body, tag })
  return true
}

function buildUrl(path: string, query?: TransportRequest["query"]): URL {
  // apiUrl already handles serverUrl + ?directory= injection.
  const u = new URL(apiUrlFromState(path))
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue
      u.searchParams.set(k, String(v))
    }
  }
  return u
}

function applyBody(init: RequestInit, body?: RequestBody): RequestInit {
  if (!body || body.kind === "none") return init
  switch (body.kind) {
    case "json":
      return {
        ...init,
        body: JSON.stringify(body.value),
        headers: { "Content-Type": "application/json", ...(init.headers as Record<string, string> | undefined) },
      }
    case "text":
      return {
        ...init,
        body: body.value,
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
          ...(init.headers as Record<string, string> | undefined),
        },
      }
    case "form":
      // FormData sets its own multipart Content-Type with boundary.
      return { ...init, body: body.value }
    case "binary":
      return {
        ...init,
        body: body.value as unknown as BodyInit,
        headers: {
          ...(body.contentType ? { "Content-Type": body.contentType } : {}),
          ...(init.headers as Record<string, string> | undefined),
        },
      }
  }
}

async function readResponse<T>(res: Response, kind: ResponseKind | undefined): Promise<T> {
  switch (kind) {
    case "text":
      return (await res.text()) as unknown as T
    case "binary": {
      const blob = await res.blob()
      const buf = new Uint8Array(await blob.arrayBuffer())
      return buf as unknown as T
    }
    case "json":
    case undefined: {
      // Empty 204/no-content bodies — return undefined so callers don't
      // hit JSON.parse on "".
      const text = await res.text()
      if (!text) return undefined as unknown as T
      return JSON.parse(text) as T
    }
  }
}

async function readErrorResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type")
  try {
    if (contentType?.toLowerCase().includes("application/json")) {
      return await readResponse<T>(res, "json")
    }
    return await readResponse<T>(res, "text")
  } catch {
    return undefined as T
  }
}

/**
 * POST-stream support: routes like /panel/message/stream send a JSON
 * body and stream the response as text/event-stream. EventSource cannot
 * do POST, so this path uses fetch + ReadableStream + manual SSE block
 * parsing. The Tauri WebView2 buffering issue does NOT apply here
 * because POST body upload triggers HTTP/1.1 (not HTTP/2), and our
 * server emits double-newline boundaries that flush per-block.
 */
function openPostStream(input: StreamOpenRequest, handlers: StreamHandlers): StreamHandle {
  const controller = new AbortController()
  const signal = input.signal ? mergeAbort(input.signal, controller.signal) : controller.signal
  let closed = false
  const closeWithReason = (reason: string): void => {
    if (closed) return
    closed = true
    activeStreamForceClose.delete(forceClose)
    try {
      controller.abort()
    } catch {}
    try {
      handlers.onClose?.(reason)
    } catch {}
  }
  const forceClose = () => closeWithReason("auth-changed")
  activeStreamForceClose.add(forceClose)
  const url = buildUrl(input.path, input.query)
  // audit-2026-04-29 overlay F4 — also serves authed GET-SSE: when
  // input.method is "GET" we still go through fetch (instead of
  // EventSource) because the only reason to be here under GET is that
  // the caller needs Authorization headers, which EventSource refuses.
  const method = input.method ?? "POST"
  const init: RequestInit = applyBody(
    {
      method,
      headers: {
        ...apiHeadersFromState(),
        ...(input.headers ?? {}),
      },
      signal,
    },
    input.body,
  )

  // Fire-and-forget: the close handle returns synchronously.
  void (async () => {
    let res: Response
    try {
      res = await fetch(url.toString(), init)
    } catch (err) {
      if (closed) return
      const error = err instanceof Error ? err : new Error(String(err))
      try {
        handlers.onError?.(error)
      } catch {}
      closeWithReason("post-stream-fetch-error")
      return
    }
    if (!res.ok || !res.body) {
      try {
        handlers.onError?.(new Error(`POST stream ${res.status}: ${res.statusText}`))
      } catch {}
      closeWithReason("post-stream-bad-response")
      return
    }
    try {
      handlers.onOpen?.()
    } catch {}

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ""
    const consume = (chunk: string, flush = false) => {
      buf += chunk
      const blocks = buf.split(/\r?\n\r?\n/)
      buf = flush ? "" : blocks.pop() || ""
      for (const block of blocks) {
        const data = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n")
        if (!data) continue
        try {
          handlers.onEvent(data)
        } catch {}
      }
    }

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          consume(decoder.decode(), true)
          break
        }
        consume(decoder.decode(value, { stream: true }))
      }
    } catch (err) {
      if (!closed) {
        const error = err instanceof Error ? err : new Error(String(err))
        try {
          handlers.onError?.(error)
        } catch {}
      }
    } finally {
      closeWithReason("post-stream-done")
    }
  })().catch((err) => {
    if (closed) return
    const error = err instanceof Error ? err : new Error(String(err))
    try {
      handlers.onError?.(error)
    } catch {}
    closeWithReason("post-stream-unhandled-error")
  })

  return {
    close(initiator: StreamCloseInitiator) {
      closeWithReason(initiator)
    },
  }
}

function mergeAbort(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a
  if (b.aborted) return b
  const c = new AbortController()
  const onA = () => c.abort()
  const onB = () => c.abort()
  a.addEventListener("abort", onA, { once: true })
  b.addEventListener("abort", onB, { once: true })
  return c.signal
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

/**
 * audit-2026-04-29 W2-V1 — module-level set of "force close on auth
 * change" thunks. Every stream opened via this transport registers a
 * thunk that closes itself with reason "auth-changed". When the user
 * rotates the sidecar password (configure({password})), api.ts fires
 * its auth-change event and we drain the set, prompting the business
 * reconnect timer in services/sse.ts to re-open with fresh headers.
 *
 * Without this, the browser's native EventSource keeps its original
 * URL + (lack of) headers forever; the only way to pick up a new
 * password was to navigate or reload the webview.
 */
const activeStreamForceClose = new Set<() => void>()
let streamLifecycleSequence = 0

type UnsequencedStreamLifecycleEvent = StreamLifecycleEvent extends infer Event
  ? Event extends StreamLifecycleEvent
    ? Omit<Event, "sequence">
    : never
  : never

function emitStreamLifecycle(event: UnsequencedStreamLifecycleEvent): void {
  globalThis.dispatchEvent(
    new CustomEvent(STREAM_LIFECYCLE_EVENT_NAME, {
      detail: { ...event, sequence: ++streamLifecycleSequence },
    }),
  )
}

let authChangeUnsubscribe: (() => void) | undefined

function ensureAuthChangeSubscribed(): void {
  if (authChangeUnsubscribe) return
  authChangeUnsubscribe = onAuthChange(() => {
    // Drain a snapshot so newly-opened streams (created during the
    // close cascade by the business reconnect) aren't immediately
    // re-closed.
    const snapshot = [...activeStreamForceClose]
    activeStreamForceClose.clear()
    for (const fn of snapshot) {
      try {
        fn()
      } catch {}
    }
  })
}

export function createTauriTransport(kind: Extract<HostKind, "tauri" | "browser"> = "tauri"): HostTransport {
  ensureAuthChangeSubscribed()
  return {
    kind,
    capabilities: HOST_CAPABILITIES[kind],
    async request<T = unknown>(input: TransportRequest): Promise<TransportResponse<T>> {
      const url = buildUrl(input.path, input.query)
      const signal = transportRequestSignal(input)
      const init: RequestInit = applyBody(
        {
          method: input.method ?? "GET",
          headers: { ...apiHeadersFromState(), ...(input.headers ?? {}) },
          signal,
        },
        input.body,
      )
      const res = await fetch(url.toString(), init)
      const body =
        res.ok || input.responseKind === "binary"
          ? await readResponse<T>(res, input.responseKind)
          : await readErrorResponse<T>(res)
      return {
        status: res.status,
        ok: res.ok,
        headers: headersToObject(res.headers),
        body,
      }
    },
    openStream(input: StreamOpenRequest, handlers: StreamHandlers): StreamHandle {
      const method = input.method ?? "GET"
      if (method === "POST") {
        return openPostStream(input, handlers)
      }
      // audit-2026-04-29 overlay F4 — when an Authorization header is
      // configured, the native EventSource cannot carry it (no API for
      // custom headers in the browser/WebView2). Falling through to
      // EventSource produces silent 401s. Switch to fetch-based SSE
      // parsing in that case so Basic Auth rides along; tradeoff is
      // we lose EventSource's auto-reconnect, but the business layer
      // (services/sse.ts) owns reconnect anyway (plan §5.5).
      const headers: Record<string, string> = { ...apiHeadersFromState(), ...(input.headers ?? {}) }
      if (headers.Authorization || headers.authorization) {
        return openPostStream({ ...input, method: "GET" } as StreamOpenRequest, handlers)
      }
      // Native EventSource: WebView2 (Tauri's webview backend) is known
      // to buffer ReadableStream chunks from fetch(), so SSE must NOT
      // be polyfilled on top of fetch in this transport for unauthed
      // streams. The note in services/sse.ts documents the original
      // incident.
      const streamID = globalThis.crypto.randomUUID()
      const url = buildUrl(input.path, input.query)
      url.searchParams.set(STREAM_INSTANCE_QUERY_KEY, streamID)
      const source = new EventSource(url.toString())
      let closed = false
      // audit-2026-04-29 overlay F3 — EventSource can stay in
      // CONNECTING forever on a hard-down server, never firing
      // CLOSED. After OPEN_TIMEOUT_MS without an `open` event we
      // synthesise onClose so the business reconnect timer fires.
      const OPEN_TIMEOUT_MS = 10_000
      let opened = false
      const closeWithReason = (reason: string, initiator: StreamCloseInitiator | "transport"): void => {
        if (closed) return
        closed = true
        emitStreamLifecycle({
          protocol: STREAM_LIFECYCLE_PROTOCOL,
          streamID,
          timestampMilliseconds: performance.timeOrigin + performance.now(),
          phase: "closing",
          requestURL: url.toString(),
          initiator,
          reason,
        })
        clearTimeout(stuckTimer)
        activeStreamForceClose.delete(forceClose)
        try {
          source.close()
        } catch {}
        try {
          handlers.onClose?.(reason)
        } catch {}
      }
      const forceClose = () => {
        if (closed) return
        try {
          handlers.onError?.(new Error("event-source auth-changed"))
        } catch {}
        closeWithReason("auth-changed", "transport")
      }
      activeStreamForceClose.add(forceClose)
      const stuckTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
        if (opened || closed) return
        try {
          handlers.onError?.(new Error("event-source open timeout"))
        } catch {}
        closeWithReason("event-source-stuck", "transport")
      }, OPEN_TIMEOUT_MS)
      if (typeof (stuckTimer as { unref?: () => void }).unref === "function") {
        ;(stuckTimer as { unref?: () => void }).unref!()
      }
      source.addEventListener("open", () => {
        opened = true
        clearTimeout(stuckTimer)
        emitStreamLifecycle({
          protocol: STREAM_LIFECYCLE_PROTOCOL,
          streamID,
          timestampMilliseconds: performance.timeOrigin + performance.now(),
          phase: "opened",
          requestURL: url.toString(),
        })
        try {
          handlers.onOpen?.()
        } catch {}
      })
      source.addEventListener("message", (e) => {
        try {
          handlers.onEvent((e as MessageEvent).data as string)
        } catch {}
      })
      source.addEventListener("error", () => {
        // Native EventSource automatically reconnects while CONNECTING. That
        // behavior violates HostTransport's single reconnect owner and can
        // repeatedly reopen a replay-expired URL before services/sse.ts has
        // reset its cursor. Close the native source on the first error; the
        // business layer owns the visible disconnected state, backoff, and
        // exact cursor used by the next stream.
        if (closed) return
        emitStreamLifecycle({
          protocol: STREAM_LIFECYCLE_PROTOCOL,
          streamID,
          timestampMilliseconds: performance.timeOrigin + performance.now(),
          phase: "failed",
          requestURL: url.toString(),
          failureProvenance: STREAM_FAILURE_PROVENANCE,
          reason: "event-source-error",
        })
        try {
          handlers.onError?.(new Error("event-source error"))
        } catch {}
        closeWithReason("event-source-error", "transport")
      })
      return {
        close(initiator: StreamCloseInitiator) {
          closeWithReason(initiator, initiator)
        },
      }
    },
    async native(command: NativeCommand): Promise<unknown> {
      if (kind === "browser") {
        switch (command.kind) {
          case "settings.load":
            return loadBrowserOverlaySettings()
          case "settings.save":
            return saveBrowserOverlaySettings(command.payload)
          case "notification.permission":
            return webNotificationPermission()
          case "notification.requestPermission":
            return webRequestNotificationPermission()
          case "notification.send":
            return webSendNotification(command.title, command.body, command.tag)
          default:
            return nativeUnsupported("browser", command)
        }
      }
      switch (command.kind) {
        case "open-url":
          return invokeTauri("overlay_open_url", { url: command.url })
        case "open-path":
          return invokeTauri("overlay_open_path", { path: command.path })
        case "browserPreview.sync":
          return invokeTauri("overlay_browser_preview_sync", {
            surfaceId: command.surfaceID,
            scopeKey: command.scopeKey,
            mountUrl: command.mountUrl,
            bounds: command.bounds,
          })
        case "browserPreview.navigate":
          return invokeTauri("overlay_browser_preview_navigate", {
            surfaceId: command.surfaceID,
            scopeKey: command.scopeKey,
            action: command.action,
          })
        case "browserPreview.navigateUrl":
          return invokeTauri("overlay_browser_preview_navigate_url", {
            surfaceId: command.surfaceID,
            scopeKey: command.scopeKey,
            url: command.url,
          })
        case "browserPreview.close":
          return invokeTauri("overlay_browser_preview_close", {
            surfaceId: command.surfaceID,
            scopeKey: command.scopeKey,
          })
        case "browserPreview.destroy":
          return invokeTauri("overlay_browser_preview_destroy", { surfaceId: command.surfaceID })
        case "browserPreview.selection.setEnabled":
          return invokeTauri("overlay_browser_preview_selection_set_enabled", {
            surfaceId: command.surfaceID,
            scopeKey: command.scopeKey,
            enabled: command.enabled,
            presentation: command.presentation ?? null,
          })
        case "browserPreview.selection.take":
          return invokeTauri("overlay_browser_preview_selection_take", {
            surfaceId: command.surfaceID,
            scopeKey: command.scopeKey,
          })
        case "browserPreview.currentPage":
          return invokeTauri("overlay_browser_preview_current_page", {
            surfaceId: command.surfaceID,
            scopeKey: command.scopeKey,
          })
        case "browserPreview.setZoom":
          return invokeTauri("overlay_browser_preview_set_zoom", {
            surfaceId: command.surfaceID,
            scopeKey: command.scopeKey,
            factor: command.factor,
          })
        case "settings.load":
          return invokeTauri("overlay_settings_load")
        case "settings.save":
          return invokeTauri("overlay_settings_save", { settings: command.payload })
        case "config.write-file":
          return invokeTauri("overlay_write_file", { path: command.path, content: command.content })
        case "server.info":
          return invokeTauri("overlay_server_info")
        case "server.restart":
          return invokeTauri("overlay_server_restart")
        case "devtools.toggle":
          return invokeTauri("overlay_toggle_devtools")
        case "desktopUpdate.check":
          return invokeTauri("overlay_desktop_update_check")
        case "desktopUpdate.download":
          return invokeTauri("overlay_desktop_update_download", { expectedVersion: command.expectedVersion })
        case "desktopUpdate.install":
          return invokeTauri("overlay_desktop_update_install", { expectedVersion: command.expectedVersion })
        case "window.quit":
          return invokeTauri("overlay_quit")
        case "badge.set":
          return invokeTauri("overlay_badge_set", { count: command.count })
        case "workspace.pickDir":
          return invokeTauri("overlay_pick_dir", { start: command.start || undefined })
        case "workspace.pickFiles":
          return invokeTauri("overlay_pick_files", {
            start: command.start || undefined,
            multiple: command.multiple ?? true,
          })
        case "workspace.openProjectEditor":
          return invokeTauri("overlay_open_project_editor", {
            editor: command.editor,
            path: command.path,
          })
        case "notification.permission": {
          const granted = await tauriIsNotificationPermissionGranted()
          if (granted) return "granted"
          return webNotificationPermission() === "denied" ? "denied" : "default"
        }
        case "notification.requestPermission":
          return tauriRequestNotificationPermission()
        case "notification.send":
          if (!(await tauriIsNotificationPermissionGranted())) return false
          return (
            (await invokeTauri("overlay_notification_send", {
              title: command.title,
              body: command.body,
            })) === true
          )
        default: {
          // Exhaustiveness — TypeScript narrows `command` to `never` here.
          // If a new NativeCommand kind is added without a case above, the
          // type-checker rejects this default.
          const _exhaustive: never = command
          void _exhaustive
          return nativeUnsupported("tauri", command)
        }
      }
    },
  }
}
