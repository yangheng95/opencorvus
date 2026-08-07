import {
  CompiledWebpageAssetKindSchema,
  CompiledWebpageAssetUseSchema,
  CompiledWebpageAttributeSchema,
  CompiledWebpageBoundsSchema,
  CompiledWebpageLayoutSchema,
  tool,
} from "@opencorvus-ai/plugin"

const z = tool.schema

export const WebCloneSegmentStrategySchema = z.enum([
  "dom-component",
  "asset-backed-component",
  "canvas-raster",
  "svg-inline",
  "mixed",
])

export const WebCloneSegmentNodeSummarySchema = z.strictObject({
  id: z.string(),
  parentId: z.string().optional(),
  sourcePath: z.string().optional(),
  type: z.enum(["document", "element", "text", "comment", "directive"]),
  tag: z.string().optional(),
  text: z.string().optional(),
  attrs: z.array(CompiledWebpageAttributeSchema).optional(),
  layout: CompiledWebpageLayoutSchema.optional(),
})

export const WebCloneSegmentAssetSummarySchema = z.strictObject({
  id: z.string(),
  kind: CompiledWebpageAssetKindSchema,
  path: z.string(),
  bytes: z.number().int().nonnegative(),
  mime: z.string().optional(),
  semanticRole: z.string(),
  preview: z.string(),
  usedBy: z.array(CompiledWebpageAssetUseSchema),
})

export const WebCloneSegmentSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  rootNodeId: z.string(),
  tag: z.string(),
  strategy: WebCloneSegmentStrategySchema,
  bounds: CompiledWebpageBoundsSchema.optional(),
  layout: CompiledWebpageLayoutSchema.optional(),
  nodeIds: z.array(z.string()),
  assetIds: z.array(z.string()),
  nodeOutline: z.array(WebCloneSegmentNodeSummarySchema),
  omittedNodeCount: z.number().int().nonnegative(),
  assetRefs: z.array(WebCloneSegmentAssetSummarySchema),
  textPreview: z.array(z.string()),
  childElementCount: z.number().int().nonnegative(),
})

export const WebCloneSegmentsSchema = z.strictObject({
  version: z.literal(1),
  purpose: z.literal("web-clone-visual-segments"),
  sourceIr: z.string(),
  assetManifest: z.string(),
  segments: z.array(WebCloneSegmentSchema),
})

export const WebCloneCodegenContextSchema = z.strictObject({
  version: z.literal(1),
  purpose: z.literal("web-clone-framework-codegen-context"),
  sourceIr: z.string(),
  assetManifest: z.string(),
  segmentsPath: z.string(),
  rules: z.array(z.string()),
  verificationChecks: z.array(z.string()),
  segments: z.array(WebCloneSegmentSchema),
})

export type WebCloneSegmentStrategy = ReturnType<typeof WebCloneSegmentStrategySchema.parse>
export type WebCloneSegmentNodeSummary = ReturnType<typeof WebCloneSegmentNodeSummarySchema.parse>
export type WebCloneSegmentAssetSummary = ReturnType<typeof WebCloneSegmentAssetSummarySchema.parse>
export type WebCloneSegment = ReturnType<typeof WebCloneSegmentSchema.parse>
export type WebCloneSegments = ReturnType<typeof WebCloneSegmentsSchema.parse>
