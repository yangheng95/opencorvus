import type { ReadableStreamActivitySettlement } from "./stream-activity"
import type { StreamRequestIdentity } from "../session/stream-request"

export type ProviderRequestContext = Readonly<{
  sessionID: string
  streamRequest: Readonly<StreamRequestIdentity>
}>

export interface ProviderResponseObserver {
  onBind(context?: ProviderRequestContext): void
  onChunk(byteLength: number): void
  onSettlement(settlement: ReadableStreamActivitySettlement): void
  onObservationError(): void
}

export class ProviderResponseObserverConflictError extends Error {
  override readonly name = "ProviderResponseObserverConflictError"
  readonly code = "PROVIDER_RESPONSE_OBSERVER_CONFLICT"

  constructor() {
    super("Provider Response already has an observation owner.")
  }
}

const observers = new WeakMap<Response, ProviderResponseObserver>()

/** Bind diagnostics to the exact Response without consuming its body. */
export function registerProviderResponseObserver(response: Response, observer: ProviderResponseObserver): void {
  if (observers.has(response)) throw new ProviderResponseObserverConflictError()
  const onObservationError = () => {
    try {
      observer.onObservationError()
    } catch {
      // Diagnostic failure cannot replace the physical stream's result.
    }
  }
  const forward = (callback: () => void) => {
    try {
      callback()
    } catch {
      onObservationError()
    }
  }
  observers.set(response, {
    onBind: (context) => forward(() => observer.onBind(context)),
    onChunk: (byteLength) => forward(() => observer.onChunk(byteLength)),
    onSettlement: (settlement) => forward(() => observer.onSettlement(settlement)),
    onObservationError,
  })
}

/** Consume only this object binding; the existing reader owner performs onBind. */
export function takeProviderResponseObserver(response: Response): ProviderResponseObserver | undefined {
  const observer = observers.get(response)
  observers.delete(response)
  return observer
}
