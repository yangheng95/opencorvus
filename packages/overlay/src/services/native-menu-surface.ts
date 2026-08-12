import { LogicalSize, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi"
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event"
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window"
import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import {
  NATIVE_MENU_SURFACE_ACTION_EVENT,
  NATIVE_MENU_SURFACE_DISMISS_EVENT,
  NATIVE_MENU_SURFACE_FAILED_EVENT,
  NATIVE_MENU_SURFACE_LABEL,
  NATIVE_MENU_SURFACE_MEASURED_EVENT,
  NATIVE_MENU_SURFACE_MODEL_EVENT,
  NATIVE_MENU_SURFACE_READY_EVENT,
  NATIVE_MENU_SURFACE_READY_TIMEOUT_MS,
  type NativeMenuSurfaceAction,
  type NativeMenuSurfaceDismiss,
  type NativeMenuSurfaceFailure,
  type NativeMenuSurfaceGroup,
  type NativeMenuSurfaceReady,
  type NativeMenuSurfaceMeasured,
  type NativeMenuSurfaceModel,
  type NativeMenuSurfaceVariant,
  waitForNativeMenuSurfaceReady,
} from "./native-menu-surface-contract"

interface NativeMenuAnchor {
  left: number
  top: number
  right: number
  bottom: number
}

export interface OpenNativeMenuSurfaceOptions {
  owner: string
  anchor: HTMLElement
  placement?: "bottom-end" | "right-start"
  variant?: NativeMenuSurfaceVariant
  maxHeight?: number
  groups: NativeMenuSurfaceGroup[]
  onAction: (itemID: string) => void | Promise<void>
  onDismiss: () => void
  onError?: (error: unknown) => void
}

interface ActiveNativeMenuSurface {
  requestID: number
  owner: string
  anchorElement: HTMLElement
  anchor: NativeMenuAnchor
  placement: NonNullable<OpenNativeMenuSurfaceOptions["placement"]>
  onAction: OpenNativeMenuSurfaceOptions["onAction"]
  onDismiss: OpenNativeMenuSurfaceOptions["onDismiss"]
  onError?: OpenNativeMenuSurfaceOptions["onError"]
  resolveOpen: () => void
  rejectOpen: (reason: unknown) => void
  openSettled: boolean
  popup?: WebviewWindow
  closeItemID?: string
  closePromise?: Promise<void>
}

let surfaceWindow: WebviewWindow | undefined
let surfaceWindowPromise: Promise<WebviewWindow> | undefined
let eventBridgePromise: Promise<void> | undefined
let readyPromise: Promise<void> | undefined
let resolveReady: (() => void) | undefined
let rejectReady: ((reason: unknown) => void) | undefined
let readyWindow: WebviewWindow | undefined
let nextRequestID = 0
let activeSurface: ActiveNativeMenuSurface | undefined
let nextWindowGeneration = 0
let readyGeneration = 0
let surfaceTransitionTail: Promise<void> = Promise.resolve()

async function runSurfaceTransition<T>(operation: () => Promise<T> | T): Promise<T> {
  let release!: () => void
  const turn = new Promise<void>((resolve) => {
    release = resolve
  })
  const predecessor = surfaceTransitionTail
  surfaceTransitionTail = predecessor.then(() => turn, () => turn)
  await predecessor.catch(() => undefined)
  try {
    return await operation()
  } finally {
    release()
  }
}

function dismissFromParentPointer(event: PointerEvent): void {
  const active = activeSurface
  const target = event.target
  if (!active || !(target instanceof Node) || active.anchorElement.contains(target)) return
  void closeOwnedSurface(active).catch((error) => {
    console.error("[native-menu-surface] pointer close failed", error)
  })
}

function currentPresentation(): Pick<NativeMenuSurfaceModel, "theme" | "scale" | "language"> {
  const scale = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"))
  return {
    theme: document.documentElement.dataset.theme || "light",
    scale: Number.isFinite(scale) ? scale : 1,
    language: document.documentElement.lang || navigator.language || "en-US",
  }
}

function completeActiveSurface(requestID: number, itemID?: string): void {
  const active = activeSurface
  if (!active || active.requestID !== requestID) return
  activeSurface = undefined
  if (!active.openSettled) {
    active.openSettled = true
    active.resolveOpen()
  }
  active.onDismiss()
  if (itemID) {
    void Promise.resolve(active.onAction(itemID)).catch((error) => {
      console.error(`[native-menu-surface:${active.owner}] action failed`, error)
    })
  }
}

function failActiveSurface(requestID: number, error: unknown): void {
  const active = activeSurface
  if (!active || active.requestID !== requestID) return
  if (!active.openSettled) {
    active.openSettled = true
    active.rejectOpen(error)
  }
  completeActiveSurface(requestID)
}

function ownsPresentation(requestID: number, popup: WebviewWindow): boolean {
  return activeSurface?.requestID === requestID && surfaceWindow === popup
}

async function hidePopupIfUnowned(popup: WebviewWindow): Promise<void> {
  if (activeSurface && (activeSurface.popup === popup || surfaceWindow === popup)) return
  await popup.hide()
}

async function closeOwnedSurface(active: ActiveNativeMenuSurface): Promise<void> {
  await closeOwnedSurfaceWithAction(active)
}

async function closeOwnedSurfaceWithAction(active: ActiveNativeMenuSurface, itemID?: string): Promise<void> {
  if (activeSurface?.requestID !== active.requestID) return
  if (itemID !== undefined) active.closeItemID = itemID
  if (active.closePromise) return active.closePromise
  const closeAttempt = performOwnedSurfaceClose(active)
  active.closePromise = closeAttempt
  try {
    await closeAttempt
  } finally {
    if (active.closePromise === closeAttempt) active.closePromise = undefined
  }
}

async function performOwnedSurfaceClose(active: ActiveNativeMenuSurface): Promise<void> {
  if (activeSurface?.requestID !== active.requestID) return
  const popup = active.popup ?? surfaceWindow
  if (!popup) {
    completeActiveSurface(active.requestID, active.closeItemID)
    return
  }
  try {
    await popup.hide()
  } catch (hideError) {
    if (activeSurface?.requestID !== active.requestID) return
    try {
      if (surfaceWindow === popup) surfaceWindow = undefined
      active.popup = undefined
      await popup.destroy()
      completeActiveSurface(active.requestID, active.closeItemID)
      return
    } catch (destroyError) {
      const error = new AggregateError([hideError, destroyError], "Native menu surface could not be closed")
      if (activeSurface?.requestID !== active.requestID || surfaceWindow !== undefined) {
        console.error("[native-menu-surface] stale close failed", error)
        return
      }
      surfaceWindow = popup
      active.popup = popup
      if (!active.openSettled) {
        active.openSettled = true
        active.rejectOpen(error)
      }
      active.onError?.(error)
      console.error("[native-menu-surface] close failed", error)
      throw error
    }
  }
  completeActiveSurface(active.requestID, active.closeItemID)
}

async function placeMeasuredSurface(measurement: NativeMenuSurfaceMeasured): Promise<void> {
  const active = activeSurface
  const popup = surfaceWindow
  if (!active || !popup || active.requestID !== measurement.requestID) return

  const mainWindow = getCurrentWindow()
  const [mainInnerPosition, scaleFactor, monitor] = await Promise.all([
    mainWindow.innerPosition(),
    mainWindow.scaleFactor(),
    currentMonitor(),
  ])
  if (!ownsPresentation(measurement.requestID, popup)) return

  const logicalSize = new LogicalSize(measurement.width, measurement.height)
  const physicalSize = logicalSize.toPhysical(scaleFactor)
  const popupWidth = Math.ceil(physicalSize.width)
  const popupHeight = Math.ceil(physicalSize.height)
  const gutter = Math.round(6 * scaleFactor)
  const anchorLeft = mainInnerPosition.x + Math.round(active.anchor.left * scaleFactor)
  const anchorRight = mainInnerPosition.x + Math.round(active.anchor.right * scaleFactor)
  const anchorTop = mainInnerPosition.y + Math.round(active.anchor.top * scaleFactor)
  const anchorBottom = mainInnerPosition.y + Math.round(active.anchor.bottom * scaleFactor)
  const monitorLeft = monitor?.position.x ?? anchorLeft
  const monitorTop = monitor?.position.y ?? anchorTop
  const monitorRight = monitor ? monitor.position.x + monitor.size.width : anchorRight
  const monitorBottom = monitor ? monitor.position.y + monitor.size.height : anchorBottom + popupHeight
  const desiredLeft =
    active.placement === "right-start"
      ? anchorRight + gutter
      : anchorRight - popupWidth
  const alternateLeft = anchorLeft - gutter - popupWidth
  const placedLeft =
    active.placement === "right-start" && desiredLeft + popupWidth > monitorRight ? alternateLeft : desiredLeft
  const desiredTop = active.placement === "right-start" ? anchorTop : anchorBottom + gutter
  const alternateTop = anchorTop - gutter - popupHeight
  const placedTop =
    active.placement === "bottom-end" && desiredTop + popupHeight > monitorBottom ? alternateTop : desiredTop
  const top = Math.min(Math.max(placedTop, monitorTop), Math.max(monitorTop, monitorBottom - popupHeight))
  const left = Math.min(Math.max(placedLeft, monitorLeft), Math.max(monitorLeft, monitorRight - popupWidth))

  await popup.setSize(new PhysicalSize(popupWidth, popupHeight))
  if (!ownsPresentation(measurement.requestID, popup)) return
  await popup.setPosition(new PhysicalPosition(left, top))
  if (!ownsPresentation(measurement.requestID, popup)) return
  await popup.show()
  if (!ownsPresentation(measurement.requestID, popup)) {
    await hidePopupIfUnowned(popup)
    return
  }
  await popup.setFocus()
  if (!ownsPresentation(measurement.requestID, popup) || active.openSettled) {
    if (!ownsPresentation(measurement.requestID, popup)) await hidePopupIfUnowned(popup)
    return
  }
  active.openSettled = true
  active.resolveOpen()
}

async function ensureEventBridge(): Promise<void> {
  if (eventBridgePromise) return eventBridgePromise
  const attempt = (async () => {
    const unlisteners: UnlistenFn[] = []
    document.addEventListener("pointerdown", dismissFromParentPointer, true)
    try {
      unlisteners.push(await listen<NativeMenuSurfaceReady>(NATIVE_MENU_SURFACE_READY_EVENT, ({ payload }) => {
        if (payload.generation !== readyGeneration) return
        resolveReady?.()
        resolveReady = undefined
        rejectReady = undefined
      }))
      unlisteners.push(await listen<NativeMenuSurfaceFailure>(NATIVE_MENU_SURFACE_FAILED_EVENT, ({ payload }) => {
        if (payload.generation !== readyGeneration) return
        rejectReady?.(new Error(payload.message))
        resolveReady = undefined
        rejectReady = undefined
      }))
      unlisteners.push(await listen<NativeMenuSurfaceMeasured>(NATIVE_MENU_SURFACE_MEASURED_EVENT, ({ payload }) => {
        const measuredPopup = surfaceWindow
        void placeMeasuredSurface(payload).catch((error) => {
          console.error("[native-menu-surface] placement failed", error)
          failActiveSurface(payload.requestID, error)
          if (measuredPopup) {
            void hidePopupIfUnowned(measuredPopup).catch((hideError) => {
              console.error("[native-menu-surface] failed stale menu cleanup", hideError)
            })
          }
        })
      }))
      unlisteners.push(await listen<NativeMenuSurfaceAction>(NATIVE_MENU_SURFACE_ACTION_EVENT, ({ payload }) => {
        const active = activeSurface
        if (!active || active.requestID !== payload.requestID) return
        void closeOwnedSurfaceWithAction(active, payload.itemID).catch((error) => {
          console.error("[native-menu-surface] action close failed", error)
        })
      }))
      unlisteners.push(await listen<NativeMenuSurfaceDismiss>(NATIVE_MENU_SURFACE_DISMISS_EVENT, ({ payload }) => {
        const active = activeSurface
        if (!active || active.requestID !== payload.requestID) return
        void closeOwnedSurface(active).catch((error) => {
          console.error("[native-menu-surface] dismiss close failed", error)
        })
      }))
    } catch (error) {
      document.removeEventListener("pointerdown", dismissFromParentPointer, true)
      for (const unlisten of unlisteners) unlisten()
      throw error
    }
  })()
  eventBridgePromise = attempt
  try {
    await attempt
  } catch (error) {
    if (eventBridgePromise === attempt) {
      eventBridgePromise = undefined
    }
    throw error
  }
}

async function ensureSurfaceWindow(): Promise<WebviewWindow> {
  if (surfaceWindow) return surfaceWindow
  if (surfaceWindowPromise) return surfaceWindowPromise
  const attempt = (async () => {
    await ensureEventBridge()
    const generation = ++nextWindowGeneration
    readyGeneration = generation
    readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    const popup = new WebviewWindow(NATIVE_MENU_SURFACE_LABEL, {
      url: `native-menu.html?generation=${generation}`,
      parent: "main",
      width: 1,
      height: 1,
      visible: false,
      focus: false,
      focusable: true,
      resizable: false,
      decorations: false,
      transparent: true,
      shadow: false,
      skipTaskbar: true,
      backgroundColor: [0, 0, 0, 0],
    })
    readyWindow = popup
    void popup.once("tauri://destroyed", () => {
      const ownedReadyWindow = readyWindow === popup
      const ownedSurfaceWindow = surfaceWindow === popup
      if (ownedReadyWindow) rejectReady?.(new Error("Native menu surface was destroyed before it became ready"))
      if (ownedSurfaceWindow) surfaceWindow = undefined
      if (activeSurface?.popup === popup) {
        failActiveSurface(activeSurface.requestID, new Error("Native menu surface was destroyed before it became visible"))
      }
    })
    try {
      await waitForNativeMenuSurfaceReady(
        new Promise<void>((resolve, reject) => {
          void popup.once("tauri://created", () => resolve())
          void popup.once("tauri://error", ({ payload }) => reject(payload))
        }),
        NATIVE_MENU_SURFACE_READY_TIMEOUT_MS,
      )
      await waitForNativeMenuSurfaceReady(readyPromise, NATIVE_MENU_SURFACE_READY_TIMEOUT_MS)
      surfaceWindow = popup
      return popup
    } catch (error) {
      await popup.destroy().catch((destroyError) => {
        console.error("[native-menu-surface] failed window cleanup", destroyError)
      })
      if (surfaceWindow === popup) surfaceWindow = undefined
      throw error
    } finally {
      readyPromise = undefined
      resolveReady = undefined
      rejectReady = undefined
      if (readyGeneration === generation) readyGeneration = 0
      if (readyWindow === popup) readyWindow = undefined
    }
  })()
  surfaceWindowPromise = attempt
  try {
    return await attempt
  } finally {
    if (surfaceWindowPromise === attempt) surfaceWindowPromise = undefined
  }
}

export async function openNativeMenuSurface(options: OpenNativeMenuSurfaceOptions): Promise<void> {
  const bounds = options.anchor.getBoundingClientRect()
  const { requestID, presentation } = await runSurfaceTransition(async () => {
    const previous = activeSurface
    if (previous) await closeOwnedSurface(previous)
    if (activeSurface) throw new Error("Native menu surface predecessor did not close")
    const requestID = ++nextRequestID
    let resolveOpen!: () => void
    let rejectOpen!: (reason: unknown) => void
    const openPromise = new Promise<void>((resolve, reject) => {
      resolveOpen = resolve
      rejectOpen = reject
    })
    activeSurface = {
      requestID,
      owner: options.owner,
      anchorElement: options.anchor,
      anchor: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
      placement: options.placement ?? "bottom-end",
      onAction: options.onAction,
      onDismiss: options.onDismiss,
      onError: options.onError,
      resolveOpen,
      rejectOpen,
      openSettled: false,
    }
    return {
      requestID,
      presentation: waitForNativeMenuSurfaceReady(openPromise, NATIVE_MENU_SURFACE_READY_TIMEOUT_MS),
    }
  })
  let popup: WebviewWindow
  try {
    popup = await ensureSurfaceWindow()
  } catch (error) {
    failActiveSurface(requestID, error)
    await presentation.catch(() => undefined)
    throw error
  }
  if (!activeSurface || activeSurface.requestID !== requestID) {
    await presentation.catch(() => undefined)
    return
  }
  activeSurface.popup = popup
  const model: NativeMenuSurfaceModel = {
    requestID,
    ...currentPresentation(),
    variant: options.variant ?? "standard",
    ...(options.maxHeight === undefined ? {} : { maxHeight: options.maxHeight }),
    groups: options.groups,
  }
  try {
    await popup.hide()
    if (!ownsPresentation(requestID, popup)) {
      await presentation.catch(() => undefined)
      return
    }
    await emitTo(NATIVE_MENU_SURFACE_LABEL, NATIVE_MENU_SURFACE_MODEL_EVENT, model)
    if (!ownsPresentation(requestID, popup)) {
      await presentation.catch(() => undefined)
      return
    }
    await presentation
  } catch (error) {
    const active = activeSurface
    if (active?.requestID === requestID) {
      activeSurface = undefined
      if (!active.openSettled) {
        active.openSettled = true
        active.rejectOpen(error)
      }
      active.onDismiss()
      await surfaceWindow?.hide().catch((hideError) => {
        console.error("[native-menu-surface] failed menu cleanup", hideError)
      })
    }
    throw error
  }
}

export async function closeNativeMenuSurface(owner: string): Promise<void> {
  const active = activeSurface
  if (!active || active.owner !== owner) return
  await closeOwnedSurface(active).catch((error) => {
    console.error(`[native-menu-surface:${owner}] close failed`, error)
  })
}
