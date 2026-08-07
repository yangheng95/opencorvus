// ── Env-var JSON parsing with descriptive errors ──
//
// audit-2026-04-29 W2-V22. Lifted out so a single helper covers
// every place that consumes `JSON.parse(<env-var>)`. Pre-fix the
// bare `JSON.parse` threw "Unexpected token N in JSON at position
// X" with no hint about which env var was at fault; the sidecar
// startup just died and the operator hunted blindly through
// configs. Wrap with a named throw that names the var AND echoes
// the offending value (truncated for safety).

export function parseEnvJson(varName: string, raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    const preview = raw.length > 200 ? raw.slice(0, 200) + "…" : raw
    throw new Error(`${varName} env var is not valid JSON: ${detail}. Got: ${preview}`)
  }
}
