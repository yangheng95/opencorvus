import {
  UnsupportedNativeCommandError,
  type BrowserPreviewNativeBounds,
  type BrowserPreviewNativeNavigationAction,
  type BrowserPreviewNativePage,
  type BrowserPreviewNativeSelection,
  type BrowserPreviewNativeSelectionPresentation,
  type BrowserPreviewNativeSelectionResult,
  type NativeCommand,
} from "./host-transport"
import { getHostTransport } from "./host-transport-runtime"

export interface BrowserPreviewNativeSyncInput {
  surfaceID: string
  scopeKey: string
  mountUrl: string
  bounds: BrowserPreviewNativeBounds
}

export interface BrowserPreviewNativeOwner {
  surfaceID: string
  scopeKey: string
}

export class BrowserPreviewNativeSyncError extends Error {
  readonly surfaceHidden: boolean

  constructor(message: string, surfaceHidden: boolean) {
    super(message)
    this.name = "BrowserPreviewNativeSyncError"
    this.surfaceHidden = surfaceHidden
  }
}

export function browserPreviewNativeSurfaceAvailable(): boolean {
  return Boolean(getHostTransport().capabilities.nativeCommands["browserPreview.sync"])
}

export function browserPreviewNativeNavigationAvailable(): boolean {
  return Boolean(getHostTransport().capabilities.nativeCommands["browserPreview.navigate"])
}

export function browserPreviewNativeUrlNavigationAvailable(): boolean {
  return Boolean(getHostTransport().capabilities.nativeCommands["browserPreview.navigateUrl"])
}

export async function syncBrowserPreviewNativeSurface(input: BrowserPreviewNativeSyncInput): Promise<void> {
  assertBrowserPreviewNativeOwner(input)
  try {
    await invokeBrowserPreviewNativeCommand({
      kind: "browserPreview.sync",
      surfaceID: input.surfaceID,
      scopeKey: input.scopeKey,
      mountUrl: normalizeBrowserPreviewNativeUrl(input.mountUrl),
      bounds: input.bounds,
    })
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      !Array.isArray(error) &&
      typeof (error as Record<string, unknown>).message === "string" &&
      typeof (error as Record<string, unknown>).surfaceHidden === "boolean"
    ) {
      const failure = error as { message: string; surfaceHidden: boolean }
      throw new BrowserPreviewNativeSyncError(failure.message, failure.surfaceHidden)
    }
    throw error
  }
}

export async function navigateBrowserPreviewNativeSurface(
  owner: BrowserPreviewNativeOwner,
  action: BrowserPreviewNativeNavigationAction,
): Promise<void> {
  assertBrowserPreviewNativeOwner(owner)
  await invokeBrowserPreviewNativeCommand({ kind: "browserPreview.navigate", ...owner, action })
}

export async function navigateBrowserPreviewNativeUrl(owner: BrowserPreviewNativeOwner, input: string): Promise<void> {
  assertBrowserPreviewNativeOwner(owner)
  const url = normalizeBrowserPreviewNativeUrl(input)
  await invokeBrowserPreviewNativeCommand({ kind: "browserPreview.navigateUrl", ...owner, url })
}

export function normalizeBrowserPreviewNativeUrl(input: string): string {
  const raw = input.trim()
  if (!raw) throw new TypeError("browser preview URL is required")
  const loopback = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d{1,5})(\/[^\s]*)?$/i.exec(raw)
  let candidate = raw
  if (loopback) {
    const port = Number(loopback[2])
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new TypeError("browser preview URL port must be between 1 and 65535")
    }
    candidate = `http://${loopback[1]}:${port}${loopback[3] ?? "/"}`
  } else if (raw.startsWith("//")) {
    candidate = `https:${raw}`
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    candidate = `https://${raw}`
  }
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new TypeError("browser preview URL must be a valid HTTP(S) address")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("browser preview URL must use HTTP or HTTPS")
  }
  // Matches utils/external-url.ts, which gates the same URL when the preview
  // hands it to the host to open. This function stays separate from that one —
  // it normalises loose address-bar input, where that one validates a finished
  // URL — but the two must not disagree about what is acceptable.
  if (url.username || url.password) {
    throw new TypeError("browser preview URL must not carry embedded credentials")
  }
  return url.toString()
}

