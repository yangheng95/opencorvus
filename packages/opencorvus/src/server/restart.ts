import z from "zod"

export const RestartUnavailableReason = z.enum(["handler_unavailable", "managed_parent", "init_process", "containing_job", "ownership_unobservable", "helper_protocol_unavailable"])
export type RestartUnavailableReason = z.infer<typeof RestartUnavailableReason>
export type RestartAvailability = { available: true } | { available: false; reason: RestartUnavailableReason; message: string }
export type RestartHandler = {
  availability(): Promise<RestartAvailability>
  execute(reason: string): Promise<void>
}

let restartHandler: RestartHandler | null = null

export function serverRestartHandler() {
  return restartHandler
}

export function registerServerRestartHandler(handler: RestartHandler) {
  restartHandler = handler
}

export function clearServerRestartHandler(handler?: RestartHandler) {
  if (!handler || restartHandler === handler) restartHandler = null
}
