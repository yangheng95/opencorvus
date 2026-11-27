import { afterAll, expect, test } from "bun:test"
import { Hono } from "hono"
import { routeRequiresProjectDirectory } from "@opencorvus-ai/transport-protocol"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk"
import { Instance } from "../../src/project/instance"
import { AttachmentRoutes } from "../../src/server/routes/attachment"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { serverErrorResponse } from "../../src/server/error-handler"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("the public reference projects verified original media, names and bytes for authorized readers", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const app = new Hono().onError(serverErrorResponse).route("/attachment", AttachmentRoutes())
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (request) => app.fetch(request) })
    try {
      const sdk = createOpenCorvusClient({ baseUrl: server.url.toString() })
      const cases = [
        { filename: "核对脚本.py", mime: "application/octet-stream", bytes: Buffer.from("print('只读原件')\n") },
        { filename: "empty.txt", mime: "text/plain", bytes: Buffer.alloc(0) },
        { filename: "page.txt", mime: "text/html; charset=utf-8", bytes: Buffer.from("<p>原件</p>") },
        { filename: "vector.png", mime: "image/svg+xml", bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') },
        { filename: "latin.pdf", mime: "text/plain; charset=iso-8859-1", bytes: Buffer.from("Caf\xe9", "latin1") },
      ]
      for (const input of cases) {
        const reference = await AttachmentStore.write(Instance.project.id, input.bytes, input.mime, input.filename)
        const name = AttachmentStore.nameFromUrl(reference.url)!.name
        const result = await sdk.attachment.reference({ projectID: Instance.project.id, name }, { throwOnError: true })
        expect({ status: result.response.status, reference: result.data }).toEqual({ status: 200, reference })
        expect(routeRequiresProjectDirectory(`${reference.url}/reference`, "GET")).toBe(false)
        const downloaded = await fetch(new URL(result.data!.url, server.url))
        expect(downloaded.status).toBe(200)
        expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(input.bytes)
      }
      const unnamed = await AttachmentStore.write(Instance.project.id, Buffer.from("Unnamed original\n"), "text/plain")
      const storedName = AttachmentStore.nameFromUrl(unnamed.url)!.name
      const namedProjection = await sdk.attachment.reference(
        { projectID: Instance.project.id, name: storedName }, { throwOnError: true },
      )
      expect(namedProjection.data).toEqual({ ...unnamed, filename: storedName })
      const missing = await fetch(new URL(`/attachment/${Instance.project.id}/missing.txt/reference`, server.url))
      expect({ status: missing.status, message: await missing.text() }).toEqual({ status: 404, message: "Not found" })
    } finally {
      await server.stop(true)
    }
  } })
})
