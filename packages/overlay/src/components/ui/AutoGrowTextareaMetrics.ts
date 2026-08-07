export const DEFAULT_MAX_VISIBLE_LINES = 10

/**
 * Pure height resolver: the content height (`scrollHeight`) clamped to a
 * `maxLines`-line ceiling. Split out from the DOM read so the cap logic is
 * unit-testable without a textarea (Bun has no jsdom).
 */
export function autoGrowHeight(opts: {
  scrollHeight: number
  lineHeight: number
  padTop: number
  padBottom: number
  maxLines: number
}): number {
  const maxHeight = Math.ceil(opts.lineHeight * opts.maxLines + opts.padTop + opts.padBottom)
  return Math.min(opts.scrollHeight, maxHeight)
}
