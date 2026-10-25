import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { once } from "node:events"
import { Readable } from "node:stream"
import { File } from "../../src/file"
import { ConfigPaths } from "../../src/config/paths"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function configure(directory: string) {
  const config = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, JSON.stringify({ model: "missing-file-download/model", small_model: "missing-file-download/model" }))
}

async function download(directory: string, file: string) {
  await Instance.disposeAll()
  return runOutsideInstanceContext(() => Server.App().request(
    `/file/download?${new URLSearchParams({ path: file })}`,
    { headers: { "x-opencorvus-directory": directory } },
  ))
}

test("cold original downloads retain Project bytes and UTF-8 filenames with unavailable models", async () => {
  await using first = await memoryProject("download-first")
  await using second = await memoryProject("download-second")
  const filename = "交付资料 (版本1)'!.zip"
  for (const [directory, bytes] of [
    [first.path, Buffer.from([0x50, 0x4b, 5, 6, ...new Array(18).fill(0)])],
    [second.path, Buffer.from([0, 255, 127, 128, 13, 10, 1])],
  ] as const) {
    await configure(directory)
    await fs.writeFile(path.join(directory, filename), bytes)
    const response = await download(directory, filename)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/octet-stream")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    const disposition = response.headers.get("content-disposition")!
    expect(disposition.split("; ")[0]).toBe("attachment")
    expect(decodeURIComponent(disposition.split("filename*=UTF-8''")[1]!)).toBe(filename)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
  }
}, 30_000)

test("empty original files have a successful exact byte response", async () => {
  await using project = await memoryProject("download-empty")
  await configure(project.path)
  await fs.writeFile(path.join(project.path, "empty.bin"), Buffer.alloc(0))
  const response = await download(project.path, "empty.bin")
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toBe("application/octet-stream")
  expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.alloc(0))
}, 30_000)

test("text and JSON originals retain the binary download response contract", async () => {
  await using project = await memoryProject("download-original-content-types")
  await configure(project.path)
  for (const [filename, text] of [["original.txt", "原始文本\r\n"], ["original.json", '{"source":"原件"}\n']]) {
    const bytes = Buffer.from(text!)
    await fs.writeFile(path.join(project.path, filename!), bytes)
    const response = await download(project.path, filename!)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/octet-stream")
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
  }
}, 30_000)

test("in-scope directory aliases download the exact physical file bytes", async () => {
  await using project = await memoryProject("download-in-scope-link")
  await configure(project.path)
  const folder = path.join(project.path, "originals")
  await fs.mkdir(folder)
  const bytes = Buffer.from([0, 255, 3, 128])
  await fs.writeFile(path.join(folder, "payload.bin"), bytes)
  await fs.symlink(folder, path.join(project.path, "view"), process.platform === "win32" ? "junction" : "dir")
  const response = await download(project.path, "view/payload.bin")
  expect(response.status).toBe(200)
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
}, 30_000)

test("out-of-scope directory aliases return the project-path error contract", async () => {
  await using project = await memoryProject("download-link-owner")
  await using outside = await memoryProject("download-link-outside")
  await configure(project.path)
  await fs.writeFile(path.join(outside.path, "payload.bin"), Buffer.from([0, 255, 6]))
  await fs.symlink(outside.path, path.join(project.path, "external"), process.platform === "win32" ? "junction" : "dir")
  const response = await download(project.path, "external/payload.bin")
  expect({ status: response.status, body: await response.json() }).toMatchObject({
    status: 400, body: { name: "FileInvalidPathError", data: { path: "external/payload.bin" } },
  })
}, 30_000)

