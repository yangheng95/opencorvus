/** Canonical Browser Preview URL identity. WHATWG URL serialization
 * normalizes scheme and host while preserving the case-sensitive
 * path, query, and fragment components. */
export function canonicalBrowserPreviewUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const raw = value.trim()
  if (!raw) return undefined
  const text = normalizeSchemeLessLoopbackUrl(raw) ?? raw
  try {
    const url = new URL(text)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

function normalizeSchemeLessLoopbackUrl(text: string): string | undefined {
  const match = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d{1,5})(\/[^\s]*)?$/i.exec(text)
  if (!match) return undefined
  const port = Number(match[2])
  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined
  return `http://${match[1]}:${port}${match[3] ?? "/"}`
}
