type RestartHandler = (reason: string) => Promise<void>

let restartHandler: RestartHandler | null = null

export function canRestartServer() {
  return restartHandler !== null
}

export function registerServerRestartHandler(handler: RestartHandler) {
  restartHandler = handler
}

export function clearServerRestartHandler(handler?: RestartHandler) {
  if (!handler || restartHandler === handler) restartHandler = null
}

export async function startServerRestart(reason: string) {
  const handler = restartHandler
  if (!handler) return false
  await handler(reason)
  return true
}
