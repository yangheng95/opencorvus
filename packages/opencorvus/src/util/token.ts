export namespace Token {
  /**
   * Latin prose averages roughly four characters per byte-pair token.
   */
  const CHARS_PER_TOKEN_LATIN = 4

  /**
   * Han, Kana, and Hangul write without word separators and carry close to one
   * morpheme per character, so a byte-pair tokenizer merges at most a short
   * word into a single token. Charging them at the Latin ratio underestimates a
   * Chinese prompt by roughly a factor of three, and that is the direction that
   * silently overruns a context budget instead of compacting early.
   */
  const CHARS_PER_TOKEN_DENSE = 1.5

  function isDenseScript(code: number): boolean {
    return (
      (code >= 0x3000 && code <= 0x30ff) || // CJK symbols and punctuation, Hiragana, Katakana
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Unified Ideographs Extension A
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
      (code >= 0xac00 && code <= 0xd7af) || // Hangul syllables
      (code >= 0x1100 && code <= 0x11ff) || // Hangul Jamo
      (code >= 0xff00 && code <= 0xffef) || // Halfwidth and fullwidth forms
      (code >= 0x20000 && code <= 0x3ffff) //  CJK Unified Ideographs Extension B and later
    )
  }

  /**
   * Split a string into the two density classes the estimate distinguishes.
   * Exported so a caller that already walks text once can accumulate counts
   * without re-scanning, and so the split itself is directly testable.
   */
  export function countScripts(input: string): { dense: number; latin: number } {
    let dense = 0
    let latin = 0
    for (let index = 0; index < input.length; ) {
      const code = input.codePointAt(index)!
      if (isDenseScript(code)) dense += 1
      else latin += 1
      index += code > 0xffff ? 2 : 1
    }
    return { dense, latin }
  }

  export function estimate(input: string): number {
    if (!input) return 0
    const { dense, latin } = countScripts(input)
    return Math.round(dense / CHARS_PER_TOKEN_DENSE + latin / CHARS_PER_TOKEN_LATIN)
  }

  /**
   * Character-count fallback for the few call sites that only carry a length.
   * It necessarily assumes Latin density and therefore underestimates dense
   * scripts; prefer `estimate(text)` wherever the text itself is in hand.
   */
  export function estimateCharacters(characters: number) {
    if (!Number.isFinite(characters) || characters <= 0) return 0
    return Math.round(characters / CHARS_PER_TOKEN_LATIN)
  }
}
