import { FRONTEND_DESIGN_EXPERT_DEFAULT_TOOL_IDS } from "@/tool/non-base-tool-ids"
import { WORKER_COMMUNICATION_TOOL_IDS } from "@/tool/tool-id-catalog"

export const FRONTEND_DESIGN_CONTEXT_TOOL_IDS = ["read", "glob", "search_code", "list", "memory"] as const

export const FRONTEND_DESIGN_IMPLEMENTATION_TOOL_IDS = ["bash", "edit", "write", "apply_patch"] as const

export const FRONTEND_DESIGN_UTILITY_TOOL_IDS = WORKER_COMMUNICATION_TOOL_IDS

export const FRONTEND_DESIGN_PROJECTED_RUNTIME_TOOL_IDS = ["skill"] as const

export const FRONTEND_DESIGN_STATIC_TOOL_IDS = [
  ...FRONTEND_DESIGN_IMPLEMENTATION_TOOL_IDS,
  ...FRONTEND_DESIGN_CONTEXT_TOOL_IDS,
  ...FRONTEND_DESIGN_UTILITY_TOOL_IDS,
  ...FRONTEND_DESIGN_PROJECTED_RUNTIME_TOOL_IDS,
] as const

export const FRONTEND_DESIGN_OUTPUT_TOOL_IDS = [
  "update_frontend_basics",
  "update_frontend_text",
  "update_frontend_item",
  "update_frontend_design_direction",
  "select_frontend_design_direction",
  "update_frontend_anti_slop_review",
  "update_frontend_material",
  "update_frontend_project",
  "update_frontend_component_reuse",
  "update_frontend_baseline",
  "update_frontend_phase",
  "capture_frontend_visual_evidence",
  "update_frontend_visual_evidence",
  "update_frontend_iteration_note",
  "update_frontend_reference",
  "update_frontend_visual_region_binding",
  "update_frontend_question",
  "inspect_frontend_result_status",
] as const

export const FRONTEND_DESIGN_STAGE_OWNED_TOOL_IDS = ["read_attachment", ...FRONTEND_DESIGN_OUTPUT_TOOL_IDS] as const

export const FRONTEND_DESIGN_RAW_RUNTIME_TOOL_IDS = [
  ...FRONTEND_DESIGN_IMPLEMENTATION_TOOL_IDS,
  ...FRONTEND_DESIGN_CONTEXT_TOOL_IDS,
  ...FRONTEND_DESIGN_UTILITY_TOOL_IDS,
  ...FRONTEND_DESIGN_EXPERT_DEFAULT_TOOL_IDS,
  ...FRONTEND_DESIGN_STAGE_OWNED_TOOL_IDS,
] as const

export const FRONTEND_DESIGN_GENERAL_PROJECTED_TOOL_IDS = [
  ...FRONTEND_DESIGN_IMPLEMENTATION_TOOL_IDS,
  ...FRONTEND_DESIGN_CONTEXT_TOOL_IDS,
  ...FRONTEND_DESIGN_UTILITY_TOOL_IDS,
  ...FRONTEND_DESIGN_STAGE_OWNED_TOOL_IDS,
] as const

export type FrontendDesignStaticToolID = (typeof FRONTEND_DESIGN_STATIC_TOOL_IDS)[number]
export type FrontendDesignRawRuntimeToolID = (typeof FRONTEND_DESIGN_RAW_RUNTIME_TOOL_IDS)[number]
