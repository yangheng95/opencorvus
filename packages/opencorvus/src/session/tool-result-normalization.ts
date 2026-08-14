export type CanonicalToolResult = {
  output: string
  title: string
  metadata: Record<string, unknown>
  attachments?: unknown
  display?: unknown
  sources?: unknown
}

/**
 * Canonicalise every successful provider-stream Tool result at the persistence
 * boundary. Tool implementations may return a plain string or a richer object,
 * while Message.ToolPart deliberately persists one strict result shape.
 */
export function normalizeToolResult(input: unknown): CanonicalToolResult {
  if (typeof input === "string") return { output: input, title: "", metadata: {} }

  if (input && typeof input === "object") {
    const result = input as Record<string, unknown>
    const output = (() => {
      if (typeof result.output === "string") return result.output
      if (typeof result.text === "string") return result.text
      if (result.output !== undefined) return JSON.stringify(result.output)
      if (result.attachments !== undefined) {
        throw new Error("Tool returned attachments without string output/text")
      }
      return JSON.stringify(result)
    })()
    return {
      ...result,
      output,
      title: typeof result.title === "string" ? result.title : "",
      metadata:
        result.metadata && typeof result.metadata === "object" && !Array.isArray(result.metadata)
          ? (result.metadata as Record<string, unknown>)
          : {},
      ...(result.attachments !== undefined ? { attachments: result.attachments } : {}),
      ...(result.display !== undefined ? { display: result.display } : {}),
      ...(result.sources !== undefined ? { sources: result.sources } : {}),
    }
  }

  return { output: String(input ?? ""), title: "", metadata: {} }
}
