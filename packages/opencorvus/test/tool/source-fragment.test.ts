import { expect, test } from "bun:test"
import { canonicalSourceUrl } from "@/tool/source"
import { executeWebFetch } from "@/tool/webfetch"
import { Tool } from "@/tool/tool"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { persistMessageSources } from "@/session/source-persistence"
import { MessageStore } from "@/session/message-store"
import { memoryProject } from "../fixture/memory"

test("source URL serialization preserves the precise navigation location", () => {
  expect(canonicalSourceUrl("HTTPS://EXAMPLE.COM:443/Guide?View=Full#Section-A")).toBe(
    "https://example.com/Guide?View=Full#Section-A",
  )
  expect(canonicalSourceUrl("https://example.com/Guide#:~:text=Exact%20words")).toBe(
    "https://example.com/Guide#:~:text=Exact%20words",
  )
})

test("real HTTP sources and persisted citations retain distinct chapters and final redirect locations", async () => {
  await using project = await memoryProject()
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/redirect")
        return Response.redirect(`${server.url}article#technical_summary`, 302)
      return new Response("<html><head><title>Published chapters</title></head><body>Actual article</body></html>", {
        headers: { "content-type": "text/html" },
      })
    },
  })
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "HTTP chapter citations" })
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
        const ctx: Tool.Context = {
          sessionID: session.id,
          messageID,
          agent: "build",
          abort: new AbortController().signal,
          messages: [],
          executionAuthority: {
            kind: "conversation",
            sessionID: session.id,
            projectID: Instance.project.id,
            directory: project.path,
          },
          executionSurface: Tool.executionSurface(["webfetch"], []),
          metadata() {},
        }
        const results = await Promise.all(
          ["article#examples", "article#technical_summary", "redirect#original"].map((location) =>
            executeWebFetch({ url: `${server.url}${location}`, format: "html" }, ctx),
          ),
        )
        expect(results.map((result) => result.sources[0])).toMatchObject([
          { type: "source-url", url: `${server.url}article#examples`, title: "Published chapters" },
          { type: "source-url", url: `${server.url}article#technical_summary`, title: "Published chapters" },
          { type: "source-url", url: `${server.url}article#technical_summary`, title: "Published chapters" },
        ])
        const expected = await persistMessageSources({
          sessionID: session.id,
          messageID,
          sources: results.slice(0, 2).flatMap((result) => result.sources),
        })
        await persistMessageSources({ sessionID: session.id, messageID, sources: results[2]!.sources })
        const parts = await MessageStore.parts(messageID)
        expect(parts).toEqual(expected)
        expect(parts.map((part) => part.type === "source-url" ? part.url : part.type)).toEqual([
          `${server.url}article#examples`,
          `${server.url}article#technical_summary`,
        ])
      },
    })
  } finally {
    await server.stop(true)
  }
}, 60_000)
