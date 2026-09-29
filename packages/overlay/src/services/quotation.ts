export interface Quotation {
  text: string
  sessionID: string
  messageID: string
}

export function parseQuotation(value: unknown): Quotation | undefined {
  if (!value || typeof value !== "object") return undefined
  const item = value as Record<string, unknown>
  if (
    typeof item.text !== "string" ||
    !item.text.trim() ||
    typeof item.sessionID !== "string" ||
    !item.sessionID ||
    typeof item.messageID !== "string" ||
    !item.messageID
  )
    return undefined
  return { text: item.text, sessionID: item.sessionID, messageID: item.messageID }
}

/** The exact submitted text is also the visible persisted user Message. */
export function quotedPrompt(text: string, quotation?: Quotation): string {
  if (!quotation) return text
  return `${quotation.text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n")}\n\n${text}`
}
