function diagnosticString(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  try {
    return String(JSON.stringify(value) ?? value)
  } catch {
    return String(value)
  }
}

/**
 * Bound and redact free-form text before it enters a clipboard diagnostic.
 * Structured identifiers and paths should stay outside this helper so their
 * provenance remains explicit; provider/process error prose must always pass
 * through it because the bundle invites transfer to another system.
 */
export function boundedDebugText(value: unknown, limit = 240): string {
  const text = diagnosticString(value)
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/gi, "[private key redacted]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, "$1[credentials-redacted]@")
    .replace(/\bbearer\s+[a-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\bbasic\s+[a-z0-9+/=]+/gi, "Basic [redacted]")
    .replace(
      /\b(?:sk-(?:proj-|ant-)?[a-z0-9_-]{8,}|github_pat_[a-z0-9_]{20,}|gh[pousr]_[a-z0-9]{20,})\b/gi,
      "[token redacted]",
    )
    .replace(
      /\b(?:xox[baprs]-[a-z0-9-]{10,}|AIza[a-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/g,
      "[credential redacted]",
    )
    .replace(/\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/gi, "[jwt redacted]")
    .replace(
      /(["']?(?:authorization|api[_-]?key|access[_-]?key|account[_-]?key|shared[_-]?access[_-]?signature|token|password|passwd|secret|credential)["']?\s*[:=]\s*)(?:["'][^"']*["']|[^\s,;}&]+)/gi,
      "$1[redacted]",
    )
    .replace(/\s+/g, " ")
    .trim()
  return text.slice(0, Math.max(0, limit))
}

/** Match project identity without erasing case on POSIX case-sensitive paths. */
export function normalizeDebugDirectory(value: unknown): string {
  const raw = String(value ?? "").trim()
  const windowsPath = /^[a-z]:[\\/]/i.test(raw) || /^\\\\/.test(raw) || /^\/\/[^/]/.test(raw)
  const normalized = raw.replace(/\\/g, "/")
  const withoutTrailingSlash = normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized
  return windowsPath ? withoutTrailingSlash.toLowerCase() : withoutTrailingSlash
}
