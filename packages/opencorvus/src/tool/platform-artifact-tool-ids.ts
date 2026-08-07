/**
 * Canonical platform Artifact tool identifiers. Core owns the runtime
 * capability surface; the public SDK mirrors this file during generation so
 * package authors cannot drift from the Host.
 */
export const PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS = [
  "artifact_search",
  "artifact_read",
  "artifact_select",
] as const
export const PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS = ["artifact_snapshot", "artifact_publish"] as const
export const PLATFORM_ARTIFACT_TOOL_IDS = [
  ...PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS,
  ...PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS,
] as const
