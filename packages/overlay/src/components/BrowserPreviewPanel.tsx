import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"
import {
  loadTaskBrowserPreviewTarget,
  loadTaskBrowserPreviewEvidence,
  loadTaskBrowserPreviewEvidenceCaptureObjectUrl,
  type BrowserPreviewEvidence,
  type BrowserPreviewTarget,
  type BrowserPreviewViewport,
  type BrowserPreviewViewportID,
} from "../services/browser-preview"
import {
  browserPreviewNativeCurrentPageAvailable,
  browserPreviewNativeNavigationAvailable,
  browserPreviewNativeSurfaceAvailable,
  browserPreviewNativeUrlNavigationAvailable,
  BrowserPreviewNativeSyncError,
  closeBrowserPreviewNativeSurface,
  destroyBrowserPreviewNativeSurface,
  getBrowserPreviewNativeCurrentPage,
  navigateBrowserPreviewNativeUrl,
  navigateBrowserPreviewNativeSurface,
  normalizeBrowserPreviewNativeUrl,
  setBrowserPreviewNativeZoom,
  setNativeSelectionEnabled,
  syncBrowserPreviewNativeSurface,
  takeNativeSelection,
} from "../services/browser-preview-native"
import type {
  BrowserPreviewNativeBounds,
  BrowserPreviewNativeNavigationAction,
  BrowserPreviewNativePage,
  BrowserPreviewNativeSelection,
  BrowserPreviewNativeSelectionLabels,
  BrowserPreviewNativeSelectionPalette,
  BrowserPreviewNativeSelectionPresentation,
} from "../services/host-transport"
import { registerNativeSurfaceOcclusionHooks } from "../services/native-surface-occlusion"
import { closeNativeMenuSurface, openNativeMenuSurface } from "../services/native-menu-surface"
import { getHostTransport } from "../services/host-transport-runtime"
import { observeAppliedTheme } from "../services/theme"
import { t } from "../utils/i18n"
import { nativeOpen } from "../utils/native"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { Icon } from "./ui/Icon"
import { PreviewableImage } from "./ImagePreview"
import { Button } from "./ui/Button"
import { TextField } from "./ui/TextField"

type BrowserPreviewScopedTarget = BrowserPreviewTarget & { directory: string }

type BrowserPreviewEvidenceImage = {
  directory: string
  taskID: string
  evidenceID: string
  viewportID: BrowserPreviewViewportID
  url: string
}

type BrowserPreviewEvidenceImageRequest = Omit<BrowserPreviewEvidenceImage, "url">

type BrowserPreviewEvidenceImageLoadResult =
  | (BrowserPreviewEvidenceImage & { status: "loaded" })
  | (BrowserPreviewEvidenceImageRequest & { status: "failed"; message: string })

type BrowserPreviewRenderedEvidence = Omit<BrowserPreviewEvidence, "id" | "viewportID"> & {
  id?: string
  viewportID: BrowserPreviewViewportID
}
type BrowserPreviewLatestEvidenceScope = {
  directory: string
  taskID: string
  targetID: string
  evidenceID: string
  viewportID: BrowserPreviewViewportID
}
type BrowserPreviewLatestEvidenceResult =
  | (BrowserPreviewLatestEvidenceScope & { status: "loaded"; evidence: BrowserPreviewEvidence })
  | (BrowserPreviewLatestEvidenceScope & { status: "failed"; message: string })
type BrowserPreviewNativeScope = {
  tabID: string
  mountKey: string
  mountUrl: string
  manualRequestID?: number
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

type BrowserPreviewNativeRequestKind = "sync" | "navigation" | "zoom" | "current-page" | "selection" | "release"

type BrowserPreviewNativeRequestOwner = {
  leaseKey: string
  kind: BrowserPreviewNativeRequestKind
  requestID: number
  navigationOwner: number
}

type BrowserPreviewNativeLease = {
  key: string
  logicalTargetKey: string
  scope: BrowserPreviewNativeScope
  commandTail: Promise<void>
  nextRequestID: number
  navigationOwner: number
  activeRequest: Partial<Record<BrowserPreviewNativeRequestKind, number>>
}

class DetachedBrowserPreviewNativeLeaseError extends Error {
  constructor() {
    super("Browser preview native lease was detached before its queued command started.")
    this.name = "DetachedBrowserPreviewNativeLeaseError"
  }
}

// Manual zoom bounds mirror the WebView2 ZoomFactor range clamped on the Rust
// side. Steps match a browser's Ctrl +/- ladder closely enough for parity.
const BROWSER_PREVIEW_ZOOM_MIN = 0.25
const BROWSER_PREVIEW_ZOOM_MAX = 5
const BROWSER_PREVIEW_ZOOM_STEP = 0.1

function clampBrowserPreviewZoom(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(BROWSER_PREVIEW_ZOOM_MAX, Math.max(BROWSER_PREVIEW_ZOOM_MIN, value))
}

export interface BrowserPreviewPanelProps {
  tabID: string
  active: () => boolean
  directory: () => string
  refreshKey: () => unknown
  scrollElement: () => HTMLElement | null
  taskID: () => string | undefined
  registerController?: (controller: BrowserPreviewPanelController) => () => void
  onCommentDraft?: (text: string) => void
  onPageTitleChange?: (title: string) => void
  onReady?: (target: BrowserPreviewTarget) => void
}

export interface BrowserPreviewPanelController {
  navigate: (url: string) => void
}

function browserPreviewTabTitle(page: BrowserPreviewNativePage | undefined, url: string): string {
  const documentTitle = page?.title.trim()
  if (documentTitle) return documentTitle
  if (!url) return t("right_dock.tab.new")
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, "") || t("right_dock.tab.new")
  } catch {
    return t("right_dock.tab.new")
  }
}

