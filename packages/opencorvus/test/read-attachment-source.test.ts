import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { resolveSessionExecutionAuthority } from "../src/engine/task-session-lineage"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Message } from "../src/session/message"
import { AttachmentStore } from "../src/storage/attachment-store"
import { ReadTool } from "../src/tool/read"
import { Tool } from "../src/tool/tool"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

async function context(): Promise<Tool.Context> {
  const session = await Session.create({ kind: "assistant", title: "Attachment source read contract" })
  return {
    sessionID: session.id,
    messageID: "message_attachment_source_contract",
    callID: "tool_attachment_source_contract",
    agent: "coding",
    abort: new AbortController().signal,
    messages: [],
    executionAuthority: await resolveSessionExecutionAuthority({
      sessionID: session.id, projectID: Instance.project.id, expected: { kind: "conversation" },
    }),
    executionSurface: Tool.executionSurface(["read"], []),
    metadata() {},
  }
}

test("attachment URL, shorthand and physical-path reads retain original names, exact paths and cited ranges", async () => {
  await using project = await memoryProject("attachment-source-name")
  await Instance.provide({ directory: project.path, fn: async () => {
    const reference = await AttachmentStore.write(Instance.project.id, Buffer.from("one\ntwo\nthree\nfour\nfive\n"), "text/markdown", " Résumé（终版）.md")
    const located = AttachmentStore.nameFromUrl(reference.url)!
    const absolute = AttachmentStore.resolveAbsolute(located.projectID, located.name)!
    const reader = await ReadTool.init()
    const ctx = await context()
    const results = []
    const paths = [reference.url, `attachment:${located.name}`, `attachment://${located.name}`, absolute, path.relative(project.path, absolute)]
    if (process.platform === "win32") paths.push(absolute.toUpperCase())
    for (const filePath of paths) {
      const result = await reader.execute({ filePath, offset: 3, limit: 2 }, ctx)
      expect(result.title).toBe(reference.filename!)
      expect(Message.SourcePayload.parse(result.sources![0])).toMatchObject({
        type: "source-file", origin: "attachment", path: absolute, title: reference.filename,
        range: { startLine: 3, endLine: 4 }, provider: "opencorvus-read",
      })
      expect(result.output).toContain("3: three")
      results.push(result.sources![0].sourceId)
    }
    expect(new Set(results).size).toBe(1)
    const copy = path.join(project.path, located.name)
    await fs.copyFile(absolute, copy)
    const copied = await reader.execute({ filePath: copy, offset: 3, limit: 2 }, ctx)
    expect(copied).toMatchObject({ title: located.name, sources: [{ path: copy, title: located.name }] })
    const metadata = await reader.execute({ filePath: absolute + ".metadata.json" }, ctx)
    expect(metadata.output).toContain(reference.filename!)
  } })
}, 30_000)

test("binary attachment read results carry the canonical filename and original bytes", async () => {
  await using project = await memoryProject("attachment-source-image")
  await Instance.provide({ directory: project.path, fn: async () => {
    const bytes = await fs.readFile(path.resolve(import.meta.dir, "../../overlay/src-tauri/icons/128x128@2x.png"))
    const reference = await AttachmentStore.write(Instance.project.id, bytes, "image/png", "研究图.png")
    const result = await (await ReadTool.init()).execute({ filePath: reference.url }, await context())
    expect(result.title).toBe("研究图.png")
    expect(result.attachments![0]).toMatchObject({ type: "file", mime: "image/png", filename: "研究图.png" })
    const returned = AttachmentStore.nameFromUrl(result.attachments![0].url)!
    expect((await AttachmentStore.read(returned.projectID, returned.name)).equals(bytes)).toBe(true)
    expect(result.sources![0]).toMatchObject({ origin: "attachment", title: "研究图.png" })
    expect(result.metadata).toMatchObject({ readType: "binary", lines: 0, totalLines: 0 })
  } })
}, 30_000)

