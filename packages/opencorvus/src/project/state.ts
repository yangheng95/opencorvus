import { Log } from "@/util/log"
import { lifecycleError } from "./lifecycle-error"

export namespace State {
  export type Accessor<S> = (() => S) & {
    reset(): Promise<void>
    resetAll(): Promise<void>
    inspectAll(): ReadonlyArray<Readonly<{ key: string; state: S }>>
  }

  interface Entry {
    state: any
    dispose?: (state: any) => Promise<void>
    label: string
    disposal?: Promise<void>
  }

  const log = Log.create({ service: "state" })
  const recordsByKey = new Map<string, Map<any, Entry>>()
  const keyDisposals = new Map<string, Promise<void>>()
  const initDisposals = new Map<unknown, Promise<void>>()

  type EntryTarget = {
    key: string
    init: unknown
    entry: Entry
  }

  function removeEntry(key: string, init: unknown, entry: Entry) {
    const entries = recordsByKey.get(key)
    if (!entries || entries.get(init) !== entry) return
    entries.delete(init)
    if (entries.size === 0) recordsByKey.delete(key)
  }

  async function resolveEntryState(key: string, init: unknown, entry: Entry) {
    const label = entry.label
    return Promise.resolve(entry.state).catch((error) => {
      const failure = lifecycleError(error, `State ${label} initialization for key ${key}`)
      log.error("Error while resolving state during disposal:", { error: failure, key, init: label })
      throw failure
    })
  }

  function disposeEntry(key: string, init: unknown, entry: Entry, detachWithoutDisposer = false) {
    if (entry.disposal) return entry.disposal

    const operation = Promise.resolve().then(async () => {
      log.debug("state entry disposal started", { key, state: entry.label })
      try {
        if (!entry.dispose && detachWithoutDisposer) {
          removeEntry(key, init, entry)
          void Promise.resolve(entry.state).catch((error) => {
            log.error("Detached state initialization failed after cache reset:", {
              error: lifecycleError(error, `State ${entry.label} detached initialization for key ${key}`),
              key,
              init: entry.label,
            })
          })
          return
        }
        const state = await resolveEntryState(key, init, entry)
        if (entry.dispose) {
          await entry.dispose(state).catch((error) => {
            const failure = lifecycleError(error, `State ${entry.label} disposal for key ${key}`)
            log.error("Error while disposing state:", { error: failure, key, init: entry.label })
            throw failure
          })
        }
        removeEntry(key, init, entry)
      } finally {
        log.debug("state entry disposal finished", { key, state: entry.label })
      }
    })
    entry.disposal = operation
    const release = () => {
      if (entry.disposal === operation) entry.disposal = undefined
    }
    void operation.then(release, release)
    return operation
  }

  async function disposeTargets(targets: EntryTarget[], detachWithoutDisposer = false) {
    const results = await Promise.allSettled(
      targets.map((target) => disposeEntry(target.key, target.init, target.entry, detachWithoutDisposer)),
    )
    const errors: Error[] = []
    for (const result of results) {
      if (result.status === "rejected") errors.push(lifecycleError(result.reason, "State entry disposal"))
    }
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) throw new AggregateError(errors, `${errors.length} state entries failed to dispose`)
  }

  function assertAvailable(key: string, init: unknown, entry?: Entry) {
    if (keyDisposals.has(key)) throw new Error(`State key ${key} is being disposed`)
    if (initDisposals.has(init)) throw new Error("State initializer is being reset across all keys")
    if (entry?.disposal) throw new Error(`State ${entry.label} for key ${key} is being disposed`)
  }

  export function create<S>(
    root: () => string,
    init: () => S,
    dispose: ((state: Awaited<S>) => Promise<void>) | undefined,
    label: string,
  ) {
    const fn = (() => {
      const key = root()
      assertAvailable(key, init)
      let entries = recordsByKey.get(key)
      if (!entries) {
        entries = new Map<string, Entry>()
        recordsByKey.set(key, entries)
      }
      const exists = entries.get(init)
      if (exists) {
        assertAvailable(key, init, exists)
        return exists.state as S
      }
      let initialized: S
      try {
        initialized = init()
      } catch (error) {
        if (entries.size === 0 && recordsByKey.get(key) === entries) recordsByKey.delete(key)
        throw lifecycleError(error, `State ${label} initialization for key ${key}`)
      }
      let then: PromiseLike<unknown>["then"] | undefined
      try {
        if (
          initialized !== null &&
          (typeof initialized === "object" || typeof initialized === "function") &&
          typeof (initialized as unknown as PromiseLike<unknown>).then === "function"
        ) {
          then = (initialized as unknown as PromiseLike<unknown>).then
        }
      } catch (error) {
        if (entries.size === 0 && recordsByKey.get(key) === entries) recordsByKey.delete(key)
        throw lifecycleError(error, `State ${label} thenable inspection for key ${key}`)
      }
      const entry: Entry = {
        state: initialized,
        dispose,
        label,
      }
      entries.set(init, entry)
      if (then) {
        const assimilate = then as (
          this: unknown,
          onfulfilled: (value: unknown) => unknown,
          onrejected: (reason: unknown) => unknown,
        ) => unknown
        entry.state = new Promise<unknown>((resolve, reject) => assimilate.call(initialized, resolve, reject)).catch(
          (error) => {
            removeEntry(key, init, entry)
            throw lifecycleError(error, `State ${label} initialization for key ${key}`)
          },
        )
      }
      return entry.state as S
    }) as Accessor<S>
    fn.reset = async () => {
      const key = root()
      const entries = recordsByKey.get(key)
      const entry = entries?.get(init)
      if (!entries || !entry) return
      await disposeTargets([{ key, init, entry }], true)
    }
    fn.resetAll = async () => {
      const existing = initDisposals.get(init)
      if (existing) return existing

      const operation = (async () => {
        const targets: EntryTarget[] = []
        for (const [key, entries] of recordsByKey) {
          const entry = entries.get(init)
          if (!entry) continue
          targets.push({ key, init, entry })
        }
        await disposeTargets(targets, true)
      })()
      initDisposals.set(init, operation)
      try {
        await operation
      } finally {
        if (initDisposals.get(init) === operation) initDisposals.delete(init)
      }
    }
    fn.inspectAll = () => {
      const snapshot: Array<Readonly<{ key: string; state: S }>> = []
      for (const [key, entries] of recordsByKey) {
        const entry = entries.get(init)
        if (!entry) continue
        snapshot.push({ key, state: entry.state as S })
      }
      return snapshot
    }
    return fn
  }

  export async function dispose(key: string) {
    const existing = keyDisposals.get(key)
    if (existing) return existing

    const entries = recordsByKey.get(key)
    if (!entries) return

    log.info("waiting for state disposal to complete", { key })

    const warning = setTimeout(() => {
      if (!keyDisposals.has(key)) return
      log.warn(
        "state disposal is taking an unusually long time - if it does not complete in a reasonable time, please report this as a bug",
        { key },
      )
    }, 10000)
    warning.unref()

    const operation = (async () => {
      const targets: EntryTarget[] = []
      for (const [init, entry] of entries) {
        targets.push({ key, init, entry })
      }

      await disposeTargets(targets)
    })()
    keyDisposals.set(key, operation)

    try {
      await operation
    } finally {
      clearTimeout(warning)
      if (keyDisposals.get(key) === operation) keyDisposals.delete(key)
    }

    log.info("state disposal completed", { key })
  }
}
