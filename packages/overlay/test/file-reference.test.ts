import { expect, test } from "bun:test"
import {
  elementFileReference,
  fileReferenceHtmlAttributes,
  fileReferenceRange,
  parseFileReference,
  FILE_REFERENCE_PATH_ATTRIBUTE,
  PROJECT_FILE_REFERENCE_PATH_ATTRIBUTE,
} from "../src/utils/file-reference"
import { renderMarkdown } from "../src/utils/markdown"

const escapeAttribute = (value: string) => value.replace(/"/g, "&quot;")

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

test("only a real location becomes an editor range", () => {
  expect(fileReferenceRange(parseFileReference("src/a.ts:42"))).toEqual({ startLine: 42, endLine: 42 })
  expect(fileReferenceRange(parseFileReference("src/a.ts"))).toBeUndefined()
  expect(fileReferenceRange(undefined)).toBeUndefined()
})

test("a reference round-trips through its rendered attributes", () => {
  const reference = parseFileReference("src/a.ts:42:7")
  const attributes = fileReferenceHtmlAttributes(FILE_REFERENCE_PATH_ATTRIBUTE, reference, escapeAttribute)
  expect(attributes).toBe(` ${FILE_REFERENCE_PATH_ATTRIBUTE}="src/a.ts" data-file-line="42" data-file-column="7"`)

  const attributeValues: Record<string, string> = {
    [FILE_REFERENCE_PATH_ATTRIBUTE]: "src/a.ts",
    "data-file-line": "42",
    "data-file-column": "7",
  }
  const element = { getAttribute: (name: string) => attributeValues[name] ?? null } as Element
  expect(elementFileReference(element, FILE_REFERENCE_PATH_ATTRIBUTE)).toEqual(reference)
})

test("a column without a line is dropped rather than guessed at", () => {
  const attributeValues: Record<string, string> = {
    [FILE_REFERENCE_PATH_ATTRIBUTE]: "src/a.ts",
    "data-file-column": "7",
  }
  const element = { getAttribute: (name: string) => attributeValues[name] ?? null } as Element
  expect(elementFileReference(element, FILE_REFERENCE_PATH_ATTRIBUTE)).toEqual({ path: "src/a.ts" })
})

test("a rendered codespan carries the cited line to the click handler", () => {
  const html = renderMarkdown("see `src/engine/pipeline.ts:42` for the fence")
  expect(html).toContain(`${FILE_REFERENCE_PATH_ATTRIBUTE}="src/engine/pipeline.ts"`)
  expect(html).toContain(`data-file-line="42"`)
  // The label keeps the location the author wrote.
  expect(html).toContain(">src/engine/pipeline.ts:42<")
})

test("a codespan without a location renders no line attribute", () => {
  const html = renderMarkdown("see `src/engine/pipeline.ts` for the fence")
  expect(html).toContain(`${FILE_REFERENCE_PATH_ATTRIBUTE}="src/engine/pipeline.ts"`)
  expect(html).not.toContain("data-file-line")
})

test("a markdown link to a cited location resolves as a project file", () => {
  const html = renderMarkdown("[the fence](src/engine/pipeline.ts:42)")
  expect(html).toContain(`${PROJECT_FILE_REFERENCE_PATH_ATTRIBUTE}="src/engine/pipeline.ts"`)
  expect(html).toContain(`data-file-line="42"`)
})

test("a web link with a port is still a web link", () => {
  const html = renderMarkdown("[docs](https://example.com:8080)")
  expect(html).not.toContain(PROJECT_FILE_REFERENCE_PATH_ATTRIBUTE)
  expect(html).toContain(`href="https://example.com:8080"`)
})
