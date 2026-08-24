import { EventEmitter } from "events"
import { Log } from "@/util/log"
import { randomUUID } from "node:crypto"

type GlobalBusEvents = {
  event: [
    {
      directory?: string
      payload: any
    },
  ]
}

const log = Log.create({ service: "global-bus" })

export class DurableBusSubscriptionIdentityConflictError extends Error {
  readonly channel: string
  readonly durableID: string

  constructor(input: { channel: string; durableID: string }) {
    super(`Durable Bus subscription ${input.durableID} is already registered on ${input.channel}`)
    this.name = "DurableBusSubscriptionIdentityConflictError"
    this.channel = input.channel
    this.durableID = input.durableID
  }
}

class GlobalEventBus {
  private readonly emitter = new EventEmitter<GlobalBusEvents>()
  private readonly registrations = new Set<{
    eventName: "event"
    callback: (...args: GlobalBusEvents["event"]) => unknown
    wrapper: (...args: GlobalBusEvents["event"]) => unknown
    id: string
    durable: boolean
    effectContract?: "idempotent_by_occurrence"
    source?: string
  }>()
  private readonly runtimeID = randomUUID()
  private readonly durableListeners = new Map<string, {
    callback: (...args: GlobalBusEvents["event"]) => unknown
    wrapper: (...args: GlobalBusEvents["event"]) => unknown
    id: string
    durable: boolean
    eventName: "event"
    source?: string
  }>()
  private readonly activeDeliveries = new Map<string, {
    occurrenceID: string
    pending: Map<string, { id: string; durable: boolean; source?: string }>
  }>()
  private sequence = 0

  on(
    eventName: "event",
    listener: (...args: GlobalBusEvents["event"]) => unknown | Promise<unknown>,
    options?: { durableID: string; effect: "idempotent_by_occurrence" },
  ): this {
    if (options) {
      const durableKey = `${eventName}\u0000${options.durableID}`
      const existing = this.durableListeners.get(durableKey)
      if (existing && existing.callback !== listener) {
        throw new DurableBusSubscriptionIdentityConflictError({
          channel: `global:${eventName}`,
          durableID: options.durableID,
        })
      }
      if (existing) return this
    }
    const registration = {
      eventName,
      callback: listener,
      wrapper: (...args: GlobalBusEvents["event"]) => listener(...args),
      id: options?.durableID ?? `runtime-global:${this.runtimeID}:${++this.sequence}`,
      durable: options !== undefined,
      effectContract: options?.effect,
      source: new Error().stack
        ?.split("\n")
        .slice(2, 6)
        .map((line) => line.trim())
        .join(" | "),
    }
    this.registrations.add(registration)
    if (options) this.durableListeners.set(`${eventName}\u0000${options.durableID}`, registration)
    this.emitter.on(eventName, registration.wrapper)
    return this
  }

  off(eventName: "event", listener: (...args: GlobalBusEvents["event"]) => unknown | Promise<unknown>): this {
    for (const registration of [...this.registrations]) {
      if (registration.eventName !== eventName || registration.callback !== listener) continue
      this.emitter.off(eventName, registration.wrapper)
      this.registrations.delete(registration)
      if (registration.durable) {
        const durableKey = `${eventName}\u0000${registration.id}`
        if (this.durableListeners.get(durableKey) === registration) this.durableListeners.delete(durableKey)
      }
    }
    return this
  }

  async emit(eventName: "event", ...args: GlobalBusEvents["event"]): Promise<boolean> {
    try {
      return await this.emitAndWait(eventName, ...args)
    } catch (error) {
      log.warn("global bus listener failed", { error: errorMessage(error) })
      return this.emitter.listenerCount(eventName) > 0
    }
  }

  async emitAndWait(eventName: "event", ...args: GlobalBusEvents["event"]): Promise<boolean> {
    const listeners = [...this.registrations].filter((registration) => registration.eventName === eventName)
    const occurrenceID = args[0]?.payload?.occurrenceID
    const deliveryID = randomUUID()
    const pending = typeof occurrenceID === "string"
      ? new Map<string, { id: string; durable: boolean; source?: string }>()
      : undefined
    if (pending) this.activeDeliveries.set(deliveryID, { occurrenceID, pending })
    const settled = await Promise.allSettled(
      listeners.map(async (registration) => {
        pending?.set(registration.id, {
          id: registration.id,
          durable: registration.durable,
          source: registration.source,
        })
        try {
          await Reflect.apply(registration.wrapper, this, args)
        } finally {
          pending?.delete(registration.id)
        }
      }),
    )
    if (pending) this.activeDeliveries.delete(deliveryID)
    const failures = settled
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason)
    if (failures.length > 0) {
      throw new AggregateError(failures, `${failures.length} global bus listener(s) failed`)
    }
    return listeners.length > 0
  }

  deliveryActivitySnapshot(occurrenceID?: string) {
    return [...this.activeDeliveries.entries()]
      .filter(([, delivery]) => occurrenceID === undefined || delivery.occurrenceID === occurrenceID)
      .map(([deliveryID, delivery]) => ({
        delivery_id: deliveryID,
        occurrence_id: delivery.occurrenceID,
        pending: [...delivery.pending.values()].sort((left, right) => left.id.localeCompare(right.id)),
      }))
      .sort(
        (left, right) =>
          left.occurrence_id.localeCompare(right.occurrence_id) || left.delivery_id.localeCompare(right.delivery_id),
      )
  }

  deliveryTargets(eventName: "event") {
    return [...this.registrations].filter((registration) => registration.eventName === eventName).map((registration) => {
      return {
        id: registration.id,
        durable: registration.durable,
        effectContract: registration.effectContract,
        deliver: (...args: GlobalBusEvents["event"]) => Reflect.apply(registration.callback, this, args),
      }
    })
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export const GlobalBus = new GlobalEventBus()
