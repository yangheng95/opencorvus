import { expect, test } from "bun:test"
import { redactInlinePayloads } from "../../src/util/inline-base64"

const binary = Buffer.from("%PDF-1.7\n" + "Z".repeat(30)).toString("base64")
test.each([
  ["data:text/plain;base64,YQ==", "inline_binary_omitted(kind=data_url offset=7 media=text/plain payload_chars=4)"],
  ["data:text/plain,hello", "inline_payload_omitted(kind=data_url offset=7 chars=21)"],
  [binary, "inline_binary_omitted(kind=raw_base64 offset=7 reason=binary_magic payload_chars=52)"],
])("reports the actual replacement span while preserving diagnostic text for %s", (payload, marker) => {
  const input = `before ${payload} after`
  const replacements: Array<{ start: number; end: number; replacement: string }> = []
  const actual = redactInlinePayloads(input, (start, end, replacement) => replacements.push({ start, end, replacement }))
  expect({ actual, replacements, ordinary: redactInlinePayloads(input) }).toEqual({
    actual: `before ${marker} after`,
    ordinary: `before ${marker} after`,
    replacements: [{ start: 7, end: 7 + payload.length, replacement: marker }],
  })
})
