// ── Theme Service ──
// Exported surface:
// sanitizeTheme(value) — supported theme id or DEFAULT_THEME
// sanitizeZoom(value) — number clamped to [0.8, 1.6]
// resolvedTheme() — effective "light" | "dark" after system detection
// applyTheme(theme) — writes the documentElement data-theme
// applyZoom(zoom) — writes --ui-scale CSS custom property via renderScale
// themeColor(element, token) — palette token as an rgba() color libraries can parse

import { settingsStore } from "../store/settings"
import { currentUIScale } from "../utils/layout-tokens"
import { getHostTransport } from "./host-transport-runtime"
import { sanitizeThemeForHost, type OverlayThemeID } from "./theme-registry"

// ── Constants ──

const MIN_UI_ZOOM = 0.8
const MAX_UI_ZOOM = 1.6

// ── themeColor ──
// Canvas-backed libraries (charts, terminals) parse only legacy CSS color
// syntax, while the palette is free to express a token as any CSS color —
// `color-mix()` among them, which an unregistered custom property hands over
// unevaluated. Let the browser evaluate the value and read it back as rgba().

let colorNormalizer: CanvasRenderingContext2D | undefined

export function themeColor(element: Element, token: `--${string}`): string {
  const value = getComputedStyle(element).getPropertyValue(token).trim()
  if (!value) throw new Error(`Theme color token is missing: ${token}`)
  if (!colorNormalizer) {
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("Theme colors require a 2D canvas context")
    context.canvas.width = 1
    context.canvas.height = 1
    colorNormalizer = context
  }
  colorNormalizer.clearRect(0, 0, 1, 1)
  colorNormalizer.fillStyle = value
  colorNormalizer.fillRect(0, 0, 1, 1)
  const [red, green, blue, alpha] = colorNormalizer.getImageData(0, 0, 1, 1).data
  return `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(3)})`
}

// ── System theme media query ──
// Shared singleton,

const systemThemeMedia: MediaQueryList | null =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: light)")
    : null

// ── sanitizeTheme ──
// "light" | "system" → returned as-is; everything else → default theme

export function sanitizeTheme(value: any): string {
  return sanitizeThemeForHost(value)
}

// ── sanitizeZoom ──
// - parse to float
// - NaN → 1
// - clamp to [MIN_UI_ZOOM (0.8), MAX_UI_ZOOM (1.6)]

export function sanitizeZoom(value: any): number {
  const next = Number.parseFloat(String(value ?? ""))
  return Number.isFinite(next) ? Math.min(Math.max(next, MIN_UI_ZOOM), MAX_UI_ZOOM) : 1
}

// ── resolvedTheme ──
// Reads settingsStore.theme (sanitised), resolves "system" via matchMedia.

export function resolvedTheme(): string {
  const theme = sanitizeTheme(settingsStore.theme)
  return resolveThemeValue(theme)
}

function resolveThemeValue(theme: string): string {
  const hostScopedTheme: OverlayThemeID = sanitizeThemeForHost(theme)
  if (hostScopedTheme === "system") {
    return systemThemeMedia?.matches ? "light" : "dark"
  }
  return hostScopedTheme
}

// ── applyTheme ──
// Writes the effective theme to the root palette owner.
// Does NOT update brand logos; those belong to the respective Solid components.

export function applyTheme(theme: string): void {
  if (typeof document === "undefined") return
  const sanitized = sanitizeTheme(theme)
  const effective = resolveThemeValue(sanitized)
  document.documentElement.dataset.theme = effective
}

/** Observe the effective palette applied to the document root and return its cleanup function. */
export function observeAppliedTheme(onchange: (theme: string) => void): () => void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {}
  const root = document.documentElement
  const notify = () => onchange(root.dataset.theme || "light")
  const observer = new MutationObserver(notify)
  observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] })
  notify()
  return () => observer.disconnect()
}

// ── applyZoom ──
// The full renderScale() also triggers pane layout and chat sizing. Those are
// side-effects. This service function covers
// only the CSS write portion that is safe to call from Solid components:
// document.documentElement.style.setProperty("--ui-scale", ...)
// Callers that need the full layout recalc should trigger it .

export function applyZoom(zoom: number): void {
  if (typeof document === "undefined") return
  const sanitized = sanitizeZoom(zoom)
  document.documentElement.style.setProperty("--ui-scale", sanitized.toFixed(3))
}

// ── Zoom step constant (

const ZOOM_STEP = 0.1

// ── setZoom ──
// Set zoom to an absolute value, sanitise, then call applyZoom.
// effects, which remain.

export function setZoom(value: number): number {
  const next = sanitizeZoom(value)
  applyZoom(next)
  return next
}

// ── stepZoom ──
// Increment or decrement the current CSS-derived zoom by delta.

export function stepZoom(delta: number): number {
  // Read the current zoom from the CSS custom property written by applyZoom.
  // We cannot read state.zoom directly without creating a circular
  // dependency, so we use the value stored in the CSS variable instead.
  const current = currentUIScale()
  const next = Math.round((current + delta) * 100) / 100
  return setZoom(next)
}

// ── handleZoomHotkey ──
// Handle Ctrl/Cmd +/−/0 keyboard shortcuts.

export function handleZoomHotkey(event: KeyboardEvent): void {
  if (typeof window === "undefined") return
  // Only intercept Ctrl/Cmd +/−/0 when the active host owns overlay zoom.
  const ownsZoomHotkeys = getHostTransport().capabilities.ui.overlayZoomHotkeys
  if (!ownsZoomHotkeys || event.isComposing || !(event.ctrlKey || event.metaKey) || event.altKey) return

  const plus = event.code === "Equal" || event.code === "NumpadAdd" || event.key === "+" || event.key === "="
  if (plus) {
    event.preventDefault()
    stepZoom(ZOOM_STEP)
    return
  }

  const minus = event.code === "Minus" || event.code === "NumpadSubtract" || event.key === "-" || event.key === "_"
  if (minus) {
    event.preventDefault()
    stepZoom(-ZOOM_STEP)
    return
  }

  const reset = event.code === "Digit0" || event.code === "Numpad0" || event.key === "0"
  if (!reset) return
  event.preventDefault()
  setZoom(1)
}

/**
 * Register a listener for OS-level prefers-color-scheme changes.
 * Returns a cleanup function that removes the listener.
 */
export function installSystemThemeListener(onchange: () => void): () => void {
  if (!systemThemeMedia) return () => {}
  systemThemeMedia.addEventListener("change", onchange)
  return () => systemThemeMedia!.removeEventListener("change", onchange)
}

/** Toggle host devtools when the active transport exposes that native command. */
export async function toggleDevtools(): Promise<void> {
  const transport = getHostTransport()
  if (!transport.capabilities.nativeCommands["devtools.toggle"]) return
  await transport.native({ kind: "devtools.toggle" })
}
