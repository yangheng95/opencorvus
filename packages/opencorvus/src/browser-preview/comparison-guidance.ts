import z from "zod"

export const BrowserPreviewComparisonGuidanceSchema = z
  .object({
    side_by_side_legend: z
      .object({
        left: z
          .object({
            role: z.literal("source_reference"),
            label: z.literal("LEFT: source/reference image"),
            meaning: z.literal("Expected visual source of truth."),
          })
          .strict(),
        right: z
          .object({
            role: z.literal("local_implementation"),
            label: z.literal("RIGHT: rendered/local implementation"),
            meaning: z.literal("Actual implementation under review."),
          })
          .strict(),
        source_of_truth: z.literal("left"),
        instruction: z.literal("Compare the right implementation against the left reference; do not reverse them."),
      })
      .strict(),
    inspection_checklist: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1),
            inspect_for: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
export type BrowserPreviewComparisonGuidance = z.infer<typeof BrowserPreviewComparisonGuidanceSchema>

export const BrowserPreviewComparisonGuidance = BrowserPreviewComparisonGuidanceSchema.parse({
  side_by_side_legend: {
    left: {
      role: "source_reference",
      label: "LEFT: source/reference image",
      meaning: "Expected visual source of truth.",
    },
    right: {
      role: "local_implementation",
      label: "RIGHT: rendered/local implementation",
      meaning: "Actual implementation under review.",
    },
    source_of_truth: "left",
    instruction: "Compare the right implementation against the left reference; do not reverse them.",
  },
  inspection_checklist: [
    {
      id: "layout_alignment",
      label: "Layout alignment and region order",
      inspect_for:
        "Different section order, shifted content rails, mismatched left/right/center edges, width drift, vertical placement drift, or whole-page calibration mismatch.",
    },
    {
      id: "component_structure",
      label: "Component structure",
      inspect_for:
        "Wrong component family, simplified hierarchy, missing required region, extra region, collapsed container, or source module mapped to the wrong local surface.",
    },
    {
      id: "content_truth",
      label: "Content truth",
      inspect_for:
        "Missing source text/data, hallucinated labels, invented numbers, extra buttons/cards, wrong copy, stale placeholders, or source-backed content omitted from the implementation.",
    },
    {
      id: "icon_asset_fidelity",
      label: "Icon and asset fidelity",
      inspect_for:
        "Missing icons, wrong icon glyphs, missing media/logo/thumbnail assets, incorrect stroke/fill, bad aspect ratio, low-resolution assets, or cropped images.",
    },
    {
      id: "color_surface_tokens",
      label: "Color, background, border, and shadow",
      inspect_for:
        "Foreground/background color mismatch, incorrect semantic red/green treatment, border or divider drift, missing surface tint, shadow mismatch, or unauthorized raw visual token changes.",
    },
    {
      id: "spacing_density",
      label: "Spacing and density",
      inspect_for:
        "Padding, margin, gap, row height, card density, table density, whitespace rhythm, or blank filler bands that differ from the reference.",
    },
    {
      id: "typography_text",
      label: "Typography and text rendering",
      inspect_for:
        "Font family, size, weight, line-height, letter spacing, truncation, wrapping, alignment, numeric formatting, or unreadable text differences.",
    },
    {
      id: "sizing_overflow_clipping",
      label: "Sizing, overflow, and clipping",
      inspect_for:
        "Wrong crop size, clipped content, overlap, unexpected scrollbar, hidden controls, stretched panels, squashed charts, or content escaping its container.",
    },
    {
      id: "interaction_state_visuals",
      label: "Interaction and state visuals",
      inspect_for:
        "Hover, focus, active, selected, disabled, loading, empty, error, tooltip, popover, menu, modal, or drawer visuals that differ from source evidence.",
    },
    {
      id: "data_visualization_geometry",
      label: "Chart, table, map, and heatmap geometry",
      inspect_for:
        "Wrong chart scale, axis, legend, crosshair, map proportions, table alignment, heatmap color ramp, positive/negative value color, or data density.",
    },
    {
      id: "layering_positioning",
      label: "Layering and positioning",
      inspect_for:
        "Wrong sticky header/footer behavior, z-index overlap, floating control position, tooltip placement, dropdown anchoring, or overlay clipping.",
    },
    {
      id: "scoped_viewport_drift",
      label: "Scoped viewport drift",
      inspect_for:
        "Desktop-width adaptation drift, overflow, wrapping, gutters, or sticky controls across scoped desktop viewports; do not add tablet/mobile obligations unless explicitly authorized.",
    },
    {
      id: "implementation_artifacts",
      label: "Generated artifact defects",
      inspect_for:
        "Fake screenshots, static placeholder widgets, skeleton leftovers, lorem/demo copy, decorative hallucinations, unstyled default controls, or non-interactive UI masquerading as complete product.",
    },
  ],
})
