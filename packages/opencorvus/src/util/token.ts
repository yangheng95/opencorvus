export namespace Token {
  const CHARS_PER_TOKEN = 4

  export function estimateCharacters(characters: number) {
    if (!Number.isFinite(characters) || characters <= 0) return 0
    return Math.round(characters / CHARS_PER_TOKEN)
  }

  export function estimate(input: string) {
    return estimateCharacters((input || "").length)
  }
}
