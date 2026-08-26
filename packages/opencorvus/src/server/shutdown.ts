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

/**
 * Invoke the registered shutdown handler and hand its outcome to the caller.
 *
 * Returning `false` when no handler is registered lets the caller treat a
 * cleared handler as the failure it is; swallowing the handler's rejection
 * here would let an admitted shutdown fail with nothing but a console line.
 */
export function requestServerShutdown(request: ServerShutdownRequest): Promise<void> | false {
  const handler = shutdownHandler
  if (!handler) return false
  return Promise.resolve(handler(request))
}
