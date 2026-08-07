import { createHash } from "node:crypto"
import type { Message } from "./message"

export function canonicalAssistantMessageContent(parts: readonly Message.Part[]): {
  text: string
  hash: string
} {
  const text = parts
    .filter((part): part is Message.TextPart | Message.ReasoningPart =>
      part.type === "text" || part.type === "reasoning",
    )
    .map((part) => part.text)
    .join("\n\n")
    .trim()
  return {
    text,
    hash: createHash("sha256").update(text).digest("hex"),
  }
}
