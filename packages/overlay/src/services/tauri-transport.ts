import {
  isPermissionGranted as tauriIsNotificationPermissionGranted,
  requestPermission as tauriRequestNotificationPermission,
} from "@tauri-apps/plugin-notification"

/**
 * tauri-transport — HostTransport implementation for the Tauri overlay
 * window and browser. HTTP requests, ticket-authenticated WebSocket streams
 * and native invocations share the existing API authority configuration.
 */

import {
  STREAM_INSTANCE_QUERY_KEY,
  STREAM_SOCKET_PATH,
  STREAM_SOCKET_PROTOCOL,
  STREAM_SOCKET_TICKET_PREFIX,
  STREAM_SOCKET_TARGET_HEADER,
  STREAM_SOCKET_METHOD_HEADER,
  STREAM_SOCKET_OPEN_TIMEOUT_MS,
  type StreamSocketControl,
  STREAM_FAILURE_PROVENANCE,
  STREAM_LIFECYCLE_EVENT_NAME,
  STREAM_LIFECYCLE_PROTOCOL,
} from "@opencorvus-ai/transport-protocol"
import type { StreamCloseInitiator, StreamLifecycleEvent } from "@opencorvus-ai/transport-protocol"
import {
  ApiAuthorityChangedError,
  apiHeaders as apiHeadersFromState,
  apiUrl as apiUrlFromState,
  assertApiAuthorityCurrent,
  captureApiAuthority,
  isApiAuthorityCurrent,
  onAuthChange,
} from "./api-state"
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
import { externalUrl } from "../utils/external-url"
import { secureContextFailure } from "../utils/secure-context"
import { loadBrowserOverlaySettings, saveBrowserOverlaySettings } from "./overlay-settings-storage"
import { randomUUID } from "../utils/random-id"

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

export async function currentExpertSquadInstallHandoff(): Promise<string | null> {
  const value = await invokeTauri("overlay_expert_squad_install_handoff_current")
  if (value === null) return null
  if (typeof value === "string") return value
  throw new Error("Native Expert Squad install handoff current command returned an invalid value")
}

