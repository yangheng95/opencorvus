import { afterAll, expect, test } from "bun:test"
import { Hono } from "hono"
import sharp from "sharp"
import { Instance } from "../../src/project/instance"
import { AttachmentRoutes } from "../../src/server/routes/attachment"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("image preview and thumbnail serve their raster profiles while preserving the canonical SVG", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const app = new Hono().route("/attachment", AttachmentRoutes())
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: (request) => Instance.provide({ directory: project.path, fn: () => app.fetch(request) }),
      })
      try {
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="1000" height="800" fill="#3660ff"/></svg>')
        const reference = await AttachmentStore.write(Instance.project.id, svg, "image/svg+xml", "品牌.svg")
        const fullUrl = new URL(reference.url + "?variant=image-preview", server.url)
        const full = await fetch(fullUrl)
        expect({ status: full.status, mime: full.headers.get("content-type") }).toEqual({ status: 200, mime: "image/webp" })
        const fullBytes = Buffer.from(await full.arrayBuffer())
        const fullInfo = await sharp(fullBytes).metadata()
        expect({ width: fullInfo.width, height: fullInfo.height, format: fullInfo.format }).toEqual({ width: 1000, height: 800, format: "webp" })
        const pixels = await sharp(fullBytes).raw().toBuffer()
        expect([...pixels.subarray(0, 3)]).toEqual([54, 96, 255])
        const repeat = await fetch(fullUrl)
        expect({ status: repeat.status, bytes: Buffer.from(await repeat.arrayBuffer()) }).toEqual({ status: 200, bytes: fullBytes })
        const thumbnail = await fetch(new URL(reference.url + "?variant=screenshot-browser-thumbnail", server.url))
        expect({ status: thumbnail.status, mime: thumbnail.headers.get("content-type") }).toEqual({ status: 200, mime: "image/webp" })
        const thumbnailInfo = await sharp(Buffer.from(await thumbnail.arrayBuffer())).metadata()
        expect({ width: thumbnailInfo.width, height: thumbnailInfo.height }).toEqual({ width: 300, height: 240 })
        const original = await fetch(new URL(reference.url, server.url))
        expect({ status: original.status, mime: original.headers.get("content-type"), disposition: original.headers.get("content-disposition"), sniff: original.headers.get("x-content-type-options") }).toEqual({ status: 200, mime: "application/octet-stream", disposition: "attachment; filename*=UTF-8''%E5%93%81%E7%89%8C.svg", sniff: "nosniff" })
        expect(Buffer.from(await original.arrayBuffer())).toEqual(svg)
      } finally {
        await server.stop(true)
      }
    },
  })
})

test("canonical Office downloads preserve actual bytes, MIME and Unicode filenames over HTTP", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const app = new Hono().route("/attachment", AttachmentRoutes())
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: (request) => Instance.provide({ directory: project.path, fn: () => app.fetch(request) }),
      })
      try {
        for (const [filename, mime, encoded] of [
          [
            "周报.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "%E5%91%A8%E6%8A%A5.docx",
          ],
          ["工时.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "%E5%B7%A5%E6%97%B6.xlsx"],
          [
            "演示.pptx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "%E6%BC%94%E7%A4%BA.pptx",
          ],
        ] as const) {
          // This verifies the transport contract; native Office readability is
          // covered by the Work Artifact lifecycle checker, not these bytes.
          const bytes = Buffer.from(`HTTP attachment contract: ${filename}`)
          const reference = await AttachmentStore.write(Instance.project.id, bytes, mime, filename)
          const response = await fetch(new URL(reference.url, server.url))
          expect({
            status: response.status,
            mime: response.headers.get("content-type"),
            disposition: response.headers.get("content-disposition"),
            size: response.headers.get("content-length"),
          }).toEqual({
            status: 200,
            mime,
            disposition: `inline; filename*=UTF-8''${encoded}`,
            size: String(bytes.length),
          })
          expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
        }
      } finally {
        await server.stop(true)
      }
    },
  })
})

test("PDF stays inline and active SVG stays download-only with canonical names", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const app = new Hono().route("/attachment", AttachmentRoutes())
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: (request) => Instance.provide({ directory: project.path, fn: () => app.fetch(request) }),
      })
      try {
        for (const [filename, mime, bytes, servedMime, disposition] of [
          [
            "review.pdf",
            "application/pdf",
            Buffer.from("%PDF-1.7"),
            "application/pdf",
            "inline; filename*=UTF-8''review.pdf",
          ],
          [
            "vector.svg",
            "image/svg+xml",
            Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
            "application/octet-stream",
            "attachment; filename*=UTF-8''vector.svg",
          ],
        ] as const) {
          const reference = await AttachmentStore.write(Instance.project.id, bytes, mime, filename)
          const response = await fetch(new URL(reference.url, server.url))
          expect({
            status: response.status,
            mime: response.headers.get("content-type"),
            disposition: response.headers.get("content-disposition"),
            sniff: response.headers.get("x-content-type-options"),
          }).toEqual({ status: 200, mime: servedMime, disposition, sniff: "nosniff" })
          expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
        }
      } finally {
        await server.stop(true)
      }
    },
  })
})
