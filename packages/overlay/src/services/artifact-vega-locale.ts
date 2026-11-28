import enNumber from "d3-format/locale/en-US"
import zhNumber from "d3-format/locale/zh-CN"
import enTime from "d3-time-format/locale/en-US"
import zhTime from "d3-time-format/locale/zh-CN"
import type { SupportedLocale } from "../utils/i18n"

const locales = {
  "en-US": { number: enNumber, time: enTime },
  "zh-CN": { number: zhNumber, time: zhTime },
} satisfies Record<SupportedLocale, { number: typeof enNumber; time: typeof enTime }>

/** Native per-view definitions; published formats retain Vega's own semantics. */
export function artifactVegaLocale(locale: SupportedLocale) {
  return locales[locale]
}
