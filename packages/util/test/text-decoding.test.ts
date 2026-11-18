import { describe, expect, test } from "bun:test"
import { decodeText, TextDecodingError } from "../src/text-decoding"

describe("original text decoding", () => {
  const text = "原文核对788\r\n中文与😀应完整显示。\r\n"

  test("UTF-8 preserves Chinese, emoji and line endings", () => {
    expect(decodeText(new TextEncoder().encode(text))).toBe(text)
  })

  test("UTF-8 BOM identifies the start of the document", () => {
    expect(decodeText(Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]))).toBe(text)
  })

  test.each(["utf-16le", "utf-16be"] as const)("%s BOM selects byte order", (encoding) => {
    const content = Buffer.from(text, "utf16le")
    const bytes =
      encoding === "utf-16le"
        ? Buffer.concat([Buffer.from([0xff, 0xfe]), content])
        : Buffer.concat([Buffer.from([0xfe, 0xff]), content.swap16()])
    expect(decodeText(bytes)).toBe(text)
  })

  test("empty bytes decode to an empty document", () => {
    expect(decodeText(new Uint8Array())).toBe("")
  })

  test.each([
    { encoding: "utf-8", bytes: [0xd6, 0xd0, 0xce, 0xc4] },
    { encoding: "utf-8", bytes: [0xe4, 0xb8] },
    { encoding: "utf-16le", bytes: [0xff, 0xfe, 0x41] },
    { encoding: "utf-16be", bytes: [0xfe, 0xff, 0xd8, 0x00] },
  ])("malformed $encoding returns the explicit decoding error", ({ encoding, bytes }) => {
    let error: unknown
    try {
      decodeText(Uint8Array.from(bytes))
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(TextDecodingError)
    expect(error).toMatchObject({ code: "INVALID_TEXT_ENCODING", encoding })
  })

  test.each([
    { mime: 'Text/Plain; title="semi;colon"; CHARSET="windows-1252"', bytes: [0x43, 0x61, 0x66, 0xe9, 0x20, 0x80], expected: "Café €" },
    { mime: "text/plain; charset=ISO-8859-1", bytes: [0x80, 0xe9], expected: "€é" },
    { mime: "application/schema+json; charset=gb18030", bytes: [0xd6, 0xd0, 0xce, 0xc4], expected: "中文" },
    { mime: "text/plain; charset=utf-16be", bytes: [0x4e, 0x2d, 0x65, 0x87], expected: "中文" },
    { mime: "text/plain; charset=utf-16le", bytes: [0x2d, 0x4e, 0x87, 0x65], expected: "中文" },
  ])("decodes the declared charset in $mime", ({ mime, bytes, expected }) => {
    expect(decodeText(Uint8Array.from(bytes), mime)).toBe(expected)
  })

  test.each([
    [0xef, 0xbb, 0xbf, 0x41],
    [0xff, 0xfe, 0x41, 0x00],
    [0xfe, 0xff, 0x00, 0x41],
  ])("uses the original BOM before a conflicting charset: %j", (...bytes) => {
    expect(decodeText(Uint8Array.from(bytes), "text/plain; charset=windows-1252")).toBe("A")
  })

  test.each(["x-owned-unsupported", "replacement", ""])("returns the explicit error for charset %j", (encoding) => {
    let error: unknown
    try {
      decodeText(new TextEncoder().encode("Plain source"), `text/plain; charset="${encoding}"`)
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(TextDecodingError)
    expect(error).toMatchObject({ code: "INVALID_TEXT_ENCODING", encoding })
  })

  test("decodes complete GB18030 characters at each budget boundary", () => {
    const bytes = Uint8Array.from([0x41, 0xd6, 0xd0, 0xce, 0xc4])
    expect([1, 2, 3, 4, 5].map((maxBytes) => decodeText(bytes, "text/plain; charset=gb18030", { maxBytes })))
      .toEqual(["A", "A", "A中", "A中", "A中文"])
  })

  test("retains complete UTF-16 surrogate pairs in a bounded document", () => {
    const bytes = Buffer.from("A😀Z", "utf16le")
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((maxBytes) => decodeText(bytes, "text/plain; charset=utf-16le", { maxBytes })))
      .toEqual(["", "A", "A", "A", "A", "A😀", "A😀", "A😀Z"])
  })
})
