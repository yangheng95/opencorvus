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
