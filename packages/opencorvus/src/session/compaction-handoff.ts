/**
 * Compaction summaries are ordinary visible assistant messages. This helper
 * identifies the maintenance boundary without assigning a second structured
 * state snapshot or domain-specific handoff payload to the message.
 */
export namespace CompactionHandoff {
  export function isValidSummaryMessage(message: {
    role: string
    summary?: boolean
    finish?: unknown
    error?: unknown
    structured?: unknown
  }) {
    return (
      message.role === "assistant" &&
      message.summary === true &&
      typeof message.finish === "string" &&
      message.finish.length > 0 &&
      !message.error &&
      message.structured === undefined
    )
  }
}
