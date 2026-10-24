import { expect, test } from "bun:test"
import { executeWebFetch } from "@/tool/webfetch"
import { Tool } from "@/tool/tool"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { memoryProject } from "../fixture/memory"

const text = "中文"
const gbk = (value: string) =>
  Buffer.concat(
    value
      .split(text)
      .flatMap((part, index) =>
        index ? [Buffer.from([0xd6, 0xd0, 0xce, 0xc4]), Buffer.from(part)] : [Buffer.from(part)],
      ),
  )
const html = (meta = "") => `<html><head>${meta}<title>${text}</title></head><body><p>${text}</p></body></html>`
const cases = [
  {
    name: "legacy meta pragma",
    type: "text/html",
    content: html('<meta http-equiv="Content-Type" content="text/html; charset=gb2312">'),
    encode: gbk,
    title: text,
  },
  { name: "meta charset", type: "text/html", content: html('<meta charset="gbk">'), encode: gbk, title: text },
  {
    name: "quoted transport charset before meta",
    type: 'TEXT/HTML; CHARSET="GB2312"',
    content: html('<meta charset="utf-8">'),
    encode: gbk,
    title: text,
  },
  {
    name: "UTF-8 BOM before transport charset",
    type: "text/html; charset=gbk",
    content: html('<meta charset="gbk">'),
    encode: (s: string) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(s)]),
    title: text,
  },
  {
    name: "UTF-16 BOM before transport charset",
    type: "text/html; charset=windows-1252",
    content: html(),
    encode: (s: string) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, "utf16le")]),
    title: text,
  },
  {
    name: "UTF-8 document default",
    type: "text/html",
    content: html(),
    encode: (s: string) => Buffer.from(s),
    title: text,
  },
  {
    name: "unknown transport label with declared meta",
    type: "text/html; charset=unknown-encoding",
    content: html('<meta charset="gbk">'),
    encode: gbk,
    title: text,
  },
  {
    name: "commented meta remains comment data",
    type: "text/html",
    content: html('<!-- <meta charset="gbk"> -->'),
    encode: (s: string) => Buffer.from(s),
    title: text,
  },
  {
    name: "XHTML XML declaration",
    type: "application/xhtml+xml",
    content: '<?xml version="1.0" encoding="gb2312"?>' + html(),
    encode: gbk,
    title: text,
  },
  {
    name: "XHTML uses XML encoding rules",
    type: "application/xhtml+xml",
    content: html('<meta charset="gbk">'),
    encode: (s: string) => Buffer.from(s),
    title: text,
  },
  { name: "plain text transport charset", type: "text/plain; charset=gbk", content: text, encode: gbk },
  {
    name: "plain text with literal meta",
    type: "text/plain",
    content: '<meta charset="gbk">' + text,
    encode: (s: string) => Buffer.from(s),
  },
  { name: "Markdown transport charset", type: "text/markdown; charset=gb2312", content: "# " + text, encode: gbk },
  {
    name: "JSON literal meta",
    type: "application/json",
    content: '{"text":"<meta charset=gbk>中文"}',
    encode: (s: string) => Buffer.from(s),
  },
  {
    name: "plain text BOM",
    type: "text/plain",
    content: text,
    encode: (s: string) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, "utf16le")]),
  },
  {
    name: "single-byte HTTP encoding",
    type: "text/plain; charset=iso-8859-1",
    content: "Café",
    encode: () => Buffer.from([0x43, 0x61, 0x66, 0xe9]),
  },
]

for (const item of cases)
  test(`HTTP byte decoding: ${item.name}`, async () => {
    await using project = await memoryProject()
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => new Response(item.encode(item.content), { headers: { "content-type": item.type } }),
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.create({ kind: "root", title: "HTTP character encoding contract" })
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
          const result = await executeWebFetch({ url: server.url.href, format: "html" }, ctx)
          expect(result.output).toBe(item.content)
          expect(result.sources[0]).toEqual({
            type: "source-url",
            sourceId: expect.any(String),
            url: server.url.href,
            provider: "opencorvus-webfetch",
            snippet: "title" in item ? text : item.content.trim(),
            ...("title" in item ? { title: item.title } : {}),
          })
          if (item.name === "legacy meta pragma") {
            const plain = await executeWebFetch({ url: server.url.href, format: "text" }, ctx)
            const markdown = await executeWebFetch({ url: server.url.href, format: "markdown" }, ctx)
            expect(plain.output).toBe(text)
            expect(markdown.output).toBe(`${text}\n\n${text}`)
            expect(plain.sources).toEqual(result.sources)
            expect(markdown.sources).toEqual(result.sources)
          }
        },
      })
    } finally {
      await server.stop(true)
    }
  })
