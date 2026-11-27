import { expect, test } from "bun:test"
import { artifactCandlestickVolumeData, createArtifactCandlestickPresentation } from "../src/services/artifact-candlestick"

test("candlestick projects optional volume as native whitespace and preserves authored zero and colors", () => {
  expect(artifactCandlestickVolumeData([
    { time: 1, open: 10, high: 12, low: 8, close: 11 },
    { time: 2, open: 11, high: 12, low: 8, close: 10, volume: 0 },
    { time: 3, open: 10, high: 12, low: 8, close: 11, volume: 1.23456789 },
    { time: 4, open: 11, high: 12, low: 8, close: 10, volume: 120 },
  ], { up: "green", down: "red" })).toStrictEqual([
    { time: 1 },
    { time: 2, value: 0, color: "red" },
    { time: 3, value: 1.23456789, color: "green" },
    { time: 4, value: 120, color: "red" },
  ])
})

test("candlestick formats volume at its own authored precision with whole-price candles", () => {
  const next = createArtifactCandlestickPresentation([{ time: 1, open: 10, high: 12, low: 8, close: 11 }], "en-US")
  expect([0, 1.23456789, 1e-9, 120].map(next.formatVolume)).toStrictEqual(["0", "1.23456789", "0.000000001", "120"])
})

test.each([
  ["zh-CN", "2026年11月27日 UTC 10:05:00"],
  ["en-US", "Nov 27, 2026, 10:05:00 AM UTC"],
])("candlestick presents six-decimal prices and source UTC time in %s", (locale, time) => {
  const next = createArtifactCandlestickPresentation([
    { time: 1795773900, open: 0.000019, high: 0.000021, low: 0.000017, close: 0.000018 },
  ], locale)
  expect({ base: next.priceFormat.base, step: next.priceFormat.minMove, price: next.priceFormat.formatter(0.000018), time: next.formatTime(1795773900) })
    .toStrictEqual({ base: 1_000_000, step: 0.000001, price: "0.000018", time })
})

test("candlestick derives a native tick unit from scientific notation", () => {
  const next = createArtifactCandlestickPresentation([
    { time: 1, open: 3.3e-18, high: 4.5e-18, low: 2e-18, close: 4.1e-18 },
  ], "en-US")
  expect({ base: next.priceFormat.base, step: next.priceFormat.minMove, price: next.priceFormat.formatter(4.1e-18) })
    .toStrictEqual({ base: 1e19, step: 1e-19, price: "0.0000000000000000041" })
})

test("candlestick presents calculated native price ticks at the authored decimal unit", () => {
  const next = createArtifactCandlestickPresentation([
    { time: 1, open: 0.000012, high: 0.000015, low: 0.000011, close: 0.000014 },
  ], "en-US")
  expect(next.priceFormat.formatter(0.000012000000000000002)).toBe("0.000012")
})

test("candlestick preserves signed prices with a two-decimal source unit", () => {
  const next = createArtifactCandlestickPresentation([
    { time: 1, open: -12.5, high: 0, low: -12.75, close: -12.25 },
  ], "en-US")
  expect({ base: next.priceFormat.base, step: next.priceFormat.minMove, prices: [-12.5, 0, -12.75, -12.25].map(next.priceFormat.formatter) })
    .toStrictEqual({ base: 100, step: 0.01, prices: ["-12.5", "0", "-12.75", "-12.25"] })
})

test("candlestick uses whole-price ticks for an integer source", () => {
  const next = createArtifactCandlestickPresentation([{ time: 1, open: 10, high: 12, low: 8, close: 11 }], "en-US")
  expect({ base: next.priceFormat.base, step: next.priceFormat.minMove, price: next.priceFormat.formatter(11) })
    .toStrictEqual({ base: 1, step: 1, price: "11" })
})

test("candlestick keeps a finite native denominator and the subnormal source value", () => {
  const value = Number.MIN_VALUE
  const next = createArtifactCandlestickPresentation([{ time: 1, open: value, high: value, low: value, close: value }], "en-US")
  expect({ base: next.priceFormat.base, step: next.priceFormat.minMove, price: next.priceFormat.formatter(value) })
    .toStrictEqual({ base: 1e308, step: 1e-308, price: `0.${"0".repeat(323)}5` })
})
