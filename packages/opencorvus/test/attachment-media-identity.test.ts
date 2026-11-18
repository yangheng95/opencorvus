import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import { Instance } from "@/project/instance"
import { AttachmentStore } from "@/storage/attachment-store"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

for (const state of ["intact", "missing", "damaged"] as const) {
  test(`a published ${state} original retains its media receipt through conflict and byte repair`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const bytes = Buffer.from("Published original bytes.\n")
        const original = await AttachmentStore.write(Instance.project.id, bytes, "text/plain", "original.dat")
        const located = AttachmentStore.nameFromUrl(original.url)!
        const absolute = AttachmentStore.resolveAbsolute(located.projectID, located.name)!
        if (state === "missing") await fs.unlink(absolute)
        if (state === "damaged") await fs.writeFile(absolute, "Damaged bytes")
        const conflict = await AttachmentStore.write(
          Instance.project.id, bytes, "application/octet-stream", "different label.dat",
        ).catch((error: unknown) => error)
        expect(conflict).toBeInstanceOf(AttachmentStore.MediaTypeConflictError)
        expect((conflict as InstanceType<typeof AttachmentStore.MediaTypeConflictError>).toObject()).toEqual({
          name: "AttachmentMediaTypeConflictError",
          data: {
            url: original.url, publishedMime: "text/plain", requestedMime: "application/octet-stream",
            message: `Attachment ${original.url} is already published as text/plain; requested application/octet-stream.`,
          },
        })
        expect(await AttachmentStore.readReference(located.projectID, located.name)).toEqual(original)
        const repaired = await AttachmentStore.write(Instance.project.id, bytes, original.mime, "display alias.dat")
        expect(repaired).toEqual({ ...original, filename: "display alias.dat" })
        expect(await AttachmentStore.readVerifiedReference({
          projectID: Instance.project.id, url: original.url, mime: original.mime,
        })).toEqual({ reference: original, bytes })
      },
    })
  })
}

test("zero-byte originals keep their published media identity and deduplicate", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const bytes = Buffer.alloc(0)
      const original = await AttachmentStore.write(Instance.project.id, bytes, "application/octet-stream", "empty.dat")
      const conflict = await AttachmentStore.write(Instance.project.id, bytes, "text/plain", "empty.dat")
        .catch((error: unknown) => error)
      expect(conflict).toBeInstanceOf(AttachmentStore.MediaTypeConflictError)
      expect((conflict as InstanceType<typeof AttachmentStore.MediaTypeConflictError>).data).toMatchObject({
        url: original.url, publishedMime: original.mime, requestedMime: "text/plain",
      })
      expect(await AttachmentStore.write(Instance.project.id, bytes, original.mime, "empty.dat")).toEqual(original)
      expect(await AttachmentStore.readVerifiedReference({
        projectID: Instance.project.id, url: original.url, mime: original.mime,
      })).toEqual({ reference: original, bytes })
    },
  })
})

test("parallel deduplication, conflicting publication and verified reading share the original receipt", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const bytes = Buffer.from("Parallel original bytes.\n")
      const original = await AttachmentStore.write(Instance.project.id, bytes, "text/plain", "parallel.dat")
      const [repeat, conflict, read] = await Promise.all([
        AttachmentStore.write(Instance.project.id, bytes, original.mime, "parallel.dat"),
        AttachmentStore.write(Instance.project.id, bytes, "application/octet-stream", "parallel.dat")
          .catch((error: unknown) => error),
        AttachmentStore.readVerifiedReference({ projectID: Instance.project.id, url: original.url, mime: original.mime }),
      ])
      expect(repeat).toEqual(original)
      expect(conflict).toBeInstanceOf(AttachmentStore.MediaTypeConflictError)
      expect((conflict as InstanceType<typeof AttachmentStore.MediaTypeConflictError>).data).toMatchObject({
        url: original.url, publishedMime: original.mime, requestedMime: "application/octet-stream",
      })
      expect(read).toEqual({ reference: original, bytes })
    },
  })
})

test("each Project publishes and reads its own media identity for identical original bytes", async () => {
  await using first = await memoryProject()
  await using second = await memoryProject()
  const bytes = Buffer.from("Project-scoped original bytes.\n")
  const rows = await Promise.all([
    { project: first, mime: "text/plain" },
    { project: second, mime: "application/octet-stream" },
  ].map(({ project, mime }) => Instance.provide({
    directory: project.path,
    fn: async () => ({
      projectID: Instance.project.id,
      reference: await AttachmentStore.write(Instance.project.id, bytes, mime, "shared.dat"),
    }),
  })))
  for (const [index, { projectID, reference }] of rows.entries()) {
    expect(reference.mime).toBe(["text/plain", "application/octet-stream"][index])
    expect(AttachmentStore.nameFromUrl(reference.url)).toMatchObject({ projectID })
    expect(await AttachmentStore.readVerifiedReference({ projectID, url: reference.url, mime: reference.mime }))
      .toEqual({ reference, bytes })
  }
})