test("read results describe actual text and directory windows, including empty and capped content", async () => {
  await using project = await memoryProject("read-result-facts")
  await Instance.provide({ directory: project.path, fn: async () => {
    const reader = await ReadTool.init(), ctx = await context()
    const long = Array.from({ length: 100 }, (_, index) => String(index + 1).padStart(3, "0") + "x".repeat(997)).join("\n")
    await fs.writeFile(path.join(project.path, "short.md"), "one\ntwo\n")
    await fs.writeFile(path.join(project.path, "empty.md"), "")
    await fs.writeFile(path.join(project.path, "blank.md"), "\n")
    await fs.writeFile(path.join(project.path, "long.md"), long)
    await fs.mkdir(path.join(project.path, "entries"))
    await fs.mkdir(path.join(project.path, "empty-dir"))
    for (const name of ["a.txt", "b.txt", "c.txt"]) await fs.writeFile(path.join(project.path, "entries", name), name)
    for (const [filePath, offset, limit, expected] of [
      ["short.md", 1, 2000, { readType: "text", offset: 1, lines: 2, totalLines: 2 }],
      ["empty.md", 1, 2000, { readType: "text", offset: 1, lines: 0, totalLines: 0 }],
      ["blank.md", 1, 2000, { readType: "text", offset: 1, lines: 1, totalLines: 1 }],
      ["long.md", 98, 2000, { readType: "text", offset: 98, lines: 3, totalLines: 100 }],
      ["long.md", 1, 2000, { readType: "text", offset: 1, lines: 51, totalLines: 100 }],
      ["entries", 2, 2000, { readType: "directory", offset: 2, lines: 2, totalLines: 3 }],
      ["empty-dir", 1, 2000, { readType: "directory", offset: 1, lines: 0, totalLines: 0 }],
    ] as const) {
      const result = await reader.execute({ filePath, offset, limit }, ctx)
      expect(result.metadata).toMatchObject(expected)
    }
    const capped = await reader.execute({ filePath: "long.md", limit: 2000 }, ctx)
    expect(capped.sources![0]).toMatchObject({ range: { startLine: 1, endLine: 51 } })
    expect(capped.output).toContain("Use offset=52 to continue.")
    const empty = await reader.execute({ filePath: "empty.md" }, ctx)
    expect(empty.output).toContain("End of file - total 0 lines")
    const entries = await reader.execute({ filePath: "entries", offset: 2 }, ctx)
    expect(entries.output).toContain("b.txt\nc.txt")
  } })
}, 30_000)

test("read rejects non-integer or non-positive windows with the parameter error cause", async () => {
  await using project = await memoryProject("read-window-parameter-errors")
  await Instance.provide({ directory: project.path, fn: async () => {
    await fs.writeFile(path.join(project.path, "file.md"), "one\ntwo\n")
    const reader = await ReadTool.init(), ctx = await context()
    for (const [field, value, code] of [
      ["offset", 0, "too_small"], ["offset", 1.5, "invalid_type"],
      ["limit", 0, "too_small"], ["limit", 1.5, "invalid_type"],
    ] as const) {
      await expect(reader.execute({ filePath: "file.md", [field]: value }, ctx)).rejects.toMatchObject({
        cause: { name: "ZodError", issues: [{ code, path: [field] }] },
      })
    }
    expect(reader.parameters.parse({ filePath: "file.md", offset: "1", limit: "2" })).toEqual({
      filePath: "file.md", offset: 1, limit: 2,
    })
  } })
}, 30_000)

test("same-name attachment bytes keep distinct source identities and ordinary files retain their path", async () => {
  await using project = await memoryProject("attachment-source-identity")
  await Instance.provide({ directory: project.path, fn: async () => {
    const reader = await ReadTool.init(), ctx = await context()
    const sources = []
    for (const body of ["first original", "second original"]) {
      const reference = await AttachmentStore.write(Instance.project.id, Buffer.from(body), "text/plain", "same.txt")
      const result = await reader.execute({ filePath: reference.url }, ctx)
      expect(result).toMatchObject({ title: "same.txt", sources: [{ title: "same.txt", origin: "attachment" }] })
      sources.push(result.sources![0])
    }
    expect(new Set(sources.map((source) => source.sourceId)).size).toBe(2)
    expect(new Set(sources.map((source) => source.type === "source-file" ? source.path : "")).size).toBe(2)
    const absolute = path.join(project.path, "project-note.md")
    await fs.writeFile(absolute, "ordinary project file\n")
    const result = await reader.execute({ filePath: "project-note.md" }, ctx)
    expect(result).toMatchObject({ title: "project-note.md", sources: [{ type: "source-file", path: absolute, title: "project-note.md" }] })
  } })
}, 30_000)

test("an attachment with missing canonical metadata returns the filesystem error contract", async () => {
  await using project = await memoryProject("attachment-source-metadata")
  await Instance.provide({ directory: project.path, fn: async () => {
    const reference = await AttachmentStore.write(Instance.project.id, Buffer.from("original"), "text/plain", "metadata.txt")
    const located = AttachmentStore.nameFromUrl(reference.url)!
    const metadata = AttachmentStore.resolveAbsolute(located.projectID, located.name)! + ".metadata.json"
    const preserved = metadata + ".preserved"
    const reader = await ReadTool.init(), ctx = await context()
    await fs.rename(metadata, preserved)
    try {
      await expect(reader.execute({ filePath: reference.url }, ctx)).rejects.toMatchObject({ code: "ENOENT" })
    } finally {
      await fs.rename(preserved, metadata)
    }
  } })
}, 30_000)
