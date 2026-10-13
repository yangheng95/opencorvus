import assert from "node:assert/strict"
import fs from "node:fs/promises"

const target = new URL("/global/usage?period=year&timeZone=America%2FSantiago", process.argv[2])
const response = await fetch(target, { signal: AbortSignal.timeout(15_000) })
assert.equal(response.status, 200)
const body = await response.json()
assert.equal(body.period, "year")
assert.equal(body.timeZone, "America/Santiago")
assert.deepEqual(body.current.summary.tokens, { input: 600, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 600 })
assert.equal(body.current.summary.calls, 3)
assert.equal(body.current.summary.costUSD, 0.006)
assert.deepEqual(body.buckets.map((bucket) => bucket.start), [body.current.start, ...body.buckets.slice(0, -1).map((bucket) => bucket.end)])
assert.equal(body.buckets.at(-1).end, body.current.end)
const occupied = body.buckets.filter((bucket) => bucket.calls > 0).map((bucket) => ({ start: bucket.start, calls: bucket.calls, tokens: bucket.tokens.total, costUSD: bucket.costUSD }))
assert.deepEqual(occupied, [
  { start: Date.parse("2026-09-05T00:00:00-04:00"), calls: 1, tokens: 100, costUSD: 0.001 },
  { start: Date.parse("2026-09-06T01:00:00-03:00"), calls: 1, tokens: 200, costUSD: 0.002 },
  { start: Date.parse("2026-09-07T00:00:00-03:00"), calls: 1, tokens: 300, costUSD: 0.003 },
])
const receipt = { qualification: "Production ledger writer and real loopback HTTP reader using declared artificial statistical inputs", status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), period: body.period, timeZone: body.timeZone, current: body.current, bucketCalls: body.buckets.reduce((sum, bucket) => sum + bucket.calls, 0), bucketTokens: body.buckets.reduce((sum, bucket) => sum + bucket.tokens.total, 0), occupied }
await fs.writeFile(process.argv[3], JSON.stringify(receipt, null, 2))
console.log(JSON.stringify({ status: "passed", calls: receipt.bucketCalls, tokens: receipt.bucketTokens, occupiedBuckets: occupied.length, requestID: receipt.requestID }))
