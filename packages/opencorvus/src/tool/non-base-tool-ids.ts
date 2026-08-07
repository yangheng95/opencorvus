// ID: Identifier. These host tool IDs are never inherited from a base-role template.
export const FRONTEND_DESIGN_VISUAL_PROJECT_TOOL_IDS = [
  "create_visual_region_coordinate_atlas",
  "create_visual_region_binding_package",
] as const

export const FRONTEND_DESIGN_REFERENCE_TOOL_IDS = ["update_frontend_competitor_reference"] as const

export const FRONTEND_DESIGN_EXPERT_DEFAULT_TOOL_IDS = [
  ...FRONTEND_DESIGN_VISUAL_PROJECT_TOOL_IDS,
  ...FRONTEND_DESIGN_REFERENCE_TOOL_IDS,
] as const

export const VISUAL_QA_EXPERT_DEFAULT_TOOL_IDS = [
  "browser_preview_compare_reference_regions",
  "browser_preview_compare_scroll_slices",
  "browser_preview_layout_geometry",
] as const

export const NON_BASE_FRONTEND_TOOL_IDS = [
  "webpage_extract",
  "webpage_compile",
  "webpage_runtime_state",
  ...FRONTEND_DESIGN_EXPERT_DEFAULT_TOOL_IDS,
  ...VISUAL_QA_EXPERT_DEFAULT_TOOL_IDS,
] as const

export const WEBPAGE_EVIDENCE_DEFAULT_HOST_TOOL_IDS = [
  "webpage_extract",
  "webpage_compile",
  "webpage_runtime_state",
] as const

export const FRONTEND_EXPERT_DEFAULT_TOOL_IDS = [
  ...FRONTEND_DESIGN_EXPERT_DEFAULT_TOOL_IDS,
  ...VISUAL_QA_EXPERT_DEFAULT_TOOL_IDS,
] as const

export type NonBaseFrontendToolID = (typeof NON_BASE_FRONTEND_TOOL_IDS)[number]
export type FrontendExpertDefaultToolID = (typeof FRONTEND_EXPERT_DEFAULT_TOOL_IDS)[number]
