import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { AttachmentStore } from "../src/storage/attachment-store"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

test("canonical attachment text has the read-only content contract and an explicit save error", async () => {
  await using project = await memoryProject("attachment-editability")
  await Instance.provide({ directory: project.path, fn: async () => {
    const bytes = Buffer.from("原始附件\r\nsecond line\n")
    const reference = await AttachmentStore.write(Instance.project.id, bytes, "text/plain", "研究附件.txt")
    const located = AttachmentStore.nameFromUrl(reference.url)!
    const absolute = AttachmentStore.resolveAbsolute(located.projectID, located.name)!
    const relative = path.relative(project.path, absolute)
    const expected = { type: "text", content: bytes.toString("utf8") }
    expect(await File.readSource(absolute)).toEqual(expected)
    const control = "editable.txt"
    await fs.writeFile(path.join(project.path, control), bytes)
    const revision = (await File.read(control)).revision!
    await fs.symlink(path.dirname(absolute), path.join(project.path, "attachment-view"), process.platform === "win32" ? "junction" : "dir")
    const paths = [relative, path.join("attachment-view", located.name)]
    if (process.platform === "win32") paths.push(relative.toUpperCase())
    for (const file of paths) {
      expect(await File.read(file)).toEqual({ ...expected, displayName: "研究附件.txt" })
      await expect(File.writeText(file, "replacement", revision)).rejects.toMatchObject({
        name: "FileInvalidPathError",
        data: { path: file, message: `Cannot edit read-only file: ${file}` },
      })
    }
    expect(await fs.readFile(absolute)).toEqual(bytes)
  } })
}, 30_000)

test("same-name attachments expose their original names with each exact text body", async () => {
  await using project = await memoryProject("attachment-content-names")
  await Instance.provide({ directory: project.path, fn: async () => {
    for (const content of ["第一份\r\n", "第二份\n"]) {
      const displayName = " Résumé（终版）.txt"
      const reference = await AttachmentStore.write(Instance.project.id, Buffer.from(content), "text/plain", displayName)
      const located = AttachmentStore.nameFromUrl(reference.url)!
      const absolute = AttachmentStore.resolveAbsolute(located.projectID, located.name)!
      expect(File.Content.parse(await File.read(path.relative(project.path, absolute)))).toEqual({ type: "text", content, displayName })
    }
  } })
}, 30_000)

test.each([
  ["研究图（终版）.png", "image/png", "../../overlay/src-tauri/icons/128x128@2x.png"],
  ["研究报告（终版）.pdf", "application/pdf", "../../web/public/papers/opencorvus-poc.pdf"],
])("encoded attachment content retains %s and exact preview bytes", async (displayName, mimeType, source) => {
  await using project = await memoryProject("attachment-media-" + mimeType)
  await Instance.provide({ directory: project.path, fn: async () => {
    const bytes = await fs.readFile(path.resolve(import.meta.dir, source))
    const reference = await AttachmentStore.write(Instance.project.id, bytes, mimeType, displayName)
    const located = AttachmentStore.nameFromUrl(reference.url)!
    const absolute = AttachmentStore.resolveAbsolute(located.projectID, located.name)!
    const result = File.Content.parse(await File.read(path.relative(project.path, absolute)))
    expect(result).toEqual({ type: "text", content: bytes.toString("base64"), encoding: "base64", mimeType, displayName })
  } })
}, 30_000)

test("unnamed binary attachments use the existing generated display-name policy", async () => {
  await using project = await memoryProject("attachment-generated-name")
  await Instance.provide({ directory: project.path, fn: async () => {
    const reference = await AttachmentStore.write(Instance.project.id, Buffer.from([0, 1, 2]), "application/octet-stream")
    const located = AttachmentStore.nameFromUrl(reference.url)!
    const absolute = AttachmentStore.resolveAbsolute(located.projectID, located.name)!
    expect(await File.read(path.relative(project.path, absolute))).toEqual({
      type: "binary", content: "", displayName: AttachmentStore.displayFilename(reference),
    })
  } })
}, 30_000)

test("missing attachment metadata returns the explicit file-read error contract", async () => {
  await using project = await memoryProject("attachment-missing-display-metadata")
  await Instance.provide({ directory: project.path, fn: async () => {
    const reference = await AttachmentStore.write(Instance.project.id, Buffer.from("metadata required\n"), "text/plain", "原始名称.txt")
    const located = AttachmentStore.nameFromUrl(reference.url)!
    const absolute = AttachmentStore.resolveAbsolute(located.projectID, located.name)!
    const file = path.relative(project.path, absolute)
    await fs.rename(absolute + ".metadata.json", absolute + ".metadata.saved")
    await expect(File.read(file)).rejects.toMatchObject({
      name: "FileNotFoundError", data: { path: file, message: `Attachment metadata not found for file: ${file}` },
    })
  } })
}, 30_000)

test("ordinary copies and attachment metadata retain the conditional editable-file contract", async () => {
  await using project = await memoryProject("attachment-editable-neighbours")
  await Instance.provide({ directory: project.path, fn: async () => {
    const reference = await AttachmentStore.write(Instance.project.id, Buffer.from("attachment\n"), "text/plain", "研究附件.txt")
    const located = AttachmentStore.nameFromUrl(reference.url)!
    const absolute = AttachmentStore.resolveAbsolute(located.projectID, located.name)!
    await fs.copyFile(absolute, path.join(project.path, located.name))
    for (const file of [located.name, path.relative(project.path, absolute + ".metadata.json")]) {
      const loaded = await File.read(file)
      expect(loaded.type).toBe("text")
      expect(typeof loaded.revision).toBe("string")
      const content = loaded.content + "\n"
      const saved = await File.writeText(file, content, loaded.revision!)
      expect(saved).toEqual({ type: "text", content, revision: expect.any(String) })
      expect(await fs.readFile(path.join(project.path, file), "utf8")).toBe(content)
    }
  } })
}, 30_000)
