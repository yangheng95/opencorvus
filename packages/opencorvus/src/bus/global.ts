import { EventEmitter } from "events"
import { Log } from "@/util/log"

type GlobalBusEvents = {
  event: [
    {
      directory?: string
      payload: any
    },
  ]
}

const log = Log.create({ service: "global-bus" })

class GlobalEventBus {
  private readonly emitter = new EventEmitter<GlobalBusEvents>()

  on(eventName: "event", listener: (...args: GlobalBusEvents["event"]) => void): this {
    this.emitter.on(eventName, listener)
    return this
  }

  off(eventName: "event", listener: (...args: GlobalBusEvents["event"]) => void): this {
    this.emitter.off(eventName, listener)
    return this
  }

  async emitAndWait(eventName: "event", ...args: GlobalBusEvents["event"]): Promise<boolean> {
    const listeners = this.emitter.rawListeners(eventName)
    await Promise.all(
      listeners.map(async (listener) => {
        try {
          await Reflect.apply(listener as (...args: GlobalBusEvents["event"]) => unknown, this, args)
        } catch (error) {
          log.warn("global bus listener failed", { error: errorMessage(error) })
        }
      }),
    )
    return listeners.length > 0
  }

  emit(eventName: "event", ...args: GlobalBusEvents["event"]): boolean {
    const listeners = this.emitter.rawListeners(eventName)
    for (const listener of listeners) {
      try {
        const result = Reflect.apply(listener as (...args: GlobalBusEvents["event"]) => unknown, this, args)
        if (isCatchablePromise(result)) {
          void result.catch((error: unknown) => {
            log.warn("global bus listener failed", { error: errorMessage(error) })
          })
        }
      } catch (error) {
        log.warn("global bus listener failed", { error: errorMessage(error) })
      }
    }
    return listeners.length > 0
  }
}

function isCatchablePromise(value: unknown): value is { catch(onRejected: (error: unknown) => unknown): unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "catch" in value &&
    typeof (value as { catch?: unknown }).catch === "function"
  )
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export const GlobalBus = new GlobalEventBus()
