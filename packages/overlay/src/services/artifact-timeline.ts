import moment from "moment/dist/moment.js"
import type { MomentConstructor1 } from "vis-timeline"

// Moment locale modules register globally; keep the existing default while
// supplying each timeline with its own explicitly localized date instances.
const defaultLocale = moment.locale()
await import("moment/dist/locale/zh-cn.js")
moment.locale(defaultLocale)

export function createArtifactTimelinePresentation(locale: string) {
  const dateLocale = locale === "zh-CN" ? "zh-cn" : "en"
  const createMoment: MomentConstructor1 = (input, format, strict) => moment(input, format, strict).locale(dateLocale)
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" })
  return {
    moment: createMoment,
    formatDateTime: (value: string) => dates.format(Date.parse(value)),
  }
}
