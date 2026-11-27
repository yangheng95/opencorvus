import Decimal from "decimal.js"
import type { HistogramData, PriceFormatCustom, UTCTimestamp, WhitespaceData } from "lightweight-charts"
import type { InteractiveArtifactPayload } from "./interactive-artifact"

type CandleSeries = Extract<InteractiveArtifactPayload, { renderer: "candlestick@1" }>["series"]

export function artifactCandlestickVolumeData(
  series: CandleSeries,
  colors: { up: string; down: string },
): (HistogramData<UTCTimestamp> | WhitespaceData<UTCTimestamp>)[] {
  return series.map((point) => {
    const time = point.time as UTCTimestamp
    return point.volume === undefined
      ? { time }
      : { time, value: point.volume, color: point.close >= point.open ? colors.up : colors.down }
  })
}

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
  const formatPrice = (value: number) => numbers.format(new Decimal(value).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toNumber())
  const priceFormat: PriceFormatCustom = {
    type: "custom",
    base,
    minMove: Number(`1e-${nativePrecision}`),
    formatter: formatPrice,
  }
  return {
    locale,
    priceFormat,
    formatPrice,
    formatTime: (seconds: number) => dates.format(seconds * 1000),
    formatVolume: (value: number) => numbers.format(value),
  }
}
