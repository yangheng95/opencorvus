import { redactInlinePayloads } from "@/util/inline-base64"

function redactValue(value: unknown, memo: WeakMap<object, unknown>, ancestors: WeakSet<object>): unknown {
  if (typeof value === "string") return redactInlinePayloads(value)
  if (!value || typeof value !== "object") return value
  if (ancestors.has(value)) throw new Error("Tool diagnostic metadata must not contain cyclic values")
  const memoized = memo.get(value)
  if (memoized !== undefined) return memoized
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const output: unknown[] = []
      memo.set(value, output)
      for (const item of value) output.push(redactValue(item, memo, ancestors))
      return output
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      const toJSON = (value as { toJSON?: unknown }).toJSON
      if (typeof toJSON !== "function") {
        throw new Error("Tool diagnostic metadata must contain only JSON-serializable values")
      }
      return redactValue(toJSON.call(value), memo, ancestors)
    }
    const output: Record<string, unknown> = {}
    memo.set(value, output)
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = redactValue(item, memo, ancestors)
    }
    return output
  } finally {
    ancestors.delete(value)
  }
}

export function redactToolDiagnosticValue<T>(value: T): T {
  return redactValue(value, new WeakMap(), new WeakSet()) as T
}
