/**
 * AI SDK v5 contract normalization.
 *
 * AI SDK's StreamTextOnChunkCallback types `tool-call.input` as `unknown`:
 * providers are allowed to deliver unparsed arg strings. Early revisions of
 * session-stream consumed `chunk.input` directly into a `z.record(...)` schema
 * field, so the first provider that streamed string-shaped args (observed:
 * OpenAI-compatible gateways under multimodal prompts) caused a Zod throw
 * inside onChunk. We now canonicalize tool-call / tool-result payloads here
 * at the single protocol boundary, and return an explicit failure when the
 * payload cannot be coerced — no silent fallbacks.
 */

export type NormalizedInput = Record<string, unknown>

export type NormalizeResult = { ok: true; value: NormalizedInput } | { ok: false; reason: string; raw: unknown }

function isPlainObject(value: unknown): value is NormalizedInput {
  if (value === null || typeof value !== "object") return false
  if (Array.isArray(value)) return false
  return true
}

/**
 * Normalize a tool-call `input` (or tool-result `input` echo) into a plain
 * object. `null`/`undefined`/`""` → empty object. Plain object → passthrough.
 * String → JSON.parse + object check. Everything else → explicit failure.
 */
export function normalizeToolInput(raw: unknown): NormalizeResult {
  if (raw === undefined || raw === null) return { ok: true, value: {} }
  if (isPlainObject(raw)) return { ok: true, value: raw }
  if (typeof raw === "string") {
    const text = raw.trim()
    if (!text) return { ok: true, value: {} }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      return {
        ok: false,
        reason: `tool-call input is a string but JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`,
        raw,
      }
    }
    if (isPlainObject(parsed)) return { ok: true, value: parsed }
    return {
      ok: false,
      reason: `tool-call input JSON decoded to ${Array.isArray(parsed) ? "array" : typeof parsed}, not an object`,
      raw,
    }
  }
  return {
    ok: false,
    reason: `tool-call input has unexpected type "${typeof raw}" (expected object, string, or nullish)`,
    raw,
  }
}

/**
 * Serialize a tool-result output into the canonical `{ output: string, title,
 * metadata }` triplet expected by SessionProcessor. Matches the logic that
 * used to live inline in session-stream so the normalization rules live in
 * one place.
 */
export interface NormalizedOutput {
  output: string
  title: string | undefined
  metadata: Record<string, unknown>
}

export function normalizeToolOutput(raw: unknown, defaultTitle: string | undefined): NormalizedOutput {
  if (typeof raw === "string") {
    return { output: raw, title: defaultTitle, metadata: {} }
  }
  if (isPlainObject(raw)) {
    const outputField = (raw as { output?: unknown }).output
    const output =
      typeof outputField === "string"
        ? outputField
        : outputField !== undefined
          ? JSON.stringify(outputField)
          : JSON.stringify(raw)
    const titleField = (raw as { title?: unknown }).title
    const title = typeof titleField === "string" ? titleField : defaultTitle
    const metadataField = (raw as { metadata?: unknown }).metadata
    const metadata = isPlainObject(metadataField) ? metadataField : {}
    return { output, title, metadata }
  }
  if (raw === undefined || raw === null) {
    return { output: "", title: defaultTitle, metadata: {} }
  }
  return { output: JSON.stringify(raw), title: defaultTitle, metadata: {} }
}
