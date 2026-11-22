// ── ConnectionBadge Component ──
// Displays the current connection status (online / connecting / offline) as a
// sidebar connection indicator.

import { createMemo } from "solid-js"
import { messageStore } from "../store/messages"
import { appStore, type ConnectionStatus } from "../store/app"
import { settingsStore } from "../store/settings"
import { t } from "../utils/i18n"
import { connectionPresentation } from "../utils/connection-presentation"

// ── Helpers ──

function statusLabel(status: ConnectionStatus): string {
  if (status === "online") return t("titlebar.connection.online")
  if (status === "connecting") return t("titlebar.connection.connecting")
  return t("titlebar.connection.offline")
}

// ── Component ──

export interface ConnectionBadgeProps {
  /** Override the shared connection presentation for an explicit status display. */
  status?: ConnectionStatus
}

export function ConnectionBadge(props: ConnectionBadgeProps) {
  const status = createMemo(() =>
    props.status ?? connectionPresentation(appStore.connectionStatus, messageStore.sseStatus).status,
  )

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

  const statusText = createMemo(() => {
    const current = status()
    const label = statusLabel(current)
    const activePort = current === "online" ? port() : ""
    return activePort ? `${label} · ${t("titlebar.connection.port")} ${activePort}` : label
  })
  const diagnosticsLabel = createMemo(() => {
    const parts = [t("titlebar.connection_diagnostics"), statusText()]
    const activePid = status() === "online" ? pid() : ""
    if (activePid) parts.push(`${t("titlebar.connection.pid")} ${activePid}`)
    return parts.join(" · ")
  })

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
      <span class="conn-badge__label">{statusText()}</span>
    </span>
  )
}
