import { describe, expect, test } from "bun:test"
import {
  createWebSearchService,
  parseExaWebSearchText,
  renderWebSearchResults,
  webSearchSources,
  type WebSearchProvider,
} from "../../src/tool/websearch-service"

const request = {
  query: "OpenCorvus citations",
  numResults: 2,
  executionAuthority: {
    kind: "conversation" as const,
    sessionID: "session_search_contract",
    projectID: "project_search_contract",
    directory: "C:/project",
  },
}

function provider(id: WebSearchProvider["id"], search: WebSearchProvider["search"]): WebSearchProvider {
  return { id, search }
}

describe("web search provider composition", () => {
  test("decodes Exa records into the shared result and source contracts", () => {
    const results = parseExaWebSearchText(
      [
        "Title: OpenCorvus",
        "URL: https://example.com/opencorvus#overview",
        "Published: 2026-08-10T00:00:00.000Z",
        "Author: Corvus Team",
        "Highlights:",
        "A host-native search and citation system.",
        "---",
        "",
        "Title: Citation protocol",
        "URL: https://example.com/citations",
        "Published: N/A",
        "Author: N/A",
        "Highlights:",
        "URL and document sources use stable identities.",
      ]
        .join("\n")
        .replaceAll("\n", "\r\n"),
    )

    expect({ results, sources: webSearchSources(results) }).toEqual({
      results: [
        {
          title: "OpenCorvus",
          url: "https://example.com/opencorvus#overview",
          publishedAt: "2026-08-10T00:00:00.000Z",
          author: "Corvus Team",
          snippet: "A host-native search and citation system.",
          provider: "exa",
        },
        {
          title: "Citation protocol",
          url: "https://example.com/citations",
          snippet: "URL and document sources use stable identities.",
          provider: "exa",
        },
      ],
      sources: [
        {
          type: "source-url",
          sourceId: expect.any(String),
          url: "https://example.com/opencorvus",
          title: "OpenCorvus",
          publishedAt: "2026-08-10T00:00:00.000Z",
          author: "Corvus Team",
          snippet: "A host-native search and citation system.",
          provider: "exa",
        },
        {
          type: "source-url",
          sourceId: expect.any(String),
          url: "https://example.com/citations",
          title: "Citation protocol",
          snippet: "URL and document sources use stable identities.",
          provider: "exa",
        },
      ],
    })
  })

  test("returns Exa results through the shared response", async () => {
    const exa = provider("exa", async () => [
      { title: "Exa result", url: "https://exa.example/result", provider: "exa" },
    ])
    const host = provider("open-websearch", async () => [
      { title: "Host result", url: "https://host.example/result", provider: "open-websearch" },
    ])
    const result = await createWebSearchService({ exa, host }).search(request)
    expect({ result, rendered: renderWebSearchResults(result) }).toEqual({
      result: {
        query: request.query,
        provider: "exa",
        results: [{ title: "Exa result", url: "https://exa.example/result", provider: "exa" }],
        attempts: [{ provider: "exa", resultCount: 1 }],
      },
      rendered: "1. Exa result\n   URL: https://exa.example/result",
    })
  })

  test("returns Host results after an Exa transport failure", async () => {
    const exa = provider("exa", async () => {
      throw new Error("Exa transport unavailable")
    })
    const host = provider("open-websearch", async () => [
      {
        title: "Host citation",
        url: "https://host.example/citation",
        snippet: "Structured Host result",
        provider: "open-websearch",
      },
    ])
    const result = await createWebSearchService({ exa, host }).search(request)
    expect(result).toEqual({
      query: request.query,
      provider: "open-websearch",
      results: [
        {
          title: "Host citation",
          url: "https://host.example/citation",
          snippet: "Structured Host result",
          provider: "open-websearch",
        },
      ],
      attempts: [
        { provider: "exa", resultCount: 0, error: "Exa transport unavailable" },
        { provider: "open-websearch", resultCount: 1 },
      ],
    })
  })

  test("returns Host results after an empty Exa result set", async () => {
    const exa = provider("exa", async () => [])
    const host = provider("open-websearch", async () => [
      { title: "Host result", url: "https://host.example/result", provider: "open-websearch" },
    ])
    const result = await createWebSearchService({ exa, host }).search(request)
    expect(result).toEqual({
      query: request.query,
      provider: "open-websearch",
      results: [{ title: "Host result", url: "https://host.example/result", provider: "open-websearch" }],
      attempts: [
        { provider: "exa", resultCount: 0 },
        { provider: "open-websearch", resultCount: 1 },
      ],
    })
  })
})
