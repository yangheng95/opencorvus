import { VISUAL_QA_EXPERT_DEFAULT_TOOL_IDS } from "@/tool/non-base-tool-ids"
import { WORKER_COMMUNICATION_TOOL_IDS } from "@/tool/tool-id-catalog"

export const VISUAL_QA_CONTEXT_TOOL_IDS = ["read", "glob", "search_code", "list", "memory"] as const

export const VISUAL_QA_EVIDENCE_TOOL_IDS = [
  "browser_preview",
  "browser_preview_capture",
  "browser_preview_capture_interaction_state",
] as const

export const VISUAL_QA_RUNTIME_EVIDENCE_TOOL_IDS = [
  ...VISUAL_QA_EVIDENCE_TOOL_IDS,
  ...VISUAL_QA_EXPERT_DEFAULT_TOOL_IDS,
] as const

export const VISUAL_QA_PROJECTED_RUNTIME_TOOL_IDS = ["skill"] as const

export const VISUAL_QA_UTILITY_TOOL_IDS = WORKER_COMMUNICATION_TOOL_IDS

export const VISUAL_QA_OUTPUT_TOOL_IDS = [
  "register_visual_qa_check_item",
  "register_visual_qa_coverage",
  "register_visual_qa_evidence",
  "register_visual_qa_finding",
  "register_visual_qa_production_blocker",
  "register_visual_qa_problem_dom_region",
  "register_visual_qa_unresolved_code_module_problem",
  "register_visual_qa_open_question",
  "register_visual_qa_fact_check_item",
  "set_visual_qa_reference_parity",
  "update_visual_qa_judgment",
] as const

export const VISUAL_QA_STATIC_TOOL_IDS = [
  ...VISUAL_QA_CONTEXT_TOOL_IDS,
  ...VISUAL_QA_PROJECTED_RUNTIME_TOOL_IDS,
  ...VISUAL_QA_UTILITY_TOOL_IDS,
  ...VISUAL_QA_EVIDENCE_TOOL_IDS,
] as const

export const VISUAL_QA_RAW_RUNTIME_TOOL_IDS = [
  ...VISUAL_QA_CONTEXT_TOOL_IDS,
  ...VISUAL_QA_UTILITY_TOOL_IDS,
  ...VISUAL_QA_RUNTIME_EVIDENCE_TOOL_IDS,
  ...VISUAL_QA_OUTPUT_TOOL_IDS,
] as const

export const VISUAL_QA_GENERAL_PROJECTED_TOOL_IDS = [
  ...VISUAL_QA_CONTEXT_TOOL_IDS,
  ...VISUAL_QA_UTILITY_TOOL_IDS,
  ...VISUAL_QA_EVIDENCE_TOOL_IDS,
  ...VISUAL_QA_OUTPUT_TOOL_IDS,
] as const

export type VisualQaStaticToolID = (typeof VISUAL_QA_STATIC_TOOL_IDS)[number]
export type VisualQaRawRuntimeToolID = (typeof VISUAL_QA_RAW_RUNTIME_TOOL_IDS)[number]
