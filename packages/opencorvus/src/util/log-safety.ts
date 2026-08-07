// ── Log safety helpers ──
//
// audit-2026-04-29 W2-V17. Lifted out of `log.ts` so the safety
// boundaries can be unit-tested without poking at process.stderr or
// the file-stream sink.

/**
 * `JSON.stringify` on a circular object throws TypeError. Pre-fix,
 * logging an extra tag whose value cycled (axios error referencing
 * its own request, solid-store node referencing its parent) bubbled
 * the throw up through `build()` and crashed the very logger.error
 * call that was supposed to record the failure.
 *
 * Replace cyclic references with the string "[Circular]". Render
 * BigInt as `<n>n` (engine-native suffix), function as
 * `[Function: name]`. Any other stringify failure (rare:
 * Symbol-as-key edge, very deep nesting hitting platform limits)
 * surfaces as `[unstringifiable: <ErrorName>]` rather than
 * re-throwing.
 */
export function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  try {
    return (
      JSON.stringify(value, (_key, v) => {
        if (typeof v === "object" && v !== null) {
          if (seen.has(v)) return "[Circular]"
          seen.add(v)
        }
        if (typeof v === "bigint") return `${v.toString()}n`
        if (typeof v === "function") return `[Function: ${v.name || "anonymous"}]`
        return v
      }) ?? "undefined"
    )
  } catch (err) {
    return `[unstringifiable: ${err instanceof Error ? err.name : "unknown"}]`
  }
}

/**
 * Log-injection guard. Pre-fix, a user-controlled message containing
 * `\n` (or worse, ANSI / CR) split across multiple visible log lines,
 * masking malicious input as synthetic log entries that ops dashboards
 * then parsed as legitimate. Replace control chars with their `\xNN`
 * form so each log call produces exactly one physical line.
 *
 * The character class explicitly EXCLUDES `\n` (0x0a) from being
 * preserved — even though logger appends its own trailing `\n`, the
 * sanitised output must not contain mid-message newlines.
 */
export function sanitizeMessage(input: unknown): string {
  const s = typeof input === "string" ? input : String(input)
  return s.replace(/[\x00-\x1f\x7f]/g, (ch) => "\\x" + ch.charCodeAt(0).toString(16).padStart(2, "0"))
}
