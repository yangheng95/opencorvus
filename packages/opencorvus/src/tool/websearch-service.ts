import { Config } from "@/config/config"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"
import { assertTaskNetworkCapability } from "@/engine/task-execution-capsule-binding"
import type { Message } from "@/session/message"
import { withKeyedLock } from "@/util/lock"
import { resolveNetworkProxy } from "@/util/network-proxy"
import { exaMcpCall } from "./exa-mcp"
import { urlSource } from "./source"

export const DEFAULT_WEB_SEARCH_RESULT_COUNT = 8
const HOST_SEARCH_REQUEST_TIMEOUT_MS = 20_000
const hostSearchConfigLocks = new Map<string, Promise<unknown>>()

function withAbortSignal<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation
  signal.throwIfAborted()
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener("abort", abort, { once: true })
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
  })
}

export interface WebSearchResult {
  title: string
  url: string
  snippet?: string
  author?: string
  publishedAt?: string
  provider: "exa" | "open-websearch"
}

export interface WebSearchAttempt {
  provider: WebSearchResult["provider"]
  resultCount: number
  error?: string
}

export interface WebSearchResponse {
  query: string
  provider: WebSearchResult["provider"]
  results: WebSearchResult[]
  attempts: WebSearchAttempt[]
}

export interface WebSearchProvider {
  readonly id: WebSearchResult["provider"]
  search(input: {
    query: string
    numResults: number
    executionAuthority: SessionExecutionAuthority
    signal?: AbortSignal
  }): Promise<WebSearchResult[]>
}

function optionalExaField(value: string): string | undefined {
  const normalized = value.trim()
  return normalized && normalized !== "N/A" ? normalized : undefined
}

/** Decode the record grammar returned by Exa's hosted Model Context Protocol search tool. */
export function parseExaWebSearchText(text: string): WebSearchResult[] {
  const blocks = text.replaceAll("\r\n", "\n").trim().split(/\n---\n(?=\n?Title: )/)
  return blocks.flatMap((raw): WebSearchResult[] => {
    const block = raw.replace(/^\n/, "")
    const match = block.match(
      /^Title: ([^\n]+)\nURL: (https?:\/\/[^\n]+)\nPublished: ([^\n]*)\nAuthor: ([^\n]*)\nHighlights:\n([\s\S]*)$/,
    )
    if (!match) return []
    const [, title, url, publishedAt, author, highlights] = match
    return [
      {
        title: title.trim(),
        url: new URL(url.trim()).toString(),
        snippet: highlights.trim() || undefined,
        publishedAt: optionalExaField(publishedAt),
        author: optionalExaField(author),
        provider: "exa",
      },
    ]
  })
}

export const ExaWebSearchProvider: WebSearchProvider = {
  id: "exa",
  async search(input) {
    const result = await exaMcpCall({
      executionAuthority: input.executionAuthority,
      name: "web_search_exa",
      arguments: {
        query: input.query,
        numResults: input.numResults,
      },
      timeoutMs: 25_000,
      signal: input.signal,
      label: "Web search",
    })
    return result ? parseExaWebSearchText(result.text).slice(0, input.numResults) : []
  },
}

export const OpenWebSearchHostProvider: WebSearchProvider = {
  id: "open-websearch",
  async search(input) {
    if (input.executionAuthority.kind === "task") {
      assertTaskNetworkCapability({ taskID: input.executionAuthority.taskID, capability: "Web search" })
    }
    const proxyUrl = resolveNetworkProxy(await Config.get(), "webResearch")
    const operation = withKeyedLock(
      hostSearchConfigLocks,
      "open-websearch",
      async () => {
        const previousQuietStartup = process.env.OPEN_WEBSEARCH_QUIET_STARTUP
        process.env.OPEN_WEBSEARCH_QUIET_STARTUP = "true"
        try {
          const [{ searchBing }, { config }] = await Promise.all([
            import("open-websearch/build/engines/bing/bing.js"),
            import("open-websearch/build/config.js"),
          ])
          const previous = {
            useProxy: config.useProxy,
            proxyUrl: config.proxyUrl,
            playwrightNavigationTimeoutMs: config.playwrightNavigationTimeoutMs,
          }
          try {
            config.useProxy = Boolean(proxyUrl)
            config.proxyUrl = proxyUrl
            config.playwrightNavigationTimeoutMs = HOST_SEARCH_REQUEST_TIMEOUT_MS
            return await searchBing(input.query, input.numResults, { searchMode: "request" })
          } finally {
            Object.assign(config, previous)
          }
        } finally {
          if (previousQuietStartup === undefined) delete process.env.OPEN_WEBSEARCH_QUIET_STARTUP
          else process.env.OPEN_WEBSEARCH_QUIET_STARTUP = previousQuietStartup
        }
      },
      HOST_SEARCH_REQUEST_TIMEOUT_MS * 3,
    )
    const results = await withAbortSignal(operation, input.signal)
    return results.flatMap((result): WebSearchResult[] => {
      try {
        const url = new URL(result.url).toString()
        return [
          {
            title: result.title.trim() || url,
            url,
            snippet: result.description.trim() || undefined,
            provider: "open-websearch",
          },
        ]
      } catch {
        return []
      }
    })
  },
}

export function createWebSearchService(input: { exa?: WebSearchProvider; host?: WebSearchProvider } = {}) {
  const exa = input.exa ?? ExaWebSearchProvider
  const host = input.host ?? OpenWebSearchHostProvider
  return {
    async search(request: {
      query: string
      numResults: number
      executionAuthority: SessionExecutionAuthority
      signal?: AbortSignal
    }): Promise<WebSearchResponse> {
      const attempts: WebSearchAttempt[] = []
      try {
        const results = await exa.search(request)
        attempts.push({ provider: exa.id, resultCount: results.length })
        if (results.length > 0) return { query: request.query, provider: exa.id, results, attempts }
      } catch (error) {
        if (request.signal?.aborted) throw error
        attempts.push({
          provider: exa.id,
          resultCount: 0,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      const results = await host.search(request)
      attempts.push({ provider: host.id, resultCount: results.length })
      return { query: request.query, provider: host.id, results, attempts }
    },
  }
}

export const WebSearchService = createWebSearchService()

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
