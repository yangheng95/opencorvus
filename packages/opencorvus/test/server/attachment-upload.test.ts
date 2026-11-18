import { afterAll, expect, test } from "bun:test"
import { Hono } from "hono"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk"
import { Instance } from "../../src/project/instance"
import { AttachmentRoutes } from "../../src/server/routes/attachment"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

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
