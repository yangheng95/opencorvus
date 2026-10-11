import { describe, expect, test } from "bun:test"
import {
  parseExaWebSearchText,
  renderWebSearchResults,
  webSearchSources,
  ExaSearchResultFormatError,
} from "../../src/tool/websearch-service"

describe("current Exa search result contracts", () => {
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
          url: "https://example.com/opencorvus#overview",
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

  test("current Text and metadata-only records preserve source identities", () => {
    const base = "Title: Current document\nURL: https://example.com/current\nPublished: N/A\nAuthor: N/A"
    expect(parseExaWebSearchText(base)).toEqual([
      {
        title: "Current document",
        url: "https://example.com/current",
        publishedAt: undefined,
        author: undefined,
        snippet: undefined,
        provider: "exa",
      },
    ])
    const results = parseExaWebSearchText(base + "\nText: Current complete text")
    expect({ results, rendered: renderWebSearchResults({ query: "current", provider: "exa", results }) }).toEqual({
      results: [
        {
          title: "Current document",
          url: "https://example.com/current",
          publishedAt: undefined,
          author: undefined,
          snippet: "Current complete text",
          provider: "exa",
        },
      ],
      rendered: "1. Current document\n   URL: https://example.com/current\n   Current complete text",
    })
  })

  test("a declared empty search maps to the current empty result contract", () => {
    const results = parseExaWebSearchText("No search results found. Please try a different query.")
    expect({ results, output: renderWebSearchResults({ query: "current", provider: "exa", results }) }).toEqual({
      results: [],
      output: "No search results found. Please try a different query.",
    })
  })
  test("an unknown search record returns its typed original-text error", () => {
    const text = "Current provider diagnostic without a search record"
    expect(() => parseExaWebSearchText(text)).toThrow(new ExaSearchResultFormatError({ text }))
  })
})
