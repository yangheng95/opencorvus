export function entries<T extends Record<string, unknown>>(input: T) {
  return Object.entries(input) as Array<[Extract<keyof T, string>, T[Extract<keyof T, string>]]>
}

export function values<T extends Record<string, unknown>>(input: T) {
  return Object.values(input) as Array<T[Extract<keyof T, string>]>
}

/**
 * Safely coerce an unknown value to a Record<string, unknown>.
 * Returns an empty object if the value is not a plain object.
 */
export function dict(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>
  }
  return {}
}
