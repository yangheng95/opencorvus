// ── Pane Resizer Service ──
// Config-driven pane resizer for the default task Panel layout. The hardcoded
// element ids / CSS variables that used to be baked in now live in a
// `PaneConfig` so the drag logic stays layout-agnostic without duplicating
// DOM-specific resize code
// (CLAUDE.md rule 8 — single source, rule 9 — abstract the pattern once).
//
// references covered:
// - sanitizePaneWidth (util — also in store/settings.ts)
// - clampNumber (util)
// - paneHandleWidth (DOM helper)
// - defaultRailWidth (layout helper)
// - resolvedPaneWidths (layout helper)
// - renderPaneLayout (applies CSS custom properties)
// - resizePane (drag handler)
// - onPaneResizeMove (pointermove listener)
// - stopPaneResize (pointerup / pointercancel listener)
// - startPaneResize (pointerdown handler)
// - initPaneResizers (attaches listeners to DOM handles)
// - applyPaneWidths (imperatively set widths without dragging)
// The service reads and writes the left sidebar width via the callbacks
// supplied to initPaneResizers(), so the caller
// controls where those values are stored (Solid store, plain state, etc.)
// and which DOM handles / CSS variables back them via the PaneConfig.

import { createAnimationFrameScheduler, type AnimationFrameScheduler } from "../utils/animation-frame"
import { createLayoutTokenResolver, currentUIScale, type LayoutTokenResolver } from "../utils/layout-tokens"

// ── Types ──

/**
 * Describes the DOM handles and CSS custom properties that back one
 * horizontal layout. The default Panel supplies the DOM ids and CSS variables
 * so the shared drag logic stays layout-agnostic.
 */
export interface PaneConfig {
  /** Element whose rendered width bounds the whole row. */
  bodyId: string
  /** Left (sidebar) resize handle element id. */
  leftHandleId: string
  /** Fixed inline chrome that shares the left side with the sidebar. */
  leftFixedControlIds: readonly string[]
  /** Element ids controlled by the left resize handle. */
  leftControls: readonly string[]
  /** Fixed inline chrome that shares the remaining work area. */
  remainingFixedControlIds: readonly string[]
  /** Minimum width for the remaining work content, excluding fixed chrome. */
  remainingMinWidth: (layoutTokens?: LayoutTokenResolver) => number
  /** CSS custom property that carries the left column width (px). */
  sidebarVar: string
}

/** Default Panel layout (index.html `.panel-body`). */
export const PANEL_PANE_CONFIG: PaneConfig = {
  bodyId: "panelBody",
  leftHandleId: "leftPaneResizer",
  leftFixedControlIds: [],
  leftControls: ["sidebar", "workspaceMain"],
  remainingFixedControlIds: [],
  remainingMinWidth: defaultPanelRemainingMinWidth,
  sidebarVar: "--ui-sidebar-width",
}

export interface PaneState {
  sidebarWidth: number | null
  sidebarCollapsed: boolean
}

export interface PaneCallbacks {
  /** Read the current pane state. */
  getState: () => PaneState
  /**
   * Called whenever the user finishes a drag or widths are applied
   * programmatically. Persist the new widths here (e.g. save to store /
   * the active host settings source).
   */
  onWidthsChanged: (sidebarWidth: number | null) => void | Promise<void>
}

// ── Module-level drag state ──

interface PaneDrag {
  config: PaneConfig
  callbacks: PaneCallbacks
  pendingClientX: number | null
  resizeOnFrame: AnimationFrameScheduler
}

let paneDrag: PaneDrag | null = null

interface PaneResizeBounds {
  bodyRect: DOMRect
  min: number
  max: number
  now: number
  handleWidth: number
}

interface PaneGeometrySnapshot {
  bodyRect: DOMRect
  railMin: number
  remainingContentMin: number
  leftHandle: number
  leftFixed: number
  remainingFixed: number
  defaultSidebarWidth: number
}

const pendingPaneHandleSemantics = new Map<PaneConfig, PaneState>()

function flushPaneHandleSemantics(): void {
  const entries = Array.from(pendingPaneHandleSemantics.entries())
  pendingPaneHandleSemantics.clear()
  for (const [config, state] of entries) {
    renderPaneHandleSemantics(state, config)
  }
}

