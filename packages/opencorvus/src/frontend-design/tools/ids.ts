export const WEBPAGE_EVIDENCE_BLOCKED_TOOL_IDS = [
  "webpage_extract",
  "webpage_compile",
  "webpage_runtime_state",
] as const

export type WebpageEvidenceBlockedToolId = (typeof WEBPAGE_EVIDENCE_BLOCKED_TOOL_IDS)[number]
