import Decimal from "decimal.js"
import type { PriceFormatCustom } from "lightweight-charts"
import type { InteractiveArtifactPayload } from "./interactive-artifact"

type CandleSeries = Extract<InteractiveArtifactPayload, { renderer: "candlestick@1" }>["series"]

export function createArtifactCandlestickPresentation(series: CandleSeries, locale: string) {
  let precision = 0
  for (const point of series) {
    for (const value of [point.open, point.high, point.low, point.close]) {
      const [coefficient, exponent = "0"] = String(value).split("e")
      precision = Math.max(precision, (coefficient!.split(".")[1]?.length ?? 0) - Number(exponent))
    }
  }
  // The native tick denominator must stay finite, including subnormal input.
  const nativePrecision = Math.min(precision, Math.floor(Math.log10(Number.MAX_VALUE)))
  const base = Number(`1e${nativePrecision}`)
  const numbers = new Intl.NumberFormat(locale, { maximumSignificantDigits: 21, useGrouping: false })
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "long", timeZone: "UTC" })
  const priceFormat: PriceFormatCustom = {
    type: "custom",
    base,
    minMove: Number(`1e-${nativePrecision}`),
    formatter: (value) => numbers.format(new Decimal(value).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toNumber()),
  }
  return { locale, priceFormat, formatTime: (seconds: number) => dates.format(seconds * 1000) }
}
