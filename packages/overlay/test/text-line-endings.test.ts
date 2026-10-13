import { expect, test } from "bun:test"
import { ChangeSet, Text } from "@codemirror/state"
import {
  changeTextLineEndings,
  invertTextLineEndings,
  mapTextLineEndings,
  overrideTextLineEndings,
  readTextLineEndings,
  writeTextLineEndings,
} from "../src/utils/text-line-endings"

const text = (value: string) => Text.of(value.split(/\r\n|\r|\n/))

test.each(["", "single 😀 line", "a\r\nb\r\n", "a\nb\n", "a\rb\r", "中😀\r\nb\nc\rd"])(
  "raw line endings round trip exactly: %j", (raw) => {
    expect(writeTextLineEndings(text(raw), readTextLineEndings(raw))).toBe(raw)
  },
)

test("line ending positions use canonical UTF-16 offsets", () => {
  expect(readTextLineEndings("中😀\r\nb\nc\rd")).toEqual({
    preferred: "\r\n",
    entries: [{ pos: 3, separator: "\r\n" }, { pos: 5, separator: "\n" }, { pos: 7, separator: "\r" }],
  })
})

test.each(["\r\n", "\n", "\r"])("inserting text preserves existing %j separators", (separator) => {
  const raw = `a${separator}b${separator}c`, doc = text(raw)
  const changes = ChangeSet.of({ from: 0, insert: "x" }, doc.length)
  expect(writeTextLineEndings(changes.apply(doc), changeTextLineEndings(readTextLineEndings(raw), changes))).toBe("x" + raw)
})

test("new boundaries inherit the file format and retain each mixed boundary", () => {
  const raw = "a\r\nb\nc\rd", doc = text(raw)
  const changes = ChangeSet.of([{ from: 1, insert: "\nx" }, { from: 4, insert: "y\nz" }], doc.length)
  expect(writeTextLineEndings(changes.apply(doc), changeTextLineEndings(readTextLineEndings(raw), changes))).toBe("a\r\nx\r\nb\ny\r\nzc\rd")
})

test("deleting boundaries and applying the inverse restores their exact separators", () => {
  const raw = "a\r\nb\nc\rd", doc = text(raw), endings = readTextLineEndings(raw)
  const changes = ChangeSet.of([{ from: 1, to: 2 }, { from: 4, to: 6 }], doc.length)
  const changedDoc = changes.apply(doc), changed = changeTextLineEndings(endings, changes)
  expect(writeTextLineEndings(changedDoc, changed)).toBe("ab\nd")
  const inverse = changes.invert(doc), restored = invertTextLineEndings(endings, changes, [])
  expect(restored).toEqual([{ pos: 1, separator: "\r\n" }, { pos: 5, separator: "\r" }])
  const undone = overrideTextLineEndings(changeTextLineEndings(changed, inverse), restored)
  expect(writeTextLineEndings(inverse.apply(changedDoc), undone)).toBe(raw)
  const redoEndings = invertTextLineEndings(changed, inverse, restored)
  expect(writeTextLineEndings(changedDoc, overrideTextLineEndings(changeTextLineEndings(undone, changes), redoEndings))).toBe("ab\nd")
})

test("mapped history facts follow surviving newline characters", () => {
  const entries = readTextLineEndings("a\r\nb\nc").entries
  const changes = ChangeSet.of([{ from: 0, insert: "😀" }, { from: 3, to: 4 }], 5)
  expect(mapTextLineEndings(entries, changes)).toEqual([{ pos: 3, separator: "\r\n" }])
})

test("format-only replacement and its inverse preserve the current text", () => {
  const doc = text("a\nb\nc"), old = readTextLineEndings("a\r\nb\rc")
  const overrides = readTextLineEndings("a\nb\nc").entries, changes = ChangeSet.empty(doc.length)
  const next = overrideTextLineEndings(old, overrides)
  expect(writeTextLineEndings(doc, next)).toBe("a\nb\nc")
  expect(writeTextLineEndings(doc, overrideTextLineEndings(next, invertTextLineEndings(old, changes, overrides)))).toBe("a\r\nb\rc")
})

test("whole-document replacement uses its supplied original separators", () => {
  const old = "a\r\nb", raw = "x\ny\rz\r\n", doc = text(old)
  const changes = ChangeSet.of({ from: 0, to: doc.length, insert: text(raw) }, doc.length)
  const overrides = readTextLineEndings(raw).entries
  expect(writeTextLineEndings(changes.apply(doc), overrideTextLineEndings(changeTextLineEndings(readTextLineEndings(old), changes), overrides))).toBe(raw)
})

test("a document cleared and refilled retains its selected line format", () => {
  const doc = text("a\r\nb"), original = readTextLineEndings("a\r\nb")
  const clear = ChangeSet.of({ from: 0, to: doc.length }, doc.length)
  const cleared = changeTextLineEndings(original, clear), insert = ChangeSet.of({ from: 0, insert: "x\ny" }, 0)
  expect(writeTextLineEndings(insert.apply(Text.empty), changeTextLineEndings(cleared, insert))).toBe("x\r\ny")
})
