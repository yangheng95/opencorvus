import { expect, test } from "bun:test"
import { markdownListPreviewItems } from "../src/utils/markdown-preview"

test("projects authored list items in order with their visible words and wrapped Markdown", () => {
  const notes = [
    "### Changed",
    "",
    "- Keep the **selected file** open",
    "  with its [review summary](https://example.com/reviews).",
    "",
    "```md",
    "- Literal list syntax inside the example",
    "```",
    "",
    "- 恢复原有焦点。",
  ].join("\n")

  expect(markdownListPreviewItems(notes)).toEqual([
    {
      markdown: "Keep the **selected file** open\nwith its [review summary](https://example.com/reviews).",
      text: "Keep the selected file open with its review summary.",
    },
    { markdown: "恢复原有焦点。", text: "恢复原有焦点。" },
  ])
})
