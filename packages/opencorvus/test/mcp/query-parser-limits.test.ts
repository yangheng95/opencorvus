import { describe, expect, test } from "bun:test"
import { createRequire } from "node:module"
import { once } from "node:events"

// Exercise qs resolved by the actual Model Context Protocol (MCP) SDK consumer.
const require = createRequire(import.meta.url)
const sdkRequire = createRequire(require.resolve("@modelcontextprotocol/sdk/server/streamableHttp.js"))
const expressRequire = createRequire(sdkRequire.resolve("express"))
const channelRequire = createRequire(new URL("../../../channel-runtime/package.json", import.meta.url))
const slackRequire = createRequire(channelRequire.resolve("@slack/bolt"))
const consumers = [
  ["MCP SDK", sdkRequire],
  ["Express", expressRequire],
  ["body-parser", createRequire(expressRequire.resolve("body-parser"))],
  ["Slack Express", createRequire(slackRequire.resolve("express"))],
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

    test("serializes JSON object elements with a string-valued toString in comma arrays", () => {
      const value = JSON.parse('{"a":["b",{"toString":"x"},"c"]}')
      expect(qs.stringify(value, { arrayFormat: "comma" })).toBe("a=b%2C%5Bobject%20Object%5D%2Cc")
      expect(qs.stringify(value, { arrayFormat: "comma", encode: false })).toBe("a=b,[object Object],c")
    })

    test("serializes null-prototype object elements in comma arrays", () => {
      const value = { a: [Object.assign(Object.create(null), { order: "O-001" })] }
      expect(qs.stringify(value, { arrayFormat: "comma" })).toBe("a=%5Bobject%20Object%5D")
    })
  })
}

test("MCP Express dependency serves extended query and form data over HTTP", async () => {
  const express = sdkRequire("express")
  const app = express()
  app.set("query parser", "extended")
  app.use(express.urlencoded({ extended: true }))
  app.post("/orders", (request: { query: unknown; body: unknown }, response: { json(value: unknown): void }) =>
    response.json({ query: request.query, body: request.body }),
  )
  const server = app.listen(0, "127.0.0.1")
  try {
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Expected an assigned TCP port")
    const response = await fetch(`http://127.0.0.1:${address.port}/orders?order[ids][]=O-001&order[ids][]=O-002`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "summary[count]=3&summary[currency]=CNY",
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      query: { order: { ids: ["O-001", "O-002"] } },
      body: { summary: { count: "3", currency: "CNY" } },
    })
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error: Error | undefined) => (error ? reject(error) : resolve())),
    )
  }
})
