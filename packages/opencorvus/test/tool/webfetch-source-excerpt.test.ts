import { expect, test } from "bun:test"
import { executeWebFetch } from "@/tool/webfetch"
import { Tool } from "@/tool/tool"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { memoryProject } from "../fixture/memory"

test("actual HTTP sources retain readable excerpts and complete UTF-8 prefixes", async () => {
  const cases = [
    { body: "x".repeat(4095) + "🙂tail", excerpt: "x".repeat(4095) },
    { body: "x".repeat(4092) + "🙂tail", excerpt: "x".repeat(4092) + "🙂" },
    { body: "文".repeat(1400), excerpt: "文".repeat(1365) },
    { body: "  Actual text\n    indented line\n", excerpt: "Actual text\n    indented line" },
    {
      body: "Actual image data:image/png;base64,iVBORw== after",
      excerpt: "Actual image attachment:webfetch-embedded-1 after",
    },
  ]
  const html =
    "<html><head><title>Published title</title><style>body{color:red}</style></head><body><header><p>Site banner</p></header><nav><p>Browse navigation</p></nav><div role='navigation'><p>Section links</p></div><aside><p>Related content</p></aside><main><h1>Actual heading</h1><div><br><br><br><br></div><p>Read <a href='/guide'>the guide</a> &amp; 中文.</p></main><footer><p>Legal footer</p></footer><script>privateScript()</script></body></html>"
  const inlineImage = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
  const navigationData = "data:text/plain;base64,TkFW"
  const articleData = "data:text/plain;base64,Qk9EWQ=="
  const attachmentHtml = `<html><head><title>Attachment identity example</title></head><body><img src="${inlineImage}" alt="Inline"><nav><p>Navigation ${navigationData}</p></nav><main><h1>Attachment excerpt</h1><p>Article ${articleData}</p><p>Again ${articleData}</p></main></body></html>`
  await using project = await memoryProject("webfetch-source-excerpt")
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const route = new URL(request.url).pathname.slice(1)
      return new Response(
        route === "html" ? html : route === "attachments" ? attachmentHtml : cases[Number(route)]!.body,
        {
          headers: {
            "content-type": ["html", "attachments"].includes(route)
              ? "text/html; charset=utf-8"
              : "text/plain; charset=utf-8",
          },
        },
      )
    },
  })
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Fetched source excerpt contract" })
        const ctx: Tool.Context = {
          sessionID: session.id,
          messageID: Identifier.ascending("message"),
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
        for (const [index, item] of cases.entries()) {
          const result = await executeWebFetch({ url: `${server.url}${index}`, format: "text" }, ctx)
          expect(result.sources[0]).toMatchObject({
            type: "source-url",
            url: `${server.url}${index}`,
            provider: "opencorvus-webfetch",
            snippet: item.excerpt,
          })
          expect(result.metadata).toMatchObject({ shownBytes: Buffer.byteLength(result.output) })
        }
        const formats = await Promise.all(
          (["text", "markdown", "html"] as const).map((format) =>
            executeWebFetch({ url: `${server.url}html`, format }, ctx),
          ),
        )
        for (const result of formats)
          expect(result.sources[0]).toMatchObject({
            title: "Published title",
            url: `${server.url}html`,
            snippet: "Actual heading\n\nRead the guide & 中文.",
          })
        expect(formats[0]!.output.trim().split(/\n+/)).toEqual([
          "Site banner",
          "Browse navigation",
          "Section links",
          "Related content",
          "Actual heading",
          "Read the guide & 中文.",
          "Legal footer",
        ])
        expect(formats[2]!.output).toBe(html)
        expect(formats.map((result) => result.sources[0]!.sourceId)).toEqual(
          Array(3).fill(formats[0]!.sources[0]!.sourceId),
        )
        for (const format of ["text", "markdown", "html"] as const) {
          const result = await executeWebFetch({ url: `${server.url}attachments`, format }, ctx)
          const articleIndex = format === "text" ? 2 : 3
          expect(result.sources[0]).toMatchObject({
            type: "source-url",
            title: "Attachment identity example",
            snippet: `Attachment excerpt\n\nArticle attachment:webfetch-embedded-${articleIndex}\n\nAgain attachment:webfetch-embedded-${articleIndex}`,
          })
          const attachments = [
            ...(format === "text" ? [] : [{ type: "file", mime: "image/gif", url: inlineImage }]),
            { type: "file", mime: "text/plain", url: navigationData },
            { type: "file", mime: "text/plain", url: articleData },
          ]
          expect(result.attachments).toEqual(attachments)
          expect(result.metadata).toMatchObject({ webfetchEmbeddedAttachmentCount: articleIndex })
          expect(result.output).toContain(`Article attachment:webfetch-embedded-${articleIndex}`)
        }
      },
    })
  } finally {
    await server.stop(true)
  }
})
