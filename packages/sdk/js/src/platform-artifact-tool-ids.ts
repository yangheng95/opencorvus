// Auto-generated from packages/opencorvus/src/tool/platform-artifact-tool-ids.ts.
// Do not edit - regenerate via `bun run build`.

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
