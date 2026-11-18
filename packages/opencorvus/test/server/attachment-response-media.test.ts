import { afterAll, expect, test } from "bun:test"
import { Hono } from "hono"
import sharp from "sharp"
import { Instance } from "../../src/project/instance"
import { AttachmentRoutes } from "../../src/server/routes/attachment"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("canonical original responses use their published media and download policy across filename suffixes", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const app = new Hono().route("/attachment", AttachmentRoutes())
      const server = Bun.serve({
        hostname: "127.0.0.1", port: 0,
        fetch: (request) => Instance.provide({ directory: project.path, fn: () => app.fetch(request) }),
      })
      try {
        const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#3660ff" } }).png().toBuffer()
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>')
        const office = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        const cases = [
          { filename: "图片.dat", mime: "image/png", bytes: png, type: "image/png", disposition: "inline" },
          { filename: "pixels.svg", mime: "Image/PNG", bytes: png, type: "Image/PNG", disposition: "inline" },
          { filename: "note.png", mime: "text/plain; charset=utf-8", bytes: Buffer.from("原件文本\n"), type: "text/plain; charset=utf-8", disposition: "inline" },
          { filename: "latin.pdf", mime: "text/plain; charset=iso-8859-1", bytes: Buffer.from("Caf\xe9", "latin1"), type: "text/plain; charset=iso-8859-1", disposition: "inline" },
          { filename: "plain.mp3", mime: "text/plain", bytes: Buffer.from("plain"), type: "text/plain", disposition: "inline" },
          { filename: "empty.mp4", mime: "text/plain; charset=utf-8", bytes: Buffer.alloc(0), type: "text/plain; charset=utf-8", disposition: "inline" },
          { filename: "vector.png", mime: "Image/SVG+XML; charset=utf-8", bytes: svg, type: "application/octet-stream", disposition: "attachment" },
          { filename: "document.jpg", mime: office + "; version=1", bytes: Buffer.from("Office transport contract"), type: office + "; version=1", disposition: "attachment" },
          { filename: "page.txt", mime: "text/html; charset=utf-8", bytes: Buffer.from("<p>Saved original</p>"), type: "application/octet-stream", disposition: "attachment" },
          { filename: "script.png", mime: "text/javascript", bytes: Buffer.from("void 0"), type: "application/octet-stream", disposition: "attachment" },
          { filename: "custom.json", mime: "application/vnd.example.original+json", bytes: Buffer.from('{"original":true}'), type: "application/octet-stream", disposition: "attachment" },
          { filename: "packet.png", mime: "application/octet-stream", bytes: Buffer.from([0, 1, 0, 255]), type: "application/octet-stream", disposition: "attachment" },
          { filename: "data.dat", mime: "application/json; charset=utf-8", bytes: Buffer.from('{"value":42}'), type: "application/json; charset=utf-8", disposition: "inline" },
          // These bytes exercise transport identity; native document/media decoding is independent.
          { filename: "report.bin", mime: "application/pdf", bytes: Buffer.from("%PDF-1.7\n"), type: "application/pdf", disposition: "inline" },
          { filename: "sound.txt", mime: "audio/mpeg", bytes: Buffer.from("audio transport"), type: "audio/mpeg", disposition: "inline" },
          { filename: "clip.txt", mime: "video/mp4", bytes: Buffer.from("video transport"), type: "video/mp4", disposition: "inline" },
        ]
        for (const input of cases) {
          const url = new URL("/attachment", server.url)
          url.searchParams.set("filename", input.filename)
          const uploaded = await fetch(url, { method: "POST", headers: { "content-type": input.mime }, body: input.bytes })
          expect(uploaded.status).toBe(200)
          const reference = await uploaded.json() as AttachmentStore.Reference
          expect({ mime: reference.mime, filename: reference.filename, size: reference.size }).toEqual({
            mime: input.mime, filename: input.filename, size: input.bytes.length,
          })
          for (let read = 0; read < 2; read++) {
            const response = await fetch(new URL(reference.url, server.url))
            const filename = encodeURIComponent(input.filename)
            expect({
              status: response.status, type: response.headers.get("content-type"),
              length: response.headers.get("content-length"), disposition: response.headers.get("content-disposition"),
              cache: response.headers.get("cache-control"), sniff: response.headers.get("x-content-type-options"),
              bytes: Buffer.from(await response.arrayBuffer()),
            }).toEqual({
              status: 200, type: input.type, length: String(input.bytes.length),
              disposition: `${input.disposition}; filename*=UTF-8''${filename}`,
              cache: "public, max-age=31536000, immutable", sniff: "nosniff", bytes: input.bytes,
            })
          }
        }
      } finally {
        await server.stop(true)
      }
    },
  })
})
