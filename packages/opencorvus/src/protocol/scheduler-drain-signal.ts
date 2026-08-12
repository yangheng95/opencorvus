let requestDrain: (() => void) | undefined
const observers = new Set<() => void>()

export function installSchedulerMessageDrainSignal(request: () => void): Disposable {
  const previous = requestDrain
  requestDrain = request
  return {
    [Symbol.dispose]() {
      if (requestDrain === request) requestDrain = previous
    },
  }
}

export function signalSchedulerMessageDrain(): void {
  for (const observer of observers) observer()
  requestDrain?.()
}

export function observeSchedulerMessageDrainSignal(observer: () => void): Disposable {
  observers.add(observer)
  return {
    [Symbol.dispose]() {
      observers.delete(observer)
    },
  }
}
