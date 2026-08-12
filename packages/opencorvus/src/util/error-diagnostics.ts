const MAX_ERROR_DEPTH = 6
const MAX_AGGREGATE_CHILDREN = 16

export type ErrorDiagnostic = {
  name: string
  message: string
  stack?: string
  code?: string | number
  cause?: ErrorDiagnostic
  errors?: ErrorDiagnostic[]
  truncatedErrors?: number
}

function errorName(value: unknown): string {
  if (value && typeof value === "object" && typeof (value as { name?: unknown }).name === "string") {
    return (value as { name: string }).name
  }
  return value instanceof Error ? value.constructor.name : "NonError"
}

export function errorDiagnostic(value: unknown, depth = 0, seen = new Set<unknown>()): ErrorDiagnostic {
  const message = value instanceof Error ? value.message : String(value)
  const diagnostic: ErrorDiagnostic = { name: errorName(value), message }
  if (!value || typeof value !== "object" || depth >= MAX_ERROR_DEPTH || seen.has(value)) return diagnostic
  seen.add(value)

  const source = value as { stack?: unknown; code?: unknown; cause?: unknown }
  if (typeof source.stack === "string") diagnostic.stack = source.stack
  if (typeof source.code === "string" || typeof source.code === "number") diagnostic.code = source.code
  if (source.cause !== undefined && source.cause !== value) {
    diagnostic.cause = errorDiagnostic(source.cause, depth + 1, seen)
  }
  if (value instanceof AggregateError) {
    const children = Array.from(value.errors)
    diagnostic.errors = children
      .slice(0, MAX_AGGREGATE_CHILDREN)
      .map((child) => errorDiagnostic(child, depth + 1, seen))
    if (children.length > MAX_AGGREGATE_CHILDREN) {
      diagnostic.truncatedErrors = children.length - MAX_AGGREGATE_CHILDREN
    }
  }
  return diagnostic
}
