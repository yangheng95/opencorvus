import { expect, test } from "bun:test"
import path from "node:path"
import { fileSource } from "@/tool/source"
import { Message } from "@/session/message"

test.each([" Source note.md", "notes/ Source note.md", "Source note.md "])(
  "file source preserves authored title characters in %s", (title) => {
    const absolute = path.resolve(" Source note.md")
    expect(fileSource({ path: absolute, title, range: { startLine: 1, endLine: 2 }, provider: "opencorvus-read" })).toMatchObject({
      type: "source-file", path: absolute, title, range: { startLine: 1, endLine: 2 }, provider: "opencorvus-read",
    })
  },
)

test("an untitled file source uses the exact filesystem basename", () => {
  const absolute = path.resolve(" Source note.md")
  expect(fileSource({ path: absolute })).toMatchObject({ path: absolute, title: " Source note.md" })
})

test("source validation retains exact path and title characters", () => {
  const source = { type: "source-file", sourceId: "actual-file-source", path: "/repo/file\\name.md ", title: " file\\name.md " }
  expect(Message.SourcePayload.parse(source)).toEqual(source)
})

test.each(["  const value = '中文😀'\t  ", "", " \t "])(
  "file source validation retains the supplied preview %j", (snippet) => {
    const source = fileSource({ path: path.resolve("preview.md"), snippet })
    expect(Message.SourcePayload.parse(source)).toEqual({ ...source, snippet })
  },
)

test("file source schema retains an exact single-line column", () => {
  const source = fileSource({ path: path.resolve("column.md"), range: { startLine: 4, endLine: 4, startColumn: 9 } })
  expect(Message.SourcePayload.parse(source)).toEqual(source)
})

test("different cited columns have distinct source identities on the same line", () => {
  const sources = [9, 24].map((startColumn) => fileSource({
    path: path.resolve("column.md"), range: { startLine: 4, endLine: 4, startColumn },
  }))
  expect(new Set(sources.map((source) => source.sourceId)).size).toBe(2)
})

test.each([
  [{ startLine: 4, endLine: 4, startColumn: 0 }, "too_small"],
  [{ startLine: 4, endLine: 5, startColumn: 9 }, "custom"],
])("invalid source columns produce a precise range issue for %j", (range, code) => {
  const result = Message.SourceFileRange.safeParse(range)
  expect(result.error?.issues.map((issue) => ({ code: issue.code, path: issue.path }))).toEqual([
    { code, path: ["startColumn"] },
  ])
})
