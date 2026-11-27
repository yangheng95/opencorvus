import { expect, test } from "bun:test"
import { artifactTimelineItems, createArtifactTimelinePresentation } from "../src/services/artifact-timeline"

test("timeline data projects canonical point, range and background shapes", () => {
  const start = "2026-11-27T10:23:37.272Z"
  const end = "2026-11-27T10:23:43.892Z"
  expect(artifactTimelineItems([
    { id: "read", kind: "point", content: "Source read", start },
    { id: "run", kind: "range", content: "Actual run", start, end, group: "tools", color: "#123456" },
    { id: "span", kind: "background", content: "Recorded span", start, end },
  ])).toStrictEqual([
    { id: "read", type: "point", content: "Source read", start, group: undefined, style: undefined },
    { id: "run", type: "range", content: "Actual run", start, end, group: "tools", style: "background-color:#123456;border-color:#123456" },
    { id: "span", type: "background", content: "Recorded span", start, end, group: undefined, style: undefined },
  ])
})

test.each([
  ["zh-CN", ["2026年11月27日 18:23:37", "2026年11月27日 18:23:43"]],
  ["en-US", ["Nov 27, 2026, 6:23:37 PM", "Nov 27, 2026, 6:23:43 PM"]],
] as const)("timeline details preserve seconds in %s", (locale, expected) => {
  const presentation = createArtifactTimelinePresentation(locale)
  const instants = [
    new Date(2026, 10, 27, 18, 23, 37, 272).toISOString(),
    new Date(2026, 10, 27, 18, 23, 43, 892).toISOString(),
  ]
  expect(instants.map(presentation.formatDateTime)).toEqual([...expected])
})
