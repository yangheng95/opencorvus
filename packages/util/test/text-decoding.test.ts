import { describe, expect, test } from "bun:test"
import { decodeUnicodeText, TextDecodingError } from "../src/text-decoding"

describe("Unicode document decoding", () => {
  const text = "原文核对788\r\n中文与😀应完整显示。\r\n"

  test("UTF-8 preserves Chinese, emoji and line endings", () => {
    expect(decodeUnicodeText(new TextEncoder().encode(text))).toBe(text)
  })

  test("UTF-8 BOM identifies the start of the document", () => {
    expect(decodeUnicodeText(Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]))).toBe(text)
  })

  test.each(["utf-16le", "utf-16be"] as const)("%s BOM selects byte order", (encoding) => {
    const content = Buffer.from(text, "utf16le")
    const bytes =
      encoding === "utf-16le"
        ? Buffer.concat([Buffer.from([0xff, 0xfe]), content])
        : Buffer.concat([Buffer.from([0xfe, 0xff]), content.swap16()])
    expect(decodeUnicodeText(bytes)).toBe(text)
  })

  test("empty bytes decode to an empty document", () => {
    expect(decodeUnicodeText(new Uint8Array())).toBe("")
  })

  test.each([
    { encoding: "utf-8", bytes: [0xd6, 0xd0, 0xce, 0xc4] },
    { encoding: "utf-8", bytes: [0xe4, 0xb8] },
    { encoding: "utf-16le", bytes: [0xff, 0xfe, 0x41] },
    { encoding: "utf-16be", bytes: [0xfe, 0xff, 0xd8, 0x00] },
  ])("malformed $encoding returns the explicit decoding error", ({ encoding, bytes }) => {
    let error: unknown
    try {
      decodeUnicodeText(Uint8Array.from(bytes))
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(TextDecodingError)
    expect(error).toMatchObject({ code: "INVALID_TEXT_ENCODING", encoding })
  })
})
