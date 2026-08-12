import type { IconName } from "../components/ui/Icon"

export const NATIVE_MENU_SURFACE_LABEL = "native-menu-surface"
export const NATIVE_MENU_SURFACE_READY_EVENT = "native-menu-surface:ready"
export const NATIVE_MENU_SURFACE_MODEL_EVENT = "native-menu-surface:model"
export const NATIVE_MENU_SURFACE_MEASURED_EVENT = "native-menu-surface:measured"
export const NATIVE_MENU_SURFACE_ACTION_EVENT = "native-menu-surface:action"
export const NATIVE_MENU_SURFACE_DISMISS_EVENT = "native-menu-surface:dismiss"
export const NATIVE_MENU_SURFACE_FAILED_EVENT = "native-menu-surface:failed"
export const NATIVE_MENU_SURFACE_READY_TIMEOUT_MS = 5_000

export class NativeMenuSurfaceReadinessError extends Error {
  readonly code = "NATIVE_MENU_SURFACE_READY_TIMEOUT"

  constructor(timeoutMs: number) {
    super(`Native menu surface did not become ready within ${timeoutMs}ms`)
    this.name = "NativeMenuSurfaceReadinessError"
  }
}

export function waitForNativeMenuSurfaceReady<T>(signal: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new NativeMenuSurfaceReadinessError(timeoutMs)), timeoutMs)
    void signal.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export interface NativeMenuSurfaceItem {
  id: string
  label: string
  description?: string
  ariaLabel?: string
  icon?: IconName
  enabled?: boolean
  checked?: boolean
  iconOnly?: boolean
}

export interface NativeMenuSurfaceGroup {
  heading?: string
  layout?: "menu" | "toolbar"
  items: NativeMenuSurfaceItem[]
}

export type NativeMenuSurfaceVariant = "standard" | "compact-list"

export interface NativeMenuSurfaceModel {
  requestID: number
  theme: string
  scale: number
  language: string
  variant: NativeMenuSurfaceVariant
  maxHeight?: number
  groups: NativeMenuSurfaceGroup[]
}

export interface NativeMenuSurfaceMeasured {
  requestID: number
  width: number
  height: number
}

export interface NativeMenuSurfaceAction {
  requestID: number
  itemID: string
}

export interface NativeMenuSurfaceDismiss {
  requestID: number
}

export interface NativeMenuSurfaceFailure {
  generation: number
  message: string
}

export interface NativeMenuSurfaceReady {
  generation: number
}
