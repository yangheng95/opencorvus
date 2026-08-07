// ── Window / UI Service ──
// Exported functions:
// showOverlayWindow — reveal the mounted Tauri application window
// quitOverlay — quit the Tauri overlay process after UI confirmation

import { getHostTransport } from "./host-transport-runtime"
import { getTauriWindowHandle } from "./tauri-transport"

export async function showOverlayWindow(): Promise<void> {
  const nativeWindow = getTauriWindowHandle()
  if (!nativeWindow) return
  await nativeWindow.show()
  await nativeWindow.setFocus()
}

export async function quitOverlay(): Promise<boolean> {
  const transport = getHostTransport()
  if (!transport.capabilities.nativeCommands["window.quit"]) return false
  const result = await transport.native({ kind: "window.quit" })
  return result === true
}
