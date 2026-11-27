# Qualified office.presentation@1 profile

Create a new 16:9 PPTX presentation from typed text, shape, picture, and chart
elements. Editing, preserving, or round-tripping an existing PPTX/POTX is not
qualified.

## Story and layout

- Give each slide one audience-facing takeaway and use a point-making title.
- Prefer a clear sequence: context, evidence, implication, decision, next step.
- Keep a consistent margin, type scale, color system, and alignment grid.
- Keep paragraphs readable at presentation distance and use charts only when
  they materially improve comparison or magnitude.
- Give each chart one coherent unit and scale. Use separate plots, a justified
  labelled secondary axis, or an explicit normalized index for heterogeneous
  metrics; never encode source notes as chart data.
- Use supplied image attachments only when they add evidence or meaning; add
  useful alt text and preserve their aspect ratio.

## Source and typed input

- Use only content, claims, and images available through the request, project,
  attachments, connected tools, or cited research.
- Do not invent metrics, quotes, logos, or source claims.
- Supply a safe basename ending in `.pptx` and all ordered slides in one call.
- All `x`, `y`, `width`, and `height` values are centimeters, never inches or pixels. The 16:9 slide is exactly 33.867 cm wide by 19.05 cm high.
- Keep every element within those centimeter slide bounds and allocate enough physical height for the requested font size and line count.
- Reference pictures only with canonical attachment URLs.
- Set `data_label_number_format` when displayed chart values need a specific
  precision, for example `0.00` for amounts to two decimal places. This writes
  the native chart label format and keeps the underlying values editable.
  Automatic labels may round or abbreviate values; check the actual labels in
  every fresh rendered slide against the source values and intended precision.
- Set `data_label_font_size_pt` and `axis_font_size_pt` when chart labels need
  explicit typography. Both accept 8–72 points and write native chart properties;
  they do not change values, number formats, or the chart geometry. Choose sizes
  for the editable presentation and inspect the fresh preview at reading size.
  The fixed upstream chart renderer uses its own SVG font units; previews do not
  establish Microsoft PowerPoint pixel fidelity. Do not inflate source sizes to
  compensate for that renderer's unit conversion.
