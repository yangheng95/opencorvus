export type DurableExecutionResult = { kind: "json"; value: unknown } | { kind: "undefined" }

export function durableExecutionResult(result: unknown): { payload: DurableExecutionResult } {
  const payload: DurableExecutionResult = result === undefined ? { kind: "undefined" } : { kind: "json", value: result }
  const serialized = JSON.stringify(payload)
  if (serialized === undefined) throw new Error("Tool result cannot be durably represented")
  return { payload: JSON.parse(serialized) as DurableExecutionResult }
}

export function resultFromDurable<T = unknown>(stored: unknown): T {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    throw new Error("Durable Tool result has an invalid envelope")
  }
  const payload = stored as Partial<DurableExecutionResult>
  if (payload.kind === "undefined") return undefined as T
  if (payload.kind === "json" && "value" in payload) return payload.value as T
  throw new Error("Durable Tool result has an unknown envelope")
}
