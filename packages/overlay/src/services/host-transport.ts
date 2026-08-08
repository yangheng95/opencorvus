/**
 * HostTransport — single cross-host abstraction for everything the
 * overlay UI needs to talk to: HTTP requests, server-sent events, and
 * native (host-specific) commands.
 *
 * Runtime implementations:
 *   - tauri-transport.ts: forwards to direct fetch / EventSource / Tauri
 *     invoke. Default for the desktop overlay window.
 *   - browser mode: reuses tauri-transport HTTP/SSE and stores overlay
 *     settings in browser storage for standalone Vite development.
 *
 * Selection happens exactly once, at app boot, in `createHostTransport()`.
 * Business code MUST NOT reach for `window.__TAURI__` directly: everything
 * goes through this interface. This is the single chokepoint that keeps the
 * desktop and browser hosts from diverging into two-source business logic.
 */

import type { StreamCloseInitiator } from "@opencorvus-ai/transport-protocol"

export type HostKind = "tauri" | "browser"

export const DEFAULT_REQUEST_TIMEOUT_MILLISECONDS = 15_000

// ── Request / Response (HTTP) ──

export type RequestBody =
  | { kind: "none" }
  | { kind: "json"; value: unknown }
  | { kind: "text"; value: string }
  | { kind: "form"; value: FormData }
  | { kind: "binary"; value: Uint8Array; contentType?: string }

export type ResponseKind = "json" | "text" | "binary"

export interface TransportRequest {
  /**
   * Server-relative path, e.g. `task/abc/conversation`. Leading `/` is
   * stripped. NEVER include scheme/host — those are added by the
   * transport. The bridge in M4 rejects absolute URLs (plan §6.2).
   */
  path: string
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  query?: Record<string, string | number | boolean | undefined | null>
  /** Body. Defaults to no body. */
  body?: RequestBody
  /** Extra headers (Authorization is injected by the transport). */
  headers?: Record<string, string>
  /**
   * What format the caller wants back. JSON is the common case; binary
   * is for `fetchResourceAsObjectUrl` and similar; text is for SSE
   * fallbacks and rare byte-aware paths.
   */
  responseKind?: ResponseKind
  /**
   * Transport request timeout. `undefined` uses the transport default;
   * `null` means the caller owns lifetime through `signal` or through
   * the server response. This is reserved for long-running operations
   * whose correct completion is a single response, such as deleting a
   * large Windows worktree.
   */
  timeoutMilliseconds?: number | null
  /** Optional abort signal. */
  signal?: AbortSignal
}

export interface TransportResponse<T = unknown> {
  status: number
  ok: boolean
  headers: Record<string, string>
  body: T
}

// ── Streaming (SSE) ──

export interface StreamOpenRequest {
  /** Same path semantics as TransportRequest.path. */
  path: string
  /**
   * Defaults to "GET" for classic SSE endpoints. Use "POST" with a
   * body for streaming-RPC routes like /panel/message/stream where
   * the request payload is sent as JSON and the response is an SSE
   * stream (text/event-stream over POST).
   */
  method?: "GET" | "POST"
  query?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  /** Optional request body — only meaningful when method is "POST". */
  body?: RequestBody
  /** Optional abort signal for upstream cancellation. */
  signal?: AbortSignal
}

export interface StreamHandlers {
  onOpen?: () => void
  /** Each event's decoded `data` field. */
  onEvent: (data: string) => void
  onError?: (err: Error) => void
  /** Fires on disconnect for any reason (server close, network, abort). */
  onClose?: (reason: string) => void
}

export interface StreamHandle {
  close(initiator: StreamCloseInitiator): void
}

export function transportRequestSignal(
  input: Pick<TransportRequest, "signal" | "timeoutMilliseconds">,
): AbortSignal | undefined {
  if (input.signal) return input.signal
  if (input.timeoutMilliseconds === null) return undefined
  return AbortSignal.timeout(input.timeoutMilliseconds ?? DEFAULT_REQUEST_TIMEOUT_MILLISECONDS)
}

// ── Native (host-specific) commands ──
//
// Discriminated union of every host-specific command the overlay
// expects. New commands MUST extend this union:
// adding an ad-hoc Tauri invoke without listing it here is a violation
// of the single-chokepoint contract.

export interface ServerInfo {
  url: string
  pid?: number
  port?: number
}

export type {
  BrowserPreviewNativeBounds,
  BrowserPreviewNativeNavigationAction,
  BrowserPreviewNativePage,
  BrowserPreviewNativeSelection,
  BrowserPreviewNativeSelectionLabels,
  BrowserPreviewNativeSelectionPalette,
  BrowserPreviewNativeSelectionPresentation,
  BrowserPreviewNativeSelectionResult,
  NativeCommand,
  NativeCommandKind,
  ProjectEditorID,
} from "@opencorvus-ai/transport-protocol"
export { PROJECT_EDITOR_IDS } from "@opencorvus-ai/transport-protocol"

import { PROJECT_EDITOR_IDS } from "@opencorvus-ai/transport-protocol"
import type { NativeCommand, NativeCommandKind, ProjectEditorID } from "@opencorvus-ai/transport-protocol"

