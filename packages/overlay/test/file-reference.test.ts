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
