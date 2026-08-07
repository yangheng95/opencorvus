export const ICON_SIZE_TIERS = ["compact", "standard", "medium", "large", "display"] as const
export type IconSizeTier = (typeof ICON_SIZE_TIERS)[number]
