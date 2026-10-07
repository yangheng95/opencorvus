import { expect, test } from "bun:test"
import { executeWebFetch } from "@/tool/webfetch"
import { Tool } from "@/tool/tool"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { persistMessageSources } from "@/session/source-persistence"
import { urlSource } from "@/tool/source"
import { memoryProject } from "../fixture/memory"

test("real fetched HTML titles preserve decoded identity, redirect URL and persisted source", async () => {
  await using project = await memoryProject()
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      const pathname = new URL(request.url).pathname
      if (pathname === "/redirect") return Response.redirect(`${server.url}title`, 302)
      if (pathname === "/title")
        return new Response(
          "<!doctype html><html><head><title>  真正 &amp; 标题\n 页面  </title></head><body><p>Actual content</p><script>document.title='Invented script title'</script></body></html>",
          { headers: { "content-type": "text/html; charset=utf-8" } },
        )
      if (pathname === "/empty")
        return new Response("<html><head><title> \n </title></head><body>No title</body></html>", {
          headers: { "content-type": "text/html" },
        })
      if (pathname === "/plain")
        return new Response("<title>Text is not HTML</title>", { headers: { "content-type": "text/plain" } })
      if (pathname === "/untitled")
        return new Response("<html><body><p>Actual untitled body</p></body></html>", {
          headers: { "content-type": "text/html" },
        })
      if (pathname === "/formats")
        return new Response(
          "<html><head><title>Format &amp; 标题</title></head><body><h1>Actual heading</h1><p>Actual body</p></body></html>",
          { headers: { "content-type": "text/html" } },
        )
      return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } })
    },
  })
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Owned HTTP title contract" })
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
          ["redirect", "empty", "plain", "image"].map((route) =>
            executeWebFetch({ url: `${server.url}${route}`, format: "html" }, ctx),
          ),
        )
        console.log(
          "Owned HTTP title outputs",
          JSON.stringify(
            results.map((value) => ({
              title: value.title,
              sources: value.sources,
              output: value.output,
              attachments: value.attachments,
            })),
          ),
        )
        expect(results[0]!.sources).toEqual([
          urlSource({ url: `${server.url}title`, title: "真正 & 标题 页面", provider: "opencorvus-webfetch" }),
        ])
        expect(results[1]!.sources).toEqual([urlSource({ url: `${server.url}empty`, provider: "opencorvus-webfetch" })])
        expect(results[2]!.output).toBe("<title>Text is not HTML</title>")
        expect(results[2]!.sources).toEqual([urlSource({ url: `${server.url}plain`, provider: "opencorvus-webfetch" })])
        expect(results[3]!).toMatchObject({
          output: "Image fetched successfully",
          attachments: [{ type: "file", mime: "image/png", url: "data:image/png;base64,iVBORw==" }],
          sources: [urlSource({ url: `${server.url}image`, provider: "opencorvus-webfetch" })],
        })
        const formats = await Promise.all(
          (["text", "markdown", "html"] as const).map((format) =>
            executeWebFetch({ url: `${server.url}formats`, format }, ctx),
          ),
        )
        const untitled = await executeWebFetch({ url: `${server.url}untitled`, format: "html" }, ctx)
        console.log("Owned HTTP format outputs", JSON.stringify({ formats, untitled }))
        expect(formats.map((value) => value.sources)).toEqual(
          Array.from({ length: 3 }, () => [
            urlSource({ url: `${server.url}formats`, title: "Format & 标题", provider: "opencorvus-webfetch" }),
          ]),
        )
        expect(formats.map((value) => value.output)).toEqual([
          "Format &amp; 标题Actual headingActual body",
          "Format & 标题\n\n# Actual heading\n\nActual body",
          "<html><head><title>Format &amp; 标题</title></head><body><h1>Actual heading</h1><p>Actual body</p></body></html>",
        ])
        expect(untitled).toMatchObject({
          output: "<html><body><p>Actual untitled body</p></body></html>",
          sources: [urlSource({ url: `${server.url}untitled`, provider: "opencorvus-webfetch" })],
        })
        const persisted = await persistMessageSources({
          sessionID: session.id,
          messageID,
          sources: results[0]!.sources,
        })
        expect(persisted[0]).toMatchObject({
          type: "source-url",
          url: `${server.url}title`,
          title: "真正 & 标题 页面",
          sessionID: session.id,
          messageID,
        })
      },
    })
  } finally {
    await server.stop(true)
  }
}, 60_000)
