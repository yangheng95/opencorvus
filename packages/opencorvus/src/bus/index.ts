import z from "zod"
import { Log } from "../util/log"
import { createInstanceState } from "../project/instance-state"
import { currentProjectDirectory } from "../project/instance-context"
import { BusEvent } from "./bus-event"
import { GlobalBus } from "./global"
import { isBusTraceEnabled, traceBus } from "../util/debug-trace"

export namespace Bus {
  const log = Log.create({ service: "bus" })
  type Subscription = (event: any) => unknown | Promise<unknown>
  const source = new WeakMap<Subscription, string>()

  export const InstanceDisposed = BusEvent.define(
    "server.instance.disposed",
    z.object({
      directory: z.string(),
    }),
  )

  async function dispatchPhase(
    subscriptions: Map<any, Subscription[]>,
    payload: { type: string; properties: any },
    key: string,
  ) {
    const pending: Array<Promise<unknown>> = []
    let index = 0
    const match = [...(subscriptions.get(key) ?? [])]
    for (const sub of match) {
      if (isBusTraceEnabled()) {
        index += 1
        traceBus({
          phase: "before-dispatch",
          type: payload.type,
          key,
          index,
          source: source.get(sub),
        })
      }
      const label = `${payload.type}/${source.get(sub) ?? "unknown"}`
      let result: unknown
      try {
        result = sub(payload)
      } catch (err) {
        result = Promise.reject(err)
      }
      pending.push(
        Promise.resolve(result).catch((err) => {
          log.warn("subscriber failed", { type: payload.type, label, error: String(err) })
          throw err
        }),
      )
    }
    const settled = await Promise.allSettled(pending)
    const failures = settled
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason)
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) {
      throw new AggregateError(failures, `${failures.length} Bus subscribers failed for ${payload.type}`)
    }
    return settled
  }

  async function dispatchTo(subscriptions: Map<any, Subscription[]>, payload: { type: string; properties: any }) {
    const exact = await dispatchPhase(subscriptions, payload, payload.type)
    if (payload.type === "*") return exact
    const wildcard = await dispatchPhase(subscriptions, payload, "*")
    return [...exact, ...wildcard]
  }

  function dispatch(payload: { type: string; properties: any }) {
    return dispatchTo(state().subscriptions, payload)
  }

  const state = createInstanceState(
    () => {
      const subscriptions = new Map<any, Subscription[]>()

      return {
        subscriptions,
      }
    },
    async (current) => {
      await dispatchTo(current.subscriptions, {
        type: InstanceDisposed.type,
        properties: {
          directory: currentProjectDirectory(),
        },
      })
    },
    "bus",
  )

  function observePublishPromise<T extends Promise<unknown>>(promise: T, type: string): T {
    void promise.catch((err) => {
      log.warn("publish failed", { type, error: err instanceof Error ? err.message : String(err) })
    })
    return promise
  }

  export function publish<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ) {
    try {
      const parsed = BusEvent.parseProperties(def, properties)
      const payload = {
        type: def.type,
        properties: parsed,
      }
      log.debug("publishing", {
        type: def.type,
      })
      const directory = currentProjectDirectory()
      const result = dispatch(payload).then(() => {
        GlobalBus.emit("event", {
          directory,
          payload,
        })
      })
      return observePublishPromise(result, def.type)
    } catch (err) {
      return observePublishPromise(Promise.reject(err), def.type)
    }
  }

  export function subscribe<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: {
      type: Definition["type"]
      properties: z.infer<Definition["properties"]>
    }) => unknown | Promise<unknown>,
  ) {
    return raw(def.type, callback)
  }

  export function subscribeAll(callback: (event: any) => unknown | Promise<unknown>) {
    return raw("*", callback)
  }

  export function subscriptionStats() {
    const subscriptions = state().subscriptions
    let callbacks = 0
    for (const match of subscriptions.values()) callbacks += match.length
    return {
      types: subscriptions.size,
      callbacks,
    }
  }

  export function once<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: {
      type: Definition["type"]
      properties: z.infer<Definition["properties"]>
    }) => unknown | Promise<unknown>,
  ) {
    const unsub = raw(def.type, async (event) => {
      const result = await callback(event)
      if (result === "done") unsub()
    })
    return unsub
  }

  function raw(type: string, callback: (event: any) => unknown | Promise<unknown>) {
    log.debug("subscribing", { type })
    if (isBusTraceEnabled()) {
      const stack = new Error().stack
        ?.split("\n")
        .slice(2, 6)
        .map((x) => x.trim())
        .join(" | ")
      source.set(callback, stack ?? "unknown")
      traceBus({
        phase: "subscribe",
        type,
        callback: callback.name || "anonymous",
        source: stack,
      })
    }
    const subscriptions = state().subscriptions
    let match = subscriptions.get(type) ?? []
    if (!match.includes(callback)) {
      match.push(callback)
      subscriptions.set(type, match)
    }

    return () => {
      log.debug("unsubscribing", { type })
      const match = subscriptions.get(type)
      if (!match) return
      const index = match.indexOf(callback)
      if (index === -1) return
      match.splice(index, 1)
      if (match.length === 0) subscriptions.delete(type)
    }
  }
}