test("canonical attachment original downloads retain the registered user filename", async () => {
  await using project = await memoryProject("download-attachment")
  await configure(project.path)
  const bytes = Buffer.from([0, 1, 2, 255, 128])
  const file = await Instance.provide({ directory: project.path, fn: async () => {
    const reference = await AttachmentStore.write(Instance.project.id, bytes, "application/octet-stream", "原始数据.bin")
    const located = AttachmentStore.nameFromUrl(reference.url)!
    return path.relative(project.path, AttachmentStore.resolveAbsolute(located.projectID, located.name)!)
  } })
  const response = await download(project.path, file)
  expect(response.status).toBe(200)
  const disposition = response.headers.get("content-disposition")!
  expect(decodeURIComponent(disposition.split("filename*=UTF-8''")[1]!)).toBe("原始数据.bin")
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
}, 30_000)

test("invalid original download paths return the explicit project-path error contract", async () => {
  await using project = await memoryProject("download-invalid")
  await configure(project.path)
  for (const file of ["", "../outside.bin", path.join(project.path, "absolute.bin"), "invalid\0.bin"]) {
    const response = await download(project.path, file)
    expect({ status: response.status, body: await response.json() }).toMatchObject({
      status: 400, body: { name: "FileInvalidPathError", data: { path: file } },
    })
  }
}, 30_000)

test("missing and directory downloads return the explicit file-not-found contract", async () => {
  await using project = await memoryProject("download-missing")
  await configure(project.path)
  await fs.mkdir(path.join(project.path, "folder"))
  for (const file of ["missing.bin", "folder"]) {
    const response = await download(project.path, file)
    expect({ status: response.status, body: await response.json() }).toMatchObject({
      status: 404, body: { name: "FileNotFoundError", data: { path: file } },
    })
  }
}, 30_000)

test("completed original file streams close their actual file handle", async () => {
  await using project = await memoryProject("download-complete")
  const bytes = Buffer.alloc(2 * 1024 * 1024, 0xa7)
  await fs.writeFile(path.join(project.path, "payload.bin"), bytes)
  await Instance.provide({ directory: project.path, fn: async () => {
    const original = await File.openDownload("payload.bin")
    const closed = once(original.stream, "close")
    const body = Readable.toWeb(original.stream) as unknown as ReadableStream<Uint8Array>
    expect(Buffer.from(await new Response(body).arrayBuffer())).toEqual(bytes)
    await closed
    expect(original.stream.closed).toBe(true)
  } })
}, 30_000)

test("cancelled Web download streams close the original file handle", async () => {
  await using project = await memoryProject("download-cancel")
  await fs.writeFile(path.join(project.path, "payload.bin"), Buffer.alloc(2 * 1024 * 1024, 0xb8))
  await Instance.provide({ directory: project.path, fn: async () => {
    const original = await File.openDownload("payload.bin")
    const closed = new Promise<void>((resolve) => original.stream.once("close", resolve))
    const reader = Readable.toWeb(original.stream).getReader()
    const first = await reader.read()
    expect(first.value.byteLength).toBeGreaterThan(0)
    await reader.cancel()
    await closed
    expect(original.stream.closed).toBe(true)
  } })
}, 30_000)

test("request cancellation closes the original download stream with AbortError", async () => {
  await using project = await memoryProject("download-abort")
  await fs.writeFile(path.join(project.path, "payload.bin"), Buffer.alloc(2 * 1024 * 1024, 0xc9))
  await Instance.provide({ directory: project.path, fn: async () => {
    const controller = new AbortController()
    const original = await File.openDownload("payload.bin", controller.signal)
    const closed = new Promise<void>((resolve) => original.stream.once("close", resolve))
    const reader = Readable.toWeb(original.stream).getReader()
    expect((await reader.read()).value.byteLength).toBeGreaterThan(0)
    controller.abort()
    let failure: unknown
    try {
      while (!(await reader.read()).done) { /* Drain any already delivered chunk. */ }
    } catch (cause) {
      failure = cause
    }
    expect(failure).toMatchObject({ name: "AbortError" })
    await closed
    expect(original.stream.closed).toBe(true)
  } })
}, 30_000)
