import z from "zod"

export const BrowserPreviewViewportID = z.enum(["desktop", "tablet", "mobile"])
export type BrowserPreviewViewportID = z.infer<typeof BrowserPreviewViewportID>

export const BrowserPreviewViewport = z
  .object({
    id: BrowserPreviewViewportID,
    labelKey: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict()
export type BrowserPreviewViewport = z.infer<typeof BrowserPreviewViewport>

export const BrowserPreviewViewportList = BrowserPreviewViewport.array()
  .min(1)
  .superRefine((viewports, context) => {
    const seen = new Set<BrowserPreviewViewportID>()
    for (const [index, viewport] of viewports.entries()) {
      if (seen.has(viewport.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `Duplicate browser preview viewport ID: ${viewport.id}`,
        })
      }
      seen.add(viewport.id)
    }
  })

export class BrowserPreviewViewportNotFoundError extends Error {
  constructor(readonly viewportID: BrowserPreviewViewportID) {
    super(`Browser preview viewport not found on target: ${viewportID}`)
    this.name = "BrowserPreviewViewportNotFoundError"
  }
}

export function normalizeBrowserPreviewViewports(input: readonly BrowserPreviewViewport[]): BrowserPreviewViewport[] {
  return BrowserPreviewViewportList.parse(input)
}

export function browserPreviewViewportByID(
  viewports: readonly BrowserPreviewViewport[],
  id: BrowserPreviewViewportID,
): BrowserPreviewViewport {
  const viewport = viewports.find((item) => item.id === id)
  if (!viewport) throw new BrowserPreviewViewportNotFoundError(id)
  return viewport
}
