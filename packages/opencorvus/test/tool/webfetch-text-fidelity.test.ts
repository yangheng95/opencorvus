import { expect, test } from "bun:test"
import { executeWebFetch } from "@/tool/webfetch"
import { Tool } from "@/tool/tool"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { memoryProject } from "../fixture/memory"

const budget = 50 * 1024 - 512
const embeddedImage = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
const preformattedHtml = "<p>Before.</p><pre>    first \t\n\n\n\n      second  </pre><p>After.</p>"
const preformattedText = "Before.\n\n    first \t\n\n\n\n      second  \n\nAfter."
const nativeMarkdown = "    indented code\r\n    next\r\n\r\nFirst line  \r\nSecond line\r\n\r\n"
const nativeText = "\t first \t\r\n\r\n\r\n\r\n  second  \r\n"
const originalHtml = " \r\n<pre>  first \t\r\n\r\n\r\n\r\n  second  </pre>\r\n\t "
const fencedCode = "```text\n  first \t\n\n\n\n  second  \n```\n"

type Format = "text" | "markdown" | "html"
type Case = {
  name: string
  contentType: string
  body: string
  format: Format
  expected: string
  clipped?: boolean
  attachments?: Array<{ type: "file"; mime: string; url: string }>
}

const cases: Case[] = [
  {
    name: "HTML line break in Markdown",
    contentType: "text/html",
    body: "<p>First line<br>Second line</p>",
    format: "markdown",
    expected: "First line  \nSecond line",
  },
  {
    name: "XHTML line break in Markdown",
    contentType: "application/xhtml+xml",
    body: '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>第一行<br />第二行</p></body></html>',
    format: "markdown",
    expected: "第一行  \n第二行",
  },
  ...(["markdown", "text"] as const).map((format) => ({
    name: `preformatted converter output as ${format}`,
    contentType: "text/html",
    body: preformattedHtml,
    format,
    expected: preformattedText,
  })),
  ...(["markdown", "text", "html"] as const).flatMap((format) => [
    {
      name: `native Markdown whitespace as ${format}`,
      contentType: "text/markdown",
      body: nativeMarkdown,
      format,
      expected: nativeMarkdown,
    },
    {
      name: `plain text whitespace as ${format}`,
      contentType: "text/plain",
      body: nativeText,
      format,
      expected: nativeText,
    },
  ]),
  {
    name: "original HTML whitespace",
    contentType: "text/html",
    body: originalHtml,
    format: "html",
    expected: originalHtml,
  },
  {
    name: "native Markdown fenced code whitespace",
    contentType: "text/x-markdown",
    body: fencedCode,
    format: "markdown",
    expected: fencedCode,
  },
  {
    name: "whitespace around an externalized embedded attachment",
    contentType: "text/markdown",
    body: `  ![Inline](${embeddedImage})  \nFollowing line\n`,
    format: "markdown",
    expected: "  ![Inline](attachment:webfetch-embedded-1)  \nFollowing line\n",
    attachments: [{ type: "file", mime: "image/gif", url: embeddedImage }],
  },
  {
    name: "exact output byte budget counts boundary whitespace",
    contentType: "text/plain",
    body: " \t" + "x".repeat(budget - 4) + " \n",
    format: "text",
    expected: " \t" + "x".repeat(budget - 4) + " \n",
  },
  {
    name: "clipped first line retains whitespace and a complete Unicode prefix",
    contentType: "text/plain",
    body: "  " + "🙂".repeat(budget) + "  ",
    format: "text",
    expected: "  " + "🙂".repeat(Math.floor((budget - 2) / 4)),
    clipped: true,
  },
  {
    name: "line-first clipping retains the selected line whitespace",
    contentType: "text/plain",
    body: "  heading  \n" + "x".repeat(budget) + "\nend",
    format: "text",
    expected: "  heading  ",
    clipped: true,
  },
  {
    name: "whitespace-only text body",
    contentType: "text/plain",
    body: " \t\r\n\r\n  \n",
    format: "text",
    expected: " \t\r\n\r\n  \n",
  },
]

for (const item of cases)
  test(`HTTP fetched text fidelity: ${item.name}`, async () => {
    await using project = await memoryProject()
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => new Response(item.body, { headers: { "content-type": `${item.contentType}; charset=utf-8` } }),
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.create({ kind: "root", title: "HTTP text fidelity contract" })
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
          const result = await executeWebFetch({ url: server.url.href, format: item.format }, ctx)
          const shownBytes = Buffer.byteLength(item.expected, "utf8")
          const originalBytes = item.clipped ? Buffer.byteLength(item.body, "utf8") : shownBytes
          const omittedBytes = originalBytes - shownBytes
          const expected = item.clipped
            ? item.expected +
              `\n\n[webfetch output clipped: ${shownBytes} of ${originalBytes} bytes shown, ${omittedBytes} bytes omitted from model context]`
            : item.expected
          expect(result.output).toBe(expected)
          expect(result.metadata).toEqual({
            originalBytes,
            shownBytes,
            ...(item.clipped ? { omittedBytes } : {}),
            webfetchOutputClipped: item.clipped ?? false,
            webfetchEmbeddedAttachmentCount: item.attachments?.length ?? 0,
          })
          expect(result.sources[0]).toMatchObject({
            type: "source-url",
            url: server.url.href,
            provider: "opencorvus-webfetch",
          })
          if (item.attachments) expect(result.attachments).toEqual(item.attachments)
        },
      })
    } finally {
      await server.stop(true)
    }
  })
