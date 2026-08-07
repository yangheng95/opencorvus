import { Log } from "./log"

function errorPayload(reason: unknown) {
  return reason instanceof Error ? { error: reason } : { reason }
}

function rethrowAfterProcessError(event: "unhandledRejection" | "uncaughtException", reason: unknown): never {
  process.removeAllListeners(event)
  throw reason
}

export function installProcessErrorLogging() {
  process.on("unhandledRejection", (reason) => {
    Log.Default.error("unhandled rejection", errorPayload(reason))
    rethrowAfterProcessError("unhandledRejection", reason)
  })

  process.on("uncaughtException", (error) => {
    Log.Default.error("uncaught exception", errorPayload(error))
    rethrowAfterProcessError("uncaughtException", error)
  })
}
