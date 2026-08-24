import { OVERLAY_THEME_IDS, type OverlayThemeID } from "@opencorvus-ai/transport-protocol"
import type { HostKind } from "./host-transport"
import { getHostTransport } from "./host-transport-runtime"

export type { OverlayThemeID }

export type OverlayThemeOption = {
  id: OverlayThemeID
  i18nSlug: "dark" | "light" | "system" | "vscode_dark"
}

export const DEFAULT_THEME_ID: OverlayThemeID = "light"

const DESKTOP_THEME_OPTIONS: OverlayThemeOption[] = [
  { id: "dark", i18nSlug: "dark" },
  { id: "vscode-dark", i18nSlug: "vscode_dark" },
  { id: "light", i18nSlug: "light" },
  { id: "system", i18nSlug: "system" },
]

export function themeOptionsForHost(host: HostKind): OverlayThemeOption[] {
  void host
  return DESKTOP_THEME_OPTIONS
}

export function themeOptionsForCurrentHost(): OverlayThemeOption[] {
  return themeOptionsForHost(getHostTransport().kind)
}

export function isThemeID(value: unknown): value is OverlayThemeID {
  return (OVERLAY_THEME_IDS as readonly unknown[]).includes(value)
}

export function isThemeAllowedForHost(value: unknown, host: HostKind): value is OverlayThemeID {
  return isThemeID(value) && themeOptionsForHost(host).some((theme) => theme.id === value)
}

export function sanitizeThemeForHost(value: unknown, host: HostKind = getHostTransport().kind): OverlayThemeID {
  if (isThemeAllowedForHost(value, host)) return value
  throw new TypeError("overlay theme is invalid for the active host")
}

/**
 * The theme the window should boot with, named by the native host (which sets
 * `__OPENCORVUS_STARTUP_THEME__`) or by an acceptance run (whose URL parameter
 * index.html mirrors onto that same global). Counterpart to `runtimeLocale()`.
 *
 * Unknown values fall back rather than throw, unlike `sanitizeThemeForHost`:
 * this is untrusted startup input read before anything renders, and a bad
 * value must not take the window down with it.
 */
export function runtimeStartupTheme(): OverlayThemeID {
  const injected = typeof globalThis === "undefined" ? "" : (globalThis as any).__OPENCORVUS_STARTUP_THEME__
  const value = String(injected || "").trim()
  return isThemeAllowedForHost(value, getHostTransport().kind) ? value : DEFAULT_THEME_ID
}
