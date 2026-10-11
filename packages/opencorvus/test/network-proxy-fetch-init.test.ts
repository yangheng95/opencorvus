import { expect, test } from "bun:test"
import { proxiedFetchInit } from "@/util/network-proxy"

test("fetch initialization preserves a caller's standard URL proxy and request fields", () => {
  const proxy = new URL("http://127.0.0.1:32100")
  const signal = new AbortController().signal
  const input = { proxy, signal, headers: { accept: "text/event-stream" } }
  expect(proxiedFetchInit(input)).toBe(input)
  expect(proxiedFetchInit({ proxy: { url: proxy, headers: { "x-proxy-scope": "test" } } })).toEqual({
    proxy: { url: proxy, headers: { "x-proxy-scope": "test" } },
  })
  expect(proxiedFetchInit(input, "http://127.0.0.1:32101", "llmProvider")).toEqual({
    ...input,
    proxy: "http://127.0.0.1:32101",
  })
})
