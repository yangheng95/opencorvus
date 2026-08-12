let requestDrain: (() => void) | undefined

export function installSchedulerMessageDrainSignal(request: () => void): void {
  requestDrain = request
}

export function signalSchedulerMessageDrain(): void {
  requestDrain?.()
}
