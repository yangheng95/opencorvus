import { ArtifactSchemaLimits } from "@opencorvus-ai/plugin/artifact-catalog"

type Result = { output: string; attachments?: Array<{ type: "file"; mime: string; filename?: string; url: string }> }
const envelopeBytes = 1024

export class ArtifactOutputBudgetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArtifactOutputBudgetError"
  }
}

export async function boundedArtifactPage<T>(
  maximum: number,
  query: (limit: number) => Promise<T>,
  encode: (page: T) => string,
  maxOutputBytes = ArtifactSchemaLimits.structuredOutputBytes - envelopeBytes,
) {
  let lower = 1
  let upper = maximum
  let limit = maximum
  let best: { page: T; output: string } | undefined
  while (lower <= upper) {
    const page = await query(limit)
    const output = encode(page)
    if (Buffer.byteLength(output, "utf8") <= maxOutputBytes) {
      best = { page, output }
      lower = limit + 1
    } else upper = limit - 1
    limit = Math.floor((lower + upper) / 2)
  }
  if (!best) throw new ArtifactOutputBudgetError("Artifact catalog cannot encode one entry within the output budget")
  return best
}

function serializeBatch(value: unknown): string {
  const output = JSON.stringify(value)
  if (Buffer.byteLength(output, "utf8") > ArtifactSchemaLimits.structuredOutputBytes) {
    throw new Error("Artifact batch results and continuations exceed the aggregate output budget")
  }
  return output
}

export async function artifactSearchBatch<T>(
  queries: T[],
  search: (query: T, maxOutputBytes: number) => Promise<Result>,
  next: (query: T, page: any) => Record<string, unknown> | undefined,
) {
  const results: Array<{ request_index: number; value: unknown }> = []
  const nextQueries: Array<Record<string, unknown>> = []
  let pendingQueries: number[] = []
  outer: for (const [index, query] of queries.entries()) {
    const pending = queries.slice(index + 1).map((_, offset) => index + 1 + offset)
    const envelope = JSON.stringify({ results, complete: false, next_queries: nextQueries, pending_queries: pending })
    let budget = ArtifactSchemaLimits.structuredOutputBytes - Buffer.byteLength(envelope) - 128
    let previousBytes: number | undefined
    for (;;) {
      if (budget <= 0) {
        if (results.length === 0)
          throw new ArtifactOutputBudgetError("Artifact query cannot fit one result and its continuation")
        pendingQueries = [index, ...pending]
        break outer
      }
      let result: Result
      try {
        result = await search(query, budget)
      } catch (cause) {
        if (!(cause instanceof ArtifactOutputBudgetError) || results.length === 0) throw cause
        pendingQueries = [index, ...pending]
        break outer
      }
      const page = JSON.parse(result.output)
      const continuation = next(query, page)
      // Cursor ownership lives in one place in the visible batch envelope.
      const { next_cursor: _cursor, next_page_number: _page, ...value } = page
      const candidateResults = [...results, { request_index: index, value }]
      const candidateNext = continuation ? [...nextQueries, { request_index: index, ...continuation }] : nextQueries
      const bytes = Buffer.byteLength(
        JSON.stringify({
          results: candidateResults,
          complete: false,
          next_queries: candidateNext,
          pending_queries: pending,
        }),
      )
      if (bytes <= ArtifactSchemaLimits.structuredOutputBytes) {
        results.push({ request_index: index, value })
        if (continuation) nextQueries.push({ request_index: index, ...continuation })
        break
      }
      if (previousBytes === bytes) {
        if (results.length === 0) throw new Error("Artifact query cannot fit one result and its continuation")
        pendingQueries = [index, ...pending]
        break outer
      }
      previousBytes = bytes
      budget -= bytes - ArtifactSchemaLimits.structuredOutputBytes + 32
    }
  }
  return {
    title: `Artifact queries (${results.length})`,
    metadata: { truncated: false },
    output: serializeBatch({
      results,
      complete: nextQueries.length === 0 && pendingQueries.length === 0,
      next_queries: nextQueries,
      pending_queries: pendingQueries,
    }),
  }
}

export async function artifactReadBatch<T extends { max_bytes: number; byte_offset: number }>(
  reads: T[],
  read: (input: T, index: number) => Promise<Result>,
) {
  const results: Array<{ request_index: number; value: any }> = []
  const nextReads: T[] = []
  const attachments: NonNullable<Result["attachments"]> = []
  let attachmentBytes = 0
  const continuationBytes = Buffer.byteLength(JSON.stringify(reads))
  const perItem = Math.floor(
    (ArtifactSchemaLimits.structuredOutputBytes - envelopeBytes - continuationBytes) / reads.length,
  )
  if (perItem <= 0) throw new ArtifactOutputBudgetError("Artifact read continuations exceed the batch output budget")
  for (const [index, requested] of reads.entries()) {
    let maxBytes = Math.min(requested.max_bytes, Math.floor(ArtifactSchemaLimits.defaultReadBytes / reads.length))
    for (;;) {
      const result = await read({ ...requested, max_bytes: maxBytes }, index)
      const value = JSON.parse(result.output)
      const bytes = (result.attachments ?? []).reduce((sum, attachment) => sum + Buffer.byteLength(attachment.url), 0)
      if (bytes > ArtifactSchemaLimits.batchAttachmentBytes)
        throw new Error(
          `One Artifact attachment exceeds the ${ArtifactSchemaLimits.batchAttachmentBytes}-byte batch attachment limit`,
        )
      if (attachmentBytes + bytes > ArtifactSchemaLimits.batchAttachmentBytes) {
        nextReads.push(requested)
        break
      }
      if (Buffer.byteLength(JSON.stringify({ request_index: index, value }), "utf8") > perItem) {
        if (maxBytes <= 4) throw new Error("Artifact read metadata exceeds the batch output budget")
        maxBytes = Math.max(4, Math.floor(maxBytes / 2))
        continue
      }
      results.push({ request_index: index, value })
      attachments.push(...(result.attachments ?? []))
      attachmentBytes += bytes
      if (!value.complete) {
        if (!Number.isInteger(value.next_offset) || value.next_offset <= requested.byte_offset) {
          throw new Error("Artifact read did not return a progressing continuation")
        }
        nextReads.push({ ...requested, byte_offset: value.next_offset })
      }
      break
    }
  }
  return {
    title: `Artifacts (${results.length})`,
    metadata: { truncated: false },
    output: serializeBatch({ results, complete: nextReads.length === 0, next_reads: nextReads }),
    ...(attachments.length ? { attachments } : {}),
  }
}