export async function acknowledgeExpertSquadInstallHandoff(raw: string): Promise<boolean> {
  const value = await invokeTauri("overlay_expert_squad_install_handoff_acknowledge", { raw })
  if (typeof value === "boolean") return value
  throw new Error("Native Expert Squad install handoff acknowledge command returned an invalid value")
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

/** UI GET and POST streams share one socket; business owners retain reconnect. */
function openSocketStream(input: StreamOpenRequest, handlers: StreamHandlers): StreamHandle {
  const streamID = randomUUID()
  const url = buildUrl(input.path, input.query)
  url.searchParams.set(STREAM_INSTANCE_QUERY_KEY, streamID)
  const controller = new AbortController()
  let socket: WebSocket | undefined
  let closed = false
  let opened = false
  let buffer = ""
  const decoder = new TextDecoder()
  const lifecycle = (event: StreamLifecycleDetail) => {
    emitStreamLifecycle({
      ...event,
      protocol: STREAM_LIFECYCLE_PROTOCOL,
      streamID,
      timestampMilliseconds: performance.timeOrigin + performance.now(),
      requestURL: url.toString(),
    })
  }
  const close = (reason: string, initiator: StreamCloseInitiator | "transport" = "transport") => {
    if (closed) return
    closed = true
    clearTimeout(timer)
    activeStreamForceClose.delete(forceClose)
    input.signal?.removeEventListener("abort", abort)
    controller.abort()
    socket?.close()
    lifecycle({ phase: "closing", initiator, reason })
    try {
      handlers.onClose?.(reason)
    } catch {}
  }
  const fail = (error: unknown) => {
    if (closed) return
    const cause = error instanceof Error ? error : new Error(String(error))
    lifecycle({ phase: "failed", failureProvenance: STREAM_FAILURE_PROVENANCE, reason: cause.message })
    try {
      handlers.onError?.(cause)
    } catch {}
    close("stream-socket-error")
  }
  const forceClose = () => close("auth-changed")
  const abort = () => close("aborted")
  const timer = setTimeout(() => fail(new Error("stream socket open timeout")), STREAM_SOCKET_OPEN_TIMEOUT_MS)
  ;(timer as { unref?: () => void }).unref?.()
  activeStreamForceClose.add(forceClose)
  const consume = (chunk: string, flush = false) => {
    buffer += chunk
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = flush ? "" : blocks.pop() || ""
    for (const block of blocks) {
      if (closed) return
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n")
      if (data) {
        try {
          handlers.onEvent(data)
        } catch {}
      }
    }
  }
  if (input.signal?.aborted) abort()
  else input.signal?.addEventListener("abort", abort, { once: true })
  if (!closed)
    void (async () => {
      const init = applyBody(
        {
          method: "POST",
          headers: {
            ...apiHeadersFromState(),
            ...(input.headers ?? {}),
            [STREAM_SOCKET_METHOD_HEADER]: input.method ?? "GET",
            [STREAM_SOCKET_TARGET_HEADER]: url.pathname + url.search,
          },
          signal: controller.signal,
        },
        input.body,
      )
      const response = await fetch(buildUrl(STREAM_SOCKET_PATH).toString(), init)
      if (closed) {
        await response.body?.cancel()
        return
      }
      if (!response.ok) throw new Error("Stream admission " + response.status + ": " + (await response.text()))
      const { ticket } = (await response.json()) as { ticket: string }
      if (closed) return
      const endpoint = buildUrl(STREAM_SOCKET_PATH)
      endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:"
      socket = new WebSocket(endpoint.toString(), [STREAM_SOCKET_PROTOCOL, STREAM_SOCKET_TICKET_PREFIX + ticket])
      socket.binaryType = "arraybuffer"
      socket.addEventListener("message", (event) => {
        if (closed) return
        try {
          if (event.data instanceof ArrayBuffer) {
            consume(decoder.decode(event.data, { stream: true }))
            return
          }
          const control = JSON.parse(event.data) as StreamSocketControl
          if (control.type === "response") {
            if (!control.streaming) return
            opened = true
            clearTimeout(timer)
            lifecycle({ phase: "opened" })
            try {
              handlers.onOpen?.()
            } catch {}
          } else if (control.type === "error") fail(new Error(control.message))
          else if (control.type === "end") {
            consume(decoder.decode(), true)
            close("stream-done")
          }
        } catch (error) {
          fail(error)
        }
      })
      socket.addEventListener("error", () => fail(new Error("stream socket connection error")))
      socket.addEventListener("close", () => {
        if (!closed) fail(new Error(opened ? "stream socket disconnected" : "stream socket closed before response"))
      })
    })().catch(fail)
  return {
    close(initiator) {
      close(initiator, initiator)
    },
  }
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
 * its auth-change event and we drain the set. Close delivers the retired
 * authority to the original owner; only a current business owner may reconnect.
 *
 * Each socket admission and canonical request belong to that captured
 * authority, so retired readers settle before business owners reconnect.
 */
const activeStreamForceClose = new Set<() => void>()
let streamLifecycleSequence = 0

type UnsequencedStreamLifecycleEvent = StreamLifecycleEvent extends infer Event
  ? Event extends StreamLifecycleEvent
    ? Omit<Event, "sequence">
    : never
  : never

type StreamLifecycleDetail = UnsequencedStreamLifecycleEvent extends infer Event
  ? Event extends UnsequencedStreamLifecycleEvent
    ? Omit<Event, "protocol" | "streamID" | "timestampMilliseconds" | "requestURL">
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
      const authority = input.authority ?? captureApiAuthority()
      assertApiAuthorityCurrent(authority)
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
      let response: TransportResponse<T>
      try {
        const res = await fetch(url.toString(), init)
        const body =
          res.ok || input.responseKind === "binary"
            ? await readResponse<T>(res, input.responseKind)
            : await readErrorResponse<T>(res)
        response = {
          status: res.status,
          ok: res.ok,
          headers: headersToObject(res.headers),
          body,
        }
      } catch (error) {
        if (error instanceof ApiAuthorityChangedError) throw error
        assertApiAuthorityCurrent(authority, { phase: "transport_failure", cause: error })
        throw error
      }
      assertApiAuthorityCurrent(authority, { phase: "response", response })
      return response
    },
    openStream(input: StreamOpenRequest, handlers: StreamHandlers): StreamHandle {
      const authority = input.authority ?? captureApiAuthority()
      assertApiAuthorityCurrent(authority)
      const consumer = handlers
      handlers = {
        onOpen: () => {
          if (isApiAuthorityCurrent(authority)) consumer.onOpen?.()
        },
        onEvent: (data) => {
          if (isApiAuthorityCurrent(authority)) consumer.onEvent(data)
        },
        onError: (error) => {
          if (isApiAuthorityCurrent(authority)) consumer.onError?.(error)
        },
        // Close settles the original owner even when its UI/retry authority retired.
        onClose: (reason) => consumer.onClose?.(reason, { authority, current: isApiAuthorityCurrent(authority) }),
      }
      return openSocketStream(input, handlers)
    },
    async native(command: NativeCommand): Promise<unknown> {
      if (kind === "browser") {
        switch (command.kind) {
          case "settings.load":
            return loadBrowserOverlaySettings()
          case "settings.save":
            return saveBrowserOverlaySettings(command.payload)
          case "open-url": {
            // Validated first: unlike the desktop's OS opener, a page has no
            // backstop against a javascript: or data: URL.
            //
            // The return value is deliberately ignored. `window.open` returns
            // null whenever `noopener` or `noreferrer` is set — by spec, on
            // success as much as on failure — so it cannot distinguish an
            // opened tab from a blocked one, and treating null as failure
            // would report every successful open as an error.
            window.open(externalUrl(command.url).href, "_blank", "noopener,noreferrer")
            return true
          }
          case "clipboard.writeText":
            if (!navigator.clipboard?.writeText) {
              throw new Error(secureContextFailure("secure_context.subject.clipboard"))
            }
            return navigator.clipboard.writeText(command.text)
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
        case "clipboard.readText":
          return invokeTauri("overlay_clipboard_read_text")
        case "clipboard.writeText":
          return invokeTauri("overlay_clipboard_write_text", { text: command.text })
        case "settings.load":
          return invokeTauri("overlay_settings_load")
        case "settings.save":
          return invokeTauri("overlay_settings_save", { settings: command.payload })
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
            line: command.line,
            column: command.column,
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
