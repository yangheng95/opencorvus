import path from "node:path"
import z from "zod"
import {
  BrowserPreviewScrollSliceComparisonRequest,
  BrowserPreviewScrollSliceComparisonResult,
  compareBrowserPreviewScrollSlice,
} from "@/browser-preview/scroll-slice-comparison"
import { browserPreviewTaskEvidenceRoot } from "@/browser-preview/task-evidence-root"
import { resolveRuntimeRelativePath } from "@/browser-preview/persist"
import { Instance } from "@/project/instance"
import { buildMultimodalToolResult } from "./multimodal-result"
import { BrowserPreviewCompareScrollSlicesToolID } from "./browser-preview-tool-ids"
import { Tool } from "./tool"
import { taskExecutionID } from "./execution-files"

export const BrowserPreviewCompareScrollSlicesToolParameters = BrowserPreviewScrollSliceComparisonRequest.extend({
  includeDiff: z.boolean().default(false).describe("Whether to also generate a diagnostic diff PNG."),
}).strict()
export type BrowserPreviewCompareScrollSlicesToolParameters = z.infer<
  typeof BrowserPreviewCompareScrollSlicesToolParameters
>

export const BrowserPreviewCompareScrollSlicesTool = Tool.define(BrowserPreviewCompareScrollSlicesToolID, {
  description:
    "Compare an implementation page slice against one explicit immutable task artifact PNG at the same absolute scrollY. Uses a persisted browser_preview target and an exact TaskArtifact ref; never accepts source URLs or inferred paths. Returns a side-by-side PNG attachment for direct inspection plus comparison_guidance: LEFT is the source/reference image, RIGHT is the rendered/local implementation, and the checklist names layout, icon/asset, color, spacing, typography, content, state, chart/table/map, and placeholder defects to inspect.",
  parameters: BrowserPreviewCompareScrollSlicesToolParameters,
  async execute(params: BrowserPreviewCompareScrollSlicesToolParameters, ctx: Tool.Context) {
    const taskID = taskExecutionID(ctx, "browser_preview_compare_scroll_slices")
    const projectRoot = browserPreviewTaskEvidenceRoot(taskID)
    const result = await compareBrowserPreviewScrollSlice({
      projectID: Instance.project.id,
      projectRoot,
      taskID,
      targetID: params.targetID,
      viewportID: params.viewportID,
      sourceArtifact: params.sourceArtifact,
      route: params.route,
      scrollY: params.scrollY,
      sliceHeight: params.sliceHeight,
      includeDiff: params.includeDiff,
      signal: ctx.abort,
    })
    const sideBySidePath = resolveRuntimeRelativePath(projectRoot, result.artifacts.side_by_side)
    const multimodal = await buildMultimodalToolResult({
      projectID: Instance.project.id,
      text: JSON.stringify(renderPublicResult(result), null, 2),
      images: [
        {
          path: sideBySidePath,
          mime: "image/png",
          filename: `${params.viewportID}-scroll-${params.scrollY}-${path.basename(sideBySidePath)}`,
        },
      ],
    })
    return {
      title: "Scroll-slice comparison completed",
      output: multimodal.text,
      attachments: multimodal.attachments,
      metadata: {
        status: result.status satisfies BrowserPreviewScrollSliceComparisonResult["status"],
        taskID,
        targetID: params.targetID,
        viewportID: params.viewportID,
        evidenceID: result.evidenceID,
        evidenceRef: `browser_preview_evidence:${result.evidenceID}`,
        jobID: result.jobID,
        manifestPath: result.manifestPath,
        artifacts: result.artifacts,
        attachmentCount: multimodal.attachments.length,
        referenceComparisonProof: false,
      },
    }
  },
})

function renderPublicResult(result: BrowserPreviewScrollSliceComparisonResult): Record<string, unknown> {
  return {
    ...result,
    evidenceSemantics:
      "Supporting visual_diff evidence only. This is not reference-comparison proof.",
  }
}
