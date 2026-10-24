import { expect, test } from "bun:test"
import { executeWebFetch } from "@/tool/webfetch"
import { Tool } from "@/tool/tool"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { persistMessageSources } from "@/session/source-persistence"
import { urlSource } from "@/tool/source"
import { memoryProject } from "../fixture/memory"

const markdownBodies = {
  "markdown-quoted": '---\ntitle: "发布者 & 标题"\n---\n# Article heading\nActual Markdown body\n',
  "markdown-folded": "---\r\ntitle: >-\r\n  发布者\r\n  完整标题\r\n---\r\nActual Markdown body\r\n",
  "markdown-malformed": "---\ntitle: [unfinished\n---\nActual Markdown body\n",
  "markdown-script": "---javascript\n({ title: 'Computed script label' })\n---\nLiteral remote resource\n",
}

const formatBody =
  "<html><head><title>Format &amp; 标题</title></head><body><h1>Actual heading</h1><p>Actual body</p></body></html>"
const formatMediaTypes = {
  formats: "text/html",
  "formats-uppercase": "TEXT/HTML; charset=utf-8",
  "formats-xhtml": "application/xhtml+xml; charset=utf-8",
  "formats-xhtml-uppercase": "Application/XHTML+XML; charset=utf-8",
  "formats-plain": "text/plain; charset=utf-8",
  "formats-json": 'application/json; profile="text/html"',
}

const textBodies = {
  "text-entities":
    "<html><head><title>Entity &amp; title</title></head><body><p>Arabic: &#x063A;&#x0631;&#x0628; &amp; &#169; &#x1F642;</p><p>Literal: &amp;lt;tag&amp;gt; and &lt;b&gt;</p></body></html>",
  "text-blocks":
    "<h1>Mixed case</h1><p>First <strong>inline</strong> paragraph.</p><p>Second<br>line.</p><div>Third</div><div>Fourth</div>",
  "text-tail": "<p>before<script>blocked()</script> after <em>end</em>.</p>",
  "text-nested": "<p>Before.</p><object><div>Embedded subtree</div>embedded tail</object><p>Visible after.</p>",
  "text-list": "<ul><li>First &amp; one</li><li>Second</li></ul>",
  "text-pre": "<p>Before.</p><pre>    first &lt;tag&gt;\n      indented</pre><p>After.</p>",
  "text-link":
    '<p>Read <a href="https://example.invalid/guide">the guide</a> then <img src="https://example.invalid/image.png" alt="Image metadata">continue.</p>',
}