export type NativeCommandCapabilities = Readonly<Record<NativeCommandKind, boolean>>

export interface HostUiCapabilities {
  /** Whether Ctrl/Cmd zoom shortcuts should be owned by the overlay. */
  readonly overlayZoomHotkeys: boolean
  /** Whether a missing workspace should be entered manually instead of through a host picker. */
  readonly manualWorkspacePathEntry: boolean
  /** Whether desktop notification delivery requires a host permission grant. */
  readonly desktopNotificationsRequirePermission: boolean
  /** Project editors that this host can launch through workspace.openProjectEditor. */
  readonly projectEditors: readonly ProjectEditorID[]
}

export interface HostCapabilities {
  readonly nativeCommands: NativeCommandCapabilities
  readonly ui: HostUiCapabilities
}

const TAURI_NATIVE_COMMANDS: NativeCommandCapabilities = {
  "open-url": true,
  "open-path": true,
  "browserPreview.sync": true,
  "browserPreview.navigate": true,
  "browserPreview.navigateUrl": true,
  "browserPreview.close": true,
  "browserPreview.destroy": true,
  "browserPreview.selection.setEnabled": true,
  "browserPreview.selection.take": true,
  "browserPreview.currentPage": true,
  "browserPreview.setZoom": true,
  "settings.load": true,
  "settings.save": true,
  "config.write-file": true,
  "server.info": true,
  "server.restart": true,
  "devtools.toggle": true,
  "desktopUpdate.check": true,
  "desktopUpdate.download": true,
  "desktopUpdate.install": true,
  "window.quit": true,
  "badge.set": true,
  "workspace.pickDir": true,
  "workspace.pickFiles": true,
  "workspace.openProjectEditor": true,
  "notification.permission": true,
  "notification.requestPermission": true,
  "notification.send": true,
}

const BROWSER_NATIVE_COMMANDS: NativeCommandCapabilities = {
  "open-url": false,
  "open-path": false,
  "browserPreview.sync": false,
  "browserPreview.navigate": false,
  "browserPreview.navigateUrl": false,
  "browserPreview.close": false,
  "browserPreview.destroy": false,
  "browserPreview.selection.setEnabled": false,
  "browserPreview.selection.take": false,
  "browserPreview.currentPage": false,
  "browserPreview.setZoom": false,
  "settings.load": true,
  "settings.save": true,
  "config.write-file": false,
  "server.info": false,
  "server.restart": false,
  "devtools.toggle": false,
  "desktopUpdate.check": false,
  "desktopUpdate.download": false,
  "desktopUpdate.install": false,
  "window.quit": false,
  "badge.set": false,
  "workspace.pickDir": false,
  "workspace.pickFiles": false,
  "workspace.openProjectEditor": false,
  "notification.permission": true,
  "notification.requestPermission": true,
  "notification.send": true,
}

export const HOST_CAPABILITIES: Readonly<Record<HostKind, HostCapabilities>> = {
  tauri: {
    nativeCommands: TAURI_NATIVE_COMMANDS,
    ui: {
      overlayZoomHotkeys: true,
      manualWorkspacePathEntry: false,
      desktopNotificationsRequirePermission: true,
      projectEditors: PROJECT_EDITOR_IDS,
    },
  },
  browser: {
    nativeCommands: BROWSER_NATIVE_COMMANDS,
    ui: {
      overlayZoomHotkeys: false,
      manualWorkspacePathEntry: true,
      desktopNotificationsRequirePermission: true,
      projectEditors: [],
    },
  },
} as const

export class UnsupportedNativeCommandError extends Error {
  override readonly name: string = "UnsupportedNativeCommandError"
  constructor(
    public readonly host: HostKind,
    public readonly command: NativeCommand,
  ) {
    super(`Native command "${command.kind}" is not available in host "${host}".`)
  }
}

// ── The interface ──

export interface HostTransport {
  readonly kind: HostKind
  readonly capabilities: HostCapabilities
  /**
   * Issue a single HTTP request. The transport handles Authorization
   * header injection and base-URL resolution.
   */
  request<T = unknown>(input: TransportRequest): Promise<TransportResponse<T>>
  /**
   * Open a streaming connection. The handle's `close()` aborts cleanly.
   * Streams do NOT auto-reconnect (plan §5.5): UI store decides on
   * reconnect policy and presents a visible disconnected state.
   */
  openStream(input: StreamOpenRequest, handlers: StreamHandlers): StreamHandle
  /**
   * Run a host-specific native command. Tauri transport maps each
   * command to its underlying Tauri invoke; browser mode rejects commands
   * that have no browser implementation.
   */
  native(command: NativeCommand): Promise<unknown>
}

/**
 * Type-narrowing helper: `nativeUnsupported(this.kind, cmd)` is the
 * canonical way for a transport to reject a command. Keeping it as a
 * helper keeps the throw site visibly intentional in code review.
 */
export function nativeUnsupported(host: HostKind, command: NativeCommand): never {
  throw new UnsupportedNativeCommandError(host, command)
}
