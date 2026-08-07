import type { HostKind } from "./host-transport"
import { listenTauriEvent, tauriEventApiAvailable } from "./tauri-transport"

export const NATIVE_MENU_EVENT = "oc:native-menu"

export const NATIVE_MENU_ACTION_IDS = [
  "native-menu:settings",
  "native-menu:quit",
  "native-menu:new-window",
  "native-menu:new-chat",
  "native-menu:quick-chat",
  "native-menu:open-folder",
  "native-menu:close-project",
  "native-menu:search",
  "native-menu:providers",
  "native-menu:theme-system",
  "native-menu:theme-light",
  "native-menu:theme-dark",
  "native-menu:theme-vscode-dark",
  "native-menu:toggle-locale",
  "native-menu:zoom-in",
  "native-menu:zoom-out",
  "native-menu:zoom-reset",
  "native-menu:reset-layout",
  "native-menu:docs",
  "native-menu:sdk",
  "native-menu:logs",
  "native-menu:devtools",
] as const

export type NativeMenuActionID = (typeof NATIVE_MENU_ACTION_IDS)[number]
export type OverlayBuildPlatform = "darwin" | "linux" | "win32"

const NATIVE_MENU_ACTION_ID_SET = new Set<string>(NATIVE_MENU_ACTION_IDS)

export function usesNativeMacosMenu(
  platform: OverlayBuildPlatform,
  host: HostKind,
  nativeEventBridgeAvailable = tauriEventApiAvailable(),
): boolean {
  return platform === "darwin" && host === "tauri" && nativeEventBridgeAvailable
}

export async function installNativeMenuListener(onAction: (action: NativeMenuActionID) => void): Promise<() => void> {
  return listenTauriEvent<string>(NATIVE_MENU_EVENT, ({ payload }) => {
    if (!NATIVE_MENU_ACTION_ID_SET.has(payload)) {
      throw new Error(`Unknown native menu action: ${payload}`)
    }
    onAction(payload as NativeMenuActionID)
  })
}
