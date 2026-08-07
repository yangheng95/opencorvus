/**
 * Vendor-specific message normalization registry.
 *
 * Design (per specs/current/architecture/06-provider.md Path 3): vendor-specific behavior
 * belongs in vendor modules, not in the shared transform layer. Each entry
 * is a pure function keyed by a model-matcher predicate. Adding a new
 * vendor's quirk means appending one entry here — `ProviderTransform.message()`
 * stays a vendor-agnostic dispatcher.
 *
 * Two stages:
 *
 *   1. PRE_NORMALIZERS — run in array order, every matching entry applies.
 *      Used for cross-cutting cleanup (e.g. Anthropic rejects empty-content
 *      messages, which is a preprocessing step that composes with whatever
 *      terminal normalization follows).
 *
 *   2. TERMINAL_NORMALIZERS — first match wins, returns the final message
 *      shape. Used when the vendor has a self-contained tool-call format
 *      that conflicts with other normalizers (Claude vs Mistral tool IDs,
 *      interleaved reasoning for Qwen-style models).
 */
import type { ModelMessage } from "ai"
import type { ProviderModel } from "./model-schema"

type NormalizeMessages = (msgs: ModelMessage[], model: ProviderModel) => ModelMessage[]

interface NormalizerEntry {
  /** Human-readable tag (used only in errors/logs). */
  tag: string
  /** Model matcher — returns true if this normalizer should apply. */
  match: (model: ProviderModel) => boolean
  /** Pure transform. */
  normalize: NormalizeMessages
}

// ────────── individual normalizers ──────────

const anthropicFilterEmpty: NormalizeMessages = (msgs) => {
  // Anthropic rejects messages whose content is empty string or whose content
  // array has no non-empty text/reasoning parts. Drop them.
  return msgs
    .map((msg) => {
      if (typeof msg.content === "string") {
        if (msg.content === "") return undefined
        return msg
      }
      if (!Array.isArray(msg.content)) return msg
      const filtered = msg.content.filter((part) => {
        if (part.type === "text" || part.type === "reasoning") {
          return part.text !== ""
        }
        return true
      })
      if (filtered.length === 0) return undefined
      return { ...msg, content: filtered }
    })
    .filter((msg): msg is ModelMessage => msg !== undefined && msg.content !== "")
}

const claudeSanitizeToolCallIds: NormalizeMessages = (msgs) => {
  // Claude tool IDs must be [a-zA-Z0-9_-]; replace everything else with `_`.
  const toolCallIDs = uniqueToolCallIDs(msgs)
  const normalizedIDs = normalizeUniqueToolCallIDs(toolCallIDs, claudeToolCallIDCandidate)
  return msgs.map((msg) => {
    if ((msg.role === "assistant" || msg.role === "tool") && Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map((part) => {
          const toolCallId = toolPartCallID(part)
          if (toolCallId) {
            return { ...part, toolCallId: normalizedIDs.get(toolCallId) ?? claudeToolCallIDCandidate(toolCallId) }
          }
          return part
        }),
      }
    }
    return msg
  })
}

function claudeToolCallIDCandidate(toolCallID: string): string {
  return toolCallID.replace(/[^a-zA-Z0-9_-]/g, "_") || "call"
}

function isTextOnlyAssistant(msg: ModelMessage) {
  if (msg.role !== "assistant") return false
  if (typeof msg.content === "string") return msg.content.length > 0
  if (!Array.isArray(msg.content) || msg.content.length === 0) return false
  return msg.content.every((part) => part.type === "text" && part.text.length > 0)
}

const mistralToolCallIdPadAndSeq: NormalizeMessages = (msgs) => {
  // Mistral tool IDs must be exactly 9 alphanumeric characters; pad/truncate.
  const toolCallIDs = uniqueToolCallIDs(msgs)
  const normalizedIDs = normalizeUniqueToolCallIDs(toolCallIDs, mistralToolCallIDCandidate, mistralCollisionToolCallID)
  return msgs.map((msg) => {
    if ((msg.role === "assistant" || msg.role === "tool") && Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map((part) => {
          const toolCallId = toolPartCallID(part)
          if (toolCallId) {
            return { ...part, toolCallId: normalizedIDs.get(toolCallId) ?? mistralToolCallIDCandidate(toolCallId) }
          }
          return part
        }),
      }
    }
    return msg
  })
}

function uniqueToolCallIDs(msgs: ModelMessage[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const msg of msgs) {
    if ((msg.role !== "assistant" && msg.role !== "tool") || !Array.isArray(msg.content)) continue
    for (const part of msg.content) {
      const toolCallId = toolPartCallID(part)
      if (!toolCallId || seen.has(toolCallId)) continue
      seen.add(toolCallId)
      result.push(toolCallId)
    }
  }
  return result
}

function toolPartCallID(part: unknown): string | undefined {
  if (!part || typeof part !== "object" || Array.isArray(part)) return undefined
  const record = part as Record<string, unknown>
  if (record.type !== "tool-call" && record.type !== "tool-result") return undefined
  return typeof record.toolCallId === "string" && record.toolCallId.length > 0 ? record.toolCallId : undefined
}

