import { splitProps } from "solid-js"
import type { JSX } from "solid-js"

export const BADGE_TONES = ["neutral", "accent", "ok", "warn", "bad", "muted"] as const
export const BADGE_SIZES = ["sm", "md"] as const

export type BadgeTone = (typeof BADGE_TONES)[number]
export type BadgeSize = (typeof BADGE_SIZES)[number]

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: BadgeSize
}

export function Badge(props: BadgeProps): JSX.Element {
  const [local, badgeProps] = splitProps(props, ["tone", "size", "class"])
  const className = () => (local.class ? `oc-badge ${local.class}` : "oc-badge")

  return <span {...badgeProps} class={className()} data-tone={local.tone ?? "neutral"} data-size={local.size ?? "md"} />
}
