import {
  BrowserPreviewLayoutGeometryDiagnosticRequest,
  diagnoseBrowserPreviewLayoutGeometry,
  type BrowserPreviewLayoutGeometryResult,
} from "@/browser-preview/layout-geometry-diagnostic"
import z from "zod"
import { browserPreviewTaskEvidenceRoot } from "@/browser-preview/task-evidence-root"
import { Tool } from "./tool"
import { taskExecutionID } from "./execution-files"

const BrowserPreviewLayoutGeometryToolID = "browser_preview_layout_geometry" as const

export const BrowserPreviewLayoutGeometryToolParameters = BrowserPreviewLayoutGeometryDiagnosticRequest
export type BrowserPreviewLayoutGeometryToolParameters = z.infer<typeof BrowserPreviewLayoutGeometryToolParameters>

export const BrowserPreviewLayoutGeometryTool = Tool.define(BrowserPreviewLayoutGeometryToolID, {
  description:
    "Capture task-scoped layout geometry evidence for page edge alignment, margins, padding, gaps, overflow, and explicit desktop width scaling samples. Uses a persisted browser_preview target and implementation locators; never accepts raw URLs and never produces reference-comparison proof.",
  parameters: BrowserPreviewLayoutGeometryToolParameters,
  async execute(params: BrowserPreviewLayoutGeometryToolParameters, ctx: Tool.Context) {
    const taskID = taskExecutionID(ctx, "browser_preview_layout_geometry")
    const result = await diagnoseBrowserPreviewLayoutGeometry({
      projectRoot: browserPreviewTaskEvidenceRoot(taskID),
      taskID,
      targetID: params.targetID,
      viewportID: params.viewportID,
      route: params.route,
      regions: params.regions,
      alignmentGroups: params.alignmentGroups,
      widthSamples: params.widthSamples,
      signal: ctx.abort,
    })
    return {
      title: "Layout geometry diagnostic completed",
      output: JSON.stringify(renderPublicResult(result), null, 2),
      metadata: {
        status: result.status,
        taskID,
        targetID: params.targetID,
        viewportID: params.viewportID,
        route: params.route,
        evidenceID: result.evidenceID,
        manifestPath: result.manifestPath,
        sampleCount: result.samples.length,
        regionCount: result.samples[0]?.regions.length ?? 0,
        referenceComparisonProof: false,
      },
    }
  },
})

function renderPublicResult(result: BrowserPreviewLayoutGeometryResult): Record<string, unknown> {
  return {
    operation: result.operation,
    status: result.status,
    evidenceID: result.evidenceID,
    manifestPath: result.manifestPath,
    viewportID: result.viewportID,
    route: result.route,
    samples: result.samples.map((sample) => ({
      sampleID: sample.sampleID,
      primary: sample.primary,
      viewport: sample.viewport,
      pageOverflow: sample.page.overflow,
      bodyMargin: sample.page.body.margin,
      regions: sample.regions.map((region) => ({
        regionID: region.regionID,
        status: region.status,
        reason: region.reason,
        borderBox: region.borderBox,
        viewportBox: region.viewportBox,
        margin: region.margin,
        padding: region.padding,
        gap: region.gap,
        edgeOffsets: region.edgeOffsets,
        computed: region.computed,
        sourceDelta: region.sourceDelta,
      })),
    })),
    widthBehavior: result.widthBehavior,
    alignmentGroups: result.alignmentGroups,
    diagnostics: result.diagnostics,
    evidenceSemantics:
      "Supporting layout geometry evidence only. This is not reference-comparison proof and does not replace screenshot inspection.",
  }
}
