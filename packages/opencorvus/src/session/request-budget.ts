import { asSchema, type ModelMessage, type Tool as AITool } from "ai"
import { Token } from "@/util/token"

/** One deterministic estimate for ordinary, compaction and final transformed requests. */
export namespace RequestBudget {
  export function estimateToolPayload(tools: Record<string, AITool>): { chars: number; tokensEst: number } {
    let chars = 0
    let tokensEst = 0
    for (const [name, item] of Object.entries(tools)) {
      const description =
        typeof (item as { description?: unknown }).description === "string"
          ? (item as { description: string }).description
          : ""
      let schemaText = ""
      const inputSchema = (item as { inputSchema?: unknown }).inputSchema
      if (inputSchema !== undefined && inputSchema !== null) {
        const jsonSchemaPayload = asSchema(inputSchema as never).jsonSchema
        schemaText = JSON.stringify(jsonSchemaPayload ?? {})
      }
      chars += name.length + description.length + schemaText.length
      tokensEst += Token.estimate(name) + Token.estimate(description) + Token.estimate(schemaText)
    }
    return { chars, tokensEst }
  }

  type MediaKind = "image" | "pdf" | "audio" | "video"

  export type ModelMessagePayloadEstimate = {
    messagePayloadChars: number
    /** Script-aware token estimate for the same serialized payload. `chars` stays
     *  for operator-facing diagnostics; every budget comparison uses this. */
    messagePayloadTokensEst: number
    mediaCounts: Record<MediaKind, number>
    mediaTokensEst: number
  }

  const MEDIA_TOKENS_PER_PART: Record<MediaKind, number> = {
    image: 1_600,
    pdf: 3_200,
    audio: 1_600,
    video: 1_600,
  }

  function mediaKindFromMime(mime: unknown): MediaKind | undefined {
    if (typeof mime !== "string") return undefined
    const normalized = mime.toLowerCase()
    if (normalized.startsWith("image/")) return "image"
    if (normalized === "application/pdf") return "pdf"
    if (normalized.startsWith("audio/")) return "audio"
    if (normalized.startsWith("video/")) return "video"
    return undefined
  }

  function mediaKindFromDataUrl(value: unknown): MediaKind | undefined {
    if (typeof value !== "string" || !value.startsWith("data:")) return undefined
    const match = /^data:([^;,]+)/i.exec(value)
    return mediaKindFromMime(match?.[1])
  }

  function mediaKindFromPart(part: Record<string, unknown>): MediaKind | undefined {
    const byMime = mediaKindFromMime(part.mediaType ?? part.mime)
    if (byMime) return byMime

    const type = typeof part.type === "string" ? part.type.toLowerCase() : ""
    if (type === "image" || type === "image-data") return "image"
    if (type === "pdf") return "pdf"

    return (
      mediaKindFromDataUrl(part.url) ??
      mediaKindFromDataUrl(part.data) ??
      mediaKindFromDataUrl(part.image) ??
      mediaKindFromDataUrl(part.media)
    )
  }

  function isMediaPayloadField(key: string): boolean {
    return key === "url" || key === "data" || key === "image" || key === "media"
  }

  /**
   * Estimate text-token pressure without treating inline media bytes as text.
   * AI SDK model messages carry image/PDF/audio/video parts as data URLs, but
   * provider tokenization charges those as media inputs, not as base64 prose.
   * Predictive compaction must therefore sanitize media payload fields before
   * `JSON.stringify(...).length / 4`, then add a bounded per-media budget.
   */
  export function estimateModelMessagePayload(messages: ModelMessage[]): ModelMessagePayloadEstimate {
    const mediaCounts: Record<MediaKind, number> = {
      image: 0,
      pdf: 0,
      audio: 0,
      video: 0,
    }

    const sanitize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(sanitize)

      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>
        const mediaKind = mediaKindFromPart(record)
        if (mediaKind) mediaCounts[mediaKind]++

        const out: Record<string, unknown> = {}
        for (const [key, child] of Object.entries(record)) {
          if (mediaKind && isMediaPayloadField(key)) {
            out[key] = `[${mediaKind} bytes omitted from text-token estimate]`
            continue
          }
          out[key] = sanitize(child)
        }
        return out
      }

      const dataUrlKind = mediaKindFromDataUrl(value)
      if (dataUrlKind) {
        mediaCounts[dataUrlKind]++
        return `[${dataUrlKind} data URL omitted from text-token estimate]`
      }

      return value
    }

    const serialized = JSON.stringify(sanitize(messages))
    const messagePayloadChars = serialized.length
    const messagePayloadTokensEst = Token.estimate(serialized)

    const mediaTokensEst = Object.entries(mediaCounts).reduce(
      (sum, [kind, count]) => sum + MEDIA_TOKENS_PER_PART[kind as MediaKind] * count,
      0,
    )

    return { messagePayloadChars, messagePayloadTokensEst, mediaCounts, mediaTokensEst }
  }

  export function estimate(input: {
    system?: readonly string[]
    messages: ModelMessage[]
    tools?: Record<string, AITool>
  }) {
    const messages = estimateModelMessagePayload(input.messages)
    const tools = estimateToolPayload(input.tools ?? {})
    const systemTokensEst = (input.system ?? []).reduce((total, text) => total + Token.estimate(text), 0)
    return {
      ...messages,
      systemTokensEst,
      toolSchemaTokensEst: tools.tokensEst,
      totalTokensEst: systemTokensEst + tools.tokensEst + messages.messagePayloadTokensEst + messages.mediaTokensEst,
    }
  }
}
