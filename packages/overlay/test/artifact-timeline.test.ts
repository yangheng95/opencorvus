import { expect, test } from "bun:test"
import { createArtifactTimelinePresentation } from "../src/services/artifact-timeline"

test("timeline date instances provide Chinese and English axis labels independently", () => {
  const zh = createArtifactTimelinePresentation("zh-CN")
  const en = createArtifactTimelinePresentation("en-US")
  const date = "2026-10-29T09:30:00"
  expect(zh.moment(date).format("MMMM dddd")).toBe("十月 星期四")
  expect(en.moment(date).format("MMMM dddd")).toBe("October Thursday")
  expect(zh.moment(en.moment(date)).format("MMM ddd")).toBe("10月 周四")
  expect(en.moment(zh.moment(date)).format("MMM ddd")).toBe("Oct Thu")
})

test("localized date construction preserves source time and supports formatted strict input", () => {
  const zh = createArtifactTimelinePresentation("zh-CN")
  const en = createArtifactTimelinePresentation("en-US")
  const date = "2026-10-29T09:30:00+08:00"
  expect([zh, en].map((presentation) => presentation.moment(date).valueOf())).toEqual([
    Date.parse(date),
    Date.parse(date),
  ])
  expect(zh.moment("29/10/2026", "DD/MM/YYYY", true).format("YYYY-MM-DD")).toBe("2026-10-29")
})

test("event date details follow the requested product language", () => {
  const date = "2026-10-29T09:30:00"
  expect(createArtifactTimelinePresentation("zh-CN").formatDateTime(date)).toBe("2026年10月29日 09:30")
  expect(createArtifactTimelinePresentation("en-US").formatDateTime(date)).toBe("Oct 29, 2026, 9:30 AM")
})
