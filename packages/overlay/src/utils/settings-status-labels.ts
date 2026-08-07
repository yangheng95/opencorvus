import { t } from "./i18n"

export type SettingsStatusTone = "ok" | "warn" | "bad" | "accent" | "muted" | "neutral"

export const CHANNEL_CONFIGURATION_STATUSES = ["disabled", "configured", "partial", "missing"] as const
export type ChannelConfigurationStatus = (typeof CHANNEL_CONFIGURATION_STATUSES)[number]

export const MCP_CONNECTION_STATUSES = [
  "connected",
  "disabled",
  "disconnected",
  "connecting",
  "failed",
  "needs_auth",
  "needs_client_registration",
] as const
export type McpConnectionStatus = (typeof MCP_CONNECTION_STATUSES)[number]

const channelConfigurationStatusSet = new Set<string>(CHANNEL_CONFIGURATION_STATUSES)
const mcpConnectionStatusSet = new Set<string>(MCP_CONNECTION_STATUSES)

export class UnsupportedSettingsStatusLabelError extends Error {
  constructor(
    readonly domain: "channel configuration" | "mcp connection",
    readonly status: string,
  ) {
    super(`Unsupported ${domain} status label: ${status || "(empty)"}`)
    this.name = "UnsupportedSettingsStatusLabelError"
  }
}

function normalizedStatus(status: string): string {
  return String(status).trim()
}

export function isChannelConfigurationStatus(status: string): status is ChannelConfigurationStatus {
  return channelConfigurationStatusSet.has(status)
}

export function isMcpConnectionStatus(status: string): status is McpConnectionStatus {
  return mcpConnectionStatusSet.has(status)
}

function channelConfigurationStatusFromString(status: string): ChannelConfigurationStatus {
  const normalized = normalizedStatus(status)
  if (!isChannelConfigurationStatus(normalized)) {
    throw new UnsupportedSettingsStatusLabelError("channel configuration", normalized)
  }
  return normalized
}

function mcpConnectionStatusFromString(status: string): McpConnectionStatus {
  const normalized = normalizedStatus(status)
  if (!isMcpConnectionStatus(normalized)) {
    throw new UnsupportedSettingsStatusLabelError("mcp connection", normalized)
  }
  return normalized
}

function mcpConnectionStatusOrDisabled(status: string | null | undefined): McpConnectionStatus {
  const normalized = normalizedStatus(status ?? "")
  if (!normalized) return "disabled"
  return mcpConnectionStatusFromString(normalized)
}

export function channelConfigurationStatusLabel(status: ChannelConfigurationStatus): string {
  return t(`channel.status.${status}`)
}

export function channelConfigurationStatusLabelFromString(status: string): string {
  return channelConfigurationStatusLabel(channelConfigurationStatusFromString(status))
}

export function channelConfigurationStatusTone(status: ChannelConfigurationStatus): SettingsStatusTone {
  if (status === "configured") return "ok"
  if (status === "partial") return "warn"
  if (status === "missing") return "bad"
  return "muted"
}

export function channelConfigurationStatusToneFromString(status: string): SettingsStatusTone {
  return channelConfigurationStatusTone(channelConfigurationStatusFromString(status))
}

export function mcpConnectionStatusLabel(status: McpConnectionStatus): string {
  return t(`mcp.status.${status}`)
}

export function mcpConnectionStatusLabelFromString(status: string): string {
  return mcpConnectionStatusLabel(mcpConnectionStatusFromString(status))
}

export function mcpConnectionStatusOrDisabledLabel(status: string | null | undefined): string {
  return mcpConnectionStatusLabel(mcpConnectionStatusOrDisabled(status))
}

export function mcpConnectionStatusTone(status: McpConnectionStatus): SettingsStatusTone {
  if (status === "connected") return "ok"
  if (status === "failed") return "bad"
  if (status === "disabled") return "muted"
  if (status === "connecting" || status === "needs_auth" || status === "needs_client_registration") return "warn"
  return "neutral"
}

export function mcpConnectionStatusToneFromString(status: string): SettingsStatusTone {
  return mcpConnectionStatusTone(mcpConnectionStatusFromString(status))
}

export function mcpConnectionStatusOrDisabledTone(status: string | null | undefined): SettingsStatusTone {
  return mcpConnectionStatusTone(mcpConnectionStatusOrDisabled(status))
}