const renderPaneHandleSemanticsOnFrame = createAnimationFrameScheduler(flushPaneHandleSemantics)

function schedulePaneHandleSemantics(state: PaneState, config: PaneConfig): void {
  pendingPaneHandleSemantics.set(config, { ...state })
  renderPaneHandleSemanticsOnFrame.schedule()
}

// ── Helpers ──

/** Clamp a number to [min, max]. */
function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Return the rendered width of a pane resize handle element.
 */
export function paneHandleWidth(node: Element | null | undefined): number {
  if (!node) return 0
  const style = getComputedStyle(node as HTMLElement)
  if (style.display === "none" || style.visibility === "hidden") return 0
  const width = node.getBoundingClientRect().width
  if (width <= 0) throw new Error("Pane resize handle must render a positive width.")
  return width
}

function paneHandleElement(config: PaneConfig): HTMLElement | null {
  return document.getElementById(config.leftHandleId)
}

function renderedControlWidth(id: string): number {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Pane fixed control element not found: ${id}`)
  const style = getComputedStyle(node)
  if (node.hidden || style.display === "none" || style.visibility === "hidden") return 0
  return node.getBoundingClientRect().width
}

function renderedControlWidthSum(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + renderedControlWidth(id), 0)
}

/**
 * Compute the default rail width from the shared layout token contract.
 */
export function defaultRailWidth(
  config: PaneConfig,
  layoutTokens: LayoutTokenResolver = createLayoutTokenResolver(),
): number {
  void config
  return layoutTokens.tokenPx("--ui-rail-width")
}

export function defaultPanelRemainingMinWidth(layoutTokens: LayoutTokenResolver = createLayoutTokenResolver()): number {
  return layoutTokens.tokenPx("--ui-chat-min-width")
}

function paneWidthStyleScope(): HTMLElement {
  return document.body || document.documentElement
}

function setPaneWidthProperty(name: string, value: number): void {
  paneWidthStyleScope().style.setProperty(name, `${value}px`)
}

function observePanePersistence(owner: string, promise: Promise<void>): void {
  void promise.catch((error) => {
    console.error(`[pane] ${owner} persistence failed`, error)
  })
}

function readPaneWidthProperty(name: string): number {
  return Number.parseFloat(getComputedStyle(paneWidthStyleScope()).getPropertyValue(name))
}

function readPaneGeometrySnapshot(config: PaneConfig): PaneGeometrySnapshot | null {
  const body = document.getElementById(config.bodyId)
  if (!body) return null
  const bodyRect = body.getBoundingClientRect()
  const layoutTokens = createLayoutTokenResolver()
  const remainingContentMin = config.remainingMinWidth(layoutTokens)
  if (!Number.isFinite(remainingContentMin) || remainingContentMin <= 0) {
    throw new Error("Pane remaining minimum width must be a positive finite number.")
  }
  return {
    bodyRect,
    railMin: layoutTokens.tokenPx("--ui-rail-min-width"),
    remainingContentMin,
    leftHandle: paneHandleWidth(paneHandleElement(config)),
    leftFixed: renderedControlWidthSum(config.leftFixedControlIds),
    remainingFixed: renderedControlWidthSum(config.remainingFixedControlIds),
    defaultSidebarWidth: defaultRailWidth(config, layoutTokens),
  }
}

function paneSidebarMax(geometry: PaneGeometrySnapshot): number {
  const total = geometry.bodyRect.width - geometry.leftHandle - geometry.leftFixed
  return Math.max(geometry.railMin, total - geometry.remainingFixed - geometry.remainingContentMin)
}

function resolveSidebarWidthFromGeometry(state: PaneState, geometry: PaneGeometrySnapshot): number {
  return clampNumber(state.sidebarWidth ?? geometry.defaultSidebarWidth, geometry.railMin, paneSidebarMax(geometry))
}

/**
 * Compute the final sidebar width after overflow clamping.
 */
export function resolvedPaneWidths(
  state: PaneState,
  config: PaneConfig,
): {
  sidebar: number
} {
  const geometry = readPaneGeometrySnapshot(config)
  if (!geometry) throw new Error(`Pane body element not found: ${config.bodyId}`)
  const sidebar = resolveSidebarWidthFromGeometry(state, geometry)
  return { sidebar: Math.round(sidebar) }
}

function paneResizeBounds(state: PaneState, config: PaneConfig): PaneResizeBounds | null {
  const geometry = readPaneGeometrySnapshot(config)
  if (!geometry) return null
  const max = Math.max(geometry.railMin, paneSidebarMax(geometry))
  const now = resolveSidebarWidthFromGeometry(state, geometry)
  return {
    bodyRect: geometry.bodyRect,
    min: Math.round(geometry.railMin),
    max: Math.round(max),
    now: Math.round(clampNumber(now, geometry.railMin, max)),
    handleWidth: Math.round(geometry.leftHandle),
  }
}

function renderPaneHandleSemantics(state: PaneState, config: PaneConfig): void {
  const handle = paneHandleElement(config)
  if (!handle) return
  handle.hidden = state.sidebarCollapsed
  const bounds = state.sidebarCollapsed ? null : paneResizeBounds(state, config)
  const enabled = !state.sidebarCollapsed && !!bounds && bounds.handleWidth > 0
  handle.dataset.disabled = String(!enabled)
  handle.tabIndex = enabled ? 0 : -1
  if (config.leftControls.length) handle.setAttribute("aria-controls", config.leftControls.join(" "))
  else handle.removeAttribute("aria-controls")
  if (!enabled || !bounds) {
    handle.removeAttribute("aria-valuemin")
    handle.removeAttribute("aria-valuemax")
    handle.removeAttribute("aria-valuenow")
    return
  }
  handle.setAttribute("aria-valuemin", String(bounds.min))
  handle.setAttribute("aria-valuemax", String(bounds.max))
  handle.setAttribute("aria-valuenow", String(bounds.now))
}

/**
 * Apply the resolved pane widths as CSS custom properties on
 * the pane-width style scope (document.body).
 */
export function renderPaneLayout(state: PaneState, config: PaneConfig): void {
  if (typeof document === "undefined") return
  if (state.sidebarCollapsed) {
    renderPaneHandleSemantics(state, config)
    return
  }
  const widths = resolvedPaneWidths(state, config)
  setPaneWidthProperty(config.sidebarVar, widths.sidebar)
  schedulePaneHandleSemantics(state, config)
}

/**
 * Imperatively set the sidebar width, re-render layout, and call onWidthsChanged.
 * Equivalent to calling state.sidebarWidth = x; renderPaneLayout().
 */
export function applyPaneWidths(sidebarWidth: number | null, callbacks: PaneCallbacks, config: PaneConfig): void {
  const state = callbacks.getState()
  const next: PaneState = {
    ...state,
    sidebarWidth: sidebarWidth ?? state.sidebarWidth,
  }
  renderPaneLayout(next, config)
  observePanePersistence("applyPaneWidths", Promise.resolve(callbacks.onWidthsChanged(next.sidebarWidth)))
}

// ── Drag logic ──

/**
 * Compute new sidebarWidth from a pointer X position.
 * Mutates the PaneState values returned by callbacks.getState() by calling
 * renderPaneLayout with a derived state — state is NOT mutated; the caller is
 * responsible for updating their store in onWidthsChanged.
 */
function resizePane(clientX: number, callbacks: PaneCallbacks, config: PaneConfig): void {
  const state = callbacks.getState()
  const bounds = paneResizeBounds(state, config)
  if (!bounds) return

  const newSidebarWidth = Math.round(clampNumber(clientX - bounds.bodyRect.left, bounds.min, bounds.max))
  renderPaneLayout({ ...state, sidebarWidth: newSidebarWidth }, config)
}

function flushPendingPaneResize(): void {
  if (!paneDrag) return
  const clientX = paneDrag.pendingClientX
  if (clientX === null) return
  paneDrag.pendingClientX = null
  resizePane(clientX, paneDrag.callbacks, paneDrag.config)
}

function onPaneResizeMove(event: PointerEvent): void {
  if (!paneDrag) return
  paneDrag.pendingClientX = event.clientX
  paneDrag.resizeOnFrame.schedule()
}

async function persistRenderedPaneWidths(callbacks: PaneCallbacks, config: PaneConfig): Promise<void> {
  const sidebarPx = readPaneWidthProperty(config.sidebarVar)
  const sidebarWidth = Number.isFinite(sidebarPx) ? Math.round(sidebarPx) : null

  await callbacks.onWidthsChanged(sidebarWidth)
}

async function stopPaneResize(): Promise<void> {
  if (!paneDrag) return
  paneDrag.resizeOnFrame.cancel()
  flushPendingPaneResize()
  const config = paneDrag.config
  const handle = paneHandleElement(config)
  if (handle) delete (handle as HTMLElement).dataset.active
  const callbacks = paneDrag.callbacks
  paneDrag = null
  delete document.body.dataset.resizing
  await persistRenderedPaneWidths(callbacks, config)
}

function startPaneResize(event: PointerEvent, callbacks: PaneCallbacks, config: PaneConfig): void {
  if (event.button != null && event.button !== 0) return
  const state = callbacks.getState()
  if (state.sidebarCollapsed) return
  const handle = paneHandleElement(config)
  if (!handle) return
  paneDrag = {
    config,
    callbacks,
    pendingClientX: null,
    resizeOnFrame: createAnimationFrameScheduler(flushPendingPaneResize),
  }
  handle.dataset.active = "true"
  document.body.dataset.resizing = "true"

  // Capture listeners with callbacks in closure
  function onMove(ev: PointerEvent) {
    onPaneResizeMove(ev)
  }
  async function onUp() {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
    try {
      await stopPaneResize()
    } catch (error) {
      console.error("[pane] pointer resize stop failed", error)
    }
  }
  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onUp)

  onPaneResizeMove(event)
  event.preventDefault()
}

function resizePaneByKeyboard(event: KeyboardEvent, callbacks: PaneCallbacks, config: PaneConfig): void {
  const state = callbacks.getState()
  if (state.sidebarCollapsed) return
  const bounds = paneResizeBounds(state, config)
  if (!bounds || bounds.handleWidth <= 0) return
  const step = Math.round(24 * currentUIScale())
  let next = bounds.now
  if (event.key === "ArrowLeft") {
    next -= step
  } else if (event.key === "ArrowRight") {
    next += step
  } else if (event.key === "Home") {
    next = bounds.min
  } else if (event.key === "End") {
    next = bounds.max
  } else {
    return
  }
  event.preventDefault()
  const width = Math.round(clampNumber(next, bounds.min, bounds.max))
  renderPaneLayout(
    {
      ...state,
      sidebarWidth: width,
    },
    config,
  )
  observePanePersistence("keyboard resize", persistRenderedPaneWidths(callbacks, config))
}

// ── Public API ──

/**
 * Attach pointerdown listeners to the config's left resize handle.
 * Call once from onMount (or equivalent) after the DOM has been rendered.
 * Returns a cleanup function that removes the listeners.
 */
export function initPaneResizers(callbacks: PaneCallbacks, config: PaneConfig): () => void {
  const leftHandle = paneHandleElement(config)

  function onLeftDown(ev: Event) {
    startPaneResize(ev as PointerEvent, callbacks, config)
  }
  function onLeftKeyDown(ev: Event) {
    resizePaneByKeyboard(ev as KeyboardEvent, callbacks, config)
  }

  leftHandle?.addEventListener("pointerdown", onLeftDown)
  leftHandle?.addEventListener("keydown", onLeftKeyDown)

  // Render layout immediately so the initial widths are applied
  renderPaneLayout(callbacks.getState(), config)

  return () => {
    leftHandle?.removeEventListener("pointerdown", onLeftDown)
    leftHandle?.removeEventListener("keydown", onLeftKeyDown)
  }
}

/**
 * Stop any in-progress pane resize.
 * Call on window blur (
 */
export async function cancelPaneResize(callbacks: PaneCallbacks): Promise<void> {
  void callbacks
  if (!paneDrag) return
  await stopPaneResize()
}
