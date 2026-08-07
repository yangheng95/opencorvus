import type { Tool } from "@/tool/tool"
export { INTEGRITY_DECLARED_TOOL_IDS, INTEGRITY_OUTPUT_TOOL_IDS, INTEGRITY_PREVIEW_TOOL_IDS } from "./tool-ids"

export async function loadIntegrityPreviewToolInfos(): Promise<readonly Tool.Info[]> {
  const { BrowserPreviewTool } = await import("@/tool/browser-preview")
  return [BrowserPreviewTool] as const
}
