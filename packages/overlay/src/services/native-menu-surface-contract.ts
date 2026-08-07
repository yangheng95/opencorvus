import type { IconName } from "../components/ui/Icon"

export const NATIVE_MENU_SURFACE_LABEL = "native-menu-surface"
export const NATIVE_MENU_SURFACE_READY_EVENT = "native-menu-surface:ready"
export const NATIVE_MENU_SURFACE_MODEL_EVENT = "native-menu-surface:model"
export const NATIVE_MENU_SURFACE_MEASURED_EVENT = "native-menu-surface:measured"
export const NATIVE_MENU_SURFACE_ACTION_EVENT = "native-menu-surface:action"
export const NATIVE_MENU_SURFACE_DISMISS_EVENT = "native-menu-surface:dismiss"

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
