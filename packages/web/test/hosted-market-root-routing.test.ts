import { describe, expect, test } from "bun:test"
import config from "../config.mjs"
import { hostedMarketApiBase, hostedMarketBasePath } from "../script/hosted-market-server"

describe("root-domain hosted market routing", () => {
  test("maps the canonical site and hosted endpoints to one root-domain contract", () => {
    expect(config).toMatchObject({
      url: "https://opencorvus.com",
      base: "/",
    })
    expect(hostedMarketBasePath).toBe("")
    expect(hostedMarketApiBase).toBe("/api/registry")
  })
})
