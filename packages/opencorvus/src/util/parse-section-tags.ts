/**
 * Extract the content of a named section tag from text.
 * Matches `<tag>content</tag>` (case-insensitive, multiline).
 * Returns null if the tag is not found.
 */
export function extractTag(text: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i")
  const m = text.match(re)
  return m ? m[1].trim() : null
}
