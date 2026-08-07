import path from "node:path"
import z from "zod"
import {
  BrowserPreviewRegionComparisonRequest,
  compareBrowserPreviewRegions,
} from "@/browser-preview/region-comparison"
import { normalizeRuntimePathRefs, resolveRuntimeRelativePath } from "@/browser-preview/persist"
import { browserPreviewTaskEvidenceRoot } from "@/browser-preview/task-evidence-root"
import { Instance } from "@/project/instance"
import { buildMultimodalToolResult } from "./multimodal-result"
import { BrowserPreviewCompareReferenceRegionsToolID } from "./browser-preview-tool-ids"
import { Tool } from "./tool"
import { taskExecutionID } from "./execution-files"

export const BrowserPreviewCompareReferenceRegionsToolParameters = BrowserPreviewRegionComparisonRequest
export type BrowserPreviewCompareReferenceRegionsToolParameters = z.infer<
  typeof BrowserPreviewCompareReferenceRegionsToolParameters
>

export const BrowserPreviewCompareReferenceRegionsTool = Tool.define(BrowserPreviewCompareReferenceRegionsToolID, {
  description:
    "Compare explicit source regions from immutable task artifact PNG refs with explicit implementation locators on one persisted browser preview target. The caller owns source-region selection; this tool performs no source-package discovery, path inference, candidate ranking, or fallback. Returns true-size side-by-side evidence for direct inspection.",
  parameters: BrowserPreviewCompareReferenceRegionsToolParameters,
  async execute(params: BrowserPreviewCompareReferenceRegionsToolParameters, ctx: Tool.Context) {
    const taskID = taskExecutionID(ctx, "browser_preview_compare_reference_regions")
    const projectRoot = browserPreviewTaskEvidenceRoot(taskID)
    const result = await compareBrowserPreviewRegions({
      projectID: Instance.project.id,
      projectRoot,
      taskID,
      targetID: params.targetID,
      bindings: params.inlineBindings,
      includeDiff: params.output.include_diff,
      signal: ctx.abort,
    })
    const images = result.regions.flatMap((region) => {
      const sideBySide = region.artifacts?.side_by_side
      if (!sideBySide) return []
      const imagePath = resolveRuntimeRelativePath(projectRoot, sideBySide)
      return [
        {
          path: imagePath,
          mime: "image/png" as const,
          filename: `${region.viewport_id}-${safeFilename(region.region_id)}-${path.basename(imagePath)}`,
        },
      ]
    })
    const publicResult = normalizeRuntimePathRefs(projectRoot, result)
    const multimodal = await buildMultimodalToolResult({
      projectID: Instance.project.id,
      text: JSON.stringify(publicResult, null, 2),
      images,
    })
    return {
      title: "Reference region comparison completed",
      output: multimodal.text,
      attachments: multimodal.attachments,
      metadata: {
        status: result.status,
        taskID,
        targetID: params.targetID,
        jobID: result.jobID,
        manifestPath: result.manifestPath,
        evidenceIDs: result.evidenceIDs,
        attachmentCount: multimodal.attachments.length,
        referenceComparisonProof: false,
      },
    }
  },
})

function safeFilename(input: string): string {
  return (
    input
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "region"
  )
}
