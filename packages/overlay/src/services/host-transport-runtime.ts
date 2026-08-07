import type { HostTransport } from "./host-transport"
import { createTauriTransport } from "./tauri-transport"

let instance: HostTransport | undefined

export function createHostTransport(): HostTransport {
  if (instance) return instance
  if (typeof globalThis !== "undefined" && (globalThis as any).window) {
    const hostWindow = (globalThis as any).window as any
    if (typeof hostWindow.__TAURI__ !== "undefined") {
      instance = createTauriTransport()
      return instance
    }
  }
  instance = createTauriTransport("browser")
  return instance
}

export function getHostTransport(): HostTransport {
  return instance ?? createHostTransport()
}

export function __setHostTransportForTest(transport: HostTransport | undefined): void {
  instance = transport
}
