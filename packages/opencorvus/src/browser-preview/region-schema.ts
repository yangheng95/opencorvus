import z from "zod"
import { TaskArtifactRefSchema, type TaskArtifactRef } from "@opencorvus-ai/plugin/task-artifact"
import { BrowserPreviewViewportID } from "./viewport"

// PNG means Portable Network Graphics.
export const BrowserPreviewSourceImageArtifactRef = TaskArtifactRefSchema.refine(
  (ref) => ref.media_type === "image/png",
  "browser preview source image artifact must use image/png media type",
)
export type BrowserPreviewSourceImageArtifactRef = TaskArtifactRef

export const BrowserPreviewRegionBox = z
  .object({
    x: z.number().finite().nonnegative(),
    y: z.number().finite().nonnegative(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  })
  .strict()
export type BrowserPreviewRegionBox = z.infer<typeof BrowserPreviewRegionBox>

export const BrowserPreviewCropIntent = z.enum(["full-region", "content-well"])
export type BrowserPreviewCropIntent = z.infer<typeof BrowserPreviewCropIntent>

export const BrowserPreviewRegionLocator = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("test-id"), value: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("data-oc-region"), value: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("role"), role: z.string().min(1), name: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("selector"), value: z.string().min(1), owner_file: z.string().min(1) }).strict(),
])
export type BrowserPreviewRegionLocator = z.infer<typeof BrowserPreviewRegionLocator>

/**
 * Exactly the geometry and locator facts the region comparison reads. The
 * binding record that frontend-design curates carries more (scope labels,
 * semantic roles, evidence refs, component files); none of it reaches a
 * verdict here, and requiring it made the model author values that could not
 * change any outcome.
 */
export const BrowserPreviewRegionBinding = z
  .object({
    region_id: z.string().min(1),
    viewport_id: BrowserPreviewViewportID,
    state_id: z.string().min(1).default("default"),
    crop_intent: BrowserPreviewCropIntent,
    source: z
      .object({
        reference_artifact: BrowserPreviewSourceImageArtifactRef,
        bbox: BrowserPreviewRegionBox,
      })
      .strict(),
    implementation: z
      .object({
        route: z.string().min(1).default("/"),
        locator: BrowserPreviewRegionLocator,
      })
      .strict(),
  })
  .strict()
export type BrowserPreviewRegionBinding = z.infer<typeof BrowserPreviewRegionBinding>

export function browserPreviewRegionIdentityKey(input: {
  viewport_id: z.infer<typeof BrowserPreviewViewportID>
  state_id: string
  region_id: string
}): string {
  return JSON.stringify([input.viewport_id, input.state_id, input.region_id])
}