export function browserPreviewNativeCurrentPageAvailable(): boolean {
  return Boolean(getHostTransport().capabilities.nativeCommands["browserPreview.currentPage"])
}

export async function getBrowserPreviewNativeCurrentPage(
  owner: BrowserPreviewNativeOwner,
): Promise<BrowserPreviewNativePage | null> {
  assertBrowserPreviewNativeOwner(owner)
  const result = await invokeBrowserPreviewNativeCommand({ kind: "browserPreview.currentPage", ...owner })
  if (result === null) return null
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError("browser preview current page result is invalid")
  }
  const page = result as Record<string, unknown>
  const keys = Object.keys(page)
  if (
    keys.length !== 4 ||
    !keys.includes("url") ||
    !keys.includes("title") ||
    !keys.includes("annotationRequested") ||
    !keys.includes("interactionReady") ||
    typeof page.url !== "string" ||
    !page.url.trim() ||
    typeof page.title !== "string" ||
    typeof page.annotationRequested !== "boolean" ||
    typeof page.interactionReady !== "boolean"
  ) {
    throw new TypeError("browser preview current page result is invalid")
  }
  return {
    url: page.url.trim(),
    title: page.title.trim(),
    annotationRequested: page.annotationRequested,
    interactionReady: page.interactionReady,
  }
}

export async function closeBrowserPreviewNativeSurface(owner: BrowserPreviewNativeOwner): Promise<void> {
  assertBrowserPreviewNativeOwner(owner)
  await invokeBrowserPreviewNativeCommand({ kind: "browserPreview.close", ...owner })
}

export async function destroyBrowserPreviewNativeSurface(surfaceID: string): Promise<void> {
  if (!surfaceID.trim()) throw new TypeError("browser preview native surface ID is required")
  await invokeBrowserPreviewNativeCommand({ kind: "browserPreview.destroy", surfaceID })
}

export async function setBrowserPreviewNativeZoom(owner: BrowserPreviewNativeOwner, factor: number): Promise<void> {
  assertBrowserPreviewNativeOwner(owner)
  if (!Number.isFinite(factor) || factor < 0.25 || factor > 5) {
    throw new RangeError("browser preview zoom factor must be between 0.25 and 5")
  }
  await invokeBrowserPreviewNativeCommand({ kind: "browserPreview.setZoom", ...owner, factor })
}

export async function setNativeSelectionEnabled(
  owner: BrowserPreviewNativeOwner,
  enabled: boolean,
  presentation?: BrowserPreviewNativeSelectionPresentation,
): Promise<void> {
  assertBrowserPreviewNativeOwner(owner)
  const command: NativeCommand = enabled
    ? {
        kind: "browserPreview.selection.setEnabled",
        ...owner,
        enabled: true,
        presentation: requireNativeSelectionPresentation(presentation),
      }
    : {
        kind: "browserPreview.selection.setEnabled",
        ...owner,
        enabled: false,
        ...(presentation ? { presentation: requireNativeSelectionPresentation(presentation) } : {}),
      }
  await invokeBrowserPreviewNativeCommand(command)
}

const NATIVE_SELECTION_TEXT_KEYS = [
  "tagName",
  "selector",
  "jsPath",
  "domPath",
  "textPreview",
  "role",
  "accessibleName",
  "pageUrl",
  "pageTitle",
  "sourceHint",
  "computedColor",
  "computedFont",
] as const

