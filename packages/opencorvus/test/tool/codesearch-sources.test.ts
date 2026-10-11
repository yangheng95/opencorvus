import { expect, test } from "bun:test"
import {
  EMPTY_CODE_SEARCH_RESULT,
  ExaCodeSearchResultFormatError,
  ExternalCodeSearchTool,
  parseExaCodeSearchSources,
} from "@/tool/codesearch"
import { urlSource } from "@/tool/source"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { Identifier } from "@/id/id"
import { persistMessageSources } from "@/session/source-persistence"
import { memoryProject } from "../fixture/memory"

test("current code-context records preserve complete source facts", () => {
  const snippet = "Use `summary`.\n\n---\n\nThis separator belongs to the same excerpt."
  const text = [
    `Title: Publisher guide\nURL: https://example.com/guide#keyboard\nCode/Highlights:\n${snippet}`,
    "Title: API reference\nURL: https://example.com/api\nText: Current API documentation",
    "Title: N/A\nURL: https://example.com/untitled",
  ].join("\n\n---\n\n")
  expect(parseExaCodeSearchSources(text.replaceAll("\n", "\r\n"))).toEqual([
    urlSource({ title: "Publisher guide", url: "https://example.com/guide#keyboard", snippet, provider: "exa" }),
    urlSource({
      title: "API reference",
      url: "https://example.com/api",
      snippet: "Current API documentation",
      provider: "exa",
    }),
    urlSource({ url: "https://example.com/untitled", provider: "exa" }),
  ])
})

test("declared empty code context yields the empty source contract", () => {
  expect(parseExaCodeSearchSources(EMPTY_CODE_SEARCH_RESULT)).toEqual([])
})

test("an unknown code record returns the typed original-record error", () => {
  const text = "Current provider diagnostic without a code-context record"
  expect(() => parseExaCodeSearchSources(text)).toThrow(new ExaCodeSearchResultFormatError({ text }))
})

test("the model-visible code search parameter projects the current result count", async () => {
  const tool = await ExternalCodeSearchTool.init()
  expect([
    tool.parameters.parse({ query: "details summary" }),
    tool.parameters.parse({ query: "details summary", numResults: 4 }),
  ]).toEqual([
    { query: "details summary", numResults: 8 },
    { query: "details summary", numResults: 4 },
  ])
})

test("real assistant source persistence retains distinct code locations and deduplicates the same location", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Code-search source contract" })
      const messageID = Identifier.ascending("message")
      await Session.updateMessage({
        id: messageID,
        sessionID: session.id,
        role: "assistant",
        author: "build",
        agent: "build",
        time: { created: Date.now() },
        parentID: Identifier.ascending("message"),
        modelID: "fixture",
        providerID: "fixture",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      const sources = parseExaCodeSearchSources(
        "Title: Current guide\nURL: https://example.com/guide#keyboard\nCode/Highlights:\nComplete current excerpt",
      )
      const persisted = await persistMessageSources({ sessionID: session.id, messageID, sources })
      expect(persisted).toMatchObject(sources)
      const pointer = await persistMessageSources({
        sessionID: session.id,
        messageID,
        sources: parseExaCodeSearchSources(
          "Title: Current guide\nURL: https://example.com/guide#pointer\nCode/Highlights:\nComplete current excerpt",
        ),
      })
      await persistMessageSources({
        sessionID: session.id,
        messageID,
        sources: parseExaCodeSearchSources(
          "Title: Current guide\nURL: https://EXAMPLE.com:443/guide#keyboard\nCode/Highlights:\nComplete current excerpt",
        ),
      })
      const parts = await MessageStore.parts(messageID)
      expect(parts).toEqual([...persisted, ...pointer])
      expect(parts.map((part) => part.type === "source-url" ? part.url : part.type)).toEqual([
        "https://example.com/guide#keyboard",
        "https://example.com/guide#pointer",
      ])
    },
  })
})
