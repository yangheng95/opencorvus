import { AsyncLocalStorage } from "async_hooks"

export namespace Context {
  export class NotFound extends Error {
    constructor(public override readonly name: string) {
      super(`No context found for ${name}`)
    }
  }

  export function create<T>(name: string) {
    const storage = new AsyncLocalStorage<T | undefined>()
    return {
      use() {
        const result = storage.getStore()
        if (!result) {
          throw new NotFound(name)
        }
        return result
      },
      // Non-throwing accessor: returns undefined when no context is active.
      // Required for ambient consumers that legitimately run both inside and
      // outside a context (e.g. Config resolution runs in session execution
      // AND on the CLI / control plane where no session exists).
      tryUse(): T | undefined {
        return storage.getStore()
      },
      provide<R>(value: T, fn: () => R) {
        return storage.run(value, fn)
      },
      without<R>(fn: () => R) {
        return storage.run(undefined, fn)
      },
    }
  }
}
