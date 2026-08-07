import { BrowserPreviewToolID } from "@/tool/browser-preview-tool-ids"
import { WORKER_COMMUNICATION_TOOL_IDS } from "@/tool/tool-id-catalog"

export const INTEGRITY_PREVIEW_TOOL_IDS = [BrowserPreviewToolID] as const
export const INTEGRITY_DECLARED_TOOL_IDS = [
  ...INTEGRITY_PREVIEW_TOOL_IDS,
  "skill",
  ...WORKER_COMMUNICATION_TOOL_IDS,
] as const

export const INTEGRITY_OUTPUT_TOOL_IDS = [
  "register_integrity_check_item",
  "register_integrity_reviewer_review",
  "register_integrity_coverage_audit",
  "register_integrity_uninspected_risk",
  "register_integrity_finding",
  "register_integrity_round",
  "register_integrity_required_repair",
  "register_integrity_unresolved_disagreement",
  "register_integrity_fact_check_item",
  "update_integrity_judgment",
] as const
