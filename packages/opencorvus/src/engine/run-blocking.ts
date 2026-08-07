export const INTERACTION_BLOCKING_REASONS = new Set(["permission", "question"])

export function isInteractionBlockingReason(reason?: string | null): boolean {
  return !!reason && INTERACTION_BLOCKING_REASONS.has(reason)
}
