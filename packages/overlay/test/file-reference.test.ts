import { expect, test } from "bun:test"
import { fileReferenceRange, parseFileReference } from "../src/utils/file-reference"


test("a cited location is split off the path it qualifies", () => {
  expect(parseFileReference("src/engine/pipeline.ts:42")).toEqual({ path: "src/engine/pipeline.ts", line: 42 })
  expect(parseFileReference("src/engine/pipeline.ts:42:7")).toEqual({
    path: "src/engine/pipeline.ts",
    line: 42,
    column: 7,
  })
  expect(parseFileReference("  src/a.ts:3  ")).toEqual({ path: "src/a.ts", line: 3 })
})

test("a path without a well-formed location survives intact", () => {
  expect(parseFileReference("src/engine/pipeline.ts")).toEqual({ path: "src/engine/pipeline.ts" })
  // A Windows drive letter is not a location separator: the numeric tail has to
  // run to the end of the string.
  expect(parseFileReference("C:\\repo\\src\\a.ts")).toEqual({ path: "C:\\repo\\src\\a.ts" })
  expect(parseFileReference("C:\\repo\\src\\a.ts:42")).toEqual({ path: "C:\\repo\\src\\a.ts", line: 42 })
  expect(parseFileReference("src/a.ts:0")).toEqual({ path: "src/a.ts:0" })
  expect(parseFileReference("src/a.ts:12.5")).toEqual({ path: "src/a.ts:12.5" })
  expect(parseFileReference("")).toEqual({ path: "" })
})

test("a cited line becomes an editor range", () => {
  expect(fileReferenceRange(parseFileReference("src/a.ts:42"))).toEqual({ startLine: 42, endLine: 42 })
})

test("a cited column survives the location-to-range data mapping", () => {
  expect(fileReferenceRange(parseFileReference("src/a.ts:42:7"))).toEqual({ startLine: 42, endLine: 42, startColumn: 7 })
})

test.each([
  ["src/example.ts#L30", { path: "src/example.ts", line: 30 }],
  ["资料/例子.md#L30-L32", { path: "资料/例子.md", line: 30, endLine: 32 }],
  ["C:\\repo\\example.ts#L30-L30", { path: "C:\\repo\\example.ts", line: 30, endLine: 30 }],
])("a file line anchor retains its exact location: %s", (raw, expected) => {
  expect(parseFileReference(raw as string)).toEqual(expected)
})

test("an anchored line range becomes the inclusive editor range", () => {
  expect(fileReferenceRange(parseFileReference("src/example.ts#L30-L32"))).toEqual({ startLine: 30, endLine: 32 })
  expect(fileReferenceRange(parseFileReference("src/example.ts#L30"))).toEqual({ startLine: 30, endLine: 30 })
})

test.each([
  ["src/example.ts:20-22", { path: "src/example.ts", line: 20, endLine: 22 }],
  ["资料/范围示例.txt:20-22", { path: "资料/范围示例.txt", line: 20, endLine: 22 }],
  ["C:\\repo\\example.ts:20-22", { path: "C:\\repo\\example.ts", line: 20, endLine: 22 }],
  ["example.ts:20-20", { path: "example.ts", line: 20, endLine: 20 }],
])("a source-style colon range retains its complete location: %s", (raw, expected) => {
  expect(parseFileReference(raw as string)).toEqual(expected)
})

test("a source-style range becomes the same inclusive workbench range", () => {
  expect(fileReferenceRange(parseFileReference("资料/范围示例.txt:20-22"))).toEqual({ startLine: 20, endLine: 22 })
})

test.each(["src/example.ts:0-2", "src/example.ts:20-0", "src/example.ts:22-20", "src/example.ts:20-9007199254740992"])(
  "an uninterpreted colon range retains the original reference: %s", (raw) => {
    expect(parseFileReference(raw)).toEqual({ path: raw })
  },
)

test.each(["src/example.ts#section", "src/example.ts#L0", "src/example.ts#L30-L12", "src/example.ts#L9007199254740992"])(
  "an uninterpreted fragment retains the complete original reference: %s", (raw) => {
    expect(parseFileReference(raw)).toEqual({ path: raw })
  },
)
