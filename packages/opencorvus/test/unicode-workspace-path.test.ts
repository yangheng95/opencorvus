import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { ProjectRelativePathSchema } from "@opencorvus-ai/plugin/project-path"
import { canonicalWorkspaceTreeJSON } from "@opencorvus-ai/plugin"
import { executionCapsuleSourceTreeSnapshot } from "@/execution-capsule/tree-digest"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test.each(["\u00a0identity.md", "identity.md\u00a0", "\u3000材料.md", "材料/\u3000原文.md"])(
  "preserves the exact Unicode whitespace identity %j through the public path schema",
  (value) => expect(ProjectRelativePathSchema.parse(value)).toBe(value),
)

test.each([
  "../outside.md",
  "folder/../outside.md",
  "/absolute.md",
  "C:/absolute.md",
  "C:drive-relative.md",
  "folder\\file.md",
  "folder//file.md",
  "folder/./file.md",
  "file:stream.md",
  "CON.txt",
  "name.",
  "name ",
  " leading.md",
  "control\nname.md",
  "decompose-e\u0301.md",
])("maps nonportable input %j to the public Zod validation error", (value) => {
  expect(() => ProjectRelativePathSchema.parse(value)).toThrow(z.ZodError)
})

test("the actual Git source snapshot serializes distinct whitespace filenames with their original bytes", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const files = new Map([
        ["identity-427.md", "PLAIN_IDENTITY_427\n"],
        ["\u00a0identity-427.md", "LEADING_NBSP_IDENTITY_427\n"],
        ["identity-427.md\u00a0", "TRAILING_NBSP_IDENTITY_427\n"],
        ["材料/\u3000原文-427.md", "原始全角空白文件内容\n"],
      ])
      for (const [relative, content] of files) {
        const target = path.join(project.path, ...relative.split("/"))
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, content, { flag: "wx" })
      }
      const snapshot = await executionCapsuleSourceTreeSnapshot(project.path)
      const wire = JSON.parse(canonicalWorkspaceTreeJSON(snapshot)) as typeof snapshot
      const actual = wire.files
        .filter((file) => files.has(file.path))
        .map((file) => ({
          path: file.path,
          content: Buffer.from(file.bytes_base64, "base64").toString("utf8"),
        }))
      expect(actual).toEqual(
        [...files]
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([path, content]) => ({ path, content })),
      )
    },
  })
})