test("fetched document metadata preserves published titles, resource content and persisted source", async () => {
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
      const formatMediaType = formatMediaTypes[pathname.slice(1) as keyof typeof formatMediaTypes]
      if (formatMediaType) return new Response(formatBody, { headers: { "content-type": formatMediaType } })
      const textBody = textBodies[pathname.slice(1) as keyof typeof textBodies]
      if (textBody) return new Response(textBody, { headers: { "content-type": "text/html; charset=utf-8" } })
      const markdownBody = markdownBodies[pathname.slice(1) as keyof typeof markdownBodies]
      if (markdownBody)
        return new Response(markdownBody, {
          headers: {
            "content-type":
              pathname === "/markdown-folded" ? "text/x-markdown; charset=utf-8" : "text/markdown; charset=utf-8",
          },
        })
      if (pathname === "/xhtml")
        return new Response(
          '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Published XHTML title</title></head><body>Actual XHTML body</body></html>',
          { headers: { "content-type": "application/xhtml+xml; charset=utf-8" } },
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
          urlSource({
            url: `${server.url}title`,
            title: "真正 & 标题 页面",
            snippet: "Actual content",
            provider: "opencorvus-webfetch",
          }),
        ])
        expect(results[1]!.sources).toEqual([
          urlSource({ url: `${server.url}empty`, snippet: "No title", provider: "opencorvus-webfetch" }),
        ])
        expect(results[2]!.output).toBe("<title>Text is not HTML</title>")
        expect(results[2]!.sources).toEqual([
          urlSource({
            url: `${server.url}plain`,
            snippet: "<title>Text is not HTML</title>",
            provider: "opencorvus-webfetch",
          }),
        ])
        expect(results[3]!).toMatchObject({
          output: "Image fetched successfully",
          attachments: [{ type: "file", mime: "image/png", url: "data:image/png;base64,iVBORw==" }],
          sources: [urlSource({ url: `${server.url}image`, provider: "opencorvus-webfetch" })],
        })
        const textResults = await Promise.all(
          Object.keys(textBodies).map((route) =>
            executeWebFetch({ url: `${server.url}${route}`, format: "text" }, ctx),
          ),
        )
        console.log("Owned HTTP plain text outputs", JSON.stringify(textResults.map((value) => value.output)))
        expect(textResults[0]!.output).toBe("Arabic: غرب & © 🙂\n\nLiteral: &lt;tag&gt; and <b>")
        expect(textResults[0]!.sources).toEqual([
          urlSource({
            url: `${server.url}text-entities`,
            title: "Entity & title",
            snippet: "Arabic: غرب & © 🙂\n\nLiteral: &lt;tag&gt; and <b>",
            provider: "opencorvus-webfetch",
          }),
        ])
        expect(textResults[1]!.output.split(/\n+/)).toEqual([
          "Mixed case",
          "First inline paragraph.",
          "Second",
          "line.",
          "Third",
          "Fourth",
        ])
        expect(textResults[2]!.output).toBe("before after end.")
        expect(textResults[3]!.output).toBe("Before.\n\nVisible after.")
        expect(textResults[4]!.output.split(/\n+/).map((line) => line.trim())).toEqual(["* First & one", "* Second"])
        expect(textResults[5]!.output).toBe("Before.\n\n    first <tag>\n      indented\n\nAfter.")
        expect(textResults[6]!.output).toBe("Read the guide then continue.")
        const formats = await Promise.all(
          (["text", "markdown", "html"] as const).map((format) =>
            executeWebFetch({ url: `${server.url}formats`, format }, ctx),
          ),
        )
        const untitled = await executeWebFetch({ url: `${server.url}untitled`, format: "html" }, ctx)
        console.log("Owned HTTP format outputs", JSON.stringify({ formats, untitled }))
        expect(formats.map((value) => value.sources)).toEqual(
          Array.from({ length: 3 }, () => [
            urlSource({
              url: `${server.url}formats`,
              title: "Format & 标题",
              snippet: "Actual heading\n\nActual body",
              provider: "opencorvus-webfetch",
            }),
          ]),
        )
        expect(formats.map((value) => value.output)).toEqual([
          "Actual heading\n\nActual body",
          "Format & 标题\n\n# Actual heading\n\nActual body",
          "<html><head><title>Format &amp; 标题</title></head><body><h1>Actual heading</h1><p>Actual body</p></body></html>",
        ])
        for (const route of ["formats-uppercase", "formats-xhtml", "formats-xhtml-uppercase"] as const) {
          const equivalent = await Promise.all(
            (["text", "markdown", "html"] as const).map((format) =>
              executeWebFetch({ url: `${server.url}${route}`, format }, ctx),
            ),
          )
          expect(equivalent.map((value) => value.output)).toEqual(formats.map((value) => value.output))
          expect(equivalent.map((value) => value.sources)).toEqual(
            Array.from({ length: 3 }, () => [
              urlSource({
                url: `${server.url}${route}`,
                title: "Format & 标题",
                snippet: "Actual heading\n\nActual body",
                provider: "opencorvus-webfetch",
              }),
            ]),
          )
        }
        for (const route of ["formats-plain", "formats-json"] as const) {
          const literal = await Promise.all(
            (["text", "markdown", "html"] as const).map((format) =>
              executeWebFetch({ url: `${server.url}${route}`, format }, ctx),
            ),
          )
          expect(literal.map((value) => value.output)).toEqual(Array(3).fill(formatBody))
          expect(literal.map((value) => value.sources)).toEqual(
            Array.from({ length: 3 }, () => [
              urlSource({ url: `${server.url}${route}`, snippet: formatBody, provider: "opencorvus-webfetch" }),
            ]),
          )
        }
        expect(untitled).toMatchObject({
          output: "<html><body><p>Actual untitled body</p></body></html>",
          sources: [
            urlSource({
              url: `${server.url}untitled`,
              snippet: "Actual untitled body",
              provider: "opencorvus-webfetch",
            }),
          ],
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
          snippet: "Actual content",
        })
        const markdownFormats = await Promise.all(
          (["text", "markdown", "html"] as const).map((format) =>
            executeWebFetch({ url: `${server.url}markdown-quoted`, format }, ctx),
          ),
        )
        expect(markdownFormats.map((value) => value.output)).toEqual(Array(3).fill(markdownBodies["markdown-quoted"]))
        for (const value of markdownFormats)
          expect(value.sources[0]).toMatchObject({
            type: "source-url",
            url: `${server.url}markdown-quoted`,
            title: "发布者 & 标题",
            provider: "opencorvus-webfetch",
          })
        const folded = await executeWebFetch({ url: `${server.url}markdown-folded`, format: "markdown" }, ctx)
        expect(folded).toMatchObject({
          output: markdownBodies["markdown-folded"],
          sources: [
            {
              type: "source-url",
              url: `${server.url}markdown-folded`,
              title: "发布者 完整标题",
              provider: "opencorvus-webfetch",
            },
          ],
        })
        const xhtml = await executeWebFetch({ url: `${server.url}xhtml`, format: "html" }, ctx)
        expect(xhtml.sources[0]).toMatchObject({
          type: "source-url",
          url: `${server.url}xhtml`,
          title: "Published XHTML title",
          provider: "opencorvus-webfetch",
        })
        for (const route of ["markdown-malformed", "markdown-script"] as const) {
          const value = await executeWebFetch({ url: `${server.url}${route}`, format: "markdown" }, ctx)
          expect(value.output).toBe(markdownBodies[route])
          expect(value.sources).toEqual([
            urlSource({
              url: `${server.url}${route}`,
              snippet: markdownBodies[route].trim(),
              provider: "opencorvus-webfetch",
            }),
          ])
        }
        const markdownPersisted = await persistMessageSources({
          sessionID: session.id,
          messageID,
          sources: folded.sources,
        })
        expect(markdownPersisted[0]).toMatchObject({
          type: "source-url",
          url: `${server.url}markdown-folded`,
          title: "发布者 完整标题",
          snippet: markdownBodies["markdown-folded"].trim(),
          sessionID: session.id,
          messageID,
        })
      },
    })
  } finally {
    await server.stop(true)
  }
}, 60_000)
