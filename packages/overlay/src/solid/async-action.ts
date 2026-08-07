import { createSignal, type Accessor } from "solid-js"

export interface AsyncAction<Args extends unknown[], Result> {
  /** Reactive pending flag for UI disable / spinner state. */
  pending: Accessor<boolean>
  /** Wrap an async operation with consistent pending lifecycle. */
  run: (...args: Args) => Promise<Result>
}

export function useAsyncAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result> | Result,
): AsyncAction<Args, Result> {
  const [pending, setPending] = createSignal(false)

  return {
    pending,
    run: async (...args: Args) => {
      setPending(true)
      try {
        return await action(...args)
      } finally {
        setPending(false)
      }
    },
  }
}
