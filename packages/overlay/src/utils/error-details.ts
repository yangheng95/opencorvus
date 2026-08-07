/**
 * Render a thrown value into a multi-line detail string suitable for the
 * notification's collapsible details block. Pulls stack, and when the error is
 * an ApiError, the HTTP status, path, and response body.
 */
export function formatErrorDetails(err: unknown): string {
  if (err == null) return ""
  if (err instanceof Error) {
    const parts: string[] = []
    const meta = err as Error & { status?: unknown; path?: unknown; body?: unknown }
    if (typeof meta.status === "number" && typeof meta.path === "string") {
      parts.push(`HTTP ${meta.status} ${meta.path}`)
    }
    parts.push(err.stack || `${err.name}: ${err.message}`)
    if (meta.body !== undefined) {
      let rendered: string
      try {
        rendered = typeof meta.body === "string" ? meta.body : JSON.stringify(meta.body, null, 2)
      } catch {
        rendered = String(meta.body)
      }
      if (rendered) parts.push(`response body:\n${rendered}`)
    }
    return parts.join("\n\n")
  }
  if (typeof err === "string") return err
  try {
    return JSON.stringify(err, null, 2)
  } catch {
    return String(err)
  }
}
