import { afterEach, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { AttachmentStore } from "@/storage/attachment-store"
import { canonicalPublishableInteractiveArtifactFromToolPayload } from "@/interactive-artifact/schema"
import { PublishInteractiveArtifactParameters } from "@/tool/publish-interactive-artifact"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

for (const [mime, filename, text] of [
  ["application/octet-stream", "source.py", 'print("附件原件")\n'],
  ["application/xml", "report.xml", "<report><net>35.60</net></report>\n"],
  ["application/schema+json", "schema.json", '{"type":"string"}\n'],
  ["application/javascript", "source.js", 'export const total = "35.60"\n'],
  ["text/x-python", "existing.py", "pass\n"],
  ["application/json", "existing.json", '{"ready":true}\n'],
] as const) {
  test(`text preview preserves the canonical ${mime} original ${filename}`, async () => {
    await using project = await memoryProject("file-preview-text-media")
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const bytes = Buffer.from(text)
        const source = await AttachmentStore.write(Instance.project.id, bytes, mime, filename)
        const input = {
          artifact: { schemaVersion: "1", title: "Original review", content: { renderer: "file-preview@1", kind: "text", source } },
        }
        const accepted = PublishInteractiveArtifactParameters.parse(input)
        expect(accepted).toEqual(input)
        expect(canonicalPublishableInteractiveArtifactFromToolPayload(accepted.artifact)).toEqual({
          schemaVersion: "1", title: "Original review", presentation: undefined,
          renderer: "file-preview@1", kind: "text", source,
        })
        expect(await AttachmentStore.readVerifiedReference({ projectID: Instance.project.id, url: source.url, mime })).toEqual({
          reference: source, bytes,
        })
      },
    })
  }, 30_000)
}

test("opaque originals report the current preview-kind input issue", async () => {
  await using project = await memoryProject("file-preview-opaque-media")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const source = await AttachmentStore.write(Instance.project.id, Buffer.from([0, 31, 128, 255]), "application/octet-stream", "original.bin")
      const result = PublishInteractiveArtifactParameters.safeParse({
        artifact: { schemaVersion: "1", title: "Opaque original", content: { renderer: "file-preview@1", kind: "text", source } },
      })
      if (result.success) throw new Error("Expected the declared preview-kind error contract")
      expect(result.error.issues).toEqual([{
        code: "custom", message: "file preview kind must match attachment MIME", path: ["artifact", "content", "source", "mime"],
      }])
    },
  })
}, 30_000)
