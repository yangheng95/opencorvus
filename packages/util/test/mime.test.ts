import { expect, test } from "bun:test"
import { baseMediaType, mediaInputModality } from "../src/mime"

test.each([
  ["IMAGE/PNG", "image/png", "image"],
  [' Image/SVG+XML; charset="utf-8" ', "image/svg+xml", "image"],
  ["image/png; profile=srgb", "image/png", "image"],
  ["APPLICATION/PDF; version=1.7", "application/pdf", "pdf"],
  ["Audio/WAV; codecs=1", "audio/wav", "audio"],
  ["VIDEO/MP4; codecs=avc1", "video/mp4", "video"],
])("classifies declared %s as %s with its model modality", (mime, type, modality) => {
  expect({ type: baseMediaType(mime), modality: mediaInputModality(mime) }).toEqual({ type, modality })
})

test("parses the media type before quoted parameters containing semicolons", () => {
  const original = 'Text/Plain; title="semi;colon"; CHARSET="windows-1252"'
  expect(baseMediaType(original)).toBe("text/plain")
})
