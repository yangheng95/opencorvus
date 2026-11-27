import { expect, test } from "bun:test"
import { createArtifactTimelinePresentation } from "../src/services/artifact-timeline"

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
