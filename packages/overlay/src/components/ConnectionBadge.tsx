// ── ConnectionBadge Component ──
// Displays the current connection status (online / connecting / offline) as a
// titlebar diagnostics button.

import { createMemo } from "solid-js"
import { messageStore } from "../store/messages"
import { appStore } from "../store/app"
import { settingsStore } from "../store/settings"
import { t } from "../utils/i18n"

// ── Types ──

/** Connection status values mirroring app.js setConnStatus / checkConnection. */
export type ConnectionStatus = "online" | "connecting" | "offline"

// ── Helpers ──

function statusLabel(status: ConnectionStatus): string {
  if (status === "online") return t("titlebar.connection.online")
  if (status === "connecting") return t("titlebar.connection.connecting")
  return t("titlebar.connection.offline")
}

// ── Component ──

export interface ConnectionBadgeProps {
  /** Override the displayed status. Falls back to appStore.connectionStatus. */
  status?: ConnectionStatus
}

export function ConnectionBadge(props: ConnectionBadgeProps) {
  // Derive status: prefer explicit prop, otherwise use the app store which is
  // kept in sync by the ( setConnectionStatus).
  const status = createMemo<ConnectionStatus>(() => {
    if (props.status) return props.status
    // A live event stream is direct evidence that the backend is online.
    if (messageStore.sseStatus === "connected") return "online"
    return appStore.connectionStatus as ConnectionStatus
  })

  const label = createMemo(() => statusLabel(status()))

  // ── Port + PID display ──
  // The sidecar's port is dynamic (default 4096, falls back up to +32 and
  // then ephemeral — see overlay/src-tauri/build.rs + main.rs::next_server_port).
  // Port comes from settingsStore.serverUrl; PID comes from appStore.serverPid
  // (populated by connection.ts:syncLocalServerUrl from the Tauri
  // overlay_server_info command). Surface both next to "online" so the
  // operator can `kill <pid>` / `lsof -p <pid>` / `curl :<port>` directly,
  // without hunting through netstat.
  const port = createMemo<string>(() => {
    const raw = settingsStore.serverUrl
    if (!raw) return ""
    const parsed = URL.canParse?.(raw) ? new URL(raw) : null
    return parsed?.port ?? ""
  })

  const pid = createMemo<string>(() => {
    const value = appStore.serverPid
    return typeof value === "number" && value > 0 ? String(value) : ""
  })

  const title = createMemo(() => {
    if (status() !== "online") return label()
    const p = port()
    const pidValue = pid()
    const parts = [label()]
    if (p) parts.push(`${t("titlebar.connection.port")} ${p}`)
    if (pidValue) parts.push(`${t("titlebar.connection.pid")} ${pidValue}`)
    return parts.join(" · ")
  })
  const diagnosticsLabel = createMemo(() => `${t("titlebar.connection_diagnostics")} · ${title()}`)

  return (
    <span
      id="connBadge"
      class="conn-badge"
      data-ui="connection-badge"
      data-status={status()}
      title={diagnosticsLabel()}
      aria-label={diagnosticsLabel()}
      aria-live="polite"
    >
      <span class="conn-badge__label">{label()}</span>
    </span>
  )
}
