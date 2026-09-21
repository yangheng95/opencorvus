import { expect, test } from "bun:test"
import {
  ArtifactReadBatchInputSchema,
  ArtifactSearchBatchInputSchema,
  ArtifactSchemaLimits,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { ArtifactOutputBudgetError, artifactReadBatch, artifactSearchBatch } from "@/tool/artifact-batch"

test("independent Artifact queries return ordered results and exact continuations", async () => {
  const queries = [
    { label: "decision", cursor: "" },
    { label: "report", cursor: "" },
  ]
  const result = await artifactSearchBatch(
    queries,
    async (query) => ({
      output: JSON.stringify({ entries: [query.label], next_cursor: query.label === "report" ? "next-report" : null }),
    }),
    (_query, page) => (page.next_cursor ? { cursor: page.next_cursor } : undefined),
  )
  expect(JSON.parse(result.output)).toEqual({
    results: [
      { request_index: 0, value: { entries: ["decision"] } },
      { request_index: 1, value: { entries: ["report"] } },
    ],
    complete: false,
    next_queries: [{ request_index: 1, cursor: "next-report" }],
    pending_queries: [],
  })
})

test("Artifact reads share one byte budget and retain each progressing offset", async () => {
  const reads = [
    { id: "a", byte_offset: 0, max_bytes: 65536 },
    { id: "b", byte_offset: 8, max_bytes: 65536 },
  ]
  const result = await artifactReadBatch(reads, async (read) => ({
    output: JSON.stringify({
      id: read.id,
      text: "x".repeat(read.max_bytes),
      complete: false,
      next_offset: read.byte_offset + read.max_bytes,
    }),
  }))
  const output = JSON.parse(result.output)
  expect(output.results.map((item: any) => item.value.text.length)).toEqual([12288, 12288])
  expect(output.next_reads).toEqual([
    { ...reads[0], byte_offset: 12288 },
    { ...reads[1], byte_offset: 12296 },
  ])
  expect(Buffer.byteLength(result.output) <= ArtifactSchemaLimits.structuredOutputBytes).toBe(true)
})

test("one-item model requests use the same batch schemas", () => {
  expect(
    ArtifactSearchBatchInputSchema.parse({ queries: [{ labels: ["decision", "report"] }] }).queries[0]?.labels,
  ).toEqual(["decision", "report"])
  expect(
    ArtifactReadBatchInputSchema.parse({
      reads: [{ artifact_transport_version: 2, artifact_locator_ref: "al_1234567890abcdef" }],
    }).reads[0],
  ).toEqual({
    artifact_transport_version: 2,
    artifact_locator_ref: "al_1234567890abcdef",
    byte_offset: 0,
    max_bytes: 24576,
    delivery: "inline",
  })
})

test("a long query keeps its nearly full page and a compact continuation", async () => {
  const result = await artifactSearchBatch(
    [{ query: { text: "x".repeat(2048) } }],
    async () => ({
      output: JSON.stringify({ entries: ["x".repeat(38900)], next_cursor: "cursor" }),
    }),
    (_query, page) => ({ cursor: page.next_cursor }),
  )
  const value = JSON.parse(result.output)
  expect(value.results[0].value.entries[0].length).toBe(38900)
  expect(value.next_queries).toEqual([{ request_index: 0, cursor: "cursor" }])
  expect(Buffer.byteLength(result.output) <= ArtifactSchemaLimits.structuredOutputBytes).toBe(true)
})

test("media batches defer a whole attachment when their encoded byte budget fills", async () => {
  const reads = [
    { id: "a", byte_offset: 0, max_bytes: 64 },
    { id: "b", byte_offset: 0, max_bytes: 64 },
  ]
  const payload = "data:image/png;base64," + "a".repeat(17 * 1024 * 1024)
  const result = await artifactReadBatch(reads, async (item) => ({
    output: JSON.stringify({ id: item.id, complete: true, next_offset: null }),
    attachments: [{ type: "file", mime: "image/png", url: payload }],
  }))
  const value = JSON.parse(result.output)
  expect(value.results.map((entry: any) => entry.value.id)).toEqual(["a"])
  expect(value.next_reads).toEqual([reads[1]])
  expect(result.attachments?.length).toBe(1)
})

test("one oversized media item returns its explicit budget error", async () => {
  await expect(
    artifactReadBatch([{ byte_offset: 0, max_bytes: 64 }], async () => ({
      output: JSON.stringify({ complete: true }),
      attachments: [
        { type: "file", mime: "image/png", url: "a".repeat(ArtifactSchemaLimits.batchAttachmentBytes + 1) },
      ],
    })),
  ).rejects.toThrow(
    `One Artifact attachment exceeds the ${ArtifactSchemaLimits.batchAttachmentBytes}-byte batch attachment limit`,
  )
})

test("query continuations and deferred queries compose into a progressing next batch", async () => {
  const queries = [
    { label: "first", cursor: "" },
    { label: "second", cursor: "" },
  ]
  const search = async (query: (typeof queries)[number], budget: number) => {
    if (budget < 2000) throw new ArtifactOutputBudgetError("page exceeds available budget")
    return {
      output: JSON.stringify({
        entries: [query.cursor ? "continued" : "x".repeat(38900)],
        next_cursor: query.cursor ? null : "next",
      }),
    }
  }
  const next = (_query: (typeof queries)[number], page: any) =>
    page.next_cursor ? { cursor: page.next_cursor } : undefined
  const first = JSON.parse((await artifactSearchBatch(queries, search, next)).output)
  expect(first.next_queries).toEqual([{ request_index: 0, cursor: "next" }])
  expect(first.pending_queries).toEqual([1])
  const continued = [
    ...first.next_queries.map(({ request_index, ...patch }: any) => ({ ...queries[request_index], ...patch })),
    ...first.pending_queries.map((index: number) => queries[index]),
  ]
  const second = JSON.parse((await artifactSearchBatch(continued, search, next)).output)
  expect(second.results.map((entry: any) => entry.request_index)).toEqual([0, 1])
  expect(second.results[0].value.entries).toEqual(["continued"])
  expect(second.next_queries).toEqual([{ request_index: 1, cursor: "next" }])
})
