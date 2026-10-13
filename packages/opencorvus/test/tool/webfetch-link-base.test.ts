import { expect, test } from "bun:test"
import { executeWebFetch } from "@/tool/webfetch"
import { Tool } from "@/tool/tool"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { memoryProject } from "../fixture/memory"

const embeddedImage = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
const cases: Array<{
  name: string
  html: string
  contentType?: string
  expected: (origin: string) => string
  original?: string
  attachments?: Array<{ type: "file"; mime: string; url: string }>
}> = [
  {
    name: "document directory and parent image",
    html: '<a href="Etiquette.html">Etiquette</a><p><img src="../logo.svg" alt="Logo"></p>',
    expected: (origin: string) => `[Etiquette](${origin}/docs/Etiquette.html)\n\n![Logo](${origin}/logo.svg)`,
  },
  {
    name: "root query and document fragment",
    html: '<a href="/search?q=one&amp;sort=two#part">Search</a> <a href="#remove">Section</a>',
    expected: (origin: string) =>
      `[Search](${origin}/search?q=one&sort=two#part) [Section](${origin}/docs/page.html?edition=2026#remove)`,
  },
  {
    name: "query reference",
    html: '<a href="?page=2">Next</a>',
    expected: (origin: string) => `[Next](${origin}/docs/page.html?page=2)`,
  },
  {
    name: "protocol relative and international path",
    html: '<a href="//publisher.example/中文?q=%2F#部分">Published</a>',
    expected: () => "[Published](http://publisher.example/%E4%B8%AD%E6%96%87?q=%2F#%E9%83%A8%E5%88%86)",
  },
  {
    name: "first relative document base",
    html: '<base target="_blank"><base href="../published/"><base href="https://other.example/"><a href="chapter.html">Chapter</a>',
    expected: (origin: string) => `[Chapter](${origin}/published/chapter.html)`,
  },
  {
    name: "absolute document base",
    html: '<base href="https://publisher.example/book/"><a href="../index.html">Index</a><img src="diagram.svg" alt="Diagram">',
    expected: () =>
      "[Index](https://publisher.example/index.html)![Diagram](https://publisher.example/book/diagram.svg)",
  },
  ...["data:text/plain,base", "javascript:void(0)", "http://["].map((base) => ({
    name: `document address when first base is ${base}`,
    html: `<base href="${base}"><base href="https://other.example/"><a href="chapter.html">Chapter</a>`,
    expected: (origin: string) => `[Chapter](${origin}/docs/chapter.html)`,
  })),
  {
    name: "nested image link and unchanged literal code",
    html: '<a href="../index.html"><img src="../logo.svg" alt="Home"></a><p><code>&lt;a href="../manual"&gt;</code></p>',
    expected: (origin: string) => `[![Home](${origin}/logo.svg)](${origin}/index.html)\n\n\`<a href="../manual">\``,
  },
  {
    name: "absolute link and mail address",
    html: '<a href="https://publisher.example/a?x=%2f#p">Page</a> <a href="mailto:author@example.test">Author</a>',
    expected: () => "[Page](https://publisher.example/a?x=%2f#p) [Author](mailto:author@example.test)",
  },
  {
    name: "embedded image attachment with published base",
    html: `<base href="https://publisher.example/"><img src="${embeddedImage}" alt="Inline"><a href="chapter">Chapter</a>`,
    expected: () => "![Inline](attachment:webfetch-embedded-1)[Chapter](https://publisher.example/chapter)",
    original:
      '<base href="https://publisher.example/"><img src="attachment:webfetch-embedded-1" alt="Inline"><a href="chapter">Chapter</a>',
    attachments: [{ type: "file", mime: "image/gif", url: embeddedImage }],
  },
  {
    name: "XHTML conversion target",
    contentType: "application/xhtml+xml",
    html: '<html xmlns="http://www.w3.org/1999/xhtml"><head><base href="../published/"></head><body><a href="chapter.html">Chapter</a></body></html>',
    expected: (origin: string) => `[Chapter](${origin}/published/chapter.html)`,
  },
  {
    name: "native Markdown response content",
    contentType: "text/markdown",
    html: "[Authored link](relative.md)",
    expected: () => "[Authored link](relative.md)",
  },
]

for (const item of cases)
  test(`fetched Markdown link targets: ${item.name}`, async () => {
    await using project = await memoryProject()
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === "/redirect")
          return Response.redirect(`${server.url}docs/page.html?edition=2026`, 302)
        return new Response(item.html, { headers: { "content-type": item.contentType ?? "text/html; charset=utf-8" } })
      },
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.create({ kind: "root", title: "HTTP link resolution contract" })
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
          const url = `${server.url}redirect`,
            result = await executeWebFetch({ url, format: "markdown" }, ctx)
          expect(result.output).toBe(item.expected(server.url.origin))
          expect(result.sources[0]).toMatchObject({
            type: "source-url",
            url: `${server.url}docs/page.html?edition=2026`,
            provider: "opencorvus-webfetch",
          })
          const original = await executeWebFetch({ url, format: "html" }, ctx)
          expect(original.output).toBe(item.original ?? item.html)
          if (item.attachments) {
            expect(result.attachments).toEqual(item.attachments)
            expect(original.attachments).toEqual(item.attachments)
          }
          if (item.name === "document directory and parent image") {
            const plain = await executeWebFetch({ url, format: "text" }, ctx)
            expect(plain.output).toBe("Etiquette\n\n")
          }
        },
      })
    } finally {
      await server.stop(true)
    }
  })
