/**
 * URL `ExtractedPage` IR — the boundary contract for browser webpage capture.
 *
 * Downstream tools consume this shape directly as raw evidence and convert it
 * into the canonical `web-clone` source handoff.
 */

import z from "zod"

// ─── ExtractedStyles — pruned CSS computed-styles bag ────────────────────

export const ExtractedStylesSchema = z.object({
  // Layout
  display: z.string().optional(),
  flexDirection: z.string().optional(),
  flexWrap: z.string().optional(),
  justifyContent: z.string().optional(),
  alignItems: z.string().optional(),
  gap: z.string().optional(),
  gridTemplateColumns: z.string().optional(),
  gridTemplateRows: z.string().optional(),
  position: z.string().optional(),
  overflow: z.string().optional(),
  // Sizing
  width: z.string().optional(),
  height: z.string().optional(),
  minWidth: z.string().optional(),
  maxWidth: z.string().optional(),
  minHeight: z.string().optional(),
  maxHeight: z.string().optional(),
  // Spacing
  margin: z.string().optional(),
  padding: z.string().optional(),
  // Background
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  // Border
  border: z.string().optional(),
  borderRadius: z.string().optional(),
  // Effects
  boxShadow: z.string().optional(),
  opacity: z.string().optional(),
  // Interaction
  cursor: z.string().optional(),
  // Typography
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  lineHeight: z.string().optional(),
  letterSpacing: z.string().optional(),
  color: z.string().optional(),
  textAlign: z.string().optional(),
  textDecoration: z.string().optional(),
})

export type ExtractedStyles = z.infer<typeof ExtractedStylesSchema>

// ─── ExtractedElement (recursive) ────────────────────────────────────────

export const ExtractedElementRoleSchema = z.enum([
  "header",
  "nav",
  "main",
  "section",
  "aside",
  "footer",
  "card",
  "form",
  "list",
  "hero",
  "grid",
])

export const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
})

export interface ExtractedElement {
  selector: string
  tag: string
  role?: z.infer<typeof ExtractedElementRoleSchema>
  bounds: z.infer<typeof BoundsSchema>
  styles: ExtractedStyles
  text?: string
  imageSrc?: string
  imageAlt?: string
  href?: string
  aria?: Record<string, string>
  attrs?: Record<string, string>
  classes?: string[]
  repeatCount?: number
  children?: ExtractedElement[]
}

export const ExtractedElementSchema: z.ZodType<ExtractedElement> = z.lazy(() =>
  z.object({
    selector: z.string(),
    tag: z.string(),
    role: ExtractedElementRoleSchema.optional(),
    bounds: BoundsSchema,
    styles: ExtractedStylesSchema,
    text: z.string().optional(),
    imageSrc: z.string().optional(),
    imageAlt: z.string().optional(),
    href: z.string().optional(),
    aria: z.record(z.string(), z.string()).optional(),
    attrs: z.record(z.string(), z.string()).optional(),
    classes: z.array(z.string()).optional(),
    repeatCount: z.number().optional(),
    children: z.array(ExtractedElementSchema).optional(),
  }),
)

// ─── Top-level ExtractedPage ─────────────────────────────────────────────

export const ExtractedPageViewportSchema = z.object({
  width: z.number(),
  height: z.number(),
})

export const ExtractedPageTokensSchema = z.object({
  colors: z.record(z.string(), z.string()),
  fonts: z.array(z.string()),
  customProperties: z.record(z.string(), z.string()),
})

export const ExtractedPageAssetImageSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
})

export const ExtractedPageAssetIconSchema = z.object({
  src: z.string(),
  type: z.enum(["svg", "icon-font", "img"]),
})

export const ExtractedPageAssetsSchema = z.object({
  images: z.array(ExtractedPageAssetImageSchema),
  icons: z.array(ExtractedPageAssetIconSchema),
  canvasCaptures: z.array(z.object({ dataUrl: z.string() })).optional(),
  imageMap: z.record(z.string(), z.string()).optional(),
})

export const ExtractedPageStatsSchema = z.object({
  totalElements: z.number(),
  extractedElements: z.number(),
  imageCount: z.number(),
  extractionTimeMs: z.number(),
})

export const ExtractedPageSchema = z.object({
  url: z.string(),
  title: z.string(),
  viewport: ExtractedPageViewportSchema,
  screenshotUrl: z.string(),
  screenshotAboveFold: z.string().optional(),
  tree: z.array(ExtractedElementSchema),
  tokens: ExtractedPageTokensSchema,
  assets: ExtractedPageAssetsSchema,
  stats: ExtractedPageStatsSchema,
})

export type ExtractedPage = z.infer<typeof ExtractedPageSchema>
export type Bounds = z.infer<typeof BoundsSchema>
