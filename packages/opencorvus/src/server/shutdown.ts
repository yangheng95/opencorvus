export type ServerShutdownRequest = {
  source: "tauri-supervisor" | "managed-parent-watchdog" | "http-client" | "internal-restart" | "process-signal"
  reason: string
  processOccurrenceID?: string
}

type ShutdownHandler = (request: ServerShutdownRequest) => void | Promise<void>

let shutdownHandler: ShutdownHandler | null = null

export function registerServerShutdownHandler(handler: ShutdownHandler) {
  shutdownHandler = handler
}

export function clearServerShutdownHandler(handler?: ShutdownHandler) {
  if (!handler || shutdownHandler === handler) shutdownHandler = null
}

export function hasServerShutdownHandler() {
  return shutdownHandler !== null
}

export function requestServerShutdown(request: ServerShutdownRequest) {
  const handler = shutdownHandler
  if (!handler) return false
  void Promise.resolve(handler(request)).catch((error) => {
    console.error("[server.shutdown] request failed:", error)
  })
  return true
}