const NATIVE_SELECTION_NUMBER_KEYS = ["anchorX", "anchorY", "capturedAt"] as const
const NATIVE_SELECTION_KEYS = [
  "x",
  "y",
  "width",
  "height",
  "label",
  ...NATIVE_SELECTION_TEXT_KEYS,
  ...NATIVE_SELECTION_NUMBER_KEYS,
] as const

function requireNativeSelectionPresentation(
  presentation: BrowserPreviewNativeSelectionPresentation | undefined,
): BrowserPreviewNativeSelectionPresentation {
  if (!presentation) throw new TypeError("browser preview selection presentation is required when selection is enabled")
  return presentation
}

function truncateCodePoints(value: string, maximum: number): string {
  return Array.from(value).slice(0, maximum).join("")
}

function parseNativeSelection(value: unknown): BrowserPreviewNativeSelection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const selection = value as Record<string, unknown>
  if (Object.keys(selection).some((key) => !(NATIVE_SELECTION_KEYS as readonly string[]).includes(key))) return null
  if (
    typeof selection.x !== "number" ||
    !Number.isFinite(selection.x) ||
    typeof selection.y !== "number" ||
    !Number.isFinite(selection.y) ||
    typeof selection.width !== "number" ||
    !Number.isFinite(selection.width) ||
    selection.width <= 0 ||
    typeof selection.height !== "number" ||
    !Number.isFinite(selection.height) ||
    selection.height <= 0 ||
    typeof selection.label !== "string" ||
    !selection.label.trim()
  ) {
    return null
  }
  const result: BrowserPreviewNativeSelection = {
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
    label: truncateCodePoints(selection.label.trim(), 200),
  }
  for (const key of NATIVE_SELECTION_TEXT_KEYS) {
    const candidate = selection[key]
    if (candidate === undefined) continue
    if (typeof candidate !== "string") return null
    const normalized = candidate.trim()
    if (normalized) result[key] = truncateCodePoints(normalized, 500)
  }
  for (const key of NATIVE_SELECTION_NUMBER_KEYS) {
    const candidate = selection[key]
    if (candidate === undefined) continue
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) return null
    result[key] = candidate
  }
  return result
}

export async function takeNativeSelection(
  owner: BrowserPreviewNativeOwner,
): Promise<BrowserPreviewNativeSelectionResult> {
  assertBrowserPreviewNativeOwner(owner)
  const result = await invokeBrowserPreviewNativeCommand({ kind: "browserPreview.selection.take", ...owner })
  if (result === null) return { kind: "waiting" }
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError("browser preview selection result kind is invalid")
  }
  const r = result as Record<string, unknown>
  if (r.kind === "canceled" && Object.keys(r).length === 1) return { kind: "canceled" }
  if (r.kind === "comment") {
    const keys = Object.keys(r)
    if (keys.length !== 3 || !keys.includes("kind") || !keys.includes("selection") || !keys.includes("comment")) {
      throw new TypeError("browser preview selection comment result is invalid")
    }
    const selection = parseNativeSelection(r.selection)
    if (selection && typeof r.comment === "string" && r.comment.trim().length > 0) {
      return { kind: "comment", selection, comment: truncateCodePoints(r.comment.trim(), 2000) }
    }
    throw new TypeError("browser preview selection comment result is invalid")
  }
  throw new TypeError("browser preview selection result kind is invalid")
}

function assertBrowserPreviewNativeOwner(owner: BrowserPreviewNativeOwner): void {
  if (!owner.surfaceID.trim()) throw new TypeError("browser preview native surface ID is required")
  if (!owner.scopeKey.trim()) throw new TypeError("browser preview native scope key is required")
}

async function invokeBrowserPreviewNativeCommand(command: NativeCommand): Promise<unknown> {
  const host = getHostTransport()
  if (!host.capabilities.nativeCommands[command.kind]) {
    throw new UnsupportedNativeCommandError(host.kind, command)
  }
  return host.native(command)
}
