export const DEFAULT_MAX_VISIBLE_LINES = 10

/**
 * Convert the measured padding-box height to a CSS height after applying the
 * caller's line cap. Border-box height includes borders; content-box excludes
 * padding. Both use the native field's actual box model.
 */
export function autoGrowHeight(opts: {
  scrollHeight: number
  lineHeight: number
  padTop: number
  padBottom: number
  borderTop: number
  borderBottom: number
  borderBox: boolean
  maxLines: number
}): number {
  const padding = opts.padTop + opts.padBottom
  const maxHeight = Math.ceil(opts.lineHeight * opts.maxLines + padding)
  const innerHeight = Math.min(opts.scrollHeight, maxHeight)
  return Math.ceil(opts.borderBox ? innerHeight + opts.borderTop + opts.borderBottom : innerHeight - padding)
}
