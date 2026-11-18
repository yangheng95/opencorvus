import { afterAll, expect, test } from "bun:test"
import { Hono } from "hono"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk"
import { Instance } from "../../src/project/instance"
import { AttachmentRoutes } from "../../src/server/routes/attachment"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { serverErrorResponse } from "../../src/server/error-handler"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("a public media conflict returns its named 409 while the published original remains usable", async () => {
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
        const sdk = createOpenCorvusClient({ baseUrl: server.url.toString(), directory: project.path })
        const bytes = Buffer.from("Public published original bytes.\n")
        const upload = (mime: string) => sdk.attachment.create(
          { filename: "original.dat", body: new Blob([new Uint8Array(bytes)], { type: mime }) },
          { headers: { "Content-Type": mime }, throwOnError: false },
        )
        const first = await upload("text/plain")
        expect(first.response.status).toBe(200)
        const original = first.data!
        const conflict = await upload("application/octet-stream")
        expect(conflict.response.status).toBe(409)
        expect(conflict.error).toEqual({
          name: "AttachmentMediaTypeConflictError",
          data: {
            url: original.url, publishedMime: "text/plain", requestedMime: "application/octet-stream",
            message: `Attachment ${original.url} is already published as text/plain; requested application/octet-stream.`,
          },
        })
        const repeated = await upload("text/plain")
        expect(repeated.response.status).toBe(200)
        expect(repeated.data).toEqual(original)
        expect(await AttachmentStore.readVerifiedReference({
          projectID: Instance.project.id, url: original.url, mime: original.mime,
        })).toEqual({ reference: original, bytes })
        const downloaded = await fetch(new URL(original.url, server.url))
        expect(downloaded.status).toBe(200)
        expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes)
      } finally {
        await server.stop(true)
      }
    },
  })
})

const inputs = [
  {
    filename: "raw packet.bin",
    mime: "application/octet-stream",
    bytes: Buffer.from([0, 255, 13, 10, 42]),
    explicitMime: false,
  },
  { filename: "empty note.txt", mime: "text/plain", bytes: Buffer.alloc(0), explicitMime: true },
  {
    filename: "source.png",
    mime: "image/png",
    explicitMime: true,
    bytes: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAK0lEQVR4nO3NQQkAAAgEMGOZ90pZxxQ+hMH+q86cKoFAIBAIBAKBQJAnwQI3XMRbDMx7WQAAAABJRU5ErkJggg==",
      "base64",
    ),
  },
]

for (const input of inputs) {
  test(`the public SDK uploads original bytes for ${input.filename}`, async () => {
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
          const sdk = createOpenCorvusClient({ baseUrl: server.url.toString(), directory: project.path })
          const { data: reference } = await sdk.attachment.create(
            {
              directory: project.path,
              filename: input.filename,
              body: new Blob([new Uint8Array(input.bytes)], { type: input.mime }),
            },
            {
              throwOnError: true,
              ...(input.explicitMime ? { headers: { "Content-Type": input.mime } } : {}),
            },
          )
          expect({ filename: reference.filename, mime: reference.mime, size: reference.size }).toEqual({
            filename: input.filename,
            mime: input.mime,
            size: input.bytes.length,
          })
          expect(AttachmentStore.nameFromUrl(reference.url)).toMatchObject({ projectID: Instance.project.id })
          const stored = await AttachmentStore.readVerifiedReference({
            projectID: Instance.project.id,
            url: reference.url,
            mime: reference.mime,
          })
          expect(stored.bytes).toEqual(input.bytes)
          const response = await fetch(new URL(reference.url, server.url))
          expect({ status: response.status, length: response.headers.get("content-length") }).toEqual({
            status: 200,
            length: String(input.bytes.length),
          })
          expect(Buffer.from(await response.arrayBuffer())).toEqual(input.bytes)
        } finally {
          await server.stop(true)
        }
      },
    })
  })
}