export function BrowserPreviewPanel(props: BrowserPreviewPanelProps) {
  let panelElement: HTMLElement | undefined
  const [appliedTheme, setAppliedTheme] = createSignal(document.documentElement.dataset.theme || "light")
  onCleanup(observeAppliedTheme(setAppliedTheme))
  const [viewportID, setViewportID] = createSignal<BrowserPreviewViewportID>("desktop")
  const [viewportScopeKey, setViewportScopeKey] = createSignal("")
  const readyTargetPresentationScopes = new Set<string>()
  const presentedReadyTargetKeys = new Set<string>()
  const [nativePreviewError, setNativePreviewError] = createSignal("")
  const [nativePreviewCleanupError, setNativePreviewCleanupError] = createSignal("")
  const [nativeLeaseTransitionFailure, setNativeLeaseTransitionFailure] = createSignal<{ error: unknown }>()
  const [nativePreviewSyncing, setNativePreviewSyncing] = createSignal(false)
  // True only after the native child webview has been created by a successful
  // sync. Zoom must not be pushed before this or Rust rejects the command with
  // "browser preview webview is not mounted".
  const [nativePreviewMounted, setNativePreviewMounted] = createSignal(false)
  const [nodeSelectionEnabled, setNodeSelectionEnabled] = createSignal(false)
  // User-driven page-content zoom (browser-style Ctrl +/-). Multiplied by the
  // viewport-fit base zoom to produce the WebView2 ZoomFactor we push to Rust.
  const [zoomFactor, setZoomFactor] = createSignal(1)
  // Actual final URL of the live native webview (after redirects/navigations),
  // polled while the surface is mounted so the address bar reflects reality.
  const [nativeCurrentPage, setNativeCurrentPage] = createSignal<BrowserPreviewNativePage>()
  // CSS width of the mounted native surface, tracked so we can fit the selected
  // viewport width into it. Set from the sync bounds; 0 until first mount.
  const [nativeSurfaceWidth, setNativeSurfaceWidth] = createSignal(0)
  const [nativeLeaseRevision, setNativeLeaseRevision] = createSignal(0)
  let activeNativeLease: BrowserPreviewNativeLease | undefined
  function currentNativeLease(): BrowserPreviewNativeLease | undefined {
    nativeLeaseRevision()
    return activeNativeLease
  }
  const [targetLoadError, setTargetLoadError] = createSignal<{ taskID: string; directory: string; message: string }>()
  const panelActive = createMemo(() => props.active())
  const [target] = createResource(
    () => {
      const taskID = props.taskID()
      const directory = props.directory()
      if (!taskID || !directory) return undefined
      return { taskID, directory, refreshKey: props.refreshKey() }
    },
    async (scope) => {
      try {
        return {
          ...(await loadTaskBrowserPreviewTarget({ taskID: scope.taskID, directory: scope.directory })),
          directory: scope.directory,
        } satisfies BrowserPreviewScopedTarget
      } catch (error) {
        setTargetLoadError({ taskID: scope.taskID, directory: scope.directory, message: String(error) })
        return undefined
      }
    },
  )
  const scopedTarget = createMemo(() => {
    const taskID = props.taskID()
    const directory = props.directory()
    if (!taskID || !directory) return undefined
    const resolved = target()
    if (!resolved || resolved.taskID !== taskID || resolved.directory !== directory) return undefined
    return resolved
  })
  const currentTarget = createMemo(scopedTarget)
  const currentTargetError = createMemo(() => {
    if (target.loading) return undefined
    const taskID = props.taskID()
    const directory = props.directory()
    if (!taskID || !directory) return undefined
    const loadError = targetLoadError()
    if (loadError?.taskID === taskID && loadError.directory === directory) return loadError.message
    return target.error
  })
  const latestEvidenceScope = createMemo<BrowserPreviewLatestEvidenceScope | undefined>(() => {
    if (!panelActive()) return undefined
    const taskID = props.taskID()
    const targetID = currentTarget()?.id
    const evidenceID = currentTarget()?.latestEvidenceIDs?.[viewportID()]
    const directory = props.directory()
    if (!taskID || !directory || !targetID || !evidenceID) return undefined
    return { taskID, directory, evidenceID, targetID, viewportID: viewportID() }
  })
  let latestEvidenceAbort: AbortController | undefined
  const [latestEvidence] = createResource(
    latestEvidenceScope,
    async (scope): Promise<BrowserPreviewLatestEvidenceResult> => {
      latestEvidenceAbort?.abort()
      const controller = new AbortController()
      latestEvidenceAbort = controller
      try {
        return {
          ...scope,
          status: "loaded",
          evidence: await loadTaskBrowserPreviewEvidence({ ...scope, signal: controller.signal }),
        }
      } catch (error) {
        if (isAbortError(error)) throw error
        return { ...scope, status: "failed", message: browserPreviewErrorMessage(error) }
      } finally {
        if (latestEvidenceAbort === controller) latestEvidenceAbort = undefined
      }
    },
  )
  const viewports = createMemo(() => currentTarget()?.viewports ?? [])
  const activeViewport = createMemo(() => {
    const list = viewports()
    return list.find((item) => item.id === viewportID()) ?? list[0]
  })
  // Base zoom fits the selected viewport width into the mounted surface. With
  // WebView2 zoom, layout viewport width is roughly surfaceWidth / zoom, so
  // `surfaceWidth / viewportWidth` makes desktop/tablet/mobile render at their
  // selected CSS width while scaling the result into the visible native surface.
  const viewportBaseZoom = createMemo(() => {
    const surfaceWidth = nativeSurfaceWidth()
    const viewportWidth = activeViewport()?.width ?? 0
    if (surfaceWidth <= 0 || viewportWidth <= 0) return 1
    return surfaceWidth / viewportWidth
  })
  // Final WebView2 ZoomFactor = viewport-fit base × user manual zoom, clamped.
  const effectiveZoom = createMemo(() => clampBrowserPreviewZoom(viewportBaseZoom() * zoomFactor()))
  // Percent shown in the toolbar reflects the user-facing manual zoom, not the
  // viewport-fit base (which is an implicit "fit" the user did not request).
  const zoomPercentLabel = createMemo(() => `${Math.round(zoomFactor() * 100)}%`)
  const targetUrl = createMemo(() => currentTarget()?.url)
  // Codex-style address bar draft. Mirrors the resolved target URL unless the
  // user is mid-edit (addressDirty), so navigating/refresh updates the field
  // while typing keeps their in-flight entry.
  const [addressDraft, setAddressDraft] = createSignal("")
  const [addressDirty, setAddressDirty] = createSignal(false)
  const [addressSubmitting, setAddressSubmitting] = createSignal(false)
  const [addressExternalOpening, setAddressExternalOpening] = createSignal(false)
  const [addressSubmitError, setAddressSubmitError] = createSignal("")
  const [browserMenuOpen, setBrowserMenuOpen] = createSignal(false)
  const [browserMenuError, setBrowserMenuError] = createSignal("")
  const browserMenuOwner = `browser-menu:${props.tabID}`
  const [browserTabRequested, setBrowserTabRequested] = createSignal(false)
  const [manualNavigationRequest, setManualNavigationRequest] = createSignal<{ id: number; url: string }>()
  let nextManualNavigationRequestID = 0
  let lastReadyTaskMountKey = ""
  createEffect(() => {
    const taskID = props.taskID()
    const directory = props.directory()
    const resolved = currentTarget()
    const key =
      taskID && directory && resolved?.status === "ready" && resolved.id && resolved.url
        ? `${taskID}:${directory}:${resolved.id}:${resolved.url}`
        : ""
    if (!key) {
      lastReadyTaskMountKey = ""
      return
    }
    if (key === lastReadyTaskMountKey) return
    lastReadyTaskMountKey = key
    setBrowserTabRequested(false)
    setManualNavigationRequest(undefined)
    setAddressSubmitting(false)
    setAddressDirty(false)
    setAddressDraft(resolved.url ?? "")
    setAddressSubmitError("")
    setNativeCurrentPage(undefined)
  })
  const renderedEvidence = createMemo<BrowserPreviewRenderedEvidence | undefined>(() => {
    const resolved = currentTarget()
    if (resolved?.status !== "ready" || !resolved.id) return undefined
    const scope = latestEvidenceScope()
    const latest = latestEvidence()
    const taskID = props.taskID()
    const targetID = resolved.id
    if (!scope || !latest || latest.status !== "loaded" || !taskID || !targetID) return undefined
    if (
      latest.taskID !== scope.taskID ||
      latest.directory !== scope.directory ||
      latest.targetID !== scope.targetID ||
      latest.evidenceID !== scope.evidenceID ||
      latest.viewportID !== scope.viewportID
    ) {
      return undefined
    }
    const evidence = latest.evidence
    const selectedViewportID = viewportID()
    if (evidence.taskID !== taskID || evidence.targetID !== targetID || evidence.viewportID !== selectedViewportID) {
      return undefined
    }
    if (evidence.id !== scope.evidenceID) {
      return undefined
    }
    return {
      ...evidence,
      viewportID: selectedViewportID,
    }
  })
  const currentLatestEvidenceError = createMemo(() => {
    const scope = latestEvidenceScope()
    if (!scope || latestEvidence.loading || renderedEvidence()) return undefined
    const latest = latestEvidence()
    if (!latest || latest.status !== "failed") return undefined
    if (
      latest.taskID !== scope.taskID ||
      latest.directory !== scope.directory ||
      latest.targetID !== scope.targetID ||
      latest.evidenceID !== scope.evidenceID ||
      latest.viewportID !== scope.viewportID
    ) {
      return undefined
    }
    return latest
  })
  const currentLatestEvidenceLoading = createMemo(() =>
    Boolean(latestEvidenceScope() && latestEvidence.loading && !renderedEvidence()),
  )
  const previewActionPending = createMemo(() => Boolean(target.loading || currentLatestEvidenceLoading()))
  const nativePreviewScope = createMemo<BrowserPreviewNativeScope | undefined>(
    () => {
      const taskID = props.taskID()
      const directory = props.directory()
      const resolved = currentTarget()
      if (!panelActive() || !browserPreviewNativeSurfaceAvailable()) {
        return undefined
      }
      const taskTargetUrl =
        taskID && directory && resolved?.status === "ready" && resolved.id && resolved.url ? resolved.url : undefined
      if (browserTabRequested()) {
        const request = manualNavigationRequest()
        const mountUrl = request?.url || nativeCurrentPage()?.url
        if (!mountUrl) return undefined
        return {
          tabID: props.tabID,
          mountKey: "operator-browser-tab",
          mountUrl,
          manualRequestID: request?.id,
        }
      }
      if (!taskTargetUrl || !taskID || !directory || !resolved?.id) return undefined
      return {
        tabID: props.tabID,
        mountKey: `task:${taskID}:${directory}:${resolved.id}:${taskTargetUrl}`,
        mountUrl: taskTargetUrl,
      }
    },
    undefined,
    {
      // This memo rebuilds a fresh object on every dependency change. Without a
      // stable equality check its identity churns on every open/close cycle,
      // and the stage view keyed on it re-reads the condition after it has
      // flipped to undefined mid-flush, which crashed the panel render and made
      // the browser preview refuse to reopen. Compare by scope key so the
      // identity only changes when the scope actually changes.
      equals: (prev, next) => {
        if (prev === next) return true
        if (!prev || !next) return false
        return browserPreviewLogicalTargetKey(prev) === browserPreviewLogicalTargetKey(next)
      },
    },
  )
  // Zoom controls (buttons + hotkeys) only act on a live native preview surface.
  const nativePreviewZoomActive = createMemo(
    () => Boolean(currentNativeLease()) && browserPreviewNativeSurfaceAvailable(),
  )
  // Stable single-accessor conditions for the <Switch> below. Reading a signal
  // twice inside a <Match when={...}> ternary (or gating one behind a compound
  // expression) lets the resolved value flip between the guard check and the
  // keyed child's read, which surfaces as "Stale read from <Match>". Funnel
  // each through its own memo so the Match reads one consistent value.
  const failedTarget = createMemo(() => {
    const resolved = currentTarget()
    return resolved?.status === "failed" ? resolved : undefined
  })
  const evidenceForDisplay = createMemo(() => {
    if (nodeSelectionEnabled()) return undefined
    return renderedEvidence()
  })
  // Collapse the whole stage <Switch> decision into a single discriminated memo.
  // SolidJS throws "Stale read from <Match>" when a <Switch> re-reads a signal
  // that a downstream effect flips mid-flush (the native preview sync effect
  // toggles nativePreviewScope/nativePreviewError as the panel opens/closes).
  // By computing the branch once, atomically, the <Switch> reads one stable
  // value per flush and each <Match> only inspects that value — so a condition
  // can never flip between the guard check and the keyed child's read.
  type BrowserPreviewStageView =
    | { kind: "target-load-failed"; error: unknown }
    | { kind: "target-loading" }
    | { kind: "target-failed"; resolved: BrowserPreviewScopedTarget }
    | { kind: "evidence-loading" }
    | { kind: "evidence-load-failed"; error: BrowserPreviewLatestEvidenceResult & { status: "failed" } }
    | { kind: "native-error"; error: string }
    | { kind: "evidence"; evidence: BrowserPreviewRenderedEvidence }
    | { kind: "native-preview"; scope: BrowserPreviewNativeScope }
    | { kind: "empty" }
  const stageView = createMemo<BrowserPreviewStageView>(() => {
    const loadError = currentTargetError()
    if (loadError) return { kind: "target-load-failed", error: loadError }
    if (target.loading) return { kind: "target-loading" }
    const failed = failedTarget()
    if (failed) return { kind: "target-failed", resolved: failed }
    if (currentLatestEvidenceLoading()) return { kind: "evidence-loading" }
    const evidenceError = currentLatestEvidenceError()
    if (evidenceError) return { kind: "evidence-load-failed", error: evidenceError }
    const nativeError = nativePreviewError()
    if (nativeError) return { kind: "native-error", error: nativeError }
    const scope = nativePreviewScope()
    if (scope) return { kind: "native-preview", scope }
    const evidence = evidenceForDisplay()
    if (evidence) return { kind: "evidence", evidence }
    return { kind: "empty" }
  })
  // Only the discriminant is needed to pick the branch. Driving each <Match>
  // off this plain string (a *non-keyed* boolean condition) means Solid never
  // installs a keyed child accessor, so reopening the preview — which flips the
  // underlying signals mid-flush — can no longer surface "Stale read from
  // <Match>". Each branch re-reads its own stable data memo for rendering.
  const stageKind = createMemo(() => stageView().kind)
  let captureImageAbort: AbortController | undefined
  const [captureImage, { mutate: setCaptureImage }] = createResource(
    () => {
      if (!panelActive()) return undefined
      if (nativePreviewScope()) return undefined
      const evidence = renderedEvidence()
      if (!evidence?.captureAvailable || !evidence.id) {
        return undefined
      }
      const directory = props.directory()
      if (!directory) return undefined
      return { taskID: evidence.taskID, directory, evidenceID: evidence.id, viewportID: evidence.viewportID }
    },
    async (scope): Promise<BrowserPreviewEvidenceImageLoadResult> => {
      captureImageAbort?.abort()
      const controller = new AbortController()
      captureImageAbort = controller
      try {
        const url = await loadTaskBrowserPreviewEvidenceCaptureObjectUrl({
          ...scope,
          signal: controller.signal,
        })
        const currentEvidence = renderedEvidence()
        const stillOwnsScope =
          panelActive() &&
          !controller.signal.aborted &&
          props.directory() === scope.directory &&
          currentEvidence?.taskID === scope.taskID &&
          currentEvidence.id === scope.evidenceID &&
          currentEvidence.viewportID === scope.viewportID
        if (!stillOwnsScope) {
          URL.revokeObjectURL(url)
          throw new DOMException("Browser Preview capture scope changed", "AbortError")
        }
        return {
          ...scope,
          status: "loaded",
          url,
        }
      } catch (error) {
        if (isAbortError(error)) throw error
        return {
          ...scope,
          status: "failed",
          message: `${t("browser_preview.evidence.image_failed")}: ${browserPreviewErrorMessage(error)}`,
        }
      } finally {
        if (captureImageAbort === controller) captureImageAbort = undefined
      }
    },
  )
  const currentCaptureImage = createMemo(() => {
    const evidence = renderedEvidence()
    const image = captureImage()
    const directory = props.directory()
    if (!evidence?.id || !image) return undefined
    if (image.status !== "loaded") return undefined
    if (
      image.taskID !== evidence.taskID ||
      image.evidenceID !== evidence.id ||
      image.viewportID !== evidence.viewportID ||
      image.directory !== directory
    ) {
      return undefined
    }
    return image
  })
  const currentCaptureImageError = createMemo(() => {
    const evidence = renderedEvidence()
    if (!evidence?.captureAvailable || !evidence.id) {
      return undefined
    }
    const result = captureImage()
    if (!result || result.status !== "failed") return undefined
    if (
      result.taskID !== evidence.taskID ||
      result.evidenceID !== evidence.id ||
      result.viewportID !== evidence.viewportID ||
      result.directory !== props.directory()
    ) {
      return undefined
    }
    return result.message
  })

  createEffect(() => {
    const taskID = props.taskID()
    const directory = props.directory()
    if (!taskID || !directory) {
      setTargetLoadError(undefined)
      return
    }
    const error = target.error
    if (error) setTargetLoadError({ taskID, directory, message: String(error) })
  })

  createEffect(() => {
    const taskID = props.taskID()
    const directory = props.directory()
    const resolved = target()
    if (taskID && directory && resolved?.taskID === taskID && resolved.directory === directory)
      setTargetLoadError(undefined)
  })

  createEffect<BrowserPreviewEvidenceImage | undefined>((previous) => {
    const current = captureImage()
    if (previous?.url && (current?.status !== "loaded" || previous.url !== current.url))
      URL.revokeObjectURL(previous.url)
    return current?.status === "loaded" ? current : undefined
  })

  createEffect(() => {
    if (panelActive()) return
    latestEvidenceAbort?.abort()
    captureImageAbort?.abort()
    const current = captureImage()
    if (current?.status === "loaded") URL.revokeObjectURL(current.url)
    setCaptureImage(undefined)
  })

  createEffect(() => {
    const resolved = scopedTarget()
    const taskID = props.taskID()
    const directory = props.directory()
    if (!taskID || !directory || !resolved) return
    const presentationScope = `${taskID}\u0000${directory}`
    const readyTargetKey =
      resolved.status === "ready" && resolved.url
        ? `${presentationScope}\u0000${resolved.id ?? resolved.url}`
        : undefined
    if (!readyTargetPresentationScopes.has(presentationScope)) {
      readyTargetPresentationScopes.add(presentationScope)
      if (readyTargetKey) presentedReadyTargetKeys.add(readyTargetKey)
      return
    }
    if (!readyTargetKey || presentedReadyTargetKeys.has(readyTargetKey)) return
    presentedReadyTargetKeys.add(readyTargetKey)
    props.onReady?.(resolved)
  })

  createEffect(() => {
    const taskID = props.taskID()
    const resolved = currentTarget()
    const ids = viewports().map((item) => item.id)
    if (!taskID || ids.length === 0) return
    const key = `${taskID}:${resolved?.id ?? resolved?.url ?? "missing"}:${ids.join(",")}`
    if (viewportScopeKey() === key) return
    setViewportScopeKey(key)
    setViewportID(ids.includes(viewportID()) ? viewportID() : ids[0])
  })

  let nativeSurfaceOccluded = false
  let nativeLeaseTransitionTail = Promise.resolve()

  function runNativeLeaseTransition<T>(operation: () => Promise<T>): Promise<T> {
    const previous = nativeLeaseTransitionTail
    let release: () => void = () => undefined
    nativeLeaseTransitionTail = new Promise<void>((resolve) => {
      release = resolve
    })
    return previous.then(operation).finally(release)
  }

  const createNativeLease = (scope: BrowserPreviewNativeScope): BrowserPreviewNativeLease => {
    if (activeNativeLease) {
      throw new Error("Browser preview native lease acquisition requires the previous lease to be detached.")
    }
    const lease: BrowserPreviewNativeLease = {
      key: crypto.randomUUID(),
      logicalTargetKey: browserPreviewLogicalTargetKey(scope),
      scope,
      commandTail: Promise.resolve(),
      nextRequestID: 0,
      navigationOwner: 0,
      activeRequest: {},
    }
    activeNativeLease = lease
    setNativeLeaseRevision((value) => value + 1)
    return lease
  }

  const detachNativeLease = (expected?: BrowserPreviewNativeLease): BrowserPreviewNativeLease | undefined => {
    if (!activeNativeLease || (expected && activeNativeLease !== expected)) return undefined
    const detached = activeNativeLease
    activeNativeLease = undefined
    setNativeLeaseRevision((value) => value + 1)
    lastNativePreviewSyncKey = ""
    nativePreviewSyncSequence += 1
    setNativePreviewSyncing(false)
    return detached
  }

  function runNativeLeaseCommand<T>(
    lease: BrowserPreviewNativeLease,
    kind: BrowserPreviewNativeRequestKind,
    operation: () => Promise<T>,
    settlement: {
      success?: (value: T, owner: BrowserPreviewNativeRequestOwner) => void | Promise<void>
      failure?: (error: unknown, owner: BrowserPreviewNativeRequestOwner) => void | Promise<void>
    } = {},
    requireActive = true,
  ): Promise<T> {
    const requestID = ++lease.nextRequestID
    const owner: BrowserPreviewNativeRequestOwner = {
      leaseKey: lease.key,
      kind,
      requestID,
      navigationOwner: 0,
    }
    const previous = lease.commandTail
    let release: () => void = () => undefined
    lease.commandTail = new Promise<void>((resolve) => {
      release = resolve
    })
    return previous
      .then(async () => {
        if (requireActive && activeNativeLease !== lease) {
          throw new DetachedBrowserPreviewNativeLeaseError()
        }
        if (kind === "navigation") lease.navigationOwner += 1
        owner.navigationOwner = lease.navigationOwner
        lease.activeRequest[kind] = requestID
        try {
          const value = await operation()
          await settlement.success?.(value, owner)
          return value
        } catch (error) {
          await settlement.failure?.(error, owner)
          throw error
        } finally {
          if (lease.activeRequest[kind] === requestID) delete lease.activeRequest[kind]
        }
      })
      .finally(release)
  }

  function observeSettledNativeLeaseCommand(result: Promise<unknown>): void {
    void result.catch(() => undefined)
  }

  const requestOwnerIsCurrent = (
    lease: BrowserPreviewNativeLease,
    owner: BrowserPreviewNativeRequestOwner,
    requireActive = true,
  ): boolean =>
    (!requireActive || activeNativeLease === lease) &&
    owner.leaseKey === lease.key &&
    lease.activeRequest[owner.kind] === owner.requestID &&
    (owner.kind !== "current-page" || owner.navigationOwner === lease.navigationOwner)

  const buildNodeCommentDraft = (selection: BrowserPreviewNativeSelection, comment: string): string => {
    const url = targetUrl() ?? ""
    const details = [
      `Browser preview comment: ${comment}`,
      "",
      `Page: ${selection.pageTitle || currentTarget()?.url || url}`,
      `URL: ${selection.pageUrl || url}`,
      `Target: ${selection.pageTitle || selection.label} <${selection.tagName || selection.label}>`,
      `Source: ${selection.sourceHint || selection.domPath || selection.selector || "DOM"}`,
      `Node: ${selection.label}`,
      `Region: x=${selection.x}, y=${selection.y}, width=${selection.width}, height=${selection.height}`,
    ]
    if (selection.textPreview) details.push(`Text: ${selection.textPreview}`)
    if (selection.computedColor) details.push(`Color: ${selection.computedColor}`)
    if (selection.computedFont) details.push(`Font: ${selection.computedFont}`)
    if (selection.jsPath) details.push(`JS path: ${selection.jsPath}`)
    return details.join("\n")
  }

  // Applies a comment authored inside the injected guest panel: build the
  // composer draft, notify the parent, and reset selection state so the live
  // preview keeps running.
  const applyGuestNodeComment = (selection: BrowserPreviewNativeSelection, comment: string) => {
    const trimmed = comment.trim()
    if (!trimmed) return
    props.onCommentDraft?.(buildNodeCommentDraft(selection, trimmed))
    clearNodeSelection()
  }

  const nativeSelectionLabels = (): BrowserPreviewNativeSelectionLabels => ({
    page: t("browser_preview.comment.page"),
    target: t("browser_preview.comment.target"),
    source: t("browser_preview.comment.source"),
    color: t("browser_preview.comment.color"),
    font: t("browser_preview.comment.font"),
    placeholder: t("browser_preview.comment.placeholder"),
    cancel: t("browser_preview.comment.cancel"),
    send: t("browser_preview.comment.send"),
    label: t("browser_preview.comment.label"),
    annotate: t("browser_preview.comment.annotate"),
    contextHint: t("browser_preview.comment.context_hint"),
  })

  const nativeSelectionPalette = (): BrowserPreviewNativeSelectionPalette => {
    appliedTheme()
    const styles = window.getComputedStyle(document.documentElement)
    const semanticColor = (name: string): string => {
      const value = styles.getPropertyValue(name).trim()
      if (!value) throw new Error(`Browser preview annotation palette token ${name} is unavailable.`)
      return value
    }
    return {
      surface: semanticColor("--surface"),
      surfaceInset: semanticColor("--surface-inset"),
      surfaceHover: semanticColor("--surface-hover"),
      text: semanticColor("--text-strong"),
      textMuted: semanticColor("--text-muted"),
      border: semanticColor("--border"),
      accent: semanticColor("--accent"),
      accentDim: semanticColor("--accent-dim"),
      accentRing: semanticColor("--accent-ring"),
      shadow: semanticColor("--shadow-lg"),
    }
  }

  const nativeSelectionPresentation = (): BrowserPreviewNativeSelectionPresentation => ({
    labels: nativeSelectionLabels(),
    palette: nativeSelectionPalette(),
  })

  let nativeSurfaceElement: HTMLElement | null = null
  let nativeSurfaceScrollElement: HTMLElement | null = null
  let nativeSurfaceResizeObserver: ResizeObserver | null = null
  let lastNativePreviewSyncKey = ""
  let nativePreviewSyncSequence = 0

  const syncNativePreviewOnFrame = createAnimationFrameScheduler(() => {
    void syncNativePreviewSurface()
  })

  function currentNativePreviewSyncKey(): string {
    const scope = nativePreviewScope()
    const lease = currentNativeLease()
    const element = nativeSurfaceElement
    if (!scope || !lease || lease.logicalTargetKey !== browserPreviewLogicalTargetKey(scope) || !element) return ""
    if (!browserPreviewNativeSurfaceAvailable()) return ""
    const bounds = browserPreviewNativeElementBounds(element)
    if (!bounds) return ""
    return `${lease.key}:${browserPreviewNativeBoundsKey(bounds)}`
  }

  const nativePreviewNavigationReady = createMemo(() => {
    nativePreviewSyncing()
    const syncKey = currentNativePreviewSyncKey()
    return Boolean(
      syncKey &&
        lastNativePreviewSyncKey === syncKey &&
        browserPreviewNativeNavigationAvailable() &&
        !previewActionPending(),
    )
  })

  const scheduleNativePreviewSync = () => {
    syncNativePreviewOnFrame.schedule()
  }

  const disconnectNativePreviewElement = () => {
    nativeSurfaceResizeObserver?.disconnect()
    nativeSurfaceResizeObserver = null
    nativeSurfaceScrollElement?.removeEventListener("scroll", scheduleNativePreviewSync)
    nativeSurfaceScrollElement = null
    if (typeof window !== "undefined") window.removeEventListener("resize", scheduleNativePreviewSync)
    nativeSurfaceElement = null
    lastNativePreviewSyncKey = ""
  }

  const bindNativePreviewElement = (element: HTMLElement) => {
    if (nativeSurfaceElement === element) {
      scheduleNativePreviewSync()
      return
    }
    nativeSurfaceResizeObserver?.disconnect()
    nativeSurfaceScrollElement?.removeEventListener("scroll", scheduleNativePreviewSync)
    if (typeof window !== "undefined") window.removeEventListener("resize", scheduleNativePreviewSync)
    const scrollElement = props.scrollElement()
    if (!scrollElement) {
      throw new Error("Browser preview native surface must mount inside the center workbench scroll body.")
    }
    nativeSurfaceElement = element
    nativeSurfaceScrollElement = scrollElement
    nativeSurfaceScrollElement.addEventListener("scroll", scheduleNativePreviewSync, { passive: true })
    if (typeof window !== "undefined") window.addEventListener("resize", scheduleNativePreviewSync)
    if (typeof ResizeObserver !== "undefined") {
      nativeSurfaceResizeObserver = new ResizeObserver(scheduleNativePreviewSync)
      nativeSurfaceResizeObserver.observe(element)
    } else {
      nativeSurfaceResizeObserver = null
    }
    lastNativePreviewSyncKey = ""
    scheduleNativePreviewSync()
  }

  const combinedNativeFailure = (operationError: unknown, releaseError: unknown): AggregateError =>
    new AggregateError([operationError, releaseError], "Browser preview native operation and surface release failed")

  async function releaseNativeLease(
    lease: BrowserPreviewNativeLease,
    operationFailure?: { error: unknown },
  ): Promise<void> {
    return runNativeLeaseTransition(async () => {
      if (!browserPreviewNativeSurfaceAvailable()) {
        setNativePreviewMounted(false)
        return
      }
      const result = runNativeLeaseCommand(
        lease,
        "release",
        () => closeBrowserPreviewNativeSurface(browserPreviewNativeOwner(lease)),
        {},
        false,
      )
      try {
        await result
        setNativePreviewMounted(false)
        setNativePreviewCleanupError("")
        setNativeLeaseTransitionFailure(undefined)
      } catch (releaseError) {
        const exposedError =
          operationFailure !== undefined ? combinedNativeFailure(operationFailure.error, releaseError) : releaseError
        setNativeLeaseTransitionFailure({ error: exposedError })
        setNativePreviewCleanupError(browserPreviewErrorMessage(exposedError))
        throw exposedError
      }
    })
  }

  function requestNativePreviewClose(lease: BrowserPreviewNativeLease | undefined, reportError = true): void {
    const detached = lease ? detachNativeLease(lease) : detachNativeLease()
    if (!detached) return
    void releaseNativeLease(detached).catch((error) => {
      if (reportError) setNativePreviewCleanupError(browserPreviewErrorMessage(error))
    })
  }

  function exposeNativeOperationFailure(
    lease: BrowserPreviewNativeLease,
    owner: BrowserPreviewNativeRequestOwner,
    error: unknown,
    surfaceAlreadyHidden = false,
  ): void {
    if (error instanceof DetachedBrowserPreviewNativeLeaseError || !requestOwnerIsCurrent(lease, owner)) return
    if (!detachNativeLease(lease)) return
    if (surfaceAlreadyHidden) {
      setNativePreviewMounted(false)
      setNativePreviewCleanupError("")
      setNativeLeaseTransitionFailure(undefined)
      setNativePreviewError(browserPreviewErrorMessage(error))
      return
    }
    const release = lease.commandTail.then(async () => {
      try {
        await releaseNativeLease(lease, { error })
        setNativePreviewError(browserPreviewErrorMessage(error))
      } catch {
        // The combined operation/release failure remains visible above the native
        // child bounds. Do not select the HTML error stage while the OS surface
        // may still be visible.
      }
    })
    observeSettledNativeLeaseCommand(release)
  }

  async function exposeNativeSyncFailure(
    lease: BrowserPreviewNativeLease,
    owner: BrowserPreviewNativeRequestOwner,
    error: unknown,
  ): Promise<void> {
    if (!(error instanceof BrowserPreviewNativeSyncError)) {
      exposeNativeOperationFailure(lease, owner, error)
      return
    }
    if (!requestOwnerIsCurrent(lease, owner) || !detachNativeLease(lease)) return
    if (error.surfaceHidden) {
      setNativePreviewMounted(false)
      setNativePreviewCleanupError("")
      setNativeLeaseTransitionFailure(undefined)
      setNativePreviewError(error.message)
      return
    }
    setNativeLeaseTransitionFailure({ error })
    setNativePreviewCleanupError(error.message)
  }

  const disableNativeSelection = (lease: BrowserPreviewNativeLease | undefined): void => {
    if (!lease || !browserPreviewNativeSurfaceAvailable()) return
    const result = runNativeLeaseCommand(
      lease,
      "selection",
      () => setNativeSelectionEnabled(browserPreviewNativeOwner(lease), false),
      {
        failure: (error, owner) => exposeNativeOperationFailure(lease, owner, error),
      },
    )
    observeSettledNativeLeaseCommand(result)
  }

  const clearNodeSelection = (_reportNativeDisableError = false) => {
    const lease = currentNativeLease()
    setNodeSelectionEnabled(false)
    disableNativeSelection(lease)
  }

  async function syncNativePreviewSurface(propagateFailure = false): Promise<void> {
    const scope = nativePreviewScope()
    const element = nativeSurfaceElement
    if (!scope || !element || nativeSurfaceOccluded) return
    const existingTransitionFailure = nativeLeaseTransitionFailure()
    if (existingTransitionFailure !== undefined) {
      if (propagateFailure) throw existingTransitionFailure.error
      return
    }
    // Node selection and the comment panel now live inside the native child
    // webview as an injected DOM overlay (see main.rs guest runtime), so the
    // live preview stays visible the whole time. The host no longer hides the
    // child webview while a selection is pending.
    if (!browserPreviewNativeSurfaceAvailable()) {
      setNativePreviewSyncing(false)
      setNativePreviewError(t("browser_preview.empty.native_unsupported"))
      return
    }
    const bounds = browserPreviewNativeElementBounds(element)
    if (!bounds) {
      lastNativePreviewSyncKey = ""
      return
    }
    setNativeSurfaceWidth(bounds.width)
    await nativeLeaseTransitionTail
    const transitionFailure = nativeLeaseTransitionFailure()
    if (transitionFailure !== undefined) {
      if (propagateFailure) throw transitionFailure.error
      return
    }
    let lease = currentNativeLease()
    const logicalTargetKey = browserPreviewLogicalTargetKey(scope)
    if (lease && lease.logicalTargetKey !== logicalTargetKey) {
      const detached = detachNativeLease(lease)
      try {
        if (detached) await releaseNativeLease(detached)
      } catch (error) {
        if (propagateFailure) throw error
        return
      }
      lease = undefined
    }
    if (!lease) lease = createNativeLease(scope)
    const syncKey = `${lease.key}:${browserPreviewNativeBoundsKey(bounds)}`
    if (lastNativePreviewSyncKey === syncKey) return
    const sequence = ++nativePreviewSyncSequence
    setNativePreviewSyncing(true)
    setNativePreviewError("")
    const result = runNativeLeaseCommand(
      lease,
      "sync",
      () =>
        syncBrowserPreviewNativeSurface({
          surfaceID: lease.scope.tabID,
          scopeKey: lease.key,
          mountUrl: scope.mountUrl,
          bounds,
        }),
      {
        success: () => {
          if (sequence !== nativePreviewSyncSequence) return
          lastNativePreviewSyncKey = syncKey
          setNativePreviewMounted(true)
          pushNativePreviewZoom()
        },
        failure: (error, owner) => exposeNativeSyncFailure(lease, owner, error),
      },
    )
    try {
      await result
    } catch (error) {
      if (propagateFailure) throw error
    } finally {
      if (sequence === nativePreviewSyncSequence) setNativePreviewSyncing(false)
    }
  }

  // Push the current effective ZoomFactor (viewport-fit × manual) to the native
  // child webview. No-op unless a live native preview is mounted and idle.
  function pushNativePreviewZoom(): void {
    const lease = currentNativeLease()
    if (!lease || !browserPreviewNativeSurfaceAvailable()) return
    const result = runNativeLeaseCommand(
      lease,
      "zoom",
      () => setBrowserPreviewNativeZoom(browserPreviewNativeOwner(lease), effectiveZoom()),
      {
        failure: (error, owner) => exposeNativeOperationFailure(lease, owner, error),
      },
    )
    observeSettledNativeLeaseCommand(result)
  }

  function pushNativePreviewInteractionContext(): void {
    const lease = currentNativeLease()
    if (!lease || nodeSelectionEnabled() || !browserPreviewNativeSurfaceAvailable()) return
    const presentation = nativeSelectionPresentation()
    const result = runNativeLeaseCommand(
      lease,
      "selection",
      () => setNativeSelectionEnabled(browserPreviewNativeOwner(lease), false, presentation),
      {
        failure: (error, owner) => exposeNativeOperationFailure(lease, owner, error),
      },
    )
    observeSettledNativeLeaseCommand(result)
  }

  function adjustZoom(delta: number): void {
    setZoomFactor((value) => clampBrowserPreviewZoom(value + delta))
  }

  function resetZoom(): void {
    setZoomFactor(1)
  }

  function runNativePreviewNavigation(
    operation: (lease: BrowserPreviewNativeLease) => Promise<void>,
  ): Promise<void> | undefined {
    if (!nativePreviewNavigationReady()) return undefined
    const syncKey = currentNativePreviewSyncKey()
    const lease = currentNativeLease()
    if (!syncKey || !lease) return undefined
    clearNodeSelection()
    setNativePreviewError("")
    const result = runNativeLeaseCommand(lease, "navigation", () => operation(lease), {
      failure: (error, owner) => {
        if (lastNativePreviewSyncKey !== syncKey || currentNativePreviewSyncKey() !== syncKey) return
        return exposeNativeOperationFailure(lease, owner, error)
      },
    })
    observeSettledNativeLeaseCommand(result)
    return result
  }

  function navigateNativePreview(action: BrowserPreviewNativeNavigationAction): void {
    runNativePreviewNavigation((lease) => navigateBrowserPreviewNativeSurface(browserPreviewNativeOwner(lease), action))
  }

  function navigatePreview(action: BrowserPreviewNativeNavigationAction): void {
    const nativeNavigationRequested = Boolean(nativePreviewScope() && browserPreviewNativeSurfaceAvailable())
    if (nativeNavigationRequested) navigateNativePreview(action)
  }

  let dispatchedManualNavigationRequestID = 0
  createEffect(() => {
    const request = manualNavigationRequest()
    if (!request || request.id === dispatchedManualNavigationRequestID || !nativePreviewNavigationReady()) return
    const lease = currentNativeLease()
    if (lease?.scope.manualRequestID === request.id) {
      dispatchedManualNavigationRequestID = request.id
      setAddressDraft(request.url)
      setAddressDirty(false)
      setAddressSubmitting(false)
      return
    }
    const result = runNativePreviewNavigation((lease) =>
      navigateBrowserPreviewNativeUrl(browserPreviewNativeOwner(lease), request.url),
    )
    if (!result) return
    dispatchedManualNavigationRequestID = request.id
    void result
      .then(() => {
        if (manualNavigationRequest()?.id !== request.id) return
        setAddressDraft(request.url)
        setAddressDirty(false)
        setAddressSubmitting(false)
      })
      .catch((error) => {
        if (manualNavigationRequest()?.id !== request.id) return
        setAddressSubmitError(browserPreviewErrorMessage(error))
        setAddressSubmitting(false)
        setManualNavigationRequest(undefined)
      })
  })

  // Keep the address draft in sync with the displayed URL unless the user is
  // actively editing it. Prefer the live native webview URL (post-redirect
  // reality) when the surface is mounted; otherwise use the resolved backend
  // target URL.
  createEffect(() => {
    const url = nativeCurrentPage()?.url || manualNavigationRequest()?.url || (targetUrl() ?? "")
    if (addressDirty()) return
    if (addressDraft() !== url) setAddressDraft(url)
  })

  createEffect(() => {
    const page = nativeCurrentPage()
    const url = page?.url || targetUrl() || ""
    props.onPageTitleChange?.(browserPreviewTabTitle(page, url))
  })

  onCleanup(() => props.onPageTitleChange?.(""))

  // Poll the live native webview for its actual final URL and document title
  // while mounted, so both the address bar and tab reflect the guest page.
  createEffect(() => {
    const lease = currentNativeLease()
    if (!lease || !nativePreviewMounted() || !browserPreviewNativeCurrentPageAvailable()) {
      return
    }
    let disposed = false
    const poll = () => {
      const result = runNativeLeaseCommand(
        lease,
        "current-page",
        () => getBrowserPreviewNativeCurrentPage(browserPreviewNativeOwner(lease)),
        {
          success: (page, owner) => {
            if (disposed || !page || !requestOwnerIsCurrent(lease, owner)) return
            if (page.annotationRequested && !nodeSelectionEnabled()) setNodeSelectionEnabled(true)
            if (!page.interactionReady && !nodeSelectionEnabled()) pushNativePreviewInteractionContext()
            const current = nativeCurrentPage()
            if (current?.url !== page.url || current.title !== page.title) {
              setNativeCurrentPage(page)
            }
          },
          failure: (error, owner) => {
            if (disposed) return
            return exposeNativeOperationFailure(lease, owner, error)
          },
        },
      )
      observeSettledNativeLeaseCommand(result)
    }
    poll()
    const handle = window.setInterval(poll, 1000)
    onCleanup(() => {
      disposed = true
      window.clearInterval(handle)
    })
  })

  const addressNavigationSupported = createMemo(
    () => browserPreviewNativeSurfaceAvailable() && browserPreviewNativeUrlNavigationAvailable(),
  )
  const addressExternalOpenSupported = createMemo(
    () => getHostTransport().capabilities.nativeCommands["open-url"],
  )
  const addressActionBusy = createMemo(() => addressSubmitting() || addressExternalOpening())
  const addressInputAvailable = createMemo(
    () => (addressNavigationSupported() || addressExternalOpenSupported()) && !addressActionBusy(),
  )
  const addressNavigationAvailable = createMemo(() => addressNavigationSupported() && !addressActionBusy())
  const addressExternalOpenAvailable = createMemo(() => addressExternalOpenSupported() && !addressActionBusy())
  function requestAddressNavigation(raw: string): void {
    setAddressSubmitError("")
    const url = normalizeBrowserPreviewNativeUrl(raw)
    setAddressDraft(url)
    setAddressDirty(false)
    setAddressSubmitting(true)
    setNativeCurrentPage(undefined)
    setBrowserTabRequested(true)
    setManualNavigationRequest({ id: ++nextManualNavigationRequestID, url })
  }

  async function openAddressInDefaultBrowser(): Promise<void> {
    if (!addressExternalOpenAvailable()) return
    const raw = addressDraft().trim()
    if (!raw) return
    setAddressSubmitError("")
    try {
      const url = normalizeBrowserPreviewNativeUrl(raw)
      setAddressDraft(url)
      setAddressDirty(false)
      setAddressExternalOpening(true)
      if (!(await nativeOpen(url))) throw new Error(t("browser_preview.address.external_open_failed"))
    } catch (error) {
      setAddressSubmitError(browserPreviewErrorMessage(error))
    } finally {
      setAddressExternalOpening(false)
    }
  }

  const controller: BrowserPreviewPanelController = {
    navigate: (url) => {
      if (!browserPreviewNativeSurfaceAvailable() || !browserPreviewNativeUrlNavigationAvailable()) {
        throw new Error(t("browser_preview.empty.native_unsupported"))
      }
      requestAddressNavigation(url)
    },
  }
  const unregisterController = props.registerController?.(controller)
  onCleanup(() => unregisterController?.())

  createEffect(() => {
    const request = manualNavigationRequest()
    const page = nativeCurrentPage()
    if (!request || request.id !== dispatchedManualNavigationRequestID || !page?.url) return
    setManualNavigationRequest(undefined)
  })

  // The native browser-preview child webview is an operating-system-level
  // window that z-orders above host HTML dialogs and Settings. Register it
  // with the shared owner-aware occlusion lifecycle so every overlapping
  // surface keeps it hidden until the final owner closes.
  let nativePanelDisposed = false
  const unregisterNativeSurfaceHooks = registerNativeSurfaceOcclusionHooks({
    hide: async () => {
      nativeSurfaceOccluded = true
      const lease = detachNativeLease()
      try {
        if (lease) await releaseNativeLease(lease)
        else await nativeLeaseTransitionTail
        const transitionFailure = nativeLeaseTransitionFailure()
        if (transitionFailure !== undefined) throw transitionFailure.error
      } catch (error) {
        nativeSurfaceOccluded = false
        throw error
      }
    },
    restore: async () => {
      nativeSurfaceOccluded = false
      if (nativePanelDisposed) return
      if (nativePreviewScope() && browserPreviewNativeSurfaceAvailable()) {
        await syncNativePreviewSurface(true)
      }
    },
  })

  async function openBrowserMenu(anchor: HTMLElement): Promise<void> {
    if (browserMenuOpen()) {
      await closeNativeMenuSurface(browserMenuOwner)
      return
    }
    const nativeActionsAvailable = nativePreviewZoomActive()
    setBrowserMenuError("")
    setBrowserMenuOpen(true)
    try {
      await openNativeMenuSurface({
        owner: browserMenuOwner,
        anchor,
        groups: [
          {
            heading: t("browser_preview.zoom.label"),
            layout: "toolbar",
            items: [
              {
                id: "zoom-out",
                label: t("browser_preview.zoom.out_title"),
                ariaLabel: t("browser_preview.zoom.out_title"),
                icon: "zoom-out",
                iconOnly: true,
                enabled: nativeActionsAvailable && zoomFactor() > BROWSER_PREVIEW_ZOOM_MIN,
              },
              {
                id: "zoom-reset",
                label: zoomPercentLabel(),
                ariaLabel: t("browser_preview.zoom.reset_title"),
                enabled: nativeActionsAvailable,
              },
              {
                id: "zoom-in",
                label: t("browser_preview.zoom.in_title"),
                ariaLabel: t("browser_preview.zoom.in_title"),
                icon: "zoom-in",
                iconOnly: true,
                enabled: nativeActionsAvailable && zoomFactor() < BROWSER_PREVIEW_ZOOM_MAX,
              },
            ],
          },
          {
            items: [
              {
                id: "select-element",
                label: t("browser_preview.selection.title"),
                icon: "message",
                checked: nodeSelectionEnabled(),
                enabled: nativeActionsAvailable,
              },
            ],
          },
        ],
        onDismiss: () => setBrowserMenuOpen(false),
        onAction: (itemID) => {
          const actions: Record<string, () => void> = {
            "zoom-out": () => adjustZoom(-BROWSER_PREVIEW_ZOOM_STEP),
            "zoom-reset": resetZoom,
            "zoom-in": () => adjustZoom(BROWSER_PREVIEW_ZOOM_STEP),
            "select-element": () => setNodeSelectionEnabled((enabled) => !enabled),
          }
          const action = actions[itemID]
          if (!action) throw new Error(`Unknown Browser menu action: ${itemID}`)
          action()
        },
      })
    } catch (error) {
      setBrowserMenuOpen(false)
      setBrowserMenuError(browserPreviewErrorMessage(error))
    }
  }

  onCleanup(() => {
    latestEvidenceAbort?.abort()
    captureImageAbort?.abort()
    nativePanelDisposed = true
    setBrowserMenuOpen(false)
    void closeNativeMenuSurface(browserMenuOwner)
    syncNativePreviewOnFrame.cancel()
    disconnectNativePreviewElement()
    const lease = detachNativeLease()
    const release = lease
      ? releaseNativeLease(lease)
      : nativeLeaseTransitionTail.then(() => {
          const transitionFailure = nativeLeaseTransitionFailure()
          if (transitionFailure !== undefined) throw transitionFailure.error
        })
    void release
      .catch(() => undefined)
      .then(() => destroyBrowserPreviewNativeSurface(props.tabID))
      .finally(unregisterNativeSurfaceHooks)
      .catch(() => undefined)
    const current = captureImage()
    if (current?.status === "loaded") URL.revokeObjectURL(current.url)
  })

  const taskScopeKey = createMemo(() => {
    const taskID = props.taskID()
    const directory = props.directory()
    return taskID && directory ? `${taskID}:${directory}` : ""
  })

  createEffect<string>((previous) => {
    const key = taskScopeKey()
    if (previous !== key) {
      setTargetLoadError(undefined)
      setNativePreviewError("")
      if (key) {
        setBrowserTabRequested(false)
      }
      clearNodeSelection()
    }
    return key
  })

  createEffect<string | undefined>((previous) => {
    const scope = nativePreviewScope()
    const key = scope ? browserPreviewLogicalTargetKey(scope) : undefined
    const lease = currentNativeLease()
    if (lease && lease.logicalTargetKey !== key) requestNativePreviewClose(lease, false)
    if (previous !== key) {
      nativePreviewSyncSequence += 1
      lastNativePreviewSyncKey = ""
      setNativePreviewError("")
      // A newly mounted browser tab starts at 100% manual zoom.
      setZoomFactor(1)
    }
    if (!scope) {
      setNativePreviewSyncing(false)
      return key
    }
    if (!browserPreviewNativeSurfaceAvailable()) {
      setNativePreviewSyncing(false)
      setNativePreviewError(t("browser_preview.empty.native_unsupported"))
      return key
    }
    if (!nativeSurfaceOccluded) scheduleNativePreviewSync()
    return key
  })

  // Reactively push zoom to the native surface whenever the effective factor
  // changes (manual zoom or viewport-fit base). Skipped until a live preview is
  // mounted; the initial value is also pushed right after each sync completes.
  createEffect(() => {
    const factor = effectiveZoom()
    const lease = currentNativeLease()
    if (!lease || !browserPreviewNativeSurfaceAvailable()) return
    // Wait for the child webview to actually mount; pushing zoom earlier makes
    // Rust reject with "browser preview webview is not mounted".
    if (!nativePreviewMounted()) return
    const result = runNativeLeaseCommand(
      lease,
      "zoom",
      () => setBrowserPreviewNativeZoom(browserPreviewNativeOwner(lease), factor),
      {
        failure: (error, owner) => exposeNativeOperationFailure(lease, owner, error),
      },
    )
    observeSettledNativeLeaseCommand(result)
  })

  createEffect(() => {
    const scope = nativePreviewScope()
    if (!scope && nodeSelectionEnabled()) clearNodeSelection()
  })

  // Browser-style zoom hotkeys: Ctrl/Cmd + "+"/"-"/"0" and Ctrl/Cmd + wheel.
  // The browser chrome owns these shortcuts only when the event originated
  // inside this panel. An active Right Dock tab is not focus ownership: treating
  // it as such also lets the global Overlay zoom handler consume the same key.
  // Wheel is best-effort because the operating-system child webview can absorb
  // pointer events over its own region.
  createEffect(() => {
    if (typeof window === "undefined") return
    if (!panelActive() || !nativePreviewZoomActive()) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!panelElement?.contains(event.target as Node | null)) return
      if (!event.ctrlKey && !event.metaKey) return
      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        adjustZoom(BROWSER_PREVIEW_ZOOM_STEP)
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault()
        adjustZoom(-BROWSER_PREVIEW_ZOOM_STEP)
      } else if (event.key === "0") {
        event.preventDefault()
        resetZoom()
      }
    }
    const onWheel = (event: WheelEvent) => {
      if (!panelElement?.contains(event.target as Node | null)) return
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      adjustZoom(event.deltaY < 0 ? BROWSER_PREVIEW_ZOOM_STEP : -BROWSER_PREVIEW_ZOOM_STEP)
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("wheel", onWheel, { passive: false })
    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("wheel", onWheel)
    })
  })

  // Native child-webview element picker (matches open-mirror-app): when the
  // live native preview is active and selection mode is on, arm the in-guest
  // picker + comment panel and poll the host for the result. Both the highlight
  // box and the comment panel are injected DOM overlays INSIDE the native
  // webview, so the live preview stays fully visible and the host never hides
  // or renders its own popover. A node click opens that guest panel while the
  // host keeps polling; only comment submission or cancellation completes it.
  createEffect(() => {
    appliedTheme()
    if (!nativePreviewMounted() || nodeSelectionEnabled()) return
    pushNativePreviewInteractionContext()
  })

  createEffect(() => {
    const lease = currentNativeLease()
    const enabled = nodeSelectionEnabled()
    if (!lease || !enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = () => {
      const result = runNativeLeaseCommand(
        lease,
        "selection",
        () => takeNativeSelection(browserPreviewNativeOwner(lease)),
        {
          success: (selectionResult, owner) => {
            if (cancelled || !requestOwnerIsCurrent(lease, owner)) return
            if (selectionResult.kind === "comment") {
              setNodeSelectionEnabled(false)
              applyGuestNodeComment(selectionResult.selection, selectionResult.comment)
              return
            }
            if (selectionResult.kind === "canceled") {
              setNodeSelectionEnabled(false)
              clearNodeSelection()
              return
            }
            timer = setTimeout(poll, 80)
          },
          failure: (error, owner) => {
            if (cancelled) return
            return exposeNativeOperationFailure(lease, owner, error)
          },
        },
      )
      observeSettledNativeLeaseCommand(result)
    }
    const presentation = nativeSelectionPresentation()
    const enableResult = runNativeLeaseCommand(
      lease,
      "selection",
      () => setNativeSelectionEnabled(browserPreviewNativeOwner(lease), true, presentation),
      {
        success: () => {
          if (!cancelled) poll()
        },
        failure: (error, owner) => exposeNativeOperationFailure(lease, owner, error),
      },
    )
    observeSettledNativeLeaseCommand(enableResult)
    onCleanup(() => {
      cancelled = true
      if (timer) clearTimeout(timer)
      disableNativeSelection(lease)
    })
  })

  return (
    <section
      ref={panelElement}
      class="browser-preview-panel"
      aria-label={t("browser_preview.title")}
      data-active={String(panelActive())}
    >
      <div class="browser-preview-command-surface">
        <Show when={nativePreviewCleanupError()}>
          {(error) => (
            <code
              class="browser-preview-native-cleanup-error"
              data-status="failed"
              data-ui="browser-preview-native-cleanup-error"
              role="alert"
            >
              {error()}
            </code>
          )}
        </Show>
        <Show when={browserMenuError()}>
          {(error) => (
            <code
              class="browser-preview-native-cleanup-error"
              data-status="failed"
              data-ui="browser-preview-menu-error"
              role="alert"
            >
              {error()}
            </code>
          )}
        </Show>
        <div class="browser-preview-chrome" data-ui="browser-preview-chrome">
          <div class="browser-preview-browser-controls" data-ui="browser-preview-navigation-controls">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              title={t("browser_preview.navigation.back_title")}
              aria-label={t("browser_preview.navigation.back_title")}
              disabled={!nativePreviewNavigationReady()}
              onClick={() => navigateNativePreview("back")}
            >
              <Icon name="nav-back" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              title={t("browser_preview.navigation.forward_title")}
              aria-label={t("browser_preview.navigation.forward_title")}
              disabled={!nativePreviewNavigationReady()}
              onClick={() => navigateNativePreview("forward")}
            >
              <Icon name="nav-forward" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              title={t("browser_preview.navigation.reload_title")}
              aria-label={t("browser_preview.navigation.reload_title")}
              disabled={!nativePreviewNavigationReady()}
              onClick={() => navigatePreview("reload")}
            >
              <Icon name="refresh" />
            </Button>
          </div>

          <form
            class="browser-preview-address-form"
            data-ui="browser-preview-address-form"
            onSubmit={(event) => {
              event.preventDefault()
              const raw = addressDraft().trim()
              if (!raw || addressActionBusy()) return
              if (!addressNavigationSupported()) {
                setAddressSubmitError(t("browser_preview.address.navigation_unavailable"))
                return
              }
              requestAddressNavigation(raw)
            }}
          >
            <TextField.Root class="browser-preview-address-field" size="sm" disabled={!addressInputAvailable()}>
              <TextField.Input
                class="browser-preview-address-input"
                data-ui="browser-preview-address-input"
                type="text"
                inputmode="url"
                spellcheck={false}
                autocomplete="off"
                autocapitalize="off"
                disabled={!addressInputAvailable()}
                placeholder={t("browser_preview.address.placeholder")}
                aria-label={t("browser_preview.address.label")}
                value={addressDraft()}
                onInput={(event) => {
                  setAddressDirty(true)
                  setAddressDraft(event.currentTarget.value)
                }}
                onBlur={() => {
                  if (!addressDirty()) return
                  if (addressDraft().trim() === (targetUrl() ?? "").trim()) setAddressDirty(false)
                }}
              />
            </TextField.Root>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-ui="browser-preview-address-submit"
              disabled={!addressNavigationAvailable() || !addressDraft().trim()}
              title={t("browser_preview.address.navigate")}
              aria-label={t("browser_preview.address.navigate")}
            >
              <Show when={!addressSubmitting()} fallback={<span class="card__spinner" aria-hidden="true" />}>
                <Icon name="nav-forward" />
              </Show>
            </Button>
          </form>

          <div class="browser-preview-chrome-actions" data-ui="browser-preview-chrome-actions">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-ui="browser-preview-address-open-external"
              disabled={!addressExternalOpenAvailable() || !addressDraft().trim()}
              title={t("browser_preview.address.open")}
              aria-label={t("browser_preview.address.open")}
              onClick={() => void openAddressInDefaultBrowser()}
            >
              <Show when={!addressExternalOpening()} fallback={<span class="card__spinner" aria-hidden="true" />}>
                <Icon name="open-external" />
              </Show>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              class="browser-preview-more-button"
              title={t("browser_preview.more")}
              aria-label={t("browser_preview.more")}
              aria-haspopup="menu"
              aria-expanded={browserMenuOpen()}
              onClick={(event) => void openBrowserMenu(event.currentTarget)}
            >
              <Icon name="more-vertical" />
            </Button>
          </div>
        </div>
        <Show when={addressSubmitError()}>
          {(error) => (
            <code class="browser-preview-address-error" data-ui="browser-preview-address-error" role="alert">
              {error()}
            </code>
          )}
        </Show>
        <Show when={target.loading}>
          <div class="browser-preview-progress" data-ui="browser-preview-progress" />
        </Show>
      </div>

      <div class="browser-preview-stage">
        <Switch
          fallback={<div class="browser-preview-new-tab" data-status="missing" data-ui="browser-preview-new-tab" />}
        >
          <Match when={stageKind() === "target-load-failed"}>
            <div class="browser-preview-empty" data-status="failed" data-ui="browser-preview-target-load-failed">
              <Icon name="status-failed" size="medium" />
              <p>{t("browser_preview.empty.failed")}</p>
              <code>{String(currentTargetError())}</code>
            </div>
          </Match>
          <Match when={stageKind() === "target-loading"}>
            <div class="browser-preview-empty" data-status="loading" role="status" aria-live="polite">
              <span class="card__spinner" />
              <p>{t("browser_preview.loading")}</p>
            </div>
          </Match>
          <Match when={stageKind() === "target-failed"}>
            <div class="browser-preview-empty" data-status="failed" data-ui="browser-preview-target-failed">
              <Icon name="status-failed" size="medium" />
              <p>{t("browser_preview.empty.failed")}</p>
              <Show when={failedTarget()?.url}>{(url) => <code>{url()}</code>}</Show>
              <For each={failedTarget()?.diagnostics ?? []}>{(item) => <code>{item}</code>}</For>
            </div>
          </Match>
          <Match when={stageKind() === "evidence-loading"}>
            <div class="browser-preview-empty" data-status="loading" data-ui="browser-preview-evidence-loading">
              <span class="card__spinner" aria-hidden="true" />
              <p>{t("browser_preview.empty.evidence_loading")}</p>
            </div>
          </Match>
          <Match when={stageKind() === "evidence-load-failed"}>
            <div class="browser-preview-empty" data-status="failed" data-ui="browser-preview-evidence-load-failed">
              <Icon name="status-failed" size="medium" />
              <p>{t("browser_preview.empty.evidence_failed")}</p>
              <code>{currentLatestEvidenceError()?.evidenceID}</code>
              <code>{currentLatestEvidenceError()?.message}</code>
            </div>
          </Match>
          <Match when={stageKind() === "native-error"}>
            <div class="browser-preview-empty" data-status="failed" data-ui="browser-preview-native-error">
              <Icon name="status-failed" size="medium" />
              <p>{t("browser_preview.empty.native_failed")}</p>
              <Show when={targetUrl()}>{(url) => <code>{url()}</code>}</Show>
              <code>{nativePreviewError()}</code>
            </div>
          </Match>
          <Match when={stageKind() === "evidence"}>
            <Show when={evidenceForDisplay()}>
              {(evidence) => (
                <section
                  class="browser-preview-evidence"
                  data-status={currentCaptureImageError() ? "failed" : evidence().status}
                  data-ui="browser-preview-evidence"
                >
                  <div class="browser-preview-evidence-header">
                    <Icon
                      name={
                        !currentCaptureImageError() && evidence().status === "passed"
                          ? "status-completed"
                          : "status-failed"
                      }
                      size="medium"
                    />
                    <span>
                      {currentCaptureImageError()
                        ? t("browser_preview.evidence.image_failed")
                        : evidenceStatusLabel(evidence().status)}
                    </span>
                    <Show when={evidence().id}>{(id) => <code>{id()}</code>}</Show>
                  </div>
                  <p>{evidence().summary}</p>
                  <Show when={currentCaptureImage()}>
                    {(image) => (
                      <PreviewableImage
                        src={image().url}
                        alt={evidence().summary}
                        triggerClass="browser-preview-evidence-shot"
                        imageClass="browser-preview-evidence-image"
                        imageDataUI="browser-preview-screenshot"
                        imageAttributes={{
                          "data-evidence-id": image().evidenceID,
                          decoding: "async",
                        }}
                      />
                    )}
                  </Show>
                  <Show when={currentCaptureImageError()}>
                    {(error) => (
                      <code data-ui="browser-preview-capture-image-error" data-status="failed">
                        {error()}
                      </code>
                    )}
                  </Show>
                  <dl class="browser-preview-evidence-facts">
                    <div>
                      <dt>{t("browser_preview.viewport.label")}</dt>
                      <dd>{viewportLabel(evidence().viewportID)}</dd>
                    </div>
                  </dl>
                  <For each={evidence().diagnostics}>{(item) => <code>{item}</code>}</For>
                </section>
              )}
            </Show>
          </Match>
          <Match when={stageKind() === "native-preview"}>
            <Show when={nativePreviewScope()}>
              {(scope) => (
                <section
                  class="browser-preview-live"
                  data-ui="browser-preview-live"
                  data-status={nativePreviewSyncing() ? "loading" : "ready"}
                  data-target-id={currentTarget()?.id}
                >
                  <div class="browser-preview-native-frame">
                    <div
                      ref={bindNativePreviewElement}
                      class="browser-preview-native-surface"
                      data-ui="browser-preview-native-surface"
                      data-selecting={nodeSelectionEnabled() ? "true" : undefined}
                      role="application"
                      aria-label={t("browser_preview.title")}
                    >
                      <Show when={nativePreviewSyncing()}>
                        <span class="card__spinner" aria-hidden="true" />
                      </Show>
                    </div>
                    {/* The selection highlight box and comment panel are injected
                        as DOM overlays INSIDE the native child webview (see main.rs
                        guest runtime), so the live preview stays visible while the
                        user comments. The host no longer renders its own popover. */}
                  </div>
                </section>
              )}
            </Show>
          </Match>
        </Switch>
      </div>
    </section>
  )
}

