import { expect, test } from "bun:test"
import { classifyEntryBasename } from "../src/entry-basename"

test.each(["project", "资料 report.txt", ".config", "report.2026"])(
  "classifies an ordinary host name as valid: %s",
  (name) => {
    expect(classifyEntryBasename(name, true)).toBe("valid")
    expect(classifyEntryBasename(name, false)).toBe("valid")
  },
)

test.each(["report?2026", "report:2026", "trailing.", "trailing ", "CON"])(
  "preserves host-specific accepted names: %s",
  (name) => {
    expect(classifyEntryBasename(name, false)).toBe("valid")
  },
)

test.each(["", ".", ".."])("classifies an empty or dot component: %s", (name) => {
  expect(classifyEntryBasename(name, true)).toBe("empty")
  expect(classifyEntryBasename(name, false)).toBe("empty")
})

test.each(["nested/file", "nested\\file", "file\0name"])("classifies a path component boundary: %s", (name) => {
  expect(classifyEntryBasename(name, true)).toBe("path")
  expect(classifyEntryBasename(name, false)).toBe("path")
})

test.each(["named?project", "name:stream", "name|part", "name\u001fpart"])(
  "classifies an invalid Windows component: %s",
  (name) => {
    expect(classifyEntryBasename(name, true)).toBe("windows-invalid")
  },
)

// Device aliases are only classified; these cases perform no file operations.
test.each(["CON", "con.txt", "COM1.tar.gz", "LPT9", "trailing.", "trailing "])(
  "classifies a reserved Windows component: %s",
  (name) => {
    expect(classifyEntryBasename(name, true)).toBe("windows-reserved")
  },
)

test.each(["COM¹", "com².txt", "COM³.tar.gz", "LPT¹", "lpt².xlsx", "LPT³.report.docx"])(
  "classifies a Windows superscript device alias while retaining other host semantics: %s",
  (name) => {
    expect(classifyEntryBasename(name, true)).toBe("windows-reserved")
    expect(classifyEntryBasename(name, false)).toBe("valid")
  },
)
