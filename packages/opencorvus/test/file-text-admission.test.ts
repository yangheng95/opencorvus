import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { serverErrorResponse } from "../src/server/error-handler"
import { FileRoutes } from "../src/server/routes/file"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

const binaryInputs = [
  { name: "unknown-extension", file: "payload.unknown", bytes: Buffer.from([0x61, 0xff]) },
  { name: "no-extension", file: "payload", bytes: Buffer.from([0xc3, 0x28]) },
  { name: "open-document", file: "document.odt", bytes: Buffer.from([0x50, 0x4b, 3, 4, 0, 0xff]) },
  { name: "invalid-text-extension", file: "invalid.txt", bytes: Buffer.from([0xef, 0xbb, 0xbf, 0xc0, 0xaf]) },
  { name: "nul-text-extension", file: "nul.txt", bytes: Buffer.from("first\0second\n") },
  { name: "invalid-after-4KiB", file: "late-invalid.txt", bytes: Buffer.concat([Buffer.alloc(5000, 0x61), Buffer.from([0xff])]) },
  { name: "nul-after-4KiB", file: "late-nul.txt", bytes: Buffer.concat([Buffer.alloc(5000, 0x61), Buffer.from([0])]) },
]

const textInputs = [
  { file: "unicode.txt", content: "中文 café 😀\n", saved: "修订 naïve 🚀\n" },
  { file: "replacement-character.txt", content: "合法字符 \ufffd\n", saved: "保存字符 \ufffd\n" },
  { file: "bom.txt", content: "\ufeff带签名\r\n", saved: "\ufeff保存后\r\n" },
  { file: "crlf.txt", content: "first\r\nsecond\r\n", saved: "edited\r\nsecond\r\n" },
  { file: "README", content: "无扩展文本\n", saved: "已保存\n" },
  { file: "text.unknown", content: "unknown extension, valid UTF-8\n", saved: "updated\n" },
  { file: "empty.txt", content: "", saved: "" },
]

const invalidContentInputs = [
  { name: "nul", content: "first\0second" },
  { name: "nul-after-4KiB", content: "a".repeat(5000) + "\0" },
  { name: "lone-high-surrogate", content: "first\ud800second" },
  { name: "lone-low-surrogate", content: "first\udc00second" },
]

for (const input of binaryInputs) {
  test(`project and source readers classify ${input.name} by all original bytes`, async () => {
    await using project = await memoryProject(`file-text-read-${input.name}`)
    const absolute = path.join(project.path, input.file)
    await fs.writeFile(absolute, input.bytes)
    await Instance.provide({ directory: project.path, fn: async () => {
      const projectContent = await File.read(input.file)
      const sourceContent = await File.readSource(absolute)
      expect({ project: projectContent, source: sourceContent }).toEqual({
        project: { type: "binary", content: "" },
        source: { type: "binary", content: "" },
      })
      expect(await fs.readFile(absolute)).toEqual(input.bytes)
    } })
  }, 30_000)

  test(`saving ${input.name} returns the binary-file error contract with exact original bytes`, async () => {
    await using project = await memoryProject(`file-text-save-${input.name}`)
    const absolute = path.join(project.path, input.file)
    await Instance.provide({ directory: project.path, fn: async () => {
      await fs.writeFile(absolute, "initial text\n")
      const initial = await File.read(input.file)
      await fs.writeFile(absolute, input.bytes)
      const current = await File.read(input.file)
      await expect(File.writeText(input.file, "replacement\n", current.revision ?? initial.revision!)).rejects.toMatchObject({
        name: "FileInvalidPathError",
        data: { path: input.file, message: `Cannot edit binary file: ${input.file}` },
      })
      expect(await fs.readFile(absolute)).toEqual(input.bytes)
    } })
  }, 30_000)
}

for (const input of textInputs) {
  test(`valid UTF-8 ${input.file} retains exact text and conditional-save bytes`, async () => {
    await using project = await memoryProject(`file-text-valid-${input.file}`)
    const absolute = path.join(project.path, input.file)
    await fs.writeFile(absolute, input.content)
    await Instance.provide({ directory: project.path, fn: async () => {
      const loaded = await File.read(input.file)
      expect(loaded).toEqual({ type: "text", content: input.content, revision: expect.any(String) })
      expect(await File.readSource(absolute)).toEqual({ type: "text", content: input.content })
      const saved = await File.writeText(input.file, input.saved, loaded.revision!)
      expect(saved).toEqual({ type: "text", content: input.saved, revision: expect.any(String) })
      expect(await File.read(input.file)).toEqual(saved)
      expect(await File.readSource(absolute)).toEqual({ type: "text", content: input.saved })
      expect(await fs.readFile(absolute)).toEqual(Buffer.from(input.saved, "utf8"))
    } })
  }, 30_000)
}

