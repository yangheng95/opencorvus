import { z } from "zod"

import { BrowserPreviewCropIntent } from "@/browser-preview/region-schema"

export const VisualRegionBoxSchema = z
  .object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict()

export const VisualRegionSlicingStrategySchema = z.literal("horizontal_component_bands")

export const VisualRegionBindingInputRegionSchema = z
  .object({
    region_id: z.string().min(1),
    source_order: z
      .number()
      .int()
      .positive()
      .describe("1-based top-to-bottom component order chosen by Frontend Design from the coordinate atlas."),
    source_bbox: VisualRegionBoxSchema,
    viewport: z.string().min(1),
    region_scope: z.string().min(1),
    crop_intent: BrowserPreviewCropIntent,
    target_route: z.string().min(1),
    implementation_locator: z.string().min(1),
    component_files: z.array(z.string().min(1)).min(1),
  })
  .strict()

export const VisualRegionBindingManifestRegionSchema = VisualRegionBindingInputRegionSchema.extend({
  reference_region_key: z.string().min(1),
  source_reference_artifact: z.string().min(1),
  source_crop_filename: z.string().min(1),
}).strict()

export const VisualRegionBindingManifestSchema = z
  .object({
    version: z.literal(1),
    purpose: z.literal("visual-region-binding-package"),
    generated_at: z.string().min(1),
    manifest_path: z.string().min(1),
    source_image: z.string().min(1),
    source_image_dimensions: VisualRegionBoxSchema.pick({ width: true, height: true }),
    slicing_strategy: VisualRegionSlicingStrategySchema,
    crop_directory: z.string().min(1),
    bbox_overlay_artifact: z.string().min(1),
    contact_sheet_artifact: z.string().min(1),
    regions: z.array(VisualRegionBindingManifestRegionSchema).min(1),
  })
  .strict()

export type VisualRegionBindingManifest = z.infer<typeof VisualRegionBindingManifestSchema>