function normalizeUniqueToolCallIDs(
  originals: string[],
  candidateFor: (toolCallID: string) => string,
  collisionCandidateFor: (toolCallID: string, salt: number) => string = defaultCollisionToolCallID,
): Map<string, string> {
  const normalized = new Map<string, string>()
  const ownerByNormalized = new Map<string, string>()

  for (const original of originals) {
    let candidate = candidateFor(original)
    if (ownerByNormalized.has(candidate) && ownerByNormalized.get(candidate) !== original) {
      for (let salt = 0; ; salt += 1) {
        candidate = collisionCandidateFor(original, salt)
        const owner = ownerByNormalized.get(candidate)
        if (!owner || owner === original) break
      }
    }
    normalized.set(original, candidate)
    ownerByNormalized.set(candidate, original)
  }

  return normalized
}

function defaultCollisionToolCallID(toolCallID: string, salt: number): string {
  return `${claudeToolCallIDCandidate(toolCallID)}_${stableBase36(`${toolCallID}:${salt}`).slice(0, 6)}`
}

function mistralToolCallIDCandidate(toolCallID: string): string {
  return toolCallID
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 9)
    .padEnd(9, "0")
}

function mistralCollisionToolCallID(toolCallID: string, salt: number): string {
  const prefix = toolCallID
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 4)
    .padEnd(4, "0")
  return `${prefix}${stableBase36(`${toolCallID}:${salt}`).slice(0, 5).padStart(5, "0")}`.substring(0, 9)
}

function stableBase36(value: string): string {
  let hash = 2_166_136_261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16_777_619) >>> 0
  }
  return hash.toString(36)
}

const claudeDropAssistantPrefillTail: NormalizeMessages = (msgs) => {
  // Claude-like providers reject assistant prefill: the request must end in a
  // user/tool turn, not a text-only assistant narration tail.
  const last = msgs[msgs.length - 1]
  if (!last) return msgs
  if (!isTextOnlyAssistant(last)) return msgs
  return msgs.slice(0, -1)
}

const claudeNormalize: NormalizeMessages = (msgs, model) => {
  return claudeDropAssistantPrefillTail(claudeSanitizeToolCallIds(msgs, model), model)
}

const interleavedReasoning: NormalizeMessages = (msgs, model) => {
  // For models that carry reasoning inline in the assistant message via a
  // provider-specific field (qwen: reasoning_content, etc.), extract the
  // reasoning parts into that field and strip them from the content array.
  if (typeof model.capabilities.interleaved !== "object") return msgs
  const field = model.capabilities.interleaved.field
  if (!field) return msgs
  return msgs.map((msg) => {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      const contentWithInlineThink = msg.content
      const reasoningParts = contentWithInlineThink.filter((part: any) => part.type === "reasoning")
      const reasoningText = reasoningParts.map((part: any) => part.text).join("")
      const existingReasoningText = (msg.providerOptions as any)?.openaiCompatible?.[field]
      const filteredContent = contentWithInlineThink.filter((part: any) => part.type !== "reasoning")

      return {
        ...msg,
        content: filteredContent,
        providerOptions: {
          ...msg.providerOptions,
          openaiCompatible: {
            ...(msg.providerOptions as any)?.openaiCompatible,
            [field]: reasoningParts.length > 0 ? reasoningText : (existingReasoningText ?? ""),
          },
        },
      }
    }
    return msg
  })
}

// ────────── registries ──────────

const PRE_NORMALIZERS: NormalizerEntry[] = [
  {
    tag: "anthropic-filter-empty",
    match: (m) => m.api.npm === "@ai-sdk/anthropic",
    normalize: anthropicFilterEmpty,
  },
]

const TERMINAL_NORMALIZERS: NormalizerEntry[] = [
  {
    tag: "claude-tool-ids",
    match: (m) => m.api.id.includes("claude"),
    normalize: claudeNormalize,
  },
  {
    tag: "mistral-tool-ids-and-seq",
    match: (m) =>
      m.providerID === "mistral" ||
      m.api.id.toLowerCase().includes("mistral") ||
      m.api.id.toLowerCase().includes("devstral"),
    normalize: mistralToolCallIdPadAndSeq,
  },
  {
    tag: "interleaved-reasoning",
    match: (m) =>
      m.api.npm !== "@openrouter/ai-sdk-provider" &&
      typeof m.capabilities.interleaved === "object" &&
      !!m.capabilities.interleaved.field,
    normalize: interleavedReasoning,
  },
]

/**
 * Apply vendor-specific message normalization. Pre-normalizers all run; the
 * first matching terminal normalizer is used (its output is returned). If no
 * terminal normalizer matches, the (possibly pre-normalized) messages pass
 * through unchanged.
 */
export function normalizeVendorMessages(msgs: ModelMessage[], model: ProviderModel): ModelMessage[] {
  let current = msgs
  for (const entry of PRE_NORMALIZERS) {
    if (entry.match(model)) current = entry.normalize(current, model)
  }
  for (const entry of TERMINAL_NORMALIZERS) {
    if (entry.match(model)) return entry.normalize(current, model)
  }
  return current
}
