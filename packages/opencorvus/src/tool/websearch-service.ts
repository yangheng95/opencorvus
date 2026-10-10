import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"
import type { Message } from "@/session/message"
import { exaMcpCall, EXA_MCP_TOOLS } from "./exa-mcp"
import { urlSource } from "./source"

export const DEFAULT_WEB_SEARCH_RESULT_COUNT = 8
export interface WebSearchResult {
  title: string
  url: string
  snippet?: string
  author?: string
  publishedAt?: string
  provider: "exa"
}
export interface WebSearchResponse {
  query: string
  provider: "exa"
  results: WebSearchResult[]
  mcpResult?: CallToolResult
}
export const ExaSearchResultFormatError = NamedError.create(
  "ExaSearchResultFormatError",
  z.object({ text: z.string() }),
)

function optionalExaField(value: string): string | undefined {
  const normalized = value.trim()
  return normalized && normalized !== "N/A" ? normalized : undefined
}

/** Decode the record grammar returned by Exa's hosted Model Context Protocol search tool. */
export function parseExaWebSearchText(text: string): WebSearchResult[] {
  if (!text.trim() || text.trim() === "No search results found. Please try a different query.") return []
  const blocks = text
    .replaceAll("\r\n", "\n")
    .trim()
    .split(/\n---\n(?=\n?Title: )/)
  const results = blocks.map((raw): WebSearchResult => {
    const block = raw.trim()
    const match = block.match(
      /^Title: ([^\n]+)\nURL: (https?:\/\/[^\n]+)\nPublished: ([^\n]*)\nAuthor: ([^\n]*)(?:\n(?:Highlights:\n|Text: )([\s\S]*))?$/,
    )
    if (!match) throw new ExaSearchResultFormatError({ text: block })
    const [, title, url, publishedAt, author, highlights] = match
    return {
      title: title.trim(),
      url: new URL(url.trim()).toString(),
      snippet: highlights?.trim() || undefined,
      publishedAt: optionalExaField(publishedAt),
      author: optionalExaField(author),
      provider: "exa",
    }
  })
  return results
}

export const WebSearchService = {
  async search(input: {
    query: string
    numResults: number
    executionAuthority: SessionExecutionAuthority
    signal?: AbortSignal
  }): Promise<WebSearchResponse> {
    const response = await exaMcpCall({
      executionAuthority: input.executionAuthority,
      name: EXA_MCP_TOOLS.webSearch,
      arguments: { query: input.query, numResults: input.numResults },
      timeoutMs: 25000,
      signal: input.signal,
      label: "Web search",
    })
    return {
      query: input.query,
      provider: "exa",
      results: response ? parseExaWebSearchText(response.text).slice(0, input.numResults) : [],
      mcpResult: response?.result,
    }
  },
}

export function webSearchSources(results: readonly WebSearchResult[]): Message.SourceUrlPayload[] {
  return results.map((result) =>
    urlSource({
      url: result.url,
      title: result.title,
      snippet: result.snippet,
      author: result.author,
      publishedAt: result.publishedAt,
      provider: result.provider,
    }),
  )
}

export function renderWebSearchResults(response: WebSearchResponse): string {
  if (response.results.length === 0) return "No search results found. Please try a different query."
  return response.results
    .map((result, index) =>
      [
        `${index + 1}. ${result.title}`,
        `   URL: ${result.url}`,
        result.publishedAt ? `   Published: ${result.publishedAt}` : undefined,
        result.author ? `   Author: ${result.author}` : undefined,
        result.snippet ? `   ${result.snippet}` : undefined,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    )
    .join("\n\n")
}
