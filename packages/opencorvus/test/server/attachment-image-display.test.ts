import { afterAll, expect, test } from "bun:test"
import { Hono } from "hono"
import sharp from "sharp"
import { ATTACHMENT_IMAGE_DISPLAY_VARIANT } from "@opencorvus-ai/transport-protocol"
import { Instance } from "../../src/project/instance"
import { AttachmentRoutes } from "../../src/server/routes/attachment"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { serverErrorResponse } from "../../src/server/error-handler"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("image display reports its selected rendition's named failure and keeps the original readable", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const app = new Hono().onError(serverErrorResponse).route("/attachment", AttachmentRoutes())
      const server = Bun.serve({
        hostname: "127.0.0.1", port: 0,
        fetch: (request) => Instance.provide({ directory: project.path, fn: () => app.fetch(request) }),
      })
      try {
        const bytes = Buffer.from("Owned invalid SVG bytes.\n")
        const reference = await AttachmentStore.write(Instance.project.id, bytes, "image/svg+xml", "invalid.png")
        const response = await fetch(new URL(reference.url + `?variant=${ATTACHMENT_IMAGE_DISPLAY_VARIANT}`, server.url))
        expect({ status: response.status, body: await response.json() }).toEqual({
          status: 500,
          body: {
            name: "AttachmentImageRenditionError",
            data: { url: reference.url, variant: AttachmentStore.IMAGE_PREVIEW_VARIANT, message: "Unable to generate an image rendition from this attachment." },
          },
        })
        expect(response.headers.get("x-opencorvus-request-id")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
        const original = await fetch(new URL(reference.url, server.url))
        expect({ status: original.status, mime: original.headers.get("content-type"), bytes: Buffer.from(await original.arrayBuffer()) }).toEqual({
          status: 200, mime: "application/octet-stream", bytes,
        })
      } finally {
        await server.stop(true)
      }
    },
  })
})

test("image display selects verified SVG media and preserves original raster dimensions across suffixes", async () => {
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
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><rect width="1000" height="600" fill="#3660ff"/></svg>')
        const png = await sharp({ create: { width: 5000, height: 12, channels: 3, background: "#3660ff" } }).png().toBuffer()
        const cases = [
          { filename: "vector.dat", mime: "image/svg+xml", bytes: svg, kind: "svg" },
          { filename: "vector.png", mime: "Image/SVG+XML; charset=utf-8", bytes: svg, kind: "svg" },
          { filename: "raster.svg", mime: "image/png", bytes: png, kind: "png" },
          { filename: "binary.svg", mime: "application/octet-stream", bytes: Buffer.from([0, 255, 0, 1]), kind: "binary" },
        ]
        for (const input of cases) {
          const uploadURL = new URL("/attachment", server.url)
          uploadURL.searchParams.set("filename", input.filename)
          const upload = await fetch(uploadURL, { method: "POST", headers: { "content-type": input.mime }, body: input.bytes })
          expect(upload.status).toBe(200)
          const reference = await upload.json() as AttachmentStore.Reference
          const displayURL = new URL(reference.url, server.url)
          displayURL.searchParams.set("variant", ATTACHMENT_IMAGE_DISPLAY_VARIANT)
          const display = await fetch(displayURL)
          const bytes = Buffer.from(await display.arrayBuffer())
          const mime = input.kind === "svg" ? "image/webp" : input.kind === "png" ? "image/png" : "application/octet-stream"
          expect({ status: display.status, mime: display.headers.get("content-type"), size: display.headers.get("content-length"), cache: display.headers.get("cache-control"), sniff: display.headers.get("x-content-type-options") }).toEqual({
            status: 200, mime, size: String(bytes.length), cache: "public, max-age=31536000, immutable", sniff: "nosniff",
          })
          if (input.kind === "svg") {
            const info = await sharp(bytes).metadata()
            expect({ width: info.width, height: info.height, format: info.format }).toEqual({ width: 1000, height: 600, format: "webp" })
            const pixels = await sharp(bytes).raw().toBuffer()
            expect([...pixels.subarray(0, 3)]).toEqual([54, 96, 255])
          } else {
            expect(bytes).toEqual(input.bytes)
            if (input.kind === "png") {
              const info = await sharp(bytes).metadata()
              expect({ width: info.width, height: info.height, format: info.format }).toEqual({ width: 5000, height: 12, format: "png" })
            }
          }
          const repeat = await fetch(displayURL)
          expect({ status: repeat.status, bytes: Buffer.from(await repeat.arrayBuffer()) }).toEqual({ status: 200, bytes })
          const original = await fetch(new URL(reference.url, server.url))
          expect({ status: original.status, mime: original.headers.get("content-type"), disposition: original.headers.get("content-disposition"), bytes: Buffer.from(await original.arrayBuffer()) }).toEqual({
            status: 200, mime: input.kind === "png" ? "image/png" : "application/octet-stream",
            disposition: `${input.kind === "png" ? "inline" : "attachment"}; filename*=UTF-8''${input.filename}`,
            bytes: input.bytes,
          })
          expect(await AttachmentStore.requireReference({ projectID: Instance.project.id, url: reference.url, mime: input.mime })).toEqual(reference)
        }
      } finally {
        await server.stop(true)
      }
    },
  })
})
