import moment from "moment/dist/moment.js"
import type { DataItem, MomentConstructor1 } from "vis-timeline"
import type { InteractiveArtifactPayload } from "./interactive-artifact"

type TimelineItems = Extract<InteractiveArtifactPayload, { renderer: "timeline@1" }>["items"]

export function artifactTimelineItems(items: TimelineItems): DataItem[] {
  return items.map((item) => ({
    id: item.id,
    content: item.content,
    group: item.group,
    start: item.start,
    ...("end" in item ? { end: item.end } : {}),
    type: item.kind,
    style: item.color ? `background-color:${item.color};border-color:${item.color}` : undefined,
  }))
}

// Moment locale modules register globally; keep the existing default while
// supplying each timeline with its own explicitly localized date instances.
const defaultLocale = moment.locale()
await import("moment/dist/locale/zh-cn.js")
moment.locale(defaultLocale)

export function createArtifactTimelinePresentation(locale: string) {
  const dateLocale = locale === "zh-CN" ? "zh-cn" : "en"
  const createMoment: MomentConstructor1 = (input, format, strict) => moment(input, format, strict).locale(dateLocale)
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" })
  return {
    moment: createMoment,
    formatDateTime: (value: string) => dates.format(Date.parse(value)),
  }
}
