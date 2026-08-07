export function lazy<T>(fn: () => T) {
  let value: T | undefined
  let loaded = false

  return (): T => {
    if (loaded) return value as T
    // audit-2026-04-29 W2-V11 — pre-fix `loaded = true` ran BEFORE
    // the call, so a `fn()` throw left `loaded === true` and every
    // subsequent call returned `value as T === undefined as T`. The
    // first crash was loud (the throw); every subsequent failure
    // was a silent undefined that the caller treated as a real
    // value. Set loaded only after fn() actually returns.
    const next = fn()
    value = next
    loaded = true
    return next
  }
}
