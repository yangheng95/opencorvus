import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import { Instance } from "../src/project/instance"
import { AttachmentStore } from "../src/storage/attachment-store"
import { tmpdir } from "./fixture/fixture"

afterEach(async () => {
  await Instance.disposeAll()
})

test("aged canonical originals retain their identity during concurrent read, dedup and collection", async () => {
  await using directory = await tmpdir({ git: true })
  await Instance.provide({
    directory: directory.path,
    fn: async () => {
      const bytes = Buffer.from("review: 原始附件\n")
      const reference = await AttachmentStore.write(Instance.project.id, bytes, "text/plain", "review.txt")
      const absolute = AttachmentStore.resolveAbsolute(Instance.project.id, reference.url.split("/").at(-1)!)!
      const metadata = await fs.readFile(`${absolute}.metadata.json`)
      const aged = new Date(Date.now() - 120_000)
      await fs.utimes(absolute, aged, aged)
      const [read, repeated, collection] = await Promise.all([
        AttachmentStore.readVerifiedReference({ projectID: Instance.project.id, url: reference.url }),
        AttachmentStore.write(Instance.project.id, bytes, "text/plain", "review.txt"),
        AttachmentStore.sweep(Instance.project.id),
      ])
      expect(read).toEqual({ reference, bytes })
      expect(repeated).toEqual(reference)
      expect(collection.kept).toBe(1)
      expect(await fs.readFile(`${absolute}.metadata.json`)).toEqual(metadata)
      expect((await fs.stat(absolute)).mtimeMs).toBeCloseTo(aged.getTime(), 0)
    },
  })
})

test("collection reclaims an aged unreferenced blob without publication metadata", async () => {
  await using directory = await tmpdir({ git: true })
  await Instance.provide({
    directory: directory.path,
    fn: async () => {
      const bytes = Buffer.from("Uncommitted publication bytes")
      const reference = await AttachmentStore.write(Instance.project.id, bytes, "text/plain", "partial.txt")
      const absolute = AttachmentStore.resolveAbsolute(Instance.project.id, reference.url.split("/").at(-1)!)!
      await fs.unlink(`${absolute}.metadata.json`)
      const aged = new Date(Date.now() - 120_000)
      await fs.utimes(absolute, aged, aged)
      const result = await AttachmentStore.sweep(Instance.project.id)
      expect({ deleted: result.deleted, bytesFreed: result.bytesFreed }).toEqual({
        deleted: 1,
        bytesFreed: bytes.length,
      })
    },
  })
})

test("a retained malformed publication reports its canonical reader error and preserves original bytes", async () => {
  await using directory = await tmpdir({ git: true })
  await Instance.provide({
    directory: directory.path,
    fn: async () => {
      const bytes = Buffer.from("Diagnostic original")
      const reference = await AttachmentStore.write(Instance.project.id, bytes, "text/plain", "diagnostic.txt")
      const name = reference.url.split("/").at(-1)!
      const absolute = AttachmentStore.resolveAbsolute(Instance.project.id, name)!
      await fs.writeFile(`${absolute}.metadata.json`, "null")
      const aged = new Date(Date.now() - 120_000)
      await fs.utimes(absolute, aged, aged)
      expect((await AttachmentStore.sweep(Instance.project.id)).kept).toBe(1)
      await expect(AttachmentStore.readVerifiedReference({ projectID: Instance.project.id, url: reference.url })).rejects.toThrow(
        `AttachmentStore.readReference: malformed metadata for ${Instance.project.id}/${name}`,
      )
      expect(await fs.readFile(absolute)).toEqual(bytes)
    },
  })
})