for (const input of invalidContentInputs) {
  test(`saving ${input.name} content returns the text-input error contract and keeps the loaded bytes`, async () => {
    await using project = await memoryProject(`file-text-input-${input.name}`)
    const file = "editable.txt"
    const absolute = path.join(project.path, file)
    const original = Buffer.from("\ufeff原文\r\n")
    await fs.writeFile(absolute, original)
    await Instance.provide({ directory: project.path, fn: async () => {
      const loaded = await File.read(file)
      await expect(File.writeText(file, input.content, loaded.revision!)).rejects.toMatchObject({
        name: "FileInvalidPathError",
        data: { path: file, message: `Cannot save content as lossless UTF-8 text without null bytes: ${file}` },
      })
      expect(await File.read(file)).toEqual(loaded)
      expect(await fs.readFile(absolute)).toEqual(original)
    } })
  }, 30_000)
}

test("real HTTP file routes expose binary reads, explicit save errors, and exact Unicode saves", async () => {
  await using project = await memoryProject("file-text-http")
  const app = new Hono().onError(serverErrorResponse).route("/", FileRoutes())
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => Instance.provide({ directory: project.path, fn: async () => app.fetch(request) }),
  })
  async function request(route: string, body?: object) {
    const response = await fetch(new URL(route, server.url), {
      ...(body ? { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    })
    return { status: response.status, body: await response.json() }
  }
  try {
    for (const input of binaryInputs) {
      const absolute = path.join(project.path, input.file)
      const route = `/file/content?${new URLSearchParams({ path: input.file })}`
      await fs.writeFile(absolute, "initial text\n")
      const initial = await request(route)
      expect(initial.status).toBe(200)
      await fs.writeFile(absolute, input.bytes)
      const loaded = await request(route)
      const source = await request(`/file/source-content?${new URLSearchParams({ path: absolute })}`)
      const saved = await request("/file/content", {
        path: input.file,
        content: "replacement\n",
        expectedRevision: loaded.body.revision ?? initial.body.revision,
      })
      console.log("[file-text HTTP]", JSON.stringify({ file: input.file, readType: loaded.body.type, sourceType: source.body.type, saveStatus: saved.status, saveError: saved.body.name }))
      expect(saved).toEqual({
        status: 400,
        body: { name: "FileInvalidPathError", data: { path: input.file, message: `Cannot edit binary file: ${input.file}` } },
      })
      expect({ project: loaded, source }).toEqual({
        project: { status: 200, body: { type: "binary", content: "" } },
        source: { status: 200, body: { type: "binary", content: "" } },
      })
      expect(await fs.readFile(absolute)).toEqual(input.bytes)
    }
    for (const input of textInputs) {
      const absolute = path.join(project.path, input.file)
      await fs.writeFile(absolute, input.content)
      const loaded = await request(`/file/content?${new URLSearchParams({ path: input.file })}`)
      expect(loaded).toEqual({ status: 200, body: { type: "text", content: input.content, revision: expect.any(String) } })
      const saved = await request("/file/content", { path: input.file, content: input.saved, expectedRevision: loaded.body.revision })
      expect(saved).toEqual({ status: 200, body: { type: "text", content: input.saved, revision: expect.any(String) } })
      expect(await request(`/file/source-content?${new URLSearchParams({ path: absolute })}`)).toEqual({
        status: 200, body: { type: "text", content: input.saved },
      })
      expect(await fs.readFile(absolute)).toEqual(Buffer.from(input.saved, "utf8"))
    }
    const file = "http-editable.txt"
    const absolute = path.join(project.path, file)
    const original = Buffer.from("\ufeff原文\r\n")
    await fs.writeFile(absolute, original)
    const loaded = await request(`/file/content?${new URLSearchParams({ path: file })}`)
    for (const input of invalidContentInputs) {
      const saved = await request("/file/content", { path: file, content: input.content, expectedRevision: loaded.body.revision })
      expect(saved).toEqual({
        status: 400,
        body: { name: "FileInvalidPathError", data: { path: file, message: `Cannot save content as lossless UTF-8 text without null bytes: ${file}` } },
      })
      expect(await request(`/file/content?${new URLSearchParams({ path: file })}`)).toEqual(loaded)
      expect(await fs.readFile(absolute)).toEqual(original)
    }
  } finally {
    await server.stop(true)
  }
}, 60_000)
