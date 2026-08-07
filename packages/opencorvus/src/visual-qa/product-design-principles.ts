export const VISUAL_QA_PRODUCT_DESIGN_PRINCIPLES = [
  {
    id: "component-truth",
    title: "Component truth",
    question:
      "Does every visible chart, map, table, control, and data region use the correct component family and real task-scoped data instead of a placeholder, sketch, or fake low-fidelity stand-in?",
    blockerExamples: [
      "a choropleth requirement is implemented as a hand-drawn abstract map",
      "a chart is a static picture or decorative SVG with no data contract",
      "a table surface is rebuilt as loose divs when the required table primitive exists",
    ],
  },
  {
    id: "reference-structure",
    title: "Reference structure fidelity",
    question:
      "Does the product preserve the reference information architecture, region order, layout density, spacing rhythm, and responsive structure for the scoped surface?",
    blockerExamples: [
      "major regions appear in a different order than the reference",
      "a dense operational page is redesigned as a loose marketing layout",
      "the mobile structure omits or clips required reference content",
    ],
  },
  {
    id: "visual-hierarchy-readability",
    title: "Visual hierarchy and readability",
    question:
      "Can a user immediately read the primary hierarchy, labels, values, and controls without overlap, clipping, misleading emphasis, or broken contrast?",
    blockerExamples: [
      "primary text overlaps adjacent controls",
      "button or chip labels are clipped at normal viewport sizes",
      "heading scale or weight makes the page read as a different product",
    ],
  },
  {
    id: "interaction-state-integrity",
    title: "Interaction state integrity",
    question:
      "Do the visible controls expose the expected hover, focus, keyboard, open, loading, empty, error, and selected states without dead or misleading affordances?",
    blockerExamples: [
      "a clickable visual affordance has no observable interaction",
      "keyboard focus cannot reach a primary control",
      "loading or error state collapses the layout or hides required recovery text",
    ],
  },
  {
    id: "production-completeness",
    title: "Production completeness",
    question:
      "Is the scoped surface complete enough for a user to believe it is the intended product rather than an unfinished generated draft?",
    blockerExamples: [
      "required regions are missing",
      "source-backed content is absent or replaced by invented filler",
      "the first viewport or primary workflow still looks like a draft handoff",
    ],
  },
] as const

export type VisualQaProductDesignPrincipleID = (typeof VISUAL_QA_PRODUCT_DESIGN_PRINCIPLES)[number]["id"]

export const VISUAL_QA_PRODUCT_DESIGN_PRINCIPLE_IDS = VISUAL_QA_PRODUCT_DESIGN_PRINCIPLES.map(
  (principle) => principle.id,
) as [VisualQaProductDesignPrincipleID, ...VisualQaProductDesignPrincipleID[]]

export function renderVisualQaProductDesignPrinciples(): string {
  return [
    "# Product Design QA Principles",
    "",
    "Use these principle IDs when deciding whether a visual issue blocks production delivery. A production blocker must cite at least one principle ID.",
    "",
    ...VISUAL_QA_PRODUCT_DESIGN_PRINCIPLES.flatMap((principle) => [
      `## ${principle.id}: ${principle.title}`,
      principle.question,
      "",
    ]),
  ]
    .join("\n")
    .trim()
}
