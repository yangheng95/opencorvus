import { expect, test } from "bun:test"
import { expertSquadPublicMarketURL, expertSquadPublicPageURL } from "../src/services/expert-squad"

for (const [locale, prefix] of [
  ["en-US", "https://opencorvus.com"],
  ["zh-CN", "https://opencorvus.com/zh-cn"],
]) {
  test(`canonical public destinations for ${locale}`, () => {
    expect(expertSquadPublicPageURL({ locale, page: "market" })).toBe(`${prefix}/market/`)
    expect(expertSquadPublicPageURL({ locale, page: "publish" })).toBe(`${prefix}/expert-squads/publish/`)
    expect(expertSquadPublicMarketURL({ locale, namespace: " mirror ", id: " prism " })).toBe(
      `${prefix}/market/mirror/prism/`,
    )
  })
}

test("encodes exact package identity as URL path segments", () => {
  expect(expertSquadPublicMarketURL({ locale: "zh-CN", namespace: "团队", id: "a/b" })).toBe(
    "https://opencorvus.com/zh-cn/market/%E5%9B%A2%E9%98%9F/a%2Fb/",
  )
})

test("maps an empty package identity to the declared input error", () => {
  expect(() => expertSquadPublicMarketURL({ locale: "en-US", namespace: " ", id: "base" })).toThrow(
    "expertSquadPublicMarketURL: namespace and id are required",
  )
})
