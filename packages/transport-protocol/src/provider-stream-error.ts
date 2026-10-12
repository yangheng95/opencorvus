/** Decode a typed Provider stream error without inferring HTTP status or replay safety. */
export function decodeProviderStreamError(input: unknown): {
  body: Record<string, unknown>
  code?: string
  type?: string
  message?: string
} | undefined {
  let value = input
  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch {
      return
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const body = value as Record<string, unknown>
  if (body.type !== "error") return
  const nested = body.error
  const error = nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : body
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined
  const code = text(error.code)
  const type = error === body ? undefined : text(error.type)
  const message = text(error.message)
  if (!code && !type && !message) return
  return { body, code, type, message }
}
