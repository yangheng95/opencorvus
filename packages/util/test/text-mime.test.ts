import { expect, test } from "bun:test"
import { isDecodableText } from "../src/text-mime"

test.each([
  ["text/plain", "notes.txt"],
  [" TEXT/CSV; charset=utf-8 ", "table.csv"],
  ["application/json; charset=utf-8", "data.json"],
  ["application/xml", "feed.xml"],
  ["application/yaml", "config.yaml"],
  ["application/javascript", "source.js"],
  ["application/typescript", "source.ts"],
  ["application/schema+json", "schema.json"],
  ["application/atom+xml", "feed.xml"],
  ["image/svg+xml", "drawing.svg"],
  ["application/octet-stream", "config.YAML"],
  ["application/octet-stream", "source.py"],
  ["application/octet-stream", "source.ts"],
])("classifies readable %s attachment %s", (mime, filename) => {
  expect(isDecodableText(mime, filename)).toBe(true)
})
