export const BrowserPreviewToolID = "browser_preview" as const
export const BrowserPreviewCaptureToolID = "browser_preview_capture" as const
export const BrowserPreviewCaptureInteractionStateToolID = "browser_preview_capture_interaction_state" as const
export const BrowserPreviewCompareReferenceRegionsToolID = "browser_preview_compare_reference_regions" as const
export const BrowserPreviewCompareScrollSlicesToolID = "browser_preview_compare_scroll_slices" as const

export const BROWSER_PREVIEW_REPAIR_TOOL_IDS = [
  BrowserPreviewToolID,
  BrowserPreviewCompareScrollSlicesToolID,
] as const