function viewportLabel(id: BrowserPreviewViewportID): string {
  const labels: Record<BrowserPreviewViewportID, string> = {
    desktop: t("browser_preview.viewport.desktop"),
    tablet: t("browser_preview.viewport.tablet"),
    mobile: t("browser_preview.viewport.mobile"),
  }
  return labels[id]
}

function evidenceStatusLabel(status: string): string {
  switch (status) {
    case "passed":
      return t("browser_preview.evidence.passed")
    case "failed":
      return t("browser_preview.evidence.failed")
    default:
      return status
  }
}

function browserPreviewErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function browserPreviewLogicalTargetKey(input: BrowserPreviewNativeScope): string {
  return `${input.tabID}:${input.mountKey}`
}

function browserPreviewNativeOwner(lease: BrowserPreviewNativeLease): { surfaceID: string; scopeKey: string } {
  return { surfaceID: lease.scope.tabID, scopeKey: lease.key }
}

function browserPreviewNativeBoundsKey(bounds: BrowserPreviewNativeBounds): string {
  return `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`
}

function browserPreviewNativeElementBounds(element: HTMLElement): BrowserPreviewNativeBounds | undefined {
  const rect = element.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const x = Math.max(0, rect.left)
  const y = Math.max(0, rect.top)
  const right = Math.min(viewportWidth, rect.right)
  const bottom = Math.min(viewportHeight, rect.bottom)
  const width = right - x
  const height = bottom - y
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return undefined
  }
  return { x, y, width, height }
}
