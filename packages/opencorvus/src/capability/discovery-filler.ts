/**
 * Language data for capability discovery scoring — deliberately not part of the
 * scoring algorithm.
 *
 * Conversational requests carry function words that no package vocabulary
 * distinguishes: "一个" and "帮我" appear in almost every Chinese sentence, so a
 * character run made only of them is evidence of Chinese, not of relevance.
 * Hiragana plays the same grammatical role in Japanese.
 *
 * Keeping the table here rather than inline in `fuzzy.ts` means extending it —
 * or adding the Hangul equivalent, which `SEPARATORLESS_SCRIPT` already matches
 * but which has no entry below — is a data edit, not an edit to a scoring
 * function whose constants nothing currently validates.
 */

/**
 * Chinese function words. A run is dropped only when every one of its
 * characters appears here, which keeps compounds such as "个人" or "有效" intact.
 */
export const SEPARATORLESS_FILLER_CHARACTERS =
  "的了着过是在和与及或也就都还很太更最我你您他她它们请帮把被给让对跟从到向于为之其此该这那哪些个一二三两几有无没不要想需能会可做弄搞份次种位名条张台只样点些"

/** Scripts whose characters are grammatical rather than lexical in their language. */
export const SEPARATORLESS_FILLER_SCRIPT = /\p{Script=Hiragana}/u
