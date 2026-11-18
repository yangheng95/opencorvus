import { expect, test } from "bun:test"
import { decodeUtf8Prefix } from "../../src/util/utf8"
import { decodeTextBytes } from "../../src/session/text-mime"

test("decodes the authored complete prefix at every multibyte boundary", () => {
  const bytes = new TextEncoder().encode("Aغ文🙂Z")
  expect(Array.from({ length: 13 }, (_, limit) => decodeUtf8Prefix(bytes, limit))).toEqual([
    "",
    "A",
    "A",
    "Aغ",
    "Aغ",
    "Aغ",
    "Aغ文",
    "Aغ文",
    "Aغ文",
    "Aغ文",
    "Aغ文🙂",
    "Aغ文🙂Z",
    "Aغ文🙂Z",
  ])
})

test("preserves BOM content and typed-array offsets", () => {
  const bytes = new TextEncoder().encode("!\uFEFF文!").subarray(1, 7)
  expect([
    decodeUtf8Prefix(bytes, 2),
    decodeUtf8Prefix(bytes, 3),
    decodeUtf8Prefix(bytes, 6),
    decodeTextBytes(bytes),
  ]).toEqual(["", "\uFEFF", "\uFEFF文", "\uFEFF文"])
})

test("flushes the real malformed EOF while a partial prefix retains its complete text", () => {
  const bytes = new Uint8Array([0x41, 0xe6, 0x96])
  expect([decodeUtf8Prefix(bytes, 2), decodeUtf8Prefix(bytes, 3), decodeTextBytes(bytes)]).toEqual(["A", "A�", "A�"])
  const innerInvalid = new Uint8Array([0x41, 0xff, 0x42, 0xe6, 0x96, 0x87])
  expect([decodeUtf8Prefix(innerInvalid, 5), decodeUtf8Prefix(innerInvalid, 6)]).toEqual(["A�B", "A�B文"])
})

test("projects complete declared-encoding prefixes with the existing attachment budget notice", () => {
  const gbBytes = Buffer.concat([Buffer.from("A"), Buffer.from(Array.from({ length: 100001 }, () => [0xd6, 0xd0]).flat())])
  const utf16Bytes = Buffer.from("A" + "😀".repeat(50001), "utf16le")
  const notice = "\n\n[... truncated — file exceeds 195.3125KB limit ...]"
  expect(decodeTextBytes(gbBytes, "text/plain; charset=gb18030")).toBe("A" + "中".repeat(99999) + notice)
  expect(decodeTextBytes(utf16Bytes, "text/plain; charset=utf-16le")).toBe("A" + "😀".repeat(49999) + notice)
})
