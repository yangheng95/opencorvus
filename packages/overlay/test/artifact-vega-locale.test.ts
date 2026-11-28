import { expect, test } from "bun:test"
import { vega } from "vega-embed"
import { artifactVegaLocale } from "../src/services/artifact-vega-locale"

function nativeLocale(language: Parameters<typeof artifactVegaLocale>[0]) {
  const { number, time } = artifactVegaLocale(language)
  return vega.locale(number, time)
}

test("Vega formats Chinese month, weekday and period through its native locale", () => {
  const locale = nativeLocale("zh-CN")
  const instant = new Date("2026-11-28T11:00:00Z")
  expect(locale.utcFormat("%b %d %A %I %p")(instant)).toBe("十一月 28 星期六 11 上午")
  expect(locale.utcFormat("%x %X")(instant)).toBe("2026年11月28日 11:00:00")
  expect(locale.format(",.2f")(-1234.5)).toBe("−1,234.50")
})

test("Vega formats English through an independent native locale", () => {
  const locale = nativeLocale("en-US")
  const instant = new Date("2026-11-28T18:00:00Z")
  expect(locale.utcFormat("%b %d %A %I %p")(instant)).toBe("Nov 28 Saturday 06 PM")
  expect(locale.utcFormat("%x %X")(instant)).toBe("11/28/2026 6:00:00 PM")
  expect(locale.format(",.2f")(0)).toBe("0.00")
})

test("existing native locales keep their own language when another one is created", () => {
  const chinese = nativeLocale("zh-CN")
  const english = nativeLocale("en-US")
  const instant = new Date("2026-11-29T04:30:00Z")
  expect(chinese.utcFormat("%b %p")(instant)).toBe("十一月 上午")
  expect(english.utcFormat("%b %p")(instant)).toBe("Nov AM")
  expect(chinese.utcFormat("%Y-%m-%d %H:%M UTC")(instant)).toBe("2026-11-29 04:30 UTC")
})
