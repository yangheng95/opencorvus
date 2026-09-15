import { describe, expect, test } from "bun:test"
import { createRequire } from "node:module"

// Exercise qs resolved by the actual Model Context Protocol (MCP) SDK consumer.
const require = createRequire(import.meta.url)
const sdkRequire = createRequire(require.resolve("@modelcontextprotocol/sdk/server/streamableHttp.js"))
const expressRequire = createRequire(sdkRequire.resolve("express"))
const consumers = [
  ["MCP SDK", sdkRequire],
  ["Express", expressRequire],
  ["body-parser", createRequire(expressRequire.resolve("body-parser"))],
] as const

for (const [consumer, consumerRequire] of consumers) {
  const qs = consumerRequire("qs")
  describe(`${consumer} query parser dependency`, () => {
    test("parses comma arrays at the declared limit", () => {
      expect(qs.parse("a[]=1,2,3", { comma: true, arrayLimit: 3, throwOnLimitExceeded: true })).toEqual({
        a: [["1", "2", "3"]],
      })
    })

    test("maps an oversized comma array to the documented RangeError", () => {
      expect(() => qs.parse("a[]=1,2,3,4", { comma: true, arrayLimit: 3, throwOnLimitExceeded: true })).toThrow(
        new RangeError("Array limit exceeded. Only 3 elements allowed in an array."),
      )
    })

    test("round trips constructor-shaped query data as ordinary data", () => {
      const query = "x%5Bconstructor%5D%5BisBuffer%5D=y"
      expect(qs.stringify(qs.parse(query, { plainObjects: true }))).toBe(query)
    })
  })
}
